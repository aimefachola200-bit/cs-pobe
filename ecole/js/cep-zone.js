/* République du Bénin — MEMP — CS Pobè
   CEP : candidats et réussite selon les rubriques des fiches (compléments « Résultats aux examens » : inscrits, ont
   composé, admis par sexe, dont enfants handicapés), par école, zone pédagogique et circonscription, secteur public et
   privé à part : effectifs par sexe et pourcentages, parité filles / garçons, taux de présence, taux de réussite par
   sexe, écart filles − garçons, moyenne et écart type des taux des écoles. À défaut de fiche, les inscrits sont tirés
   de la liste des candidats au CEP. Graphiques au choix, impression / PDF, Excel.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const n0 = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  const estPrimaire = (e) => String(e.type || '').indexOf('EP') === 0;
  const estPriv = (e) => String(e.type || '').indexOf('PRIV') > 0;
  const PAL = ['#0369a1', '#be185d', '#15803d', '#6d28d9', '#b45309'];
  const tx = (a, b) => (b ? Math.round(1000 * a / b) / 10 : null);

  /** CEP d'une école : { fiche, insc:[g,f], comp:[g,f], adm:[g,f], eh:{insc, adm} } */
  function cepEcole(e, annee) {
    const d = App().data, f = (d.fiches || []).find(y => String(y.ecoleId) === String(e.id) && y.annee === annee) || {};
    const r = { fiche: false, source: '', insc: [n0(f.cep_inscrits_g), n0(f.cep_inscrits_f)], comp: [n0(f.cep_composes_g), n0(f.cep_composes_f)],
      adm: [n0(f.cep_admis_g), n0(f.cep_admis_f)], eh: { insc: n0(f.cep_eh_inscrits), adm: n0(f.cep_eh_admis) } };
    if (r.insc[0] + r.insc[1] + r.comp[0] + r.comp[1] + r.adm[0] + r.adm[1]) { r.fiche = true; r.source = 'fiche'; return r; }
    const cands = (d.cep || []).filter(c => String(c.ecoleId) === String(e.id) && (!c.session || String(c.session).indexOf(String(annee).slice(-4)) >= 0 || String(annee).indexOf(String(c.session)) >= 0));
    if (cands.length) {
      r.insc = [cands.filter(c => /^m|^g/i.test(c.sexe || '')).length, cands.filter(c => /^f/i.test(c.sexe || '')).length];
      r.fiche = true; r.source = 'liste';
    }
    return r;
  }
  function vide() { return { ecoles: 0, fiches: 0, insc: [0, 0], comp: [0, 0], adm: [0, 0], eh: { insc: 0, adm: 0 }, _t: [], _g: [], _f: [] }; }
  function ajouter(x, c) {
    x.ecoles++; if (!c.fiche) return; x.fiches++;
    for (const k of ['insc', 'comp', 'adm']) { x[k][0] += c[k][0]; x[k][1] += c[k][1]; }
    x.eh.insc += c.eh.insc; x.eh.adm += c.eh.adm;
    const base = c.comp[0] + c.comp[1] ? c.comp : c.insc;
    if (c.adm[0] + c.adm[1] || c.comp[0] + c.comp[1]) {
      if (base[0] + base[1]) x._t.push(100 * (c.adm[0] + c.adm[1]) / (base[0] + base[1]));
      if (base[0]) x._g.push(100 * c.adm[0] / base[0]);
      if (base[1]) x._f.push(100 * c.adm[1] / base[1]);
    }
  }
  function disp(v) {
    if (!v.length) return { n: 0, moy: null, et: null, min: null, max: null, cent: 0, sous50: 0 };
    const m = v.reduce((a, b) => a + b, 0) / v.length;
    return { n: v.length, moy: m, et: Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length), min: Math.min(...v), max: Math.max(...v),
      cent: v.filter(t => t >= 99.95).length, sous50: v.filter(t => t < 50).length };
  }
  function indic(x) {
    const T = (a) => [a[0], a[1], a[0] + a[1]];
    x.r = { insc: T(x.insc), comp: T(x.comp), adm: T(x.adm) };
    const base = x.r.comp[2] ? x.r.comp : x.r.insc;
    x.p_g = tx(x.insc[0], x.r.insc[2]); x.p_f = tx(x.insc[1], x.r.insc[2]); x.parite = x.insc[0] ? Math.round(100 * x.insc[1] / x.insc[0]) / 100 : null;
    x.presence = x.r.comp[2] ? [0, 1, 2].map(j => tx(x.r.comp[j], x.r.insc[j])) : [null, null, null];
    x.reussite = x.r.adm[2] || x.r.comp[2] ? [0, 1, 2].map(j => tx(x.r.adm[j], base[j])) : [null, null, null];
    x.ecart = x.reussite[0] !== null && x.reussite[1] !== null ? Math.round(10 * (x.reussite[1] - x.reussite[0])) / 10 : null;
    x.disp = { T: disp(x._t), G: disp(x._g), F: disp(x._f) };
    return x;
  }

  const etat = { annee: '', niveau: 'cs', zone: '' };
  let derniere = null;
  function calcul() {
    const d = App().data, estEc = global.Config.estEcole();
    let list = d.ecoles.filter(estPrimaire);
    if (!estEc && etat.niveau === 'zone') list = list.filter(e => (e.zone_ped || '') === etat.zone);
    const N = estEc ? 'ecoles' : etat.niveau;
    const cle = N === 'cs' ? (e) => e.zone_ped || 'Sans zone' : N === 'arr' ? (e) => e.arrondissement || 'Sans arrondissement' : (e) => e.nom;
    const grp = new Map(), tot = { nom: 'TOTAL', pub: vide(), prv: vide() };
    for (const e of list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))) {
      const k = cle(e); if (!grp.has(k)) grp.set(k, { nom: k, pub: vide(), prv: vide() });
      const s = estPriv(e) ? 'prv' : 'pub', c = cepEcole(e, etat.annee); ajouter(grp.get(k)[s], c); ajouter(tot[s], c);
    }
    const g = [...grp.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    for (const x of [...g, tot]) { indic(x.pub); indic(x.prv); }
    return { grp: g, tot, lib: N === 'cs' ? 'Zone pédagogique' : N === 'arr' ? 'Arrondissement' : 'École' };
  }
  const f2 = (v, dd = 2) => (v === null || v === undefined ? '—' : (Math.round(v * 10 ** dd) / 10 ** dd).toString().replace('.', ','));
  const pc = (v) => (v === null || v === undefined ? '—' : f2(v, 1) + ' %');
  const td = (v, cl) => `<td${cl ? ` class="${cl}"` : ''}>${v}</td>`;
  const coulTaux = (v) => (v === null ? 'ind' : v < 50 ? 'ind alerte' : v >= 80 ? 'ind bon' : 'ind');
  function tableau(c, s, titre, tete, cellules) {
    const rows = [...c.grp, c.tot].filter(g => g[s].ecoles);
    return `<h4 class="cz-h">${esc(titre)}</h4><div class="cz-scroll"><table class="cz-t"><thead>${tete}</thead><tbody>`
      + rows.map(g => `<tr${g === c.tot ? ' class="tot"' : ''}><td class="cz-l">${esc(g.nom)}</td>${cellules(g[s]).join('')}</tr>`).join('') + '</tbody></table></div>';
  }
  const graphe = (titre, labels, series) => (global.Graphiques && labels.length ? global.Graphiques.graphique({ titre, labels, series }) : '');
  function htmlSecteur(c, s) {
    const g = c.grp.filter(x => x[s].ecoles), labels = g.map(x => x.nom), L = esc(c.lib);
    let h = tableau(c, s, '1. Candidats au CEP : effectifs par sexe et pourcentages',
      `<tr><th class="cz-l" rowspan="2">${L}</th><th rowspan="2">Écoles</th><th colspan="3">Inscrits</th><th colspan="3">Répartition</th><th colspan="3">Présents (ont composé)</th><th colspan="3">Taux de présence</th></tr><tr>${'<th>G</th><th>F</th><th>T</th>'}<th>% G</th><th>% F</th><th>Parité F/G</th>${'<th>G</th><th>F</th><th>T</th>'.repeat(2)}</tr>`,
      (x) => [td(x.fiches + '/' + x.ecoles), ...x.r.insc.map(v => td(v)), td(pc(x.p_g), 'ind'), td(pc(x.p_f), 'ind'), td(f2(x.parite), 'ind' + (x.parite !== null && x.parite < 0.9 ? ' alerte' : '')),
        ...x.r.comp.map(v => td(v)), ...x.presence.map(v => td(pc(v), 'ind'))]);
    h += graphe('Candidats au CEP', labels, [{ nom: 'Garçons', color: PAL[0], values: g.map(x => x[s].insc[0]) }, { nom: 'Filles', color: PAL[1], values: g.map(x => x[s].insc[1]) },
      { nom: 'Ont composé', color: PAL[3], values: g.map(x => x[s].r.comp[2]) }]);
    h += tableau(c, s, '2. Réussite au CEP',
      `<tr><th class="cz-l" rowspan="2">${L}</th><th colspan="3">Admis</th><th colspan="3">Taux de réussite</th><th rowspan="2">Écart F − G (points)</th><th colspan="2">Dont enfants handicapés</th></tr><tr>${'<th>G</th><th>F</th><th>T</th>'.repeat(2)}<th>Inscrits</th><th>Admis</th></tr>`,
      (x) => [...x.r.adm.map(v => td(v)), ...x.reussite.map(v => td(pc(v), coulTaux(v))), td(f2(x.ecart, 1)), td(x.eh.insc), td(x.eh.adm)]);
    h += graphe('Taux de réussite au CEP (%)', labels, [{ nom: 'Garçons', color: PAL[0], values: g.map(x => x[s].reussite[0] ?? 0) },
      { nom: 'Filles', color: PAL[1], values: g.map(x => x[s].reussite[1] ?? 0) }, { nom: 'Ensemble', color: PAL[2], values: g.map(x => x[s].reussite[2] ?? 0) }]);
    h += tableau(c, s, '3. Dispersion des taux de réussite des écoles',
      `<tr><th class="cz-l" rowspan="2">${L}</th>${['Ensemble', 'Garçons', 'Filles'].map(t => `<th colspan="4">${t}</th>`).join('')}<th rowspan="2">Écoles à 100 %</th><th rowspan="2">Écoles sous 50 %</th></tr><tr>${'<th>Moyenne</th><th>Écart type</th><th>Min</th><th>Max</th>'.repeat(3)}</tr>`,
      (x) => [...['T', 'G', 'F'].flatMap(k => { const d = x.disp[k]; return [td(pc(d.moy), 'ind'), td(f2(d.et, 1), 'ind'), td(pc(d.min)), td(pc(d.max))]; }), td(x.disp.T.cent), td(x.disp.T.sous50, x.disp.T.sous50 ? 'alerte' : '')]);
    h += graphe('Moyenne et écart type des taux des écoles', labels, [{ nom: 'Moyenne (%)', color: PAL[2], values: g.map(x => x[s].disp.T.moy ?? 0) },
      { nom: 'Écart type', color: PAL[3], values: g.map(x => x[s].disp.T.et ?? 0) }]);
    return h;
  }
  function rendu() {
    const page = document.getElementById('cepZone'); if (!page) return;
    const d = App().data, estEc = global.Config.estEcole();
    const annees = [...new Set([App().anneeActive(), ...(d.fiches || []).map(f => f.annee).filter(Boolean)])].sort().reverse();
    if (!etat.annee || annees.indexOf(etat.annee) < 0) etat.annee = annees[0];
    const zones = [...new Set([...(global.Donnees.ZONES || []), ...d.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    if (!etat.zone || zones.indexOf(etat.zone) < 0) etat.zone = zones[0] || '';
    const c = calcul(); derniere = c;
    const opt = (cle, opts) => `<select data-cle="${cle}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(etat[cle]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const niv = estEc ? '' : [['cs', '🏛️ Par zone pédagogique'], ['arr', '🗺️ Par arrondissement'], ['ecoles', '🏫 Par école (toute la CS)'], ['zone', '📍 Une zone (par école)']]
      .map(([k, l]) => `<button class="btn btn-sm ${etat.niveau === k ? 'btn-primary' : ''}" data-niv="${k}">${l}</button>`).join(' ');
    let html = `<div class="page-title">🎓 Candidats présentés au CEP dans la circonscription, par sexe</div><div class="xbar no-print">${niv} ${opt('annee', annees.map(a => [a, 'Année ' + a]))}`
      + (!estEc && etat.niveau === 'zone' ? opt('zone', zones.map(z => [z, z])) : '')
      + '</div><div class="xbar no-print"><button class="btn btn-primary" data-act="print">🖨️ Imprimer / PDF</button> <button class="btn btn-info" data-act="xls">⬇ Excel</button></div>'
      + '<div class="text-center" style="font-size:13px;margin:8px 0"><b>RÉPUBLIQUE DU BÉNIN</b><br>MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>CIRCONSCRIPTION SCOLAIRE DE POBÈ<h3 style="margin:6px 0 0">CANDIDATS PRÉSENTÉS AU CEP, PAR SEXE — INSCRITS, PRÉSENTS, ADMIS</h3>Année scolaire ' + esc(etat.annee) + '</div>'
      + '<p class="xnote">Source : rubrique « Résultats aux examens » des fiches officielles (compléments : inscrits, ont composé, admis par sexe, dont enfants handicapés) ; à défaut, inscrits tirés de la liste des candidats au CEP. Taux de réussite = admis ÷ ont composé (à défaut ÷ inscrits) ; parité F/G = filles ÷ garçons ; écart type de la population.</p>';
    html += synthese(c);
    for (const [s, lib, coul] of [['pub', 'Secteur public', '#006633'], ['prv', 'Secteur privé (à part)', '#8e44ad']]) {
      const t = c.tot[s]; if (!t.ecoles) continue;
      html += `<h3 class="cz-sect" style="color:${coul};border-color:${coul}">${lib} — ${t.r.insc[2]} inscrits (${t.insc[0]} G · ${t.insc[1]} F) · ${t.r.adm[2]} admis · réussite ${pc(t.reussite[2])}</h3>` + htmlSecteur(c, s);
    }
    page.innerHTML = html + `<p class="xnote">${CREDIT}</p>`;
    page.querySelectorAll('select[data-cle]').forEach(sel => sel.addEventListener('change', () => { etat[sel.dataset.cle] = sel.value; rendu(); }));
    page.querySelectorAll('button[data-niv]').forEach(b => b.addEventListener('click', () => { etat.niveau = b.dataset.niv; rendu(); }));
    page.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
    page.querySelector('[data-act="xls"]').addEventListener('click', exporter);
  }
  /** Récapitulatif de la circonscription : public, privé et ensemble (inscrits, présents, admis — G / F / T). */
  function synthese(c) {
    const P = c.tot.pub, V = c.tot.prv, S = (k) => [0, 1].map(j => P[k][j] + V[k][j]);
    const ens = { insc: S('insc'), comp: S('comp'), adm: S('adm') };
    const ligne = (lib, x, cl) => `<tr${cl ? ' class="tot"' : ''}><td class="cz-l">${lib}</td>` + ['insc', 'comp', 'adm'].map(k => [x[k][0], x[k][1], x[k][0] + x[k][1]].map(v => td(v)).join('')).join('')
      + td(pc(tx(x.adm[0] + x.adm[1], (x.comp[0] + x.comp[1]) || (x.insc[0] + x.insc[1]))), 'ind') + '</tr>';
    return '<h4 class="cz-h">Récapitulatif — total de la circonscription</h4><div class="cz-scroll"><table class="cz-t"><thead><tr><th class="cz-l" rowspan="2">Secteur</th><th colspan="3">Inscrits</th><th colspan="3">Présents (ont composé)</th><th colspan="3">Admis</th><th rowspan="2">Taux de réussite</th></tr><tr>'
      + '<th>G</th><th>F</th><th>T</th>'.repeat(3) + '</tr></thead><tbody>' + ligne('Public', P) + ligne('Privé', V) + ligne('TOTAL CS', ens, true) + '</tbody></table></div>';
  }
  function exporter() {
    if (!derniere) return;
    const c = derniere, tmp = document.createElement('div');
    tmp.innerHTML = synthese(c) + ['pub', 'prv'].filter(s => c.tot[s].ecoles).map(s => `<h2>${s === 'pub' ? 'Secteur public' : 'Secteur privé'}</h2>` + htmlSecteur(c, s)).join('');
    tmp.querySelectorAll('.gchoix, svg').forEach(x => x.remove());
    const css = 'table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #444;padding:3px 6px;text-align:center}th{background:#006633;color:#fff}.cz-l{text-align:left}.tot td{background:#d9eadf;font-weight:bold}';
    const a = document.createElement('a');
    a.href = URL.createObjectURL(window.XlsxEcrire.depuisHtmlBlob('﻿<html><head><meta charset="utf-8"><style>' + css + '</style></head><body><h3>RÉPUBLIQUE DU BÉNIN — MEMP — Circonscription Scolaire de POBÈ</h3><h3>CEP : candidats et réussite — ' + esc(etat.annee) + '</h3>' + tmp.innerHTML + '<p>' + CREDIT + '</p></body></html>'));
    a.download = 'CEP_candidats_reussite_' + etat.annee + '.xlsx'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1500);
  }
  document.head.append(Object.assign(document.createElement('style'), { textContent: `
    #cepZone .cz-scroll{overflow-x:auto;background:#fff;border-radius:8px;margin:6px 0 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #cepZone table.cz-t{border-collapse:collapse;width:100%;font-size:12px}
    #cepZone table.cz-t th{background:#006633;color:#fff;border:1px solid rgba(255,255,255,.4);padding:5px 6px;text-align:center}
    #cepZone table.cz-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center}
    #cepZone .cz-l{text-align:left!important;min-width:170px}
    #cepZone tr.tot td{background:#d9eadf;font-weight:700}
    #cepZone td.ind{background:#fff8e1;font-weight:700}
    #cepZone td.alerte{color:#b42318}
    #cepZone td.bon{color:#15803d}
    #cepZone .cz-h{margin:14px 0 4px;color:#006633;font-size:14px}
    #cepZone .cz-sect{margin:22px 0 6px;border-bottom:3px solid;padding-bottom:4px}
    #cepZone select{padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-left:6px;max-width:280px}` }));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.cepZone = rendu;
  global.CepZone = { cepEcole, calcul: () => calcul(), etat };
})(window);
