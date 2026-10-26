/* République du Bénin — MEMP — CS Pobè
   Écoles : nombre, structure pédagogique et équipements, consolidés par école, zone pédagogique et circonscription,
   secteur public et privé à part : écoles, classes autorisées / existantes, salles, classes simples, jumelées et
   multigrades (d'après l'attribution des classes), moyennes et écarts types, eau potable et sa source (dont puits),
   électricité et sa source, cantine, latrines, lavage des mains, clôture et autres équipements (compléments des fiches).
   Graphiques au choix, impression / PDF, Excel.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
  const n0 = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  const estMat = (e) => String(e.type || '').indexOf('EM') === 0;
  const estPriv = (e) => String(e.type || '').indexOf('PRIV') > 0;
  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  const STRUCT = [['simple', 'Simples'], ['jumelee', 'Jumelées'], ['multi', 'Multigrades']];
  const EAU = [['soneb', 'SONEB / eau courante'], ['forage', 'Forage'], ['aev', 'Adduction villageoise'], ['puits', 'Puits'], ['citerne', 'Citerne'], ['autre', 'Autre source']];
  const ELEC = [['sbee', 'SBEE'], ['groupe', 'Groupe électrogène'], ['solaire', 'Énergie solaire'], ['autre', 'Autre source']];
  const EQUIP = [['point_eau', 'Eau potable'], ['electrifiee', 'Électricité'], ['cantine', 'Cantine'], ['latrines', 'Latrines'],
    ['lavage_mains', 'Lavage des mains'], ['cloture', 'Clôture'], ['domaine_delimite', 'Domaine délimité'], ['cour_ombragee', 'Cour ombragée'],
    ['jardin_scolaire', 'Jardin scolaire'], ['bibliotheque', 'Bibliothèque'], ['pharmacie', 'Boîte à pharmacie'], ['sport_trace', 'Terrain de sport'],
    ['titre', 'Titre de propriété'], ['acces_permanent', 'Accès permanent'], ['inondable', 'École inondable']];
  const STATS = [['classes', 'Classes par école'], ['eleves', 'Élèves par école'], ['taille', 'Élèves par classe']];
  const PAL = ['#0369a1', '#be185d', '#15803d', '#6d28d9', '#b45309', '#0f766e'];

  const oui = (v) => { const s = norm(v); return s === 'oui' ? true : s === 'non' ? false : null; };
  function source(v, table) {
    const s = norm(v); if (!s) return null;
    if (/soneb|courante/.test(s)) return table === EAU ? 'soneb' : null;
    if (/adduction/.test(s)) return 'aev';
    if (/groupe/.test(s)) return 'groupe';
    if (/solaire/.test(s)) return 'solaire';
    for (const [k] of table) if (s.indexOf(k) >= 0) return k;
    return 'autre';
  }
  function moyEcart(vals) {
    if (!vals.length) return { n: 0, moy: null, et: null, min: null, max: null };
    const m = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { n: vals.length, moy: m, et: Math.sqrt(vals.reduce((a, v) => a + (v - m) ** 2, 0) / vals.length), min: Math.min(...vals), max: Math.max(...vals) };
  }
  /** Structure pédagogique d'une école d'après l'attribution des cours : un enseignant pour un cours = classe simple,
      pour deux cours = classe jumelée, pour trois cours ou plus = classe multigrade. */
  function structureEcole(e, annee) {
    const d = App().data, par = new Map();
    for (const a of (d.attributions || []).filter(x => String(x.ecoleId) === String(e.id) && x.annee === annee && x.enseignantId)) {
      par.set(a.enseignantId, (par.get(a.enseignantId) || 0) + 1);
    }
    const st = { simple: 0, jumelee: 0, multi: 0 };
    for (const nb of par.values()) st[nb >= 3 ? 'multi' : nb === 2 ? 'jumelee' : 'simple']++;
    return st;
  }
  function vide() {
    return { ecoles: 0, ep: 0, em: 0, aut: 0, ex: 0, salles: 0, struct: { simple: 0, jumelee: 0, multi: 0 },
      equip: Object.fromEntries(EQUIP.map(([k]) => [k, [0, 0]])), eau: Object.fromEntries(EAU.map(([k]) => [k, 0])),
      elec: Object.fromEntries(ELEC.map(([k]) => [k, 0])), _classes: [], _eleves: [], _taille: [] };
  }
  function ajouter(x, e, annee) {
    const d = App().data;
    x.ecoles++; x[estMat(e) ? 'em' : 'ep']++;
    x.aut += n0(e.classes_autorisees); x.ex += n0(e.classes_existantes); x.salles += n0(e.salles_existantes);
    if (n0(e.classes_existantes)) x._classes.push(n0(e.classes_existantes));
    const st = structureEcole(e, annee); for (const k in st) x.struct[k] += st[k];
    const r = d.effectifs.find(y => String(y.ecoleId) === String(e.id) && (!y.annee || y.annee === annee));
    if (r) {
      const t = n0(r.total) || (n0(r.totalG) + n0(r.totalF)); if (t) x._eleves.push(t);
      for (const c of (estMat(e) ? ['sp', 'sg'] : COURS)) {
        const v = estMat(e) ? n0(r['s_eff_' + c + '_G']) + n0(r['s_eff_' + c + '_F']) : n0(r['c_' + c.toLowerCase() + '_G']) + n0(r['c_' + c.toLowerCase() + '_F']);
        if (v) x._taille.push(v);
      }
    }
    const f = (d.fiches || []).find(y => String(y.ecoleId) === String(e.id) && y.annee === annee) || {};
    for (const [k] of EQUIP) {
      const v = k === 'titre' ? (norm(f.titre_propriete) ? norm(f.titre_propriete).indexOf('aucun') < 0 : null) : oui(f[k]);
      if (v !== null) { x.equip[k][1]++; if (v) x.equip[k][0]++; }
    }
    const se = source(f.source_eau, EAU); if (se) x.eau[se]++;
    const sl = source(f.source_electricite, ELEC); if (sl) x.elec[sl]++;
  }
  const pc1 = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);
  function indic(x) {
    x.struct_tot = x.struct.simple + x.struct.jumelee + x.struct.multi;
    x.p_jum = pc1(x.struct.jumelee, x.struct_tot); x.p_multi = pc1(x.struct.multi, x.struct_tot);
    x.taux_ouv = pc1(x.ex, x.aut);
    x.p_equip = Object.fromEntries(EQUIP.map(([k]) => [k, pc1(x.equip[k][0], x.equip[k][1])]));
    x.stats = { classes: moyEcart(x._classes), eleves: moyEcart(x._eleves), taille: moyEcart(x._taille) };
    return x;
  }

  const etat = { annee: '', niveau: 'cs', zone: '' };
  let derniere = null;
  function calcul() {
    const d = App().data, estEc = global.Config.estEcole();
    let list = d.ecoles.slice();
    if (!estEc && etat.niveau === 'zone') list = list.filter(e => (e.zone_ped || '') === etat.zone);
    const cle = !estEc && etat.niveau === 'cs' ? (e) => e.zone_ped || 'Sans zone' : (e) => e.nom;
    const grp = new Map(), tot = { nom: 'TOTAL', pub: vide(), prv: vide() };
    for (const e of list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))) {
      const k = cle(e); if (!grp.has(k)) grp.set(k, { nom: k, pub: vide(), prv: vide() });
      const s = estPriv(e) ? 'prv' : 'pub'; ajouter(grp.get(k)[s], e, etat.annee); ajouter(tot[s], e, etat.annee);
    }
    const g = [...grp.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    for (const x of [...g, tot]) { indic(x.pub); indic(x.prv); }
    return { grp: g, tot, lib: !estEc && etat.niveau === 'cs' ? 'Zone pédagogique' : 'École' };
  }
  const f2 = (v, dd = 2) => (v === null || v === undefined ? '—' : (Math.round(v * 10 ** dd) / 10 ** dd).toString().replace('.', ','));
  const pc = (v) => (v === null || v === undefined ? '—' : f2(v, 1) + ' %');
  const td = (v, cl) => `<td${cl ? ` class="${cl}"` : ''}>${v}</td>`;
  function tableau(c, s, titre, entetes, cellules, sous) {
    const rows = [...c.grp, c.tot].filter(g => g[s].ecoles);
    return `<h4 class="ez-h">${esc(titre)}</h4><div class="ez-scroll"><table class="ez-t"><thead>${sous ? sous : `<tr><th class="ez-l">${esc(c.lib)}</th>${entetes.map(t => `<th>${esc(t)}</th>`).join('')}</tr>`}</thead><tbody>`
      + rows.map(g => `<tr${g === c.tot ? ' class="tot"' : ''}><td class="ez-l">${esc(g.nom)}</td>${cellules(g[s]).join('')}</tr>`).join('') + '</tbody></table></div>';
  }
  const graphe = (titre, labels, series) => (global.Graphiques && labels.length ? global.Graphiques.graphique({ titre, labels, series }) : '');
  function htmlSecteur(c, s) {
    const g = c.grp.filter(x => x[s].ecoles), labels = g.map(x => x.nom);
    let h = tableau(c, s, '1. Écoles, classes et salles', ['Primaires', 'Maternelles', 'Total', 'Classes autorisées', 'Classes existantes', "Taux d'ouverture", 'Salles existantes'],
      (x) => [td(x.ep), td(x.em), td('<b>' + x.ecoles + '</b>'), td(x.aut), td(x.ex), td(pc(x.taux_ouv), 'ind'), td(x.salles)]);
    h += graphe('Écoles et classes', labels, [{ nom: 'Écoles', color: PAL[0], values: g.map(x => x[s].ecoles) }, { nom: 'Classes autorisées', color: PAL[3], values: g.map(x => x[s].aut) },
      { nom: 'Classes existantes', color: PAL[2], values: g.map(x => x[s].ex) }]);
    h += tableau(c, s, '2. Structure pédagogique (attribution des classes : 1 cours = simple, 2 = jumelée, 3 et plus = multigrade)', [...STRUCT.map(([, l]) => l), 'Total', '% jumelées', '% multigrades'],
      (x) => [...STRUCT.map(([k]) => td(x.struct[k])), td('<b>' + x.struct_tot + '</b>'), td(pc(x.p_jum), 'ind'), td(pc(x.p_multi), 'ind' + (x.p_multi >= 20 ? ' alerte' : ''))]);
    h += graphe('Structure pédagogique', labels, STRUCT.map(([k, l], i) => ({ nom: l, color: PAL[i], values: g.map(x => x[s].struct[k]) })));
    h += tableau(c, s, '3. Moyennes et écarts types', [], (x) => STATS.flatMap(([k]) => { const m = x.stats[k]; return [td(f2(m.moy), 'ind'), td(f2(m.et), 'ind'), td(m.min ?? '—'), td(m.max ?? '—')]; }),
      `<tr><th class="ez-l" rowspan="2">${esc(c.lib)}</th>${STATS.map(([, l]) => `<th colspan="4">${esc(l)}</th>`).join('')}</tr><tr>${STATS.map(() => '<th>Moyenne</th><th>Écart type</th><th>Min</th><th>Max</th>').join('')}</tr>`);
    h += graphe('Moyennes et écarts types', labels, [{ nom: 'Élèves par classe – moyenne', color: PAL[0], values: g.map(x => x[s].stats.taille.moy ?? 0) },
      { nom: 'Élèves par classe – écart type', color: PAL[1], values: g.map(x => x[s].stats.taille.et ?? 0) }, { nom: 'Classes par école – moyenne', color: PAL[2], values: g.map(x => x[s].stats.classes.moy ?? 0) }]);
    h += tableau(c, s, '4. Équipements et commodités (écoles qui en disposent / écoles ayant répondu)', [],
      (x) => EQUIP.flatMap(([k]) => [td(x.equip[k][0] + '<small>/' + x.equip[k][1] + '</small>'), td(pc(x.p_equip[k]), 'ind')]),
      `<tr><th class="ez-l" rowspan="2">${esc(c.lib)}</th>${EQUIP.map(([, l]) => `<th colspan="2">${esc(l)}</th>`).join('')}</tr><tr>${EQUIP.map(() => '<th>Écoles</th><th>%</th>').join('')}</tr>`);
    h += graphe('Équipements (% des écoles)', labels, EQUIP.slice(0, 6).map(([k, l], i) => ({ nom: l, color: PAL[i], values: g.map(x => x[s].p_equip[k] ?? 0) })));
    h += tableau(c, s, "5. Sources d'eau potable et d'électricité (nombre d'écoles)", [...EAU.map(([, l]) => 'Eau : ' + l), ...ELEC.map(([, l]) => 'Élec. : ' + l)],
      (x) => [...EAU.map(([k]) => td(x.eau[k], k === 'puits' ? 'ind' : '')), ...ELEC.map(([k]) => td(x.elec[k]))]);
    h += graphe("Sources d'eau (nombre d'écoles)", labels, EAU.map(([k, l], i) => ({ nom: l, color: PAL[i], values: g.map(x => x[s].eau[k]) })));
    return h;
  }
  function rendu() {
    const page = document.getElementById('ecolesZone'); if (!page) return;
    const d = App().data, estEc = global.Config.estEcole();
    const annees = [...new Set([App().anneeActive(), ...d.effectifs.map(r => r.annee).filter(Boolean), ...(d.fiches || []).map(f => f.annee).filter(Boolean)])].sort().reverse();
    if (!etat.annee || annees.indexOf(etat.annee) < 0) etat.annee = annees[0];
    const zones = [...new Set([...(global.Donnees.ZONES || []), ...d.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    if (!etat.zone || zones.indexOf(etat.zone) < 0) etat.zone = zones[0] || '';
    const c = calcul(); derniere = c;
    const opt = (cle, opts) => `<select data-cle="${cle}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(etat[cle]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const niv = estEc ? '' : [['cs', '🏛️ Circonscription (par zone)'], ['zone', '📍 Zone pédagogique (par école)']]
      .map(([k, l]) => `<button class="btn btn-sm ${etat.niveau === k ? 'btn-primary' : ''}" data-niv="${k}">${l}</button>`).join(' ');
    let html = `<div class="page-title">🏫 Écoles : structure pédagogique et équipements</div><div class="xbar no-print">${niv} ${opt('annee', annees.map(a => [a, 'Année ' + a]))}`
      + (!estEc && etat.niveau === 'zone' ? opt('zone', zones.map(z => [z, z])) : '')
      + '</div><div class="xbar no-print"><button class="btn btn-primary" data-act="print">🖨️ Imprimer / PDF</button> <button class="btn btn-info" data-act="xls">⬇ Excel</button></div>'
      + '<div class="text-center" style="font-size:13px;margin:8px 0"><b>RÉPUBLIQUE DU BÉNIN</b><br>MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>CIRCONSCRIPTION SCOLAIRE DE POBÈ<h3 style="margin:6px 0 0">ÉCOLES : STRUCTURE PÉDAGOGIQUE ET ÉQUIPEMENTS</h3>Année scolaire ' + esc(etat.annee) + '</div>'
      + '<p class="xnote">Sources : fiche de chaque école (classes autorisées, existantes, salles), attribution des classes (structure pédagogique), relevés d\'effectifs (élèves), compléments des fiches officielles (eau et sa source, électricité et sa source, cantine, latrines, clôture…). Écart type de la population.</p>';
    for (const [s, lib, coul] of [['pub', 'Secteur public', '#006633'], ['prv', 'Secteur privé (à part)', '#8e44ad']]) {
      const t = c.tot[s]; if (!t.ecoles) continue;
      html += `<h3 class="ez-sect" style="color:${coul};border-color:${coul}">${lib} — ${t.ecoles} école(s) · ${t.ex} classe(s) · ${t.struct.multi} multigrade(s) · ${t.eau.puits} école(s) avec puits</h3>` + htmlSecteur(c, s);
    }
    page.innerHTML = html + `<p class="xnote">${CREDIT}</p>`;
    page.querySelectorAll('select[data-cle]').forEach(sel => sel.addEventListener('change', () => { etat[sel.dataset.cle] = sel.value; rendu(); }));
    page.querySelectorAll('button[data-niv]').forEach(b => b.addEventListener('click', () => { etat.niveau = b.dataset.niv; rendu(); }));
    page.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
    page.querySelector('[data-act="xls"]').addEventListener('click', exporter);
  }
  function exporter() {
    if (!derniere) return;
    const c = derniere, tmp = document.createElement('div');
    tmp.innerHTML = ['pub', 'prv'].filter(s => c.tot[s].ecoles).map(s => `<h2>${s === 'pub' ? 'Secteur public' : 'Secteur privé'}</h2>` + htmlSecteur(c, s)).join('');
    tmp.querySelectorAll('.gchoix, svg').forEach(x => x.remove());
    const css = 'table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #444;padding:3px 6px;text-align:center}th{background:#006633;color:#fff}.ez-l{text-align:left}.tot td{background:#d9eadf;font-weight:bold}';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(window.XlsxEcrire.depuisHtmlBlob('﻿<html><head><meta charset="utf-8"><style>' + css + '</style></head><body><h3>RÉPUBLIQUE DU BÉNIN — MEMP — Circonscription Scolaire de POBÈ</h3><h3>Écoles : structure pédagogique et équipements — ' + esc(etat.annee) + '</h3>' + tmp.innerHTML + '<p>' + CREDIT + '</p></body></html>'));
    a.download = 'Ecoles_structure_equipements_' + etat.annee + '.xlsx'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1500);
  }
  document.head.append(Object.assign(document.createElement('style'), { textContent: `
    #ecolesZone .ez-scroll{overflow-x:auto;background:#fff;border-radius:8px;margin:6px 0 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #ecolesZone table.ez-t{border-collapse:collapse;width:100%;font-size:12px}
    #ecolesZone table.ez-t th{background:#006633;color:#fff;border:1px solid rgba(255,255,255,.4);padding:5px 6px;text-align:center}
    #ecolesZone table.ez-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center}
    #ecolesZone .ez-l{text-align:left!important;min-width:170px}
    #ecolesZone tr.tot td{background:#d9eadf;font-weight:700}
    #ecolesZone td.ind{background:#fff8e1;font-weight:700}
    #ecolesZone td.alerte{color:#b42318}
    #ecolesZone .ez-h{margin:14px 0 4px;color:#006633;font-size:14px}
    #ecolesZone .ez-sect{margin:22px 0 6px;border-bottom:3px solid;padding-bottom:4px}
    #ecolesZone select{padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-left:6px;max-width:280px}` }));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.ecolesZone = rendu;
  global.EcolesZone = { structureEcole, source, moyEcart, calcul: () => calcul(), etat };
})(window);
