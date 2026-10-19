/* République du Bénin — MEMP — CS Pobè
   Effectifs par âge, par classe et par sexe, consolidés par école, zone pédagogique et circonscription.
   Le total d'une zone (ou de la CS) est la somme des écoles et des classes ; la répartition par âge est tirée
   des relevés d'effectifs déjà saisis. Courbes d'âge, impression / PDF, Excel, export-import réimportable.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CLASSES = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  const AGES = ['Moins de 5 ans', '5 ans', '6 ans', '7 ans', '8 ans', '9 ans', '10 ans', '11 ans', '12 ans', '13 ans', '14 ans', '15 ans', '16 ans et plus'];
  const AGES_COURT = ['<5', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16+'];
  const SX = ['G', 'F'];
  const COULEURS = { G: '#0369a1', F: '#be185d', T: '#006633' };
  const CLS_COUL = ['#0369a1', '#be185d', '#15803d', '#b45309', '#6d28d9', '#0f766e'];
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const n0 = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  const estPrimaire = (e) => e && (e.type === 'EPP' || e.type === 'EPPRIV');

  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'value' || k === 'disabled' || k === 'checked' || k === 'selected') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid !== null && kid !== undefined && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    return el;
  }
  function toast(msg, kind) {
    const t = h('div', { class: 'xtoast ' + (kind || '') }, msg); document.body.append(t);
    setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 4200);
  }
  function saveFile(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  const pickFile = (accept) => new Promise((res) => {
    const i = h('input', { type: 'file', accept, style: { display: 'none' } });
    i.onchange = () => { const f = i.files[0] || null; i.remove(); res(f); }; document.body.append(i); i.click();
  });
  const clean = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 90);

  /* ---------------- Calculs ---------------- */
  const ageSum = (r, c, s) => AGES.reduce((a, g) => a + n0((r.ages || {})[g + '_' + c + '_' + s]), 0);
  const detail = (r, c, s) => n0(r['c_' + c.toLowerCase() + '_' + s]);
  const aDetail = (r) => CLASSES.some(c => SX.some(s => detail(r, c, s) > 0));
  /** Effectif retenu d'une classe : le détail par cours l'emporte sur le tableau par âge (règle de l'application). */
  const val = (r, c, s) => (aDetail(r) ? detail(r, c, s) : ageSum(r, c, s));
  const vide = () => ({ age: Object.fromEntries(AGES.map(a => [a, Object.fromEntries(CLASSES.map(c => [c, { G: 0, F: 0 }]))])),
    non: Object.fromEntries(CLASSES.map(c => [c, { G: 0, F: 0 }])), tot: Object.fromEntries(CLASSES.map(c => [c, { G: 0, F: 0 }])), horsClasse: { G: 0, F: 0 }, nb: 0, ecarts: [] });
  function ajouter(agg, r, ecole) {
    agg.nb++;
    let cG = 0, cF = 0;
    for (const c of CLASSES) for (const s of SX) {
      const v = val(r, c, s), a = ageSum(r, c, s);
      agg.tot[c][s] += v; if (s === 'G') cG += v; else cF += v;
      for (const g of AGES) agg.age[g][c][s] += n0((r.ages || {})[g + '_' + c + '_' + s]);
      agg.non[c][s] += Math.max(0, v - a);
      if (a > v) agg.ecarts.push(`${ecole ? ecole.nom : '—'} — ${c} (${s === 'G' ? 'garçons' : 'filles'}) : ${a} élève(s) répartis par âge pour ${v} dans la classe`);
    }
    /* Relevé sans détail par classe : on garde au moins les totaux de l'école. */
    if (cG + cF === 0) { agg.horsClasse.G += n0(r.totalG); agg.horsClasse.F += n0(r.totalF); }
  }
  const totClasse = (agg, c) => ({ G: agg.tot[c].G, F: agg.tot[c].F, T: agg.tot[c].G + agg.tot[c].F });
  function totaux(agg) {
    let G = agg.horsClasse.G, F = agg.horsClasse.F;
    for (const c of CLASSES) { G += agg.tot[c].G; F += agg.tot[c].F; }
    return { G, F, T: G + F };
  }
  /** Série par âge (toutes classes ou une classe) : { G:[…], F:[…], T:[…] } */
  function serieAge(agg, classe) {
    const cl = classe ? [classe] : CLASSES, o = { G: [], F: [], T: [] };
    for (const g of AGES) { let G = 0, F = 0; for (const c of cl) { G += agg.age[g][c].G; F += agg.age[g][c].F; } o.G.push(G); o.F.push(F); o.T.push(G + F); }
    return o;
  }
  function recompute(r) {
    let G = 0, F = 0; for (const c of CLASSES) { G += val(r, c, 'G'); F += val(r, c, 'F'); }
    if (G + F > 0) { r.totalG = G; r.totalF = F; r.total = G + F; }
  }

  /* ---------------- Courbe (SVG) ---------------- */
  function courbe({ titre, labels, series, w = 780, h: hh = 330, sousTitre }) {
    const m = { l: 64, r: 24, t: sousTitre ? 46 : 34, b: 76 }, iw = w - m.l - m.r, ih = hh - m.t - m.b;
    const max = Math.max(1, ...series.flatMap(s => s.values));
    const joli = (v) => { const p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10) * p; };
    const top = joli(max), x = (i) => m.l + (labels.length < 2 ? iw / 2 : i * iw / (labels.length - 1)), y = (v) => m.t + ih - (v / top) * ih;
    let s = `<svg class="courbe" viewBox="0 0 ${w} ${hh}" width="100%" role="img" aria-label="${esc(titre)}" xmlns="http://www.w3.org/2000/svg" font-family="Helvetica, Arial, sans-serif">`;
    s += `<text x="${w / 2}" y="18" text-anchor="middle" font-size="14" font-weight="700" fill="#1e293b">${esc(titre)}</text>`;
    if (sousTitre) s += `<text x="${w / 2}" y="34" text-anchor="middle" font-size="11" fill="#64748b">${esc(sousTitre)}</text>`;
    for (let k = 0; k <= 5; k++) {
      const v = top * k / 5, yy = y(v);
      s += `<line x1="${m.l}" y1="${yy}" x2="${w - m.r}" y2="${yy}" stroke="#e2e8f0"/><text x="${m.l - 6}" y="${yy + 4}" text-anchor="end" font-size="11" fill="#475569">${Math.round(v).toLocaleString('fr-FR')}</text>`;
    }
    labels.forEach((l, i) => { s += `<text transform="translate(${x(i)} ${hh - m.b + 16}) rotate(-35)" text-anchor="end" font-size="11" fill="#475569">${esc(l)}</text>`; });
    s += `<line x1="${m.l}" y1="${m.t}" x2="${m.l}" y2="${m.t + ih}" stroke="#94a3b8"/><line x1="${m.l}" y1="${m.t + ih}" x2="${w - m.r}" y2="${m.t + ih}" stroke="#94a3b8"/>`;
    series.forEach((se) => {
      const pts = se.values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
      s += `<polyline fill="none" stroke="${se.color}" stroke-width="${se.epais || 2.4}" ${se.tirets ? 'stroke-dasharray="6 4"' : ''} stroke-linejoin="round" points="${pts}"/>`;
      se.values.forEach((v, i) => { s += `<circle cx="${x(i).toFixed(1)}" cy="${y(v).toFixed(1)}" r="3.4" fill="${se.color}"><title>${esc(se.nom)} — ${esc(labels[i])} : ${v}</title></circle>`; });
    });
    let lx = m.l; const ly = hh - 10;
    series.forEach((se) => { s += `<rect x="${lx}" y="${ly - 9}" width="14" height="4" fill="${se.color}"/><text x="${lx + 19}" y="${ly - 3}" font-size="11" fill="#1e293b">${esc(se.nom)}</text>`; lx += 30 + se.nom.length * 6.4; });
    return s + '</svg>';
  }

  /* ---------------- Tableaux HTML ---------------- */
  function tableMatrice(agg) {
    const th = (t, extra) => `<th${extra || ''}>${esc(t)}</th>`;
    let s = '<table class="eff-t"><thead><tr><th rowspan="2" class="eff-l">Âge</th>' + CLASSES.map(c => th(c, ' colspan="3"')).join('') + th('ENSEMBLE', ' colspan="3"') + '</tr><tr>'
      + [...CLASSES, 'ENS'].map(() => '<th>G</th><th>F</th><th>T</th>').join('') + '</tr></thead><tbody>';
    for (const g of AGES) {
      let tg = 0, tf = 0;
      s += `<tr><td class="eff-l">${esc(g)}</td>` + CLASSES.map(c => { const a = agg.age[g][c]; tg += a.G; tf += a.F; return `<td>${a.G || ''}</td><td>${a.F || ''}</td><td class="c">${a.G + a.F || ''}</td>`; }).join('')
        + `<td class="c">${tg || ''}</td><td class="c">${tf || ''}</td><td class="c"><b>${tg + tf || ''}</b></td></tr>`;
    }
    let ng = 0, nf = 0;
    s += '<tr class="note"><td class="eff-l">Non réparti par âge (effectif saisi par classe)</td>' + CLASSES.map(c => { const a = agg.non[c]; ng += a.G; nf += a.F; return `<td>${a.G || ''}</td><td>${a.F || ''}</td><td class="c">${a.G + a.F || ''}</td>`; }).join('')
      + `<td class="c">${ng || ''}</td><td class="c">${nf || ''}</td><td class="c">${ng + nf || ''}</td></tr>`;
    let TG = 0, TF = 0;
    s += '<tr class="tot"><td class="eff-l">TOTAL (somme des écoles et des classes)</td>' + CLASSES.map(c => { const t = totClasse(agg, c); TG += t.G; TF += t.F; return `<td>${t.G}</td><td>${t.F}</td><td>${t.T}</td>`; }).join('')
      + `<td>${TG}</td><td>${TF}</td><td>${TG + TF}</td></tr></tbody></table>`;
    return s;
  }
  function tableSynthese(agg) {
    let s = '<table class="eff-t"><thead><tr><th class="eff-l">Classe</th><th>Garçons</th><th>Filles</th><th>Total</th><th>% filles</th><th>Âge le plus fréquent</th></tr></thead><tbody>';
    let TG = 0, TF = 0;
    for (const c of CLASSES) {
      const t = totClasse(agg, c); TG += t.G; TF += t.F;
      let best = -1, bi = -1; AGES.forEach((g, i) => { const v = agg.age[g][c].G + agg.age[g][c].F; if (v > best) { best = v; bi = i; } });
      s += `<tr><td class="eff-l">${c}</td><td>${t.G}</td><td>${t.F}</td><td><b>${t.T}</b></td><td>${t.T ? Math.round(t.F / t.T * 100) + ' %' : '—'}</td><td>${best > 0 ? esc(AGES[bi]) : '—'}</td></tr>`;
    }
    return s + `<tr class="tot"><td class="eff-l">TOTAL</td><td>${TG}</td><td>${TF}</td><td>${TG + TF}</td><td>${TG + TF ? Math.round(TF / (TG + TF) * 100) + ' %' : '—'}</td><td></td></tr></tbody></table>`;
  }

  /* ---------------- Page ---------------- */
  const etat = { annee: '', niveau: 'ecole', ecole: '', zone: '', classe: '' };
  let derniere = null;

  function perimetre() {
    const d = App().data, ecoles = d.ecoles.filter(estPrimaire);
    let list;
    if (global.Config.estEcole()) list = ecoles;
    else if (etat.niveau === 'ecole') list = ecoles.filter(e => String(e.id) === String(etat.ecole));
    else if (etat.niveau === 'zone') list = ecoles.filter(e => (e.zone_ped || '') === etat.zone);
    else list = ecoles;
    const ids = new Set(list.map(e => String(e.id)));
    const recs = d.effectifs.filter(r => ids.has(String(r.ecoleId)) && (r.annee || '') === etat.annee);
    return { list, recs };
  }
  const libelleNiveau = () => (global.Config.estEcole() || etat.niveau === 'ecole') ? ((App().data.ecoles.find(e => String(e.id) === String(etat.ecole)) || {}).nom || 'École')
    : etat.niveau === 'zone' ? etat.zone || 'Zone' : 'Circonscription Scolaire de POBÈ';

  function calcul() {
    const { list, recs } = perimetre(), agg = vide(), parEcole = new Map();
    for (const e of list) parEcole.set(String(e.id), { ecole: e, agg: vide() });
    for (const r of recs) { const o = parEcole.get(String(r.ecoleId)); ajouter(agg, r, o.ecole); ajouter(o.agg, r, o.ecole); }
    // maternelles : totaux seulement, hors matrice par classe
    const mat = App().data.ecoles.filter(e => !estPrimaire(e) && (global.Config.estEcole() || etat.niveau === 'cs' || (etat.niveau === 'zone' && (e.zone_ped || '') === etat.zone) || (etat.niveau === 'ecole' && String(e.id) === String(etat.ecole))));
    const matIds = new Set(mat.map(e => String(e.id)));
    const matRecs = App().data.effectifs.filter(r => matIds.has(String(r.ecoleId)) && (r.annee || '') === etat.annee);
    const matT = matRecs.reduce((a, r) => ({ G: a.G + n0(r.totalG), F: a.F + n0(r.totalF) }), { G: 0, F: 0 });
    return { list, recs, agg, parEcole, matT, nbMat: mat.length };
  }

  function rendu() {
    const page = document.getElementById('effectifsZone'); if (!page) return;
    const d = App().data, estEc = global.Config.estEcole();
    const annees = [...new Set([App().anneeActive(), ...d.effectifs.map(r => r.annee).filter(Boolean)])].sort().reverse();
    if (!etat.annee || annees.indexOf(etat.annee) < 0) etat.annee = annees[0];
    const prim = d.ecoles.filter(estPrimaire).sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    if (!etat.ecole || !prim.some(e => String(e.id) === String(etat.ecole))) etat.ecole = prim[0] ? String(prim[0].id) : '';
    const zones = [...new Set([...global.Donnees.ZONES, ...d.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    if (!etat.zone || zones.indexOf(etat.zone) < 0) etat.zone = zones[0] || '';
    if (estEc) etat.niveau = 'ecole';
    const c = calcul(); derniere = c;
    const T = totaux(c.agg), titre = libelleNiveau();

    const sel = (cle, opts, w) => h('select', { style: { maxWidth: w || '230px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }, onchange: (e) => { etat[cle] = e.target.value; rendu(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: String(etat[cle]) === String(v) }, l)));
    const niv = [['ecole', '🏫 École'], ['zone', '📍 Zone pédagogique'], ['cs', '🏛️ Circonscription']];
    const barre = h('div', { class: 'xbar no-print' },
      ...(estEc ? [] : niv.map(([k, l]) => h('button', { class: 'btn btn-sm ' + (etat.niveau === k ? 'btn-primary' : ''), onclick: () => { etat.niveau = k; rendu(); } }, l))),
      sel('annee', annees.map(a => [a, 'Année ' + a]), '170px'),
      ...(!estEc && etat.niveau === 'ecole' ? [sel('ecole', prim.map(e => [String(e.id), e.nom]), '320px')] : []),
      ...(!estEc && etat.niveau === 'zone' ? [sel('zone', zones.map(z => [z, z]))] : []));
    const actions = h('div', { class: 'xbar no-print' },
      h('button', { class: 'btn btn-primary', onclick: imprimer }, '🖨️ Imprimer / PDF'),
      h('button', { class: 'btn btn-info', onclick: exporterExcel }, '⬇ Excel'),
      h('button', { class: 'btn', onclick: exporterSaisie }, '📤 Exporter (CSV réimportable)'),
      h('button', { class: 'btn btn-warning', onclick: importer }, '📥 Importer Excel / CSV'));

    const carte = (v, l, cl) => h('div', { class: 'stat-card ' + (cl || '') }, h('h4', null, l), h('div', { class: 'value' }, v));
    const pctF = T.T ? Math.round(T.F / T.T * 100) : 0;
    const serie = serieAge(c.agg, etat.classe || ''); const pic = Math.max(...serie.T), ageModal = pic > 0 ? AGES[serie.T.indexOf(pic)] : '—';
    const cartes = h('div', { class: 'stats-grid' }, carte(T.T.toLocaleString('fr-FR'), 'Élèves du primaire'), carte(T.G.toLocaleString('fr-FR'), 'Garçons', 'blue'), carte(T.F.toLocaleString('fr-FR'), 'Filles', 'red'),
      carte(pctF + ' %', 'Part des filles', 'yellow'), carte(ageModal, 'Âge le plus fréquent'), carte(c.agg.nb + '/' + c.list.length, 'Relevés / écoles primaires'));

    const entete = h('div', { class: 'text-center eff-entete' }, h('b', null, 'RÉPUBLIQUE DU BÉNIN'), h('div', null, 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE'),
      h('div', null, 'CIRCONSCRIPTION SCOLAIRE DE POBÈ'), h('h3', { style: { margin: '6px 0 0' } }, 'EFFECTIFS DES APPRENANTS PAR ÂGE, CLASSE ET SEXE'), h('div', null, titre + ' — Année scolaire ' + etat.annee));

    const blocs = [entete, cartes];
    if (c.matT.G + c.matT.F > 0) blocs.push(h('p', { class: 'xnote' }, `Écoles maternelles (${c.nbMat}) : ${c.matT.G} garçons, ${c.matT.F} filles — ${c.matT.G + c.matT.F} enfants, non compris dans le tableau ci-dessous (cours CI → CM2).`));
    if (c.agg.horsClasse.G + c.agg.horsClasse.F > 0) blocs.push(h('p', { class: 'xnote' }, `${c.agg.horsClasse.G + c.agg.horsClasse.F} élève(s) figurent dans des relevés sans détail par classe : ils sont comptés dans les totaux mais pas dans le tableau.`));
    blocs.push(h('h3', { class: 'eff-h' }, 'Effectifs par âge, par sexe et par cours (total = somme des écoles et des classes)'), h('div', { class: 'eff-scroll', html: '' }));
    const matrice = h('div', { class: 'eff-scroll' }); matrice.innerHTML = tableMatrice(c.agg);
    blocs[blocs.length - 1] = matrice;
    const syn = h('div', { class: 'eff-scroll' }); syn.innerHTML = tableSynthese(c.agg);
    blocs.push(h('h3', { class: 'eff-h' }, 'Synthèse par cours'), syn);

    /* courbes d'âge */
    const labels = AGES.map(a => (a === 'Moins de 5 ans' ? '< 5 ans' : a === '16 ans et plus' ? '16 ans +' : a));
    const selClasse = h('select', { class: 'no-print', style: { padding: '6px', border: '1px solid #cbd5e1', borderRadius: '6px', marginLeft: '8px' }, onchange: (e) => { etat.classe = e.target.value; rendu(); } },
      h('option', { value: '' }, 'Tous les cours'), CLASSES.map(k => h('option', { value: k, selected: etat.classe === k }, k)));
    const g1 = h('div', { class: 'card-courbe' }); g1.innerHTML = courbe({ titre: "Courbe d'âge selon le sexe", sousTitre: `${titre} — ${etat.classe || 'tous les cours'} — ${etat.annee}`, labels,
      series: [{ nom: 'Garçons', color: COULEURS.G, values: serie.G }, { nom: 'Filles', color: COULEURS.F, values: serie.F }, { nom: 'Ensemble', color: COULEURS.T, values: serie.T, tirets: true, epais: 2 }] });
    const g2 = h('div', { class: 'card-courbe' }); g2.innerHTML = courbe({ titre: "Courbe d'âge par cours (garçons + filles)", sousTitre: `${titre} — ${etat.annee}`, labels,
      series: CLASSES.map((k, i) => ({ nom: k, color: CLS_COUL[i], values: serieAge(c.agg, k).T })) });
    blocs.push(h('h3', { class: 'eff-h' }, "Statistique par courbe d'âge", selClasse), g1, g2);

    /* détail par école (zone / CS) */
    if (!estEc && etat.niveau !== 'ecole') {
      const lignes = [...c.parEcole.values()].map(o => ({ e: o.ecole, t: totaux(o.agg), nb: o.agg.nb })).sort((a, b) => (a.e.nom || '').localeCompare(b.e.nom || '', 'fr'));
      const det = h('div', { class: 'eff-scroll' });
      det.innerHTML = '<table class="eff-t"><thead><tr><th class="eff-l">École</th><th>Zone</th><th>Garçons</th><th>Filles</th><th>Total</th><th>Relevé</th></tr></thead><tbody>'
        + lignes.map(l => `<tr><td class="eff-l">${esc(l.e.nom)}</td><td>${esc(l.e.zone_ped || '—')}</td><td>${l.t.G}</td><td>${l.t.F}</td><td><b>${l.t.T}</b></td><td>${l.nb ? '✔' : '— absent'}</td></tr>`).join('')
        + `<tr class="tot"><td class="eff-l">TOTAL</td><td></td><td>${T.G}</td><td>${T.F}</td><td>${T.T}</td><td>${c.agg.nb}/${lignes.length}</td></tr></tbody></table>`;
      blocs.push(h('h3', { class: 'eff-h' }, etat.niveau === 'zone' ? 'Détail par école de la zone' : 'Détail par école'), det);
    }
    if (c.agg.ecarts.length) blocs.push(h('div', { class: 'xnote' }, h('b', null, '⚠ Contrôles de cohérence : '), h('ul', null, c.agg.ecarts.slice(0, 15).map(x => h('li', null, x)))));
    blocs.push(h('p', { class: 'xnote' }, CREDIT));
    page.replaceChildren(h('div', { class: 'page-title' }, '📈 Effectifs par âge, classe et sexe'), barre, actions, ...blocs);
  }

  /* ---------------- Impression, Excel, saisie ---------------- */
  function imprimer() {
    if (!document.getElementById('xpageEff')) document.head.append(h('style', { id: 'xpageEff' }, '@page { size: A4 landscape; margin: 8mm; } @media print { #effectifsZone .xbar, #effectifsZone select { display: none !important; } }'));
    window.print();
  }
  const CSS_XLS = 'table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #444;padding:3px 6px;text-align:center}th{background:#006633;color:#fff}.eff-l{text-align:left}.tot td{background:#d9eadf;font-weight:bold}';
  function exporterExcel() {
    if (!derniere) return; const c = derniere, T = totaux(c.agg), titre = libelleNiveau();
    const html = `<h3>RÉPUBLIQUE DU BÉNIN — MEMP — Circonscription Scolaire de POBÈ</h3><h3>Effectifs par âge, classe et sexe — ${esc(titre)} — ${esc(etat.annee)}</h3>`
      + `<p>Total : ${T.T} élèves (${T.G} garçons, ${T.F} filles)</p>` + tableMatrice(c.agg) + '<br>' + tableSynthese(c.agg)
      + '<br><table><thead><tr><th class="eff-l">Courbe d\'âge</th>' + AGES.map(a => `<th>${esc(a)}</th>`).join('') + '</tr></thead><tbody>'
      + ['G', 'F', 'T'].map(s => `<tr><td class="eff-l">${{ G: 'Garçons', F: 'Filles', T: 'Ensemble' }[s]}</td>` + serieAge(c.agg, '')[s].map(v => `<td>${v}</td>`).join('') + '</tr>').join('') + `</tbody></table><p>${CREDIT}</p>`;
    saveFile(new Blob(['﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>' + CSS_XLS + '</style></head><body>' + html + '</body></html>'], { type: 'application/vnd.ms-excel' }),
      clean('Effectifs_age_classe_' + titre + '_' + etat.annee) + '.xls');
  }
  const ENTETE_CSV = ['Ecole', 'Annee', 'Age', ...CLASSES.flatMap(c => SX.map(s => c + '_' + s))];
  const csv = (rows) => '﻿' + rows.map(r => r.map(x => { const t = String(x ?? ''); return /[;"\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; }).join(';')).join('\r\n');
  function exporterSaisie() {
    const { list } = perimetre(), d = App().data, rows = [ENTETE_CSV];
    for (const e of list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))) {
      const r = d.effectifs.find(x => String(x.ecoleId) === String(e.id) && x.annee === etat.annee) || { ages: {} };
      for (const g of AGES) rows.push([e.nom, etat.annee, g, ...CLASSES.flatMap(c => SX.map(s => (r.ages || {})[g + '_' + c + '_' + s] || ''))]);
      rows.push([e.nom, etat.annee, 'TOTAL_CLASSE', ...CLASSES.flatMap(c => SX.map(s => r['c_' + c.toLowerCase() + '_' + s] || ''))]);
    }
    saveFile(new Blob([csv(rows)], { type: 'text/csv;charset=utf-8' }), clean('Saisie_effectifs_' + libelleNiveau() + '_' + etat.annee) + '.csv');
    toast('Fichier exporté : complétez-le dans Excel puis réimportez-le (CSV ou .xlsx, une seule feuille).');
  }
  async function importer() {
    const f = await pickFile('.csv,.xlsx,.txt'); if (!f) return;
    let lignes; try { lignes = await global.Tableur.lire(f); } catch (e) { return toast('Fichier illisible : ' + e.message, 'err'); }
    const hi = lignes.findIndex(l => norm(l[0]) === 'ecole'); if (hi < 0) return alert('En-tête introuvable : la première colonne doit s\'appeler « Ecole ». Utilisez « Exporter (CSV réimportable) ».');
    const tete = lignes[hi].map(x => String(x).trim()), idx = {};
    ENTETE_CSV.forEach(k => { idx[k] = tete.findIndex(t => t.toLowerCase() === k.toLowerCase()); });
    if (idx.Age < 0 || CLASSES.every(c => idx[c + '_G'] < 0)) return alert('Colonnes « Age » ou « CI_G … CM2_F » introuvables.');
    const d = App().data, parNom = new Map(d.ecoles.map(e => [norm(e.nom), e])), rejets = [], maj = new Map();
    for (let i = hi + 1; i < lignes.length; i++) {
      const l = lignes[i], nom = String(l[idx.Ecole] ?? '').trim(), e = parNom.get(norm(nom)); if (!nom) continue;
      if (!e) { rejets.push(`Ligne ${i + 1} : école « ${nom} » inconnue.`); continue; }
      const age = String(l[idx.Age] ?? '').trim(), an = String(idx.Annee >= 0 ? l[idx.Annee] || etat.annee : etat.annee).trim() || etat.annee;
      const g = AGES.find(a => norm(a) === norm(age)), total = /^total classe$/.test(norm(age)) || norm(age) === 'total classe';
      if (!g && !total) { rejets.push(`Ligne ${i + 1} : âge « ${age} » non reconnu.`); continue; }
      const cle = e.id + '|' + an; if (!maj.has(cle)) maj.set(cle, { e, an, valeurs: [] });
      for (const c of CLASSES) for (const s of SX) {
        const j = idx[c + '_' + s]; if (j < 0) continue; const t = String(l[j] ?? '').trim();
        if (t !== '' && !(Number.isInteger(Number(t.replace(',', '.'))) && Number(t) >= 0)) { rejets.push(`Ligne ${i + 1} : valeur « ${t} » invalide (${c}_${s}).`); continue; }
        maj.get(cle).valeurs.push({ g, c, s, v: t === '' ? 0 : parseInt(t, 10) });
      }
    }
    if (!maj.size) return alert('Aucune donnée exploitable.\n' + rejets.slice(0, 8).join('\n'));
    if (!confirm(`Importer les effectifs de ${maj.size} relevé(s) école/année ?\n${rejets.length ? rejets.length + ' anomalie(s) ignorée(s) :\n' + rejets.slice(0, 6).join('\n') + '\n\n' : ''}Les cases vides du fichier remettent la valeur à zéro.`)) return;
    let crees = 0, ignores = 0;
    for (const o of maj.values()) {
      let r = d.effectifs.find(x => String(x.ecoleId) === String(o.e.id) && x.annee === o.an);
      if (!r && !o.valeurs.some(v => v.v > 0)) { ignores++; continue; }   /* école sans aucun effectif dans le fichier : pas de relevé vide */
      if (!r) { crees++; r = { id: App().uid(), ecoleId: o.e.id, annee: o.an, ages: {} }; d.effectifs.push(r); }
      r.ages = r.ages || {};
      for (const v of o.valeurs) { if (v.g) r.ages[v.g + '_' + v.c + '_' + v.s] = v.v; else r['c_' + v.c.toLowerCase() + '_' + v.s] = v.v; }
      recompute(r);
    }
    App().saveData(); toast(`${maj.size - ignores} relevé(s) importé(s) (${crees} créé(s)) ; ${ignores} école(s) sans effectif ignorée(s).`); rendu();
  }

  /* ---------------- Style + branchement ---------------- */
  document.head.append(h('style', null, `
    #effectifsZone .eff-scroll{overflow-x:auto;background:#fff;border-radius:8px;margin:6px 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #effectifsZone table.eff-t{border-collapse:collapse;width:100%;font-size:12px}
    #effectifsZone table.eff-t th{background:#006633;color:#fff;border:1px solid rgba(255,255,255,.4);padding:5px 6px;text-align:center}
    #effectifsZone table.eff-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center;min-width:34px}
    #effectifsZone table.eff-t td.eff-l,#effectifsZone table.eff-t th.eff-l{text-align:left;min-width:220px}
    #effectifsZone table.eff-t td.c{background:#f1f5f9}
    #effectifsZone table.eff-t tr.tot td{background:#d9eadf;font-weight:700}
    #effectifsZone table.eff-t tr.note td{color:#64748b;font-style:italic}
    #effectifsZone .eff-h{margin:18px 0 4px;color:#006633;font-size:15px}
    #effectifsZone .eff-entete{margin-bottom:12px;font-size:13px}
    #effectifsZone .card-courbe{background:#fff;border-radius:8px;padding:8px;margin:8px 0 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    @media print{#effectifsZone .card-courbe{break-inside:avoid}#effectifsZone .eff-scroll{overflow:visible}}`));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.effectifsZone = rendu;
  global.EffZone = { calcul, courbe, AGES, CLASSES, serieAge, totaux, ajouter, vide, val };
})(window);
