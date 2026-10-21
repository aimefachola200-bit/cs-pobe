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
  /** Graphique au choix (courbe, histogramme, barres empilées, aires, points) — voir js/graphiques.js. */
  function courbe(opts) { return global.Graphiques ? global.Graphiques.graphique(opts) : ''; }



  /* ---------------- Écoles maternelles par section (SP, SG) ---------------- */
  const SECS = [['sp', 'SP'], ['sg', 'SG']];
  const AGES_M = [['m25', 'Moins de 2 ans ½', 2], ['a25', '2 ans ½ à 3 ans', 2.75], ['a3', '3 ans', 3], ['a4', '4 ans', 4], ['a5', '5 ans', 5], ['p5', 'Plus de 5 ans', 6]];
  const RENTREE_M = [['debut', 'Effectif au début de l’année'], ['besoin', 'Dont enfants à besoin spécifique']];
  const FIN_M = [['debut', 'Effectif au début de l’année'], ['fin', 'Effectif en fin d’année'], ['besoin', 'Dont enfants à besoin spécifique'], ['aband', 'Abandons']];
  const estMat = (e) => e && String(e.type).indexOf('EM') === 0;
  const vg = (o, s) => (s === 'T' ? o.G + o.F : o[s]);
  function videMat() {
    const z = () => Object.fromEntries(SECS.map(([k]) => [k, { G: 0, F: 0 }]));
    return { nb: 0, nRent: 0, nFin: 0, sec: z(), age: Object.fromEntries(AGES_M.map(([k]) => [k, z()])),
      rent: Object.fromEntries(RENTREE_M.map(([k]) => [k, z()])), fin: Object.fromEntries(FIN_M.map(([k]) => [k, z()])) };
  }
  function ajouterMat(m, r) {
    m.nb++;
    let rent = 0, fin = 0;
    for (const [sc] of SECS) for (const sx of SX) {
      let ag = 0;
      for (const [k] of AGES_M) { const v = n0((r.agesM || {})[k + '_' + sc + '_' + sx]); m.age[k][sc][sx] += v; ag += v; }
      const se = n0(r['s_eff_' + sc + '_' + sx]);
      m.sec[sc][sx] += se || ag;
      for (const [k] of RENTREE_M) { const v = n0(r['rent_' + k + '_' + sc + '_' + sx]); m.rent[k][sc][sx] += v; rent += v; }
      for (const [k] of FIN_M) { const v = n0(r['fin_' + k + '_' + sc + '_' + sx]); m.fin[k][sc][sx] += v; fin += v; }
    }
    if (rent) m.nRent++;
    if (fin) m.nFin++;
  }
  /** Âge moyen et écart type (population) d'une section ('ENS' = les deux) et d'un sexe. */
  function statsMat(m, sc, sx) {
    const n_ = (k) => (sc === 'ENS' ? SECS.reduce((a, [c]) => a + vg(m.age[k][c], sx), 0) : vg(m.age[k][sc], sx));
    let n = 0, sm = 0; AGES_M.forEach(([k, , a]) => { const v = n_(k); n += v; sm += v * a; });
    if (!n) return { n: 0, moy: null, et: null };
    const moy = sm / n; let q = 0; AGES_M.forEach(([k, , a]) => { q += n_(k) * (a - moy) ** 2; });
    return { n, moy, et: Math.sqrt(q / n) };
  }
  const cellsSec = (o) => { let tg = 0, tf = 0; return SECS.map(([c]) => { tg += o[c].G; tf += o[c].F; return `<td>${o[c].G}</td><td>${o[c].F}</td><td class="c"><b>${o[c].G + o[c].F}</b></td>`; }).join('') + `<td class="c">${tg}</td><td class="c">${tf}</td><td class="c"><b>${tg + tf}</b></td>`; };
  const teteSec = (premiere) => `<thead><tr><th rowspan="2" class="eff-l">${esc(premiere)}</th><th colspan="3">Section des petits (SP)</th><th colspan="3">Section des grands (SG)</th><th colspan="3">TOTAL</th></tr><tr>${'<th>G</th><th>F</th><th>T</th>'.repeat(3)}</tr></thead>`;
  function tableAgesMat(m) {
    const COLS = ['sp', 'sg', 'ENS'], SXT = ['G', 'F', 'T'];
    const n_ = (k, c, x) => (c === 'ENS' ? SECS.reduce((a, [sc]) => a + vg(m.age[k][sc], x), 0) : vg(m.age[k][c], x));
    const tot = {}; for (const c of COLS) for (const x of SXT) tot[c + x] = AGES_M.reduce((a, [k]) => a + n_(k, c, x), 0);
    if (!tot.ENST) return '<p class="xnote">Aucune répartition par âge (tableau 3) saisie pour ces écoles.</p>';
    let s = '<table class="eff-t"><thead><tr><th rowspan="2" class="eff-l">Âge</th><th colspan="3">Section des petits (SP)</th><th colspan="3">Section des grands (SG)</th><th colspan="3">ENSEMBLE</th></tr><tr>'
      + '<th>G</th><th>F</th><th>T</th>'.repeat(3) + '</tr></thead><tbody>';
    for (const [k, l] of AGES_M) s += `<tr><td class="eff-l">${esc(l)}</td>` + COLS.map(c => SXT.map(x => { const v = n_(k, c, x); return `<td${x === 'T' || c === 'ENS' ? ' class="c"' : ''}>${v || ''}${pc(v, tot[c + x])}</td>`; }).join('')).join('') + '</tr>';
    s += '<tr class="tot"><td class="eff-l">Total</td>' + COLS.map(c => SXT.map(x => `<td>${tot[c + x]}${tot[c + x] ? '<br><small class="eff-pc">100 %</small>' : ''}</td>`).join('')).join('') + '</tr>';
    s += '<tr class="stat"><td class="eff-l">Âge moyen (ans)</td>' + COLS.map(c => SXT.map(x => `<td>${f2(statsMat(m, c, x).moy)}</td>`).join('')).join('') + '</tr>';
    s += '<tr class="stat"><td class="eff-l">Écart type (ans)</td>' + COLS.map(c => SXT.map(x => `<td>${f2(statsMat(m, c, x).et)}</td>`).join('')).join('') + '</tr>';
    return s + '</tbody></table><p class="xnote">Pourcentage : part de la catégorie d\'âge dans l\'effectif de la section et du sexe. Âge moyen et écart type : « moins de 2 ans ½ » compté 2 ans, « 2 ans ½ à 3 ans » 2,75 ans, « plus de 5 ans » 6 ans.</p>';
  }
  /** Bloc HTML complet d'un secteur (public ou privé) : par section, âges, rentrée, fin d'année, détail par école. */
  function htmlMat(m, parEcole, detail) {
    let s = '<h4 class="eff-h">Effectif par section (fiche de recensement)</h4><table class="eff-t">' + teteSec('') + `<tbody><tr class="tot"><td class="eff-l">Total (${m.nb} relevé(s))</td>${cellsSec(m.sec)}</tr></tbody></table>`;
    s += '<h4 class="eff-h">Catégories d\'âge par section et par sexe (tableau 3)</h4>' + tableAgesMat(m);
    s += `<h4 class="eff-h">Rapport de rentrée — répartition des enfants par section (${m.nRent} école(s))</h4><table class="eff-t">` + teteSec('Rubrique') + '<tbody>'
      + RENTREE_M.map(([k, l]) => `<tr${k === 'debut' ? ' class="tot"' : ''}><td class="eff-l">${esc(l)}</td>${cellsSec(m.rent[k])}</tr>`).join('') + '</tbody></table>';
    s += `<h4 class="eff-h">Fiche de fin d’année — répartition des enfants par section (${m.nFin} école(s))</h4><table class="eff-t">` + teteSec('Rubrique') + '<tbody>'
      + FIN_M.map(([k, l]) => `<tr${k === 'fin' ? ' class="tot"' : ''}><td class="eff-l">${esc(l)}</td>${cellsSec(m.fin[k])}</tr>`).join('') + '</tbody></table>';
    if (detail && parEcole.length) {
      s += '<h4 class="eff-h">Détail par école (recensement · rentrée · fin d’année)</h4><table class="eff-t"><thead><tr><th rowspan="2" class="eff-l">École</th><th colspan="3">Recensement</th><th colspan="3">Rentrée (début)</th><th colspan="3">Fin d’année</th><th rowspan="2">Âge moyen</th></tr><tr>'
        + '<th>SP</th><th>SG</th><th>T</th>'.repeat(3) + '</tr></thead><tbody>'
        + parEcole.map(({ e, m: x }) => { const t3 = (o) => `<td>${vg(o.sp, 'T')}</td><td>${vg(o.sg, 'T')}</td><td class="c"><b>${vg(o.sp, 'T') + vg(o.sg, 'T')}</b></td>`;
          return `<tr><td class="eff-l">${esc(e.nom)}</td>${x.nb ? t3(x.sec) + t3(x.rent.debut) + t3(x.fin.fin) : '<td colspan="9">— relevé absent</td>'}<td>${f2(statsMat(x, 'ENS', 'T').moy)}</td></tr>`; }).join('') + '</tbody></table>';
    }
    return s;
  }

  /* ---------------- Tableaux HTML ---------------- */
  /* Âge retenu pour la moyenne et l'écart type : 4 ans pour « moins de 5 ans », 16 pour « 16 ans et plus ». */
  const AGE_NUM = AGES.map((_, i) => i + 4);
  /** Effectif d'une catégorie d'âge pour un cours ('ENS' = tous) et un sexe ('G', 'F', 'T'). */
  function nAge(agg, g, c, s) {
    const cl = c === 'ENS' ? CLASSES : [c];
    return cl.reduce((a, k) => a + (s === 'T' ? agg.age[g][k].G + agg.age[g][k].F : agg.age[g][k][s]), 0);
  }
  /** { n, moy, et } : effectif dont l'âge est connu, âge moyen, écart type (population). */
  function statsAge(agg, c, s) {
    let n = 0, sm = 0; AGES.forEach((g, i) => { const v = nAge(agg, g, c, s); n += v; sm += v * AGE_NUM[i]; });
    if (!n) return { n: 0, moy: null, et: null };
    const moy = sm / n; let v2 = 0; AGES.forEach((g, i) => { v2 += nAge(agg, g, c, s) * (AGE_NUM[i] - moy) ** 2; });
    return { n, moy, et: Math.sqrt(v2 / n) };
  }
  const f2 = (x) => (x === null || x === undefined ? '—' : x.toFixed(2).replace('.', ','));
  const pc = (v, t) => (t && v ? '<br><small class="eff-pc">' + (Math.round(v / t * 1000) / 10).toString().replace('.', ',') + ' %</small>' : '');
  function tableMatrice(agg) {
    const th = (t, extra) => `<th${extra || ''}>${esc(t)}</th>`, COLS = [...CLASSES, 'ENS'], SXT = ['G', 'F', 'T'];
    const totAge = {}; for (const c of COLS) for (const s of SXT) totAge[c + s] = AGES.reduce((a, g) => a + nAge(agg, g, c, s), 0);
    let s = '<table class="eff-t"><thead><tr><th rowspan="2" class="eff-l">Âge</th>' + CLASSES.map(c => th(c, ' colspan="3"')).join('') + th('ENSEMBLE', ' colspan="3"') + '</tr><tr>'
      + COLS.map(() => '<th>G</th><th>F</th><th>T</th>').join('') + '</tr></thead><tbody>';
    for (const g of AGES) {
      s += `<tr><td class="eff-l">${esc(g)}</td>` + COLS.map(c => SXT.map(x => { const v = nAge(agg, g, c, x); return `<td${x === 'T' || c === 'ENS' ? ' class="c"' : ''}>${x === 'T' && c === 'ENS' ? '<b>' + (v || '') + '</b>' : (v || '')}${pc(v, totAge[c + x])}</td>`; }).join('')).join('') + '</tr>';
    }
    s += '<tr class="tot"><td class="eff-l">Total réparti par âge</td>' + COLS.map(c => SXT.map(x => `<td>${totAge[c + x]}${totAge[c + x] ? '<br><small class="eff-pc">100 %</small>' : ''}</td>`).join('')).join('') + '</tr>';
    s += '<tr class="stat"><td class="eff-l">Âge moyen (ans)</td>' + COLS.map(c => SXT.map(x => `<td>${f2(statsAge(agg, c, x).moy)}</td>`).join('')).join('') + '</tr>';
    s += '<tr class="stat"><td class="eff-l">Écart type (ans)</td>' + COLS.map(c => SXT.map(x => `<td>${f2(statsAge(agg, c, x).et)}</td>`).join('')).join('') + '</tr>';
    let ng = 0, nf = 0;
    s += '<tr class="note"><td class="eff-l">Non réparti par âge (effectif saisi par classe)</td>' + CLASSES.map(c => { const a = agg.non[c]; ng += a.G; nf += a.F; return `<td>${a.G || ''}</td><td>${a.F || ''}</td><td class="c">${a.G + a.F || ''}</td>`; }).join('')
      + `<td class="c">${ng || ''}</td><td class="c">${nf || ''}</td><td class="c">${ng + nf || ''}</td></tr>`;
    let TG = 0, TF = 0;
    s += '<tr class="tot"><td class="eff-l">TOTAL (somme des écoles et des classes)</td>' + CLASSES.map(c => { const t = totClasse(agg, c); TG += t.G; TF += t.F; return `<td>${t.G}</td><td>${t.F}</td><td>${t.T}</td>`; }).join('')
      + `<td>${TG}</td><td>${TF}</td><td>${TG + TF}</td></tr></tbody></table>`
      + '<p class="xnote">Pourcentage : part de la catégorie d\'âge dans l\'effectif du cours et du sexe (colonne). Âge moyen et écart type : « moins de 5 ans » compté 4 ans, « 16 ans et plus » compté 16 ans.</p>';
    return s;
  }
  function tableSynthese(agg) {
    let s = '<table class="eff-t"><thead><tr><th class="eff-l">Classe</th><th>Garçons</th><th>Filles</th><th>Total</th><th>% filles</th><th>Âge le plus fréquent</th><th>Âge moyen G</th><th>Âge moyen F</th><th>Âge moyen</th><th>Écart type G</th><th>Écart type F</th><th>Écart type</th></tr></thead><tbody>';
    const st = (c) => ['G', 'F', 'T'].map(x => statsAge(agg, c, x)), cel = (c) => { const a = st(c); return a.map(o => `<td>${f2(o.moy)}</td>`).join('') + a.map(o => `<td>${f2(o.et)}</td>`).join(''); };
    let TG = 0, TF = 0;
    for (const c of CLASSES) {
      const t = totClasse(agg, c); TG += t.G; TF += t.F;
      let best = -1, bi = -1; AGES.forEach((g, i) => { const v = agg.age[g][c].G + agg.age[g][c].F; if (v > best) { best = v; bi = i; } });
      s += `<tr><td class="eff-l">${c}</td><td>${t.G}</td><td>${t.F}</td><td><b>${t.T}</b></td><td>${t.T ? Math.round(t.F / t.T * 100) + ' %' : '—'}</td><td>${best > 0 ? esc(AGES[bi]) : '—'}</td>${cel(c)}</tr>`;
    }
    return s + `<tr class="tot"><td class="eff-l">TOTAL</td><td>${TG}</td><td>${TF}</td><td>${TG + TF}</td><td>${TG + TF ? Math.round(TF / (TG + TF) * 100) + ' %' : '—'}</td><td></td>${cel('ENS')}</tr></tbody></table>`;
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
    const mats = { pub: { m: videMat(), ecoles: [] }, prv: { m: videMat(), ecoles: [] } };
    for (const e of mat.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))) {
      const cible = String(e.type).indexOf('PRIV') > 0 ? mats.prv : mats.pub, x = videMat();
      const r = matRecs.find(y => String(y.ecoleId) === String(e.id));
      if (r) { ajouterMat(x, r); ajouterMat(cible.m, r); }
      cible.ecoles.push({ e, m: x });
    }
    return { list, recs, agg, parEcole, matT, nbMat: mat.length, mats };
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
    if (c.matT.G + c.matT.F > 0) blocs.push(h('p', { class: 'xnote' }, `Écoles maternelles (${c.nbMat}) : ${c.matT.G} garçons, ${c.matT.F} filles — ${c.matT.G + c.matT.F} enfants, non compris dans le tableau par cours (CI → CM2) : voir plus bas « Écoles maternelles par section ».`));
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
      const lignes = [...c.parEcole.values()].map(o => ({ e: o.ecole, t: totaux(o.agg), nb: o.agg.nb, agg: o.agg })).sort((a, b) => (a.e.nom || '').localeCompare(b.e.nom || '', 'fr'));
      const det = h('div', { class: 'eff-scroll' });
      det.innerHTML = '<table class="eff-t"><thead><tr><th class="eff-l">École</th><th>Zone</th><th>Garçons</th><th>Filles</th><th>Total</th><th>Âge moyen G</th><th>Âge moyen F</th><th>Âge moyen</th><th>Écart type</th><th>Relevé</th></tr></thead><tbody>'
        + lignes.map(l => `<tr><td class="eff-l">${esc(l.e.nom)}</td><td>${esc(l.e.zone_ped || '—')}</td><td>${l.t.G}</td><td>${l.t.F}</td><td><b>${l.t.T}</b></td>${['G', 'F', 'T'].map(x => `<td>${f2(statsAge(l.agg, 'ENS', x).moy)}</td>`).join('')}<td>${f2(statsAge(l.agg, 'ENS', 'T').et)}</td><td>${l.nb ? '✔' : '— absent'}</td></tr>`).join('')
        + `<tr class="tot"><td class="eff-l">TOTAL</td><td></td><td>${T.G}</td><td>${T.F}</td><td>${T.T}</td>${['G', 'F', 'T'].map(x => `<td>${f2(statsAge(c.agg, 'ENS', x).moy)}</td>`).join('')}<td>${f2(statsAge(c.agg, 'ENS', 'T').et)}</td><td>${c.agg.nb}/${lignes.length}</td></tr></tbody></table>`;
      blocs.push(h('h3', { class: 'eff-h' }, etat.niveau === 'zone' ? 'Détail par école de la zone' : 'Détail par école'), det);
    }
    /* écoles maternelles par section, public puis privé à part */
    for (const [cle, lib, coul] of [['pub', 'publiques', '#006633'], ['prv', 'privées (à part)', '#8e44ad']]) {
      const o = c.mats[cle]; if (!o.ecoles.length) continue;
      const bloc = h('div', { class: 'eff-scroll', style: { padding: '6px 10px', borderTop: '4px solid ' + coul } });
      bloc.innerHTML = htmlMat(o.m, o.ecoles, !estEc && etat.niveau !== 'ecole');
      blocs.push(h('h3', { class: 'eff-h', style: { color: coul } }, `Écoles maternelles ${lib} : effectifs par section (SP, SG) — ${o.ecoles.length} école(s)`), bloc);
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
      + ['G', 'F', 'T'].map(s => `<tr><td class="eff-l">${{ G: 'Garçons', F: 'Filles', T: 'Ensemble' }[s]}</td>` + serieAge(c.agg, '')[s].map(v => `<td>${v}</td>`).join('') + '</tr>').join('') + '</tbody></table>'
      + [['pub', 'publiques'], ['prv', 'privées']].filter(([k]) => c.mats[k].ecoles.length).map(([k, l]) => `<h3>Écoles maternelles ${l} : effectifs par section (SP, SG)</h3>` + htmlMat(c.mats[k].m, c.mats[k].ecoles, etat.niveau !== 'ecole')).join('<br>')
      + `<p>${CREDIT}</p>`;
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
    #effectifsZone table.eff-t tr.stat td{background:#fff8e1;font-weight:700}
    #effectifsZone table.eff-t small.eff-pc{color:#64748b;font-size:10px;font-weight:400;white-space:nowrap}
    #effectifsZone .eff-h{margin:18px 0 4px;color:#006633;font-size:15px}
    #effectifsZone .eff-entete{margin-bottom:12px;font-size:13px}
    #effectifsZone .card-courbe{background:#fff;border-radius:8px;padding:8px;margin:8px 0 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    @media print{#effectifsZone .card-courbe{break-inside:avoid}#effectifsZone .eff-scroll{overflow:visible}}`));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.effectifsZone = rendu;
  global.EffCourbe = courbe;
  global.EffZone = { calcul, courbe, AGES, CLASSES, serieAge, totaux, ajouter, vide, val };
})(window);
