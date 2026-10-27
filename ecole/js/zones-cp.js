/* République du Bénin — MEMP — CS Pobè — v2.4.0
   1. Espace CP de zone : « Écoles de la zone » en deux tableaux (écoles publiques, puis écoles privées laïques et
      confessionnelles) : N° d'ordre, nom de l'école, arrondissement, ville / village, nom et prénoms du directeur,
      contact. Zone d'appartenance de l'école (zone_ped). Écoles ne fonctionnant plus exclues (elles ne sont plus
      dans la liste des écoles actives). Impression / PDF et Excel.
   2. Personnel enseignant par zone, section et cours : chaque enseignant est rangé dans la zone de son école, à
      défaut dans la zone saisie sur sa fiche ; sans zone, il reste dans « Personnel de la CS (zone à attribuer) »
      jusqu'à ce qu'on lui en attribue une. Rubriques : petite section, grande section (maternelle), CI → CM2, sans
      classe / autres fonctions ; H / F / T par rubrique, par zone et pour la CS ; listes nominatives ; Excel.
   Conception : Maître Aimé FACHE — Tél. 01 96 51 03 33 */
(function (global) {
  'use strict';
  const A = () => global.AppBridge, esc = (v) => A().echapper(v == null ? '' : v);
  const ZONES = () => global.Donnees.ZONES;
  const SANS_ZONE = 'Personnel de la CS (zone à attribuer)';
  const RUBRIQUES = [
    ['PS', 'Petite section (maternelle)', p => /^petit/i.test(p.cours || '')],
    ['GS', 'Grande section (maternelle)', p => /^grand/i.test(p.cours || '')],
    ['CI', 'Cours d’initiation (CI)', p => p.cours === 'CI'], ['CP', 'Cours préparatoire (CP)', p => p.cours === 'CP'],
    ['CE1', 'Cours élémentaire 1re année (CE1)', p => p.cours === 'CE1'], ['CE2', 'Cours élémentaire 2e année (CE2)', p => p.cours === 'CE2'],
    ['CM1', 'Cours moyen 1re année (CM1)', p => p.cours === 'CM1'], ['CM2', 'Cours moyen 2e année (CM2)', p => p.cours === 'CM2'],
    ['AUTRE', 'Sans classe / autres fonctions', () => true]
  ];
  const rubriqueDe = (p) => RUBRIQUES.find(r => r[2](p))[0];
  const ecoleDe = (p) => A().data.ecoles.find(e => e.id == p.ecoleId);
  /** Zone d'un agent : celle de son école (zone d'appartenance), à défaut celle de sa fiche. */
  function zoneAgent(p) {
    const e = ecoleDe(p);
    return (e && e.zone_ped) || p.zone || '';
  }
  const estEnseignant = (p) => ['Enseignant', 'Éducateur'].indexOf(p.categorie || 'Enseignant') >= 0;
  const actif = (p) => !global.Carriere || global.Carriere.estActif(p);
  const enseignants = () => A().data.personnel.filter(p => estEnseignant(p) && actif(p));
  const publique = (e) => e.type === 'EPP' || e.type === 'EM' || /^public/i.test(e.statut || '');
  const normNom = (t) => String(t || '').normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/Œ/g, 'OE')
    .replace(/[^A-Z0-9/]+/g, ' ').replace(/\b(EPP|EPM|EPV|EP|EM|ECOLE|LE|LA|LES|L|DE|DU|D|DES|ET)\b/g, ' ').replace(/\s+/g, '');
  const maternelle = (e) => /^EM/.test(e.type || '') || /^EM\b/i.test(e.nom || '');
  /** Directeur : fiche de l'école, sinon l'agent « Directeur » de l'école, sinon la liste DDEMP (marquée). */
  function directeurDe(e) {
    if (e.directeur) return { nom: e.directeur, source: '' };
    const d = A().data.personnel.find(p => p.ecoleId == e.id && /^direct/i.test(p.fonction || '') && actif(p));
    if (d) return { nom: d.nom, source: 'fiche du personnel' };
    const l = global.DIRECTEURS_POBE || {}, k = (maternelle(e) ? 'M:' : 'P:') + normNom(e.nom);
    return l[k] ? { nom: l[k], source: 'liste DDEMP 2024' } : { nom: '', source: '' };
  }
  const contactDe = (e) => e.contact_directeur || e.telephone_directeur || e.contact || e.telephone || '';
  const tri = (a, b) => String(a.nom || '').localeCompare(String(b.nom || ''), 'fr');
  const hfm = (l) => ({ H: l.filter(p => p.sexe === 'M').length, F: l.filter(p => p.sexe === 'F').length, T: l.length });
  const date = () => new Date().toLocaleDateString('fr-FR');

  function fenetre(titre, corps, feuilles, nomFichier) {
    A().openModal(titre, '<div class="xbar no-print"><button class="btn btn-primary" type="button" id="zcpImprimer">🖨️ Imprimer / PDF</button> '
      + '<button class="btn btn-info" type="button" id="zcpExcel">📊 Excel</button></div>'
      + '<div class="page-a4 zcp-doc">' + A().enteteDocument({}) + corps
      + '<p style="margin-top:14px">Pobè, le ' + date() + '</p></div>');
    document.getElementById('zcpImprimer').onclick = () => { document.body.classList.add('bilan-print'); window.print(); setTimeout(() => document.body.classList.remove('bilan-print'), 1500); };
    document.getElementById('zcpExcel').onclick = () => A().telecharger(nomFichier + '.xlsx', global.XlsxEcrire.classeur(feuilles()),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  }

  /* ============================================================ 1. écoles de la zone */
  function ecolesZone(zone) {
    const l = A().data.ecoles.filter(e => (e.zone_ped || '') === zone).sort(tri);
    return { pub: l.filter(publique), prv: l.filter(e => !publique(e)) };
  }
  const COLS_ECOLES = ['N° d’ordre', 'Nom de l’école', 'Arrondissement', 'Ville / village', 'Nom et prénoms du directeur', 'Contact'];
  const ligneEcole = (e, i) => [i + 1, e.nom || '', e.arrondissement || '', e.village || e.localite || '', directeurDe(e).nom, contactDe(e)];

  function tableEcoles(liste, titre, edition) {
    const crayon = (e, t) => edition ? ' <button class="btn btn-sm no-print zcp-comp" onclick="openEcoleModal(\'' + esc(e.id) + '\')" title="' + esc(t) + '">✏️</button>' : '';
    const cellule = (e, v, j) => {
      if (j === 0) return '<td class="c">' + esc(v) + '</td>';
      if (j === 4 && v && directeurDe(e).source)
        return '<td>' + esc(v) + ' <small class="muet">(' + esc(directeurDe(e).source) + ')</small>' + crayon(e, 'À confirmer dans la fiche de l’école') + '</td>';
      if (v === '' && j >= 3) return '<td>' + crayon(e, 'Compléter la fiche de l’école') + '</td>';
      return '<td>' + esc(v) + '</td>';
    };
    const corps = liste.map((e, i) => '<tr>' + ligneEcole(e, i).map((v, j) => cellule(e, v, j)).join('') + '</tr>').join('')
      || '<tr><td colspan="6" class="text-center">Aucune école</td></tr>';
    return '<h4 class="zcp-titre">' + esc(titre) + ' — ' + liste.length + ' école(s)</h4>'
      + '<div class="table-container"><div class="table-scroll"><table class="zcp-t"><thead><tr>' + COLS_ECOLES.map(c => '<th>' + esc(c) + '</th>').join('')
      + '</tr></thead><tbody>' + corps + '</tbody></table></div></div>';
  }
  /** Bloc pour l'espace CP de la zone (HTML). */
  function blocEcoles(zone) {
    const { pub, prv } = ecolesZone(zone);
    return '<div class="xbar no-print"><button class="btn btn-primary btn-sm" onclick="ZonesCP.imprimerEcoles(\'' + esc(zone) + '\')">🖨️ Imprimer / PDF</button>'
      + '<button class="btn btn-info btn-sm" onclick="ZonesCP.excelEcoles(\'' + esc(zone) + '\')">📊 Excel</button></div>'
      + '<p class="xnote">' + (pub.length + prv.length) + ' école(s) en activité dans la ' + esc(zone) + ' : ' + pub.length + ' publique(s), ' + prv.length
      + ' privée(s). Les écoles ne fonctionnant plus n’y figurent pas.</p>'
      + tableEcoles(pub, 'Écoles publiques', true) + tableEcoles(prv, 'Écoles privées (laïques et confessionnelles)', true);
  }
  const feuillesEcoles = (zone) => {
    const { pub, prv } = ecolesZone(zone);
    const f = (nom, liste) => ({ nom, lignes: [['CIRCONSCRIPTION SCOLAIRE DE POBÈ — ' + zone.toUpperCase()], [nom + ' — ' + liste.length + ' école(s)'], [], COLS_ECOLES, ...liste.map(ligneEcole)], entete: 3 });
    return [f('Écoles publiques', pub), f('Écoles privées', prv)];
  };
  function imprimerEcoles(zone) {
    const { pub, prv } = ecolesZone(zone);
    fenetre('Écoles de la ' + zone, '<h2 class="titre-a4">ÉCOLES DE LA ' + esc(zone.toUpperCase()) + '</h2>'
      + tableEcoles(pub, 'Écoles publiques', false) + tableEcoles(prv, 'Écoles privées (laïques et confessionnelles)', false)
      + '<p><b>Total : ' + (pub.length + prv.length) + ' école(s)</b></p>', () => feuillesEcoles(zone), 'Ecoles_' + zone.replace(/\W+/g, '_'));
  }
  const excelEcoles = (zone) => A().telecharger('Ecoles_' + zone.replace(/\W+/g, '_') + '.xlsx', global.XlsxEcrire.classeur(feuillesEcoles(zone)),
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  /* ============================================================ 2. personnel par zone, section et cours */
  function repartition() {
    const parZone = {};
    [...ZONES(), SANS_ZONE].forEach(z => { parZone[z] = {}; RUBRIQUES.forEach(r => { parZone[z][r[0]] = []; }); });
    enseignants().forEach(p => {
      let z = zoneAgent(p); if (!parZone[z]) z = SANS_ZONE;
      parZone[z][rubriqueDe(p)].push(p);
    });
    Object.values(parZone).forEach(r => Object.values(r).forEach(l => l.sort(tri)));
    return parZone;
  }
  const libFonction = (p) => [p.fonction, p.cours && rubriqueDe(p) === 'AUTRE' ? p.cours : ''].filter(Boolean).join(' — ');
  function tableauRecap(rep, zones) {
    const tete = '<tr><th rowspan="2">Rubrique</th>' + zones.map(z => '<th colspan="3" class="c">' + esc(z) + '</th>').join('') + '<th colspan="3" class="c">Total</th></tr>'
      + '<tr>' + zones.concat(['T']).map(() => '<th class="c">H</th><th class="c">F</th><th class="c">T</th>').join('') + '</tr>';
    const ligne = (lib, f, gras) => '<tr' + (gras ? ' class="tot"' : '') + '><td>' + (gras ? '<b>' + esc(lib) + '</b>' : esc(lib)) + '</td>'
      + zones.map(z => { const c = hfm(f(z)); return '<td class="c">' + c.H + '</td><td class="c">' + c.F + '</td><td class="c">' + c.T + '</td>'; }).join('')
      + (() => { const c = hfm(zones.flatMap(f)); return '<td class="c"><b>' + c.H + '</b></td><td class="c"><b>' + c.F + '</b></td><td class="c"><b>' + c.T + '</b></td>'; })() + '</tr>';
    const corps = RUBRIQUES.map(([k, lib]) => ligne(lib, z => rep[z][k])).join('') + ligne('Ensemble', z => RUBRIQUES.flatMap(r => rep[z][r[0]]), true);
    return '<div class="table-container"><div class="table-scroll"><table class="zcp-t"><thead>' + tete + '</thead><tbody>' + corps + '</tbody></table></div></div>';
  }
  function listesZone(rep, z, edition) {
    return RUBRIQUES.map(([k, lib]) => {
      const l = rep[z][k]; if (!l.length) return '';
      const c = hfm(l);
      return '<h4 class="zcp-titre">' + esc(lib) + ' — ' + c.T + ' (' + c.H + ' H, ' + c.F + ' F)</h4>'
        + '<div class="table-container"><div class="table-scroll"><table class="zcp-t"><thead><tr><th>N°</th><th>Nom et prénoms</th><th>Sexe</th><th>Statut</th><th>Grade</th><th>Fonction</th><th>École</th><th>Contact</th>'
        + (edition ? '<th class="no-print">Zone</th>' : '') + '</tr></thead><tbody>'
        + l.map((p, i) => '<tr><td class="c">' + (i + 1) + '</td><td><b>' + esc(p.nom) + '</b></td><td class="c">' + esc(p.sexe || '') + '</td><td>' + esc(p.statut || '') + '</td><td>' + esc(p.grade || '')
          + '</td><td>' + esc(libFonction(p)) + '</td><td>' + esc(p.ecoleId ? A().nomEcole(p.ecoleId) : 'Service CS') + '</td><td>' + esc(p.telephone || '') + '</td>'
          + (edition ? '<td class="no-print">' + (z === SANS_ZONE || !ecoleDe(p) || !ecoleDe(p).zone_ped
            ? '<button class="btn btn-warning btn-sm" onclick="ZonesCP.attribuerZone(\'' + esc(p.id) + '\')">📍 ' + (z === SANS_ZONE ? 'Attribuer une zone' : 'Changer') + '</button>'
            : '<span class="petit muet">zone de l’école</span>') + '</td>' : '') + '</tr>').join('')
        + '</tbody></table></div></div>';
    }).join('') || '<p class="xnote">Aucun enseignant dans cette rubrique.</p>';
  }
  /** Bloc pour l'espace CP de la zone (HTML). */
  function blocPersonnel(zone) {
    const rep = repartition();
    return '<div class="xbar no-print"><button class="btn btn-info btn-sm" onclick="ZonesCP.excelPersonnel(\'' + esc(zone) + '\')">📊 Excel</button>'
      + '<button class="btn btn-sm" onclick="showPage(\'personnelZones\')">👥 Toutes les zones</button></div>'
      + tableauRecap(rep, [zone]) + listesZone(rep, zone, true);
  }
  function feuillesPersonnel(zones) {
    const rep = repartition(), out = [];
    out.push({ nom: 'Récapitulatif', entete: 3, lignes: [['CIRCONSCRIPTION SCOLAIRE DE POBÈ — PERSONNEL ENSEIGNANT PAR ZONE, SECTION ET COURS'], ['Situation au ' + date()], [],
      ['Rubrique', ...zones.flatMap(z => [z + ' H', z + ' F', z + ' T']), 'Total H', 'Total F', 'Total T'],
      ...RUBRIQUES.map(([k, lib]) => { const t = hfm(zones.flatMap(z => rep[z][k])); return [lib, ...zones.flatMap(z => { const c = hfm(rep[z][k]); return [c.H, c.F, c.T]; }), t.H, t.F, t.T]; })] });
    zones.forEach(z => {
      const lignes = [[z], [], ['Rubrique', 'N°', 'Nom et prénoms', 'Sexe', 'Statut', 'Grade', 'Fonction', 'École', 'Contact']];
      RUBRIQUES.forEach(([k, lib]) => rep[z][k].forEach((p, i) => lignes.push([lib, i + 1, p.nom || '', p.sexe || '', p.statut || '', p.grade || '', libFonction(p), p.ecoleId ? A().nomEcole(p.ecoleId) : 'Service CS', p.telephone || ''])));
      out.push({ nom: z === SANS_ZONE ? 'Zone à attribuer' : z, lignes, entete: 2 });
    });
    return out;
  }
  const excelPersonnel = (zone) => {
    const zones = zone ? [zone] : [...ZONES(), SANS_ZONE];
    A().telecharger('Personnel_enseignant_' + (zone ? zone.replace(/\W+/g, '_') : 'CS_Pobe') + '.xlsx', global.XlsxEcrire.classeur(feuillesPersonnel(zones)),
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  };

  function attribuerZone(id) {
    const p = A().data.personnel.find(x => x.id == id); if (!p) return;
    A().openModal('Attribuer une zone — ' + p.nom, '<form id="zcpForm"><p class="xnote">L’enseignant est rangé dans la zone de son école. Sans école rattachée à une zone, on lui attribue ici une zone pédagogique.</p>'
      + '<div class="form-group"><label>Zone pédagogique</label><select name="zone"><option value="">— Personnel de la CS (zone à attribuer) —</option>'
      + ZONES().map(z => '<option' + (p.zone === z ? ' selected' : '') + '>' + esc(z) + '</option>').join('') + '</select></div>'
      + '<div class="text-center mt-15"><button type="submit" class="btn btn-primary">💾 Enregistrer</button> <button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button></div></form>');
    document.getElementById('zcpForm').onsubmit = (ev) => {
      ev.preventDefault(); p.zone = new FormData(ev.target).get('zone') || ''; A().saveData(); A().closeModal(); rafraichir();
    };
  }

  /* ---------------- page « Personnel par zone, section et cours » ---------------- */
  let onglet = null;
  function page() {
    const el = document.getElementById('personnelZones'); if (!el) return;
    const zones = [...ZONES(), SANS_ZONE], rep = repartition();
    if (!onglet || zones.indexOf(onglet) < 0) onglet = 'Récapitulatif';
    const nb = (z) => RUBRIQUES.reduce((s, r) => s + rep[z][r[0]].length, 0);
    el.innerHTML = '<div class="page-title">👥 Personnel enseignant par zone, section et cours<span><button class="btn btn-warning" onclick="ZonesCP.excelPersonnel()">📊 Excel</button></span></div>'
      + '<p class="xnote">Chaque enseignant (et éducateur) en poste est rangé dans la zone de son école ; à défaut, dans la zone portée sur sa fiche. Sans zone, il figure dans « ' + SANS_ZONE + ' » en attendant qu’on lui en attribue une. Les rubriques suivent le cours tenu (ou la section en maternelle) saisi dans la fiche de l’agent ou dans l’attribution des classes.</p>'
      + '<div class="tabs no-print">' + ['Récapitulatif', ...zones].map(z => '<button class="tab' + (z === onglet ? ' active' : '') + '" onclick="ZonesCP.onglet(\'' + esc(z) + '\')">' + esc(z)
        + (z === 'Récapitulatif' ? '' : ' (' + nb(z) + ')') + '</button>').join('') + '</div>'
      + (onglet === 'Récapitulatif' ? tableauRecap(rep, zones) : listesZone(rep, onglet, true));
  }
  function rafraichir() {
    if (document.getElementById('personnelZones') && !document.getElementById('personnelZones').classList.contains('hidden')) page();
    if (global.Extra && global.Extra.pages.espacesRafraichir) global.Extra.pages.espacesRafraichir();
  }

  document.head.append(Object.assign(document.createElement('style'), { textContent: `
    .zcp-titre{margin:16px 0 6px;color:#1F4E79;font-size:14.5px}
    table.zcp-t td.c, table.zcp-t th.c{text-align:center}
    table.zcp-t tr.tot td{background:#EEF4FA}
    .zcp-comp{padding:2px 8px}
    .zcp-doc table.zcp-t th{background:#1F4E79;color:#fff}` }));
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.personnelZones = page;
  global.ZonesCP = { blocEcoles, blocPersonnel, imprimerEcoles, excelEcoles, excelPersonnel, attribuerZone, zoneAgent, repartition, RUBRIQUES, SANS_ZONE,
    onglet: (z) => { onglet = z; page(); } };
})(window);
