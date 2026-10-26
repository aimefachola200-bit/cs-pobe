/* République du Bénin — MEMP — CS Pobè
   Modules ajoutés : bilans trimestriels / annuel (zone et CS) avec appareil photo,
   et documents de référence (fiches PDF, thèmes 2026-2027, planification CI → CM2, règlement intérieur).
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  /* v1.10.10 — avant / arrière : appareil choisi d'après son nom (front / back, avant / arrière…), sinon le suivant :
     certains téléphones ignorent « facingMode » et rouvraient toujours la même caméra. */
  async function camerasVideo() { try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput'); } catch (e) { return []; } }
  function choisirCamera(cams, face, actuel) {
    if (!cams || cams.length < 2) return null;
    const re = face === 'user' ? /front|avant|user|selfie|facing front/i : /back|arri[eè]re|rear|environment|facing back/i;
    const parNom = cams.filter(c => re.test(c.label || ''));
    const autre = parNom.find(c => c.deviceId !== actuel) || parNom[0];
    if (autre) return autre.deviceId;
    const i = cams.findIndex(c => c.deviceId === actuel);
    return cams[(i + 1) % cams.length].deviceId;
  }
  async function ouvrirFlux(face, appareil) {
    const base = { width: { ideal: 1920 }, height: { ideal: 1080 } };
    const essais = appareil ? [{ deviceId: { exact: appareil } }] : [];
    essais.push({ facingMode: { exact: face } }, { facingMode: { ideal: face } }, {});
    let err = null;
    for (const v of essais) {
      try { return await navigator.mediaDevices.getUserMedia({ video: Object.assign({}, v, base), audio: false }); } catch (e) { err = e; if (e.name === 'NotAllowedError' || e.name === 'SecurityError') throw e; }
    }
    throw err;
  }

  const S = global.BilanSchema, REF = global.REF || {};
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const App = () => global.AppBridge;
  const esc = (v) => App().echapper(v);

  /* ---------------- utilitaires ---------------- */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'disabled' || k === 'checked') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const now = () => new Date().toISOString();
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  function toast(msg, kind) {
    const t = h('div', { class: 'xtoast ' + (kind || '') }, msg); document.body.append(t);
    setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 3800);
  }
  function saveFile(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const pickFile = (accept) => new Promise((res) => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.onchange = () => { const f = i.files[0] || null; i.remove(); res(f); }; document.body.append(i); i.click();
  });
  const readText = (f) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = rej; r.readAsText(f); });
  const clean = (s) => String(s).replace(/[^\w.-]+/g, '_');

  /* ---------------- photos : IndexedDB séparé (les photos sont lourdes) ---------------- */
  const PhotoDB = (() => {
    let dbp = null, mem = [];
    const open = () => dbp || (dbp = new Promise((res) => {
      try {
        const r = indexedDB.open('pobe-photos', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('photos', { keyPath: 'id' });
        r.onsuccess = () => res(r.result); r.onerror = () => res(null);
      } catch (e) { res(null); }
    }));
    const tx = async (mode, fn) => { const db = await open(); if (!db) return null; return new Promise((res, rej) => { const t = db.transaction('photos', mode), s = t.objectStore('photos'), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); };
    return {
      async all(bilanId) { const db = await open(); const l = db ? (await tx('readonly', s => s.getAll())) || [] : mem; return l.filter(p => p.bilanId === bilanId).sort((a, b) => a.date.localeCompare(b.date)); },
      async put(p) { const db = await open(); if (!db) { mem = mem.filter(x => x.id !== p.id).concat(p); return; } await tx('readwrite', s => s.put(p)); },
      async del(id) { const db = await open(); if (!db) { mem = mem.filter(x => x.id !== id); return; } await tx('readwrite', s => s.delete(id)); },
      async delAll(bilanId) { for (const p of await this.all(bilanId)) await this.del(p.id); },
    };
  })();

  /* ---------------- appareil photo (avant / arrière) ---------------- */
  async function shrink(src, mirror) {
    let w, hh, draw;
    if (src instanceof Blob) {
      const url = URL.createObjectURL(src);
      const im = await new Promise((r, j) => { const i = new Image(); i.onload = () => r(i); i.onerror = j; i.src = url; });
      w = im.naturalWidth; hh = im.naturalHeight; draw = (g, W, H) => g.drawImage(im, 0, 0, W, H); setTimeout(() => URL.revokeObjectURL(url), 5000);
    } else { w = src.videoWidth; hh = src.videoHeight; draw = (g, W, H) => g.drawImage(src, 0, 0, W, H); }
    const k = Math.min(1, 1280 / Math.max(w, hh)), W = Math.round(w * k), H = Math.round(hh * k);
    const c = h('canvas', { width: W, height: H }), g = c.getContext('2d');
    if (mirror) { g.translate(W, 0); g.scale(-1, 1); }
    draw(g, W, H); return c.toDataURL('image/jpeg', 0.78);
  }
  function pickImages(capture) {
    return new Promise((res) => {
      const i = h('input', { type: 'file', accept: 'image/*', capture: capture || null, multiple: !capture, style: { display: 'none' } });
      i.onchange = async () => { const out = []; for (const f of i.files) { try { out.push({ data: await shrink(f), facing: capture || 'galerie' }); } catch (e) { toast('Image illisible : ' + f.name); } } i.remove(); res(out); };
      document.body.append(i); i.click();
    });
  }
  function openCamera(onCapture) {
    let stream = null, facing = 'environment', count = 0, busy = false;
    const video = h('video', { autoplay: true, playsinline: true, muted: true, class: 'cam-video' });
    const info = h('div', { class: 'cam-info' }, 'Démarrage de la caméra…'), shots = h('div', { class: 'cam-shots' });
    const stop = () => { if (stream) { stream.getTracks().forEach(t => t.stop()); stream = null; } };
    let appareil = '';
    async function start() {
      stop(); info.textContent = 'Démarrage de la caméra…';
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { info.textContent = 'Caméra indisponible ici (adresse https ou localhost requise). Utilisez « Photo native » ou « Galerie ».'; return; }
      try {
        stream = await ouvrirFlux(facing, appareil);
        const tr = stream.getVideoTracks()[0], rg = tr && tr.getSettings ? tr.getSettings() : {}; appareil = rg.deviceId || appareil;
        video.srcObject = stream; await video.play().catch(() => {});
        const st = stream.getVideoTracks()[0].getSettings ? stream.getVideoTracks()[0].getSettings() : {};
        if (st.facingMode) facing = st.facingMode === 'user' ? 'user' : 'environment';
        video.classList.toggle('mirror', facing === 'user');
        info.textContent = facing === 'user' ? 'Caméra avant (selfie)' : 'Caméra arrière';
      } catch (e) { info.textContent = e.name === 'NotAllowedError' ? 'Accès à la caméra refusé : autorisez-le dans les réglages du navigateur.' : e.name === 'NotFoundError' ? 'Aucune caméra détectée.' : 'Caméra inaccessible : ' + e.message; }
    }
    const close = () => { stop(); ov.remove(); };
    const snap = async () => {
      if (!stream || busy || !video.videoWidth) return toast("La caméra n'est pas prête.");
      busy = true;
      try { const d = await shrink(video, facing === 'user'); count++; shots.append(h('img', { src: d, alt: '' })); info.textContent = count + ' photo(s) · ' + (facing === 'user' ? 'caméra avant' : 'caméra arrière'); await onCapture(d, facing); } finally { busy = false; }
    };
    const ov = h('div', { class: 'cam-overlay' }, h('div', { class: 'cam-box' },
      h('div', { class: 'cam-head' }, h('b', null, '📷 Appareil photo — avant / arrière'), h('button', { class: 'btn btn-danger', onclick: close }, '✖ Terminer')),
      h('div', { class: 'cam-stage' }, video), info,
      h('div', { class: 'cam-bar' },
        h('button', { class: 'btn btn-info', onclick: async () => { facing = facing === 'user' ? 'environment' : 'user'; appareil = choisirCamera(await camerasVideo(), facing, appareil) || ''; start(); } }, '🔄 Avant ⇄ Arrière'),
        h('button', { class: 'btn btn-primary cam-snap', onclick: snap }, '📸 Prendre la photo'),
        h('button', { class: 'btn btn-warning', onclick: async () => { for (const p of await pickImages(facing)) { count++; await onCapture(p.data, p.facing); } } }, '📱 Photo native'),
        h('button', { class: 'btn', onclick: async () => { for (const p of await pickImages()) { count++; shots.append(h('img', { src: p.data, alt: '' })); await onCapture(p.data, 'galerie'); } } }, '🖼 Galerie')),
      shots));
    document.body.append(ov); start();
  }

  /* ================= BILANS ================= */
  const store = () => App().data.bilans;
  const keyOf = (b) => [b.niveau, b.periode, b.annee, b.niveau === 'ZONE' ? b.entete.numZone : ''].join('|');
  const mkUser = (numZone) => ({ departement: 'PLATEAU', nomCs: 'POBÈ', codeCs: 'POBE', numZone: numZone || '', prenoms: '', nom: '' });
  const find = (id) => store().find(b => b.id === id);
  const persist = () => App().saveData();

  function consolidateInto(b) {
    const all = store();
    if (b.periode === 'ANNUEL') {
      const t = all.filter(x => x.niveau === b.niveau && x.annee === b.annee && x.periode !== 'ANNUEL' && (b.niveau === 'CS' || x.entete.numZone === b.entete.numZone));
      S.consolidateAnnual(b, t); return t.length;
    }
    if (b.niveau === 'CS') { const z = all.filter(x => x.niveau === 'ZONE' && x.annee === b.annee && x.periode === b.periode); S.consolidateCS(b, z); return z.length; }
    return 0;
  }

  let vue = { mode: 'list', id: null, sel: null, tab: 'entete' };
  const root = () => document.getElementById('bilans');

  function renderBilans() {
    const r = root(); if (!r) return;
    r.replaceChildren();
    if (vue.mode === 'edit' && find(vue.id)) return editor(r, find(vue.id));
    vue.mode = 'list'; list(r);
  }

  function list(r) {
    const rows = store().slice().sort((a, b) => (b.annee + b.periode).localeCompare(a.annee + a.periode));
    const T = (b) => ({ ev: b.periode === 'T2' ? 'ev2' : b.periode === 'T3' ? 'ev3' : 'ev1' });
    const body = h('tbody', null, ...rows.map(b => h('tr', { class: b.id === vue.sel ? 'sel' : '', onclick: () => { vue.sel = b.id; renderBilans(); }, ondblclick: () => open(b.id) },
      h('td', null, b.niveau === 'CS' ? 'Circonscription' : 'Zone ' + (b.entete.numZone || '')), h('td', null, S.PERIODES_COURT[b.periode]), h('td', null, b.annee),
      h('td', null, S.fmtCell(S.cellValue(b, 't21', S.TOTAL, 'pct'), { pct: true })),
      h('td', null, S.fmtCell(S.cellValue(b, T(b).ev, S.TOTAL, 'pr_t'), { pct: true })),
      h('td', null, h('span', { class: 'badge ' + (b.statut === 'Finalisé' ? 'badge-success' : 'badge-warning') }, b.statut || 'Brouillon')),
      h('td', null, (b.updated || '').slice(0, 10)))));
    const s = () => { const b = find(vue.sel); if (!b) toast('Sélectionnez un bilan dans la liste.'); return b; };
    r.append(
      h('div', { class: 'page-title' }, '📊 Bilans des activités pédagogiques', h('button', { class: 'btn btn-primary', onclick: create }, '➕ Nouveau bilan')),
      h('p', { class: 'xnote' }, 'Bilans trimestriels (T1, T2, T3) et annuel — niveau zone pédagogique (CP) et niveau circonscription scolaire (CCS). Cliquez sur une ligne pour la sélectionner, double-clic pour l\'ouvrir.'),
      h('div', { class: 'xbar' },
        h('button', { class: 'btn btn-info', onclick: () => { const b = s(); b && open(b.id); } }, '📂 Ouvrir'),
        h('button', { class: 'btn btn-warning', onclick: () => loadFile(null) }, '⬆ Charger'),
        h('button', { class: 'btn btn-primary', onclick: () => { const b = s(); b && preview(b); } }, '⬇ PDF / Imprimer'),
        h('button', { class: 'btn btn-primary', onclick: () => { const b = s(); b && exportXls(b); } }, '⬇ Excel'),
        h('button', { class: 'btn btn-primary', onclick: () => { const b = s(); b && exportJson(b); } }, '⬇ JSON'),
        h('button', { class: 'btn btn-warning', onclick: () => { const b = s(); b && resetB(b); } }, '♻ Réinitialiser'),
        h('button', { class: 'btn btn-danger', onclick: () => { const b = s(); b && deleteB(b); } }, '🗑 Supprimer')),
      h('div', { class: 'table-container' }, h('div', { class: 'table-scroll' }, h('table', null,
        h('thead', null, h('tr', null, ...['Niveau', 'Période', 'Année', '% visites de classes', '% réussite évaluation', 'Statut', 'Modifié'].map(x => h('th', null, x)))),
        rows.length ? body : h('tbody', null, h('tr', null, h('td', { colspan: 7, class: 'text-center' }, 'Aucun bilan. Cliquez sur « Nouveau bilan » ou « Charger ».')))))));
  }
  function open(id) { vue = { mode: 'edit', id, sel: id, tab: vue.tab || 'entete' }; renderBilans(); }

  function create() {
    const f = h('form', { onsubmit: (ev) => {
      ev.preventDefault(); const v = Object.fromEntries(new FormData(ev.target));
      const b = S.newBilan({ niveau: v.niveau, periode: v.periode, annee: v.annee, user: mkUser(v.numZone), zones: Math.max(1, +v.zones || 6), zoneNum: v.numZone });
      if (store().some(x => keyOf(x) === keyOf(b))) return toast('Un bilan existe déjà pour ce niveau, cette période et cette année.');
      b.id = uid(); b.created = now(); b.updated = now(); const n = consolidateInto(b); store().push(b); persist();
      App().closeModal(); if (n) toast(n + ' bilan(s) consolidé(s) automatiquement.'); open(b.id);
    } },
      h('div', { class: 'form-grid' },
        h('div', { class: 'form-group' }, h('label', null, 'Niveau'), h('select', { name: 'niveau' }, h('option', { value: 'ZONE' }, 'Zone pédagogique (CP)'), h('option', { value: 'CS' }, 'Circonscription scolaire (CCS)'))),
        h('div', { class: 'form-group' }, h('label', null, 'Période'), h('select', { name: 'periode' }, ...Object.entries(S.PERIODES).map(([k, l]) => h('option', { value: k }, l)))),
        h('div', { class: 'form-group' }, h('label', null, 'Année scolaire'), h('input', { name: 'annee', required: true, value: App().anneeActive() })),
        h('div', { class: 'form-group' }, h('label', null, 'N° de la zone (niveau zone)'), h('input', { name: 'numZone', type: 'number', min: 1, value: 1 })),
        h('div', { class: 'form-group' }, h('label', null, 'Nombre de zones du CS (niveau CS)'), h('input', { name: 'zones', type: 'number', min: 1, value: 6 }))),
      h('div', { class: 'text-center mt-15' }, h('button', { class: 'btn btn-primary', type: 'submit' }, '✔ Créer'), ' ', h('button', { class: 'btn btn-danger', type: 'button', onclick: App().closeModal }, 'Annuler')));
    App().openModal('Nouveau bilan des activités pédagogiques', '<div id="xcreate"></div>'); document.getElementById('xcreate').append(f);
  }

  async function loadFile(target) {
    const f = await pickFile('.json,application/json'); if (!f) return;
    try {
      const o = JSON.parse(await readText(f)); if (o.format !== 'MEMP-BILAN' || !o.bilan) throw new Error("Ce fichier n'est pas un bilan de l'application (JSON « MEMP-BILAN » attendu).");
      const b = o.bilan, photos = o.photos || [];
      const dup = target || store().find(x => keyOf(x) === keyOf(b));
      if (dup && !confirm('Remplacer « ' + S.bilanLabel(dup) + ' » par le fichier chargé ?')) return;
      if (dup) { b.id = dup.id; store().splice(store().indexOf(dup), 1); } else if (!b.id || find(b.id)) b.id = uid();
      b.updated = now(); store().push(b); persist();
      await PhotoDB.delAll(b.id); for (const p of photos) await PhotoDB.put({ ...p, id: uid(), bilanId: b.id });
      toast('Bilan chargé : ' + S.bilanLabel(b) + (photos.length ? ' (+ ' + photos.length + ' photo(s))' : '') + '.'); vue.sel = b.id; renderBilans();
    } catch (e) { toast(e.message); }
  }
  async function exportJson(b) {
    const photos = await PhotoDB.all(b.id);
    saveFile(new Blob([JSON.stringify({ format: 'MEMP-BILAN', version: 1, republique: 'RÉPUBLIQUE DU BÉNIN', ministere: 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE', concepteur: CREDIT, date: now(), bilan: b, photos })], { type: 'application/json' }), clean(fileBase(b)) + '.bilan.json');
  }
  const fileBase = (b) => 'Bilan_' + (b.niveau === 'CS' ? 'CS' : 'Zone' + (b.entete.numZone || '')) + '_' + b.periode + '_' + b.annee;
  async function resetB(b) {
    if (!confirm("Réinitialiser ce bilan ? Toutes les valeurs saisies, listes et analyses seront effacées. L'en-tête et les photos sont conservés.")) return;
    const f = S.newBilan({ niveau: b.niveau, periode: b.periode, annee: b.annee, user: mkUser(b.entete.numZone), zoneNum: b.entete.numZone });
    b.data = {}; b.lists = f.lists; b.textes = f.textes; b.statut = 'Brouillon'; b.updated = now(); persist(); toast('Bilan réinitialisé.'); renderBilans();
  }
  async function deleteB(b) {
    if (!confirm('Supprimer définitivement « ' + S.bilanLabel(b) + ' » et ses photos ?')) return;
    store().splice(store().indexOf(b), 1); persist(); await PhotoDB.delAll(b.id); vue = { mode: 'list', id: null, sel: null, tab: vue.tab }; toast('Bilan supprimé.'); renderBilans();
  }

  /* ---------- éditeur ---------- */
  const TABS = [['entete', 'En-tête'], ['t1', '1. Réseau'], ['act', '2. Activités'], ['conc', '3. Concertations'], ['t4', '4. Couverture'], ['ev', '5. Évaluations'], ['ana', '6. Analyses'], ['prob', '7. Difficultés'], ['photos', '📷 Photos']];

  function editor(r, b) {
    let timer = null, dirty = false; const calcs = [];
    const state = h('span', { class: 'xnote' }, 'Enregistré'), warn = h('div'), tabsEl = h('div', { class: 'tabs' }), body = h('div');
    const save = () => { clearTimeout(timer); if (!dirty) return; dirty = false; b.updated = now(); persist(); state.textContent = 'Enregistré à ' + new Date().toLocaleTimeString('fr-FR'); };
    const touch = () => { dirty = true; state.textContent = 'Modification…'; refresh(); clearTimeout(timer); timer = setTimeout(save, 700); };
    function refresh() {
      for (const c of calcs) if (c.el.isConnected) c.el.textContent = S.fmtCell(S.cellValue(b, c.tid, c.row, c.col), c.spec);
      const w = S.checks(b); warn.replaceChildren(...(w.length ? [h('div', { class: 'alert alert-warning' }, h('b', null, '⚠ Contrôles de cohérence : '), h('ul', null, ...w.slice(0, 8).map(x => h('li', null, x))))] : []));
    }
    function grid(tid) {
      const spec = S.TABLES[tid], L = S.layoutHead(spec.head), trs = Array.from({ length: L.headRows }, () => h('tr'));
      L.cells.forEach(c => trs[c.r].append(h('th', { colspan: c.s, rowspan: c.rs }, c.t)));
      const tb = h('tbody');
      const mk = (row, label, total) => {
        const tr = h('tr', { class: total ? 'tot' : '' }, h('td', { class: 'lab' }, label));
        for (const col of spec.cols) {
          if (col.f || total) { const el = h('td', { class: 'calc' }, S.fmtCell(S.cellValue(b, tid, row, col.k), col)); calcs.push({ el, tid, row, col: col.k, spec: col }); tr.append(el); }
          else { const key = tid + '.' + row + '.' + col.k; tr.append(h('td', null, h('input', { type: 'number', min: 0, inputmode: 'numeric', value: b.data[key] ?? '', 'aria-label': label, oninput: (e) => { b.data[key] = e.target.value; touch(); } }))); }
        }
        return tr;
      };
      S.rowsOf(b, spec).forEach(x => tb.append(mk(x.k, x.l, false)));
      if (S.showTotal(b, spec)) tb.append(mk(S.TOTAL, S.totalLabel(b), true));
      return h('div', { class: 'xcard' }, h('h3', null, spec.title), h('div', { class: 'gridwrap' }, h('table', { class: 'g' }, h('thead', null, ...trs), tb)), ...(spec.notes || []).map(n => h('p', { class: 'xnote' }, n)));
    }
    function listEd(name, cols, newRow, title, hint) {
      const tb = h('tbody');
      const draw = () => tb.replaceChildren(...b.lists[name].map((row, i) => h('tr', null, h('td', null, String(i + 1)),
        ...cols.map(c => h('td', null, h(c.area ? 'textarea' : 'input', { type: c.num ? 'number' : 'text', rows: 2, value: row[c.k] ?? '', style: { textAlign: 'left', minWidth: c.w || '110px' }, 'aria-label': c.l, oninput: (e) => { row[c.k] = e.target.value; touch(); } }))),
        h('td', null, h('button', { class: 'btn btn-danger btn-sm', title: 'Retirer', onclick: () => { b.lists[name].splice(i, 1); touch(); draw(); } }, '✕')))));
      draw();
      return h('div', { class: 'xcard' }, h('h3', null, title), hint ? h('p', { class: 'xnote' }, hint) : null,
        h('div', { class: 'gridwrap' }, h('table', { class: 'g' }, h('thead', null, h('tr', null, h('th', null, 'N°'), ...cols.map(c => h('th', null, c.l)), h('th', null, ''))), tb)),
        h('p', null, h('button', { class: 'btn btn-info btn-sm', onclick: () => { b.lists[name].push(newRow()); touch(); draw(); } }, '➕ Ajouter une ligne'), ' ',
          name === 'problemes' ? h('button', { class: 'btn btn-warning btn-sm', onclick: () => { b.lists.problemes.sort((x, y) => (+y.ampleur || 0) - (+x.ampleur || 0)); touch(); draw(); } }, '🔢 Trier par ampleur') : null));
    }
    const area = (k, l, rows) => h('div', { class: 'form-group xwide' }, h('label', null, l), h('textarea', { rows: rows || 4, oninput: (e) => { b.textes[k] = e.target.value; touch(); } }, b.textes[k] || ''));
    const ef = (k, l, type) => h('div', { class: 'form-group' }, h('label', null, l), h('input', { type: type || 'text', value: b.entete[k] ?? '', oninput: (e) => { b.entete[k] = e.target.value; touch(); } }));

    function photosView() {
      const wrap = h('div', { class: 'photo-grid' });
      const draw = async () => {
        const ps = await PhotoDB.all(b.id);
        wrap.replaceChildren(...(ps.length ? ps.map(p => h('figure', { class: 'photo' }, h('img', { src: p.data, alt: p.legende || 'Photo' }),
          h('input', { type: 'text', placeholder: 'Légende (activité, lieu, date…)', value: p.legende || '', oninput: async (e) => { p.legende = e.target.value; await PhotoDB.put(p); } }),
          h('figcaption', null, new Date(p.date).toLocaleString('fr-FR') + ' · ' + (p.facing === 'user' ? 'caméra avant' : p.facing === 'environment' ? 'caméra arrière' : 'galerie')),
          h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (confirm('Supprimer cette photo ?')) { await PhotoDB.del(p.id); draw(); } } }, '🗑 Supprimer'))) : [h('div', { class: 'xnote' }, "Aucune photo. Utilisez l'appareil photo (caméra avant ou arrière) pour joindre des preuves : elles seront ajoutées en annexe du PDF.")]));
      };
      draw();
      const add = async (data, facing) => { await PhotoDB.put({ id: uid(), bilanId: b.id, data, facing, legende: '', date: now() }); if (vue.tab === 'photos') draw(); };
      return h('div', { class: 'xcard' }, h('h3', null, 'Preuves photographiques'),
        h('p', null, h('button', { class: 'btn btn-primary', onclick: () => openCamera(add) }, "📷 Ouvrir l'appareil photo"), ' ',
          h('button', { class: 'btn btn-info', onclick: async () => { for (const p of await pickImages()) await add(p.data, p.facing); } }, '🖼 Ajouter depuis la galerie')), wrap);
    }

    function show() {
      calcs.length = 0;
      tabsEl.replaceChildren(...TABS.map(([k, l]) => h('div', { class: 'tab' + (k === vue.tab ? ' active' : ''), onclick: () => { vue.tab = k; show(); } }, l)));
      const eva = b.periode === 'ANNUEL' ? ['ev1', 'ev2', 'ev3'] : ['ev' + b.periode.slice(1)];
      const views = {
        entete: () => [h('div', { class: 'xcard' }, h('h3', null, 'En-tête du bilan'), h('div', { class: 'form-grid' },
          ef('departement', 'Direction départementale (département)'), ef('nomCs', 'Circonscription scolaire'), b.niveau === 'ZONE' ? ef('numZone', 'Zone pédagogique n°') : null,
          ef('dateVisite', 'Période / dates des activités'), ef('lieu', 'Fait à'), ef('dateBilan', 'Date du bilan', 'date'), ef('auteur', "Nom et prénoms de l'auteur"), ef('titreAuteur', "Qualité de l'auteur"))),
          h('div', { class: 'xcard' }, h('h3', null, 'Aide'), h('p', null, 'Les cellules grisées se calculent seules. Les tableaux comportent une ligne par acteur (' + b.actors.map(a => a.l).join(', ') + ') et un total.'),
            h('p', null, b.periode === 'ANNUEL' ? 'Bilan annuel : « Σ Consolider » cumule les trois trimestres présents sur cet appareil.' : b.niveau === 'CS' ? 'Bilan CS : chargez les bilans de zone reçus des CP (fichiers JSON) avec « Charger », puis « Σ Consolider ».' : "Le CP exporte son bilan en JSON et l'envoie au CCS, qui le charge dans son application."))],
        t1: () => [grid('t1')], act: () => ['t21', 't22', 't23', 't24', 't25'].map(grid),
        conc: () => [grid('t31'), listEd('autres', [{ k: 'lieu', l: 'Lieu' }, { k: 'periode', l: 'Période' }, { k: 'designation', l: "Désignation de l'activité", area: true, w: '240px' }, { k: 'participants', l: 'Participants' }], () => ({ lieu: '', periode: '', designation: '', participants: '' }), '3.2 Autres activités menées', 'Réunions, ateliers, journées pédagogiques, accompagnements spécifiques, etc.')],
        t4: () => [grid('t4')], ev: () => eva.map(grid),
        ana: () => [h('div', { class: 'xcard' }, h('h3', null, '6. Analyses'),
          h('p', null, h('button', { class: 'btn btn-info', onclick: () => {
            const d = S.draftAnalysis(b), keys = Object.keys(d).filter(k => d[k]); if (!keys.length) return toast("Renseignez d'abord les résultats de l'évaluation et les activités.");
            const filled = keys.filter(k => (b.textes[k] || '').trim()); if (filled.length && !confirm('Certaines analyses sont déjà rédigées. Les écraser par le brouillon automatique ?')) keys.forEach(k => { if (filled.includes(k)) delete d[k]; });
            Object.assign(b.textes, d); touch(); show();
          } }, "✨ Générer un brouillon d'analyse (à relire)")),
          h('div', { class: 'form-grid xone' }, area('quant', '6.1 Analyse quantitative'), area('qual', '6.2 Analyse qualitative'), area('genre', '6.3 Performances selon le genre', 3), area('champs', '6.4 Performances selon les disciplines (Français, Mathématiques…)', 3), area('up', '6.5 Apport des unités pédagogiques (UP)', 3), area('conclusion', '6.6 Conclusion', 3)))],
        prob: () => [listEd('problemes', [{ k: 'designation', l: 'Désignation du problème', area: true, w: '230px' }, { k: 'ampleur', l: 'Ampleur (%)', num: true, w: '70px' }, { k: 'obs', l: 'Observations / solutions envisagées', area: true, w: '260px' }], () => ({ designation: '', ampleur: '', obs: '' }), '7. Difficultés majeures rencontrées', "Classez-les par ordre d'importance (ampleur en % des écoles/classes concernées)."),
          h('div', { class: 'xcard' }, h('h3', null, 'Commentaires et perspectives'), h('div', { class: 'form-grid xone' }, area('commentaires', 'Commentaires'), area('perspectives', 'Perspectives et recommandations')))],
        photos: () => [photosView()],
      };
      body.replaceChildren(...views[vue.tab]()); refresh();
    }

    const bar = h('div', { class: 'xbar' },
      h('button', { class: 'btn btn-warning', onclick: () => { save(); loadFile(b); } }, '⬆ Charger'),
      h('button', { class: 'btn btn-primary', onclick: () => { save(); preview(b); } }, '⬇ PDF / Imprimer'),
      h('button', { class: 'btn btn-primary', onclick: () => { save(); exportXls(b); } }, '⬇ Excel'),
      h('button', { class: 'btn btn-primary', onclick: () => { save(); exportJson(b); } }, '⬇ JSON'),
      h('button', { class: 'btn btn-info', onclick: () => { vue.tab = 'photos'; show(); openCamera(async (d, f) => { await PhotoDB.put({ id: uid(), bilanId: b.id, data: d, facing: f, legende: '', date: now() }); if (vue.tab === 'photos') show(); }); } }, '📷 Appareil photo'),
      b.periode !== 'ANNUEL' && b.niveau === 'ZONE' ? h('button', { class: 'btn', onclick: () => { const nz = String(b.entete.numZone || '').replace(/\D/g, ''); const sc = App().data.ecoles.filter(x => !nz || String(x.zone_ped || '').replace(/\D/g, '') === nz); const a = b.actors[0].k; b.data['t1.' + a + '.em_e'] = String(sc.filter(x => /^EM/.test(x.type || '')).length); b.data['t1.' + a + '.ep_e'] = String(sc.filter(x => !/^EM/.test(x.type || '')).length); touch(); show(); toast(sc.length + ' école(s) reprise(s) de la liste. Complétez les classes et effectifs.'); } }, '✨ Pré-remplir') : null,
      b.periode === 'ANNUEL' || b.niveau === 'CS' ? h('button', { class: 'btn btn-info', onclick: () => { if (!confirm('Recalculer ce bilan à partir des ' + (b.periode === 'ANNUEL' ? 'trois trimestres' : 'bilans de zone') + ' disponibles ? Les valeurs concernées seront remplacées.')) return; const n = consolidateInto(b); if (!n) return toast('Aucun bilan source trouvé sur cet appareil.'); dirty = true; save(); toast(n + ' bilan(s) consolidé(s).'); renderBilans(); } }, 'Σ Consolider') : null,
      h('button', { class: 'btn btn-primary', onclick: () => { b.statut = b.statut === 'Finalisé' ? 'Brouillon' : 'Finalisé'; dirty = true; save(); renderBilans(); } }, b.statut === 'Finalisé' ? '🔓 Rouvrir' : '✅ Finaliser'),
      h('button', { class: 'btn btn-warning', onclick: () => { save(); resetB(b); } }, '♻ Réinitialiser'),
      h('button', { class: 'btn btn-danger', onclick: () => deleteB(b) }, '🗑 Supprimer'),
      h('button', { class: 'btn', onclick: () => { save(); vue.mode = 'list'; renderBilans(); } }, '← Liste'));
    r.append(h('div', { class: 'page-title' }, '📊 ' + S.bilanLabel(b), h('span', null, h('span', { class: 'badge ' + (b.statut === 'Finalisé' ? 'badge-success' : 'badge-warning') }, b.statut || 'Brouillon'), ' ', state)),
      h('p', { class: 'xnote' }, b.niveau === 'CS' ? 'Circonscription scolaire de ' + (b.entete.nomCs || '') : 'Zone pédagogique n° ' + (b.entete.numZone || '') + ' — CS ' + (b.entete.nomCs || '')), bar, warn, tabsEl, body);
    show();
  }

  /* ---------- impression / PDF et Excel ---------- */
  const dfr = (d) => d ? new Date(d + 'T12:00').toLocaleDateString('fr-FR') : '…… / …… / ……';
  const titreDoc = (b) => 'BILAN ' + (b.periode === 'ANNUEL' ? 'ANNUEL' : 'TRIMESTRIEL') + ' DES ACTIVITÉS PÉDAGOGIQUES — NIVEAU ' + (b.niveau === 'CS' ? 'CIRCONSCRIPTION SCOLAIRE' : 'ZONE PÉDAGOGIQUE');
  const SECT = { t1: '1. DONNÉES STATISTIQUES SUR LE RÉSEAU D\'ANIMATION PÉDAGOGIQUE', t21: '2. ACTIVITÉS MENÉES', t31: '3. CONCERTATIONS ET AUTRES ACTIVITÉS', t4: '4. RÉSULTATS / IMPACT — TAUX DE COUVERTURE', ev1: "5. RÉSULTATS DES ÉVALUATIONS D'ÉTAPE" };
  const toShow = (b) => ['t1', 't21', 't22', 't23', 't24', 't25', 't31', 't4', 'ev1', 'ev2', 'ev3'].filter(id => !id.startsWith('ev') || b.periode === 'ANNUEL' || id === 'ev' + b.periode.slice(1));

  function tableHtml(b, tid) {
    const spec = S.TABLES[tid], L = S.layoutHead(spec.head), trs = Array.from({ length: L.headRows }, () => '');
    L.cells.forEach(c => { trs[c.r] += '<th colspan="' + c.s + '" rowspan="' + c.rs + '">' + esc(c.t) + '</th>'; });
    const line = (row, lab, tot) => '<tr' + (tot ? ' class="tot"' : '') + '><td class="lab">' + esc(lab) + '</td>' + spec.cols.map(c => '<td' + (c.f ? ' class="calc"' : '') + '>' + esc(S.fmtCell(S.cellValue(b, tid, row, c.k), c)) + '</td>').join('') + '</tr>';
    let rows = S.rowsOf(b, spec).map(x => line(x.k, x.l, false)).join(''); if (S.showTotal(b, spec)) rows += line(S.TOTAL, S.totalLabel(b), true);
    return '<p class="bt">' + esc(spec.title) + '</p><table class="bilan-t"><thead>' + trs.map(t => '<tr>' + t + '</tr>').join('') + '</thead><tbody>' + rows + '</tbody></table>' + (spec.notes || []).map(n => '<p class="bn">' + esc(n) + '</p>').join('');
  }
  async function bilanHtml(b, photos) {
    const e = b.entete, ban = global.Embleme && global.Embleme.BANDEAU;
    let out = '<div class="bilan-doc">' + (ban ? '<img class="bilan-ban" src="' + ban + '" alt="Ministère des Enseignements Maternel et Primaire">' : '')
      + '<p class="bc"><b>DIRECTION DÉPARTEMENTALE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE ' + esc((e.departement || '').toUpperCase()) + '</b><br>CIRCONSCRIPTION SCOLAIRE DE ' + esc((e.nomCs || '……').toUpperCase()) + (b.niveau === 'ZONE' ? ' · ZONE PÉDAGOGIQUE N° ' + esc(e.numZone || '……') : '') + '</p>'
      + '<h2 class="bh">' + esc(titreDoc(b)) + '<br><small>' + esc(S.PERIODES[b.periode].toUpperCase()) + ' · ANNÉE SCOLAIRE : ' + esc(b.annee) + '</small></h2>'
      + '<p class="bc">Période des visites : ' + esc(e.dateVisite || '………') + ' · Fait à ' + esc(e.lieu || '……………') + ', le ' + esc(dfr(e.dateBilan)) + '</p>';
    for (const tid of toShow(b)) {
      if (SECT[tid]) out += '<h3 class="bs">' + esc(SECT[tid]) + '</h3>';
      out += tableHtml(b, tid);
      if (tid === 't31') {
        const L = (b.lists.autres || []).filter(x => x.designation || x.lieu);
        out += '<p class="bt">3.2 Autres activités menées dans la période</p><table class="bilan-t"><thead><tr><th>N°</th><th>Lieu</th><th>Période</th><th>Désignation de l\'activité</th><th>Participants</th></tr></thead><tbody>'
          + (L.length ? L : [{}]).map((x, i) => '<tr><td>' + (i + 1) + '</td><td>' + esc(x.lieu || '') + '</td><td>' + esc(x.periode || '') + '</td><td class="lab">' + esc(x.designation || '') + '</td><td>' + esc(x.participants || '') + '</td></tr>').join('') + '</tbody></table>';
      }
    }
    out += '<h3 class="bs">6. ANALYSES</h3>';
    for (const [k, l] of [['quant', '6.1 Analyse quantitative'], ['qual', '6.2 Analyse qualitative'], ['genre', '6.3 Performances selon le genre'], ['champs', '6.4 Performances selon les disciplines'], ['up', '6.5 Apport des unités pédagogiques'], ['conclusion', '6.6 Conclusion']])
      if ((b.textes[k] || '').trim()) out += '<p class="bt">' + l + '</p><p class="bp">' + esc(b.textes[k]).replace(/\n/g, '<br>') + '</p>';
    const P = (b.lists.problemes || []).filter(x => x.designation);
    out += '<h3 class="bs">7. DIFFICULTÉS MAJEURES, COMMENTAIRES ET PERSPECTIVES</h3><table class="bilan-t"><thead><tr><th>Ordre</th><th>Désignation du problème</th><th>Ampleur (%)</th><th>Observations / solutions</th></tr></thead><tbody>'
      + (P.length ? P : [{}]).map((x, i) => '<tr><td>' + (i + 1) + '</td><td class="lab">' + esc(x.designation || '') + '</td><td>' + esc(x.ampleur || '') + '</td><td class="lab">' + esc(x.obs || '') + '</td></tr>').join('') + '</tbody></table>';
    for (const [k, l] of [['commentaires', 'Commentaires'], ['perspectives', 'Perspectives et recommandations']]) if ((b.textes[k] || '').trim()) out += '<p class="bt">' + l + '</p><p class="bp">' + esc(b.textes[k]).replace(/\n/g, '<br>') + '</p>';
    out += '<p class="bc" style="text-align:right">Fait à ' + esc(e.lieu || '……………') + ', le ' + esc(dfr(e.dateBilan)) + '</p><table class="bilan-t bsign"><tr><th>' + esc(e.titreAuteur || 'Le Conseiller Pédagogique') + '</th><th>' + (b.niveau === 'CS' ? 'Le Directeur Départemental (visa)' : 'Le Chef de la Circonscription Scolaire (visa)') + '</th></tr><tr><td><br><br><br>' + esc(e.auteur || '') + '</td><td><br><br><br></td></tr></table>';
    if (photos && photos.length) out += '<div class="bilan-annexe"><h3 class="bs">ANNEXE — PREUVES PHOTOGRAPHIQUES</h3><div class="bphotos">' + photos.map((p, i) => '<figure><img src="' + p.data + '" alt=""><figcaption>Photo ' + (i + 1) + ' · ' + esc(p.legende || '') + ' · ' + new Date(p.date).toLocaleDateString('fr-FR') + '</figcaption></figure>').join('') + '</div></div>';
    return out + '<p class="bcred">' + esc(CREDIT) + '</p></div>';
  }
  async function preview(b) {
    const photos = await PhotoDB.all(b.id), html = await bilanHtml(b, photos);
    document.body.classList.add('bilan-print'); if (!document.getElementById('xpage')) document.head.append(h('style', { id: 'xpage' }, '@page { size: A4 landscape; margin: 8mm; }'));
    App().openModal(S.bilanLabel(b), '<div class="text-center xbar"><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button></div>' + html);
    toast('Astuce : dans la boîte d\'impression, choisissez « Enregistrer au format PDF » (paysage).');
  }
  async function exportXls(b) {
    const html = await bilanHtml(b, []);
    const css = 'table{border-collapse:collapse}td,th{border:1px solid #888;padding:3px;text-align:center;font:11px Arial}th{background:#e8f2ec}.lab{text-align:left;font-weight:bold}.tot td{background:#fff3c4;font-weight:bold}.calc{background:#f3f3f3}.bilan-ban{width:900px}h2,h3{font:bold 13px Arial}';
    saveFile(new Blob(['﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + html + '</body></html>'], { type: 'application/vnd.ms-excel' }), clean(fileBase(b)) + '.xls');
  }

  /* ================= DOCUMENTS DE RÉFÉRENCE ================= */
  let dtab = 'pdf', themeCat = 'up_primaire', plCls = '', plQ = '';
  const THEME_LISTS = { up_maternelle: 'UP — Maternelle', up_primaire: 'UP — Primaire', conferences: 'Conférences pédagogiques', formations: 'Formations groupées' };
  const doneSet = () => App().data.themesDone;
  const dfmt = (d) => d === 'PM' ? 'À programmer' : (d && d.length === 10 ? new Date(d + 'T12:00').toLocaleDateString('fr-FR') : (d || ''));

  /* v2.0 : appelé aussi par « Documents officiels » (js/officiel.js) pour un onglet, dans son propre conteneur. */
  let cibleDocs = null;
  function renderDocs(onglet, cible) {
    if (onglet) { dtab = onglet; cibleDocs = cible || null; }
    const r = cibleDocs || document.getElementById('docsref'); if (!r) return; r.replaceChildren();
    const TABSD = [['pdf', '📄 Fiches PDF'], ['themes', '🧭 Thèmes 2026-2027'], ['planif', '📚 Planification CI → CM2'], ['reg', '📕 Règlement intérieur']];
    if (!cibleDocs) r.append(h('div', { class: 'page-title' }, '📚 Documents de référence'),
      h('div', { class: 'tabs' }, ...TABSD.map(([k, l]) => h('div', { class: 'tab' + (k === dtab ? ' active' : ''), onclick: () => { dtab = k; renderDocs(); } }, l))));
    const c = h('div'); r.append(c);
    if (dtab === 'pdf') {
      c.append(...(REF.documents || []).map(d => h('div', { class: 'xcard' }, h('h3', null, '📄 ' + d.titre), h('p', null, d.description), h('p', { class: 'xnote' }, d.cycle + ' · ' + d.pages + ' pages · PDF'),
        h('a', { class: 'btn btn-primary', href: d.fichier, target: '_blank', rel: 'noopener' }, '👁 Ouvrir'), ' ', h('a', { class: 'btn btn-info', href: d.fichier, download: d.fichier.split('/').pop() }, '⬇ Télécharger'))),
        h('p', { class: 'xnote' }, 'Pour ajouter un document : déposez le PDF dans le dossier « docs » puis ajoutez une ligne dans data/ref.js.'));
    } else if (dtab === 'themes') {
      const T = REF.themes; if (!T) return;
      c.append(h('p', { class: 'xnote' }, T.nb), h('div', { class: 'tabs' }, ...Object.entries(THEME_LISTS).map(([k, l]) => h('div', { class: 'tab' + (k === themeCat ? ' active' : ''), onclick: () => { themeCat = k; renderDocs(); } }, l))));
      const today = new Date().toISOString().slice(0, 10);
      c.append(h('div', { class: 'table-container' }, h('div', { class: 'table-scroll' }, h('table', null,
        h('thead', null, h('tr', null, ...['N°', 'Thème', 'Date', 'Observations', 'Réalisé'].map(x => h('th', null, x)))),
        h('tbody', null, ...T[themeCat].map(t => { const key = themeCat + '-' + t.n, ok = doneSet().some(x => x.id === key), late = t.date !== 'PM' && t.date < today && !ok;
          return h('tr', null, h('td', null, t.n), h('td', null, h('b', null, t.theme), t.axes && t.axes.length ? h('ul', { class: 'axes' }, ...t.axes.map(a => h('li', null, a))) : null),
            h('td', null, dfmt(t.date), late ? h('div', null, h('span', { class: 'badge badge-danger' }, 'En retard')) : null), h('td', null, t.obs || ''),
            h('td', null, h('input', { type: 'checkbox', checked: ok, onchange: (ev) => { const l = doneSet(); if (ev.target.checked) l.push({ id: key, date: now() }); else l.splice(l.findIndex(x => x.id === key), 1); persist(); renderDocs(); } })));
        })))), h('div', { class: 'text-center mt-15' }, h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ Imprimer'))));
    } else if (dtab === 'planif') {
      const pages = REF.planification || [];
      const res = h('div'); const draw = () => {
        let a = pages.filter(p => !plCls || p.c === plCls); if (plQ) { const ws = plQ.split(' ').filter(Boolean); a = a.filter(p => { const n = norm(p.x); return ws.every(w => n.includes(w)); }); }
        res.replaceChildren(h('p', { class: 'xnote' }, a.length + ' page(s) trouvée(s)' + (a.length > 60 ? ' — affichage des 60 premières' : '')), ...a.slice(0, 60).map(p => {
          const n = norm(p.x), w = plQ.split(' ').filter(Boolean)[0], i = w ? Math.max(0, n.indexOf(w)) : 0;
          return h('div', { class: 'xres', onclick: () => App().openModal(p.c + ' — page ' + p.p, '<p class="xnote">Texte extrait du document officiel ; la mise en tableau d\'origine est aplatie.</p><pre class="xpre">' + esc(p.x) + '</pre>') }, h('b', null, p.c + ' · page ' + p.p), ' — ' + (p.t || ''), h('br'), h('small', null, p.x.replace(/\n/g, ' ').slice(Math.max(0, i - 60), Math.max(0, i - 60) + 220) + '…'));
        }));
      };
      c.append(h('p', { class: 'xnote' }, "Projet de planification des objets d'apprentissage à l'école primaire — document intégré, consultable hors ligne."),
        h('input', { type: 'search', class: 'xsearch', placeholder: 'Rechercher un mot, une discipline, une semaine… (ex. : dictée, semaine 12, fractions)', value: plQ, oninput: (e) => { plQ = norm(e.target.value); draw(); } }),
        h('div', { class: 'tabs' }, ...[['', 'Toutes'], ...S.COURS.map(x => [x, x])].map(([k, l]) => h('div', { class: 'tab' + (k === plCls ? ' active' : ''), onclick: () => { plCls = k; renderDocs(); } }, l))), res);
      draw();
    } else {
      const N = 8; let i = 1; const img = h('img', { class: 'xreg', alt: '' }), lab = h('b');
      const go = (k) => { i = Math.min(N, Math.max(1, k)); img.src = 'data/reglement/page-' + i + '.jpg'; img.alt = 'Règlement intérieur, page ' + i; lab.textContent = 'Page ' + i + ' / ' + N; };
      c.append(h('p', { class: 'xnote' }, 'Règlement intérieur des écoles primaires (révisé) — document officiel numérisé.'),
        h('div', { class: 'xbar' }, h('button', { class: 'btn', onclick: () => go(i - 1) }, '◀'), lab, h('button', { class: 'btn', onclick: () => go(i + 1) }, '▶'), h('a', { class: 'btn btn-info', href: 'data/reglement/page-1.jpg', target: '_blank', rel: 'noopener', onclick: (e) => { e.currentTarget.href = img.src; } }, '🔍 Agrandir'), h('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ Imprimer')), img);
      go(1);
    }
  }

  /* ---------------- branchement ---------------- */
  const oc = global.closeModal; global.closeModal = function () { document.body.classList.remove('bilan-print'); const xp = document.getElementById('xpage'); if (xp) xp.remove(); return oc && oc.apply(this, arguments); };
  global.Extra = { pages: { bilans: renderBilans, docsref: renderDocs }, renderDocs, openCamera };
})(window);
