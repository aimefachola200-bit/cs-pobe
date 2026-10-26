/* République du Bénin — MEMP — CS Pobè / Mon école
   EducMaster : importation et exportation des élèves et des notes sur les modèles officiels de la plateforme
   (ceux de SCOLARIS / GESCOL, dossier modeles/) :
   * « modèle classe » : une feuille par niveau (CM2, CM1, CE2, CE1, CP, CI, Marternelle 2, Marternelle 1) ;
     Nom, Prénom ( s ), Sexe, Date de naissance, Lieu de naissance, Téléphone de parents, Nationalité, Npi ;
   * « modèle notes du primaire » : feuilles Évaluation formative 1, Évaluation sommative 1 / 2 / 3 ; lignes 1-2 d'en-tête
     (Matricule, Nom, Prénoms fusionnés sur 2 lignes ; chaque matière fusionnée sur « Note obtenue » / « Note perf. »),
     données dès la ligne 3. « Note perf. » = barème (20).
   Importation : rien n'est enregistré avant d'avoir vu le résultat ; élève retrouvé par matricule / NPI puis par nom et
   prénoms ; les lignes non reconnues sont listées.  Conception : Maître Aimé FACHE */
(function (global) {
  'use strict';
  const A = () => global.AppBridge, D = () => A().data, V = () => global.Evaluations;
  const esc = (v) => String(v === null || v === undefined ? '' : v).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const norm = (t) => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
  const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

  /* Modèle des classes : feuilles et niveaux (noms exacts du modèle, y compris « Marternelle »). */
  const FEUILLES_CLASSE = [['CM2', 'CM2'], ['CM1', 'CM1'], ['CE2', 'CE2'], ['CE1', 'CE1'], ['CP', 'CP'], ['CI', 'CI'], ['Marternelle 2', 'Grands'], ['Marternelle 1', 'Petits']];
  const ENTETES_CLASSE = ['Nom', 'Prénom ( s )', 'Sexe', 'Date de naissance', 'Lieu de naissance', 'Téléphone de parents', 'Nationalité', 'Npi'];
  const NATIONALITE = 'Béninoise';
  /* Modèle des notes : matières (intitulés exacts du modèle) -> clés de l'application. */
  const MATIERES_MODELE = [['Dictée', 'dictee'], ['Math', 'maths'], ['Expresion écrite', 'expression_ecrite'], ["Compréhension de l'écrit", 'comprehension'],
    ['EST', 'est'], ['ES', 'es'], ['EA (Oral)', 'ea_vivant'], ['EA (Déssin/Couture)', 'ea_plastique'], ['EPS', 'eps']];
  const RECON_MATIERE = { 'dictee': 'dictee', 'math': 'maths', 'maths': 'maths', 'mathematique': 'maths', 'expresion ecrite': 'expression_ecrite', 'expression ecrite': 'expression_ecrite',
    'comprehension de l ecrit': 'comprehension', 'est': 'est', 'es': 'es', 'ea oral': 'ea_vivant', 'ea dessin couture': 'ea_plastique', 'ea dessin': 'ea_plastique', 'eps': 'eps' };
  const FEUILLES_NOTES = [['Évaluation formative 1', 'FORMATIVE-1'], ['Évaluation sommative 1', 'SOMMATIVE-1'], ['Évaluation sommative 2', 'SOMMATIVE-2'], ['Évaluation sommative 3', 'SOMMATIVE-3']];
  const NOTE_PERF = 20;

  const nomC = (a) => A().nomComplet(a);
  const isoVersFr = (d) => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(d || ''); return m ? m[3] + '/' + m[2] + '/' + m[1] : (d || ''); };
  function frVersIso(v) {
    v = String(v || '').trim(); if (!v) return '';
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v); if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(v); if (m) return m[3] + '-' + m[2].padStart(2, '0') + '-' + m[1].padStart(2, '0');
    if (/^\d{4,6}(\.\d+)?$/.test(v)) { const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(v)) * 86400000); if (!isNaN(d)) return d.toISOString().slice(0, 10); }
    return v;
  }
  const sexeModele = (s) => (/^f/i.test(s || '') ? 'F' : s ? 'M' : '');
  const sexeAppli = (s) => { const t = norm(s); return t === 'f' || t.indexOf('fem') === 0 || t === 'fille' ? 'F' : t ? 'G' : ''; };
  const ecoles = () => D().ecoles.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
  const etat = { ecole: '', cours: '' };
  const ecoleChoisie = () => D().ecoles.find(e => String(e.id) === String(etat.ecole)) || null;
  const eleves = (ecoleId, cours) => D().apprenants.filter(a => String(a.ecoleId) === String(ecoleId) && (!cours || a.cours === cours)).sort((x, y) => nomC(x).localeCompare(nomC(y), 'fr'));
  const fichierNom = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z0-9]+/g, '_').replace(/^_|_$/g, '');

  /* ---------------- exportations ---------------- */
  function exporterEleves() {
    const e = ecoleChoisie(); if (!e) return alert('Choisissez l’école.');
    let total = 0;
    const feuilles = FEUILLES_CLASSE.map(([nom, cours]) => {
      const l = eleves(e.id, cours); total += l.length;
      return { nom, entete: 0, lignes: [ENTETES_CLASSE.map(v => ({ v, s: 'h' }))].concat(l.map(a => [a.nom || '', a.prenoms || '', sexeModele(a.sexe), isoVersFr(a.dateNaiss), a.lieuNaiss || '',
        { v: a.telParent || '', s: 'c', texte: true }, a.nationalite || NATIONALITE, { v: a.npi || '', s: 'c', texte: true }])) };
    });
    if (!total) return alert('Aucun élève à exporter pour cette école.');
    A().telecharger('EducMaster_eleves_' + fichierNom(e.nom) + '_' + A().anneeActive() + '.xlsx', global.XlsxEcrire.classeur(feuilles), XLSX_MIME);
  }
  function exporterNotes() {
    const e = ecoleChoisie(); if (!e) return alert('Choisissez l’école.');
    if (!etat.cours || V().COURS.indexOf(etat.cours) < 0) return alert('Choisissez un cours du primaire (CI à CM2).');
    const liste = eleves(e.id, etat.cours); if (!liste.length) return alert('Aucun élève dans ce cours.');
    const h1 = [{ v: 'Matricule', s: 'h' }, { v: 'Nom', s: 'h' }, { v: 'Prénoms', s: 'h' }], h2 = [{ v: '', s: 'h' }, { v: '', s: 'h' }, { v: '', s: 'h' }];
    const fusions = ['A1:A2', 'B1:B2', 'C1:C2'];
    const col = (n) => { let s = ''; n++; while (n > 0) { const r = (n - 1) % 26; s = String.fromCharCode(65 + r) + s; n = Math.floor((n - 1) / 26); } return s; };
    MATIERES_MODELE.forEach(([lib], i) => { const c = 3 + i * 2; h1.push({ v: lib, s: 'h' }, { v: '', s: 'h' }); h2.push({ v: 'Note obtenue', s: 'h' }, { v: 'Note perf.', s: 'h' }); fusions.push(col(c) + '1:' + col(c + 1) + '1'); });
    let sansMat = 0;
    const feuilles = FEUILLES_NOTES.map(([nom, cle]) => ({ nom, entete: 1, fusions, lignes: [h1, h2].concat(liste.map(a => {
      if (!a.matricule) sansMat++;
      const f = D().notes.find(n => String(n.apprenantId) === String(a.id) && n.periode === cle && n.annee === A().anneeActive()) || {};
      const l = [{ v: a.matricule || '', s: 'c', texte: true }, { v: String(a.nom || '').toUpperCase(), s: 'c' }, { v: a.prenoms || '', s: 'c' }];
      MATIERES_MODELE.forEach(([, k]) => { const n = f[k] === undefined || f[k] === '' ? null : Number(f[k]); l.push({ v: n === null || isNaN(n) ? '' : n, s: 'c' }, { v: n === null || isNaN(n) ? '' : NOTE_PERF, s: 'c' }); });
      return l;
    })) }));
    A().telecharger('EducMaster_notes_' + fichierNom(e.nom + '_' + etat.cours) + '_' + A().anneeActive() + '.xlsx', global.XlsxEcrire.classeur(feuilles), XLSX_MIME);
    if (sansMat) setTimeout(() => alert((sansMat / FEUILLES_NOTES.length) + ' élève(s) sans matricule EducMaster : la colonne « Matricule » reste vide pour eux (à compléter dans la fiche de l’élève).'), 300);
  }

  /* ---------------- importations ---------------- */
  const cleNom = (nom, prenoms) => norm(nom) + '|' + norm(prenoms);
  function trouverEleve(ecoleId, { matricule, npi, nom, prenoms }, cours) {
    const l = D().apprenants.filter(a => String(a.ecoleId) === String(ecoleId));
    const m = String(matricule || '').trim(), n = String(npi || '').trim();
    return (m && l.find(a => String(a.matricule || '').trim() === m)) || (n && l.find(a => String(a.npi || '').trim() === n))
      || l.find(a => cleNom(a.nom, a.prenoms) === cleNom(nom, prenoms) && (!cours || a.cours === cours))
      || l.find(a => cleNom(a.nom, a.prenoms) === cleNom(nom, prenoms))
      || l.find(a => norm(nomC(a)) === norm((nom || '') + ' ' + (prenoms || ''))) || null;
  }
  const niveauDeFeuille = (nom) => { const t = norm(nom); const f = FEUILLES_CLASSE.find(([n]) => norm(n) === t); if (f) return f[1];
    if (/mat?e?rn?ell?e\s*2|grande?s?/.test(t)) return 'Grands'; if (/mat?e?rn?ell?e\s*1|petite?s?/.test(t)) return 'Petits';
    const c = V().COURS.find(x => norm(x) === t); return c || null; };

  function analyserEleves(feuilles, ecoleId) {
    const ops = [], rejets = [];
    feuilles.forEach(f => {
      const cours = niveauDeFeuille(f.nom), lignes = f.lignes || [];
      const hi = lignes.findIndex(l => l.some(v => norm(v) === 'nom'));
      if (hi < 0) return;
      if (!cours) { if (lignes.slice(hi + 1).some(l => l.some(v => String(v).trim()))) rejets.push('Feuille « ' + f.nom + ' » : niveau non reconnu.'); return; }
      const h = lignes[hi].map(norm), c = (...mots) => h.findIndex(x => mots.some(m => x === m || x.indexOf(m) === 0));
      const iN = c('nom'), iP = c('prenom'), iS = c('sexe'), iD = c('date de naissance', 'date'), iL = c('lieu de naissance', 'lieu'), iT = c('telephone'), iNa = c('nationalite'), iNpi = c('npi', 'nip'), iM = c('matricule');
      lignes.slice(hi + 1).forEach((l, k) => {
        const g = (i) => (i >= 0 ? String(l[i] === undefined ? '' : l[i]).trim() : '');
        const v = { nom: g(iN), prenoms: g(iP), sexe: sexeAppli(g(iS)), dateNaiss: frVersIso(g(iD)), lieuNaiss: g(iL), telParent: g(iT), nationalite: g(iNa), npi: g(iNpi), matricule: g(iM), cours };
        if (!v.nom && !v.prenoms) return;
        if (!v.nom || !v.prenoms) { rejets.push(f.nom + ', ligne ' + (hi + k + 2) + ' : nom ou prénoms manquant.'); return; }
        const ex = trouverEleve(ecoleId, v, cours);
        ops.push({ v, ex, feuille: f.nom, ligne: hi + k + 2 });
      });
    });
    return { ops, rejets };
  }
  function appliquerEleves(res, ecoleId) {
    let crees = 0, maj = 0;
    res.ops.forEach(({ v, ex }) => {
      const champs = {}; Object.keys(v).forEach(k => { if (v[k] !== '' && v[k] !== undefined) champs[k] = v[k]; });
      if (ex) { Object.assign(ex, champs); maj++; }
      else { D().apprenants.push(Object.assign({ id: A().uid(), ecoleId, redoublant: 'Non' }, champs)); crees++; }
    });
    A().saveData();
    return { crees, maj };
  }

  function analyserNotes(feuilles, ecoleId, coursFiltre) {
    const ops = [], rejets = [], infos = [];
    feuilles.forEach(f => {
      const t = norm(f.nom), m = /(formative|sommative)\D*(\d+)/.exec(t);
      if (!m) { infos.push('Feuille « ' + f.nom + ' » ignorée (ni formative ni sommative).'); return; }
      const cle = m[1].toUpperCase() + '-' + Number(m[2]);
      if (!V().PERIODES.some(p => p.type + '-' + p.numero === cle)) { rejets.push('Feuille « ' + f.nom + ' » : évaluation inconnue dans l’application.'); return; }
      const lignes = f.lignes || [], hi = lignes.findIndex(l => l.some(v => norm(v) === 'matricule') || l.some(v => norm(v) === 'nom'));
      if (hi < 0) { rejets.push('Feuille « ' + f.nom + ' » : en-tête « Matricule / Nom / Prénoms » introuvable.'); return; }
      const h = lignes[hi].map(norm), iM = h.indexOf('matricule'), iN = h.indexOf('nom'), iP = h.findIndex(x => x.indexOf('prenom') === 0);
      const cols = []; h.forEach((x, j) => { if (RECON_MATIERE[x]) cols.push([j, RECON_MATIERE[x]]); });
      if (!cols.length) { rejets.push('Feuille « ' + f.nom + ' » : aucune matière reconnue.'); return; }
      const debut = lignes[hi + 1] && lignes[hi + 1].some(v => /note/i.test(String(v))) ? hi + 2 : hi + 1;
      lignes.slice(debut).forEach((l, k) => {
        const g = (i) => (i >= 0 ? String(l[i] === undefined ? '' : l[i]).trim() : '');
        const id = { matricule: g(iM), nom: g(iN), prenoms: g(iP) };
        if (!id.matricule && !id.nom) return;
        const notes = {};
        cols.forEach(([j, k2]) => { const s = g(j); if (s === '') return; const n = parseFloat(s.replace(',', '.')); if (isNaN(n)) return;
          const perf = parseFloat(String(l[j + 1] === undefined ? '' : l[j + 1]).replace(',', '.')); notes[k2] = perf > 0 && perf !== 20 ? Math.round(n / perf * 2000) / 100 : n; });
        const a = trouverEleve(ecoleId, id, coursFiltre);
        if (!a) { rejets.push(f.nom + ', ligne ' + (debut + k + 1) + ' : élève introuvable (' + [id.matricule, id.nom, id.prenoms].filter(Boolean).join(' ') + ').'); return; }
        if (coursFiltre && a.cours !== coursFiltre) { rejets.push(f.nom + ', ligne ' + (debut + k + 1) + ' : ' + nomC(a) + ' est inscrit(e) en ' + a.cours + '.'); return; }
        if (!Object.keys(notes).length) return;
        ops.push({ a, cle, notes, feuille: f.nom });
      });
    });
    return { ops, rejets, infos };
  }
  function appliquerNotes(res) {
    let n = 0;
    res.ops.forEach(({ a, cle, notes }) => { const f = A().feuilleDe(a.id, cle, true); Object.assign(f, notes); n += Object.keys(notes).length; });
    A().saveData();
    return n;
  }

  function choisirFichier(apres) {
    const i = document.createElement('input'); i.type = 'file'; i.accept = '.xlsx,.xlsm';
    i.onchange = () => { const f = i.files && i.files[0]; if (!f) return;
      global.Tableur.lireClasseur(f).then(apres).catch(err => alert('Classeur illisible : ' + (err && err.message ? err.message : err))); };
    i.click();
  }
  function rapport(titre, lignes, rejets, bouton) {
    A().openModal(titre, '<div class="alert alert-info">' + lignes.join('<br>') + '</div>'
      + (rejets.length ? '<div class="alert alert-warning"><b>' + rejets.length + ' ligne(s) non reprise(s) :</b><br>' + rejets.slice(0, 60).map(esc).join('<br>') + (rejets.length > 60 ? '<br>…' : '') + '</div>' : '')
      + (bouton ? '<div class="text-center mt-15"><button class="btn btn-success" type="button" id="emValider">' + bouton + '</button> <button class="btn" type="button" onclick="closeModal()">Annuler</button></div>' : ''));
  }
  function importerEleves() {
    const e = ecoleChoisie(); if (!e) return alert('Choisissez l’école dans laquelle verser les élèves.');
    choisirFichier(feuilles => {
      const res = analyserEleves(feuilles, e.id);
      if (!res.ops.length) return rapport('Importation EducMaster — élèves', ['Aucun élève lisible dans ce classeur (modèle « classe » attendu : une feuille par niveau, colonnes Nom, Prénom ( s ), Sexe…).'], res.rejets);
      const nouveaux = res.ops.filter(o => !o.ex).length, parNiveau = {};
      res.ops.forEach(o => { parNiveau[o.v.cours] = (parNiveau[o.v.cours] || 0) + 1; });
      rapport('Importation EducMaster — élèves — ' + e.nom, ['<b>' + res.ops.length + '</b> élève(s) lu(s) : <b>' + nouveaux + '</b> nouveau(x), <b>' + (res.ops.length - nouveaux) + '</b> déjà connu(s) (fiche mise à jour).',
        'Par cours : ' + Object.keys(parNiveau).map(k => esc(k) + ' ' + parNiveau[k]).join(' · ')], res.rejets, '💾 Enregistrer ces élèves');
      document.getElementById('emValider').onclick = () => { const r = appliquerEleves(res, e.id); A().closeModal(); alert(r.crees + ' élève(s) créé(s), ' + r.maj + ' mis à jour.'); rendre(); };
    });
  }
  function importerNotes() {
    const e = ecoleChoisie(); if (!e) return alert('Choisissez l’école.');
    choisirFichier(feuilles => {
      const res = analyserNotes(feuilles, e.id, etat.cours || null);
      if (!res.ops.length) return rapport('Importation EducMaster — notes', ['Aucune note reprise (modèle « notes du primaire » attendu).'].concat(res.infos), res.rejets);
      const parF = {}; res.ops.forEach(o => { parF[o.feuille] = (parF[o.feuille] || 0) + 1; });
      rapport('Importation EducMaster — notes — ' + e.nom, ['<b>' + res.ops.length + '</b> élève(s) avec des notes : ' + Object.keys(parF).map(k => esc(k) + ' (' + parF[k] + ')').join(' · ') + '.',
        'Les notes reprises remplacent celles déjà saisies pour les mêmes matières.'].concat(res.infos), res.rejets, '💾 Enregistrer ces notes');
      document.getElementById('emValider').onclick = () => { const n = appliquerNotes(res); A().closeModal(); alert(n + ' note(s) enregistrée(s).'); };
    });
  }

  /* ---------------- page ---------------- */
  function rendre() {
    const page = document.getElementById('educmaster'); if (!page) return;
    const l = ecoles();
    if (!etat.ecole || !ecoleChoisie()) etat.ecole = (A().ecoleDuPoste() || l[0] || {}).id || '';
    const e = ecoleChoisie(), nbE = e ? eleves(e.id).length : 0;
    page.innerHTML = '<div class="page-title">🔄 EducMaster : élèves et notes</div>'
      + '<div class="alert alert-info">Les fichiers suivent exactement les modèles officiels EducMaster (les mêmes que SCOLARIS et GESCOL) : feuilles, rubriques et cellules fusionnées. '
      + 'Téléchargez, vérifiez, puis déposez-les sur la plateforme ; ou importez ici un modèle rempli. Rien n’est enregistré avant que vous ayez vu le résultat.</div>'
      + '<div class="search-bar"><select id="emEcole">' + (l.length > 1 ? '<option value="">— École —</option>' : '') + l.map(x => '<option value="' + esc(x.id) + '"' + (String(x.id) === String(etat.ecole) ? ' selected' : '') + '>' + esc(x.nom) + '</option>').join('') + '</select>'
      + '<select id="emCours"><option value="">— Cours (notes) —</option>' + V().COURS.map(c => '<option' + (c === etat.cours ? ' selected' : '') + '>' + c + '</option>').join('') + '</select></div>'
      + '<div class="rg-cartes">'
      + '<div class="rg-carte"><div class="rg-ic">🧒</div><b>Élèves — modèle « classe »</b><span>Une feuille par niveau (CM2 … CI, Marternelle 2 / 1) : Nom, Prénom(s), Sexe, Date de naissance (jj/mm/aaaa), Lieu, Téléphone des parents, Nationalité, Npi. '
      + (e ? nbE + ' élève(s) dans ' + esc(e.nom) + '.' : '') + '</span><div><button class="btn btn-primary btn-sm" type="button" id="emExpE">📤 Exporter (modèle rempli)</button> <button class="btn btn-warning btn-sm" type="button" id="emImpE">📥 Importer</button></div></div>'
      + '<div class="rg-carte"><div class="rg-ic">🗒️</div><b>Notes — modèle « notes du primaire »</b><span>Feuilles Évaluation formative 1, sommatives 1 à 3 ; par matière « Note obtenue » et « Note perf. » (barème 20). '
      + 'Communication orale et Anglais ne figurent pas dans le modèle EducMaster.</span><div><button class="btn btn-primary btn-sm" type="button" id="emExpN">📤 Exporter le cours choisi</button> <button class="btn btn-warning btn-sm" type="button" id="emImpN">📥 Importer</button></div></div>'
      + '</div>';
    document.getElementById('emEcole').onchange = (ev) => { etat.ecole = ev.target.value; rendre(); };
    document.getElementById('emCours').onchange = (ev) => { etat.cours = ev.target.value; };
    document.getElementById('emExpE').onclick = exporterEleves; document.getElementById('emImpE').onclick = importerEleves;
    document.getElementById('emExpN').onclick = exporterNotes; document.getElementById('emImpN').onclick = importerNotes;
  }
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.educmaster = rendre;
  global.EducMaster = { exporterEleves, exporterNotes, importerEleves, importerNotes, analyserEleves, appliquerEleves, analyserNotes, appliquerNotes, etat, rendre, FEUILLES_CLASSE, MATIERES_MODELE };
})(window);
