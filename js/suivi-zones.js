/* République du Bénin — MEMP — CS Pobè
   Suivi et statistiques par zone pédagogique : pour chaque zone (et pour la CS), nombre d'écoles par type, unités
   pédagogiques, directeurs renseignés, enseignants (H / F / T) et élèves (G / F / T) de l'année active ; liste des
   écoles de chaque zone avec leurs manques (directeur, UP, effectifs) ; écoles sans zone. Impression / PDF et Excel.
   Données agrégées issues des écoles, du personnel et des effectifs déjà saisis : rien n'est saisi ici.
   Conception : Maître Aimé FACHOLA — Tél. +229 01 96 51 03 33 */
(function (global) {
  'use strict';
  const A = () => global.AppBridge, esc = (v) => A().echapper(v == null ? '' : v);
  const ZONES = () => global.Donnees.ZONES;
  const SANS = '';                                   // clé des écoles sans zone
  const lib = (z) => z === SANS ? 'Sans zone' : z;
  const n0 = (x) => { const n = parseInt(x, 10); return Number.isFinite(n) && n > 0 ? n : 0; };
  const date = () => new Date().toLocaleDateString('fr-FR');
  const TYPES = [['EPP', 'Écoles primaires publiques'], ['EM', 'Écoles maternelles publiques'], ['EPPRIV', 'Écoles primaires privées'], ['EMPRIV', 'Écoles maternelles privées']];
  const libType = (t) => (TYPES.find(x => x[0] === t) || [0, t || '—'])[1];
  const tri = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
  let onglet = 'Synthèse';

  const annee = () => (A().anneeActive ? A().anneeActive() : '');
  function elevesEcole(e, an) {
    let G = 0, F = 0;
    (A().data.effectifs || []).filter(r => String(r.ecoleId) === String(e.id) && (!an || (r.annee || '') === an)).forEach(r => {
      let g = n0(r.totalG), f = n0(r.totalF);
      if (!g && !f && global.EffZone) { (global.EffZone.CLASSES || []).forEach(c => { g += n0(global.EffZone.val(r, c, 'G')); f += n0(global.EffZone.val(r, c, 'F')); }); }
      G += g; F += f;
    });
    return { G, F, T: G + F };
  }
  function directeur(e) {
    if (global.ZonesCP && global.ZonesCP.directeurDe) return global.ZonesCP.directeurDe(e).nom || '';
    return e.directeur || '';
  }
  /** Calcule, par zone, les indicateurs et la liste des écoles. */
  function calcul() {
    const an = annee(), zs = [...ZONES(), SANS], rep = global.ZonesCP ? global.ZonesCP.repartition() : {};
    const ens = {};                                   // enseignants par école
    Object.keys(rep).forEach(z => Object.values(rep[z]).forEach(l => l.forEach(p => { const k = String(p.ecoleId || ''); (ens[k] = ens[k] || []).push(p); })));
    const out = {};
    zs.forEach(z => { out[z] = { ecoles: [], types: {}, ups: new Set(), dirOk: 0, ensH: 0, ensF: 0, G: 0, F: 0 }; });
    (A().data.ecoles || []).slice().sort(tri).forEach(e => {
      const z = zs.indexOf(e.zone_ped || SANS) >= 0 ? (e.zone_ped || SANS) : SANS, o = out[z], el = elevesEcole(e, an), ee = ens[String(e.id)] || [], d = directeur(e);
      const ligne = { e, d, el, ens: ee.length, up: e.unite_ped || '' };
      o.ecoles.push(ligne); o.types[e.type] = (o.types[e.type] || 0) + 1;
      if (ligne.up) o.ups.add(ligne.up); if (d) o.dirOk++;
      o.ensH += ee.filter(p => p.sexe === 'M').length; o.ensF += ee.filter(p => p.sexe === 'F').length; o.G += el.G; o.F += el.F;
    });
    return { an, zs, out };
  }
  const manques = (l) => [!l.d && 'directeur', !l.up && 'UP', !l.el.T && 'effectifs'].filter(Boolean);

  function lignesSynthese(C) {
    const zs = C.zs.filter(z => z !== SANS || C.out[SANS].ecoles.length), tot = (f) => zs.reduce((s, z) => s + f(C.out[z]), 0);
    const L = [];
    L.push(['Écoles en activité', ...zs.map(z => C.out[z].ecoles.length), tot(o => o.ecoles.length)]);
    TYPES.forEach(([t, nom]) => L.push(['   dont ' + nom.toLowerCase(), ...zs.map(z => C.out[z].types[t] || 0), tot(o => o.types[t] || 0)]));
    const ups = new Set(); zs.forEach(z => C.out[z].ups.forEach(u => ups.add(u)));
    L.push(['Unités pédagogiques (UP) représentées', ...zs.map(z => C.out[z].ups.size), ups.size]);
    L.push(['Directeurs renseignés', ...zs.map(z => C.out[z].dirOk + ' / ' + C.out[z].ecoles.length), tot(o => o.dirOk) + ' / ' + tot(o => o.ecoles.length)]);
    L.push(['Enseignants — hommes', ...zs.map(z => C.out[z].ensH), tot(o => o.ensH)]);
    L.push(['Enseignants — femmes', ...zs.map(z => C.out[z].ensF), tot(o => o.ensF)]);
    L.push(['Enseignants — total', ...zs.map(z => C.out[z].ensH + C.out[z].ensF), tot(o => o.ensH + o.ensF)]);
    L.push(['Élèves — garçons (' + C.an + ')', ...zs.map(z => C.out[z].G), tot(o => o.G)]);
    L.push(['Élèves — filles (' + C.an + ')', ...zs.map(z => C.out[z].F), tot(o => o.F)]);
    L.push(['Élèves — total (' + C.an + ')', ...zs.map(z => C.out[z].G + C.out[z].F), tot(o => o.G + o.F)]);
    return { zs, L };
  }
  function tableSynthese(C) {
    const { zs, L } = lignesSynthese(C);
    return '<div class="table-container"><div class="table-scroll"><table class="zcp-t"><thead><tr><th>Indicateur</th>' + zs.map(z => '<th class="c">' + esc(lib(z)) + '</th>').join('')
      + '<th class="c">Total CS</th></tr></thead><tbody>' + L.map(r => '<tr' + (/^(Écoles en activité|Enseignants — total|Élèves — total)/.test(r[0]) ? ' class="tot"' : '') + '><td>' + esc(r[0]) + '</td>'
        + r.slice(1).map(v => '<td class="c">' + esc(v) + '</td>').join('') + '</tr>').join('') + '</tbody></table></div></div>';
  }
  function tableEcoles(C, z, edition) {
    const l = C.out[z].ecoles;
    const crayon = (e) => edition ? ' <button class="btn btn-sm no-print zcp-comp" onclick="openEcoleModal(\'' + esc(e.id) + '\')" title="Compléter la fiche de l’école"></button>' : '';
    return '<div class="table-container"><div class="table-scroll"><table class="zcp-t"><thead><tr><th>N°</th><th>École</th><th>Type</th><th>UP</th><th>Directeur</th><th class="c">Ens.</th><th class="c">G</th><th class="c">F</th><th class="c">Élèves</th><th>À compléter</th></tr></thead><tbody>'
      + (l.map((x, i) => { const m = manques(x); return '<tr><td class="c">' + (i + 1) + '</td><td><b>' + esc(x.e.nom) + '</b></td><td>' + esc(libType(x.e.type)) + '</td><td>' + esc(x.up || '—') + '</td><td>' + esc(x.d || '—')
        + '</td><td class="c">' + x.ens + '</td><td class="c">' + x.el.G + '</td><td class="c">' + x.el.F + '</td><td class="c">' + x.el.T + '</td><td>' + (m.length ? esc(m.join(', ')) + crayon(x.e) : '<span class="muet">complet</span>') + '</td></tr>'; }).join('')
        || '<tr><td colspan="10" class="text-center">Aucune école</td></tr>') + '</tbody></table></div></div>';
  }
  function anomalies(C) {
    const tous = Object.values(C.out).flatMap(o => o.ecoles), sansDir = tous.filter(x => !x.d), sansUp = tous.filter(x => !x.up), sansZone = C.out[SANS].ecoles;
    const bloc = (t, l) => '<p><b>' + esc(t) + ' (' + l.length + ')</b> : ' + (l.length ? esc(l.map(x => x.e.nom).join(' ; ')) : '<span class="muet">aucune</span>') + '</p>';
    return '<h4 class="zcp-titre">Points à compléter</h4>' + bloc('Écoles sans zone', sansZone) + bloc('Écoles sans directeur renseigné', sansDir) + bloc('Écoles sans UP', sansUp);
  }
  function feuilles() {
    const C = calcul(), { zs, L } = lignesSynthese(C), f = [];
    f.push({ nom: 'Synthèse', entete: 3, lignes: [['CIRCONSCRIPTION SCOLAIRE DE POBÈ — SUIVI PAR ZONE PÉDAGOGIQUE'], ['Année ' + C.an + ' — situation au ' + date()], [], ['Indicateur', ...zs.map(lib), 'Total CS'], ...L] });
    C.zs.forEach(z => { if (z === SANS && !C.out[z].ecoles.length) return;
      f.push({ nom: lib(z), entete: 2, lignes: [[lib(z) + ' — ' + C.out[z].ecoles.length + ' école(s)'], [], ['N°', 'École', 'Type', 'UP', 'Directeur', 'Enseignants', 'Garçons', 'Filles', 'Élèves', 'À compléter'],
        ...C.out[z].ecoles.map((x, i) => [i + 1, x.e.nom || '', libType(x.e.type), x.up, x.d, x.ens, x.el.G, x.el.F, x.el.T, manques(x).join(', ')])] }); });
    return f;
  }
  const excel = () => A().telecharger('Suivi_par_zone_CS_Pobe.xlsx', global.XlsxEcrire.classeur(feuilles()), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  function imprimer() {
    const C = calcul();
    A().openModal('Suivi par zone', '<div class="xbar no-print"><button class="btn btn-primary" type="button" id="szImp"> Imprimer / PDF</button> <button class="btn btn-info" type="button" id="szXls"> Excel</button></div>'
      + '<div class="page-a4 zcp-doc">' + A().enteteDocument({}) + '<h2 class="titre-a4">SUIVI PAR ZONE PÉDAGOGIQUE — ANNÉE ' + esc(C.an) + '</h2>' + tableSynthese(C)
      + C.zs.filter(z => z !== SANS || C.out[z].ecoles.length).map(z => '<h4 class="zcp-titre">' + esc(lib(z)) + ' — ' + C.out[z].ecoles.length + ' école(s)</h4>' + tableEcoles(C, z, false)).join('')
      + anomalies(C) + '<p style="margin-top:14px">Pobè, le ' + date() + '</p></div>');
    document.getElementById('szImp').onclick = () => { document.body.classList.add('bilan-print'); window.print(); setTimeout(() => document.body.classList.remove('bilan-print'), 1500); };
    document.getElementById('szXls').onclick = excel;
  }
  function page() {
    const el = document.getElementById('suiviZones'); if (!el) return;
    const C = calcul(), zs = C.zs.filter(z => z !== SANS || C.out[z].ecoles.length);
    if (onglet !== 'Synthèse' && zs.indexOf(onglet) < 0) onglet = 'Synthèse';
    el.innerHTML = '<div class="page-title"> Suivi et statistiques par zone<span><button class="btn btn-primary" onclick="SuiviZones.imprimer()"> Imprimer / PDF</button> <button class="btn btn-warning" onclick="SuiviZones.excel()"> Excel</button></span></div>'
      + '<p class="xnote">Année ' + esc(C.an) + '. Les chiffres sont calculés à partir des fiches des écoles, du personnel et des effectifs déjà saisis ; une case « À compléter » renvoie à la fiche de l’école.</p>'
      + '<div class="tabs no-print">' + ['Synthèse', ...zs].map(z => '<button class="tab' + (z === onglet ? ' active' : '') + '" onclick="SuiviZones.onglet(\'' + esc(z) + '\')">' + esc(lib(z))
        + (z === 'Synthèse' ? '' : ' (' + C.out[z].ecoles.length + ')') + '</button>').join('') + '</div>'
      + (onglet === 'Synthèse' ? tableSynthese(C) + anomalies(C) : tableEcoles(C, onglet, true));
  }
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.suiviZones = page;
  global.SuiviZones = { calcul, imprimer, excel, onglet: (z) => { onglet = z; page(); } };
})(window);
