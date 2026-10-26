/* République du Bénin — MEMP — CS Pobè
   Infrastructures et mobilier consolidés par école, zone pédagogique et circonscription, secteur public et privé à part :
   salles de classe par état, commodités (compléments des fiches), mobilier du primaire avec places assises et déficit,
   mobilier de la maternelle, manuels par élève. Courbes, impression / PDF, Excel.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const App = () => global.AppBridge, esc = (v) => App().echapper(v);
  const CREDIT = 'Conçu par Maître Aimé FACHE · Tél. 01 96 51 03 33';
  const norm = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const n0 = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  const estMat = (e) => String(e.type || '').indexOf('EM') === 0;
  const estPriv = (e) => String(e.type || '').indexOf('PRIV') > 0;

  const SALLES = [['def_b', 'Définitifs – bon état'], ['def_m', 'Définitifs – mauvais état'], ['mix', 'Murs provisoires, toit définitif'],
    ['prov', 'Provisoires'], ['sans', 'Sans mur ou sans toit']];
  const COMMODITES = [['point_eau', "Point d'eau potable"], ['electrifiee', 'Électricité'], ['latrines', 'Latrines fonctionnelles'],
    ['lavage_mains', 'Lavage des mains'], ['cloture', 'Clôture']];
  const MOB_EP = [['t1', 'Tables + chaises (1 place)'], ['t2', 'Table-bancs 2 places'], ['t3', 'Table-bancs 3 places et +'],
    ['bureau', 'Bureaux du maître'], ['tableau', 'Tableaux'], ['armoire', 'Armoires / placards']];
  const MOB_EM = [['tables_enf', 'Tables pour enfants'], ['chaises_enf', 'Chaises pour enfants'], ['tabourets', 'Tabourets'],
    ['nattes', 'Nattes'], ['tables_jeux', 'Tables de jeux'], ['bureau', 'Bureaux enseignant'], ['armoire', 'Armoires / placards']];
  const MANUELS = [['fr', 'Manuels de français'], ['ma', 'Manuels de mathématiques']];
  const PAL = ['#0369a1', '#be185d', '#15803d', '#6d28d9', '#b45309', '#0f766e'];

  /* ---------------- Classement des saisies ---------------- */
  function classeSalle(i) {
    const m = norm(i.natureMurs), t = norm(i.natureToit), e = norm(i.etat);
    if (m.indexOf('sans') === 0 || t.indexOf('sans') === 0) return 'sans';
    const toitDef = /tole|tuile|fibro|dalle/.test(t) || !t;
    if (m.indexOf('en dur') === 0 && toitDef) return e.indexOf('mauvais') === 0 ? 'def_m' : 'def_b';
    if (toitDef && m) return 'mix';
    return 'prov';
  }
  /** Mobilier : clé normalisée d'après la désignation (texte libre) et la catégorie. */
  function classeMobilier(m) {
    const d = norm(m.designation), c = norm(m.categorie);
    if (c.indexOf('manuel') === 0 || /manuel/.test(d)) return /math/.test(d) ? 'man:ma' : (/fran/.test(d) ? 'man:fr' : null);
    if (/banc/.test(d)) return /(^|\D)2\s*pl/.test(d) || /deux/.test(d) ? 'ep:t2' : 'ep:t3';
    if (/tabouret/.test(d)) return 'em:tabourets';
    if (/natte/.test(d)) return 'em:nattes';
    if (/table.*jeu/.test(d)) return 'em:tables_jeux';
    if (/(table|chaise).*enfant/.test(d)) return /chaise/.test(d) && !/table/.test(d) ? 'em:chaises_enf' : 'em:tables_enf';
    if (/table/.test(d) && /chaise/.test(d)) return 'ep:t1';
    if (/bureau/.test(d)) return 'x:bureau';
    if (/armoire|placard/.test(d)) return 'x:armoire';
    if (/tableau/.test(d)) return 'ep:tableau';
    if (/chaise/.test(d) && c.indexOf('eleve') >= 0) return 'em:chaises_enf';
    return null;
  }
  const oui = (v) => { const s = norm(v); return s === 'oui' ? true : s === 'non' ? false : null; };

  function vide() {
    return { ecoles: 0, ep: 0, em: 0, eleves_ep: 0, eleves_em: 0, salles: Object.fromEntries(SALLES.map(([k]) => [k, 0])),
      com: Object.fromEntries(COMMODITES.map(([k]) => [k, [0, 0]])), blocs: 0, cabines: 0,
      mob_ep: Object.fromEntries(MOB_EP.map(([k]) => [k, 0])), mob_em: Object.fromEntries(MOB_EM.map(([k]) => [k, 0])),
      man: { fr: 0, ma: 0 }, mauvais: 0 };
  }
  function ajouterEcole(x, e, annee) {
    const d = App().data, mat = estMat(e);
    x.ecoles++; x[mat ? 'em' : 'ep']++;
    const r = d.effectifs.find(y => String(y.ecoleId) === String(e.id) && (!y.annee || y.annee === annee));
    if (r) x[mat ? 'eleves_em' : 'eleves_ep'] += n0(r.total) || (n0(r.totalG) + n0(r.totalF));
    for (const i of d.infrastructures.filter(y => String(y.ecoleId) === String(e.id) && norm(y.typeLocal).indexOf('salle de classe') === 0)) x.salles[classeSalle(i)]++;
    for (const m of d.mobilier.filter(y => String(y.ecoleId) === String(e.id))) {
      const k = classeMobilier(m), q = n0(m.quantite); if (!k) continue;
      if (norm(m.etat) === 'mauvais') x.mauvais += q;
      const [grp, cle] = k.split(':');
      if (grp === 'man') x.man[cle] += q;
      else if (grp === 'x') x[mat ? 'mob_em' : 'mob_ep'][cle] += q;
      else if (grp === 'ep' && !mat) x.mob_ep[cle] += q;
      else if (grp === 'em' && mat) x.mob_em[cle] += q;
      else if (grp === 'ep' && mat && cle === 't1') x.mob_em.tables_enf += q;
    }
    const f = (d.fiches || []).find(y => String(y.ecoleId) === String(e.id) && y.annee === annee) || {};
    for (const [k] of COMMODITES) { const v = oui(f[k]); if (v !== null) { x.com[k][1]++; if (v) x.com[k][0]++; } }
    x.blocs += n0(f.latrines_blocs); x.cabines += n0(f.latrines_cabines);
  }
  const ratio = (a, b, dec = 1) => (b ? Math.round(a / b * 10 ** dec) / 10 ** dec : null);
  function indic(x) {
    const s = x.salles, tot = SALLES.reduce((a, [k]) => a + s[k], 0);
    x.salles_tot = tot; x.p_def = ratio(100 * (s.def_b + s.def_m), tot); x.p_mauv = ratio(100 * (s.def_m + s.prov + s.sans), tot);
    x.eleves = x.eleves_ep + x.eleves_em; x.el_salle = ratio(x.eleves, tot);
    x.places_ep = x.mob_ep.t1 + 2 * x.mob_ep.t2 + 3 * x.mob_ep.t3; x.deficit_ep = Math.max(0, x.eleves_ep - x.places_ep); x.el_place_ep = ratio(x.eleves_ep, x.places_ep, 2);
    x.places_em = x.mob_em.chaises_enf + x.mob_em.tabourets; x.deficit_em = Math.max(0, x.eleves_em - x.places_em); x.el_place_em = ratio(x.eleves_em, x.places_em, 2);
    x.man_el = { fr: ratio(x.man.fr, x.eleves_ep, 2), ma: ratio(x.man.ma, x.eleves_ep, 2) };
    x.p_com = Object.fromEntries(COMMODITES.map(([k]) => [k, ratio(100 * x.com[k][0], x.com[k][1])]));
    return x;
  }

  /* ---------------- Page ---------------- */
  const etat = { annee: '', niveau: 'cs', zone: '', ecole: '' };
  let derniere = null;
  function calcul() {
    const d = App().data, estEc = global.Config.estEcole();
    let list = d.ecoles.slice();
    if (!estEc && etat.niveau === 'zone') list = list.filter(e => (e.zone_ped || '') === etat.zone);
    if (!estEc && etat.niveau === 'ecole') list = list.filter(e => String(e.id) === String(etat.ecole));
    const parGroupe = etat.niveau === 'cs' && !estEc ? (e) => e.zone_ped || 'Sans zone' : (e) => e.nom;
    const grp = new Map(), tot = { nom: 'TOTAL', pub: vide(), prv: vide() };
    for (const e of list.sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))) {
      const k = parGroupe(e); if (!grp.has(k)) grp.set(k, { nom: k, pub: vide(), prv: vide() });
      const s = estPriv(e) ? 'prv' : 'pub';
      ajouterEcole(grp.get(k)[s], e, etat.annee); ajouterEcole(tot[s], e, etat.annee);
    }
    const g = [...grp.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
    for (const x of [...g, tot]) { indic(x.pub); indic(x.prv); }
    return { grp: g, tot, lib: etat.niveau === 'cs' && !estEc ? 'Zone pédagogique' : 'École' };
  }
  const f1 = (v, d = 1) => (v === null || v === undefined ? '—' : v.toFixed(d).replace('.', ','));
  const pc = (v) => (v === null || v === undefined ? '—' : f1(v) + ' %');

  function tableau(c, s, titre, entetes, cellules, filtre) {
    const rows = [...c.grp, c.tot].filter(g => g[s].ecoles && (!filtre || filtre(g[s])));
    return `<h4 class="inf-h">${esc(titre)}</h4><div class="inf-scroll"><table class="inf-t"><thead><tr><th class="inf-l">${esc(c.lib)}</th>${entetes.map(t => `<th>${esc(t)}</th>`).join('')}</tr></thead><tbody>`
      + rows.map(g => `<tr${g === c.tot ? ' class="tot"' : ''}><td class="inf-l">${esc(g.nom)}</td>${cellules(g[s]).join('')}</tr>`).join('') + '</tbody></table></div>';
  }
  const td = (v, cl) => `<td${cl ? ` class="${cl}"` : ''}>${v}</td>`;
  function courbe(titre, labels, series) {
    return global.EffCourbe ? global.EffCourbe({ titre, labels, series }) : '';
  }
  function htmlSecteur(c, s) {
    const g = c.grp.filter(x => x[s].ecoles), labels = g.map(x => x.nom);
    let h = tableau(c, s, '1. Salles de classe', [...SALLES.map(([, l]) => l), 'Total', '% définitifs', '% mauvais état / précaires', 'Élèves', 'Élèves par salle'],
      (x) => [...SALLES.map(([k]) => td(x.salles[k])), td('<b>' + x.salles_tot + '</b>'), td(pc(x.p_def), 'ind'), td(pc(x.p_mauv), 'ind' + (x.p_mauv >= 30 ? ' alerte' : '')),
        td(x.eleves), td(f1(x.el_salle), 'ind' + (x.el_salle > 60 ? ' alerte' : ''))]);
    h += courbe('Salles de classe', labels, [{ nom: 'Définitifs', color: PAL[2], values: g.map(x => x[s].salles.def_b + x[s].salles.def_m) },
      { nom: 'Provisoires / mixtes', color: PAL[4], values: g.map(x => x[s].salles.prov + x[s].salles.mix) }, { nom: 'Sans mur ou sans toit', color: PAL[1], values: g.map(x => x[s].salles.sans) }]);
    h += tableau(c, s, '2. Commodités (écoles qui en disposent / écoles ayant répondu)', [...COMMODITES.flatMap(([, l]) => [l, '%']), 'Blocs de latrines', 'Cabines'],
      (x) => [...COMMODITES.flatMap(([k]) => [td(x.com[k][0] + '<small>/' + x.com[k][1] + '</small>'), td(pc(x.p_com[k]), 'ind')]), td(x.blocs), td(x.cabines)]);
    h += tableau(c, s, '3. Mobilier du primaire et places assises', [...MOB_EP.map(([, l]) => l), 'Places assises', 'Élèves', 'Déficit de places', 'Élèves par place'],
      (x) => [...MOB_EP.map(([k]) => td(x.mob_ep[k])), td('<b>' + x.places_ep + '</b>'), td(x.eleves_ep), td(x.deficit_ep, 'ind' + (x.deficit_ep ? ' alerte' : '')), td(f1(x.el_place_ep, 2), 'ind')], (x) => x.ep);
    h += courbe('Places assises (primaire)', labels, [{ nom: 'Élèves', color: PAL[0], values: g.map(x => x[s].eleves_ep) },
      { nom: 'Places assises', color: PAL[2], values: g.map(x => x[s].places_ep) }, { nom: 'Déficit', color: PAL[1], values: g.map(x => x[s].deficit_ep) }]);
    h += tableau(c, s, '4. Mobilier de la maternelle', [...MOB_EM.map(([, l]) => l), 'Places (chaises + tabourets)', 'Enfants', 'Déficit', 'Enfants par place'],
      (x) => [...MOB_EM.map(([k]) => td(x.mob_em[k])), td('<b>' + x.places_em + '</b>'), td(x.eleves_em), td(x.deficit_em, 'ind' + (x.deficit_em ? ' alerte' : '')), td(f1(x.el_place_em, 2), 'ind')], (x) => x.em);
    h += tableau(c, s, '5. Manuels du primaire', [...MANUELS.map(([, l]) => l), 'Élèves du primaire', ...MANUELS.map(([, l]) => l + ' par élève')],
      (x) => [...MANUELS.map(([k]) => td(x.man[k])), td(x.eleves_ep), ...MANUELS.map(([k]) => td(f1(x.man_el[k], 2), 'ind' + (x.man_el[k] !== null && x.man_el[k] < 1 ? ' alerte' : '')))], (x) => x.ep);
    return h;
  }
  function rendu() {
    const page = document.getElementById('infraZone'); if (!page) return;
    const d = App().data, estEc = global.Config.estEcole();
    const annees = [...new Set([App().anneeActive(), ...d.effectifs.map(r => r.annee).filter(Boolean)])].sort().reverse();
    if (!etat.annee || annees.indexOf(etat.annee) < 0) etat.annee = annees[0];
    const zones = [...new Set([...(global.Donnees.ZONES || []), ...d.ecoles.map(e => e.zone_ped).filter(Boolean)])];
    if (!etat.zone || zones.indexOf(etat.zone) < 0) etat.zone = zones[0] || '';
    const ecs = d.ecoles.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));
    if (!etat.ecole || !ecs.some(e => String(e.id) === String(etat.ecole))) etat.ecole = ecs[0] ? String(ecs[0].id) : '';
    const c = calcul(); derniere = c;
    const opt = (cle, opts) => `<select data-cle="${cle}">${opts.map(([v, l]) => `<option value="${esc(v)}"${String(etat[cle]) === String(v) ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
    const niv = estEc ? '' : [['cs', '🏛️ Circonscription (par zone)'], ['zone', '📍 Zone pédagogique (par école)'], ['ecole', '🏫 École']]
      .map(([k, l]) => `<button class="btn btn-sm ${etat.niveau === k ? 'btn-primary' : ''}" data-niv="${k}">${l}</button>`).join(' ');
    let html = `<div class="page-title">🏗️ Infrastructures et mobilier</div><div class="xbar no-print">${niv} ${opt('annee', annees.map(a => [a, 'Année ' + a]))}`
      + (!estEc && etat.niveau === 'zone' ? opt('zone', zones.map(z => [z, z])) : '') + (!estEc && etat.niveau === 'ecole' ? opt('ecole', ecs.map(e => [String(e.id), e.nom])) : '')
      + `</div><div class="xbar no-print"><button class="btn btn-primary" data-act="print">🖨️ Imprimer / PDF</button> <button class="btn btn-info" data-act="xls">⬇ Excel</button></div>`
      + '<div class="text-center" style="font-size:13px;margin:8px 0"><b>RÉPUBLIQUE DU BÉNIN</b><br>MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>CIRCONSCRIPTION SCOLAIRE DE POBÈ<h3 style="margin:6px 0 0">INFRASTRUCTURES ET MOBILIER</h3>Année scolaire ' + esc(etat.annee) + '</div>'
      + '<p class="xnote">Sources : modules « Infrastructures » (une ligne par local) et « Mobilier &amp; matériel » (désignation et quantité), compléments des fiches officielles (eau, électricité, latrines, lavage des mains, clôture), relevés d\'effectifs. Places assises = tables + chaises × 1 + table-bancs 2 places × 2 + table-bancs 3 places et plus × 3.</p>';
    for (const [s, lib, coul] of [['pub', 'Secteur public', '#006633'], ['prv', 'Secteur privé (à part)', '#8e44ad']]) {
      if (!c.tot[s].ecoles) continue;
      const t = c.tot[s];
      html += `<h3 class="inf-sect" style="color:${coul};border-color:${coul}">${lib} — ${t.ecoles} école(s) · ${t.salles_tot} salle(s) · ${t.places_ep} places assises (déficit ${t.deficit_ep})</h3>` + htmlSecteur(c, s);
    }
    html += `<p class="xnote">${CREDIT}</p>`;
    page.innerHTML = html;
    page.querySelectorAll('select[data-cle]').forEach(sel => sel.addEventListener('change', () => { etat[sel.dataset.cle] = sel.value; rendu(); }));
    page.querySelectorAll('button[data-niv]').forEach(b => b.addEventListener('click', () => { etat.niveau = b.dataset.niv; rendu(); }));
    page.querySelector('[data-act="print"]').addEventListener('click', () => window.print());
    page.querySelector('[data-act="xls"]').addEventListener('click', exporter);
  }
  function sansGraphiques(html) { const d = document.createElement('div'); d.innerHTML = html; d.querySelectorAll('.gchoix, svg').forEach(x => x.remove()); return d.innerHTML; }
  function exporter() {
    if (!derniere) return;
    const c = derniere, css = 'table{border-collapse:collapse;font-family:Arial;font-size:10pt}td,th{border:1px solid #444;padding:3px 6px;text-align:center}th{background:#006633;color:#fff}.inf-l{text-align:left}.tot td{background:#d9eadf;font-weight:bold}';
    const corps = ['pub', 'prv'].filter(s => c.tot[s].ecoles).map(s => `<h2>${s === 'pub' ? 'Secteur public' : 'Secteur privé'}</h2>` + sansGraphiques(htmlSecteur(c, s))).join('');
    const html = `<h3>RÉPUBLIQUE DU BÉNIN — MEMP — Circonscription Scolaire de POBÈ</h3><h3>Infrastructures et mobilier — ${esc(etat.annee)}</h3>${corps}<p>${CREDIT}</p>`;
    const a = document.createElement('a');
    a.href = URL.createObjectURL(window.XlsxEcrire.depuisHtmlBlob('﻿<html><head><meta charset="utf-8"><style>' + css + '</style></head><body>' + html + '</body></html>'));
    a.download = 'Infrastructures_mobilier_' + etat.annee + '.xlsx'; document.body.append(a); a.click(); setTimeout(() => a.remove(), 1500);
  }
  document.head.append(Object.assign(document.createElement('style'), { textContent: `
    #infraZone .inf-scroll{overflow-x:auto;background:#fff;border-radius:8px;margin:6px 0 12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    #infraZone table.inf-t{border-collapse:collapse;width:100%;font-size:12px}
    #infraZone table.inf-t th{background:#006633;color:#fff;border:1px solid rgba(255,255,255,.4);padding:5px 6px;text-align:center}
    #infraZone table.inf-t td{border:1px solid #e2e8f0;padding:4px 6px;text-align:center}
    #infraZone .inf-l{text-align:left!important;min-width:170px}
    #infraZone tr.tot td{background:#d9eadf;font-weight:700}
    #infraZone td.ind{background:#fff8e1;font-weight:700}
    #infraZone td.alerte{color:#b42318}
    #infraZone .inf-h{margin:14px 0 4px;color:#006633;font-size:14px}
    #infraZone .inf-sect{margin:22px 0 6px;border-bottom:3px solid;padding-bottom:4px}
    #infraZone select{padding:7px;border:1px solid #cbd5e1;border-radius:6px;margin-left:6px;max-width:280px}
    #infraZone svg.courbe{background:#fff;border-radius:8px;margin:4px 0 10px}` }));
  global.Extra = global.Extra || { pages: {} }; global.Extra.pages.infraZone = rendu;
  global.InfraZone = { classeSalle, classeMobilier, calcul: () => calcul(), etat };
})(window);
