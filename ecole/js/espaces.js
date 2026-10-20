/* République du Bénin — MEMP — CS Pobè
   Espaces des divisions de la Circonscription Scolaire (Chef de la CS, Secrétariat, C/DOSP, CP de chaque zone) :
   titulaire, documents officiels, documents propres à la division (stockés sur l'appareil), notes et raccourcis.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const CLE_META = 'pobe-espaces-meta';

  /* Documents officiels de référence (les mêmes que dans l'application memp-cp). */
  const DOCS = [
    { id: 'recens-em', titre: 'Fiche de recensement annuel — Écoles maternelles (inclusives) 2025-2026', fichier: 'docs/Fiche_recensement_maternelle_inclusive_2025-2026.pdf', cat: 'Recensement', pour: ['ccs', 'secretariat', 'cdosp', 'cp'] },
    { id: 'recens-ep', titre: 'Fiche de recensement annuel — Écoles primaires 2025-2026 (avec guide de remplissage)', fichier: 'docs/Fiche_recensement_annuel_primaire_2025-2026_Guide.pdf', cat: 'Recensement', pour: ['ccs', 'secretariat', 'cdosp', 'cp'] },
    { id: 'rentree-em', titre: 'Fiche de rapport de rentrée — Écoles maternelles', fichier: 'docs/Fiche_rapport_rentree_EM.pdf', cat: 'Rapports', pour: ['ccs', 'secretariat', 'cp'] },
    { id: 'rentree-em-suite', titre: 'Fiche de rapport de rentrée — Écoles maternelles (suite et fin : état nominatif du personnel)', fichier: 'docs/Fiche_rapport_rentree_EM_suite_fin.pdf', cat: 'Rapports', pour: ['ccs', 'secretariat', 'cp'] },
    { id: 'fin-ep', titre: "Rapport de fin d'année — Écoles primaires", fichier: 'docs/Rapport_fin_annee_EP.pdf', cat: 'Rapports', pour: ['ccs', 'secretariat', 'cdosp', 'cp'] },
    { id: 'fin-em', titre: "Rapport de fin d'année — Écoles maternelles", fichier: 'docs/Rapport_fin_annee_EM.pdf', cat: 'Rapports', pour: ['ccs', 'secretariat', 'cdosp', 'cp'] },
    { id: 'bilan-t1', titre: 'Bilan trimestriel des activités pédagogiques — modèle renseigné (CS Pobè, 1er trimestre 2025-2026)', fichier: 'docs/Bilan_trimestriel_CS_Pobe_T1_2025-2026.pdf', cat: 'Bilans', pour: ['ccs', 'cdosp', 'cp'] },
    { id: 'themes', titre: "Planning d'exécution des thèmes d'unité pédagogique, de conférence pédagogique et de formation groupée 2026-2027", fichier: 'docs/Themes_UP_CP_FG_2026-2027.pdf', cat: 'Pédagogie', pour: ['ccs', 'cdosp', 'cp'] },
    { id: 'reglement', titre: 'Règlement intérieur des écoles primaires (révisé, 2018)', page: 'docsref', cat: 'Textes', pour: ['ccs', 'secretariat', 'cdosp', 'cp'] },
  ];
  const CATEGORIES = ['Courrier reçu', 'Courrier envoyé', 'Rapport', 'Note de service', 'Compte rendu', 'Autre'];

  function divisions() {
    const base = [
      { id: 'ccs', icone: '🏛️', titre: 'Chef de la Circonscription Scolaire (C/CS)', role: 'Direction et pilotage de la circonscription : validation des bilans, supervision des divisions, relations avec la DDEMP et les partenaires.',
        pages: [['synoptique', 'Tableau synoptique'], ['effectifsZone', 'Effectifs par âge'], ['infraZone', 'Infrastructures et mobilier'], ['ecolesZone', 'Écoles : structure et équipements'], ['bilans', 'Bilans'], ['analyses', 'Analyses et écarts'], ['courriers', 'Courriers'], ['identite', 'Cachets et signatures']] },
      { id: 'secretariat', icone: '🗄️', titre: 'Secrétariat', role: "Réception et enregistrement du courrier, archives, tenue des dossiers du personnel et des écoles, préparation des documents à signer.",
        pages: [['courriers', 'Archive courriers'], ['ecoles', 'Écoles'], ['administratif', 'Personnel administratif'], ['fiches', 'Fiches officielles'], ['certificats', 'Certificats'], ['identite', 'Cachets et signatures']] },
      { id: 'cdosp', icone: '🧭', titre: 'Division C/DOSP', role: "Organisation et suivi pédagogique : planification des activités, visites, évaluations, examens blancs et suivi des résultats.",
        pages: [['visites', 'Visites et inspections'], ['evaluations', 'Évaluations'], ['examen', 'Examen blanc'], ['bilans', 'Bilans'], ['synoptique', 'Tableau synoptique'], ['docsref', 'Documents de référence']] },
    ];
    const zones = [...new Set([...global.Donnees.ZONES, ...App().data.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    zones.forEach(z => base.push({ id: 'cp-' + norm(z).replace(/ /g, ''), cp: true, zone: z, icone: '👥', titre: 'Conseiller pédagogique — ' + z, role: `Animation pédagogique de la ${z} : visites de classe, suivi des unités pédagogiques, effectifs et bilans de la zone.`,
      pages: [['effectifsZone', 'Effectifs de la zone'], ['infraZone', 'Infrastructures et mobilier'], ['ecolesZone', 'Écoles : structure et équipements'], ['visites', 'Visites'], ['bilans', 'Bilans'], ['synoptique', 'Synoptique'], ['rapports', 'Rapports de rentrée'], ['fiches', 'Fiches officielles']] }));
    return base;
  }
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const typeDe = (d) => (d.cp ? 'cp' : d.id);

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  function toast(msg, kind) {
    const t = h('div', { class: 'xtoast ' + (kind || '') }, msg); document.body.append(t);
    setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 3800);
  }
  const taille = (n) => (n > 1048576 ? (n / 1048576).toFixed(1) + ' Mo' : Math.max(1, Math.round(n / 1024)) + ' Ko');

  /* ---------------- Stockage ---------------- */
  const meta = () => { try { return JSON.parse(localStorage.getItem(CLE_META)) || {}; } catch (e) { return {}; } };
  const saveMeta = (m) => { try { localStorage.setItem(CLE_META, JSON.stringify(m)); } catch (e) { toast('Mémoire du navigateur pleine : notes non enregistrées.', 'err'); } };
  const idb = () => new Promise((res, rej) => { const r = indexedDB.open('pobe-espaces', 1); r.onupgradeneeded = () => r.result.createObjectStore('fichiers', { keyPath: 'id' }); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  async function tx(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('fichiers', mode), s = t.objectStore('fichiers'), q = fn(s); t.oncomplete = () => res(q && q.result); t.onerror = () => rej(t.error); }); }
  const tousFichiers = () => tx('readonly', s => s.getAll());
  const ajouterFichier = (o) => tx('readwrite', s => s.put(o));
  const supprimerFichier = (id) => tx('readwrite', s => s.delete(id));

  /* ---------------- Vues ---------------- */
  let vue = { id: null, tous: false };
  const allerPage = (p) => { const el = document.querySelector('.menu-item[data-page="' + p + '"]'); if (el) el.click(); else toast("Cette page n'est pas disponible sur ce poste.", 'warn'); };

  async function rendu() {
    const page = document.getElementById('espaces'); if (!page) return;
    const divs = divisions(), m = meta(), fichiers = await tousFichiers().catch(() => []);
    const estEc = global.Config.estEcole();
    if (!vue.id) {
      const cartes = divs.map(d => {
        const nb = fichiers.filter(f => f.division === d.id).length, nbo = DOCS.filter(x => x.pour.indexOf(typeDe(d)) >= 0).length;
        return h('div', { class: 'esp-carte', onclick: () => { vue.id = d.id; rendu(); } }, h('div', { class: 'esp-ico' }, d.icone), h('h3', null, d.titre),
          h('div', { class: 'esp-tit' }, (m[d.id] && m[d.id].titulaire) ? '👤 ' + m[d.id].titulaire : '👤 titulaire à renseigner'),
          h('p', null, d.role), h('div', { class: 'esp-pied' }, `${nbo} document(s) officiel(s) · ${nb} document(s) de la division`));
      });
      page.replaceChildren(h('div', { class: 'page-title' }, '🏢 Espaces des divisions de la CS de Pobè'),
        h('p', { class: 'xnote' }, estEc ? "Les divisions de la circonscription et les documents officiels qu'elles diffusent. Vous pouvez conserver ici les documents reçus de chaque division (stockés sur cet appareil)."
          : "Chaque division dispose de son espace : titulaire, documents officiels, documents propres à la division et accès rapides à ses modules. Les fichiers sont stockés sur cet appareil."),
        h('div', { class: 'esp-grille' }, cartes), h('p', { class: 'xnote' }, CREDIT));
      return;
    }
    const d = divs.find(x => x.id === vue.id) || divs[0], mm = m[d.id] || {}, mesFichiers = fichiers.filter(f => f.division === d.id).sort((a, b) => b.date.localeCompare(a.date));
    const sauver = (cle, v) => { const x = meta(); x[d.id] = Object.assign({}, x[d.id], { [cle]: v }); saveMeta(x); };
    const docsOff = DOCS.filter(x => vue.tous || x.pour.indexOf(typeDe(d)) >= 0);
    const ind = indicateursDivision(d);

    const liste = h('div');
    docsOff.forEach(x => liste.append(h('div', { class: 'esp-doc' }, h('div', null, h('b', null, x.titre), h('div', { class: 'esp-sous' }, x.cat + (x.fichier ? ' · PDF' : ' · consultation dans l\'application'))),
      h('div', { class: 'esp-btns' }, x.fichier ? [h('a', { class: 'btn btn-primary btn-sm', href: x.fichier, target: '_blank', rel: 'noopener' }, '📄 Ouvrir'), h('a', { class: 'btn btn-sm', href: x.fichier, download: x.fichier.split('/').pop() }, '⬇')]
        : h('button', { class: 'btn btn-primary btn-sm', onclick: () => allerPage(x.page) }, '📚 Consulter')))));

    const sel = h('select', { style: { padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' } }, CATEGORIES.map(c => h('option', null, c)));
    const entree = h('input', { type: 'file', multiple: true, class: 'no-print', onchange: async () => {
      const fs = [...entree.files]; let n = 0;
      for (const f of fs) { if (f.size > 25 * 1048576) { toast(f.name + ' dépasse 25 Mo : ignoré.', 'warn'); continue; }
        await ajouterFichier({ id: App().uid() + n++, division: d.id, nom: f.name, type: f.type, taille: f.size, categorie: sel.value, date: new Date().toISOString(), blob: f }); }
      if (n) toast(n + ' document(s) ajouté(s).'); rendu();
    } });
    const mine = h('div');
    if (!mesFichiers.length) mine.append(h('p', { class: 'xnote' }, 'Aucun document dans cet espace pour le moment.'));
    mesFichiers.forEach(f => mine.append(h('div', { class: 'esp-doc' }, h('div', null, h('b', null, f.nom), h('div', { class: 'esp-sous' }, `${f.categorie} · ${taille(f.taille)} · ${new Date(f.date).toLocaleDateString('fr-FR')}`)),
      h('div', { class: 'esp-btns' }, h('button', { class: 'btn btn-primary btn-sm', onclick: () => { const u = URL.createObjectURL(f.blob); window.open(u, '_blank'); setTimeout(() => URL.revokeObjectURL(u), 60000); } }, '👁 Ouvrir'),
        h('button', { class: 'btn btn-sm', onclick: () => { const a = h('a', { href: URL.createObjectURL(f.blob), download: f.nom }); document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500); } }, '⬇'),
        h('button', { class: 'btn btn-danger btn-sm', onclick: async () => { if (!confirm('Supprimer « ' + f.nom + ' » de cet espace ?')) return; await supprimerFichier(f.id); rendu(); } }, '🗑')))));

    page.replaceChildren(
      h('div', { class: 'page-title' }, h('button', { class: 'btn btn-sm', onclick: () => { vue.id = null; rendu(); } }, '← Les divisions'), ' ' + d.icone + ' ' + d.titre),
      h('p', { class: 'xnote' }, d.role),
      h('div', { class: 'esp-bloc' }, h('h3', null, 'Titulaire'), h('div', { class: 'form-grid' },
        h('div', { class: 'form-group' }, h('label', null, 'Nom et prénoms'), h('input', { value: mm.titulaire || '', onchange: (e) => sauver('titulaire', e.target.value.trim()) })),
        h('div', { class: 'form-group' }, h('label', null, 'Téléphone'), h('input', { value: mm.tel || '', onchange: (e) => sauver('tel', e.target.value.trim()) })))),
      ...(ind ? [h('div', { class: 'stats-grid' }, ind.map(([l, v, c]) => h('div', { class: 'stat-card ' + (c || '') }, h('h4', null, l), h('div', { class: 'value' }, v))))] : []),
      h('div', { class: 'esp-bloc' }, h('h3', null, 'Accès rapides'), h('div', { class: 'xbar' }, d.pages.map(([p, l]) => h('button', { class: 'btn btn-info btn-sm', onclick: () => allerPage(p) }, l)))),
      h('div', { class: 'esp-bloc' }, h('h3', null, 'Documents officiels'), h('label', { class: 'xnote' }, h('input', { type: 'checkbox', checked: vue.tous, onchange: (e) => { vue.tous = e.target.checked; rendu(); } }), ' Afficher tous les documents officiels (pas seulement ceux de cette division)'), liste),
      h('div', { class: 'esp-bloc' }, h('h3', null, 'Documents de la division'), h('div', { class: 'xbar no-print' }, 'Catégorie : ', sel, entree), mine),
      h('div', { class: 'esp-bloc' }, h('h3', null, 'Notes'), h('textarea', { rows: 4, style: { width: '100%', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }, placeholder: 'Instructions, rappels, échéances…', onchange: (e) => sauver('notes', e.target.value) }, mm.notes || '')),
      h('p', { class: 'xnote' }, CREDIT));
    const ta = page.querySelector('textarea'); if (ta) ta.value = mm.notes || '';
  }
  function indicateursDivision(d) {
    if (!global.Synoptique) return null;
    const ecoles = App().data.ecoles.filter(e => !d.cp || (e.zone_ped || '') === d.zone), i = global.Synoptique.indicateurs(ecoles, App().anneeActive());
    return [['Écoles', i.ecoles], ['Enseignants', i.ens], ['Élèves', i.T.toLocaleString('fr-FR'), 'blue'], ['Filles', i.F.toLocaleString('fr-FR'), 'red']];
  }

  document.head.append(h('style', null, `
    #espaces .esp-grille{display:grid;grid-template-columns:repeat(auto-fill,minmax(290px,1fr));gap:14px;margin:12px 0}
    #espaces .esp-carte{background:#fff;border-radius:10px;padding:16px;box-shadow:0 1px 4px rgba(0,0,0,.1);border-top:4px solid #006633;cursor:pointer;transition:transform .12s}
    #espaces .esp-carte:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.15)}
    #espaces .esp-carte h3{margin:6px 0 4px;font-size:15px;color:#1e293b}
    #espaces .esp-ico{font-size:28px}
    #espaces .esp-tit{font-size:12px;color:#006633;font-weight:600;margin-bottom:6px}
    #espaces .esp-carte p{font-size:12px;color:#64748b;line-height:1.4}
    #espaces .esp-pied{font-size:11px;color:#94a3b8;margin-top:8px}
    #espaces .esp-bloc{background:#fff;border-radius:10px;padding:14px 16px;margin:12px 0;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #espaces .esp-bloc h3{margin:0 0 8px;color:#006633;font-size:15px}
    #espaces .esp-doc{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:8px 0;border-bottom:1px solid #eef2f6}
    #espaces .esp-sous{font-size:11px;color:#64748b}
    #espaces .esp-btns{display:flex;gap:6px;flex-shrink:0}`));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.espaces = () => { vue.id = null; rendu(); };
  global.Espaces = { DOCS, divisions };
})(window);
