/* République du Bénin — MEMP — CS Pobè
   Tableau synoptique : écoles, classes, salles, enseignants et élèves, par secteur (public / privé) et par cycle (maternelle / primaire),
   calculé automatiquement pour l'école, l'unité pédagogique, la zone pédagogique ou la circonscription.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const n0 = (x) => { const n = parseFloat(x); return Number.isFinite(n) && n > 0 ? n : 0; };
  const clean = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '_').slice(0, 90);

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
  function saveFile(blob, name) {
    const a = h('a', { href: URL.createObjectURL(blob), download: name }); document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }

  const COLONNES = [
    ['pubEM', 'Public EM', e => e.type === 'EM'], ['pubEP', 'Public EP', e => e.type === 'EPP'], ['totPub', 'Total public', e => e.type === 'EM' || e.type === 'EPP'],
    ['privEM', 'Privé EM', e => e.type === 'EMPRIV'], ['privEP', 'Privé EP', e => e.type === 'EPPRIV'], ['totPriv', 'Total privé', e => e.type === 'EMPRIV' || e.type === 'EPPRIV'],
    ['totEM', 'Total EM', e => e.type === 'EM' || e.type === 'EMPRIV'], ['totEP', 'Total EP', e => e.type === 'EPP' || e.type === 'EPPRIV'], ['tot', 'TOTAL GÉNÉRAL', () => true]];

  /** Indicateurs d'un ensemble d'écoles */
  function indicateurs(ecoles, annee) {
    const d = App().data, ids = new Set(ecoles.map(e => String(e.id)));
    const effs = d.effectifs.filter(r => ids.has(String(r.ecoleId)) && (r.annee || '') === annee);
    const ens = d.personnel.filter(p => ids.has(String(p.ecoleId)) && (p.categorie || 'Enseignant') === 'Enseignant');
    const somme = (f) => effs.reduce((a, r) => a + n0(r[f]), 0);
    const F = somme('totalF'), G = somme('totalG'), nbCl = ecoles.reduce((a, e) => a + n0(e.classes_existantes), 0);
    const nbEns = ens.length, nbEnsF = ens.filter(p => p.sexe === 'F').length;
    return {
      ecoles: ecoles.length, up: new Set(ecoles.map(e => e.unite_ped).filter(Boolean)).size,
      clAut: ecoles.reduce((a, e) => a + n0(e.classes_autorisees), 0), clExi: nbCl,
      salExi: ecoles.reduce((a, e) => a + n0(e.salles_existantes), 0), salUti: ecoles.reduce((a, e) => a + n0(e.salles_utilisees), 0),
      ens: nbEns, ensF: nbEnsF, ensM: nbEns - nbEnsF, F, G, T: F + G, pF: F + G ? Math.round(F / (F + G) * 1000) / 10 : null,
      eh: somme('handicapes'), red: somme('redoublants'), sa: somme('sansActe'),
      parClasse: nbCl ? Math.round((F + G) / nbCl * 10) / 10 : null, parEns: nbEns ? Math.round((F + G) / nbEns * 10) / 10 : null,
    };
  }
  const LIGNES = [
    ['ecoles', 'Écoles en activité'], ['up', 'Unités pédagogiques représentées'], ['clAut', 'Classes / sections autorisées'], ['clExi', 'Classes / sections existantes'],
    ['salExi', 'Salles de classe existantes'], ['salUti', 'Salles de classe utilisées'], ['ens', 'Enseignants'], ['ensF', '  dont femmes'], ['ensM', '  dont hommes'],
    ['F', 'Élèves filles'], ['G', 'Élèves garçons'], ['T', 'ÉLÈVES TOTAL'], ['pF', 'Part des filles (%)'], ['eh', '  dont enfants handicapés'], ['red', '  dont redoublants'], ['sa', '  dont sans acte de naissance'],
    ['parClasse', 'Élèves par classe'], ['parEns', 'Élèves par enseignant']];
  const GRAS = new Set(['T', 'ecoles']);

  const etat = { annee: '', niveau: 'cs', zone: '', up: '', ecole: '' };
  let derniere = null;

  function filtrer() {
    const d = App().data; let l = d.ecoles.filter(e => (e.statut_ecole || 'Ouverte') !== 'Fermée');
    if (global.Config.estEcole() || etat.niveau === 'ecole') l = l.filter(e => String(e.id) === String(etat.ecole));
    else if (etat.niveau === 'zone') l = l.filter(e => (e.zone_ped || '') === etat.zone);
    else if (etat.niveau === 'up') l = l.filter(e => (e.unite_ped || '') === etat.up);
    return l;
  }
  const titreNiveau = () => (global.Config.estEcole() || etat.niveau === 'ecole') ? ((App().data.ecoles.find(e => String(e.id) === String(etat.ecole)) || {}).nom || 'École')
    : etat.niveau === 'zone' ? etat.zone : etat.niveau === 'up' ? 'UP ' + etat.up : 'Circonscription Scolaire de POBÈ';
  const cell = (v, k) => (v === null || v === undefined ? '' : (k === 'pF' || k === 'parClasse' || k === 'parEns' ? String(v).replace('.', ',') : Number(v).toLocaleString('fr-FR')));

  function tableSynoptique(ecoles) {
    const cols = COLONNES.map(([k, l, f]) => ({ k, l, ind: indicateurs(ecoles.filter(f), etat.annee) }));
    let s = '<table class="syn-t"><thead><tr><th class="syn-l">Indicateur</th>' + cols.map(c => `<th>${esc(c.l)}</th>`).join('') + '</tr></thead><tbody>';
    for (const [k, l] of LIGNES) s += `<tr${GRAS.has(k) ? ' class="tot"' : ''}><td class="syn-l">${esc(l)}</td>` + cols.map(c => `<td>${cell(c.ind[k], k)}</td>`).join('') + '</tr>';
    return s + '</tbody></table>';
  }
  function tableRepartition(ecoles, cle, titre) {
    const g = new Map(); ecoles.forEach(e => { const k = e[cle] || '— non renseigné —'; if (!g.has(k)) g.set(k, []); g.get(k).push(e); });
    const lignes = [...g.entries()].sort((a, b) => a[0].localeCompare(b[0], 'fr', { numeric: true })).map(([k, l]) => ({ k, i: indicateurs(l, etat.annee) }));
    let s = `<table class="syn-t"><thead><tr><th class="syn-l">${esc(titre)}</th><th>Écoles</th><th>Classes</th><th>Enseignants</th><th>Filles</th><th>Garçons</th><th>Total élèves</th><th>Élèves / classe</th></tr></thead><tbody>`;
    for (const o of lignes) s += `<tr><td class="syn-l">${esc(o.k)}</td><td>${o.i.ecoles}</td><td>${o.i.clExi}</td><td>${o.i.ens}</td><td>${o.i.F}</td><td>${o.i.G}</td><td><b>${o.i.T}</b></td><td>${cell(o.i.parClasse, 'parClasse')}</td></tr>`;
    const t = indicateurs(ecoles, etat.annee);
    return s + `<tr class="tot"><td class="syn-l">TOTAL</td><td>${t.ecoles}</td><td>${t.clExi}</td><td>${t.ens}</td><td>${t.F}</td><td>${t.G}</td><td>${t.T}</td><td>${cell(t.parClasse, 'parClasse')}</td></tr></tbody></table>`;
  }

  function rendu() {
    const page = document.getElementById('synoptique'); if (!page) return;
    const d = App().data, estEc = global.Config.estEcole();
    const annees = [...new Set([App().anneeActive(), ...d.effectifs.map(r => r.annee).filter(Boolean)])].sort().reverse();
    if (!etat.annee || annees.indexOf(etat.annee) < 0) etat.annee = annees[0];
    const zones = [...new Set([...global.Donnees.ZONES, ...d.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    const ups = [...new Set(d.ecoles.map(e => e.unite_ped).filter(Boolean))].sort();
    const noms = d.ecoles.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    if (!etat.zone || zones.indexOf(etat.zone) < 0) etat.zone = zones[0] || '';
    if (!etat.up || ups.indexOf(etat.up) < 0) etat.up = ups[0] || '';
    if (!etat.ecole || !noms.some(e => String(e.id) === String(etat.ecole))) etat.ecole = noms[0] ? String(noms[0].id) : '';
    if (estEc) etat.niveau = 'ecole';
    const ecoles = filtrer(); derniere = ecoles;
    const sel = (cle, opts, w) => h('select', { style: { maxWidth: w || '230px', padding: '8px', border: '1px solid #cbd5e1', borderRadius: '6px' }, onchange: (e) => { etat[cle] = e.target.value; rendu(); } },
      opts.map(([v, l]) => h('option', { value: v, selected: String(etat[cle]) === String(v) }, l)));
    const niv = [['cs', '🏛️ Circonscription'], ['zone', '📍 Zone'], ['up', '👥 Unité pédagogique'], ['ecole', '🏫 École']];
    const barre = h('div', { class: 'xbar no-print' }, ...(estEc ? [] : niv.map(([k, l]) => h('button', { class: 'btn btn-sm ' + (etat.niveau === k ? 'btn-primary' : ''), onclick: () => { etat.niveau = k; rendu(); } }, l))),
      sel('annee', annees.map(a => [a, 'Année ' + a]), '170px'),
      ...(!estEc && etat.niveau === 'zone' ? [sel('zone', zones.map(z => [z, z]))] : []), ...(!estEc && etat.niveau === 'up' ? [sel('up', ups.map(u => [u, u]))] : []),
      ...(!estEc && etat.niveau === 'ecole' ? [sel('ecole', noms.map(e => [String(e.id), e.nom]), '320px')] : []));
    const actions = h('div', { class: 'xbar no-print' }, h('button', { class: 'btn btn-primary', onclick: imprimer }, '🖨️ Imprimer / PDF'), h('button', { class: 'btn btn-info', onclick: excel }, '⬇ Excel'));
    const entete = h('div', { class: 'text-center syn-entete' }, h('b', null, 'RÉPUBLIQUE DU BÉNIN'), h('div', null, 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE'), h('div', null, 'CIRCONSCRIPTION SCOLAIRE DE POBÈ'),
      h('h3', { style: { margin: '6px 0 0' } }, 'TABLEAU SYNOPTIQUE'), h('div', null, titreNiveau() + ' — Année scolaire ' + etat.annee));
    const t1 = h('div', { class: 'syn-scroll' }); t1.innerHTML = tableSynoptique(ecoles);
    const blocs = [entete, t1];
    if (!estEc && (etat.niveau === 'cs')) { const t = h('div', { class: 'syn-scroll' }); t.innerHTML = tableRepartition(ecoles, 'zone_ped', 'Zone pédagogique'); blocs.push(h('h3', { class: 'syn-h' }, 'Répartition par zone pédagogique'), t); }
    if (!estEc && (etat.niveau === 'cs' || etat.niveau === 'zone')) { const t = h('div', { class: 'syn-scroll' }); t.innerHTML = tableRepartition(ecoles, 'unite_ped', 'Unité pédagogique'); blocs.push(h('h3', { class: 'syn-h' }, 'Répartition par unité pédagogique'), t); }
    if (!estEc && etat.niveau === 'cs') { const t = h('div', { class: 'syn-scroll' }); t.innerHTML = tableRepartition(ecoles, 'arrondissement', 'Arrondissement'); blocs.push(h('h3', { class: 'syn-h' }, 'Répartition par arrondissement'), t); }
    blocs.push(h('p', { class: 'xnote' }, 'Calcul automatique à partir des fiches des écoles, du personnel et des relevés d\'effectifs de l\'année choisie. EM : écoles maternelles ; EP : écoles primaires. ' + CREDIT));
    page.replaceChildren(h('div', { class: 'page-title' }, '🗂️ Tableau synoptique'), barre, actions, ...blocs);
  }
  function imprimer() {
    if (!document.getElementById('xpageSyn')) document.head.append(h('style', { id: 'xpageSyn' }, '@page { size: A4 landscape; margin: 8mm; } @media print { #synoptique .xbar, #synoptique select { display: none !important; } }'));
    window.print();
  }
  function excel() {
    const css = 'table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #444;padding:3px 6px;text-align:center}th{background:#006633;color:#fff}.syn-l{text-align:left}.tot td{background:#d9eadf;font-weight:bold}';
    let html = `<h3>RÉPUBLIQUE DU BÉNIN — MEMP — Circonscription Scolaire de POBÈ</h3><h3>Tableau synoptique — ${esc(titreNiveau())} — ${esc(etat.annee)}</h3>` + tableSynoptique(derniere);
    if (!global.Config.estEcole() && etat.niveau === 'cs') html += '<br>' + tableRepartition(derniere, 'zone_ped', 'Zone pédagogique');
    if (!global.Config.estEcole() && (etat.niveau === 'cs' || etat.niveau === 'zone')) html += '<br>' + tableRepartition(derniere, 'unite_ped', 'Unité pédagogique');
    saveFile(new Blob(['﻿<html xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + html + `<p>${CREDIT}</p></body></html>`], { type: 'application/vnd.ms-excel' }),
      clean('Tableau_synoptique_' + titreNiveau() + '_' + etat.annee) + '.xls');
  }

  document.head.append(h('style', null, `
    #synoptique .syn-scroll{overflow-x:auto;background:#fff;border-radius:8px;margin:6px 0 14px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #synoptique table.syn-t{border-collapse:collapse;width:100%;font-size:12px}
    #synoptique table.syn-t th{background:#006633;color:#fff;border:1px solid rgba(255,255,255,.4);padding:6px;text-align:center}
    #synoptique table.syn-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center;min-width:64px}
    #synoptique table.syn-t td.syn-l,#synoptique table.syn-t th.syn-l{text-align:left;min-width:230px}
    #synoptique table.syn-t tr.tot td{background:#d9eadf;font-weight:700}
    #synoptique .syn-h{margin:18px 0 4px;color:#006633;font-size:15px}
    #synoptique .syn-entete{margin-bottom:12px;font-size:13px}`));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.synoptique = rendu;
  global.Synoptique = { indicateurs };
})(window);
