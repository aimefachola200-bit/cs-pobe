/* CS Pobè — logique de l'application.
   Les données vivent dans le navigateur de cet ordinateur ; rien ne part sur
   le réseau. La sauvegarde en JSON est le seul moyen de les emporter. */
(function (global) {
  'use strict';

  // circonscription et école peuvent être ouvertes sur le même appareil (même domaine) : données séparées
  const CLE_STOCKAGE = (global.Config && global.Config.estEcole && global.Config.estEcole()) ? 'ecolePobeData' : 'csPobeData';
  const COLLECTIONS = ['ecoles', 'personnel', 'effectifs', 'infrastructures', 'mobilier',
    'evaluations', 'cep', 'cni', 'rapports', 'courriersArr', 'courriersDep', 'annees',
    'cepSession', 'identite', 'centres', 'compositions', 'apprenants', 'notes', 'fiches', 'certificats', 'visites', 'attributions', 'collegiale', 'unites', 'comite', 'uascepBureaux', 'uascepMembres',
    'presencesApprenants', 'presencesPersonnel', 'joursFeries', 'bilans', 'themesDone', 'whatsapp',
    'officielPerso',   // v2.0 : emplois du temps et planifications modifiés sur cet appareil
    'reglages',        // v2.3 : réglages et versions des données de référence appliquées
    'ecolesInactives'];  // v2.3.1 : écoles ne fonctionnant plus (avec leurs effectifs, locaux, mobilier) — hors des listes actives
  // v2.3 : réglages et versions des données de référence appliquées (zones, UP, effectifs officiels)

  let data = charger();
  /* Cachets ronds partout (demande du 19/10/2026) : une seule fois, les cachets réglés en rectangulaire passent en rond ;
     chacun peut ensuite revenir au rectangulaire dans « Régler le cachet ». */
  (function cachetsRonds() {
    const cle = 'cachetsRonds:' + CLE_STOCKAGE;
    try { if (localStorage.getItem(cle)) return; } catch (e) { return; }
    let n = 0;
    ['ecoles', 'identite'].forEach(c => (data[c] || []).forEach(x => { if ((x.cachet_forme || 'RECT') !== 'ROND') { x.cachet_forme = 'ROND'; n++; } }));
    if (n) saveData();
    try { localStorage.setItem(cle, '1'); } catch (e) { /* réessai au prochain démarrage */ }
  })();

  function charger() {
    let brut = null;
    /* IndexedDB (ou, à défaut, localStorage) : lu par stockage.js avant le chargement de ce script */
    const lu = global.Stockage ? global.Stockage.initial : localStorage.getItem(CLE_STOCKAGE);
    try { brut = JSON.parse(lu); } catch (e) { brut = null; }
    // école : reprise des données enregistrées par une version précédente sous l'ancienne clé commune
    if (!brut && CLE_STOCKAGE === 'ecolePobeData') { try { brut = JSON.parse(localStorage.getItem('csPobeData')); } catch (e) { brut = null; } }
    const base = {};
    COLLECTIONS.forEach(c => { base[c] = (brut && Array.isArray(brut[c])) ? brut[c] : []; });
    return base;
  }

  function saveData() {
    try {
      const json = JSON.stringify(data);
      if (global.Stockage) { if (!global.Stockage.ecrire(json)) throw new Error('plein'); }
      else localStorage.setItem(CLE_STOCKAGE, json);
      return true;
    } catch (e) {
      alert("Enregistrement impossible : la mémoire du navigateur est pleine.\n"
        + "Exportez vos données, puis allégez l'historique.");
      return false;
    }
  }

  let compteur = 0;
  function uid() { return Date.now().toString(36) + (compteur++).toString(36); }

  const echapper = v => String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  /* Premier démarrage : on installe la liste des écoles de la circonscription.
     En mode ÉCOLE, l'application n'est celle que d'un seul établissement — celui
     que son directeur inscrit lui-même — et ne reçoit jamais le référentiel des
     155 écoles ni les compléments qui lui sont apportés côté circonscription. */
  if (data.ecoles.length === 0 && !global.Config.estEcole()) {
    data.ecoles = global.Donnees.ecolesInitiales(uid);
    saveData();
  }
  /* Les installations existantes reçoivent les écoles ajoutées au référentiel
     depuis leur première ouverture, sans que rien de saisi ne soit touché. */
  if (!global.Config.estEcole()) {
    (function completerReferentiel() {
      // les écoles « ne fonctionnant plus » comptent comme connues : elles ne reviennent pas par le référentiel
      const archivees = (data.ecolesInactives || []).map(a => a.ecole);
      const ajouts = global.Donnees.completerEcoles(data.ecoles.concat(archivees), uid)
        .filter(x => !archivees.some(a => String(a.nom).toUpperCase() === String(x.nom).toUpperCase()));
      if (ajouts.length) {
        data.ecoles = data.ecoles.concat(ajouts);
        saveData();
      }
    })();
  }

  /* Isolation du poste d'école : ni les autres écoles, ni le personnel du
     bureau de la circonscription ne doivent subsister dans les données
     locales, même si elles y sont entrées par une sauvegarde restaurée par
     erreur ou une donnée héritée d'avant cette isolation. */
  if (global.Config.estEcole()) isolerDonneesEcole(true);

  if (data.annees.length === 0) {
    data.annees = global.Donnees.anneesInitiales();
    saveData();
  }

  /* v2.3 : zones, unités pédagogiques (RUP, co-RUP), écoles et effectifs officiels de la CS (data/pobe-up.js) —
     posés une fois par version des données, sans écraser ce que l'utilisateur a saisi. */
  const UPO = global.PobeUP ? global.PobeUP.installer({ data, uid, saveData, anneeActive }) : null;

  /** L'année scolaire de référence, celle que porte le sélecteur d'en-tête. */
  function anneeActive() {
    const a = data.annees.find(x => x.active) || data.annees[0];
    return a ? a.libelle : '2026-2027';
  }
  /* La session du CEP est celle de juin, à la fin de l'année scolaire active. */
  function sessionCEP() {
    return String(parseInt(String(anneeActive()).slice(-4), 10) || new Date().getFullYear());
  }

  /** Millésime servant de référence aux anciennetés : la première année du couple. */
  function anneeReference() {
    return parseInt(String(anneeActive()).slice(0, 4), 10) || new Date().getFullYear();
  }

  /* ---------------- Navigation ---------------- */

  /* Bouton « ← Retour » : page précédente (pile des pages vues), sinon le tableau de bord */
  const pileRetour = [];
  function barreRetour() {
    let b = document.getElementById('barre-retour');
    if (b) return b;
    const main = document.querySelector('.main');
    if (!main) return null;
    b = document.createElement('div');
    b.id = 'barre-retour'; b.className = 'barre-retour no-print';
    b.innerHTML = '<button type="button" class="btn-retour" title="Revenir à la page précédente" aria-label="Revenir à la page précédente">← Retour</button>'
      + '<button type="button" class="btn-retour sec" title="Tableau de bord" aria-label="Tableau de bord">🏠 Tableau de bord</button>';
    b.children[0].addEventListener('click', retourPage);
    b.children[1].addEventListener('click', () => showPage('dashboard', document.querySelector('.menu-item[data-page="dashboard"]')));
    main.insertBefore(b, main.firstChild);
    if (!document.getElementById('css-retour')) {
      const s = document.createElement('style'); s.id = 'css-retour';
      s.textContent = '.barre-retour{display:flex;gap:6px;margin:0 0 12px;position:sticky;top:0;z-index:5;padding:4px 0;background:inherit}'
        + '.btn-retour{border:1px solid #cbd5e1;background:#fff;color:#006633;border-radius:18px;padding:5px 12px;font-weight:600;cursor:pointer;font-size:.9em}'
        + '.btn-retour:hover{background:#e8f3ee}.btn-retour.sec{color:#475467;font-weight:500}@media print{.barre-retour{display:none}}';
      document.head.appendChild(s);
    }
    return b;
  }
  function retourPage() {
    const id = pileRetour.pop() || 'dashboard';
    showPage(id, document.querySelector('.menu-item[data-page="' + id + '"]'), true);
  }
  function showPage(id, el, depuisRetour) {
    const actuelle = document.querySelector('.page:not(.hidden)');
    if (!depuisRetour && actuelle && actuelle.id !== id) { pileRetour.push(actuelle.id); if (pileRetour.length > 50) pileRetour.shift(); }
    const br = barreRetour();
    if (br) br.style.display = (id === 'dashboard' && !pileRetour.length) ? 'none' : 'flex';
    document.querySelectorAll('.page').forEach(p => p.classList.add('hidden'));
    const page = document.getElementById(id);
    if (page) page.classList.remove('hidden');
    document.querySelectorAll('.menu-item').forEach(m => m.classList.remove('active'));
    if (el) el.classList.add('active');

    const rendus = {
      dashboard: renderDashboard, ecoles: renderEcoles,
      personnel: () => { populateEcoleFilters(); renderPersonnel(); },
      visites: renderVisites, carriere: renderCarriere, retraite: renderRetraite,
      effectifs: () => { populateEcoleFilters(); renderEffectifs(); },
      infrastructures: renderInfra, mobilier: renderMobilier,
      apprenants: renderApprenants, notes: renderNotes, cep: renderCep, cm2: renderCM2, examen: renderExamen, evaluations: renderEval, classes: renderClassesAttrib, collegiale: renderCollegiale, repertoires: renderRepertoires, cni: renderCni, identite: renderIdentite, fiches: renderFiches, certificats: renderCertificats, rapports: renderRapports, courriers: renderCourriers,
      administratif: () => renderCategorie('Administratif'),
      soutien: () => renderCategorie('Soutien'),
      educateur: () => renderCategorie('Éducateur'),
      analyses: renderAnalyses, annees: renderAnnees, maFiche: renderMaFiche,
      joursFeries: renderJoursFeries, presenceApprenants: renderPresenceApprenants,
      presencePersonnel: renderPresencePersonnel,
      importation: preparerImport, backup: majEtatStockage
    };
    if (rendus[id]) rendus[id]();
    else if (global.Extra && global.Extra.pages[id]) global.Extra.pages[id]();
  }

  function switchTab(tab) {
    const groupe = tab.parentNode;
    groupe.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const page = groupe.parentNode;
    page.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    const cible = document.getElementById(tab.dataset.tab);
    if (cible) cible.classList.add('active');
  }

  function openModal(title, body) {
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = body;
    document.getElementById('modal').classList.add('active');
  }
  function closeModal() { document.getElementById('modal').classList.remove('active'); }

  function optionsEcoles(selection) {
    /* En mode école, la seule école proposée est celle du poste. */
    return data.ecoles.slice().sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
      .map(e => '<option value="' + e.id + '"' + (selection == e.id ? ' selected' : '') + '>'
        + echapper(e.nom) + '</option>').join('');
  }

  function populateEcoleFilters() {
    const opts = '<option value="">Toutes écoles</option>' + optionsEcoles();
    ['filterEcolePers', 'filterEcoleEff'].forEach(id => {
      const el = document.getElementById(id);
      if (el) { const v = el.value; el.innerHTML = opts; el.value = v; }
    });
  }

  /** Toutes les unités pédagogiques : celles du référentiel et celles déjà saisies. */
  function unitesConnues() {
    const base = [];
    Object.keys(global.Donnees.UNITES).forEach(a => {
      global.Donnees.UNITES[a].forEach(u => base.push(u));
    });
    (data.unites || []).forEach(u => { if (u.nom && base.indexOf(u.nom) < 0) base.push(u.nom); });
    data.ecoles.forEach(e => { if (e.unite_ped && base.indexOf(e.unite_ped) < 0) base.push(e.unite_ped); });
    return base.sort((a, b) => a.localeCompare(b, 'fr'));
  }

  function nomEcole(id) {
    if (!id) return 'Service CS';
    const e = data.ecoles.find(x => x.id == id);
    if (e) return e.nom;
    const a = (data.ecolesInactives || []).find(x => x.id == id);
    return a ? a.ecole.nom + ' (ne fonctionne plus)' : '—';
  }

  /* ---------------- Retraite ---------------- */

  /* Le calcul de carrière fait foi : une seule règle, un seul endroit. Les
     agents ACDPCTD suivent une règle d'âge propre à leur statut (35/40 ans) :
     le statut doit donc accompagner le grade partout où l'âge de départ est
     calculé. */
  function getAgeRetraite(grade, statut) { return global.Carriere.ageRetraite(grade, statut); }
  function calcDateRetraite(dateNaissance, grade, statut) {
    return global.Carriere.dateRetraite(dateNaissance, grade, statut);
  }

  function formatDate(d) {
    if (!d) return '—';
    const dt = new Date(d);
    if (isNaN(dt.getTime())) return String(d);
    return dt.toLocaleDateString('fr-FR');
  }

  /* ---------------- Tableau de bord ---------------- */

  function renderDashboard() {
    if (global.TableauBord) { try { global.TableauBord.render(); return; } catch (e) { console.error(e); } }
    const compte = t => data.ecoles.filter(e => e.type === t).length;
    const totalEleves = data.effectifs.reduce((s, e) =>
      s + (parseInt(e.total, 10) || ((parseInt(e.totalG, 10) || 0) + (parseInt(e.totalF, 10) || 0))), 0);

    document.getElementById('statsGrid').innerHTML = [
      ['', 'Primaires publiques', compte('EPP')],
      ['yellow', 'Primaires privées', compte('EPPRIV')],
      ['red', 'Maternelles publiques', compte('EM')],
      ['blue', 'Maternelles privées', compte('EMPRIV')],
      ['', 'Total écoles', data.ecoles.length],
      ['yellow', 'Personnel enregistré', data.personnel.length],
      ['red', 'Total élèves', totalEleves],
      ['blue', 'Courriers archivés', data.courriersArr.length + data.courriersDep.length]
    ].map(([c, t, v]) => '<div class="stat-card ' + c + '"><h4>' + t
      + '</h4><div class="value">' + v + '</div></div>').join('');

    const today = new Date();
    const dans12mois = new Date();
    dans12mois.setFullYear(dans12mois.getFullYear() + 1);
    const proches = data.personnel.filter(global.Carriere.estActif).filter(p => {
      const dr = calcDateRetraite(p.dateNaissance, p.grade, p.statut);
      return dr && dr >= today && dr <= dans12mois;
    }).sort((a, b) => calcDateRetraite(a.dateNaissance, a.grade, a.statut)
      - calcDateRetraite(b.dateNaissance, b.grade, b.statut));

    document.getElementById('alerteRetraite').innerHTML = proches.length === 0
      ? '<p style="color:#94a3b8;">Aucune retraite prévue dans les 12 prochains mois.</p>'
      : proches.slice(0, 10).map(p => '<div style="padding:8px;border-bottom:1px solid #e2e8f0;">'
        + '<b>' + echapper(p.nom) + '</b> (' + echapper(p.grade || '—') + ')<br>'
        + '<small>Retraite : ' + formatDate(calcDateRetraite(p.dateNaissance, p.grade, p.statut))
        + '</small></div>').join('');

    const recents = data.courriersArr.slice(-5).concat(data.courriersDep.slice(-5))
      .sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);
    document.getElementById('derniersCourriers').innerHTML = recents.length === 0
      ? '<p style="color:#94a3b8;">Aucun courrier enregistré.</p>'
      : recents.map(c => '<div style="padding:8px;border-bottom:1px solid #e2e8f0;">'
        + '<b>' + echapper(c.objet) + '</b><br><small>' + formatDate(c.date) + ' — '
        + echapper(c.expediteur || c.destinataire || '') + '</small></div>').join('');

    renderVentilationDashboard();
  }

  /* Répartition du personnel actif par statut (FE, ACDPE, Privé, ACDPCTD —
     dont les AME, la même appellation ancienne pour le même agent — et
     Éducateur, statut distinct, à ne pas confondre) et par sexe, avec le
     rôle Directeur / Adjoint pour les statuts qui le distinguent. S'appuie
     sur la même ventilation que la page « Personnel par statut », pour ne
     jamais afficher deux chiffres différents d'un écran à l'autre. */
  function renderVentilationDashboard() {
    const cible = document.getElementById('ventilationDashboard');
    if (!cible) return;
    const lignes = global.Carriere.ventilerPersonnel(data.personnel, data.ecoles);
    const parLibelle = {};
    lignes.forEach(l => { parLibelle[l.libelle] = l; });
    const rangee = (libelle, etiquette) => {
      const g = parLibelle[libelle];
      const H = g ? g.H : 0, F = g ? g.F : 0;
      return '<tr><td>' + etiquette + '</td><td>' + H + '</td><td>' + F
        + '</td><td><b>' + (H + F) + '</b></td></tr>';
    };
    cible.innerHTML = '<table><thead><tr><th>Statut</th><th>Hommes</th>'
      + '<th>Femmes</th><th>Total</th></tr></thead><tbody>'
      + rangee('FE — Directeur', 'FE — Directeur')
      + rangee('FE — Collaborateur', 'FE — Adjoint')
      + rangee('ACDPE — Directeur', 'ACDPE — Directeur')
      + rangee('ACDPE — Collaborateur', 'ACDPE — Adjoint')
      + rangee('PRIVEE — Directeur', 'Privé — Directeur')
      + rangee('PRIVEE — Collaborateur', 'Privé — Adjoint')
      + rangee('ACDPCTD (AME)', 'ACDPCTD (AME)')
      + rangee('Éducateur', 'Éducateur')
      + '</tbody></table>';
  }

  /* ---------------- Écoles ---------------- */

  function renderEcoles() {
    const search = (document.getElementById('searchEcole').value || '').toLowerCase();
    const type = document.getElementById('filterType').value;
    const arr = document.getElementById('filterArrond').value;
    const zone = document.getElementById('filterZone').value;
    const up = document.getElementById('filterUP').value;

    const liste = data.ecoles.filter(e =>
      (!search || (e.nom || '').toLowerCase().indexOf(search) >= 0
        || (e.code || '').toLowerCase().indexOf(search) >= 0)
      && (!type || e.type === type) && (!arr || e.arrondissement === arr)
      && (!zone || e.zone_ped === zone) && (!up || e.unite_ped === up));

    document.getElementById('ecolesTable').innerHTML = liste.map(e =>
      '<tr><td><b>' + echapper(e.code) + '</b></td><td>' + echapper(e.nom) + '</td>'
      + '<td><span class="badge badge-info">' + echapper(e.type) + '</span></td>'
      + '<td>' + echapper(e.statut) + '</td><td>' + echapper(e.arrondissement) + '</td>'
      + '<td>' + echapper(e.zone_ped || '—') + (e.zone_up && e.zone_up !== e.zone_ped
        ? '<div class="petit muet" style="font-size:11px">activités : ' + echapper(e.zone_up) + '</div>' : '') + '</td>'
      + '<td>' + echapper(e.unite_ped || '—') + '</td>'
      + '<td>' + echapper(e.annee_creation) + '</td><td>' + (e.classes_existantes || 0) + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-info btn-sm" onclick="viewEcole(\'' + e.id + '\')">👁️</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editEcole(\'' + e.id + '\')">✏️</button>'
      + (global.Config.estEcole() ? '' : '<button class="btn btn-secondary btn-sm" title="Ne fonctionne plus" onclick="ecoleNeFonctionnePlus(\'' + e.id + '\')">⛔</button>')
      + '<button class="btn btn-danger btn-sm" onclick="deleteEcole(\'' + e.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="10" class="text-center">Aucune école trouvée</td></tr>';
  }

  /**
   * « Ma fiche école » : chaque directeur retrouve ici sa propre école, sans
   * passer par la table d'administration complète, pour vérifier et
   * compléter les renseignements qui remplissent automatiquement les fiches
   * officielles (directeur, zone et unité pédagogiques, contacts…). Dès
   * l'école choisie, ses renseignements, son personnel et l'effectif de ses
   * apprenants s'affichent immédiatement — incomplets au besoin, avec ce qui
   * manque marqué « à compléter » — plutôt que de rester vides tant que tout
   * n'est pas renseigné.
   */
  function renderMaFiche() {
    const sel = document.getElementById('maFicheEcole');
    if (!sel) return;
    if (sel.options.length <= 1) {
      sel.innerHTML = '<option value="">— Choisir mon école —</option>' + optionsEcoles();
    }
    const zone = document.getElementById('maFicheResultat');
    if (!zone) return;
    const ecole = sel.value ? data.ecoles.find(x => x.id == sel.value) : null;
    if (!ecole) { zone.innerHTML = ''; return; }

    const champs = [
      ['code', 'Code'], ['type', 'Type'], ['statut', 'Statut'],
      ['arrondissement', 'Arrondissement'], ['zone_ped', 'Zone pédagogique'],
      ['unite_ped', 'Unité pédagogique'],
      ['directeur', 'Nom et prénoms du directeur ou de la directrice'],
      ['contact_directeur', 'Contact du directeur ou de la directrice'],
      ['telephone', 'Téléphone de l’école'],
      ['email', 'Adresse mail'],
      ['annee_creation', 'Année de création'],
      ['classes_autorisees', 'Classes autorisées'], ['classes_existantes', 'Classes existantes']
    ];
    const valeur = v => (v || v === 0) && v !== ''
      ? echapper(v) : '<span class="badge badge-warning">à compléter</span>';

    const personnel = data.personnel.filter(p => p.ecoleId == ecole.id);
    const actifs = personnel.filter(global.Carriere.estActif);
    const releve = data.effectifs.filter(e => e.ecoleId == ecole.id
      && (!e.annee || e.annee === anneeActive()))[0];

    zone.innerHTML = '<div class="table-container mt-15"><div class="table-scroll"><table><tbody>'
      + champs.map(([cle, libelle]) => '<tr><td style="background:#f8fafc;width:45%;">'
        + libelle + '</td><td>' + valeur(ecole[cle]) + '</td></tr>').join('')
      + '</tbody></table></div></div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="editEcole(\'' + ecole.id
      + '\')">✏️ Modifier ces renseignements</button></div>'

      + '<h4 class="mt-15">👥 Personnel (' + actifs.length + ' en poste sur '
      + personnel.length + ' enregistré(s))</h4>'
      + (personnel.length
        ? '<div class="table-container"><div class="table-scroll"><table>'
          + '<thead><tr><th>Situation</th><th>Nom et prénoms</th><th>Sexe</th>'
          + '<th>Fonction</th><th>Statut</th><th>Grade</th></tr></thead><tbody>'
          + personnel.map(p => {
            const sit = global.Carriere.situationDe(p);
            return '<tr' + (sit.actif ? '' : ' style="opacity:.72;"') + '>'
              + '<td><span class="badge badge-' + sit.ton + '">' + echapper(sit.libelle) + '</span></td>'
              + '<td>' + echapper(p.nom || '—') + '</td><td>' + echapper(p.sexe || '—') + '</td>'
              + '<td>' + echapper(p.fonction || '—') + '</td>'
              + '<td>' + echapper(global.Carriere.groupeDePersonnel(p)) + '</td>'
              + '<td>' + echapper(p.grade || '—') + '</td></tr>';
          }).join('') + '</tbody></table></div></div>'
        : '<div class="alert alert-warning">Aucun agent enregistré pour cette école — '
          + 'à compléter dans le module Personnel.</div>')

      + '<h4 class="mt-15">🎒 Effectif des apprenants — ' + echapper(anneeActive()) + '</h4>'
      + (releve
        ? '<div class="stats-grid">'
          + carte(U(releve.totalG || 0) + ' / ' + U(releve.totalF || 0), 'Garçons / filles', 'blue')
          + carte(U(releve.total || 0), 'Total apprenants')
          + carte(U(releve.redoublants || 0), 'Redoublants')
          + carte(U(releve.handicapes || 0), 'Dont handicapés')
          + '</div>'
        : '<div class="alert alert-warning">Aucun effectif enregistré pour ' + echapper(anneeActive())
          + ' — à compléter dans le module Effectifs (le bouton « Reporter les effectifs de '
          + 'l’année précédente » peut donner un point de départ).</div>');
  }

  function champ(label, nom, valeur, type) {
    return '<div class="form-group"><label>' + label + '</label>'
      + '<input type="' + (type || 'text') + '" name="' + nom + '" value="'
      + echapper(valeur || '') + '"></div>';
  }

  function champDate(label, nom, valeur) {
    return '<div class="form-group"><label>' + label + '</label>'
      + '<input type="date" name="' + nom + '" value="' + echapper(valeur || '')
      + '" oninput="majApercuAgent()"></div>';
  }

  /** Montre à la saisie ce que l'application calculera. */
  function majApercuAgent() {
    const zone = document.getElementById('apercuAnciennete');
    if (!zone) return;
    const form = document.querySelector('#modalBody form');
    if (!form) return;
    const lire = n => (form.querySelector('[name=' + n + ']') || {}).value || '';
    const agent = {
      datePriseServiceFP: lire('datePriseServiceFP'),
      datePriseServiceDept: lire('datePriseServiceDept'),
      datePriseServiceEcole: lire('datePriseServiceEcole')
    };
    global.Carriere.ANNEES_NOTES.forEach(a2 => { agent['note' + a2] = lire('note' + a2); });
    const anc = global.Carriere.anciennetes(agent, anneeReference());
    const moyenne = global.Carriere.moyenneNotes(agent);
    const dr = global.Carriere.dateRetraite(lire('dateNaissance'), lire('grade'), lire('statut'));
    zone.innerHTML = 'Ancienneté au 31 décembre ' + anneeReference() + ' — '
      + 'fonction publique : <b>' + (anc.fonctionPublique === null ? '—' : anc.fonctionPublique + ' an(s)')
      + '</b> · département : <b>' + (anc.departement === null ? '—' : anc.departement + ' an(s)')
      + '</b> · école : <b>' + (anc.ecole === null ? '—' : anc.ecole + ' an(s)') + '</b>'
      + (moyenne !== null ? '<br>Moyenne des notes d\'évaluation : <b>' + moyenne + '/20</b>' : '')
      + (dr ? '<br>Départ à la retraite : <b>' + formatDate(dr) + '</b>' : '');
  }

  function selecteur(label, nom, valeurs, choisi, requis) {
    return '<div class="form-group"><label>' + label + '</label><select name="' + nom + '"'
      + (requis ? ' required' : '') + '>'
      + valeurs.map(v => {
        const val = Array.isArray(v) ? v[0] : v;
        const lib = Array.isArray(v) ? v[1] : v;
        return '<option value="' + echapper(val) + '"' + (choisi == val ? ' selected' : '')
          + '>' + echapper(lib) + '</option>';
      }).join('') + '</select></div>';
  }

  function openEcoleModal(id) {
    const e = id ? data.ecoles.find(x => x.id == id) || {} : {};
    openModal(id ? 'Modifier une école' : 'Ajouter une école',
      '<form onsubmit="saveEcole(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>1. Identification</h4><div class="form-grid">'
      + champ("Code école", 'code', e.code)
      + '<div class="form-group"><label>Nom de l\'école *</label><input name="nom" value="'
      + echapper(e.nom || '') + '" required></div>'
      + selecteur("Type *", 'type', [['EPP', 'Primaire publique'], ['EPPRIV', 'Primaire privée'],
        ['EM', 'Maternelle publique'], ['EMPRIV', 'Maternelle privée']], e.type, true)
      + selecteur("Statut", 'statut', ['Public', 'Privé Laïc', 'Privé Confessionnel',
        'Communautaire'], e.statut)
      + selecteur("Type d'enseignement", 'typeEns', ['Classique', 'Inclusif', 'Spécialisé'], e.typeEns)
      + champ("Année de création", 'annee_creation', e.annee_creation, 'number')
      + '</div></div>'
      + '<div class="form-section"><h4>2. Localisation</h4><div class="form-grid">'
      + champ("Département", 'departement', e.departement || 'PLATEAU')
      + champ("Commune", 'commune', e.commune || 'POBE')
      + selecteur("Arrondissement *", 'arrondissement',
        ['POBE', 'AHOYEYE', 'IGANNA', 'ISSABA', 'TOWE'], e.arrondissement, true)
      + champ("Village ou quartier", 'village', e.village)
      + selecteur("Zone pédagogique (appartenance)", 'zone_ped', [''].concat(global.Donnees.ZONES), e.zone_ped)
      + selecteur("Zone des activités (zone de l’UP)", 'zone_up', [''].concat(global.Donnees.ZONES), e.zone_up)
      + '<div class="form-group"><label>Unité pédagogique</label>'
      + '<input name="unite_ped" list="listeUP" value="' + echapper(e.unite_ped || '') + '">'
      + '<datalist id="listeUP">' + unitesConnues().map(u => '<option value="'
        + echapper(u) + '">').join('') + '</datalist></div>'
      + champ("Téléphone", 'telephone', e.telephone)
      + champ("Adresse mail", 'email', e.email)
      + '</div></div>'
      + '<div class="form-section"><h4>3. Classes</h4><div class="form-grid">'
      + champ("Classes autorisées", 'classes_autorisees', e.classes_autorisees || 0, 'number')
      + champ("Classes existantes", 'classes_existantes', e.classes_existantes || 0, 'number')
      + champ("Salles existantes", 'salles_existantes', e.salles_existantes || 0, 'number')
      + champ("Salles utilisées", 'salles_utilisees', e.salles_utilisees || 0, 'number')
      + '</div></div>'
      + '<div class="form-section"><h4>4. Direction</h4><div class="form-grid">'
      + champ("Directeur", 'directeur', e.directeur)
      + champ("Contact du directeur", 'contact_directeur', e.contact_directeur)
      + '</div></div>'
      + '<div class="form-section"><h4>5. Effectif du personnel (par statut)</h4>'
      + '<p class="petit muet" style="font-size:12px">' + echapper((e.personnel_fichier || {}).source || 'Nombre d’agents par statut') + '</p><div class="form-grid">'
      + [['fe', 'FE'], ['acdpe', 'ACDPE'], ['ame', 'AME / ACDPCTD'], ['autres', 'Autres (privé…)'], ['total', 'Total']].map(([k, l]) =>
        champ(l, 'pf_' + k, (e.personnel_fichier || {})[k] ?? '', 'number')).join('')
      + '</div></div>'
      + '<div class="text-center mt-15">'
      + (id && UPO && UPO.officielEcole(e.nom) ? '<button type="button" class="btn btn-info" onclick="reinitialiserEcole(\'' + id + '\')">♻ Réinitialiser (fichiers de la CS)</button> ' : '')
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function enregistrer(collection, obj, id, apres) {
    if (id) {
      const idx = data[collection].findIndex(x => x.id == id);
      if (idx >= 0) data[collection][idx] = Object.assign({}, data[collection][idx], obj);
    } else {
      obj.id = uid();
      data[collection].push(obj);
    }
    saveData();
    closeModal();
    if (apres) apres();
  }

  function saveEcole(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    /* l'UP choisie donne la zone des activités quand elle n'est pas indiquée */
    if (obj.unite_ped && !obj.zone_up) { const f = (data.unites || []).find(u => u.nom === obj.unite_ped); if (f && f.zone) obj.zone_up = f.zone; }
    if (!obj.unite_ped) obj.zone_up = obj.zone_up || '';
    /* effectif du personnel par statut (champs pf_*) */
    const pf = {};
    Object.keys(obj).filter(k => k.indexOf('pf_') === 0).forEach(k => { if (obj[k] !== '') pf[k.slice(3)] = parseInt(obj[k], 10) || 0; delete obj[k]; });
    if (Object.keys(pf).length) {
      const avant = id ? (data.ecoles.find(x => x.id == id) || {}).personnel_fichier || {} : {};
      if (pf.total === undefined) pf.total = ['fe', 'acdpe', 'ame', 'autres'].reduce((t, k) => t + (pf[k] || 0), 0);
      obj.personnel_fichier = Object.assign({}, avant, pf);
    }
    /* Les salles utilisées ne peuvent pas dépasser les salles existantes. */
    if (Number(obj.salles_utilisees) > Number(obj.salles_existantes)
        && Number(obj.salles_existantes) > 0) {
      alert('Les salles utilisées (' + obj.salles_utilisees
        + ') dépassent les salles existantes (' + obj.salles_existantes + ').');
      return;
    }
    /* Le titre de l'en-tête reprend le nom de l'école en mode ÉCOLE : il doit
       suivre si ce nom vient de changer. */
    enregistrer('ecoles', obj, id, () => { renderEcoles(); appliquerMode(); renderMaFiche(); });
  }

  /**
   * Mode ÉCOLE : la page « Écoles » est masquée, mais le directeur doit
   * pouvoir corriger sa propre fiche (adresse, contacts, classes, salles…)
   * après la configuration initiale. Ce bouton, affiché dans l'en-tête,
   * rouvre le même formulaire que la page masquée.
   */
  function editerEcoleDuPoste() {
    const e = ecoleDuPoste();
    if (e) openEcoleModal(e.id);
  }

  /**
   * Référentiel des écoles de la circonscription, pour que chaque directeur
   * retrouve directement son établissement dans une liste plutôt que de le
   * ressaisir à la main. Ce référentiel ne dépend jamais de data.ecoles (qui
   * est purgé sur le poste école) : il vient de la liste figée de la
   * circonscription, toujours disponible même après la purge d'isolation.
   */
  function referentielEcoles() {
    return global.Donnees.ecolesInitiales(uid);
  }

  function optionsEcolesReferentiel() {
    const parArr = {};
    referentielEcoles().forEach(e => { (parArr[e.arrondissement] = parArr[e.arrondissement] || []).push(e); });
    return Object.keys(parArr).sort().map(arr => '<optgroup label="' + echapper(arr) + '">'
      + parArr[arr].slice().sort((a, b) => a.nom.localeCompare(b.nom)).map(e =>
        '<option value="' + echapper(e.code) + '">' + echapper(e.nom) + '</option>').join('')
      + '</optgroup>').join('');
  }

  /* Choisir une école dans la liste préremplit son nom et son type, mais le
     directeur garde la main : les champs restent modifiables ensuite. */
  function choisirEcoleReferentiel(select) {
    const code = select.value;
    if (!code) return;
    const ref = referentielEcoles().find(e => e.code === code);
    if (!ref) return;
    const champNom = document.getElementById('champNomEcoleRef');
    if (champNom) champNom.value = ref.nom;
    const champType = document.querySelector('#modalBody select[name="type"]');
    if (champType) champType.value = ref.type;
  }

  /**
   * Certains postes ont été configurés avec le nom d'une autre école (par
   * exemple « EPP Agbarou », restée d'une installation antérieure) : ce
   * bouton permet de le corriger sans perdre ce qui a déjà été saisi — le
   * personnel, les effectifs, etc. restent rattachés à cette même école. Le
   * directeur peut retrouver son établissement dans la liste de la
   * circonscription (ce qui complète au passage arrondissement, code, année
   * de création…), ou continuer à inscrire le nom lui-même.
   */
  function changerNomEcoleDuPoste() {
    const e = ecoleDuPoste();
    if (!e) { choisirEcoleDuPoste(); return; }
    openModal('Choisir le nom de mon école',
      '<p class="mb-15">Cette application est configurée pour l’école « '
      + echapper(e.nom) + ' ». Si ce n’est pas la vôtre, retrouvez-la dans la liste '
      + 'des écoles de la circonscription, ou inscrivez directement le bon nom : '
      + 'tout ce qui a déjà été saisi (personnel, effectifs…) reste conservé.</p>'
      + '<form onsubmit="saveNomEcoleDuPoste(event)">'
      + '<div class="form-group"><label>Mon école, dans la liste de la circonscription</label>'
      + '<select name="ecoleRef" onchange="choisirEcoleReferentiel(this)">'
      + '<option value="">— Choisir dans la liste (facultatif) —</option>'
      + optionsEcolesReferentiel() + '</select></div>'
      + '<div class="form-grid">'
      + '<div class="form-group"><label>Nom de mon établissement *</label>'
      + '<input name="nom" id="champNomEcoleRef" value="' + echapper(e.nom || '') + '" required autofocus></div>'
      + selecteur('Type', 'type', [['EPP', 'Primaire publique'], ['EPPRIV', 'Primaire privée'],
        ['EM', 'Maternelle publique'], ['EMPRIV', 'Maternelle privée']], e.type || 'EPP')
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveNomEcoleDuPoste(ev) {
    ev.preventDefault();
    const e = ecoleDuPoste();
    if (!e) return;
    const obj = Object.fromEntries(new FormData(ev.target));
    const nom = (obj.nom || '').trim();
    if (!nom) { alert('Inscrivez le nom de votre école.'); return; }
    e.nom = nom;
    e.type = obj.type || e.type;
    e.statut = String(e.type).indexOf('PRIV') >= 0 ? 'Privé Laïc' : (e.statut || 'Public');
    /* École retrouvée dans le référentiel : on complète ce qui manque encore
       (arrondissement, code, année de création, classes…) sans jamais
       écraser une donnée déjà saisie par le directeur. */
    if (obj.ecoleRef) {
      const ref = referentielEcoles().find(r => r.code === obj.ecoleRef);
      if (ref) {
        ['code', 'arrondissement', 'annee_creation', 'classes_autorisees',
          'classes_existantes', 'zone_ped'].forEach(champ => {
          if (!e[champ] && ref[champ]) e[champ] = ref[champ];
        });
      }
    }
    saveData();
    closeModal();
    appliquerMode();
    renderMaFiche();
  }

  function viewEcole(id) {
    const e = data.ecoles.find(x => x.id == id);
    if (!e) return;
    const libelles = {
      code: 'Code', nom: 'Nom', type: 'Type', statut: 'Statut', typeEns: "Type d'enseignement",
      arrondissement: 'Arrondissement', zone_ped: 'Zone pédagogique',
      unite_ped: 'Unité pédagogique', commune: 'Commune', departement: 'Département',
      village: 'Village ou quartier', annee_creation: 'Année de création',
      classes_autorisees: 'Classes autorisées', classes_existantes: 'Classes existantes',
      salles_existantes: 'Salles existantes', salles_utilisees: 'Salles utilisées',
      directeur: 'Directeur', contact_directeur: 'Contact du directeur',
      telephone: 'Téléphone', email: 'Adresse mail'
    };
    const agents = data.personnel.filter(p => p.ecoleId == id).length;
    openModal('Fiche : ' + e.nom,
      '<table style="width:100%;">'
      + Object.keys(libelles).map(k => '<tr><td style="padding:8px;background:#f8fafc;'
        + 'font-weight:500;width:40%;">' + libelles[k] + '</td><td style="padding:8px;">'
        + echapper(e[k] || '—') + '</td></tr>').join('')
      + '<tr><td style="padding:8px;background:#f8fafc;font-weight:500;">Personnel enregistré</td>'
      + '<td style="padding:8px;">' + agents + ' agent(s)</td></tr></table>'
      + '<div class="text-center mt-15"><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  function deleteEcole(id) {
    const lies = data.personnel.filter(p => p.ecoleId == id).length
      + data.effectifs.filter(x => x.ecoleId == id).length;
    const message = lies
      ? 'Cette école a ' + lies + ' enregistrement(s) rattaché(s) qui deviendront orphelins.\nSupprimer quand même ?'
      : 'Supprimer cette école ?';
    if (!confirm(message)) return;
    data.ecoles = data.ecoles.filter(x => x.id != id);
    saveData();
    renderEcoles();
  }

  /* ---------------- Personnel ---------------- */

  /* Les diplômes reconnus par le ministère, dans l'ordre des cursus. */
  const DIPLOMES_ACADEMIQUES = ['CEP', 'BEPC', 'BAC', 'LICENCE', 'MAITRISE',
    'MASTERS', 'DOCTORAT'];
  const DIPLOMES_PROFESSIONNELS = ['CEAP', 'CAP/EP', 'CAP/EM', 'CAFCP', 'CAIP'];

  const GRADES = {
    'Catégorie A (retraite 60 ans)': ['A1', 'A2'].concat(
      Array.from({ length: 15 }, (_, i) => 'A3-' + (i + 1))),
    'Catégorie B (retraite 58 ans)': Array.from({ length: 15 }, (_, i) => 'B1-' + (i + 1)),
    'Catégories C, D, E (retraite 55 ans)': ['C1-1', 'C1-5', 'C1-10', 'C1-15',
      'D1-1', 'D1-5', 'D1-10', 'D1-15', 'E1-1', 'E1-5', 'E1-10', 'E1-15']
  };

  function renderPersonnel() {
    const search = (document.getElementById('searchPersonnel').value || '').toLowerCase();
    const ecoleF = document.getElementById('filterEcolePers').value;
    const gradeF = document.getElementById('filterGrade').value;

    const situationF = document.getElementById('filterSituation').value;
    const liste = data.personnel.filter(p =>
      (p.categorie || 'Enseignant') === 'Enseignant'
      && (situationF === '' || (situationF === 'ACTIFS'
        ? global.Carriere.estActif(p) : (p.situation || 'EN_POSTE') === situationF))
      && (!search || (p.nom || '').toLowerCase().indexOf(search) >= 0
        || String(p.matricule || '').toLowerCase().indexOf(search) >= 0)
      && (!ecoleF || p.ecoleId == ecoleF)
      && (!gradeF || String(p.grade || '').toUpperCase().indexOf(gradeF) === 0));

    document.getElementById('personnelTable').innerHTML = liste.map(p => {
      const sit = global.Carriere.situationDe(p);
      return '<tr' + (sit.actif ? '' : ' style="opacity:.72;"') + '>'
      + '<td><span class="badge badge-' + sit.ton + '" title="'
      + echapper(sit.libelle + (p.dateSituation ? ' — ' + formatDate(p.dateSituation) : ''))
      + '">' + echapper(sit.libelle) + '</span></td>'
      + '<td>' + echapper(p.matricule || '—') + '</td><td><b>' + echapper(p.nom) + '</b></td>'
      + '<td>' + echapper(p.sexe || '—') + '</td><td>' + formatDate(p.dateNaissance) + '</td>'
      + '<td>' + echapper(p.grade || '—') + '</td><td>' + echapper(p.fonction || '—') + '</td>'
      + '<td>' + echapper(nomEcole(p.ecoleId)) + '</td>'
      + '<td>' + formatDate(calcDateRetraite(p.dateNaissance, p.grade, p.statut)) + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-info btn-sm" title="Changer la situation" '
      + 'onclick="changerSituation(\'' + p.id + '\')">🔀</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editPersonnel(\'' + p.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deletePersonnel(\'' + p.id + '\')">🗑️</button>'
      + '</td></tr>';
    }).join('')
      || '<tr><td colspan="10" class="text-center">Aucun agent pour ce filtre</td></tr>';
  }

  function openPersonnelModal(id, categorieParDefaut) {
    const p = id ? data.personnel.find(x => x.id == id) || {} : {};
    if (!id && categorieParDefaut) p.categorie = categorieParDefaut;
    const grades = Object.keys(GRADES).map(g => '<optgroup label="' + g + '">'
      + GRADES[g].map(v => '<option' + (p.grade === v ? ' selected' : '') + '>' + v + '</option>').join('')
      + '</optgroup>').join('');

    openModal(id ? 'Modifier un agent' : 'Ajouter un agent',
      '<form onsubmit="savePersonnel(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Informations personnelles</h4><div class="form-grid">'
      + champ('Matricule', 'matricule', p.matricule)
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(p.nom || '') + '" required></div>'
      + selecteur('Sexe *', 'sexe', [['M', 'Masculin'], ['F', 'Féminin']], p.sexe, true)
      + '<div class="form-group"><label>Date de naissance *</label>'
      + '<input type="date" name="dateNaissance" value="' + echapper(p.dateNaissance || '') + '" required></div>'
      + champ('Lieu de naissance', 'lieuNaiss', p.lieuNaiss)
      + champ('Téléphone', 'telephone', p.telephone)
      + selecteur('Personne handicapée', 'ph', ['Non', 'Oui'], p.ph)
      + selecteur('Catégorie de personnel *', 'categorie',
        ['Enseignant', ['Éducateur', 'ACDPCTD (AME) / Éducateur'], 'Administratif', 'Soutien'],
        p.categorie || 'Enseignant', true)
      + '</div></div>'
      + '<div class="form-section"><h4>Informations professionnelles</h4><div class="form-grid">'
      + '<div class="form-group"><label>Grade *</label><select name="grade" required>'
      + '<option value="">— Sélectionner —</option>' + grades + '</select></div>'
      + selecteur('Statut', 'statut', ['APE', 'ACE', 'FE', 'ACDPE', 'ACDPCTD',
        ['AME', 'AME (ancienne appellation d\'ACDPCTD)'], 'Éducateur', 'Stagiaire', 'PRIVE', 'CNR'], p.statut)
      + selecteur('Fonction', 'fonction', ['Directeur', 'Adjoint', 'Éducateur', 'Instituteur',
        'Personnel de soutien'], p.fonction)
      + selecteur('Cours tenu / Poste occupé à la CS', 'cours', [''].concat(['CI', 'CP', 'CE1',
        'CE2', 'CM1', 'CM2', 'Petits', 'Grands', 'CDS', 'CDOSP', 'Collaborateur DS',
        'Collaborateur/DOSP', 'CSPAF', 'CP de Zone 1', 'CP de Zone 2', 'CP de Zone 3',
        'CP de Zone 4', 'CP de Zone 5', 'CP de Zone 6', 'CCS']), p.cours)
      + '<div class="form-group"><label>École</label><select name="ecoleId">'
      + '<option value="">— Service CS (bureau de la circonscription) —</option>'
      + optionsEcoles(p.ecoleId) + '</select></div>'
      + selecteur('Zone pédagogique (si l’agent n’a pas d’école rattachée à une zone)', 'zone',
        [['', '— Personnel de la CS (zone à attribuer) —']].concat(global.Donnees.ZONES), p.zone)
      + selecteur('Diplôme académique', 'diplomeAca', [''].concat(DIPLOMES_ACADEMIQUES),
        p.diplomeAca)
      + selecteur('Diplôme professionnel', 'diplomePro', [''].concat(DIPLOMES_PROFESSIONNELS),
        p.diplomePro)
      + champ('Indice actuel', 'indice', p.indice)
      + champ('Indice payé', 'indicePaye', p.indicePaye)
      + champ('Qualité (soutien)', 'qualite', p.qualite)
      + '</div></div>'
      + '<div class="form-section"><h4>Prises de service</h4>'
      + '<p style="font-size:12px;color:#64748b;" class="mb-15">Les anciennetés se calculent '
      + 'seules, arrêtées au 31 décembre ' + anneeReference() + '.</p>'
      + '<div class="form-grid">'
      + champDate('Première prise de service (fonction publique)', 'datePriseServiceFP', p.datePriseServiceFP)
      + champDate('Prise de service dans le département', 'datePriseServiceDept', p.datePriseServiceDept)
      + champDate("Prise de service dans l'école", 'datePriseServiceEcole', p.datePriseServiceEcole)
      + '</div>'
      + '<div id="apercuAnciennete" class="alert alert-info mt-15"></div>'
      + '</div>'
      + '<div class="form-section"><h4>Notes d\'évaluation</h4><div class="form-grid">'
      + global.Carriere.ANNEES_NOTES.map(a2 => '<div class="form-group"><label>Note ' + a2
        + '</label><input type="number" step="0.01" min="0" max="20" name="note' + a2
        + '" value="' + echapper(p['note' + a2] || '') + '" oninput="majApercuAgent()"></div>').join('')
      + '</div></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
    majApercuAgent();
  }

  function savePersonnel(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    /* Un agent ACDPCTD (AME) ne peut normalement bénéficier des grades A et B
       qu'à partir de 40 ans, et des grades C et D qu'à partir de 35 ans :
       simple avertissement, pas un blocage, pour laisser la main aux cas déjà
       en place. */
    const ageMin = global.Carriere.ageMinimalGrade(obj.grade, obj.statut);
    if (ageMin !== null && obj.dateNaissance) {
      const age = anneeReference() - new Date(obj.dateNaissance).getFullYear();
      if (age < ageMin && !confirm('Un agent ACDPCTD (AME) ne peut normalement bénéficier du grade '
        + obj.grade + ' qu\'à partir de ' + ageMin + ' ans (il a ' + age + ' an(s) au 31 décembre '
        + anneeReference() + '). Enregistrer quand même ?')) return;
    }
    enregistrer('personnel', obj, id, renderPersonnel);
  }
  function deletePersonnel(id) {
    if (!confirm('Supprimer cet agent ?')) return;
    data.personnel = data.personnel.filter(x => x.id != id);
    saveData();
    renderPersonnel();
  }

  /* ---------------- Personnel administratif et de soutien ---------------- */

  /* Administratif et Éducateur partagent le même gabarit de ligne (grade,
     ancienneté, retraite) : ce sont des agents affectés, avec une carrière à
     suivre. Soutien reste plus sommaire (qualité, statut, âge). La catégorie
     Éducateur (rubrique « Enseignants ACDPCTD (AME) ») regroupe à la fois les
     ACDPCTD — dont les AME, l'ancienne appellation — et les Éducateurs à
     statut propre : sa colonne Titre distingue les deux à l'affichage. */
  const IDS_CATEGORIE = {
    Administratif: ['searchAdmin', 'administratifTable'],
    'Éducateur': ['searchEducateur', 'educateurTable'],
    Soutien: ['searchSoutien', 'soutienTable']
  };
  const GABARIT_CARRIERE = ['Administratif', 'Éducateur'];

  function renderCategorie(categorie) {
    const [champRecherche, cible] = IDS_CATEGORIE[categorie] || IDS_CATEGORIE.Soutien;
    const el = document.getElementById(champRecherche);
    const s2 = (el ? el.value : '').toLowerCase();

    const liste = data.personnel.filter(p => (p.categorie || 'Enseignant') === categorie
      && (!s2 || (p.nom || '').toLowerCase().indexOf(s2) >= 0
        || String(p.matricule || '').toLowerCase().indexOf(s2) >= 0
        || String(p.fonction || '').toLowerCase().indexOf(s2) >= 0));

    const boutons = p => '<td class="actions">'
      + '<button class="btn btn-info btn-sm" title="Changer la situation" '
      + 'onclick="changerSituation(\'' + p.id + '\')">🔀</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editPersonnel(\'' + p.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deletePersonnel(\'' + p.id + '\')">🗑️</button>'
      + '</td>';

    document.getElementById(cible).innerHTML = liste.map(p => {
      const anc = global.Carriere.anciennetes(p, anneeReference());
      const sit = global.Carriere.situationDe(p);
      const cellSituation = '<td><span class="badge badge-' + sit.ton + '">'
        + echapper(sit.libelle) + '</span></td>';
      if (GABARIT_CARRIERE.indexOf(categorie) >= 0) {
        /* Un agent sans école reconnue est un agent du Service CS (bureau de
           la circonscription) : son poste au bureau (CDS, CCS, CP de Zone…),
           saisi dans « Cours tenu » faute d'un champ dédié, ou l'ancien champ
           libre p.poste, s'affiche alors à côté pour le préciser. */
        const ecoleOuService = p.ecoleId ? nomEcole(p.ecoleId)
          : ('Service CS' + (p.cours || p.poste ? ' — ' + (p.cours || p.poste) : ''));
        /* La catégorie Éducateur mélange deux statuts distincts (ACDPCTD, dont
           les AME, et Éducateur) : cette colonne porte le titre exact de
           chaque agent, pour que les AME s'affichent bien sous « ACDPCTD
           (AME) » plutôt que sous une étiquette générique. */
        const celluleTitre = categorie === 'Éducateur'
          ? '<td>' + echapper(global.Carriere.groupeDePersonnel(p)) + '</td>' : '';
        return '<tr' + (sit.actif ? '' : ' style="opacity:.72;"') + '>' + cellSituation
          + '<td>' + echapper(p.matricule || '—') + '</td><td><b>' + echapper(p.nom)
          + '</b></td><td>' + echapper(p.sexe || '—') + '</td>' + celluleTitre
          + '<td>' + echapper(p.fonction || '—')
          + '</td><td>' + echapper(p.grade || '—') + '</td><td>' + echapper(ecoleOuService)
          + '</td><td>' + (anc.fonctionPublique === null ? '—' : anc.fonctionPublique + ' an(s)')
          + '</td><td>' + formatDate(global.Carriere.dateRetraite(p.dateNaissance, p.grade, p.statut))
          + '</td>' + boutons(p) + '</tr>';
      }
      const age = p.dateNaissance
        ? Math.max(0, anneeReference() - new Date(p.dateNaissance).getFullYear()) : (p.age || '—');
      return '<tr' + (sit.actif ? '' : ' style="opacity:.72;"') + '>' + cellSituation
        + '<td>' + echapper(p.matricule || '—') + '</td><td><b>' + echapper(p.nom)
        + '</b></td><td>' + echapper(p.sexe || '—') + '</td><td>' + echapper(p.qualite || p.fonction || '—')
        + '</td><td>' + echapper(p.statut || '—') + '</td><td>' + echapper(nomEcole(p.ecoleId))
        + '</td><td>' + age + '</td>' + boutons(p) + '</tr>';
    }).join('') || '<tr><td colspan="'
      + (categorie === 'Éducateur' ? 11 : (GABARIT_CARRIERE.indexOf(categorie) >= 0 ? 10 : 9))
      + '" class="text-center">Aucun agent enregistré</td></tr>';
  }

  /**
   * Détecte, dans le personnel administratif déjà enregistré, les agents qui
   * sont en réalité des enseignants (rattachés à une vraie école, avec une
   * fonction ou un cours d'enseignant) — restés « Administratif » depuis
   * avant que l'import ne le reconnaisse correctement.
   */
  function detecterAdministratifsMalClasses() {
    const FONCTIONS_ENSEIGNANTES = ['Directeur', 'Adjoint', 'Instituteur', 'Éducateur'];
    return data.personnel.filter(p => p.categorie === 'Administratif'
      && p.ecoleId && data.ecoles.some(e => e.id === p.ecoleId)
      && !texteDesigneLeBureau(p.poste || '')
      && (FONCTIONS_ENSEIGNANTES.indexOf(p.fonction) >= 0 || !!p.cours));
  }

  /** Bouton « Vérifier les catégories » : propose de reclasser ces agents,
      sans jamais le faire sans confirmation explicite. */
  function verifierCategoriesAdministratif() {
    const suspects = detecterAdministratifsMalClasses();
    if (!suspects.length) {
      alert('Aucun agent enseignant mal classé n’a été détecté dans le personnel administratif.');
      return;
    }
    const noms = suspects.map(p => '- ' + (p.nom || '—') + ' ('
      + (p.fonction || p.poste || '—') + ', ' + nomEcole(p.ecoleId) + ')').join('\n');
    if (!confirm(suspects.length + ' agent(s) semblent en réalité enseignants, et non membres '
      + 'du personnel administratif :\n\n' + noms
      + '\n\nLes reclasser maintenant (Enseignant, ou Éducateur pour les ACDPCTD) ?')) return;
    suspects.forEach(p => {
      p.categorie = global.Carriere.estStatutACDPCTD(p.statut) ? 'Éducateur' : 'Enseignant';
    });
    saveData();
    renderCategorie('Administratif');
    alert(suspects.length + ' agent(s) reclassé(s).');
  }

  /* ---------------- Examen blanc ---------------- */

  const E = () => global.ExamenBlanc;

  function centres() {
    if (!data.centres.length) {
      data.centres = E().CENTRES.map(nom => ({
        id: uid(), nom: nom, chef: '', dateComposition: '', session: anneeActive()
      }));
      saveData();
    }
    return data.centres;
  }

  function centreCourant() {
    const sel = document.getElementById('filterCentre');
    const liste = centres();
    if (!sel) return liste[0];
    return liste.find(c => c.id == sel.value) || liste[0];
  }

  function candidatsDe(centreId) {
    return data.compositions.filter(c => c.centreId == centreId);
  }

  function renderExamen() {
    const sel = document.getElementById('filterCentre');
    const liste = centres();
    if (!sel.options.length) {
      sel.innerHTML = liste.map(c => '<option value="' + c.id + '">'
        + echapper(c.nom) + '</option>').join('');
    }
    const centre = centreCourant();
    const rech = (document.getElementById('searchCandidat').value || '').toLowerCase();
    const tous = candidatsDe(centre.id);
    const b = E().bilan(tous);

    document.getElementById('resumeExamen').innerHTML =
      carte(b.inscrits, 'Inscrits (' + b.g.inscrits + ' G / ' + b.f.inscrits + ' F)')
      + carte(b.composes, 'Ont composé', b.absents ? 'yellow' : 'blue')
      + carte(b.admis, 'Ont atteint le seuil')
      + carte(b.taux === null ? '—' : b.taux + ' %', 'Taux de réussite',
        b.taux !== null && b.taux < 60 ? 'red' : '');

    document.getElementById('enteteExamen').innerHTML =
      '<th>Rang</th><th>Nom et prénoms</th><th>Sexe</th><th>École de provenance</th>'
      + E().MATIERES.map(m => '<th title="' + echapper(m.libelle) + '">' + m.abrege + '</th>').join('')
      + '<th>Total</th><th>Moyenne</th><th>Maîtrises</th><th>Seuil</th><th>Actions</th>';

    const classes = b.classes
      .filter(x => !rech || (x.candidat.nom || '').toLowerCase().indexOf(rech) >= 0)
      .sort((a, c) => (a.rang || 9999) - (c.rang || 9999));

    document.getElementById('examenTable').innerHTML = classes.map(x =>
      '<tr><td><b>' + (x.rang || '—') + '</b></td>'
      + '<td>' + echapper(x.candidat.nom) + '</td>'
      + '<td>' + echapper(x.candidat.sexe || '—') + '</td>'
      + '<td>' + echapper(x.candidat.ecoleNom || nomEcole(x.candidat.ecoleId)) + '</td>'
      + x.notes.map(n => '<td' + (n !== null && n < E().SEUIL_MATIERE
        ? ' style="color:#b91c1c;"' : '') + '>' + (n === null ? '—' : n) + '</td>').join('')
      + '<td><b>' + (x.aCompose ? x.total : '—') + '</b></td>'
      + '<td>' + (x.moyenne === null ? '—' : x.moyenne) + '</td>'
      + '<td>' + (x.aCompose ? x.maitrises + ' / ' + x.composees : '—') + '</td>'
      + '<td>' + (!x.aCompose ? '<span class="badge badge-info">absent</span>'
        : '<span class="badge badge-' + (x.admis ? 'success' : 'danger') + '">'
        + (x.admis ? 'atteint' : 'non atteint') + '</span>') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="openCandidatModal(\'' + x.candidat.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="supprimerCandidat(\'' + x.candidat.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="' + (E().MATIERES.length + 9) + '" class="text-center">'
        + 'Aucun candidat dans ce centre.</td></tr>';

    document.getElementById('matieresTable').innerHTML = b.matieres.map(m =>
      '<tr><td>' + echapper(m.matiere.libelle) + '</td><td>' + m.notes + '</td>'
      + '<td>' + (m.moyenne === null ? '—' : m.moyenne + '/20') + '</td>'
      + '<td>' + m.maitrises + '</td>'
      + '<td><span class="badge badge-' + (m.taux >= 75 ? 'success'
        : (m.taux >= 60 ? 'warning' : 'danger')) + '">' + m.taux + ' %</span></td>'
      + '<td>' + m.ecartType + '</td></tr>').join('')
      || '<tr><td colspan="6" class="text-center">Aucune note saisie</td></tr>';

    document.getElementById('recommandations').innerHTML =
      '<ul style="padding-left:18px;line-height:1.7;">'
      + E().recommandations(b).map(r => '<li>' + echapper(r) + '</li>').join('') + '</ul>';

    /* Synthèse de tous les centres */
    let tG = 0, tF = 0, tC = 0, tA = 0;
    document.getElementById('centresTable').innerHTML = centres().map(c => {
      const bb = E().bilan(candidatsDe(c.id));
      const ecoles = new Set(candidatsDe(c.id)
        .map(x => x.ecoleNom || nomEcole(x.ecoleId)).filter(Boolean)).size;
      tG += bb.g.inscrits; tF += bb.f.inscrits; tC += bb.composes; tA += bb.admis;
      return '<tr><td>' + echapper(c.nom) + '</td><td>' + ecoles + '</td>'
        + '<td>' + bb.g.inscrits + '</td><td>' + bb.f.inscrits + '</td>'
        + '<td><b>' + bb.inscrits + '</b></td><td>' + bb.composes + '</td>'
        + '<td>' + bb.admis + '</td>'
        + '<td>' + (bb.g.taux === null ? '—' : bb.g.taux + ' %') + '</td>'
        + '<td>' + (bb.f.taux === null ? '—' : bb.f.taux + ' %') + '</td>'
        + '<td>' + (bb.taux === null ? '—' : bb.taux + ' %') + '</td>'
        + '<td>' + (bb.moyenneCentre === null ? '—' : bb.moyenneCentre) + '</td>'
        + '<td>' + bb.ecartTypeMoyennes + '</td></tr>';
    }).join('')
      + '<tr style="background:#f1f5f9;"><td><b>Circonscription</b></td><td><b>—</b></td>'
      + '<td><b>' + tG + '</b></td><td><b>' + tF + '</b></td>'
      + '<td><b>' + (tG + tF) + '</b></td><td><b>' + tC + '</b></td>'
      + '<td><b>' + tA + '</b></td><td>—</td><td>—</td>'
      + '<td><b>' + (tC ? Math.round(tA / tC * 1000) / 10 + ' %' : '—') + '</b></td>'
      + '<td>—</td><td>—</td></tr>';
  }

  function openCentreModal() {
    const c = centreCourant();
    openModal('Régler ' + c.nom,
      '<form onsubmit="saveCentre(event, \'' + c.id + '\')"><div class="form-grid">'
      + champ('Nom du centre', 'nom', c.nom)
      + champ('Chef de centre', 'chef', c.chef)
      + '<div class="form-group"><label>Date de composition</label>'
      + '<input type="date" name="dateComposition" value="' + echapper(c.dateComposition || '') + '"></div>'
      + champ('Session', 'session', c.session || anneeActive())
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveCentre(ev, id) {
    ev.preventDefault();
    const c = data.centres.find(x => x.id == id);
    if (c) Object.assign(c, Object.fromEntries(new FormData(ev.target)));
    saveData();
    closeModal();
    document.getElementById('filterCentre').innerHTML = '';
    renderExamen();
  }

  function openCandidatModal(id) {
    const c = id ? data.compositions.find(x => x.id == id) || {} : {};
    const centre = centreCourant();
    openModal(id ? 'Modifier un candidat' : 'Inscrire un candidat — ' + centre.nom,
      '<form onsubmit="saveCandidat(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Candidat</h4><div class="form-grid">'
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(c.nom || '') + '" required></div>'
      + selecteur('Sexe *', 'sexe', [['G', 'Garçon'], ['F', 'Fille']], c.sexe, true)
      + '<div class="form-group"><label>École de provenance</label>'
      + '<select name="ecoleId">' + '<option value="">—</option>'
      + optionsEcoles(c.ecoleId) + '</select></div>'
      + '</div></div>'
      + '<div class="form-section"><h4>Notes sur 20</h4>'
      + '<p style="font-size:12px;color:#64748b;" class="mb-15">Laissez vide une épreuve non '
      + 'composée : elle sort du calcul au lieu de compter zéro.</p><div class="form-grid">'
      + E().MATIERES.map(m => '<div class="form-group"><label>' + m.libelle + '</label>'
        + '<input type="number" step="0.25" min="0" max="20" name="' + m.cle + '" value="'
        + echapper(c[m.cle] === undefined ? '' : c[m.cle]) + '"></div>').join('')
      + '</div></div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveCandidat(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    obj.centreId = centreCourant().id;
    if (id) {
      const idx = data.compositions.findIndex(x => x.id == id);
      if (idx >= 0) data.compositions[idx] = Object.assign({}, data.compositions[idx], obj);
    } else {
      obj.id = uid();
      data.compositions.push(obj);
    }
    saveData();
    closeModal();
    renderExamen();
  }

  function supprimerCandidat(id) {
    if (!confirm('Retirer ce candidat ?')) return;
    data.compositions = data.compositions.filter(x => x.id != id);
    saveData();
    renderExamen();
  }

  /** Procès-verbal du centre, avec cachet, signature et code QR. */
  function editerPV() {
    const c = centreCourant();
    const b = E().bilan(candidatsDe(c.id));
    const cs = identiteCS();

    const entete = '<tr><th>Rang</th><th>N°</th><th>Nom et prénoms</th><th>Sexe</th>'
      + '<th>École de provenance</th>'
      + E().MATIERES.map(m => '<th>' + m.abrege + '</th>').join('')
      + '<th>Total</th><th>Moyenne</th><th>Maîtrises</th></tr>';
    const corps = b.classes.slice().sort((a, d) => (a.rang || 9999) - (d.rang || 9999))
      .map((x, i) => '<tr><td>' + (x.rang || '—') + '</td><td>' + (i + 1) + '</td>'
        + '<td>' + echapper(x.candidat.nom) + '</td><td>' + echapper(x.candidat.sexe || '') + '</td>'
        + '<td>' + echapper(x.candidat.ecoleNom || nomEcole(x.candidat.ecoleId)) + '</td>'
        + x.notes.map(n => '<td>' + (n === null ? '' : n) + '</td>').join('')
        + '<td>' + (x.aCompose ? x.total : '') + '</td>'
        + '<td>' + (x.moyenne === null ? '' : x.moyenne) + '</td>'
        + '<td>' + (x.aCompose ? x.maitrises : '') + '</td></tr>').join('');

    openModal('Procès-verbal — ' + c.nom,
      '<div style="border:2px solid #006633;padding:18px;">'
      + '<div class="text-center"><b>RÉPUBLIQUE DU BÉNIN</b><br>'
      + 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>'
      + 'DDEMP PLATEAU — CIRCONSCRIPTION SCOLAIRE DE POBÈ<br>'
      + '<h2 style="color:#006633;margin:10px 0;">PROCÈS-VERBAL D’EXAMEN BLANC DU CEP</h2>'
      + '<b>' + echapper(c.nom) + '</b> — session ' + echapper(c.session || anneeActive())
      + (c.dateComposition ? ' — composition du ' + formatDate(c.dateComposition) : '')
      + (c.chef ? '<br>Chef de centre : ' + echapper(c.chef) : '') + '</div>'
      + '<table style="width:100%;font-size:11px;margin-top:14px;"><thead>' + entete
      + '</thead><tbody>' + corps + '</tbody></table>'
      + '<h4 style="margin-top:14px;color:#006633;">Participation et réussite</h4>'
      + '<table style="width:100%;font-size:12px;"><thead><tr><th>Indicateur</th>'
      + '<th>Garçons</th><th>Filles</th><th>Total</th></tr></thead><tbody>'
      + [['Inscrits', b.g.inscrits, b.f.inscrits, b.inscrits],
         ['Ont composé', b.g.composes, b.f.composes, b.composes],
         ['Ont atteint le seuil', b.g.admis, b.f.admis, b.admis],
         ['Taux de réussite', (b.g.taux === null ? '—' : b.g.taux + ' %'),
          (b.f.taux === null ? '—' : b.f.taux + ' %'),
          (b.taux === null ? '—' : b.taux + ' %')]]
        .map(l => '<tr><td>' + l[0] + '</td><td>' + l[1] + '</td><td>' + l[2]
          + '</td><td><b>' + l[3] + '</b></td></tr>').join('')
      + '</tbody></table>'
      + '<p class="petit muet mt-15">Le seuil de réussite demande '
      + E().MAITRISES_REQUISES + ' maîtrises sur les ' + E().MATIERES.length
      + ' épreuves — ' + E().MAITRISES_REQUISES + ' sur ' + (E().MATIERES.length - 1)
      + ' pour un candidat dispensé d’EPS. Une épreuve est maîtrisée à partir de '
      + E().SEUIL_MATIERE + '/20.</p>'
      + '<h4 style="margin-top:14px;color:#E8112D;">Recommandations</h4>'
      + '<ul style="padding-left:18px;line-height:1.6;">'
      + E().recommandations(b).map(r => '<li>' + echapper(r) + '</li>').join('') + '</ul>'
      + piedDocument(null, 'PV-EXAMEN', c.id, 'Le Chef de la Circonscription Scolaire')
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Cachets et signatures ---------------- */

  /* Les trois cachets de la circonscription : le chef, le secrétariat et la
     division de l'organisation scolaire et de la prévision. */
  const CACHETS_CS = [
    { code: 'CCS', nom: 'Chef de la Circonscription Scolaire',
      cachet_centre: 'Le Chef de la Circonscription Scolaire',
      libelleSignature: 'Le Chef de la Circonscription Scolaire' },
    { code: 'SEC', nom: 'Secrétariat de la Circonscription',
      cachet_centre: 'Le Secrétariat',
      libelleSignature: 'Le Secrétariat de la Circonscription Scolaire' },
    { code: 'DOSP', nom: 'Division de l’Organisation Scolaire et de la Prévision',
      cachet_centre: 'Le C/DOSP',
      libelleSignature: 'Le Chef de la Division de l’Organisation Scolaire et de la Prévision' }
  ];

  function identitesCS() {
    let change = false;
    /* Un cachet par conseiller pédagogique de zone, en plus des trois services
       de la circonscription. */
    const modeles = CACHETS_CS.concat(global.Donnees.ZONES.map(z => ({
      code: 'CP-' + z.replace(/\s+/g, ''),
      nom: 'Conseiller pédagogique — ' + z,
      cachet_centre: 'Le Conseiller Pédagogique',
      cachet_bas: 'CIRCONSCRIPTION SCOLAIRE DE POBÈ — ' + z.toUpperCase(),
      libelleSignature: 'Le Conseiller Pédagogique de la ' + z,
      zone: z
    })));
    modeles.forEach(modele => {
      if (!data.identite.some(x => x.code === modele.code)) {
        data.identite.push({
          id: uid(), code: modele.code, nom: modele.nom,
          cachet_haut: 'RÉPUBLIQUE DU BÉNIN',
          cachet_centre: modele.cachet_centre,
          cachet_bas: modele.cachet_bas || 'CIRCONSCRIPTION SCOLAIRE DE POBÈ',
          zone: modele.zone,
          cachet_couleur: 'BLEU',
          libelleSignature: modele.libelleSignature
        });
        change = true;
      }
    });
    if (change) saveData();
    return data.identite;
  }

  /* Le chef de circonscription signe les documents par défaut. */
  function identiteCS(code) {
    const toutes = identitesCS();
    return toutes.filter(x => x.code === (code || 'CCS'))[0] || toutes[0];
  }

  /* Les armoiries et le sceau sont rangés avec l'identité du chef de
     circonscription : déposés une fois, ils servent à tous les documents. */
  /* Les armoiries livrées avec l'application servent par défaut ; celles que la
     circonscription dépose prennent le pas sur elles. */
  function emblemes() {
    const cs = identiteCS('CCS');
    return {
      armoiries: cs.armoiries || (global.Embleme && global.Embleme.ARMOIRIES) || '',
      sceau: cs.sceau
    };
  }

  function enteteDocument(options) {
    return global.Pieces.enteteOfficiel(Object.assign({ emblemes: emblemes() },
      options || {}));
  }

  function chargerEmbleme(input, quoi) {
    const fichier = input.files && input.files[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const max = 260;
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const toile = document.createElement('canvas');
        toile.width = Math.round(img.width * ratio);
        toile.height = Math.round(img.height * ratio);
        toile.getContext('2d').drawImage(img, 0, 0, toile.width, toile.height);
        const cs = identiteCS('CCS');
        cs[quoi] = toile.toDataURL('image/png');
        saveData();
        renderIdentite();
      };
      img.src = ev.target.result;
    };
    lecteur.readAsDataURL(fichier);
  }

  function retirerEmbleme(quoi) {
    const cs = identiteCS('CCS');
    delete cs[quoi];
    saveData();
    renderIdentite();
  }

  function renderIdentite() {
    const emb = emblemes();
    const zoneEmblemes = document.getElementById('zoneEmblemes');
    if (zoneEmblemes) {
      zoneEmblemes.innerHTML = '<div class="apercu-cachet">'
        + [['armoiries', 'Armoiries de la République'], ['sceau', 'Sceau ou logo du ministère']]
          .map(([cle, libelle]) => '<div class="text-center">'
            + '<div style="min-height:76px;display:flex;align-items:center;justify-content:center;">'
            + (emb[cle] ? '<img src="' + emb[cle] + '" style="max-height:72px;">'
              : global.Pieces.drapeau(30)) + '</div>'
            + (cle === 'armoiries' && !identiteCS('CCS').armoiries
              ? '<div class="petit muet">Armoiries livrées avec l’application</div>' : '')
            + '<div class="petit muet mb-15">' + libelle + '</div>'
            + '<input type="file" accept="image/*" style="max-width:210px;" '
            + 'onchange="chargerEmbleme(this, \'' + cle + '\')">'
            + (emb[cle] ? ' <button class="btn btn-danger btn-sm" onclick="retirerEmbleme(\''
              + cle + '\')">Retirer</button>' : '') + '</div>').join('')
        + '<div class="petit muet" style="max-width:320px;">Ces images figurent en tête de '
        + 'toutes les fiches et de tous les certificats. Elles restent sur cet ordinateur. '
        + 'Tant qu’elles ne sont pas déposées, le drapeau national tient leur place.</div>'
        + '</div>';
    }

    /* Les cachets des responsables de la circonscription (chef, secrétariat,
       DOSP, conseillers pédagogiques) n'ont rien à faire sur le poste d'une
       école : seul le cachet propre de l'école y figure. */
    const blocCS = document.getElementById('blocIdentiteCS');
    if (blocCS) blocCS.classList.toggle('hidden', global.Config.estEcole());
    if (global.Config.estEcole()) {
      const zoneCS = document.getElementById('identiteCS');
      if (zoneCS) zoneCS.innerHTML = '';
    } else {
    document.getElementById('identiteCS').innerHTML = identitesCS().map(cs =>
      '<div class="apercu-cachet" style="border-bottom:1px solid #e2e8f0;padding:12px 0;">'
      + global.Pieces.cachet(cs, { taille: 118 })
      + '<div style="min-width:190px;"><b>' + echapper(cs.nom) + '</b></div>'
      + global.Pieces.blocSignature(cs, cs.libelleSignature || cs.nom)
      + '<div><button class="btn btn-warning" onclick="reglerCachet(\'' + cs.code
      + '\')">✏️ Régler le cachet</button> '
      + '<button class="btn btn-info" onclick="signer(\'' + cs.code + '\')">✍️ '
      + (cs.signature_image ? 'Modifier la signature' : 'Signer') + '</button> '
      + '<button class="btn btn-primary" onclick="apercuCachetCS(\'' + cs.code
      + '\')">👁️</button></div></div>').join('');
    }

    const rech = (document.getElementById('searchIdentite').value || '').toLowerCase();
    const liste = data.ecoles.filter(e => !rech || (e.nom || '').toLowerCase().indexOf(rech) >= 0)
      .slice(0, 200);

    /* Les enseignants signent aussi : registres, relevés, bulletins. */
    const agents = data.personnel.filter(p =>
      (!rech || (p.nom || '').toLowerCase().indexOf(rech) >= 0)
      && global.Carriere.estActif(p)).slice(0, 200);
    const zoneAgents = document.getElementById('signaturesPersonnel');
    if (zoneAgents) {
      zoneAgents.innerHTML = agents.map(p =>
        '<tr><td><b>' + echapper(p.nom) + '</b><br><span class="petit muet">'
        + echapper(p.fonction || '—') + ' · ' + echapper(nomEcole(p.ecoleId))
        + '</span></td>'
        + '<td>' + (p.signature_image
          ? '<img src="' + p.signature_image + '" style="max-height:40px;">'
          : '<span class="badge badge-warning">à enregistrer</span>') + '</td>'
        + '<td class="actions">'
        + '<button class="btn btn-info btn-sm" onclick="signerAgent(\'' + p.id + '\')">✍️</button>'
        + (p.signature_image
          ? '<button class="btn btn-danger btn-sm" onclick="effacerSignatureAgent(\''
            + p.id + '\')">🗑️</button>' : '')
        + '</td></tr>').join('')
        || '<tr><td colspan="3" class="text-center">Aucun agent enregistré</td></tr>';
    }

    document.getElementById('identiteTable').innerHTML = liste.map(e =>
      '<tr><td>' + echapper(e.nom) + '</td><td>' + echapper(e.directeur || '—') + '</td>'
      + '<td>' + global.Pieces.cachet(porteurEcole(e), { taille: 64 }) + '</td>'
      + '<td>' + (e.signature_image
        ? '<img src="' + e.signature_image + '" style="max-height:38px;">'
        : '<span class="badge badge-warning">à enregistrer</span>') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="reglerCachet(\'' + e.id + '\')">✏️</button>'
      + '<button class="btn btn-info btn-sm" onclick="signer(\'' + e.id + '\')">✍️</button>'
      + '<button class="btn btn-primary btn-sm" onclick="apercuPiece(\'' + e.id + '\')">👁️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="5" class="text-center">Aucune école</td></tr>';
  }

  function signerAgent(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    global.Pieces.capturerSignature(p.nom, p.signature_image, image => {
      p.signature_image = image;
      saveData();
      renderIdentite();
    });
  }

  function effacerSignatureAgent(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p || !confirm('Effacer la signature de ' + p.nom + ' ?')) return;
    delete p.signature_image;
    saveData();
    renderIdentite();
  }

  /* Le cachet d'une école reprend son nom si rien n'a été réglé. */
  function porteurEcole(e) {
    return {
      nom: e.nom, code: e.code,
      cachet_haut: e.cachet_haut || 'RÉPUBLIQUE DU BÉNIN',
      cachet_centre: e.cachet_centre || 'LE DIRECTEUR',
      cachet_bas: e.cachet_bas || e.nom,
      cachet_couleur: e.cachet_couleur || 'BLEU',
      cachet_forme: e.cachet_forme || 'ROND', cachet_nom: e.cachet_nom || e.directeur || '',
      signature_image: e.signature_image
    };
  }

  function porteurDe(cible) {
    const cs = identitesCS().filter(x => x.code === cible)[0];
    if (cs) return cs;
    if (cible === 'CS') return identiteCS();
    return data.ecoles.find(x => x.id == cible) || null;
  }

  function reglerCachet(cible) {
    const e = porteurDe(cible);
    if (!e) return;
    const p = e.code && !e.type ? e : porteurEcole(e);
    openModal('Régler le cachet — ' + (e.nom || ''),
      '<div id="apercuCachet" class="text-center mb-15">' + global.Pieces.cachet(p) + '</div>'
      + '<form onsubmit="saveCachet(event, \'' + cible + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>Texte du haut</label><input name="cachet_haut" value="'
      + echapper(p.cachet_haut) + '" oninput="majApercuCachet()"></div>'
      + '<div class="form-group"><label>Texte central</label><input name="cachet_centre" value="'
      + echapper(p.cachet_centre) + '" oninput="majApercuCachet()"></div>'
      + '<div class="form-group"><label>Texte du bas</label><input name="cachet_bas" value="'
      + echapper(p.cachet_bas) + '" oninput="majApercuCachet()"></div>'
      + (cible === 'CS' || (e.code && !e.type)
        ? '<div class="form-group"><label>Nom et prénoms du responsable</label>'
          + '<input name="responsable" value="' + echapper(e.responsable || '') + '"></div>'
        : '')
      + '<div class="form-group"><label>Forme du cachet</label><select name="cachet_forme" onchange="majApercuCachet()">'
      + [['ROND', 'Rond'], ['RECT', 'Rectangulaire (armoiries)']].map(f => '<option value="' + f[0] + '"' + ((p.cachet_forme || 'ROND') === f[0] ? ' selected' : '') + '>' + f[1] + '</option>').join('')
      + '</select></div>'
      + '<div class="form-group"><label>Nom du titulaire (sur le cachet)</label><input name="cachet_nom" value="' + echapper(p.cachet_nom || '') + '" oninput="majApercuCachet()"></div>'
      + '<div class="form-group"><label>Encre</label><select name="cachet_couleur" '
      + 'onchange="majApercuCachet()">'
      + ['BLEU', 'ROUGE', 'NOIR'].map(c => '<option value="' + c + '"'
        + (p.cachet_couleur === c ? ' selected' : '') + '>' + c.charAt(0)
        + c.slice(1).toLowerCase() + '</option>').join('')
      + '</select></div></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function majApercuCachet() {
    const form = document.querySelector('#modalBody form');
    const zone = document.getElementById('apercuCachet');
    if (!form || !zone) return;
    const lire = n => (form.querySelector('[name=' + n + ']') || {}).value || '';
    zone.innerHTML = global.Pieces.cachet({
      cachet_haut: lire('cachet_haut'), cachet_centre: lire('cachet_centre'),
      cachet_bas: lire('cachet_bas'), cachet_couleur: lire('cachet_couleur'),
      cachet_forme: lire('cachet_forme') || 'ROND', cachet_nom: lire('cachet_nom')
    });
  }

  function saveCachet(ev, cible) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    const e = porteurDe(cible);
    if (e) Object.assign(e, obj);
    saveData();
    closeModal();
    renderIdentite();
  }

  function signer(cible) {
    const e = porteurDe(cible);
    if (!e) return;
    global.Pieces.capturerSignature(e.nom || 'Signature', e.signature_image, image => {
      e.signature_image = image;
      saveData();
      renderIdentite();
    });
  }

  /** Aperçu d'un document signé par l'un des trois services. */
  function apercuCachetCS(code) {
    const cs = identiteCS(code);
    openModal('Aperçu — ' + cs.nom,
      '<div style="border:2px solid #006633;padding:20px;">'
      + '<div class="text-center"><b>RÉPUBLIQUE DU BÉNIN</b><br>'
      + 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>'
      + 'CIRCONSCRIPTION SCOLAIRE DE POBÈ<br><b>' + echapper(cs.nom) + '</b></div>'
      + '<p class="mt-15">Ce document porte le cachet du service, la signature de son '
      + 'responsable et un code QR qui permet d’en vérifier l’origine.</p>'
      + '<div class="pied-document">'
      + global.Pieces.blocVerification('APERCU-' + cs.code, cs.id, cs.nom)
      + '<div>' + global.Pieces.cachet(cs, { taille: 108 }) + '</div>'
      + global.Pieces.blocSignature(cs, cs.libelleSignature || cs.nom)
      + '</div></div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /** Montre ce que donneront les pièces sur un document réel. */
  function apercuPiece(id) {
    const e = data.ecoles.find(x => x.id == id);
    if (!e) return;
    const cs = identiteCS();
    openModal('Aperçu des pièces — ' + e.nom,
      '<div style="border:2px solid #006633;padding:20px;">'
      + '<div class="text-center"><b>RÉPUBLIQUE DU BÉNIN</b><br>'
      + 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>'
      + 'CIRCONSCRIPTION SCOLAIRE DE POBÈ<br><b>' + echapper(e.nom) + '</b></div>'
      + '<p class="mt-15">Ce document porte le cachet de l’école, la signature de son '
      + 'directeur et un code QR qui permet d’en vérifier l’origine.</p>'
      + piedDocument(e, 'APERCU', e.id, 'Le Directeur') + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /**
   * Le pied de page commun à toutes les pièces : vérification à gauche,
   * cachet au centre, signature à droite.
   */
  function piedDocument(ecole, type, cle, libelle, service) {
    const porteur = ecole ? porteurEcole(ecole) : identiteCS(service);
    return '<div class="pied-document">'
      + global.Pieces.blocVerification(type, cle, (ecole ? ecole.nom : 'CS') + '|' + cle)
      + '<div>' + global.Pieces.cachet(porteur, { taille: 96 }) + '</div>'
      + global.Pieces.blocSignature(porteur, libelle || 'Le Directeur')
      + '</div>';
  }

  /* ---------------- Écoles à CM2 et candidats au CEP ---------------- */

  const SESSION_CEP = 'juin 2027';

  /** Le relevé d'effectifs de l'année active, école par école. */
  function releveDe(ecoleId) {
    return data.effectifs.filter(e => e.ecoleId == ecoleId
      && (!e.annee || e.annee === anneeActive()))[0] || null;
  }

  /** Candidats déclarés pour la session, créés à la volée. */
  function candidatureDe(ecoleId) {
    let c = data.cepSession.filter(x => x.ecoleId == ecoleId && x.session === SESSION_CEP)[0];
    if (!c) {
      c = { id: uid(), ecoleId: ecoleId, session: SESSION_CEP, candidatsG: '', candidatsF: '' };
      data.cepSession.push(c);
    }
    return c;
  }

  function lignesCM2() {
    return data.ecoles
      .filter(e => e.type === 'EPP' || e.type === 'EPPRIV')
      .map(e => {
        const r = releveDe(e.id);
        const g = r ? (parseInt(r.c_cm2_G, 10) || 0) : 0;
        const f = r ? (parseInt(r.c_cm2_F, 10) || 0) : 0;
        return { ecole: e, g: g, f: f, total: g + f };
      })
      .filter(l => l.total > 0)
      .map(l => {
        const c = candidatureDe(l.ecole.id);
        const cg = parseInt(c.candidatsG, 10);
        const cf = parseInt(c.candidatsF, 10);
        const saisi = !isNaN(cg) || !isNaN(cf);
        const candidats = (isNaN(cg) ? 0 : cg) + (isNaN(cf) ? 0 : cf);
        return Object.assign(l, {
          candidature: c, cg: isNaN(cg) ? 0 : cg, cf: isNaN(cf) ? 0 : cf,
          candidats: candidats, saisi: saisi,
          taux: saisi && l.total ? Math.round(candidats / l.total * 1000) / 10 : null
        });
      })
      .sort((a, b) => (a.ecole.nom || '').localeCompare(b.ecole.nom || '', 'fr'));
  }

  function renderCM2() {
    const rech = (document.getElementById('searchCm2').value || '').toLowerCase();
    const secteur = document.getElementById('filterSecteurCm2').value;
    const toutes = lignesCM2();
    const liste = toutes.filter(l =>
      (!rech || (l.ecole.nom || '').toLowerCase().indexOf(rech) >= 0)
      && (!secteur || l.ecole.type === secteur));

    const saisies = toutes.filter(l => l.saisi);
    const cm2Total = toutes.reduce((s2, l) => s2 + l.total, 0);
    const candTotal = saisies.reduce((s2, l) => s2 + l.candidats, 0);
    const cm2Saisi = saisies.reduce((s2, l) => s2 + l.total, 0);

    document.getElementById('resumeCm2').innerHTML =
      carte(toutes.length, 'Écoles à CM2')
      + carte(U(cm2Total), 'Élèves au CM2', 'blue')
      + carte(U(candTotal), 'Candidats déclarés', 'yellow')
      + carte(cm2Saisi ? (Math.round(candTotal / cm2Saisi * 1000) / 10) + ' %' : '—',
        'Taux de présentation', cm2Saisi && candTotal < cm2Saisi ? 'red' : '');

    document.getElementById('cm2Table').innerHTML = liste.map(l => {
      const manque = l.saisi ? l.total - l.candidats : null;
      const champ = (sexe, valeur) => '<input type="number" min="0" style="width:64px;" '
        + 'value="' + echapper(valeur) + '" onchange="majCandidats(\'' + l.ecole.id
        + '\',\'' + sexe + '\',this.value)">';
      return '<tr><td>' + echapper(l.ecole.nom) + '</td>'
        + '<td><span class="badge badge-info">'
        + (l.ecole.type === 'EPP' ? 'Public' : 'Privé') + '</span></td>'
        + '<td>' + echapper(l.ecole.arrondissement || '—') + '</td>'
        + '<td>' + l.g + '</td><td>' + l.f + '</td><td><b>' + l.total + '</b></td>'
        + '<td>' + champ('candidatsG', l.candidature.candidatsG) + '</td>'
        + '<td>' + champ('candidatsF', l.candidature.candidatsF) + '</td>'
        + '<td><b>' + (l.saisi ? l.candidats : '—') + '</b></td>'
        + '<td>' + (l.taux === null ? '—' : '<span class="badge badge-'
          + (l.taux >= 95 ? 'success' : (l.taux >= 80 ? 'warning' : 'danger')) + '">'
          + l.taux + ' %</span>') + '</td>'
        + '<td>' + (manque === null ? '—'
          : (manque > 0 ? '<span class="badge badge-danger">' + manque + '</span>'
            : (manque < 0 ? '<span class="badge badge-warning">+' + (-manque) + '</span>'
              : '<span class="badge badge-success">0</span>'))) + '</td></tr>';
    }).join('') || '<tr><td colspan="11" class="text-center">Aucune école à CM2 : '
      + 'les effectifs de ' + anneeActive() + ' ne sont pas encore saisis.</td></tr>';

    /* Synthèse : public, privé, puis ensemble. */
    const groupes = [['EPP', 'Primaire public'], ['EPPRIV', 'Primaire privé'],
      [null, 'Ensemble de la circonscription']];
    document.getElementById('cm2SyntheseTable').innerHTML = groupes.map(([type, libelle]) => {
      const sous = toutes.filter(l => !type || l.ecole.type === type);
      const dits = sous.filter(l => l.saisi);
      const cm2 = sous.reduce((s2, l) => s2 + l.total, 0);
      const base = dits.reduce((s2, l) => s2 + l.total, 0);
      const cand = dits.reduce((s2, l) => s2 + l.candidats, 0);
      const taux = base ? Math.round(cand / base * 1000) / 10 : null;
      const gras = !type;
      const c = v => gras ? '<td><b>' + v + '</b></td>' : '<td>' + v + '</td>';
      return '<tr' + (gras ? ' style="background:#f1f5f9;"' : '') + '>'
        + c(libelle) + c(sous.length)
        + c(sous.reduce((s2, l) => s2 + l.g, 0)) + c(sous.reduce((s2, l) => s2 + l.f, 0))
        + c(cm2) + c(dits.reduce((s2, l) => s2 + l.cg, 0))
        + c(dits.reduce((s2, l) => s2 + l.cf, 0)) + c(cand)
        + c(taux === null ? '—' : taux + ' %')
        + c(base ? (base - cand) : '—') + '</tr>';
    }).join('');
  }

  function U(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); }

  function majCandidats(ecoleId, sexe, valeur) {
    const c = candidatureDe(ecoleId);
    c[sexe] = valeur === '' ? '' : (parseInt(valeur, 10) || 0);
    saveData();
    renderCM2();
  }

  /* ---------------- Analyses et écarts ---------------- */

  function effectifsParEcole() {
    const par = {};
    data.effectifs.filter(e => !e.annee || e.annee === anneeActive()).forEach(e => {
      const c = par[e.ecoleId] = par[e.ecoleId] || { g: 0, f: 0 };
      c.g += parseInt(e.totalG, 10) || 0;
      c.f += parseInt(e.totalF, 10) || 0;
    });
    return par;
  }

  function carte(valeur, titre, ton) {
    return '<div class="stat-card ' + (ton || '') + '"><h4>' + titre
      + '</h4><div class="value">' + valeur + '</div></div>';
  }

  function renderAnalyses() {
    const eff = effectifsParEcole();
    const C = global.Carriere;

    /* 1. Écarts filles / garçons */
    const lignesGenre = data.ecoles
      .filter(e => eff[e.id])
      .map(e => Object.assign({ ecole: e }, C.ecartGenre(eff[e.id].g, eff[e.id].f)))
      .sort((a, b) => (a.partFilles || 0) - (b.partFilles || 0));

    const totalG = lignesGenre.reduce((s2, l) => s2 + l.g, 0);
    const totalF = lignesGenre.reduce((s2, l) => s2 + l.f, 0);
    const ensemble = C.ecartGenre(totalG, totalF);
    const ecartTypeParts = C.ecartType(lignesGenre.map(l => l.partFilles));

    document.getElementById('resumeGenre').innerHTML =
      carte(totalG + ' / ' + totalF, 'Garçons / filles')
      + carte((ensemble.partFilles === null ? '—' : ensemble.partFilles + ' %'), 'Part des filles',
        ensemble.partFilles !== null && Math.abs(ensemble.ecartPoints) > 5 ? 'red' : '')
      + carte((ensemble.ecart > 0 ? '+' : '') + ensemble.ecart, 'Écart filles − garçons', 'yellow')
      + carte(ecartTypeParts + ' pts', 'Écart type entre écoles', 'blue');

    document.getElementById('genreTable').innerHTML = lignesGenre.map(l =>
      '<tr><td>' + echapper(l.ecole.nom) + '</td><td>' + l.g + '</td><td>' + l.f + '</td>'
      + '<td><b>' + l.total + '</b></td>'
      + '<td>' + (l.ecart > 0 ? '+' : '') + l.ecart + '</td>'
      + '<td>' + (l.partFilles === null ? '—' : l.partFilles + ' %') + '</td>'
      + '<td><span class="badge badge-' + (Math.abs(l.ecartPoints) <= 5 ? 'success'
        : (Math.abs(l.ecartPoints) <= 10 ? 'warning' : 'danger')) + '">'
      + (l.ecartPoints > 0 ? '+' : '') + l.ecartPoints + ' pts</span></td></tr>').join('')
      || '<tr><td colspan="7" class="text-center">Aucun effectif saisi pour '
        + anneeActive() + '</td></tr>';

    /* 2. Classes autorisées et ouvertes */
    const lignesClasses = data.ecoles.map(e => Object.assign({ ecole: e }, C.ecartClasses(e)))
      .filter(l => l.autorisees || l.ouvertes)
      .sort((a, b) => a.ecart - b.ecart);
    const depassements = lignesClasses.filter(l => l.ecart > 0).length;
    const sous = lignesClasses.filter(l => l.ecart < 0).length;

    document.getElementById('resumeClasses').innerHTML =
      carte(lignesClasses.reduce((s2, l) => s2 + l.autorisees, 0), 'Classes autorisées')
      + carte(lignesClasses.reduce((s2, l) => s2 + l.ouvertes, 0), 'Classes ouvertes', 'blue')
      + carte(depassements, 'Écoles en dépassement', depassements ? 'red' : '')
      + carte(sous, 'Écoles en sous-ouverture', sous ? 'yellow' : '');

    document.getElementById('classesTable').innerHTML = lignesClasses.map(l =>
      '<tr><td>' + echapper(l.ecole.nom) + '</td><td>' + echapper(l.ecole.arrondissement || '—')
      + '</td><td>' + l.autorisees + '</td><td>' + l.ouvertes + '</td>'
      + '<td>' + (l.ecart > 0 ? '+' : '') + l.ecart + '</td>'
      + '<td><span class="badge badge-' + (l.etat === 'Conforme' ? 'success'
        : (l.etat === 'Dépassement' ? 'danger' : 'warning')) + '">' + l.etat + '</span></td></tr>')
      .join('') || '<tr><td colspan="6" class="text-center">Aucune donnée</td></tr>';

    /* 3. Besoins en enseignants */
    const parEcole = {};
    data.personnel.forEach(p => {
      (parEcole[p.ecoleId] = parEcole[p.ecoleId] || []).push(p);
    });
    const lignesEns = data.ecoles
      .map(e => Object.assign({ ecole: e }, C.besoinEnseignants(e, parEcole[e.id] || [])))
      .filter(l => l.classes || l.enseignants)
      .sort((a, b) => (b.renseignee ? 1 : 0) - (a.renseignee ? 1 : 0) || a.ecart - b.ecart);
    /* Les totaux ne portent que sur les écoles dont le personnel est saisi. */
    const renseignees = lignesEns.filter(l => l.renseignee);
    const deficit = renseignees.filter(l => l.ecart < 0);
    const surplus = renseignees.filter(l => l.ecart > 0);
    const aSaisir = lignesEns.length - renseignees.length;

    document.getElementById('resumeEnseignants').innerHTML =
      carte(renseignees.reduce((s2, l) => s2 + l.enseignants, 0), 'Enseignants en poste')
      + carte(Math.abs(deficit.reduce((s2, l) => s2 + l.ecart, 0)), 'Déficit cumulé',
        deficit.length ? 'red' : '')
      + carte(surplus.reduce((s2, l) => s2 + l.ecart, 0), 'Surplus cumulé', 'yellow')
      + carte(aSaisir, 'Écoles sans personnel saisi', aSaisir ? 'blue' : '');

    renderAges();
    renderPersonnelStatut();

    /* 4. Synthèse : primaire et maternelle, public et privé, séparément puis ensemble */
    const ventilation = C.ventiler(data.ecoles, e => {
      const cl = C.ecartClasses(e);
      const bes = C.besoinEnseignants(e, parEcole[e.id] || []);
      return {
        autorisees: cl.autorisees, ouvertes: cl.ouvertes,
        salles: Number(e.salles_utilisees) || 0,
        garcons: eff[e.id] ? eff[e.id].g : 0,
        filles: eff[e.id] ? eff[e.id].f : 0,
        enseignants: bes.enseignants,
        requis: bes.renseignee ? bes.requis : 0
      };
    });

    const ordre = ['EPP', 'EPPRIV', 'Primaire', 'EM', 'EMPRIV', 'Maternelle', 'TOTAL'];
    const gras = { Primaire: true, Maternelle: true, TOTAL: true };
    document.getElementById('syntheseTable').innerHTML = ordre.map(cle => {
      const l = ventilation[cle];
      const cellule = v => gras[cle] ? '<td><b>' + v + '</b></td>' : '<td>' + v + '</td>';
      const ecartClasses = l.ouvertes - l.autorisees;
      const ecartEns = l.enseignants - l.requis;
      return '<tr' + (gras[cle] ? ' style="background:#f1f5f9;"' : '') + '>'
        + cellule(echapper(l.libelle)) + cellule(l.ecoles)
        + cellule(l.autorisees) + cellule(l.ouvertes)
        + cellule((ecartClasses > 0 ? '+' : '') + ecartClasses)
        + cellule(l.salles) + cellule(l.garcons) + cellule(l.filles)
        + cellule(l.garcons + l.filles) + cellule(l.enseignants) + cellule(l.requis)
        + cellule((ecartEns > 0 ? '+' : '') + ecartEns) + '</tr>';
    }).join('');

    document.getElementById('enseignantsTable').innerHTML = lignesEns.map(l =>
      '<tr><td>' + echapper(l.ecole.nom) + '</td><td>' + l.classes + '</td>'
      + '<td>' + l.enseignants + '</td><td>' + l.requis + '</td>'
      + '<td>' + (l.ecart > 0 ? '+' : '') + l.ecart + '</td>'
      + '<td><span class="badge badge-' + (l.etat === 'Équilibre' ? 'success'
        : (l.etat === 'Déficit' ? 'danger'
          : (l.etat === 'Surplus' ? 'warning' : 'info'))) + '">' + l.etat + '</span></td></tr>')
      .join('') || '<tr><td colspan="6" class="text-center">Aucune donnée</td></tr>';
  }

  /**
   * Répartition par âge : les relevés portent une grille âge × cours × sexe.
   * On la cumule à l'échelle de la circonscription, sans inventer les tranches
   * que personne n'a renseignées.
   */
  /** Ventilation du personnel par statut et par rôle. */
  function renderPersonnelStatut() {
    const cycle = (document.getElementById('filterCyclePersonnel') || {}).value || '';
    const categorie = (document.getElementById('filterCategoriePersonnel') || {}).value || '';

    const typesRetenus = {
      '': null, EP: ['EPP', 'EPPRIV'], EM: ['EM', 'EMPRIV'],
      EPP: ['EPP'], EPPRIV: ['EPPRIV'], EM_PUB: ['EM'], EMPRIV: ['EMPRIV']
    }[cycle];

    const ecoles = typesRetenus
      ? data.ecoles.filter(e => typesRetenus.indexOf(e.type) >= 0) : data.ecoles;
    const idsEcoles = {};
    ecoles.forEach(e => { idsEcoles[e.id] = true; });

    const agents = data.personnel.filter(p =>
      (!categorie || (p.categorie || 'Enseignant') === categorie)
      && (!typesRetenus || idsEcoles[p.ecoleId]));

    const lignes = global.Carriere.ventilerPersonnel(agents, ecoles);
    const actifs = agents.filter(global.Carriere.estActif);
    const H = actifs.filter(p => global.Carriere.sexeDe(p) === 'H').length;
    const F = actifs.filter(p => global.Carriere.sexeDe(p) === 'F').length;
    const total = actifs.length;

    document.getElementById('resumePersonnel').innerHTML =
      carte(U(total), 'Agents en poste')
      + carte(U(H) + ' / ' + U(F), 'Hommes / femmes', 'blue')
      + carte(total ? Math.round(F / total * 1000) / 10 + ' %' : '—', 'Part de femmes',
        total && F / total < 0.3 ? 'yellow' : '')
      + carte(U(data.personnel.length - actifs.length), 'Hors effectif',
        data.personnel.length > actifs.length ? 'red' : '');

    document.getElementById('personnelStatutTable').innerHTML = lignes.map(l =>
      '<tr><td><b>' + echapper(l.libelle) + '</b></td>'
      + '<td>' + l.H + '</td><td>' + l.F + '</td><td><b>' + l.total + '</b></td>'
      + '<td>' + (l.partFemmes === null ? '—' : l.partFemmes + ' %') + '</td>'
      + '<td>' + l.ecoles + '</td><td>' + l.ecartType + '</td></tr>').join('')
      + (lignes.length
        ? '<tr style="background:#f1f5f9;"><td><b>Total</b></td>'
          + '<td><b>' + H + '</b></td><td><b>' + F + '</b></td>'
          + '<td><b>' + total + '</b></td>'
          + '<td><b>' + (total ? Math.round(F / total * 1000) / 10 + ' %' : '—') + '</b></td>'
          + '<td colspan="2"></td></tr>'
        : '<tr><td colspan="7" class="text-center">Aucun agent pour ce filtre</td></tr>');
  }

  function renderAges() {
    const sel = document.getElementById('filterSecteurAge');
    const secteur = sel ? sel.value : '';
    const releves = data.effectifs.filter(e => {
      if (e.annee && e.annee !== anneeActive()) return false;
      const ecole = data.ecoles.find(x => x.id == e.ecoleId);
      if (!ecole) return false;
      /* Sans filtre, on montre toute la circonscription : écarter les
         maternelles ferait disparaître des relevés pourtant saisis. */
      return secteur ? ecole.type === secteur : true;
    });

    const grille = {};
    AGES.forEach(age => {
      grille[age] = {};
      CLASSES.concat(['ENSEMBLE']).forEach(c => { grille[age][c] = { G: 0, F: 0 }; });
    });

    let renseignes = 0;
    releves.forEach(e => {
      if (!e.ages) return;
      let quelqueChose = false;
      AGES.forEach(age => CLASSES.forEach(c => ['G', 'F'].forEach(sx => {
        const v = parseInt(e.ages[age + '_' + c + '_' + sx], 10) || 0;
        if (v) {
          grille[age][c][sx] += v;
          grille[age].ENSEMBLE[sx] += v;
          quelqueChose = true;
        }
      })));
      if (quelqueChose) renseignes++;
    });

    const lignes = AGES.filter(age => grille[age].ENSEMBLE.G + grille[age].ENSEMBLE.F > 0);
    const totalG = AGES.reduce((s2, age) => s2 + grille[age].ENSEMBLE.G, 0);
    const totalF = AGES.reduce((s2, age) => s2 + grille[age].ENSEMBLE.F, 0);
    const total = totalG + totalF;

    /* L'âge normal va de 6 ans au CI à 11 ans au CM2 : au-delà, l'apprenant est
       en retard quel que soit son cours. */
    const cumul = tranches => tranches.reduce((s2, age) =>
      s2 + grille[age].ENSEMBLE.G + grille[age].ENSEMBLE.F, 0);
    const enRetard = cumul(['12 ans', '13 ans', '14 ans', '15 ans', '16 ans et plus']);
    const precoces = cumul(['Moins de 5 ans', '5 ans']);

    document.getElementById('resumeAges').innerHTML =
      carte(renseignes + ' / ' + releves.length, 'Écoles ayant ventilé par âge',
        renseignes < releves.length ? 'yellow' : '')
      + carte(U(total), 'Apprenants ventilés', 'blue')
      + carte(total ? Math.round(enRetard / total * 1000) / 10 + ' %' : '—',
        '12 ans et plus', total && enRetard / total > 0.2 ? 'red' : '')
      + carte(total ? Math.round(precoces / total * 1000) / 10 + ' %' : '—', 'Moins de 6 ans');

    document.getElementById('enteteAges').innerHTML = '<th>Âge</th>'
      + CLASSES.map(c => '<th colspan="2">' + c + '</th>').join('')
      + '<th colspan="3">Ensemble</th>';

    if (!lignes.length) {
      document.getElementById('agesTable').innerHTML =
        '<tr><td colspan="' + (CLASSES.length * 2 + 4) + '" class="text-center">'
        + 'Aucune répartition par âge saisie. Elle se renseigne dans le relevé '
        + 'd’effectifs de chaque école.</td></tr>';
      return;
    }

    document.getElementById('agesTable').innerHTML =
      '<tr><th></th>' + CLASSES.map(() => '<th class="petit">G</th><th class="petit">F</th>').join('')
      + '<th class="petit">G</th><th class="petit">F</th><th class="petit">T</th></tr>'
      + lignes.map(age => '<tr><td><b>' + echapper(age) + '</b></td>'
        + CLASSES.map(c => '<td>' + (grille[age][c].G || '') + '</td><td>'
          + (grille[age][c].F || '') + '</td>').join('')
        + '<td><b>' + grille[age].ENSEMBLE.G + '</b></td>'
        + '<td><b>' + grille[age].ENSEMBLE.F + '</b></td>'
        + '<td><b>' + (grille[age].ENSEMBLE.G + grille[age].ENSEMBLE.F) + '</b></td></tr>').join('')
      + '<tr style="background:#f1f5f9;"><td><b>Total</b></td>'
      + CLASSES.map(c => '<td><b>' + AGES.reduce((s2, age) => s2 + grille[age][c].G, 0)
        + '</b></td><td><b>' + AGES.reduce((s2, age) => s2 + grille[age][c].F, 0)
        + '</b></td>').join('')
      + '<td><b>' + totalG + '</b></td><td><b>' + totalF + '</b></td>'
      + '<td><b>' + total + '</b></td></tr>';
  }

  /* ---------------- Années scolaires ---------------- */

  function renderAnnees() {
    const select = document.getElementById('anneeActive');
    select.innerHTML = data.annees.map(a =>
      '<option value="' + echapper(a.id) + '"' + (a.active ? ' selected' : '') + '>'
      + echapper(a.libelle) + '</option>').join('');

    document.getElementById('anneesTable').innerHTML = data.annees.map(a =>
      '<tr><td><b>' + echapper(a.libelle) + '</b></td>'
      + '<td><span class="badge badge-' + (a.active ? 'success' : 'info') + '">'
      + (a.active ? 'Active' : 'Archivée') + '</span></td>'
      + '<td>' + data.effectifs.filter(e => e.annee === a.libelle).length + '</td>'
      + '<td>' + data.rapports.filter(r => r.anneeScolaire === a.libelle).length + '</td>'
      + '<td class="actions">'
      + (a.active ? '' : '<button class="btn btn-primary btn-sm" onclick="activerAnnee(\''
        + a.id + '\')">Activer</button> ')
      + (a.active ? '' : '<button class="btn btn-danger btn-sm" onclick="supprimerAnnee(\''
        + a.id + '\')">🗑️</button>')
      + '</td></tr>').join('');
  }

  function openAnneeModal() {
    const suivante = (anneeReference() + 1) + '-' + (anneeReference() + 2);
    openModal('Ajouter une année scolaire',
      '<form onsubmit="saveAnnee(event)"><div class="form-grid">'
      + '<div class="form-group"><label>Année scolaire *</label>'
      + '<input name="libelle" value="' + suivante + '" required '
      + 'pattern="[0-9]{4}-[0-9]{4}" placeholder="2027-2028"></div>'
      + '</div><p class="alert alert-info mt-15">Format attendu : deux millésimes séparés '
      + "d'un tiret, par exemple 2027-2028.</p>"
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Ajouter</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveAnnee(ev) {
    ev.preventDefault();
    const libelle = new FormData(ev.target).get('libelle').trim();
    if (data.annees.some(a => a.libelle === libelle)) {
      alert('Cette année scolaire existe déjà.');
      return;
    }
    data.annees.push({ id: libelle, libelle: libelle, active: false });
    data.annees.sort((a, b) => b.libelle.localeCompare(a.libelle));
    saveData();
    closeModal();
    renderAnnees();
  }

  function activerAnnee(id) {
    data.annees.forEach(a => { a.active = (a.id === id); });
    saveData();
    renderAnnees();
    renderDashboard();
  }

  function supprimerAnnee(id) {
    const a = data.annees.find(x => x.id === id);
    if (!a) return;
    const lies = data.effectifs.filter(e => e.annee === a.libelle).length
      + data.rapports.filter(r => r.anneeScolaire === a.libelle).length;
    if (lies) {
      alert('Impossible : ' + lies + ' enregistrement(s) portent encore cette année.');
      return;
    }
    data.annees = data.annees.filter(x => x.id !== id);
    saveData();
    renderAnnees();
  }

  /* L'année qui précède immédiatement l'année active, par ordre alphabétique
     des millésimes (2025-2026 précède 2026-2027) — donc la dernière année
     dont on dispose avant l'année en cours. */
  function anneePrecedente() {
    const tri = data.annees.slice().sort((a, b) => b.libelle.localeCompare(a.libelle));
    const idx = tri.findIndex(a => a.active);
    return idx >= 0 && tri[idx + 1] ? tri[idx + 1] : null;
  }

  /**
   * Reporte les relevés d'effectifs de l'année précédente vers l'année active,
   * école par école, pour donner un point de départ à corriger plutôt que de
   * tout ressaisir (par exemple pré-remplir 2026-2027 avec les chiffres de
   * 2025-2026). N'écrase jamais un relevé déjà saisi pour l'année active.
   */
  function reporterEffectifsAnneePrecedente() {
    const precedente = anneePrecedente();
    const active = data.annees.find(a => a.active);
    if (!precedente || !active) {
      alert('Aucune année précédente à reporter.');
      return;
    }
    const source = data.effectifs.filter(e => e.annee === precedente.libelle);
    if (!source.length) {
      alert('Aucun effectif enregistré pour ' + precedente.libelle + '.');
      return;
    }
    const dejaPresentes = new Set(data.effectifs.filter(e => e.annee === active.libelle)
      .map(e => e.ecoleId));
    const aReporter = source.filter(e => !dejaPresentes.has(e.ecoleId));
    if (!aReporter.length) {
      alert('Toutes les écoles ayant un effectif ' + precedente.libelle
        + ' ont déjà un effectif ' + active.libelle + '.');
      return;
    }
    if (!confirm(aReporter.length + ' école(s) vont recevoir les effectifs de '
      + precedente.libelle + ' comme point de départ pour ' + active.libelle
      + ' (à corriger ensuite selon les inscriptions réelles). Continuer ?')) return;
    aReporter.forEach(e => {
      const copie = Object.assign({}, e);
      copie.id = uid();
      copie.annee = active.libelle;
      data.effectifs.push(copie);
    });
    saveData();
    renderEffectifs();
    renderAnnees();
    alert(aReporter.length + ' école(s) reportée(s) de ' + precedente.libelle
      + ' vers ' + active.libelle + '.');
  }

  /**
   * Changement de situation d'un agent : affectation dans une autre école de la
   * circonscription, mutation au dehors, détachement, retraite ou décès.
   * Le mouvement est daté et l'école quittée est conservée.
   */
  function changerSituation(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const actuelle = p.situation || 'EN_POSTE';
    openModal('Situation de ' + p.nom,
      '<form onsubmit="saveSituation(event, \'' + id + '\')">'
      + '<p class="muet mb-15">École actuelle : <b>' + echapper(nomEcole(p.ecoleId))
      + '</b></p><div class="form-grid">'
      + '<div class="form-group"><label>Nouvelle situation *</label>'
      + '<select name="situation" required onchange="majChampsSituation()">'
      + global.Carriere.SITUATIONS.map(sit => '<option value="' + sit.cle + '"'
        + (actuelle === sit.cle ? ' selected' : '') + '>' + echapper(sit.libelle)
        + '</option>').join('') + '</select></div>'
      + '<div class="form-group"><label>Date d’effet</label><input type="date" '
      + 'name="dateSituation" value="'
      + echapper(p.dateSituation || new Date().toISOString().slice(0, 10)) + '"></div>'
      + '<div class="form-group"><label>Référence de l’acte</label>'
      + '<input name="referenceSituation" value="' + echapper(p.referenceSituation || '') + '"></div>'
      + '</div>'
      + '<div id="blocAffectation" class="form-section mt-15"><h4>Nouvelle école</h4>'
      + '<div class="form-group"><label>École d’accueil</label>'
      + '<select name="nouvelleEcole"><option value="">— Choisir —</option>'
      + optionsEcoles() + '</select></div>'
      + '<p class="petit muet">L’école quittée est conservée dans l’historique de '
      + 'l’agent.</p></div>'
      + '<div class="form-group mt-15"><label>Observation</label>'
      + '<textarea name="observationSituation" rows="2">'
      + echapper(p.observationSituation || '') + '</textarea></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
    majChampsSituation();
  }

  /* Le choix de l'école d'accueil n'a de sens que pour une affectation interne. */
  function majChampsSituation() {
    const form = document.querySelector('#modalBody form');
    const bloc = document.getElementById('blocAffectation');
    if (!form || !bloc) return;
    const valeur = (form.querySelector('[name=situation]') || {}).value;
    bloc.style.display = valeur === 'AFFECTE' ? '' : 'none';
  }

  function saveSituation(ev, id) {
    ev.preventDefault();
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const obj = Object.fromEntries(new FormData(ev.target));

    if (obj.situation === 'AFFECTE') {
      if (!obj.nouvelleEcole) {
        alert('Choisissez l’école d’accueil, ou retenez « Muté hors circonscription ».');
        return;
      }
      if (obj.nouvelleEcole == p.ecoleId) {
        alert('L’agent est déjà dans cette école.');
        return;
      }
      p.historique = (p.historique || []).concat([{
        ecoleId: p.ecoleId, ecoleNom: nomEcole(p.ecoleId),
        jusquau: obj.dateSituation, reference: obj.referenceSituation || ''
      }]);
      p.ecoleId = obj.nouvelleEcole;
      p.datePriseServiceEcole = obj.dateSituation || p.datePriseServiceEcole;
      /* Une fois installé dans sa nouvelle école, l'agent y est en poste. */
      p.situation = 'EN_POSTE';
    } else {
      p.situation = obj.situation;
    }
    p.dateSituation = obj.dateSituation;
    p.referenceSituation = obj.referenceSituation;
    p.observationSituation = obj.observationSituation;

    saveData();
    closeModal();
    /* On rafraîchit l'écran d'où le changement a été demandé, pour que la
       nouvelle situation soit visible là où on se trouve. */
    const active = document.querySelector('.menu-item.active');
    const page = active ? active.dataset.page : 'personnel';
    if (page === 'administratif') renderCategorie('Administratif');
    else if (page === 'soutien') renderCategorie('Soutien');
    else if (page === 'educateur') renderCategorie('Éducateur');
    else renderPersonnel();
  }

  /* ---------------- Visites et inspections ---------------- */

  /* Les pièces qu'un inspecteur examine lors d'une visite d'école. */
  const DOCUMENTS_INSPECTION = [
    ['registre_matricule', 'Registre matricule'],
    ['registre_appel', 'Registres d’appel journalier'],
    ['releve_frequentation', 'Relevés mensuels de fréquentation'],
    ['cahier_visites', 'Cahier de visites et d’inspections'],
    ['cahier_conferences', 'Cahier de conférences pédagogiques'],
    ['registre_courrier', 'Registre du courrier (arrivée et départ)'],
    ['cahier_textes', 'Cahiers de textes et de préparation'],
    ['fiches_progression', 'Fiches de progression des enseignants'],
    ['registre_notes', 'Registre des notes et procès-verbaux d’évaluation'],
    ['cahier_conseil', 'Cahier du conseil des maîtres'],
    ['registre_ape', 'Registre des réunions APE et AME'],
    ['cahier_caisse', 'Cahier de caisse et pièces comptables'],
    ['inventaire', 'Inventaire du mobilier et du matériel'],
    ['registre_cantine', 'Registre de la cantine scolaire'],
    ['dossiers_personnel', 'Dossiers administratifs du personnel'],
    ['emploi_temps', 'Emploi du temps affiché']
  ];

  const ETATS_DOCUMENT = ['', 'Tenu à jour', 'Tenu partiellement', 'Non tenu', 'Inexistant'];

  const TYPES_VISITE = [
    { cle: 'VISITE_CLASSE', libelle: 'Visite de classe', auteur: 'Conseiller pédagogique' },
    { cle: 'INSPECTION_ECOLE', libelle: 'Inspection d’école',
      auteur: 'Chef de la Circonscription Scolaire' }
  ];

  function libelleTypeVisite(cle) {
    const t = TYPES_VISITE.filter(x => x.cle === cle)[0];
    return t ? t.libelle : cle;
  }

  function zoneDeVisite(v) {
    const e = data.ecoles.find(x => x.id == v.ecoleId);
    return (e && e.zone_ped) || '';
  }

  function renderVisites() {
    const selZ = document.getElementById('filterZoneVisite');
    if (selZ.options.length <= 1) {
      selZ.innerHTML = '<option value="">Toutes zones</option>'
        + global.Donnees.ZONES.map(z => '<option>' + z + '</option>').join('');
    }
    const zoneF = selZ.value;
    const typeF = document.getElementById('filterTypeVisite').value;
    const rech = (document.getElementById('searchVisite').value || '').toLowerCase();

    const liste = data.visites.filter(v =>
      (!zoneF || zoneDeVisite(v) === zoneF)
      && (!typeF || v.type === typeF)
      && (!rech || (nomEcole(v.ecoleId) || '').toLowerCase().indexOf(rech) >= 0
        || (v.enseignantNom || '').toLowerCase().indexOf(rech) >= 0))
      .sort((a2, b2) => new Date(b2.date) - new Date(a2.date));

    const notes = liste.map(v => parseFloat(String(v.note || '').replace(',', '.')))
      .filter(n => !isNaN(n));
    const moyenne = notes.length
      ? Math.round(notes.reduce((s2, n) => s2 + n, 0) / notes.length * 100) / 100 : null;

    document.getElementById('resumeVisites').innerHTML =
      carte(liste.length, 'Visites enregistrées')
      + carte(liste.filter(v => v.type === 'VISITE_CLASSE').length, 'Visites de classe', 'blue')
      + carte(liste.filter(v => v.type === 'INSPECTION_ECOLE').length, 'Inspections d’école')
      + carte(moyenne === null ? '—' : moyenne + '/20', 'Note moyenne',
        moyenne !== null && moyenne < 10 ? 'red' : 'yellow');

    document.getElementById('visitesTable').innerHTML = liste.map(v =>
      '<tr><td>' + formatDate(v.date) + '</td>'
      + '<td>' + echapper(libelleTypeVisite(v.type)) + '</td>'
      + '<td>' + echapper(zoneDeVisite(v) || '—') + '</td>'
      + '<td>' + echapper(nomEcole(v.ecoleId)) + '</td>'
      + '<td>' + echapper(v.enseignantNom || '—') + '</td>'
      + '<td>' + echapper(v.cours || '—') + '</td>'
      + '<td>' + echapper(v.matiere || v.discipline || '—') + '</td>'
      + '<td>' + (v.note ? '<b>' + echapper(v.note) + '/20</b>' : '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-primary btn-sm" onclick="editerRapportVisite(\'' + v.id + '\')">📄</button>'
      + '<button class="btn btn-warning btn-sm" onclick="openVisiteModal(\'' + v.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="supprimerVisite(\'' + v.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="9" class="text-center">Aucune visite enregistrée</td></tr>';

    renderZones();
  }

  /** Couverture des zones : écoles, enseignants, visites, part des visités. */
  function renderZones() {
    const zones = global.Donnees.ZONES.concat(['(zone non renseignée)']);
    document.getElementById('zonesTable').innerHTML = zones.map(z => {
      const estZone = e => (e.zone_ped || '(zone non renseignée)') === z;
      const ecoles = data.ecoles.filter(estZone);
      if (!ecoles.length) return '';
      const ids = {};
      ecoles.forEach(e => { ids[e.id] = true; });
      const agents = data.personnel.filter(p => ids[p.ecoleId]
        && (p.categorie || 'Enseignant') === 'Enseignant'
        && global.Carriere.estActif(p));
      const visites = data.visites.filter(v => ids[v.ecoleId]);
      const visitesClasse = visites.filter(v => v.type === 'VISITE_CLASSE');
      const vus = {};
      visitesClasse.forEach(v => { if (v.enseignantId) vus[v.enseignantId] = true; });
      const nbVus = Object.keys(vus).length;
      const notes = visites.map(v => parseFloat(String(v.note || '').replace(',', '.')))
        .filter(n => !isNaN(n));
      const moyenne = notes.length
        ? Math.round(notes.reduce((s2, n) => s2 + n, 0) / notes.length * 100) / 100 : null;
      /* La couverture ne se calcule que si des enseignants sont enregistrés :
         sinon elle vaudrait zéro pour une raison qui n'a rien à voir. */
      const couverture = agents.length
        ? Math.round(nbVus / agents.length * 1000) / 10 : null;
      return '<tr><td><b>' + echapper(z) + '</b></td><td>' + ecoles.length + '</td>'
        + '<td>' + agents.length + '</td><td>' + visitesClasse.length + '</td>'
        + '<td>' + visites.filter(v => v.type === 'INSPECTION_ECOLE').length + '</td>'
        + '<td>' + nbVus + '</td>'
        + '<td>' + (couverture === null ? '<span class="petit muet">personnel non saisi</span>'
          : '<span class="badge badge-' + (couverture >= 75 ? 'success'
            : (couverture >= 40 ? 'warning' : 'danger')) + '">' + couverture + ' %</span>')
        + '</td><td>' + (moyenne === null ? '—' : moyenne + '/20') + '</td></tr>';
    }).join('') || '<tr><td colspan="8" class="text-center">Aucune école</td></tr>';
  }

  function openVisiteModal(id) {
    const v = id ? data.visites.find(x => x.id == id) || {} : {};
    const aire = (label, nom, valeur, lignes) => '<div class="form-group mt-15"><label>'
      + label + '</label><textarea name="' + nom + '" rows="' + lignes + '">'
      + echapper(valeur || '') + '</textarea></div>';

    openModal(id ? 'Modifier la visite' : 'Enregistrer une visite',
      '<form onsubmit="saveVisite(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Cadre de la visite</h4><div class="form-grid">'
      + selecteur('Type *', 'type', TYPES_VISITE.map(t => [t.cle, t.libelle]), v.type, true)
      + '<div class="form-group"><label>Date *</label><input type="date" name="date" value="'
      + echapper(v.date || new Date().toISOString().slice(0, 10)) + '" required></div>'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required '
      + 'onchange="majEnseignantsVisite()"><option value="">—</option>'
      + optionsEcoles(v.ecoleId) + '</select></div>'
      + '<div class="form-group"><label>Enseignant visité</label>'
      + '<select name="enseignantId" id="enseignantVisite"><option value="">—</option></select></div>'
      + selecteur('Cours', 'cours', [''].concat(V().COURS).concat(['Petits', 'Grands']), v.cours)
      + champ('Jour', 'jour', v.jour)
      + selecteur('Matière', 'matiere',
        [''].concat(V().MATIERES.map(m => m.libelle)), v.matiere || v.discipline)
      + champ('Séquence observée', 'sequence', v.sequence)
      + champ('Effectif présent', 'presents', v.presents, 'number')
      + '<div class="form-group"><label>Note sur 20</label><input type="number" step="0.25" '
      + 'min="0" max="20" name="note" value="' + echapper(v.note || '') + '"></div>'
      + '</div></div>'
      + '<div class="form-section" id="blocDocuments"><h4>Documents administratifs examinés</h4>'
      + '<p class="petit muet mb-15">Laissez vide un document que vous n’avez pas '
      + 'examiné : il ne figurera pas au rapport.</p>'
      + '<div class="form-grid">'
      + DOCUMENTS_INSPECTION.map(([cle, libelle]) =>
        '<div class="form-group"><label>' + echapper(libelle) + '</label>'
        + '<select name="doc_' + cle + '">'
        + ETATS_DOCUMENT.map(e => '<option value="' + e + '"'
          + ((v['doc_' + cle] || '') === e ? ' selected' : '') + '>'
          + (e || '— Non examiné —') + '</option>').join('')
        + '</select></div>').join('')
      + '</div></div>'
      + '<div class="form-section"><h4>Constats et suites</h4>'
      + aire('Points forts observés', 'points_forts', v.points_forts, 3)
      + aire('Points à améliorer', 'points_faibles', v.points_faibles, 3)
      + aire('Recommandations', 'recommandations', v.recommandations, 4)
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
    majEnseignantsVisite(v.enseignantId);
    majChampsVisite();
    const selType = document.querySelector('#modalBody [name=type]');
    if (selType) selType.addEventListener('change', majChampsVisite);
  }

  /* Une visite de classe observe une séquence ; une inspection examine des
     pièces administratives. Les deux formulaires ne montrent que l'utile. */
  function majChampsVisite() {
    const form = document.querySelector('#modalBody form');
    if (!form) return;
    const inspection = (form.querySelector('[name=type]') || {}).value === 'INSPECTION_ECOLE';
    const bloc = document.getElementById('blocDocuments');
    if (bloc) bloc.style.display = inspection ? '' : 'none';
    ['enseignantId', 'cours', 'matiere', 'sequence', 'presents'].forEach(n => {
      const champ2 = form.querySelector('[name=' + n + ']');
      if (champ2 && champ2.closest('.form-group')) {
        champ2.closest('.form-group').style.display = inspection ? 'none' : '';
      }
    });
  }

  /* La liste des enseignants suit l'école choisie. */
  function majEnseignantsVisite(choisi) {
    const form = document.querySelector('#modalBody form');
    const sel = document.getElementById('enseignantVisite');
    if (!form || !sel) return;
    const ecoleId = (form.querySelector('[name=ecoleId]') || {}).value;
    const agents = data.personnel.filter(p => p.ecoleId == ecoleId
      && (p.categorie || 'Enseignant') === 'Enseignant');
    sel.innerHTML = '<option value="">—</option>'
      + agents.sort((a2, b2) => (a2.nom || '').localeCompare(b2.nom || '', 'fr'))
        .map(p => '<option value="' + p.id + '"' + (choisi == p.id ? ' selected' : '') + '>'
          + echapper(p.nom) + '</option>').join('');
  }

  function saveVisite(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    const agent = data.personnel.find(x => x.id == obj.enseignantId);
    obj.enseignantNom = agent ? agent.nom : '';
    enregistrer('visites', obj, id, renderVisites);
  }

  function supprimerVisite(id) {
    if (!confirm('Supprimer cette visite ?')) return;
    data.visites = data.visites.filter(x => x.id != id);
    saveData();
    renderVisites();
  }

  /** Rapport de visite, signé par le CP de zone ou par le chef de circonscription. */
  function editerRapportVisite(id) {
    const v = data.visites.find(x => x.id == id);
    if (!v) return;
    const ecole = data.ecoles.find(x => x.id == v.ecoleId);
    const parCP = v.type === 'VISITE_CLASSE';
    const signataire = parCP ? cpDeZone(ecole) : identiteCS('CCS');

    const ligne = (l, val) => '<tr><td style="background:#f8fafc;width:32%;">' + l
      + '</td><td>' + val + '</td></tr>';
    const bloc = (titre, texte) => '<h4 style="margin-top:12px;color:#006633;">' + titre
      + '</h4><p>' + (texte ? echapper(texte) : '<span class="muet">Néant</span>') + '</p>';

    openModal('Rapport — ' + libelleTypeVisite(v.type),
      '<div class="page-a4">'
      + enteteDocument({ etablissement: ecole ? ecole.nom : '' })
      + '<h2 class="titre-a4">'
      + (parCP ? 'RAPPORT DE VISITE DE CLASSE' : 'RAPPORT D’INSPECTION D’ÉCOLE') + '</h2>'
      + '<table style="width:100%;font-size:12.5px;"><tbody>'
      + ligne('Date de la visite', '<b>' + formatDate(v.date) + '</b>'
        + (v.jour ? ' — ' + echapper(v.jour) : ''))
      + ligne('École', echapper(ecole ? ecole.nom : '—')
        + ' — ' + echapper((ecole && ecole.zone_ped) || 'zone non renseignée'))
      + (parCP ? ligne('Enseignant visité', echapper(v.enseignantNom || '—')
        + (v.cours ? ' — cours ' + echapper(v.cours) : '')) : '')
      + (parCP
        ? ligne('Matière', echapper(v.matiere || v.discipline || '—'))
          + ligne('Séquence observée', echapper(v.sequence || '—'))
          + ligne('Effectif présent', echapper(v.presents || '—'))
        : '')
      + ligne('Note attribuée', v.note ? '<b>' + echapper(v.note) + '/20</b>' : '—')
      + '</tbody></table>'
      + (parCP ? '' : tableauDocuments(v))
      + bloc('Points forts observés', v.points_forts)
      + bloc('Points à améliorer', v.points_faibles)
      + bloc('Recommandations', v.recommandations)
      + '<p class="mt-15">Fait à Pobè, le ' + new Date().toLocaleDateString('fr-FR') + '.</p>'
      + (signataire
        ? '<div class="pied-document">'
          + global.Pieces.blocVerification('VISITE', v.id,
            (ecole ? ecole.nom : '') + '|' + v.date)
          + '<div>' + global.Pieces.cachet(signataire, { taille: 96 }) + '</div>'
          + global.Pieces.blocSignature(signataire,
            signataire.libelleSignature || signataire.nom)
          + '</div>'
        : '<div class="alert alert-warning">La zone pédagogique de l’école n’est pas '
          + 'renseignée : le conseiller pédagogique signataire ne peut pas être '
          + 'identifié.</div>')
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button></div>');
  }

  /** Les pièces examinées et leur état, telles que constatées. */
  function tableauDocuments(v) {
    const examines = DOCUMENTS_INSPECTION.filter(([cle]) => v['doc_' + cle]);
    if (!examines.length) {
      return '<h4 style="margin-top:12px;color:#006633;">Documents administratifs</h4>'
        + '<p class="muet">Aucun document n’a été consigné lors de cette inspection.</p>';
    }
    const manquants = examines.filter(([cle]) =>
      ['Non tenu', 'Inexistant'].indexOf(v['doc_' + cle]) >= 0).length;
    return '<h4 style="margin-top:12px;color:#006633;">Documents administratifs examinés</h4>'
      + '<table style="width:100%;font-size:12px;"><thead><tr><th>Document</th>'
      + '<th>État constaté</th></tr></thead><tbody>'
      + examines.map(([cle, libelle]) => '<tr><td>' + echapper(libelle) + '</td>'
        + '<td>' + echapper(v['doc_' + cle]) + '</td></tr>').join('')
      + '</tbody></table>'
      + '<p class="petit">' + examines.length + ' document(s) examiné(s), dont <b>'
      + manquants + '</b> non tenu(s) ou inexistant(s).</p>';
  }

  function exporterVisites() {
    if (!data.visites.length) { alert('Aucune visite enregistrée.'); return; }
    const lignes = [['Date', 'Type', 'Zone', 'École', 'Enseignant', 'Cours', 'Jour',
      'Matière', 'Séquence', 'Effectif présent', 'Note',
      'Points forts', 'Points à améliorer', 'Recommandations']
      .concat(DOCUMENTS_INSPECTION.map(d => d[1]))];
    data.visites.slice().sort((a2, b2) => new Date(a2.date) - new Date(b2.date))
      .forEach(v => lignes.push([v.date || '', libelleTypeVisite(v.type),
        zoneDeVisite(v), nomEcole(v.ecoleId), v.enseignantNom || '', v.cours || '',
        v.jour || '', v.matiere || v.discipline || '', v.sequence || '', v.presents || '',
        v.note || '', v.points_forts || '', v.points_faibles || '',
        v.recommandations || '']
        .concat(DOCUMENTS_INSPECTION.map(d => v['doc_' + d[0]] || ''))));
    telecharger('cs-pobe-visites-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Gestion des carrières ---------------- */

  let agentCarriere = null;

  function renderCarriere() {
    const selE = document.getElementById('filterEcoleCarriere');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">Toutes écoles</option>' + optionsEcoles();
    }
    const rech = (document.getElementById('searchCarriere').value || '').toLowerCase();
    const ecoleF = selE.value;

    const liste = data.personnel.filter(p =>
      (!ecoleF || p.ecoleId == ecoleF)
      && (!rech || (p.nom || '').toLowerCase().indexOf(rech) >= 0
        || String(p.matricule || '').toLowerCase().indexOf(rech) >= 0))
      .sort((a2, b2) => (a2.nom || '').localeCompare(b2.nom || '', 'fr'));

    document.getElementById('listeCarriere').innerHTML = liste.slice(0, 300).map(p => {
      const sit = global.Carriere.situationDe(p);
      return '<tr' + (agentCarriere === p.id ? ' style="background:#ecfdf5;"' : '')
        + '><td style="cursor:pointer;" onclick="ouvrirCarriere(\'' + p.id + '\')">'
        + '<b>' + echapper(p.nom) + '</b><br><span class="petit muet">'
        + echapper(p.matricule || 'sans matricule') + ' · ' + echapper(nomEcole(p.ecoleId))
        + '</span><br><span class="badge badge-' + sit.ton + '">' + echapper(sit.libelle)
        + '</span></td></tr>';
    }).join('') || '<tr><td class="text-center">Aucun agent</td></tr>';

    if (!liste.some(p => p.id === agentCarriere)) agentCarriere = null;
    afficherFicheCarriere();
  }

  function ouvrirCarriere(id) {
    agentCarriere = id;
    renderCarriere();
  }

  /** Les étapes de carrière, du recrutement à aujourd'hui, dans l'ordre. */
  function etapesCarriere(p) {
    const etapes = [];
    if (p.datePriseServiceFP) {
      etapes.push({ date: p.datePriseServiceFP, libelle: 'Première prise de service',
        detail: 'Entrée dans la fonction publique' });
    }
    if (p.datePriseServiceDept) {
      etapes.push({ date: p.datePriseServiceDept, libelle: 'Arrivée dans le département',
        detail: 'Département du Plateau' });
    }
    (p.historique || []).forEach(h => {
      etapes.push({ date: h.jusquau, libelle: 'Départ de ' + (h.ecoleNom || '—'),
        detail: h.reference ? 'Acte : ' + h.reference : 'Affectation interne' });
    });
    (p.avancements || []).forEach(a2 => {
      etapes.push({ date: a2.date, libelle: 'Avancement au grade ' + a2.grade,
        detail: (a2.indice ? 'Indice ' + a2.indice : '')
          + (a2.reference ? ' · Acte : ' + a2.reference : '') });
    });
    if (p.datePriseServiceEcole) {
      etapes.push({ date: p.datePriseServiceEcole,
        libelle: 'Prise de service à ' + nomEcole(p.ecoleId), detail: 'Poste actuel' });
    }
    if (p.dateSituation && (p.situation || 'EN_POSTE') !== 'EN_POSTE') {
      etapes.push({ date: p.dateSituation,
        libelle: global.Carriere.situationDe(p).libelle,
        detail: p.referenceSituation ? 'Acte : ' + p.referenceSituation : '' });
    }
    return etapes.filter(e => e.date)
      .sort((a2, b2) => new Date(a2.date) - new Date(b2.date));
  }

  function afficherFicheCarriere() {
    const zone = document.getElementById('ficheCarriere');
    if (!agentCarriere) {
      zone.innerHTML = '<div class="alert alert-info">Choisissez un agent dans la liste '
        + 'pour consulter sa carrière.</div>';
      return;
    }
    const p = data.personnel.find(x => x.id == agentCarriere);
    if (!p) { zone.innerHTML = ''; return; }

    const C = global.Carriere;
    const anc = C.anciennetes(p, anneeReference());
    const moyenne = C.moyenneNotes(p);
    const dr = C.dateRetraite(p.dateNaissance, p.grade, p.statut);
    const restant = dr ? Math.max(0, Math.round((dr - new Date())
      / (1000 * 60 * 60 * 24 * 365.25) * 10) / 10) : null;

    const notes = C.ANNEES_NOTES.map(a2 => ({ annee: a2, note: p['note' + a2] }))
      .filter(x => x.note !== undefined && x.note !== '');

    const ligne = (libelle, valeur) => '<tr><td style="background:#f8fafc;width:44%;">'
      + libelle + '</td><td>' + valeur + '</td></tr>';

    zone.innerHTML =
      '<div class="form-container">'
      + '<h3 style="color:#006633;">' + echapper(p.nom) + '</h3>'
      + '<p class="muet mb-15">' + echapper(p.matricule || 'sans matricule') + ' · '
      + echapper(p.categorie || 'Enseignant') + ' · ' + echapper(nomEcole(p.ecoleId)) + '</p>'
      + '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:14px;">'
      + '<table>' + ligne('Grade', echapper(p.grade || '—'))
      + ligne('Statut', echapper(p.statut || '—'))
      + ligne('Fonction', echapper(p.fonction || '—'))
      + ligne('Indice actuel', echapper(p.indice || '—'))
      + ligne('Indice payé', echapper(p.indicePaye || '—')) + '</table>'
      + '<table>'
      + ligne('Ancienneté fonction publique',
        anc.fonctionPublique === null ? '—' : '<b>' + anc.fonctionPublique + ' an(s)</b>')
      + ligne('Ancienneté département',
        anc.departement === null ? '—' : anc.departement + ' an(s)')
      + ligne('Ancienneté dans l’école', anc.ecole === null ? '—' : anc.ecole + ' an(s)')
      + ligne('Moyenne des notes', moyenne === null ? '—' : '<b>' + moyenne + '/20</b>')
      + ligne('Départ à la retraite', dr
        ? '<b>' + formatDate(dr) + '</b>'
          + (restant !== null ? ' <span class="petit muet">(' + restant + ' an(s))</span>' : '')
        : 'non déterminé, faute de grade')
      + '</table></div>'
      + (notes.length
        ? '<h4 style="margin-top:14px;color:#006633;">Notes d’évaluation</h4>'
          + '<table style="width:100%;"><thead><tr>'
          + notes.map(n => '<th>' + n.annee + '</th>').join('') + '</tr></thead><tbody><tr>'
          + notes.map(n => '<td>' + echapper(n.note) + '/20</td>').join('')
          + '</tr></tbody></table>' : '')
      + '<h4 style="margin-top:14px;color:#006633;">Déroulé de carrière</h4>'
      + (etapesCarriere(p).length
        ? '<table style="width:100%;font-size:13px;"><thead><tr><th>Date</th><th>Étape</th>'
          + '<th>Détail</th></tr></thead><tbody>'
          + etapesCarriere(p).map(e => '<tr><td>' + formatDate(e.date) + '</td>'
            + '<td><b>' + echapper(e.libelle) + '</b></td>'
            + '<td class="petit muet">' + echapper(e.detail || '') + '</td></tr>').join('')
          + '</tbody></table>'
        : '<p class="muet">Aucune étape datée : renseignez les prises de service dans la '
          + 'fiche de l’agent.</p>')
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="ajouterAvancement(\'' + p.id + '\')">➕ Avancement</button> '
      + '<button class="btn btn-info" onclick="editerFicheCarriere(\'' + p.id + '\')">📄 Fiche de carrière</button> '
      + '<button class="btn btn-warning" onclick="editPersonnel(\'' + p.id + '\')">✏️ Modifier l’agent</button>'
      + '</div></div>';
  }

  function ajouterAvancement(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const grades = Object.keys(GRADES).map(g => '<optgroup label="' + g + '">'
      + GRADES[g].map(v => '<option>' + v + '</option>').join('') + '</optgroup>').join('');
    openModal('Avancement — ' + p.nom,
      '<form onsubmit="saveAvancement(event, \'' + id + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>Nouveau grade *</label><select name="grade" required>'
      + '<option value="">— Choisir —</option>' + grades + '</select></div>'
      + '<div class="form-group"><label>Date d’effet *</label><input type="date" name="date" '
      + 'value="' + new Date().toISOString().slice(0, 10) + '" required></div>'
      + champ('Nouvel indice', 'indice', '')
      + champ('Référence de l’acte', 'reference', '')
      + '</div><p class="alert alert-info mt-15">Le grade actuel de l’agent est remplacé, '
      + 'et l’ancien conservé dans le déroulé de carrière. La date de retraite est '
      + 'recalculée en conséquence.</p>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveAvancement(ev, id) {
    ev.preventDefault();
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const obj = Object.fromEntries(new FormData(ev.target));
    p.avancements = (p.avancements || []).concat([{
      grade: obj.grade, date: obj.date, indice: obj.indice,
      reference: obj.reference, gradePrecedent: p.grade || ''
    }]);
    p.grade = obj.grade;
    if (obj.indice) p.indice = obj.indice;
    saveData();
    closeModal();
    renderCarriere();
  }

  /** Fiche de carrière imprimable, avec cachet, signature et code QR. */
  function editerFicheCarriere(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const C = global.Carriere;
    const anc = C.anciennetes(p, anneeReference());
    const dr = C.dateRetraite(p.dateNaissance, p.grade, p.statut);
    const moyenne = C.moyenneNotes(p);
    const ligne = (l, v) => '<tr><td style="background:#f8fafc;width:34%;">' + l
      + '</td><td>' + v + '</td></tr>';

    openModal('Fiche de carrière — ' + p.nom,
      '<div class="page-a4">'
      + enteteDocument({ direction: 'DIRECTION DÉPARTEMENTALE DES ENSEIGNEMENTS '
        + 'MATERNEL ET PRIMAIRE DU PLATEAU' })
      + '<h2 class="titre-a4">FICHE DE CARRIÈRE</h2>'
      + '<p class="text-center">Arrêtée au 31 décembre ' + anneeReference() + '</p>'
      + '<table style="width:100%;margin-top:12px;font-size:12px;"><tbody>'
      + ligne('Nom et prénoms', '<b>' + echapper(p.nom) + '</b>')
      + ligne('Matricule', echapper(p.matricule || '—'))
      + ligne('Sexe et naissance', echapper(p.sexe || '—') + ' — né(e) le '
        + formatDate(p.dateNaissance) + (p.lieuNaiss ? ' à ' + echapper(p.lieuNaiss) : ''))
      + ligne('Catégorie', echapper(p.categorie || 'Enseignant'))
      + ligne('Grade et statut', echapper(p.grade || '—') + ' · ' + echapper(p.statut || '—'))
      + ligne('Fonction', echapper(p.fonction || '—')
        + (p.cours ? ' — cours ' + echapper(p.cours) : ''))
      + ligne('Indice', 'actuel ' + echapper(p.indice || '—')
        + ' · payé ' + echapper(p.indicePaye || '—'))
      + ligne('Diplômes', echapper(p.diplomeAca || '—') + ' · '
        + echapper(p.diplomePro || '—'))
      + ligne('Affectation', echapper(nomEcole(p.ecoleId)))
      + ligne('Situation', echapper(C.situationDe(p).libelle))
      + ligne('Ancienneté', 'fonction publique '
        + (anc.fonctionPublique === null ? '—' : anc.fonctionPublique + ' an(s)')
        + ' · département ' + (anc.departement === null ? '—' : anc.departement + ' an(s)')
        + ' · école ' + (anc.ecole === null ? '—' : anc.ecole + ' an(s)'))
      + ligne('Moyenne des notes', moyenne === null ? '—' : moyenne + '/20')
      + ligne('Départ à la retraite', dr ? '<b>' + formatDate(dr) + '</b>'
        : 'non déterminé, faute de grade')
      + '</tbody></table>'
      + '<h4 style="margin-top:12px;color:#006633;">Déroulé de carrière</h4>'
      + '<table style="width:100%;font-size:12px;"><thead><tr><th>Date</th><th>Étape</th>'
      + '<th>Détail</th></tr></thead><tbody>'
      + (etapesCarriere(p).map(e => '<tr><td>' + formatDate(e.date) + '</td><td>'
        + echapper(e.libelle) + '</td><td>' + echapper(e.detail || '') + '</td></tr>').join('')
        || '<tr><td colspan="3">Aucune étape datée</td></tr>')
      + '</tbody></table>'
      + piedDocument(null, 'CARRIERE', p.id,
        'Le Chef de la Division de l’Organisation Scolaire et de la Prévision', 'DOSP')
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Retraite ---------------- */

  function renderRetraite() {
    const today = new Date();
    const finAnnee = new Date(today.getFullYear(), 11, 31);
    const avecDate = data.personnel.filter(global.Carriere.estActif)
      .map(p => ({ p, dr: calcDateRetraite(p.dateNaissance, p.grade, p.statut) }))
      .filter(x => x.dr);

    const partis = avecDate.filter(x => x.dr < today).sort((a, b) => b.dr - a.dr);
    const actu = avecDate.filter(x => x.dr >= today && x.dr <= finAnnee).sort((a, b) => a.dr - b.dr);
    const prev = avecDate.filter(x => x.dr > finAnnee).sort((a, b) => a.dr - b.dr);

    document.getElementById('retraitePrevTable').innerHTML = prev.map(({ p, dr }) => {
      const mois = Math.max(0, Math.round((dr - today) / (1000 * 60 * 60 * 24 * 30.44)));
      const ton = mois <= 6 ? 'danger' : mois <= 12 ? 'warning' : 'info';
      return '<tr><td>' + echapper(p.matricule || '—') + '</td><td><b>' + echapper(p.nom) + '</b></td>'
        + '<td>' + formatDate(p.dateNaissance) + '</td><td>' + echapper(p.grade || '—') + '</td>'
        + '<td>' + (getAgeRetraite(p.grade, p.statut) === null ? '—'
        : getAgeRetraite(p.grade, p.statut) + ' ans') + '</td><td><b>' + formatDate(dr) + '</b></td>'
        + '<td><span class="badge badge-' + ton + '">' + mois + ' mois</span></td>'
        + '<td><button class="btn btn-info btn-sm" onclick="genererActeRetraite(\'' + p.id
        + '\')">📄 Acte</button></td></tr>';
    }).join('') || '<tr><td colspan="8" class="text-center">Aucune prévision</td></tr>';

    document.getElementById('retraiteActuTable').innerHTML = actu.map(({ p, dr }) =>
      '<tr><td>' + echapper(p.matricule || '—') + '</td><td><b>' + echapper(p.nom) + '</b></td>'
      + '<td>' + echapper(p.grade || '—') + '</td><td><b>' + formatDate(dr) + '</b></td>'
      + '<td>' + echapper(nomEcole(p.ecoleId)) + '</td>'
      + '<td><button class="btn btn-info btn-sm" onclick="genererActeRetraite(\'' + p.id
      + '\')">📄 Acte</button></td></tr>').join('')
      || '<tr><td colspan="6" class="text-center">Aucune retraite cette année</td></tr>';

    document.getElementById('retraitePartisTable').innerHTML = partis.map(({ p, dr }) =>
      '<tr><td>' + echapper(p.matricule || '—') + '</td><td>' + echapper(p.nom) + '</td>'
      + '<td>' + echapper(p.grade || '—') + '</td><td>' + formatDate(dr) + '</td>'
      + '<td><button class="btn btn-info btn-sm" onclick="genererActeRetraite(\'' + p.id
      + '\')">📄</button></td></tr>').join('')
      || '<tr><td colspan="5" class="text-center">Aucun</td></tr>';
  }

  function genererActeRetraite(id) {
    const p = data.personnel.find(x => x.id == id);
    if (!p) return;
    const dr = calcDateRetraite(p.dateNaissance, p.grade, p.statut);
    const categorie = p.grade ? String(p.grade).charAt(0) : '—';
    openModal('Notification de départ à la retraite',
      '<div class="page-a4">'
      + enteteDocument({})
      + '<h2 class="titre-a4">NOTIFICATION DE DÉPART À LA RETRAITE</h2>'
      + '<p><b>Matricule :</b> ' + echapper(p.matricule || '—') + '</p>'
      + '<p><b>Nom et prénoms :</b> ' + echapper(p.nom) + '</p>'
      + '<p><b>Sexe :</b> ' + echapper(p.sexe || '—') + '</p>'
      + '<p><b>Date de naissance :</b> ' + formatDate(p.dateNaissance) + '</p>'
      + '<p><b>Grade :</b> ' + echapper(p.grade || '—') + ' (catégorie ' + categorie + ')</p>'
      + '<p><b>Âge de retraite :</b> ' + (getAgeRetraite(p.grade, p.statut) === null
        ? 'non déterminé, faute de grade' : getAgeRetraite(p.grade, p.statut) + ' ans') + '</p>'
      + '<p><b>Fonction :</b> ' + echapper(p.fonction || '—') + '</p>'
      + '<p><b>École d\'affectation :</b> ' + echapper(nomEcole(p.ecoleId)) + '</p><br>'
      + '<p style="font-size:18px;background:#fef3c7;padding:10px;border-left:4px solid #f59e0b;">'
      + '<b>Date effective de départ à la retraite : ' + formatDate(dr) + '</b><br>'
      + '<small>(1<sup>er</sup> jour du trimestre qui suit l’anniversaire)</small></p><br>'
      + '<p class="text-center">Fait à Pobè, le ' + new Date().toLocaleDateString('fr-FR') + '</p>'
      + piedDocument(null, 'RETRAITE', p.id, 'Le Chef de la Circonscription Scolaire')
      + '</div>'
      + '<div class="text-center mt-15"><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Effectifs ---------------- */

  const AGES = ['Moins de 5 ans', '5 ans', '6 ans', '7 ans', '8 ans', '9 ans', '10 ans',
    '11 ans', '12 ans', '13 ans', '14 ans', '15 ans', '16 ans et plus'];
  const CLASSES = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  /* Écoles maternelles : sections (petits, grands), tableau 3 de la fiche de recensement, rentrée et fin d'année. */
  const SECTIONS_M = [['sp', 'Section des petits (SP)'], ['sg', 'Section des grands (SG)']];
  const AGES_M = [['m25', 'Moins de 2 ans ½'], ['a25', '2 ans ½ à 3 ans'], ['a3', '3 ans'], ['a4', '4 ans'], ['a5', '5 ans'], ['p5', 'Plus de 5 ans']];
  const RENTREE_M = [['debut', 'Effectif au début de l’année'], ['besoin', 'Dont enfants à besoin spécifique']];
  const FIN_M = [['debut', 'Effectif au début de l’année'], ['fin', 'Effectif en fin d’année'], ['besoin', 'Dont enfants à besoin spécifique'], ['aband', 'Abandons']];
  const estMaternelle = (ecoleId) => { const ec = data.ecoles.find(x => x.id == ecoleId); return !!ec && String(ec.type).indexOf('EM') === 0; };
  /** Tableau de saisie G / F par section (SP, SG) : lignes [[code, libellé]], noms « prefixe_code_sp_G ». */
  function grilleSections(prefixe, lignes, valeurs) {
    return '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;"><thead><tr><th></th>'
      + SECTIONS_M.map(([, l]) => '<th colspan="2">' + l + '</th>').join('') + '</tr><tr><th></th>'
      + SECTIONS_M.map(() => '<th>G</th><th>F</th>').join('') + '</tr></thead><tbody>'
      + lignes.map(([k, l]) => '<tr><td><b>' + l + '</b></td>' + SECTIONS_M.map(([sc]) => ['G', 'F'].map(sx => {
        const n = prefixe + '_' + k + '_' + sc + '_' + sx;
        return '<td><input type="number" min="0" style="width:56px;" name="' + n + '" value="' + (valeurs[n] || 0) + '" oninput="calcTotalEff()"></td>';
      }).join('')).join('') + '</tr>').join('') + '</tbody></table></div>';
  }

  function renderEffectifs() {
    const ecoleF = document.getElementById('filterEcoleEff').value;
    const liste = data.effectifs.filter(e => !ecoleF || e.ecoleId == ecoleF);
    document.getElementById('effectifsTable').innerHTML = liste.map(e =>
      '<tr><td>' + echapper(nomEcole(e.ecoleId)) + '</td><td>' + echapper(e.annee || '—') + '</td>'
      + '<td>' + (e.totalG || 0) + '</td><td>' + (e.totalF || 0) + '</td>'
      + '<td><b>' + (e.total || 0) + '</b></td><td>' + (e.handicapes || 0) + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" title="Modifier" onclick="editEffectif(\'' + e.id + '\')">✏️</button>'
      + (UPO && (UPO.officielEcole(nomEcole(e.ecoleId)) || {}).effectifs
        ? '<button class="btn btn-info btn-sm" title="Réinitialiser : effectifs du fichier de la CS" onclick="reinitialiserEffectifs(\'' + e.ecoleId + '\')">♻</button>' : '')
      + '<button class="btn btn-danger btn-sm" title="Supprimer" onclick="deleteEffectif(\'' + e.id + '\')">🗑️</button>'
      + (e.source ? '<div class="petit muet" style="font-size:11px">' + echapper(e.source) + '</div>' : '')
      + '</td></tr>').join('')
      || '<tr><td colspan="7" class="text-center">Aucun effectif enregistré</td></tr>';
  }

  function openEffectifModal(id) {
    const e = id ? data.effectifs.find(x => x.id == id) || {} : {};
    e.ages = e.ages || {};
    const lignes = AGES.map(age => '<tr><td><b>' + age + '</b></td>'
      + CLASSES.map(c => '<td><input type="number" min="0" name="age_' + age + '_' + c + '_G" '
        + 'value="' + (e.ages[age + '_' + c + '_G'] || 0) + '" style="width:44px;" '
        + 'oninput="calcTotalEff()"> / <input type="number" min="0" name="age_' + age + '_' + c
        + '_F" value="' + (e.ages[age + '_' + c + '_F'] || 0) + '" style="width:44px;" '
        + 'oninput="calcTotalEff()"></td>').join('') + '</tr>').join('');

    openModal(id ? 'Modifier les effectifs' : 'Nouveau relevé d\'effectifs',
      '<form onsubmit="saveEffectif(event, \'' + (id || '') + '\')">'
      + '<div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(e.ecoleId) + '</select></div>'
      + champ('Année scolaire', 'annee', e.annee || anneeActive())
      + '<div class="form-group"><label>Total garçons</label><input type="number" name="totalG" '
      + 'id="tG" value="' + (e.totalG || 0) + '" oninput="calcTotalEff()"></div>'
      + '<div class="form-group"><label>Total filles</label><input type="number" name="totalF" '
      + 'id="tF" value="' + (e.totalF || 0) + '" oninput="calcTotalEff()"></div>'
      + '<div class="form-group"><label>Total général</label><input type="number" name="total" '
      + 'id="tT" value="' + (e.total || 0) + '" readonly></div>'
      + champ('Dont handicapés', 'handicapes', e.handicapes || 0, 'number')
      + champ('Redoublants', 'redoublants', e.redoublants || 0, 'number')
      + champ('Sans acte de naissance', 'sansActe', e.sansActe || 0, 'number')
      + '</div>'
      + '<div id="blocMat" class="form-section mt-15"><h4>École maternelle : effectifs par section (SP, SG)</h4>'
      + '<p style="font-size:12px;color:#64748b;" class="mb-15">Fiche de recensement (tableau 3), rapport de rentrée et fiche de fin d’année '
      + '(« Répartition des enfants par section »). Renseigné, l’effectif par section commande les totaux par sexe.</p>'
      + '<h5>Effectif par section (recensement)</h5>' + grilleSections('s', [['eff', 'Effectif']], e)
      + '<h5 class="mt-15">Répartition par âge et par section (tableau 3 de la fiche de recensement)</h5>'
      + grilleSections('agem', AGES_M, Object.fromEntries(Object.entries(e.agesM || {}).map(([k, v]) => ['agem_' + k, v])))
      + '<h5 class="mt-15">Rapport de rentrée</h5>' + grilleSections('rent', RENTREE_M, e)
      + '<h5 class="mt-15">Fiche de fin d’année</h5>' + grilleSections('fin', FIN_M, e) + '</div>'
      + '<div class="form-section mt-15 blocPrim"><h4>Effectif par cours</h4>'
      + '<p style="font-size:12px;color:#64748b;" class="mb-15">Renseigné, ce tableau '
      + 'commande les totaux par sexe.</p>'
      + '<div style="overflow-x:auto;"><table style="width:100%;font-size:12px;">'
      + '<thead><tr><th>Sexe</th>' + CLASSES.map(c => '<th>' + c + '</th>').join('')
      + '<th>Total</th></tr></thead><tbody>'
      + ['G', 'F'].map(sx => '<tr><td><b>' + (sx === 'G' ? 'Garçons' : 'Filles') + '</b></td>'
        + CLASSES.map(c => '<td><input type="number" min="0" style="width:56px;" name="c_'
          + c.toLowerCase() + '_' + sx + '" value="'
          + (e['c_' + c.toLowerCase() + '_' + sx] || 0) + '" oninput="calcTotalEff()"></td>').join('')
        + '<td id="tc' + sx + '"></td></tr>').join('')
      + '</tbody></table></div></div>'
      + '<div class="form-section mt-15 blocPrim"><h4>Répartition par âge et par classe (G / F)</h4>'
      + '<p class="mb-15" style="font-size:12px;color:#64748b;">'
      + 'Le total général se met à jour automatiquement : il suit les totaux par sexe, '
      + 'ou la somme du tableau si vous le remplissez.</p>'
      + '<div style="overflow-x:auto;"><table style="width:100%;font-size:11px;">'
      + '<thead><tr><th>Âge</th>' + CLASSES.map(c => '<th>' + c + '</th>').join('') + '</tr></thead>'
      + '<tbody>' + lignes + '</tbody></table></div></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
    const selEc = document.querySelector('#modalBody form [name="ecoleId"]');
    const basculer = () => {
      const mat = estMaternelle(selEc.value);
      document.getElementById('blocMat').style.display = mat ? '' : 'none';
      document.querySelectorAll('#modalBody .blocPrim').forEach(b => { b.style.display = mat ? 'none' : ''; });
      calcTotalEff();
    };
    if (selEc) selEc.addEventListener('change', basculer);
    basculer();
  }

  /* Le tableau par âge fait foi dès qu'il est renseigné ; sinon on additionne
     simplement les deux totaux saisis à la main. */
  function calcTotalEff() {
    const form = document.querySelector('#modalBody form');
    if (!form) return;

    /* Le détail par cours l'emporte sur le tableau par âge, qui l'emporte à son
       tour sur les totaux saisis à la main. */
    let coursG = 0, coursF = 0, detaille = false;
    CLASSES.forEach(c => {
      ['G', 'F'].forEach(sx => {
        const inp = form.querySelector('[name="c_' + c.toLowerCase() + '_' + sx + '"]');
        const v = inp ? (parseInt(inp.value, 10) || 0) : 0;
        if (inp && inp.value !== '' && v > 0) detaille = true;
        if (sx === 'G') coursG += v; else coursF += v;
      });
    });
    const cG = document.getElementById('tcG');
    const cF = document.getElementById('tcF');
    if (cG) cG.innerHTML = '<b>' + coursG + '</b>';
    if (cF) cF.innerHTML = '<b>' + coursF + '</b>';

    let sommeG = 0, sommeF = 0;
    form.querySelectorAll('input[name^="age_"]').forEach(inp => {
      const v = parseInt(inp.value, 10) || 0;
      if (inp.name.endsWith('_G')) sommeG += v; else sommeF += v;
    });
    if (detaille) { sommeG = coursG; sommeF = coursF; }
    const selEc = form.querySelector('[name="ecoleId"]');
    if (selEc && estMaternelle(selEc.value)) {
      /* maternelle : l'effectif par section l'emporte, puis le tableau 3 (âges), puis les totaux saisis */
      const lire = (sel) => [...form.querySelectorAll(sel)].reduce((a, i) => a + (parseInt(i.value, 10) || 0), 0);
      const secG = lire('input[name^="s_eff_"][name$="_G"]'), secF = lire('input[name^="s_eff_"][name$="_F"]');
      const agG = lire('input[name^="agem_"][name$="_G"]'), agF = lire('input[name^="agem_"][name$="_F"]');
      if (secG + secF > 0) { sommeG = secG; sommeF = secF; } else { sommeG = agG; sommeF = agF; }
    }
    const tG = document.getElementById('tG');
    const tF = document.getElementById('tF');
    const tT = document.getElementById('tT');
    if (!tT) return;
    if (sommeG + sommeF > 0) { tG.value = sommeG; tF.value = sommeF; }
    tT.value = (parseInt(tG.value, 10) || 0) + (parseInt(tF.value, 10) || 0);
  }

  function saveEffectif(ev, id) {
    ev.preventDefault();
    const obj = { ages: {} };
    new FormData(ev.target).forEach((v, k) => {
      if (k.indexOf('age_') === 0) obj.ages[k.substring(4)] = v;
      else if (k.indexOf('agem_') === 0) { obj.agesM = obj.agesM || {}; obj.agesM[k.substring(5)] = v; }
      else obj[k] = v;
    });
    enregistrer('effectifs', obj, id, renderEffectifs);
  }
  function reinitialiserEffectifs(ecoleId) {
    if (!UPO) return;
    if (!confirm('Remettre les effectifs de ' + nomEcole(ecoleId) + ' (' + anneeActive() + ') tels que dans le fichier de la CS ?')) return;
    UPO.reinitEffectifs(ecoleId); renderEffectifs();
  }
  function reinitialiserTousEffectifs() {
    if (!UPO) return;
    if (!confirm('Remettre les effectifs ' + anneeActive() + ' de TOUTES les écoles tels que dans le fichier de la CS ?\n'
      + 'Les effectifs modifiés sur cet appareil seront remplacés (handicapés, redoublants et sans acte conservés).')) return;
    const n = UPO.reinitTousEffectifs(); renderEffectifs(); alert(n + ' relevé(s) remis aux valeurs du fichier de la CS.');
  }
  function reinitialiserEcole(id) {
    if (!UPO) return;
    const e = data.ecoles.find(x => x.id == id);
    if (!e || !UPO.officielEcole(e.nom)) { alert('Cette école ne figure pas dans les fichiers de la CS.'); return; }
    if (!confirm('Remettre la zone, l’unité pédagogique, l’année de création, les classes autorisées et l’effectif du personnel de '
      + e.nom + ' tels que dans les fichiers de la CS ?')) return;
    UPO.reinitEcole(id); closeModal(); renderEcoles();
  }
  function deleteEffectif(id) {
    if (!confirm('Supprimer ce relevé ?')) return;
    data.effectifs = data.effectifs.filter(x => x.id != id);
    saveData();
    renderEffectifs();
  }

  /* ---------------- Infrastructures ---------------- */

  function renderInfra() {
    document.getElementById('infraTable').innerHTML = data.infrastructures.map(i => {
      const ton = i.etat === 'Bon' ? 'success' : i.etat === 'Acceptable' ? 'warning' : 'danger';
      return '<tr><td>' + echapper(nomEcole(i.ecoleId)) + '</td><td>' + echapper(i.typeLocal || '—')
        + '</td><td>' + echapper(i.natureMurs || '—') + '</td>'
        + '<td><span class="badge badge-' + ton + '">' + echapper(i.etat || '—') + '</span></td>'
        + '<td>' + echapper(i.anneeService || '—') + '</td>'
        + '<td class="actions">'
        + '<button class="btn btn-warning btn-sm" onclick="editInfra(\'' + i.id + '\')">✏️</button>'
        + '<button class="btn btn-danger btn-sm" onclick="deleteInfra(\'' + i.id + '\')">🗑️</button>'
        + '</td></tr>';
    }).join('') || '<tr><td colspan="6" class="text-center">Aucune infrastructure</td></tr>';
  }

  function openInfraModal(id) {
    const i = id ? data.infrastructures.find(x => x.id == id) || {} : {};
    openModal(id ? 'Modifier un local' : 'Ajouter un local',
      '<form onsubmit="saveInfra(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(i.ecoleId) + '</select></div>'
      + selecteur('Type de local', 'typeLocal', ['Salle de classe', 'Bureau', 'Magasin', 'Latrines',
        'Cuisine', 'Bibliothèque', 'Salle informatique', 'Logement'], i.typeLocal)
      + champ('Année mise en service', 'anneeService', i.anneeService, 'number')
      + champ('Superficie (m²)', 'superficie', i.superficie, 'number')
      + selecteur('Nature des murs', 'natureMurs', ['En dur', 'Semi-dur/banco', 'Planche/bambou',
        'Sans mur'], i.natureMurs)
      + selecteur('État', 'etat', ['Bon', 'Acceptable', 'Mauvais'], i.etat)
      + selecteur('Nature du toit', 'natureToit', ['Tôles', 'Tuiles', 'Fibro ciment', 'Dalles',
        'Paille', 'Sans toit'], i.natureToit)
      + selecteur('Financeur', 'financeur', ['État', 'Collectivités locales', 'APE',
        'Aide extérieure', 'Autres'], i.financeur)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }
  function saveInfra(ev, id) {
    ev.preventDefault();
    enregistrer('infrastructures', Object.fromEntries(new FormData(ev.target)), id, renderInfra);
  }
  function deleteInfra(id) {
    if (!confirm('Supprimer ?')) return;
    data.infrastructures = data.infrastructures.filter(x => x.id != id);
    saveData(); renderInfra();
  }

  /* ---------------- Mobilier ---------------- */

  function renderMobilier() {
    document.getElementById('mobilierTable').innerHTML = data.mobilier.map(m =>
      '<tr><td>' + echapper(nomEcole(m.ecoleId)) + '</td><td>' + echapper(m.categorie || '—')
      + '</td><td>' + echapper(m.designation || '—') + '</td><td>' + (m.quantite || 0) + '</td>'
      + '<td><span class="badge badge-' + (m.etat === 'Bon' ? 'success' : 'warning') + '">'
      + echapper(m.etat || '—') + '</span></td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="editMobilier(\'' + m.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteMobilier(\'' + m.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="6" class="text-center">Aucun mobilier</td></tr>';
  }

  function openMobilierModal(id) {
    const m = id ? data.mobilier.find(x => x.id == id) || {} : {};
    openModal(id ? 'Modifier' : 'Ajouter mobilier ou matériel',
      '<form onsubmit="saveMobilier(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(m.ecoleId) + '</select></div>'
      + selecteur('Catégorie', 'categorie', ['Mobilier élèves', 'Mobilier enseignant',
        'Équipement didactique', 'Ouvrage pédagogique', 'Manuel scolaire',
        'Équipement adapté (handicap)'], m.categorie)
      + '<div class="form-group"><label>Désignation *</label><input name="designation" value="'
      + echapper(m.designation || '') + '" required placeholder="Ex : table-banc 2 places"></div>'
      + champ('Quantité', 'quantite', m.quantite || 0, 'number')
      + selecteur('État', 'etat', ['Bon', 'Mauvais'], m.etat)
      + selecteur('Classe concernée', 'classe', [''].concat(CLASSES)
        .concat(['Petits', 'Grands', 'Toutes']), m.classe)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }
  function saveMobilier(ev, id) {
    ev.preventDefault();
    enregistrer('mobilier', Object.fromEntries(new FormData(ev.target)), id, renderMobilier);
  }
  function deleteMobilier(id) {
    if (!confirm('Supprimer ?')) return;
    data.mobilier = data.mobilier.filter(x => x.id != id);
    saveData(); renderMobilier();
  }

  /* ---------------- Attribution des classes ---------------- */

  function ecoleChoisie(idSelect) {
    const sel = document.getElementById(idSelect);
    if (!sel) return null;
    if (!sel.value && global.Config.estEcole()) {
      const seule = ecoleDuPoste();
      if (seule) { sel.value = seule.id; return seule; }
    }
    return sel.value ? data.ecoles.find(x => x.id == sel.value) : null;
  }

  function renderClassesAttrib() {
    const sel = document.getElementById('classesEcole');
    if (sel.options.length <= 1) {
      sel.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
    }
    const ecole = ecoleChoisie('classesEcole');
    const zone = document.getElementById('classesTableAttrib');
    if (!ecole) {
      document.getElementById('resumeClassesAttrib').innerHTML = '';
      zone.innerHTML = '<tr><td colspan="5" class="text-center">Choisissez une école.</td></tr>';
      return;
    }

    const cycle = String(ecole.type).indexOf('EM') === 0 ? 'MATERNELLE' : 'PRIMAIRE';
    const cours = cycle === 'MATERNELLE' ? ['Petits', 'Grands'] : V().COURS;
    const agents = data.personnel.filter(p => p.ecoleId == ecole.id
      && (p.categorie || 'Enseignant') === 'Enseignant'
      && global.Carriere.estActif(p));
    const releve = data.effectifs.filter(e => e.ecoleId == ecole.id
      && (!e.annee || e.annee === anneeActive()))[0] || {};

    /* Un enseignant attribué à deux cours est signalé, pas interdit :
       les classes jumelées existent. */
    const compte = {};
    cours.forEach(c => {
      const a2 = attributionDe(ecole.id, c);
      if (a2.enseignantId) compte[a2.enseignantId] = (compte[a2.enseignantId] || 0) + 1;
    });

    const attribues = cours.filter(c => attributionDe(ecole.id, c).enseignantId).length;
    const sansClasse = agents.filter(p => !compte[p.id]).length;
    document.getElementById('resumeClassesAttrib').innerHTML =
      carte(cours.length, 'Cours à pourvoir')
      + carte(attribues, 'Cours pourvus', attribues < cours.length ? 'red' : 'blue')
      + carte(agents.length, 'Enseignants en poste')
      + carte(sansClasse, 'Enseignants sans classe', sansClasse ? 'yellow' : '');

    zone.innerHTML = cours.map(c => {
      const a2 = attributionDe(ecole.id, c);
      const effectif = (parseInt(releve['c_' + c.toLowerCase() + '_G'], 10) || 0)
        + (parseInt(releve['c_' + c.toLowerCase() + '_F'], 10) || 0);
      const doublon = a2.enseignantId && compte[a2.enseignantId] > 1;
      return '<tr><td><b>' + echapper(c) + '</b></td>'
        + '<td><select onchange="majAttribution(\'' + ecole.id + '\',\'' + c
        + '\',\'enseignantId\',this.value)"><option value="">— Non attribué —</option>'
        + agents.sort((x, y) => (x.nom || '').localeCompare(y.nom || '', 'fr'))
          .map(p => '<option value="' + p.id + '"'
            + (a2.enseignantId == p.id ? ' selected' : '') + '>' + echapper(p.nom)
            + '</option>').join('')
        + '</select></td>'
        + '<td>' + (effectif || '—') + '</td>'
        + '<td><input style="width:110px;" value="' + echapper(a2.salle || '')
        + '" onchange="majAttribution(\'' + ecole.id + '\',\'' + c
        + '\',\'salle\',this.value)"></td>'
        + '<td>' + (doublon
          ? '<span class="badge badge-warning">également sur un autre cours</span>'
          : (a2.enseignantId ? '<span class="badge badge-success">attribué</span>'
            : '<span class="badge badge-danger">à pourvoir</span>')) + '</td></tr>';
    }).join('');
  }

  function attributionDe(ecoleId, cours, creer) {
    let a2 = data.attributions.filter(x => x.ecoleId == ecoleId && x.cours === cours
      && x.annee === anneeActive())[0];
    if (!a2) {
      a2 = { id: uid(), ecoleId: ecoleId, cours: cours, annee: anneeActive() };
      if (creer) data.attributions.push(a2);
    }
    return a2;
  }

  function majAttribution(ecoleId, cours, champ2, valeur) {
    const a2 = attributionDe(ecoleId, cours, true);
    a2[champ2] = valeur;
    /* Le cours tenu de l'enseignant suit son attribution. */
    if (champ2 === 'enseignantId' && valeur) {
      const agent = data.personnel.find(x => x.id == valeur);
      if (agent) agent.cours = cours;
    }
    saveData();
    renderClassesAttrib();
  }

  /**
   * Reporte les attributions de classes (titulaire, salle) de l'année
   * précédente vers l'année active, cours par cours et école par école : un
   * point de départ à corriger plutôt qu'à ressaisir entièrement (par
   * exemple pré-remplir 2026-2027 avec les titulaires de 2025-2026).
   * N'écrase jamais une attribution déjà saisie pour l'année active, et
   * n'importe pas un titulaire qui n'est plus en poste dans cette école —
   * l'école le remplace alors elle-même.
   */
  function reporterAttributionsAnneePrecedente() {
    const precedente = anneePrecedente();
    const active = data.annees.find(a => a.active);
    if (!precedente || !active) {
      alert('Aucune année précédente à reporter.');
      return;
    }
    const source = data.attributions.filter(a => a.annee === precedente.libelle);
    if (!source.length) {
      alert('Aucune attribution enregistrée pour ' + precedente.libelle + '.');
      return;
    }
    const dejaPresentes = new Set(data.attributions.filter(a => a.annee === active.libelle)
      .map(a => a.ecoleId + '|' + a.cours));
    const aReporter = source.filter(a => !dejaPresentes.has(a.ecoleId + '|' + a.cours));
    if (!aReporter.length) {
      alert('Tous les cours ayant une attribution ' + precedente.libelle
        + ' ont déjà une attribution ' + active.libelle + '.');
      return;
    }
    if (!confirm(aReporter.length + ' attribution(s) (titulaire, salle) vont être reportées de '
      + precedente.libelle + ' comme point de départ pour ' + active.libelle
      + ' (à corriger ensuite selon les mouvements de personnel). Continuer ?')) return;
    aReporter.forEach(a => {
      const copie = Object.assign({}, a);
      copie.id = uid();
      copie.annee = active.libelle;
      /* Un titulaire qui n'est plus en poste dans cette école (mutation,
         retraite…) ne doit pas rester affiché comme si de rien n'était :
         la case redevient « à pourvoir ». */
      const agent = copie.enseignantId ? data.personnel.find(p => p.id == copie.enseignantId) : null;
      if (!agent || agent.ecoleId != copie.ecoleId || !global.Carriere.estActif(agent)) {
        copie.enseignantId = '';
      }
      data.attributions.push(copie);
    });
    saveData();
    renderClassesAttrib();
    alert(aReporter.length + ' attribution(s) reportée(s) de ' + precedente.libelle
      + ' vers ' + active.libelle + '.');
  }

  function exporterClasses() {
    const ecole = ecoleChoisie('classesEcole');
    if (!ecole) { alert('Choisissez une école.'); return; }
    const cycle = String(ecole.type).indexOf('EM') === 0 ? 'MATERNELLE' : 'PRIMAIRE';
    const cours = cycle === 'MATERNELLE' ? ['Petits', 'Grands'] : V().COURS;
    const releve = data.effectifs.filter(e => e.ecoleId == ecole.id
      && (!e.annee || e.annee === anneeActive()))[0] || {};
    const lignes = [['École', 'Année', 'Cours', 'Titulaire', 'Matricule', 'Grade',
      'Effectif', 'Salle']];
    cours.forEach(c => {
      const a2 = attributionDe(ecole.id, c);
      const agent = data.personnel.find(x => x.id == a2.enseignantId) || {};
      lignes.push([ecole.nom, anneeActive(), c, agent.nom || '', agent.matricule || '',
        agent.grade || '',
        (parseInt(releve['c_' + c.toLowerCase() + '_G'], 10) || 0)
          + (parseInt(releve['c_' + c.toLowerCase() + '_F'], 10) || 0),
        a2.salle || '']);
    });
    telecharger('cs-pobe-attribution-classes-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Gestion collégiale ---------------- */

  const INSTANCES = [
    { cle: 'APE', libelle: 'Association des parents d’élèves' },
    { cle: 'AME', libelle: 'Association des mères d’élèves' },
    { cle: 'DIRECTION', libelle: 'Comité de direction' },
    { cle: 'MAITRES', libelle: 'Conseil des maîtres' },
    { cle: 'CANTINE', libelle: 'Comité de gestion de la cantine' },
    { cle: 'SANTE', libelle: 'Comité de santé' },
    { cle: 'LIVRE', libelle: 'Comité de gestion du livre' },
    { cle: 'ESPACE_VERT', libelle: 'Comité espace vert' },
    { cle: 'ENFANTS', libelle: 'Gouvernement des enfants' },
    { cle: 'GENRE', libelle: 'Comité genre' },
    { cle: 'RECEPTION', libelle: 'Comité de réception du matériel' }
  ];
  // v2.6 : le bureau UASCEP (école, UP, zone, CS, DDEMP) a son propre module « Bureaux UASCEP » (js/uascep.js) ;
  // les anciens membres « UASCEP » de la gestion collégiale y sont repris automatiquement (sans perte).

  const FONCTIONS_INSTANCE = ['Responsable', 'Président', 'Vice-président', 'Secrétaire',
    'Secrétaire adjoint', 'Trésorier', 'Trésorier adjoint', 'Commissaire aux comptes',
    'Responsable des activités sportives (RAS)', 'Membre'];

  function libelleInstance(cle) {
    const i = INSTANCES.filter(x => x.cle === cle)[0];
    return i ? i.libelle : cle === 'UASCEP' ? 'Bureau UASCEP (repris dans « Bureaux UASCEP »)' : cle;
  }

  function renderCollegiale() {
    const selE = document.getElementById('collegialeEcole');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
      document.getElementById('collegialeInstance').innerHTML =
        '<option value="">Toutes les instances</option>'
        + INSTANCES.map(i => '<option value="' + i.cle + '">' + echapper(i.libelle)
          + '</option>').join('');
    }
    const ecole = ecoleChoisie('collegialeEcole');
    const instanceF = document.getElementById('collegialeInstance').value;
    const zone = document.getElementById('collegialeTable');

    if (!ecole) {
      document.getElementById('resumeCollegiale').innerHTML = '';
      zone.innerHTML = '<tr><td colspan="7" class="text-center">Choisissez une école.</td></tr>';
      return;
    }

    const membres = data.collegiale.filter(m => m.ecoleId == ecole.id && !m.migreUascep
      && (!instanceF || m.instance === instanceF));
    const instancesGarnies = {};
    data.collegiale.filter(m => m.ecoleId == ecole.id && !m.migreUascep)
      .forEach(m => { instancesGarnies[m.instance] = true; });
    const femmes = membres.filter(m => String(m.sexe || '').toUpperCase() === 'F').length;

    document.getElementById('resumeCollegiale').innerHTML =
      carte(Object.keys(instancesGarnies).length + ' / ' + INSTANCES.length,
        'Instances constituées')
      + carte(membres.length, 'Membres', 'blue')
      + carte(membres.length ? Math.round(femmes / membres.length * 1000) / 10 + ' %' : '—',
        'Part de femmes', membres.length && femmes / membres.length < 0.3 ? 'yellow' : '')
      + carte(membres.filter(m => m.fonction === 'Président').length, 'Présidents désignés');

    zone.innerHTML = membres
      .sort((a2, b2) => (a2.instance || '').localeCompare(b2.instance || ''))
      .map(m => '<tr><td>' + echapper(libelleInstance(m.instance)) + '</td>'
        + '<td>' + echapper(m.fonction || '—') + '</td>'
        + '<td><b>' + echapper(m.nom) + '</b></td>'
        + '<td>' + echapper(m.sexe || '—') + '</td>'
        + '<td>' + echapper(m.contact || '—') + '</td>'
        + '<td>' + formatDate(m.depuis) + '</td>'
        + '<td class="actions">'
        + '<button class="btn btn-warning btn-sm" onclick="openMembreModal(\'' + m.id + '\')">✏️</button>'
        + '<button class="btn btn-danger btn-sm" onclick="supprimerMembre(\'' + m.id + '\')">🗑️</button>'
        + '</td></tr>').join('')
      || '<tr><td colspan="7" class="text-center">Aucun membre enregistré</td></tr>';

    renderUASCEP();
  }

  /* ---------------- Bureau UASCEP (Unité pédagogique et Commune) ----------------
     Le bureau UASCEP ne couvre pas une école mais une unité pédagogique
     entière, ou la commune : ses membres vivent dans la même collection que
     la gestion collégiale, repérés par `niveau` et `portee` plutôt que par
     une école. */

  function communesConnues() {
    const base = [];
    data.ecoles.forEach(e => { if (e.commune && base.indexOf(e.commune) < 0) base.push(e.commune); });
    if (!base.length) base.push('POBE');
    return base.sort();
  }

  /** En mode ÉCOLE, le bureau UASCEP « Unité pédagogique » ne montre que
      celle du poste : les autres unités n'ont rien à faire sur ce poste. Le
      niveau « Commune » reste commun à tous, la circonscription n'en ayant
      qu'une seule. */
  function porteesUASCEP(niveau) {
    if (niveau === 'COMMUNE') return communesConnues();
    if (global.Config.estEcole()) {
      const e = ecoleDuPoste();
      return e && e.unite_ped ? [e.unite_ped] : [];
    }
    return unitesConnues();
  }

  function renderUASCEP() {
    const selNiveau = document.getElementById('uascepNiveau');
    const selPortee = document.getElementById('uascepPortee');
    if (!selNiveau || !selPortee) return;
    const niveau = selNiveau.value || 'UP';
    const portees = porteesUASCEP(niveau);
    const valeurCourante = selPortee.value;
    selPortee.innerHTML = portees.map(p => '<option value="' + echapper(p) + '">'
      + echapper(p) + '</option>').join('') || '<option value="">— Aucune —</option>';
    if (portees.indexOf(valeurCourante) >= 0) selPortee.value = valeurCourante;
    const portee = selPortee.value;

    const membres = data.collegiale.filter(m => m.niveau === niveau && m.portee === portee);
    document.getElementById('uascepTable').innerHTML = membres.length === 0
      ? '<tr><td colspan="6" class="text-center">Aucun membre enregistré</td></tr>'
      : membres.map(m => '<tr><td>' + echapper(m.fonction || '—') + '</td>'
        + '<td><b>' + echapper(m.nom) + '</b></td>'
        + '<td>' + echapper(m.sexe || '—') + '</td>'
        + '<td>' + echapper(m.contact || '—') + '</td>'
        + '<td>' + formatDate(m.depuis) + '</td>'
        + '<td class="actions">'
        + '<button class="btn btn-warning btn-sm" onclick="openMembreUASCEPModal(\'' + m.id + '\')">✏️</button>'
        + '<button class="btn btn-danger btn-sm" onclick="supprimerMembreUASCEP(\'' + m.id + '\')">🗑️</button>'
        + '</td></tr>').join('');
  }

  function openMembreUASCEPModal(id) {
    const m = id ? data.collegiale.find(x => x.id == id) || {} : {};
    const niveau = (document.getElementById('uascepNiveau') || {}).value || 'UP';
    const portee = (document.getElementById('uascepPortee') || {}).value || '';
    if (!id && !portee) {
      alert('Choisissez d’abord une unité pédagogique ou une commune.');
      return;
    }
    openModal(id ? 'Modifier un membre du bureau UASCEP' : 'Ajouter un membre au bureau UASCEP',
      '<form onsubmit="saveMembreUASCEP(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>' + (niveau === 'COMMUNE' ? 'Commune' : 'Unité pédagogique')
      + '</label><input value="' + echapper(m.portee || portee) + '" disabled></div>'
      + selecteur('Fonction *', 'fonction', FONCTIONS_INSTANCE, m.fonction || 'Responsable', true)
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(m.nom || '') + '" required></div>'
      + selecteur('Sexe', 'sexe', [['', '—'], ['M', 'Masculin'], ['F', 'Féminin']], m.sexe)
      + champ('Contact téléphonique', 'contact', m.contact)
      + '<div class="form-group"><label>Membre depuis</label><input type="date" '
      + 'name="depuis" value="' + echapper(m.depuis || '') + '"></div>'
      + champ('Observation', 'observation', m.observation)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveMembreUASCEP(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    if (!id) {
      obj.instance = 'UASCEP';
      obj.niveau = (document.getElementById('uascepNiveau') || {}).value || 'UP';
      obj.portee = (document.getElementById('uascepPortee') || {}).value || '';
    }
    enregistrer('collegiale', obj, id, renderUASCEP);
  }

  function supprimerMembreUASCEP(id) {
    if (!confirm('Retirer ce membre ?')) return;
    data.collegiale = data.collegiale.filter(x => x.id != id);
    saveData();
    renderUASCEP();
  }

  function exporterUASCEP() {
    const niveau = (document.getElementById('uascepNiveau') || {}).value || 'UP';
    const membres = data.collegiale.filter(m => m.niveau === niveau);
    if (!membres.length) { alert('Aucun membre enregistré.'); return; }
    const lignes = [[niveau === 'COMMUNE' ? 'Commune' : 'Unité pédagogique', 'Fonction',
      'Nom et prénoms', 'Sexe', 'Contact', 'Membre depuis', 'Observation']];
    membres.forEach(m => lignes.push([m.portee || '', m.fonction || '', m.nom || '',
      m.sexe || '', m.contact || '', m.depuis || '', m.observation || '']));
    telecharger('cs-pobe-bureau-uascep.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  function openMembreModal(id) {
    const m = id ? data.collegiale.find(x => x.id == id) || {} : {};
    const ecole = ecoleChoisie('collegialeEcole');
    if (!ecole && !id) { alert('Choisissez d’abord une école.'); return; }
    openModal(id ? 'Modifier un membre' : 'Ajouter un membre',
      '<form onsubmit="saveMembre(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + selecteur('Instance *', 'instance', INSTANCES.map(i => [i.cle, i.libelle]),
        m.instance, true)
      + selecteur('Fonction *', 'fonction', FONCTIONS_INSTANCE, m.fonction, true)
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(m.nom || '') + '" required></div>'
      + selecteur('Sexe', 'sexe', [['', '—'], ['M', 'Masculin'], ['F', 'Féminin']], m.sexe)
      + champ('Contact téléphonique', 'contact', m.contact)
      + '<div class="form-group"><label>Membre depuis</label><input type="date" '
      + 'name="depuis" value="' + echapper(m.depuis || '') + '"></div>'
      + champ('Observation', 'observation', m.observation)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveMembre(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    if (!id) {
      const ecole = ecoleChoisie('collegialeEcole');
      obj.ecoleId = ecole ? ecole.id : null;
    }
    enregistrer('collegiale', obj, id, renderCollegiale);
  }

  function supprimerMembre(id) {
    if (!confirm('Retirer ce membre ?')) return;
    data.collegiale = data.collegiale.filter(x => x.id != id);
    saveData();
    renderCollegiale();
  }

  function exporterCollegiale() {
    const ecole = ecoleChoisie('collegialeEcole');
    const membres = data.collegiale.filter(m => !ecole || m.ecoleId == ecole.id);
    if (!membres.length) { alert('Aucun membre enregistré.'); return; }
    const lignes = [['École', 'Instance', 'Fonction', 'Nom et prénoms', 'Sexe',
      'Contact', 'Membre depuis', 'Observation']];
    membres.forEach(m => lignes.push([nomEcole(m.ecoleId), libelleInstance(m.instance),
      m.fonction || '', m.nom || '', m.sexe || '', m.contact || '', m.depuis || '',
      m.observation || '']));
    telecharger('cs-pobe-gestion-collegiale.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Répertoires et contacts ---------------- */

  const SECTEURS = [
    { cle: 'EPP', libelle: 'EP publique' },
    { cle: 'EPPRIV', libelle: 'EP privée' },
    { cle: 'EM', libelle: 'EM publique' },
    { cle: 'EMPRIV', libelle: 'EM privée' }
  ];

  function libelleSecteur(type) {
    const s2 = SECTEURS.filter(x => x.cle === type)[0];
    return s2 ? s2.libelle : (type || '—');
  }

  function ongletRepertoire() {
    const actif = document.querySelector('#repertoires .tab.active');
    return actif ? actif.dataset.tab : 'rep-directeurs';
  }

  function renderRepertoires() {
    renderDirecteurs();
    renderCP();
    renderUP();
    renderComite();
  }

  /* --- Directeurs, par secteur --- */
  function renderDirecteurs() {
    const secteur = (document.getElementById('filterSecteurRep') || {}).value || '';
    const rech = ((document.getElementById('searchDirecteur') || {}).value || '').toLowerCase();

    const liste = data.ecoles.filter(e =>
      (!secteur || e.type === secteur)
      && (!rech || (e.nom || '').toLowerCase().indexOf(rech) >= 0
        || (e.directeur || '').toLowerCase().indexOf(rech) >= 0))
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'));

    document.getElementById('resumeDirecteurs').innerHTML = SECTEURS.map(sec => {
      const ecoles = data.ecoles.filter(e => e.type === sec.cle);
      const nommes = ecoles.filter(e => e.directeur).length;
      return carte(nommes + ' / ' + ecoles.length, sec.libelle,
        ecoles.length && nommes < ecoles.length ? 'yellow' : 'blue');
    }).join('');

    document.getElementById('directeursTable').innerHTML = liste.map(e =>
      '<tr><td><span class="badge badge-info">' + echapper(libelleSecteur(e.type))
      + '</span></td><td><b>' + echapper(e.nom) + '</b></td>'
      + '<td>' + echapper(e.arrondissement || '—') + '</td>'
      + '<td>' + echapper(e.zone_ped || '—') + '</td>'
      + '<td>' + echapper(e.unite_ped || '—') + '</td>'
      + '<td>' + (e.directeur ? echapper(e.directeur)
        : '<span class="badge badge-warning">à renseigner</span>') + '</td>'
      + '<td>' + echapper(e.contact_directeur || e.telephone || '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="modifierDirecteur(\'' + e.id
      + '\')">✏️</button></td></tr>').join('')
      || '<tr><td colspan="8" class="text-center">Aucune école</td></tr>';
  }

  function modifierDirecteur(id) {
    const e = data.ecoles.find(x => x.id == id);
    if (!e) return;
    openModal('Directeur — ' + e.nom,
      '<form onsubmit="saveDirecteur(event, \'' + id + '\')"><div class="form-grid">'
      + champ('Nom et prénoms du directeur', 'directeur', e.directeur)
      + champ('Contact téléphonique', 'contact_directeur', e.contact_directeur)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveDirecteur(ev, id) {
    ev.preventDefault();
    const e = data.ecoles.find(x => x.id == id);
    if (e) Object.assign(e, Object.fromEntries(new FormData(ev.target)));
    saveData();
    closeModal();
    renderRepertoires();
  }

  /* --- Conseillers pédagogiques, par zone --- */
  function renderCP() {
    document.getElementById('cpTable').innerHTML = identitesCS()
      .filter(x => x.zone).map(cp => {
        const ecoles = data.ecoles.filter(e => e.zone_ped === cp.zone).length;
        return '<tr><td><b>' + echapper(cp.zone) + '</b></td>'
          + '<td>' + (cp.responsable ? echapper(cp.responsable)
            : '<span class="badge badge-warning">à renseigner</span>') + '</td>'
          + '<td>' + echapper(cp.contact || '—') + '</td>'
          + '<td>' + ecoles + '</td>'
          + '<td class="actions">'
          + '<button class="btn btn-warning btn-sm" onclick="modifierCP(\'' + cp.code
          + '\')">✏️</button></td></tr>';
      }).join('') || '<tr><td colspan="5" class="text-center">Aucune zone</td></tr>';
  }

  function modifierCP(code) {
    const cp = identiteCS(code);
    if (!cp) return;
    openModal('Conseiller pédagogique — ' + cp.zone,
      '<form onsubmit="saveCP(event, \'' + code + '\')"><div class="form-grid">'
      + champ('Nom et prénoms', 'responsable', cp.responsable)
      + champ('Contact téléphonique', 'contact', cp.contact)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveCP(ev, code) {
    ev.preventDefault();
    const cp = identiteCS(code);
    if (cp) Object.assign(cp, Object.fromEntries(new FormData(ev.target)));
    saveData();
    closeModal();
    renderRepertoires();
  }

  /* --- Unités pédagogiques --- */
  function unitesPedagogiques() {
    const connues = {};
    unitesConnues().forEach(u => { connues[u] = true; });
    data.unites.forEach(u => { connues[u.nom] = true; });
    return Object.keys(connues).sort().map(nom => {
      const fiche = data.unites.filter(u => u.nom === nom)[0] || { nom: nom };
      const ecoles = data.ecoles.filter(e => e.unite_ped === nom);
      return { fiche: fiche, nom: nom, ecoles: ecoles.length,
        arrondissement: fiche.arrondissement || (ecoles.length ? (ecoles[0].arrondissement || '—') : '—') };
    });
  }

  const jsNom = n => "decodeURIComponent('" + encodeURIComponent(n) + "')";
  function renderUP() {
    const tb = document.getElementById('upTable');
    if (!tb) return;
    const zoneF = (document.getElementById('filterZoneUP') || {}).value || '';
    const cycleF = (document.getElementById('filterCycleUP') || {}).value || '';
    const liste = unitesPedagogiques().filter(u => u.ecoles || u.fiche.rup || u.fiche.officielle || u.fiche.id)
      .map(u => Object.assign(u, { zone: u.fiche.zone || (data.ecoles.find(e => e.unite_ped === u.nom) || {}).zone_ped || '',
        cycle: u.fiche.cycle || '' }))
      .filter(u => (!zoneF || u.zone === zoneF) && (!cycleF || u.cycle === cycleF))
      .sort((a, b) => (a.zone || 'Z').localeCompare(b.zone || 'Z') || (a.cycle === 'Maternelle' ? -1 : b.cycle === 'Maternelle' ? 1 : 0)
        || ((a.fiche.numero || 99) - (b.fiche.numero || 99)) || a.nom.localeCompare(b.nom, 'fr'));
    let zonePrec = null;
    tb.innerHTML = liste.map(u => {
      const membres = data.ecoles.filter(e => e.unite_ped === u.nom).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'));
      const ecoles = membres.map(e => echapper(e.nom) + (u.zone && e.zone_ped && e.zone_ped !== u.zone
        ? ' <span class="badge badge-warning" title="Zone d’appartenance : ' + echapper(e.zone_ped) + ' — suit les activités de cette UP">' + echapper(e.zone_ped) + '</span>' : ''));
      const ligneZone = u.zone !== zonePrec ? '<tr class="ligne-zone"><td colspan="10"><b>' + echapper(u.zone || 'Zone non renseignée')
        + '</b> — ' + liste.filter(x => x.zone === u.zone).length + ' unité(s) ; '
        + data.ecoles.filter(e => (e.zone_ped || '') === (u.zone || '')).length + ' école(s) de la zone (appartenance)</td></tr>' : '';
      zonePrec = u.zone;
      const officielle = UPO && UPO.officielUP(u.nom);
      return ligneZone + '<tr><td>' + echapper(u.zone || '—') + '</td><td>' + echapper(u.cycle || '—') + '</td>'
        + '<td><b>' + echapper(u.nom) + '</b>' + (officielle ? ' <span class="badge badge-info" title="Document de la CS">officielle</span>' : '') + '</td>'
        + '<td>' + echapper(u.arrondissement) + '</td>'
        + '<td><b>' + ecoles.length + '</b><div class="petit" style="font-size:11.5px;color:#475467;max-width:360px">' + ecoles.join(', ') + '</div></td>'
        + '<td>' + (u.fiche.rup ? echapper(u.fiche.rup) : '<span class="badge badge-warning">à renseigner</span>') + '</td>'
        + '<td>' + echapper(u.fiche.contact_rup || '—') + '</td>'
        + '<td>' + echapper(u.fiche.corup || '—') + '</td>'
        + '<td>' + echapper(u.fiche.contact_corup || '—') + '</td>'
        + '<td class="actions">'
        + '<button class="btn btn-warning btn-sm" title="Modifier" onclick="modifierUP(' + jsNom(u.nom) + ')">✏️</button>'
        + (officielle ? '<button class="btn btn-info btn-sm" title="Réinitialiser (valeurs du document de la CS)" onclick="reinitialiserUP(' + jsNom(u.nom) + ')">♻</button>' : '')
        + '<button class="btn btn-danger btn-sm" title="Supprimer" onclick="supprimerUP(' + jsNom(u.nom) + ')">🗑️</button></td></tr>';
    }).join('') || '<tr><td colspan="10" class="text-center">Aucune unité pédagogique</td></tr>';
    renderRubriquesEcoles();
  }

  /* --- Rubriques : écoles en attente d'UP, écoles ne fonctionnant plus --- */
  function renderRubriquesEcoles() {
    const R = (global.POBE_UP || {}).rubriques || {};
    const att = document.getElementById('attenteTable');
    if (att) {
      const sans = UPO ? UPO.aRattacher() : data.ecoles.filter(e => !e.unite_ped);
      const t = document.getElementById('attenteTitre');
      if (t) t.textContent = ((R.en_attente_up || {}).titre || 'Écoles en attente d’UP') + ' (' + sans.length + ')';
      att.innerHTML = sans.map(e => '<tr><td><b>' + echapper(e.nom) + '</b></td><td>' + echapper(e.type) + '</td><td>' + echapper(e.statut || '') + '</td>'
        + '<td>' + echapper(e.arrondissement || '—') + '</td><td>' + echapper(e.zone_ped || '—') + '</td>'
        + '<td class="actions"><button class="btn btn-primary btn-sm" onclick="rattacherEcoleUP(\'' + e.id + '\')">🔗 Donner une UP</button>'
        + '<button class="btn btn-secondary btn-sm" onclick="ecoleNeFonctionnePlus(\'' + e.id + '\')">⛔ Ne fonctionne plus</button></td></tr>').join('')
        || '<tr><td colspan="6" class="text-center">Toutes les écoles en activité ont une unité pédagogique.</td></tr>';
    }
    const ina = document.getElementById('inactivesTable');
    if (ina) {
      const l = (data.ecolesInactives || []).slice().sort((a, b) => a.ecole.nom.localeCompare(b.ecole.nom, 'fr'));
      const t = document.getElementById('inactivesTitre');
      if (t) t.textContent = ((R.ne_fonctionne_plus || {}).titre || 'Écoles ne fonctionnant plus') + ' (' + l.length + ')';
      ina.innerHTML = l.map(a => '<tr><td><b>' + echapper(a.ecole.nom) + '</b></td><td>' + echapper(a.ecole.type) + '</td>'
        + '<td>' + echapper(a.ecole.arrondissement || '—') + '</td><td>' + echapper(a.ecole.zone_ped || '—') + '</td>'
        + '<td>' + echapper(formatDate(a.depuis)) + (a.motif ? ' <small>(' + echapper(a.motif) + ')</small>' : '') + '</td>'
        + '<td>' + ((a.effectifs || []).length) + ' relevé(s) conservé(s)</td>'
        + '<td class="actions"><button class="btn btn-success btn-sm" onclick="remettreEnActivite(\'' + a.id + '\')">♻ Remettre en activité</button></td></tr>').join('')
        || '<tr><td colspan="7" class="text-center">Aucune école dans cette rubrique.</td></tr>';
    }
  }
  function ecoleNeFonctionnePlus(id) {
    if (!UPO || global.Config.estEcole()) return;
    const e = data.ecoles.find(x => x.id == id); if (!e) return;
    if (!confirm('« ' + e.nom + ' » ne fonctionne plus ?\nElle sort des listes, des effectifs, des totaux, des synoptiques et des fiches '
      + '(ses données sont conservées dans la rubrique « Écoles ne fonctionnant plus » et peuvent être remises en activité).')) return;
    UPO.desactiver(id, 'Décision de la CS'); closeModal(); renderEcoles(); renderRepertoires();
  }
  function remettreEnActivite(id) {
    if (!UPO) return;
    const a = (data.ecolesInactives || []).find(x => x.id == id); if (!a) return;
    if (!confirm('Remettre « ' + a.ecole.nom + ' » en activité (avec ses effectifs, locaux et mobilier) ?')) return;
    UPO.reactiver(id); renderEcoles(); renderRepertoires();
  }

  /** Rattacher une école à une UP (et à sa zone). */
  function rattacherEcoleUP(id) {
    const e = data.ecoles.find(x => x.id == id); if (!e) return;
    const ups = unitesPedagogiques();
    openModal('Rattacher ' + e.nom,
      '<form onsubmit="saveRattachement(event, \'' + e.id + '\')"><div class="form-grid">'
      + selecteur('Unité pédagogique', 'unite_ped', [''].concat(ups.map(u => u.nom)), e.unite_ped)
      + selecteur('Zone pédagogique (appartenance)', 'zone_ped', [''].concat(global.Donnees.ZONES), e.zone_ped)
      + '</div><p class="petit muet">La zone des activités est celle de l’unité choisie ; sans zone d’appartenance, l’école prend aussi celle-ci.</p>'
      + '<div class="text-center mt-15"><button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button></div></form>');
  }
  function saveRattachement(ev, id) {
    ev.preventDefault();
    const e = data.ecoles.find(x => x.id == id); if (!e) return;
    const o = Object.fromEntries(new FormData(ev.target));
    e.unite_ped = o.unite_ped || '';
    const f = data.unites.find(u => u.nom === e.unite_ped);
    e.zone_up = (f && f.zone) || '';
    e.zone_ped = o.zone_ped || e.zone_ped || (f && f.zone) || '';
    saveData(); closeModal(); renderRepertoires(); renderEcoles();
  }
  function reinitialiserUP(nom) {
    if (!UPO) return;
    if (!confirm('Remettre l’unité pédagogique « ' + nom + ' » telle que dans le document de la CS (zone, RUP, co-RUP, écoles) ?')) return;
    UPO.reinitUP(nom); renderRepertoires(); renderEcoles();
  }
  function reinitialiserToutesUP() {
    if (!UPO) return;
    if (!confirm('Remettre TOUTES les unités pédagogiques et les zones des écoles telles que dans le document de la CS ?\n'
      + 'Les RUP, co-RUP et rattachements modifiés sur cet appareil seront remplacés (les contacts saisis sont conservés).')) return;
    UPO.reinitToutesUP(); renderRepertoires(); renderEcoles();
  }

  function ficheUP(nom, creer) {
    let u = data.unites.filter(x => x.nom === nom)[0];
    if (!u) {
      u = { id: uid(), nom: nom };
      if (creer) data.unites.push(u);
    }
    return u;
  }

  function modifierUP(nom) {
    const u = ficheUP(nom);
    openModal(nom ? 'Unité pédagogique — ' + nom : 'Nouvelle unité pédagogique',
      '<form onsubmit="saveUP(event, ' + jsNom(nom || '') + ')"><div class="form-grid">'
      + '<div class="form-group"><label>Nom de l’unité *</label><input name="nom" value="'
      + echapper(u.nom || '') + '" required></div>'
      + selecteur('Arrondissement', 'arrondissement',
        [''].concat(['POBE', 'AHOYEYE', 'IGANNA', 'ISSABA', 'TOWE']), u.arrondissement)
      + selecteur('Zone pédagogique', 'zone', [''].concat(global.Donnees.ZONES), u.zone)
      + selecteur('Cycle', 'cycle', ['', 'Maternelle', 'Primaire'], u.cycle)
      + champ('Responsable (RUP)', 'rup', u.rup)
      + champ('Contact du RUP', 'contact_rup', u.contact_rup)
      + champ('Co-responsable (co-RUP)', 'corup', u.corup)
      + champ('Contact du co-RUP', 'contact_corup', u.contact_corup)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveUP(ev, ancien) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    const nom = (obj.nom || '').trim();
    if (!nom) return;
    if (!ancien && data.unites.some(u => u.nom === nom)) {
      alert('Cette unité pédagogique existe déjà.');
      return;
    }
    const u = ficheUP(ancien || nom, true);
    Object.assign(u, obj, { nom: nom });
    /* Renommer une unité suit les écoles qui y sont rattachées. */
    if (ancien && ancien !== nom) {
      data.ecoles.forEach(e => { if (e.unite_ped === ancien) e.unite_ped = nom; });
    }
    /* la zone de l'UP est la zone des activités de ses écoles */
    if (u.zone) data.ecoles.forEach(e => { if (e.unite_ped === nom) e.zone_up = u.zone; });
    saveData();
    closeModal();
    renderRepertoires();
  }

  function supprimerUP(nom) {
    const rattachees = data.ecoles.filter(e => e.unite_ped === nom);
    if (rattachees.length && !confirm(rattachees.length + ' école(s) sont rattachées à ' + nom
        + '. Supprimer l’unité et détacher ces écoles (elles passeront « en attente d’UP ») ?')) return;
    if (!rattachees.length && !confirm('Supprimer l’unité pédagogique ' + nom + ' ?')) return;
    rattachees.forEach(e => { e.unite_ped = ''; });
    data.unites = data.unites.filter(u => u.nom !== nom);
    saveData();
    renderRepertoires();
    renderEcoles();
  }

  /* --- Comité d'évaluation --- */
  const QUALITES_COMITE = ['Président', 'Vice-président', 'Rapporteur', 'Membre'];

  function renderComite() {
    document.getElementById('comiteTable').innerHTML = data.comite.map(m =>
      '<tr><td><b>' + echapper(m.qualite || '—') + '</b></td>'
      + '<td>' + echapper(m.nom) + '</td><td>' + echapper(m.fonction || '—') + '</td>'
      + '<td>' + echapper(m.contact || '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="modifierComite(\'' + m.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="supprimerComite(\'' + m.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="5" class="text-center">Aucun membre enregistré</td></tr>';
  }

  function modifierComite(id) {
    const m = id ? data.comite.find(x => x.id == id) || {} : {};
    openModal(id ? 'Membre du comité d’évaluation' : 'Ajouter au comité d’évaluation',
      '<form onsubmit="saveComite(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + selecteur('Qualité *', 'qualite', QUALITES_COMITE, m.qualite, true)
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(m.nom || '') + '" required></div>'
      + champ('Fonction exercée', 'fonction', m.fonction)
      + champ('Contact téléphonique', 'contact', m.contact)
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveComite(ev, id) {
    ev.preventDefault();
    enregistrer('comite', Object.fromEntries(new FormData(ev.target)), id, renderRepertoires);
  }

  function supprimerComite(id) {
    if (!confirm('Retirer ce membre ?')) return;
    data.comite = data.comite.filter(x => x.id != id);
    saveData();
    renderRepertoires();
  }

  /* Le bouton « Ajouter » suit l'onglet affiché. */
  function ajouterAuRepertoire() {
    const onglet = ongletRepertoire();
    if (onglet === 'rep-up') return modifierUP('');
    if (onglet === 'rep-comite') return modifierComite();
    if (onglet === 'rep-attente' || onglet === 'rep-inactives') return showPage('ecoles', document.querySelector('.menu-item[data-page="ecoles"]'));
    alert(onglet === 'rep-cp'
      ? 'Les conseillers pédagogiques suivent les zones : renseignez leur nom avec le '
        + 'crayon de leur ligne.'
      : 'Les directeurs suivent les écoles : ajoutez l’école, puis renseignez son '
        + 'directeur avec le crayon.');
  }

  function exporterRepertoires() {
    const lignes = [['RÉPERTOIRE DES DIRECTEURS', '']];
    lignes.push(['Secteur', 'École', 'Arrondissement', 'Zone', 'Unité pédagogique',
      'Directeur', 'Contact']);
    data.ecoles.slice().sort((a, b) => (a.type || '').localeCompare(b.type || '')
      || (a.nom || '').localeCompare(b.nom || '', 'fr'))
      .forEach(e => lignes.push([libelleSecteur(e.type), e.nom, e.arrondissement || '',
        e.zone_ped || '', e.unite_ped || '', e.directeur || '',
        e.contact_directeur || e.telephone || '']));

    lignes.push([]);
    lignes.push(['CONSEILLERS PÉDAGOGIQUES', '']);
    lignes.push(['Zone', 'Conseiller pédagogique', 'Contact', 'Écoles']);
    identitesCS().filter(x => x.zone).forEach(cp => lignes.push([cp.zone,
      cp.responsable || '', cp.contact || '',
      data.ecoles.filter(e => e.zone_ped === cp.zone).length]));

    lignes.push([]);
    lignes.push(['UNITÉS PÉDAGOGIQUES', '']);
    lignes.push(['Unité', 'Arrondissement', 'Écoles', 'RUP', 'Contact RUP',
      'Co-RUP', 'Contact co-RUP']);
    unitesPedagogiques().forEach(u => lignes.push([u.nom, u.arrondissement, u.ecoles,
      u.fiche.rup || '', u.fiche.contact_rup || '', u.fiche.corup || '',
      u.fiche.contact_corup || '']));

    lignes.push([]);
    lignes.push(['COMITÉ D’ÉVALUATION', '']);
    lignes.push(['Qualité', 'Nom et prénoms', 'Fonction', 'Contact']);
    data.comite.forEach(m => lignes.push([m.qualite || '', m.nom || '',
      m.fonction || '', m.contact || '']));

    telecharger('cs-pobe-repertoires.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Évaluations ---------------- */

  const V = () => global.Evaluations;

  function clePeriode(p) { return p.type + '-' + p.numero; }

  function periodeCourante() {
    const sel = document.getElementById('filterPeriode');
    const val = sel ? sel.value : '';
    return V().PERIODES.filter(p => clePeriode(p) === val)[0] || V().PERIODES[0];
  }

  function renderEval() {
    const selP = document.getElementById('filterPeriode');
    if (!selP.options.length) {
      selP.innerHTML = V().PERIODES.map(p => '<option value="' + clePeriode(p) + '">'
        + echapper(V().libellePeriode(p)) + '</option>').join('');
      const selC = document.getElementById('filterCoursEval');
      selC.innerHTML = '<option value="">Tous les cours</option>'
        + V().COURS.map(c => '<option>' + c + '</option>').join('');
    }
    const periode = periodeCourante();
    const cours = document.getElementById('filterCoursEval').value;
    const rech = (document.getElementById('searchEval').value || '').toLowerCase();

    const releves = data.evaluations.filter(e => e.annee === anneeActive()
      && e.type === periode.type && String(e.numero) === String(periode.numero));

    const liste = releves.filter(e => (!cours || e.cours === cours)
      && (!rech || (nomEcole(e.ecoleId) || '').toLowerCase().indexOf(rech) >= 0));

    const cumul = cumuler(releves);
    document.getElementById('resumeEval').innerHTML =
      carte(releves.length, 'Relevés saisis')
      + carte(U(cumul.total.inscrits), 'Inscrits', 'blue')
      + carte(U(cumul.total.admis), 'Ont atteint le seuil')
      + carte(cumul.total.taux === null ? '—' : cumul.total.taux + ' %', 'Taux de réussite',
        cumul.total.taux !== null && cumul.total.taux < 60 ? 'red' : '');

    document.getElementById('evalTable').innerHTML = liste.map(e => {
      const b = V().bilan(e);
      const ecarts = V().anomalies(e);
      return '<tr' + (ecarts.length ? ' style="background:#fef2f2;"' : '') + '>'
        + '<td>' + echapper(nomEcole(e.ecoleId)) + '</td><td>' + echapper(e.cours) + '</td>'
        + '<td>' + echapper(V().libellePeriode(periode)) + '</td>'
        + '<td>' + b.g.inscrits + '</td><td>' + b.f.inscrits + '</td>'
        + '<td><b>' + b.total.inscrits + '</b></td><td>' + b.total.composes + '</td>'
        + '<td>' + b.total.admis + '</td>'
        + '<td>' + (b.g.taux === null ? '—' : b.g.taux + ' %') + '</td>'
        + '<td>' + (b.f.taux === null ? '—' : b.f.taux + ' %') + '</td>'
        + '<td><b>' + (b.total.taux === null ? '—' : b.total.taux + ' %') + '</b></td>'
        + '<td><span class="badge badge-' + tonTaux(b.total.taux) + '">'
        + V().appreciation(b.total.taux) + '</span></td>'
        + '<td class="actions">'
        + (ecarts.length ? '<span class="badge badge-danger" title="' + echapper(ecarts.join(' '))
          + '">⚠</span>' : '')
        + '<button class="btn btn-warning btn-sm" onclick="openEvalModal(\'' + e.id + '\')">✏️</button>'
        + '<button class="btn btn-danger btn-sm" onclick="deleteEval(\'' + e.id + '\')">🗑️</button>'
        + '</td></tr>';
    }).join('') || '<tr><td colspan="13" class="text-center">Aucun relevé pour cette '
      + 'période.</td></tr>';

    renderSyntheseEval(releves);
  }

  function tonTaux(t) {
    if (t === null) return 'info';
    return t >= 75 ? 'success' : (t >= 60 ? 'warning' : 'danger');
  }

  /** Cumule des relevés en un bilan unique. */
  function cumuler(releves) {
    const somme = { inscritsG: 0, inscritsF: 0, composesG: 0, composesF: 0, admisG: 0, admisF: 0 };
    releves.forEach(e => {
      Object.keys(somme).forEach(k => { somme[k] += Math.max(0, parseInt(e[k], 10) || 0); });
    });
    return V().bilan(somme);
  }

  function renderSyntheseEval(releves) {
    const parCours = V().COURS.map(c => {
      const sous = releves.filter(e => e.cours === c);
      return { libelle: c, releves: sous.length, bilan: cumuler(sous) };
    }).filter(x => x.releves);
    document.getElementById('evalCoursTable').innerHTML = parCours.map(x =>
      '<tr><td><b>' + x.libelle + '</b></td><td>' + x.releves + '</td>'
      + '<td>' + x.bilan.total.inscrits + '</td><td>' + x.bilan.total.composes + '</td>'
      + '<td>' + x.bilan.total.admis + '</td>'
      + '<td>' + (x.bilan.g.taux === null ? '—' : x.bilan.g.taux + ' %') + '</td>'
      + '<td>' + (x.bilan.f.taux === null ? '—' : x.bilan.f.taux + ' %') + '</td>'
      + '<td><b>' + (x.bilan.total.taux === null ? '—' : x.bilan.total.taux + ' %') + '</b></td>'
      + '<td><span class="badge badge-' + tonTaux(x.bilan.total.taux) + '">'
      + V().appreciation(x.bilan.total.taux) + '</span></td></tr>').join('')
      || '<tr><td colspan="9" class="text-center">Aucun relevé</td></tr>';

    const groupes = {};
    releves.forEach(e => { (groupes[e.ecoleId] = groupes[e.ecoleId] || []).push(e); });
    document.getElementById('evalEcoleTable').innerHTML = Object.keys(groupes).map(id => {
      const b = cumuler(groupes[id]);
      return '<tr><td>' + echapper(nomEcole(id)) + '</td><td>' + groupes[id].length + '</td>'
        + '<td>' + b.total.inscrits + '</td><td>' + b.total.composes + '</td>'
        + '<td>' + b.total.admis + '</td>'
        + '<td><b>' + (b.total.taux === null ? '—' : b.total.taux + ' %') + '</b></td>'
        + '<td><span class="badge badge-' + tonTaux(b.total.taux) + '">'
        + V().appreciation(b.total.taux) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="7" class="text-center">Aucun relevé</td></tr>';

    const parUP = {};
    releves.forEach(e => {
      const ecole = data.ecoles.find(x => x.id == e.ecoleId);
      const up = (ecole && ecole.unite_ped) || '(unité non renseignée)';
      (parUP[up] = parUP[up] || { releves: [], ecoles: {} }).releves.push(e);
      parUP[up].ecoles[e.ecoleId] = true;
    });
    document.getElementById('evalUPTable').innerHTML = Object.keys(parUP).sort().map(up => {
      const b = cumuler(parUP[up].releves);
      return '<tr><td>' + echapper(up) + '</td>'
        + '<td>' + Object.keys(parUP[up].ecoles).length + '</td>'
        + '<td>' + b.total.inscrits + '</td><td>' + b.total.composes + '</td>'
        + '<td>' + b.total.admis + '</td>'
        + '<td><b>' + (b.total.taux === null ? '—' : b.total.taux + ' %') + '</b></td>'
        + '<td><span class="badge badge-' + tonTaux(b.total.taux) + '">'
        + V().appreciation(b.total.taux) + '</span></td></tr>';
    }).join('') || '<tr><td colspan="7" class="text-center">Aucun relevé</td></tr>';
  }

  function openEvalModal(id) {
    const e = id ? data.evaluations.find(x => x.id == id) || {} : {};
    const periode = periodeCourante();
    const coursPossibles = V().COURS.filter(c => V().concerne(c, periode));
    openModal(id ? 'Modifier le relevé' : 'Relevé — ' + V().libellePeriode(periode),
      '<form onsubmit="saveEval(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Relevé</h4><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(e.ecoleId) + '</select></div>'
      + selecteur('Cours *', 'cours', coursPossibles, e.cours, true)
      + '</div>'
      + (coursPossibles.length < V().COURS.length
        ? '<p class="petit muet">Le CI ne compose pas cette évaluation : il ne figure '
          + 'pas dans la liste.</p>' : '')
      + '</div>'
      + '<div class="form-section"><h4>Participation et réussite</h4>'
      + '<div style="overflow-x:auto;"><table style="width:100%;">'
      + '<thead><tr><th>Indicateur</th><th>Garçons</th><th>Filles</th></tr></thead><tbody>'
      + [['Inscrits', 'inscrits'], ['Ont composé', 'composes'],
         ['Ont atteint le seuil', 'admis']].map(([lib, cle]) =>
        '<tr><td>' + lib + '</td>'
        + ['G', 'F'].map(sx => '<td><input type="number" min="0" style="width:90px;" name="'
          + cle + sx + '" value="' + echapper(e[cle + sx] || 0)
          + '" oninput="majApercuEval()"></td>').join('') + '</tr>').join('')
      + '</tbody></table></div>'
      + '<div id="apercuEval" class="alert alert-info mt-15"></div></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
    majApercuEval();
  }

  /* L'aperçu montre les taux et signale l'incohérence avant l'enregistrement. */
  function majApercuEval() {
    const form = document.querySelector('#modalBody form');
    const zone = document.getElementById('apercuEval');
    if (!form || !zone) return;
    const lire = n => (form.querySelector('[name=' + n + ']') || {}).value || 0;
    const releve = {};
    ['inscrits', 'composes', 'admis'].forEach(c => {
      ['G', 'F'].forEach(sx => { releve[c + sx] = lire(c + sx); });
    });
    const b = V().bilan(releve);
    const ecarts = V().anomalies(releve);
    zone.className = 'alert mt-15 ' + (ecarts.length ? 'alert-danger' : 'alert-info');
    zone.innerHTML = ecarts.length
      ? '<b>À corriger :</b><br>' + ecarts.map(echapper).join('<br>')
      : 'Taux garçons <b>' + (b.g.taux === null ? '—' : b.g.taux + ' %')
        + '</b> · filles <b>' + (b.f.taux === null ? '—' : b.f.taux + ' %')
        + '</b> · ensemble <b>' + (b.total.taux === null ? '—' : b.total.taux + ' %')
        + '</b> — ' + V().appreciation(b.total.taux)
        + (b.total.absents ? '<br>' + b.total.absents + ' apprenant(s) n’ont pas composé.' : '');
  }

  function saveEval(ev, id) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    const ecarts = V().anomalies(obj);
    if (ecarts.length) { alert(ecarts.join('\n')); return; }
    const periode = periodeCourante();
    obj.type = periode.type;
    obj.numero = periode.numero;
    obj.mois = periode.mois;
    obj.annee = anneeActive();
    enregistrer('evaluations', obj, id, renderEval);
  }

  function deleteEval(id) {
    if (!confirm('Supprimer ce relevé ?')) return;
    data.evaluations = data.evaluations.filter(x => x.id != id);
    saveData();
    renderEval();
  }

  /** Procès-verbal d'évaluation, du cours à la circonscription. */
  function editerPVEvaluation() {
    const periode = periodeCourante();
    const cours = document.getElementById('filterCoursEval').value;
    const releves = data.evaluations.filter(e => e.annee === anneeActive()
      && e.type === periode.type && String(e.numero) === String(periode.numero)
      && (!cours || e.cours === cours));
    const b = cumuler(releves);

    const tableau = (titre, lignes) => '<h4 style="margin-top:14px;color:#006633;">' + titre
      + '</h4><table style="width:100%;font-size:12px;"><thead><tr><th>Ensemble</th>'
      + '<th>Inscrits</th><th>Ont composé</th><th>Ont atteint le seuil</th><th>Taux</th>'
      + '<th>Appréciation</th></tr></thead><tbody>' + lignes + '</tbody></table>';

    const ligne = (libelle, bb) => '<tr><td>' + echapper(libelle) + '</td>'
      + '<td>' + bb.total.inscrits + '</td><td>' + bb.total.composes + '</td>'
      + '<td>' + bb.total.admis + '</td>'
      + '<td>' + (bb.total.taux === null ? '—' : bb.total.taux + ' %') + '</td>'
      + '<td>' + V().appreciation(bb.total.taux) + '</td></tr>';

    const parCours = V().COURS.filter(c => releves.some(e => e.cours === c))
      .map(c => ligne(c, cumuler(releves.filter(e => e.cours === c)))).join('');
    const groupes = {};
    releves.forEach(e => { (groupes[e.ecoleId] = groupes[e.ecoleId] || []).push(e); });
    const parEcole = Object.keys(groupes)
      .map(id => ligne(nomEcole(id), cumuler(groupes[id]))).join('');

    openModal('PV d’évaluation — ' + V().libellePeriode(periode),
      '<div style="border:2px solid #006633;padding:18px;">'
      + '<div class="text-center"><b>RÉPUBLIQUE DU BÉNIN</b><br>'
      + 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE<br>'
      + 'CIRCONSCRIPTION SCOLAIRE DE POBÈ<br>'
      + '<h2 style="color:#006633;margin:10px 0;">PROCÈS-VERBAL D’ÉVALUATION</h2>'
      + echapper(V().libellePeriode(periode)) + ' — année scolaire '
      + echapper(anneeActive()) + (cours ? ' — cours ' + echapper(cours) : '') + '</div>'
      + tableau('Résultats par cours', parCours || '<tr><td colspan="6">Aucun relevé</td></tr>')
      + tableau('Résultats par école', parEcole || '<tr><td colspan="6">Aucun relevé</td></tr>')
      + tableau('Ensemble de la circonscription', ligne('Circonscription', b))
      + '<p class="petit muet mt-15">Une matière est maîtrisée à partir de '
      + V().SEUIL_MATIERE + '/20. Le seuil demande six maîtrises sur neuf matières composées, '
      + 'et les deux tiers lorsque les onze sont composées. Le CI ne compose pas la première '
      + 'évaluation sommative.</p>'
      + piedDocument(null, 'PV-EVAL', clePeriode(periode),
        'Le Chef de la Circonscription Scolaire')
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Apprenants ---------------- */

  function renderApprenants() {
    const selE = document.getElementById('filterEcoleApp');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">Toutes écoles</option>' + optionsEcoles();
      document.getElementById('filterCoursApp').innerHTML =
        '<option value="">Tous les cours</option>'
        + V().COURS.concat(['Petits', 'Grands']).map(c => '<option>' + c + '</option>').join('');
    }
    const ecoleF = selE.value;
    const coursF = document.getElementById('filterCoursApp').value;
    const rech = (document.getElementById('searchApprenant').value || '').toLowerCase();

    const liste = data.apprenants.filter(a2 =>
      (!ecoleF || a2.ecoleId == ecoleF) && (!coursF || a2.cours === coursF)
      && (!rech || (nomComplet(a2)).toLowerCase().indexOf(rech) >= 0
        || String(a2.npi || '').toLowerCase().indexOf(rech) >= 0
        || String(a2.matricule || '').toLowerCase().indexOf(rech) >= 0))
      .sort((x, y) => nomComplet(x).localeCompare(nomComplet(y), 'fr'));

    const filles = liste.filter(a2 => a2.sexe === 'F').length;
    const avecNpi = liste.filter(a2 => a2.npi).length;
    const avecPhoto = liste.filter(a2 => a2.photo).length;
    document.getElementById('resumeApprenants').innerHTML =
      carte(U(liste.length), 'Apprenants')
      + carte(U(liste.length - filles) + ' / ' + U(filles), 'Garçons / filles', 'blue')
      + carte(U(avecNpi), 'NPI renseignés', avecNpi < liste.length ? 'yellow' : '')
      + carte(U(avecPhoto), 'Photos', avecPhoto < liste.length ? 'red' : '');

    document.getElementById('apprenantsTable').innerHTML = liste.slice(0, 400).map(a2 =>
      '<tr><td>' + (a2.photo
        ? '<img class="photo-apprenant" src="' + a2.photo + '" alt="">'
        : '<div class="photo-absente">👤</div>') + '</td>'
      + '<td><b>' + echapper(nomComplet(a2)) + '</b></td>'
      + '<td>' + echapper(a2.sexe || '—') + '</td>'
      + '<td>' + formatDate(a2.dateNaiss) + '</td>'
      + '<td>' + echapper(a2.lieuNaiss || '—') + '</td>'
      + '<td>' + echapper(a2.npi || '—') + '</td>'
      + '<td>' + echapper(a2.matricule || '—') + '</td>'
      + '<td>' + echapper(nomEcole(a2.ecoleId)) + '</td>'
      + '<td>' + echapper(a2.cours || '—') + '</td>'
      + '<td>' + (a2.redoublant === 'Oui'
        ? '<span class="badge badge-warning">redoublant</span>' : '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="openApprenantModal(\'' + a2.id + '\')">✏️</button>'
      + '<button class="btn btn-info btn-sm" onclick="inscrireAuCEP(\'' + a2.id + '\')">📋</button>'
      + '<button class="btn btn-danger btn-sm" onclick="supprimerApprenant(\'' + a2.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="11" class="text-center">Aucun apprenant enregistré</td></tr>';
  }

  function nomComplet(a2) {
    return [a2.nom, a2.prenoms].filter(Boolean).join(' ').trim();
  }

  function openApprenantModal(id) {
    const a2 = id ? data.apprenants.find(x => x.id == id) || {} : {};
    openModal(id ? 'Modifier un apprenant' : 'Ajouter un apprenant',
      '<form onsubmit="saveApprenant(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Identité</h4><div class="form-grid">'
      + '<div class="form-group"><label>Nom *</label><input name="nom" value="'
      + echapper(a2.nom || '') + '" required></div>'
      + champ('Prénoms', 'prenoms', a2.prenoms)
      + selecteur('Sexe *', 'sexe', [['G', 'Garçon'], ['F', 'Fille']], a2.sexe, true)
      + '<div class="form-group"><label>Date de naissance</label><input type="date" '
      + 'name="dateNaiss" value="' + echapper(a2.dateNaiss || '') + '"></div>'
      + champ('Lieu de naissance', 'lieuNaiss', a2.lieuNaiss)
      + champ("N° d'acte de naissance", 'numActe', a2.numActe)
      + champ('NPI', 'npi', a2.npi)
      + champ('Matricule EDUCMaster', 'matricule', a2.matricule)
      + '</div></div>'
      + '<div class="form-section"><h4>Scolarité</h4><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(a2.ecoleId) + '</select></div>'
      + selecteur('Cours *', 'cours', V().COURS.concat(['Petits', 'Grands']), a2.cours, true)
      + selecteur('Redoublant', 'redoublant', ['Non', 'Oui'], a2.redoublant)
      + champ('Nom du père', 'pere', a2.pere)
      + champ('Nom de la mère', 'mere', a2.mere)
      + champ('Téléphone du parent', 'telParent', a2.telParent)
      + '</div></div>'
      + '<div class="form-section"><h4>Photo</h4>'
      + '<p class="petit muet mb-15">La photo est réduite puis conservée sur cet ordinateur ; '
      + 'elle ne part sur aucun réseau.</p>'
      + '<input type="file" id="photoApprenant" accept="image/*" onchange="chargerPhoto(this)">'
      + '<div id="apercuPhoto" class="mt-15">' + (a2.photo
        ? '<img src="' + a2.photo + '" style="max-height:120px;border-radius:6px;">' : '')
      + '</div><input type="hidden" name="photo" value="' + echapper(a2.photo || '') + '">'
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  /* La photo est redimensionnée avant d'être conservée : une photo d'appareil
     dépasse les mégaoctets, et la mémoire du navigateur est limitée. */
  function chargerPhoto(input) {
    const fichier = input.files && input.files[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = ev => {
      const img = new Image();
      img.onload = () => {
        const max = 320;
        const ratio = Math.min(1, max / Math.max(img.width, img.height));
        const toile = document.createElement('canvas');
        toile.width = Math.round(img.width * ratio);
        toile.height = Math.round(img.height * ratio);
        toile.getContext('2d').drawImage(img, 0, 0, toile.width, toile.height);
        const url = toile.toDataURL('image/jpeg', 0.78);
        const champCache = document.querySelector('#modalBody [name=photo]');
        if (champCache) champCache.value = url;
        document.getElementById('apercuPhoto').innerHTML =
          '<img src="' + url + '" style="max-height:120px;border-radius:6px;">';
      };
      img.src = ev.target.result;
    };
    lecteur.readAsDataURL(fichier);
  }

  function saveApprenant(ev, id) {
    ev.preventDefault();
    enregistrer('apprenants', Object.fromEntries(new FormData(ev.target)), id, renderApprenants);
  }

  function supprimerApprenant(id) {
    if (!confirm('Retirer cet apprenant ?')) return;
    data.apprenants = data.apprenants.filter(x => x.id != id);
    saveData();
    renderApprenants();
  }

  /** Reporte un apprenant sur une fiche d'inscription au CEP, sans ressaisie. */
  function inscrireAuCEP(id) {
    const a2 = data.apprenants.find(x => x.id == id);
    if (!a2) return;
    const deja = data.cep.find(c => c.apprenantId == id);
    if (deja) {
      alert('Cet apprenant est déjà inscrit au CEP.');
      return;
    }
    data.cep.push({
      /* Le nom et les prénoms restent séparés : la fiche officielle demande le
         nom en capitales d'un côté, les prénoms en toutes lettres de l'autre. */
      id: uid(), apprenantId: a2.id, nom: a2.nom, prenoms: a2.prenoms, sexe: a2.sexe,
      matricule: a2.matricule,
      dateNaiss: a2.dateNaiss, lieuNaiss: a2.lieuNaiss, numActe: a2.numActe,
      npi: a2.npi, pere: a2.pere, mere: a2.mere, telParent: a2.telParent,
      ecoleId: a2.ecoleId, session: sessionCEP(), nationalite: 'Béninoise',
      handicap: 'Non', photo: a2.photo
    });
    saveData();
    alert(nomComplet(a2) + ' est inscrit(e) au CEP : sa fiche est remplie avec ses données.');
  }

  /** Liste nominative d'une classe, avec photos et colonne d'émargement. */
  function editerListeClasse() {
    const ecoleId = document.getElementById('filterEcoleApp').value;
    const cours = document.getElementById('filterCoursApp').value;
    if (!ecoleId || !cours) {
      alert('Choisissez d’abord une école et un cours : la liste est nominative.');
      return;
    }
    const ecole = data.ecoles.find(x => x.id == ecoleId);
    const liste = data.apprenants.filter(a2 => a2.ecoleId == ecoleId && a2.cours === cours)
      .sort((x, y) => nomComplet(x).localeCompare(nomComplet(y), 'fr'));
    if (!liste.length) { alert('Aucun apprenant dans cette classe.'); return; }

    const g = liste.filter(a2 => a2.sexe === 'G').length;
    openModal('Liste de classe — ' + (ecole ? ecole.nom : '') + ' — ' + cours,
      '<div style="border:2px solid #006633;padding:16px;">'
      + enteteDocument({ etablissement: ecole ? ecole.nom : '' }) + '<div class="text-center">'
      + '<h3 style="color:#006633;margin:8px 0;">LISTE NOMINATIVE — ' + echapper(cours)
      + '</h3>Année scolaire ' + echapper(anneeActive()) + ' — ' + liste.length
      + ' apprenant(s) : ' + g + ' garçon(s), ' + (liste.length - g) + ' fille(s)</div>'
      + '<table class="liste-classe" style="margin-top:12px;"><thead><tr>'
      + '<th>N°</th><th>Photo</th><th>Nom et prénoms</th><th>Sexe</th><th>Né(e) le</th>'
      + '<th>Lieu</th><th>NPI</th><th>Matricule</th><th class="emargement">Émargement</th>'
      + '</tr></thead><tbody>'
      + liste.map((a2, i) => '<tr><td>' + (i + 1) + '</td>'
        + '<td>' + (a2.photo ? '<img src="' + a2.photo + '" alt="">' : '') + '</td>'
        + '<td>' + echapper(nomComplet(a2)) + '</td>'
        + '<td>' + echapper(a2.sexe || '') + '</td>'
        + '<td>' + formatDate(a2.dateNaiss) + '</td>'
        + '<td>' + echapper(a2.lieuNaiss || '') + '</td>'
        + '<td>' + echapper(a2.npi || '') + '</td>'
        + '<td>' + echapper(a2.matricule || '') + '</td>'
        + '<td class="emargement"></td></tr>').join('')
      + '</tbody></table>'
      + (global.Registres ? global.Registres.pied(ecole, cours, 'LISTE', ecoleId + '-' + cours, 'Liste ' + cours + ' ' + (ecole ? ecole.nom : '')) : piedDocument(ecole, 'LISTE', ecoleId + '-' + cours, 'Le Directeur'))
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /** Classeur au format attendu par EDUCMaster, apprenants puis enseignants. */
  function exporterEducmaster() {
    const ecoleId = document.getElementById('filterEcoleApp').value;
    const liste = data.apprenants.filter(a2 => !ecoleId || a2.ecoleId == ecoleId);
    if (!liste.length) { alert('Aucun apprenant à exporter.'); return; }

    const lignes = [['NPI', 'Matricule', 'Nom', 'Prénoms', 'Sexe', 'Date de naissance',
      'Lieu de naissance', "N° d'acte de naissance", 'Nom du père', 'Nom de la mère',
      'École', 'Code école', 'Cours', 'Redoublant', 'Année scolaire']];
    liste.forEach(a2 => {
      const ecole = data.ecoles.find(x => x.id == a2.ecoleId) || {};
      lignes.push([a2.npi || '', a2.matricule || '', a2.nom || '', a2.prenoms || '',
        a2.sexe === 'G' ? 'M' : a2.sexe, a2.dateNaiss || '', a2.lieuNaiss || '',
        a2.numActe || '', a2.pere || '', a2.mere || '',
        ecole.nom || '', ecole.code || '', a2.cours || '',
        a2.redoublant === 'Oui' ? 'OUI' : 'NON', anneeActive()]);
    });

    lignes.push([]);
    lignes.push(['ENSEIGNANTS']);
    lignes.push(['Matricule', 'Nom et prénoms', 'Sexe', 'Date de naissance', 'Grade',
      'Statut', 'Fonction', 'Cours tenu', 'École', 'Code école']);
    data.personnel.filter(x => (x.categorie || 'Enseignant') === 'Enseignant'
      && (!ecoleId || x.ecoleId == ecoleId)).forEach(x => {
      const ecole = data.ecoles.find(y => y.id == x.ecoleId) || {};
      lignes.push([x.matricule || '', x.nom || '', x.sexe || '', x.dateNaissance || '',
        x.grade || '', x.statut || '', x.fonction || '', x.cours || '',
        ecole.nom || '', ecole.code || '']);
    });

    telecharger('cs-pobe-educmaster-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Jours fériés ---------------- */

  /* Les deux millésimes civils couverts par une année scolaire (« 2026-2027 »
     → 2026 et 2027) : les fêtes calculées se vérifient sur les deux. */
  function anneesCivilesDe(anneeScolaire) {
    const m = /^(\d{4})-(\d{4})$/.exec(anneeScolaire || '');
    return m ? [parseInt(m[1], 10), parseInt(m[2], 10)] : [new Date().getFullYear()];
  }

  function renderJoursFeries() {
    const label = document.getElementById('joursFeriesAnneeLabel');
    if (label) label.textContent = anneeActive();

    document.getElementById('joursFeriesTable').innerHTML = data.joursFeries
      .slice().sort((a, b) => (a.date || '').localeCompare(b.date || '')).map(f =>
        '<tr><td>' + formatDate(f.date) + '</td><td>' + echapper(f.libelle || '—') + '</td>'
        + '<td class="actions"><button class="btn btn-danger btn-sm" '
        + 'onclick="deleteJourFerie(\'' + f.id + '\')">🗑️</button></td></tr>').join('')
      || '<tr><td colspan="3" class="text-center">Aucun jour férié ajouté à la main</td></tr>';

    const zone = document.getElementById('joursFeriesCalcules');
    if (zone) {
      const civiles = anneesCivilesDe(anneeActive());
      zone.innerHTML = civiles.map(an => {
        const feries = global.Calendrier.feriesCalcules(an);
        return '<h5>' + an + '</h5><div class="table-container"><div class="table-scroll"><table>'
          + '<thead><tr><th>Date</th><th>Fête</th></tr></thead><tbody>'
          + Object.keys(feries).sort().map(d => '<tr><td>' + formatDate(d) + '</td><td>'
            + echapper(feries[d]) + '</td></tr>').join('')
          + '</tbody></table></div></div>';
      }).join('');
    }
  }

  function openJourFerieModal() {
    openModal('Ajouter un jour férié',
      '<form onsubmit="saveJourFerie(event)"><div class="form-grid">'
      + '<div class="form-group"><label>Date *</label>'
      + '<input type="date" name="date" required></div>'
      + '<div class="form-group"><label>Libellé *</label>'
      + '<input name="libelle" placeholder="Tabaski, Maouloud…" required></div>'
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveJourFerie(ev) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    if (!obj.date || !obj.libelle) return;
    if (data.joursFeries.some(f => f.date === obj.date)) {
      alert('Un jour férié est déjà enregistré à cette date.');
      return;
    }
    data.joursFeries.push({ id: uid(), date: obj.date, libelle: obj.libelle.trim() });
    saveData();
    closeModal();
    renderJoursFeries();
  }

  function deleteJourFerie(id) {
    if (!confirm('Retirer ce jour férié ?')) return;
    data.joursFeries = data.joursFeries.filter(x => x.id !== id);
    saveData();
    renderJoursFeries();
  }

  /* ---------------- Présence des apprenants ---------------- */

  function ecoleChoisiePresence(idSelect) { return ecoleChoisie(idSelect); }

  function presenceApprenantsDe(ecoleId, cours, date, creer) {
    let r = data.presencesApprenants.filter(x => x.ecoleId == ecoleId
      && x.cours === cours && x.date === date)[0];
    if (!r) {
      r = {
        id: uid(), ecoleId: ecoleId, cours: cours, date: date, annee: anneeActive(),
        absentsMatin: [], absentsApresMidi: []
      };
      if (creer) data.presencesApprenants.push(r);
    }
    if (!r.absentsMatin) r.absentsMatin = [];
    if (!r.absentsApresMidi) r.absentsApresMidi = [];
    return r;
  }

  function renderPresenceApprenants() {
    const selE = document.getElementById('presAppEcole');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
    }
    const selC = document.getElementById('presAppCours');
    if (selC.options.length <= 1) {
      selC.innerHTML = '<option value="">— Cours —</option>'
        + V().COURS.concat(['Petits', 'Grands']).map(c => '<option>' + c + '</option>').join('');
    }
    const champDate = document.getElementById('presAppDate');
    if (champDate && !champDate.value) champDate.value = global.Calendrier.iso(new Date());
    const champMois = document.getElementById('presAppMois');
    if (champMois && !champMois.value) champMois.value = global.Calendrier.iso(new Date()).slice(0, 7);

    document.getElementById('presAppAnneeLabel').textContent = anneeActive();
    renderPresenceApprenantsJour();
    renderBilanPresenceApprenants();
    renderBilanAnneePresenceApprenants();
  }

  function renderPresenceApprenantsJour() {
    const ecole = ecoleChoisiePresence('presAppEcole');
    const cours = document.getElementById('presAppCours').value;
    const date = document.getElementById('presAppDate').value;
    const info = document.getElementById('presAppJourInfo');
    const table = document.getElementById('presAppJourTable');
    const actions = document.getElementById('presAppJourActions');

    if (!ecole || !cours || !date) {
      info.innerHTML = '';
      table.innerHTML = '<tr><td colspan="4" class="text-center">Choisissez une école, '
        + 'un cours et une date.</td></tr>';
      actions.innerHTML = '';
      return;
    }

    const estJourEcole = global.Calendrier.estJourEcole(date, data.joursFeries);
    info.innerHTML = estJourEcole ? ''
      : '<div class="alert alert-warning">' + (global.Calendrier.estWeekend(date)
        ? 'Ce jour tombe un week-end.'
        : 'Ce jour est férié (' + echapper(global.Calendrier.libelleFerie(date, data.joursFeries) || '')
          + ').') + ' L’enregistrement reste possible (rattrapage), mais ce jour ne compte pas '
        + 'dans le calendrier scolaire normal.</div>';

    const liste = data.apprenants.filter(a2 => a2.ecoleId == ecole.id && a2.cours === cours)
      .sort((x, y) => nomComplet(x).localeCompare(nomComplet(y), 'fr'));
    if (!liste.length) {
      table.innerHTML = '<tr><td colspan="4" class="text-center">Aucun apprenant dans cette '
        + 'classe — à compléter dans « Listes des apprenants ».</td></tr>';
      actions.innerHTML = '';
      return;
    }

    const rec = presenceApprenantsDe(ecole.id, cours, date);
    table.innerHTML = liste.map(a2 => '<tr><td>' + echapper(nomComplet(a2)) + '</td>'
      + '<td>' + echapper(a2.sexe || '—') + '</td>'
      + '<td><input type="checkbox" data-apprenant="' + a2.id + '" data-demi="matin"'
      + (rec.absentsMatin.indexOf(a2.id) >= 0 ? ' checked' : '') + '></td>'
      + '<td><input type="checkbox" data-apprenant="' + a2.id + '" data-demi="aprem"'
      + (rec.absentsApresMidi.indexOf(a2.id) >= 0 ? ' checked' : '') + '></td></tr>').join('');

    actions.innerHTML = '<button class="btn btn-primary" onclick="enregistrerPresenceApprenants(\''
      + ecole.id + '\',\'' + cours + '\',\'' + date + '\')">💾 Enregistrer la présence du jour</button>';
  }

  function enregistrerPresenceApprenants(ecoleId, cours, date) {
    const absentsMatin = Array.from(document.querySelectorAll(
      '#presAppJourTable [data-demi="matin"]')).filter(c => c.checked).map(c => c.dataset.apprenant);
    const absentsApresMidi = Array.from(document.querySelectorAll(
      '#presAppJourTable [data-demi="aprem"]')).filter(c => c.checked).map(c => c.dataset.apprenant);
    const rec = presenceApprenantsDe(ecoleId, cours, date, true);
    rec.absentsMatin = absentsMatin;
    rec.absentsApresMidi = absentsApresMidi;
    rec.annee = anneeActive();
    saveData();
    renderBilanPresenceApprenants();
    renderBilanAnneePresenceApprenants();
    const demiTotal = absentsMatin.length + absentsApresMidi.length;
    alert('Présence du ' + formatDate(date) + ' enregistrée : ' + demiTotal
      + ' demi-journée(s) d’absence (matin : ' + absentsMatin.length + ', après-midi : '
      + absentsApresMidi.length + ').');
  }

  function renderBilanPresenceApprenants() {
    const zone = document.getElementById('presAppBilanMois');
    if (!zone) return;
    const ecole = ecoleChoisiePresence('presAppEcole');
    const cours = document.getElementById('presAppCours').value;
    const mois = document.getElementById('presAppMois').value;
    if (!ecole || !cours || !mois) { zone.innerHTML = ''; return; }

    const [anneeCivile, moisNum] = mois.split('-').map(n => parseInt(n, 10));
    const apprenants = data.apprenants.filter(a2 => a2.ecoleId == ecole.id && a2.cours === cours);
    const records = data.presencesApprenants.filter(r => r.ecoleId == ecole.id
      && r.cours === cours && (r.date || '').indexOf(mois) === 0);
    const joursOuvrables = global.Calendrier.joursEcoleDuMois(anneeCivile, moisNum, data.joursFeries);
    const bilan = global.Presences.bilanPeriodeApprenants(apprenants, records);

    zone.innerHTML = '<div class="stats-grid">'
      + carte(joursOuvrables.length, 'Jours de classe prévus')
      + carte(bilan.joursSaisis, 'Jours saisis',
        bilan.joursSaisis < joursOuvrables.length ? 'yellow' : '')
      + carte(bilan.tauxPresence === null ? '—' : bilan.tauxPresence + ' %', 'Taux de présence',
        bilan.tauxPresence !== null && bilan.tauxPresence < 90 ? 'red' : '')
      + carte(bilan.totalAbsences, 'Total absences (demi-journées) ce mois-ci', '')
      + carte(bilan.jamaisManque.length, 'Jamais absent(e) ce mois-ci', '')
      + '</div>'
      + '<div class="stats-grid">'
      + carte(bilan.effectifGroupePeu, 'Apprenants ayant manqué au plus 4 fois', '')
      + carte(bilan.absencesGroupePeu, 'Absences (demi-j.) imputables à ce groupe', '')
      + carte(bilan.effectifGroupePlus, 'Apprenants ayant manqué plus de 4 fois',
        bilan.effectifGroupePlus ? 'red' : '')
      + carte(bilan.absencesGroupePlus, 'Absences (demi-j.) imputables à ce groupe',
        bilan.absencesGroupePlus ? 'red' : '')
      + '</div>'
      + (bilan.plusDeQuatreAbsences.length
        ? '<div class="alert alert-warning"><b>À signaler :</b> '
          + bilan.plusDeQuatreAbsences.map(d => echapper(nomComplet(d.apprenant))
            + ' (' + d.absences + ' demi-journée(s) d’absence)').join(', ') + '.</div>'
        : '')
      + (bilan.joursSaisis
        ? '<div class="table-container"><div class="table-scroll"><table>'
          + '<thead><tr><th>Nom et prénoms</th><th>Absences ce mois-ci (demi-j.)</th></tr></thead><tbody>'
          + bilan.detail.map(d => '<tr><td>' + echapper(nomComplet(d.apprenant)) + '</td><td>'
            + d.absences + '</td></tr>').join('') + '</tbody></table></div></div>'
        : '<div class="alert alert-info">Aucun jour saisi pour ce mois.</div>');
  }

  function renderBilanAnneePresenceApprenants() {
    const zone = document.getElementById('presAppBilanAnnee');
    if (!zone) return;
    const ecole = ecoleChoisiePresence('presAppEcole');
    const cours = document.getElementById('presAppCours').value;
    if (!ecole || !cours) { zone.innerHTML = ''; return; }

    const apprenants = data.apprenants.filter(a2 => a2.ecoleId == ecole.id && a2.cours === cours);
    const records = data.presencesApprenants.filter(r => r.ecoleId == ecole.id
      && r.cours === cours && r.annee === anneeActive());
    const bilan = global.Presences.bilanPeriodeApprenants(apprenants, records);

    zone.innerHTML = '<div class="stats-grid">'
      + carte(bilan.joursSaisis, 'Jours saisis cette année')
      + carte(bilan.tauxPresence === null ? '—' : bilan.tauxPresence + ' %', 'Taux de présence annuel',
        bilan.tauxPresence !== null && bilan.tauxPresence < 90 ? 'red' : '')
      + carte(bilan.totalAbsences, 'Total absences (demi-journées) cette année')
      + carte(bilan.jamaisManque.length, 'Jamais absent(e) cette année')
      + '</div>'
      + '<div class="stats-grid">'
      + carte(bilan.effectifGroupePeu, 'Apprenants ayant manqué au plus 4 fois')
      + carte(bilan.absencesGroupePeu, 'Absences (demi-j.) imputables à ce groupe')
      + carte(bilan.effectifGroupePlus, 'Apprenants ayant manqué plus de 4 fois',
        bilan.effectifGroupePlus ? 'red' : '')
      + carte(bilan.absencesGroupePlus, 'Absences (demi-j.) imputables à ce groupe',
        bilan.absencesGroupePlus ? 'red' : '')
      + '</div>';
  }

  /* ---------------- Présence du personnel ---------------- */

  function presencePersonnelDe(ecoleId, date, creer) {
    let r = data.presencesPersonnel.filter(x => x.ecoleId == ecoleId && x.date === date)[0];
    if (!r) {
      r = { id: uid(), ecoleId: ecoleId, date: date, annee: anneeActive(), agents: {} };
      if (creer) data.presencesPersonnel.push(r);
    }
    return r;
  }

  function agentsEcolePresence(ecoleId) {
    return data.personnel.filter(p => p.ecoleId == ecoleId && global.Carriere.estActif(p))
      .sort((x, y) => (x.nom || '').localeCompare(y.nom || '', 'fr'));
  }

  function renderPresencePersonnel() {
    const selE = document.getElementById('presPersEcole');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
    }
    const champDate = document.getElementById('presPersDate');
    if (champDate && !champDate.value) champDate.value = global.Calendrier.iso(new Date());
    const champMois = document.getElementById('presPersMois');
    if (champMois && !champMois.value) champMois.value = global.Calendrier.iso(new Date()).slice(0, 7);

    renderPresencePersonnelJour();
    renderBilanPresencePersonnel();
  }

  function renderPresencePersonnelJour() {
    const ecole = ecoleChoisiePresence('presPersEcole');
    const date = document.getElementById('presPersDate').value;
    const table = document.getElementById('presPersJourTable');
    const actions = document.getElementById('presPersJourActions');
    if (!ecole || !date) {
      table.innerHTML = '<tr><td colspan="6" class="text-center">Choisissez une école et une date.</td></tr>';
      actions.innerHTML = '';
      return;
    }

    const agents = agentsEcolePresence(ecole.id);
    if (!agents.length) {
      table.innerHTML = '<tr><td colspan="6" class="text-center">Aucun agent actif enregistré '
        + 'pour cette école.</td></tr>';
      actions.innerHTML = '';
      return;
    }

    const rec = presencePersonnelDe(ecole.id, date);
    table.innerHTML = agents.map(p => {
      const info = rec.agents[p.id] || {};
      return '<tr data-agent="' + p.id + '"><td>' + echapper(p.nom || '—') + '</td>'
        + '<td>' + echapper(p.fonction || '—') + '</td>'
        + '<td><input type="checkbox" class="champ-absent" ' + (info.absent ? 'checked' : '')
        + ' onchange="basculerAbsencePersonnel(this)"></td>'
        + '<td><input type="time" class="champ-heure" value="' + echapper(info.heureArrivee || '')
        + '" ' + (info.absent ? 'disabled' : '') + '></td>'
        + '<td class="petit-retard">' + (info.heureArrivee && !info.absent
          ? (global.Presences.minutesRetard(info.heureArrivee) > 0
            ? '<span class="badge badge-warning">' + global.Presences.minutesRetard(info.heureArrivee)
              + ' min</span>' : '<span class="badge badge-success">à l’heure</span>')
          : '—') + '</td>'
        + '<td><input type="text" class="champ-motif" value="' + echapper(info.motif || '')
        + '" placeholder="maladie, mission…" ' + (info.absent ? '' : 'disabled') + '></td></tr>';
    }).join('');

    actions.innerHTML = '<button class="btn btn-primary" onclick="enregistrerPresencePersonnel(\''
      + ecole.id + '\',\'' + date + '\')">💾 Enregistrer la présence du jour</button> '
      + '<button class="btn btn-warning" onclick="imprimerRegistrePresence(\''
      + ecole.id + '\',\'' + date + '\')">🖨️ Imprimer le registre</button>';
  }

  /* Une case Absent cochée efface et verrouille l'heure d'arrivée ; décochée,
     elle rend la main pour la saisir. Le retard, lui, ne se saisit jamais :
     il se déduit toujours de l'heure d'arrivée, jamais l'inverse. */
  function basculerAbsencePersonnel(caseAbsent) {
    const ligne = caseAbsent.closest('tr');
    const champHeure = ligne.querySelector('.champ-heure');
    const champMotif = ligne.querySelector('.champ-motif');
    champHeure.disabled = caseAbsent.checked;
    if (caseAbsent.checked) champHeure.value = '';
    champMotif.disabled = !caseAbsent.checked;
  }

  function enregistrerPresencePersonnel(ecoleId, date) {
    const rec = presencePersonnelDe(ecoleId, date, true);
    rec.agents = {};
    document.querySelectorAll('#presPersJourTable tr[data-agent]').forEach(ligne => {
      const id = ligne.dataset.agent;
      const absent = ligne.querySelector('.champ-absent').checked;
      rec.agents[id] = absent
        ? { absent: true, motif: ligne.querySelector('.champ-motif').value || '' }
        : { absent: false, heureArrivee: ligne.querySelector('.champ-heure').value || '' };
    });
    rec.annee = anneeActive();
    saveData();
    renderPresencePersonnelJour();
    renderBilanPresencePersonnel();
    alert('Présence du personnel du ' + formatDate(date) + ' enregistrée.');
  }

  function renderBilanPresencePersonnel() {
    const zone = document.getElementById('presPersBilanMois');
    if (!zone) return;
    const ecole = ecoleChoisiePresence('presPersEcole');
    const mois = document.getElementById('presPersMois').value;
    if (!ecole || !mois) { zone.innerHTML = ''; return; }

    const agents = agentsEcolePresence(ecole.id);
    const records = data.presencesPersonnel.filter(r => r.ecoleId == ecole.id
      && (r.date || '').indexOf(mois) === 0);
    const bilan = global.Presences.bilanPeriodePersonnel(agents, records);

    zone.innerHTML = '<div class="stats-grid">'
      + carte(bilan.joursEnregistres, 'Jours enregistrés')
      + carte(bilan.tauxPresence === null ? '—' : bilan.tauxPresence + ' %', 'Taux de présence',
        bilan.tauxPresence !== null && bilan.tauxPresence < 90 ? 'red' : '')
      + '</div>'
      + (bilan.joursEnregistres
        ? '<div class="table-container"><div class="table-scroll"><table>'
          + '<thead><tr><th>Nom et prénoms</th><th>Jours saisis</th><th>Présences</th>'
          + '<th>Absences</th><th>Retards</th><th>Total minutes de retard</th></tr></thead><tbody>'
          + bilan.detail.map(d => '<tr><td>' + echapper(d.agent.nom || '—') + '</td><td>'
            + d.joursSaisis + '</td><td>' + d.presences + '</td><td>' + d.absences + '</td><td>'
            + d.retards + '</td><td>' + d.minutesRetardTotal + '</td></tr>').join('')
          + '</tbody></table></div></div>'
        : '<div class="alert alert-info">Aucun jour enregistré pour ce mois.</div>');
  }

  /** Registre imprimable d'une journée, à l'appui de l'heure d'arrivée — pièce
      signée, valant preuve de présence pour le jour concerné. */
  function imprimerRegistrePresence(ecoleId, date) {
    const ecole = data.ecoles.find(x => x.id == ecoleId);
    const agents = agentsEcolePresence(ecoleId);
    const rec = presencePersonnelDe(ecoleId, date);
    if (!agents.length) { alert('Aucun agent à porter sur le registre.'); return; }

    openModal('Registre de présence — ' + (ecole ? ecole.nom : '') + ' — ' + formatDate(date),
      '<div style="border:2px solid #006633;padding:16px;">'
      + enteteDocument({ etablissement: ecole ? ecole.nom : '' }) + '<div class="text-center">'
      + '<h3 style="color:#006633;margin:8px 0;">REGISTRE DE PRÉSENCE DU PERSONNEL</h3>'
      + 'Date : ' + formatDate(date) + ' — heure officielle de service : '
      + global.Presences.HEURE_DEBUT_SERVICE + '</div>'
      + '<table class="liste-classe" style="margin-top:12px;"><thead><tr>'
      + '<th>N°</th><th>Nom et prénoms</th><th>Fonction</th><th>Heure d’arrivée</th>'
      + '<th>Retard</th><th>Motif d’absence</th><th class="emargement">Émargement</th>'
      + '</tr></thead><tbody>'
      + agents.map((p, i) => {
        const saisi = Object.prototype.hasOwnProperty.call(rec.agents, p.id);
        const info = rec.agents[p.id] || {};
        const retard = saisi && info.heureArrivee && !info.absent
          ? global.Presences.minutesRetard(info.heureArrivee) : null;
        return '<tr><td>' + (i + 1) + '</td><td>' + echapper(p.nom || '') + '</td>'
          + '<td>' + echapper(p.fonction || '') + '</td>'
          + '<td>' + (!saisi ? '—' : (info.absent ? '—' : echapper(info.heureArrivee || '—'))) + '</td>'
          + '<td>' + (!saisi ? 'non renseigné'
            : (info.absent ? '—' : (retard ? retard + ' min' : 'à l’heure'))) + '</td>'
          + '<td>' + (saisi && info.absent ? echapper(info.motif || 'non précisé') : '—') + '</td>'
          + '<td class="emargement"></td></tr>';
      }).join('')
      + '</tbody></table>'
      + piedDocument(ecole, 'PRESENCE', ecoleId + '-' + date, 'Le Directeur')
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Notes et bulletins ---------------- */

  function clePeriodeNotes() {
    const sel = document.getElementById('notesPeriode');
    return sel && sel.value ? sel.value : clePeriode(V().PERIODES[0]);
  }

  function periodeNotes() {
    return V().PERIODES.filter(p => clePeriode(p) === clePeriodeNotes())[0] || V().PERIODES[0];
  }

  /**
   * Feuille de notes d'un apprenant pour une période.
   * Elle n'est enregistrée qu'à la première note saisie : simplement consulter
   * une période ne doit pas remplir la base de feuilles vides.
   */
  function feuilleDe(apprenantId, cle, creer) {
    let f = data.notes.filter(n => n.apprenantId == apprenantId
      && n.periode === cle && n.annee === anneeActive())[0];
    if (!f) {
      f = { id: uid(), apprenantId: apprenantId, periode: cle, annee: anneeActive() };
      if (creer) data.notes.push(f);
    }
    return f;
  }

  function apprenantsDeLaClasse() {
    const ecoleId = document.getElementById('notesEcole').value;
    const cours = document.getElementById('notesCours').value;
    if (!ecoleId || !cours) return [];
    return data.apprenants.filter(a2 => a2.ecoleId == ecoleId && a2.cours === cours)
      .sort((x, y) => nomComplet(x).localeCompare(nomComplet(y), 'fr'));
  }

  /** Les résultats de la classe, classés par total décroissant. */
  function resultatsClasse() {
    const cle = clePeriodeNotes();
    const lignes = apprenantsDeLaClasse().map(a2 => {
      const f = feuilleDe(a2.id, cle);
      return Object.assign({ apprenant: a2, feuille: f }, V().resultat(f));
    });
    const composants = lignes.filter(x => x.aCompose).sort((a2, b2) => b2.total - a2.total);
    let rang = 0, precedent = null, place = 0;
    composants.forEach(x => {
      place++;
      if (precedent === null || x.total < precedent) { rang = place; precedent = x.total; }
      x.rang = rang;
    });
    return lignes;
  }

  function renderNotes() {
    const selE = document.getElementById('notesEcole');
    if (selE.options.length <= 1) {
      selE.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
      document.getElementById('notesCours').innerHTML = '<option value="">— Cours —</option>'
        + V().COURS.map(c => '<option>' + c + '</option>').join('');
      document.getElementById('notesPeriode').innerHTML = V().PERIODES.map(p =>
        '<option value="' + clePeriode(p) + '">' + echapper(V().libellePeriode(p))
        + '</option>').join('');
    }
    const periode = periodeNotes();
    const cours = document.getElementById('notesCours').value;

    document.getElementById('enteteNotes').innerHTML =
      '<th>Rang</th><th>Nom et prénoms</th><th>Sexe</th>'
      + V().MATIERES.map(m => '<th title="' + echapper(m.libelle) + '">' + m.abrege
        + '</th>').join('')
      + '<th>Total</th><th>Moyenne</th><th>Maîtrises</th><th>Seuil</th><th>Bulletin</th>';

    if (cours && !V().concerne(cours, periode)) {
      document.getElementById('resumeNotes').innerHTML = '';
      document.getElementById('notesTable').innerHTML =
        '<tr><td colspan="' + (V().MATIERES.length + 7) + '" class="text-center">'
        + 'Le CI ne compose pas la première évaluation sommative.</td></tr>';
      return;
    }

    const lignes = resultatsClasse();
    if (!lignes.length) {
      document.getElementById('resumeNotes').innerHTML = '';
      document.getElementById('notesTable').innerHTML =
        '<tr><td colspan="' + (V().MATIERES.length + 7) + '" class="text-center">'
        + 'Choisissez une école et un cours ayant des apprenants.</td></tr>';
      return;
    }

    const composants = lignes.filter(x => x.aCompose);
    const admis = composants.filter(x => x.admis).length;
    document.getElementById('resumeNotes').innerHTML =
      carte(lignes.length, 'Apprenants')
      + carte(composants.length, 'Ont composé', 'blue')
      + carte(admis, 'Ont atteint le seuil')
      + carte(composants.length ? Math.round(admis / composants.length * 1000) / 10 + ' %' : '—',
        'Taux de réussite',
        composants.length && admis / composants.length < 0.6 ? 'red' : '');

    document.getElementById('notesTable').innerHTML = lignes
      .sort((a2, b2) => (a2.rang || 9999) - (b2.rang || 9999)).map(x =>
      '<tr><td><b>' + (x.rang || '—') + '</b></td>'
      + '<td>' + echapper(nomComplet(x.apprenant)) + '</td>'
      + '<td>' + echapper(x.apprenant.sexe || '—') + '</td>'
      + V().MATIERES.map(m => '<td><input type="number" step="0.25" min="0" max="20" '
        + 'style="width:56px;" value="' + echapper(x.feuille[m.cle] === undefined ? ''
          : x.feuille[m.cle]) + '" onchange="majNote(\'' + x.apprenant.id + '\',\''
        + m.cle + '\',this.value)"></td>').join('')
      + '<td><b>' + (x.aCompose ? x.total : '—') + '</b></td>'
      + '<td>' + (x.moyenne === null ? '—' : x.moyenne) + '</td>'
      + '<td>' + (x.aCompose ? x.maitrises + ' / ' + x.composees : '—') + '</td>'
      + '<td>' + (!x.aCompose ? '<span class="badge badge-info">à saisir</span>'
        : '<span class="badge badge-' + (x.admis ? 'success' : 'danger') + '">'
        + (x.admis ? 'atteint' : 'non atteint') + '</span>') + '</td>'
      + '<td><button class="btn btn-primary btn-sm" onclick="editerBulletin(\''
      + x.apprenant.id + '\')">📄</button></td></tr>').join('');
  }

  function majNote(apprenantId, matiere, valeur) {
    const f = feuilleDe(apprenantId, clePeriodeNotes(), true);
    f[matiere] = valeur === '' ? '' : (parseFloat(String(valeur).replace(',', '.')) || 0);
    saveData();
    renderNotes();
  }

  /** Bulletin d'un apprenant, avec cachet, signature et code QR. */
  function editerBulletin(apprenantId) {
    const a2 = data.apprenants.find(x => x.id == apprenantId);
    if (!a2) return;
    const periode = periodeNotes();
    const cle = clePeriode(periode);
    const f = feuilleDe(a2.id, cle);
    const r = V().resultat(f);
    const classe = resultatsClasse();
    const moi = classe.filter(x => x.apprenant.id == a2.id)[0] || {};
    const composants = classe.filter(x => x.aCompose);
    const moyenneClasse = composants.length
      ? Math.round(composants.reduce((s2, x) => s2 + (x.moyenne || 0), 0)
        / composants.length * 100) / 100 : null;
    const ecole = data.ecoles.find(x => x.id == a2.ecoleId);

    const lignes = V().MATIERES.map((m, i) => {
      const n = r.notes[i];
      return '<tr><td>' + echapper(m.libelle) + '</td>'
        + '<td style="text-align:center;">' + (n === null ? '—' : n) + '</td>'
        + '<td style="text-align:center;">' + (n === null ? '—'
          : (n >= V().SEUIL_MATIERE ? 'Maîtrisée' : 'Non maîtrisée')) + '</td>'
        + '<td>' + (n === null ? 'Non composée' : appreciationNote(n)) + '</td></tr>';
    }).join('');

    openModal('Bulletin — ' + nomComplet(a2),
      '<div style="border:2px solid #006633;padding:18px;">'
      + enteteDocument({ etablissement: ecole ? ecole.nom : '' }) + '<div class="text-center">'
      + '<h2 style="color:#006633;margin:8px 0;">BULLETIN DE NOTES</h2>'
      + echapper(V().libellePeriode(periode)) + ' — année scolaire '
      + echapper(anneeActive()) + '</div>'
      + '<table style="width:100%;margin-top:12px;font-size:12px;"><tbody>'
      + '<tr><td style="background:#f8fafc;width:26%;">Nom et prénoms</td><td><b>'
      + echapper(nomComplet(a2)) + '</b></td>'
      + '<td style="background:#f8fafc;width:16%;">Cours</td><td>' + echapper(a2.cours) + '</td></tr>'
      + '<tr><td style="background:#f8fafc;">Né(e) le</td><td>' + formatDate(a2.dateNaiss)
      + ' à ' + echapper(a2.lieuNaiss || '—') + '</td>'
      + '<td style="background:#f8fafc;">Sexe</td><td>' + echapper(a2.sexe || '—') + '</td></tr>'
      + '<tr><td style="background:#f8fafc;">NPI</td><td>' + echapper(a2.npi || '—') + '</td>'
      + '<td style="background:#f8fafc;">Matricule</td><td>' + echapper(a2.matricule || '—')
      + '</td></tr></tbody></table>'
      + '<table style="width:100%;margin-top:12px;font-size:12px;"><thead><tr>'
      + '<th>Matière</th><th>Note /20</th><th>Maîtrise</th><th>Appréciation</th>'
      + '</tr></thead><tbody>' + lignes + '</tbody></table>'
      + '<table style="width:100%;margin-top:12px;font-size:12px;"><tbody>'
      + '<tr><td style="background:#f8fafc;">Total</td><td><b>'
      + (r.aCompose ? r.total : '—') + '</b></td>'
      + '<td style="background:#f8fafc;">Moyenne</td><td><b>'
      + (r.moyenne === null ? '—' : r.moyenne + '/20') + '</b></td></tr>'
      + '<tr><td style="background:#f8fafc;">Matières maîtrisées</td><td><b>'
      + r.maitrises + ' sur ' + r.composees + '</b> (seuil : ' + r.requis + ')</td>'
      + '<td style="background:#f8fafc;">Rang</td><td><b>'
      + (moi.rang || '—') + ' sur ' + composants.length + '</b></td></tr>'
      + '<tr><td style="background:#f8fafc;">Moyenne de la classe</td><td>'
      + (moyenneClasse === null ? '—' : moyenneClasse + '/20') + '</td>'
      + '<td style="background:#f8fafc;">Seuil de réussite</td><td><b>'
      + (!r.aCompose ? 'Non composé' : (r.admis ? 'ATTEINT' : 'Non atteint'))
      + '</b></td></tr></tbody></table>'
      + '<p class="petit muet mt-15">Une matière est maîtrisée à partir de '
      + V().SEUIL_MATIERE + '/20. Le seuil demande six maîtrises sur neuf matières composées, '
      + 'les deux tiers lorsque les onze le sont. Une matière non composée sort du calcul.</p>'
      + (global.Registres ? global.Registres.pied(ecole, a2.cours, 'BULLETIN', a2.id + '-' + cle, 'Bulletin ' + nomComplet(a2) + ' ' + cle) : piedDocument(ecole, 'BULLETIN', a2.id + '-' + cle, 'Le Directeur'))
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  function appreciationNote(n) {
    if (n >= 16) return 'Très bien';
    if (n >= 14) return 'Bien';
    if (n >= 12) return 'Assez bien';
    if (n >= 10) return 'Passable';
    if (n >= 7) return 'Insuffisant';
    return 'Très insuffisant';
  }

  /** Relevé de notes de toute la classe, en un seul document. */
  function editerReleveClasse() {
    const ecoleId = document.getElementById('notesEcole').value;
    const cours = document.getElementById('notesCours').value;
    if (!ecoleId || !cours) {
      alert('Choisissez d’abord une école et un cours.');
      return;
    }
    const lignes = resultatsClasse();
    if (!lignes.length) { alert('Aucun apprenant dans cette classe.'); return; }
    const periode = periodeNotes();
    const ecole = data.ecoles.find(x => x.id == ecoleId);
    const composants = lignes.filter(x => x.aCompose);
    const admis = composants.filter(x => x.admis).length;

    openModal('Relevé de notes — ' + (ecole ? ecole.nom : '') + ' — ' + cours,
      '<div style="border:2px solid #006633;padding:16px;">'
      + enteteDocument({ etablissement: ecole ? ecole.nom : '' }) + '<div class="text-center">'
      + '<h3 style="color:#006633;margin:8px 0;">RELEVÉ DE NOTES — ' + echapper(cours)
      + '</h3>' + echapper(V().libellePeriode(periode)) + ' — ' + echapper(anneeActive())
      + '</div>'
      + '<table class="liste-classe" style="margin-top:12px;"><thead><tr>'
      + '<th>Rang</th><th>Nom et prénoms</th><th>S</th>'
      + V().MATIERES.map(m => '<th>' + m.abrege + '</th>').join('')
      + '<th>Total</th><th>Moy.</th><th>Maît.</th><th>Seuil</th></tr></thead><tbody>'
      + lignes.sort((a2, b2) => (a2.rang || 9999) - (b2.rang || 9999)).map(x =>
        '<tr><td>' + (x.rang || '') + '</td><td>' + echapper(nomComplet(x.apprenant)) + '</td>'
        + '<td>' + echapper(x.apprenant.sexe || '') + '</td>'
        + x.notes.map(n => '<td>' + (n === null ? '' : n) + '</td>').join('')
        + '<td>' + (x.aCompose ? x.total : '') + '</td>'
        + '<td>' + (x.moyenne === null ? '' : x.moyenne) + '</td>'
        + '<td>' + (x.aCompose ? x.maitrises : '') + '</td>'
        + '<td>' + (!x.aCompose ? '' : (x.admis ? 'oui' : 'non')) + '</td></tr>').join('')
      + '</tbody></table>'
      + '<p class="mt-15"><b>' + lignes.length + '</b> apprenant(s), <b>' + composants.length
      + '</b> ayant composé, <b>' + admis + '</b> ayant atteint le seuil'
      + (composants.length ? ', soit <b>' + Math.round(admis / composants.length * 1000) / 10
        + ' %</b>' : '') + '.</p>'
      + (global.Registres ? global.Registres.pied(ecole, cours, 'RELEVE', ecoleId + '-' + cours + '-' + clePeriodeNotes(), 'Releve de notes ' + cours + ' ' + clePeriodeNotes() + ' ' + (ecole ? ecole.nom : ''))
        : piedDocument(ecole, 'RELEVE', ecoleId + '-' + cours + '-' + clePeriodeNotes(), 'Le Directeur'))
      + '</div><div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- CEP ---------------- */

  function renderCep() {
    const s = (document.getElementById('searchCep').value || '').toLowerCase();
    const liste = data.cep.filter(c => !s || (c.nom || '').toLowerCase().indexOf(s) >= 0);
    document.getElementById('cepTable').innerHTML = liste.map((c, i) =>
      '<tr><td>' + (i + 1) + '</td><td><b>'
      + echapper([c.nom, c.prenoms].filter(Boolean).join(' ')) + '</b></td>'
      + '<td>' + echapper(c.sexe || '—') + '</td><td>' + formatDate(c.dateNaiss) + '</td>'
      + '<td>' + echapper(c.lieuNaiss || '—') + '</td><td>' + echapper(nomEcole(c.ecoleId)) + '</td>'
      + '<td>' + echapper(c.session || '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-info btn-sm" title="Fiche d’inscription" onclick="printFicheCEP(\'' + c.id + '\')">🖨️</button>'
      + '<button class="btn btn-success btn-sm" title="Carte scolaire du candidat" onclick="carteCandidat(\'' + c.id + '\')">🪪</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editCep(\'' + c.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteCep(\'' + c.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="8" class="text-center">Aucune inscription</td></tr>';
  }

  /* Les rubriques de la fiche officielle d'inscription au CEP. */
  const OPTIONS_CEP = ['CEP', 'CEP + entrée en 6e'];

  function openCepModal(id) {
    const c = id ? data.cep.find(x => x.id == id) || {} : {};
    const primaires = data.ecoles.filter(e => String(e.type).indexOf('EP') === 0)
      .sort((a, b) => (a.nom || '').localeCompare(b.nom || '', 'fr'))
      .map(e => '<option value="' + e.id + '"' + (c.ecoleId == e.id ? ' selected' : '') + '>'
        + echapper(e.nom) + '</option>').join('');
    const centres_ = centres();

    openModal(id ? 'Modifier une inscription' : "Fiche d'inscription au CEP",
      '<form onsubmit="saveCep(event, \'' + (id || '') + '\')">'
      + '<div class="form-section"><h4>Examen</h4><div class="form-grid">'
      + selecteur('Option *', 'option', OPTIONS_CEP, c.option || OPTIONS_CEP[1], true)
      + champ('Session', 'session', c.session || 'JUIN ' + sessionCEP())
      + '<div class="form-group"><label>Centre de composition</label>'
      + '<select name="centre"><option value="">—</option>'
      + centres_.map(x => '<option value="' + echapper(x.nom) + '"'
        + (c.centre === x.nom ? ' selected' : '') + '>' + echapper(x.nom) + '</option>').join('')
      + '</select></div>'
      + '</div></div>'
      + '<div class="form-section"><h4>École de provenance</h4><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + primaires + '</select></div>'
      + '<p class="petit muet" style="grid-column:1/-1;">La commune, la circonscription, '
      + 'le statut, le nom et le contact du directeur sont repris de la fiche de l’école.</p>'
      + '</div></div>'
      + '<div class="form-section"><h4>Candidat</h4><div class="form-grid">'
      + '<div class="form-group"><label>Nom (en capitales) *</label><input name="nom" value="'
      + echapper(c.nom || '') + '" required></div>'
      + champ('Prénoms (sans abréviation)', 'prenoms', c.prenoms)
      + selecteur('Sexe *', 'sexe', [['M', 'Masculin'], ['F', 'Féminin']], c.sexe, true)
      + '<div class="form-group"><label>Date de naissance *</label><input type="date" '
      + 'name="dateNaiss" value="' + echapper(c.dateNaiss || '') + '" required></div>'
      + champ('Lieu de naissance', 'lieuNaiss', c.lieuNaiss)
      + champ("N° acte de naissance", 'numActe', c.numActe)
      + champ('Numéro EDUCMaster', 'matricule', c.matricule)
      + champ('NPI', 'npi', c.npi)
      + champ('N° de table', 'numTable', c.numTable)
      + selecteur('Dispense d’âge', 'dispense_age', ['Non', 'Oui'], c.dispense_age)
      + selecteur('Dispense de sport', 'dispense_sport', ['Non', 'Oui'], c.dispense_sport)
      + '</div>'
      + '<div class="form-group mt-15"><label>Photo du candidat</label>'
      + '<input type="file" id="photoApprenant" accept="image/*" onchange="chargerPhoto(this)">'
      + '<div id="apercuPhoto" class="mt-15">' + (c.photo
        ? '<img src="' + c.photo + '" style="max-height:110px;border-radius:6px;">' : '')
      + '</div><input type="hidden" name="photo" value="' + echapper(c.photo || '') + '"></div>'
      + '</div>'
      + '<div class="form-section"><h4>Établissements choisis, par ordre de préférence</h4>'
      + '<div class="form-grid">'
      + champ('Premier choix', 'choix1', c.choix1)
      + champ('Deuxième choix', 'choix2', c.choix2)
      + champ('Troisième choix', 'choix3', c.choix3)
      + '</div></div>'
      + '<div class="form-section"><h4>Parents</h4><div class="form-grid">'
      + champ('Nom du père', 'pere', c.pere)
      + champ('Nom de la mère', 'mere', c.mere)
      + champ('Résidence des parents', 'residence', c.residence)
      + champ('Nom et prénom du parent signataire', 'parent_signataire', c.parent_signataire)
      + champ('Degré de parenté', 'parente', c.parente)
      + champ('Contact téléphonique du parent', 'telParent', c.telParent)
      + '</div></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveCep(ev, id) {
    ev.preventDefault();
    enregistrer('cep', Object.fromEntries(new FormData(ev.target)), id, renderCep);
  }
  function deleteCep(id) {
    if (!confirm('Supprimer ?')) return;
    data.cep = data.cep.filter(x => x.id != id);
    saveData(); renderCep();
  }

  /* ---------------- Fiche CEP et cartes : format SCOLARIS / GESCOL ---------------- */

  const D = () => global.DocScol;
  const emblemesDoc = () => Object.assign({ bandeau: global.Embleme && global.Embleme.BANDEAU }, emblemes());
  const titreDir = e => /^(mme|madame|mlle)\b/i.test(String(e.directeur || '').trim()) ? 'LA DIRECTRICE' : 'LE DIRECTEUR';
  const telDirecteur = e => e.contact_directeur || e.telephone || '';
  const dateFr = iso => iso ? formatDate(iso) : '';
  /** Numéro du document et code QR menant à la page publique de vérification (résumé court sur les cartes). */
  function qrDoc(type, cle, resume, petit) {
    const numero = global.Pieces.numeroDocument(type, cle);
    return { numero, qr: global.Pieces.qr(global.Pieces.lienVerification(numero, resume), 96, petit ? 'L' : 'M') };
  }
  const cachetDe = e => e && e.id ? (taille => global.Pieces.cachet(porteurEcole(e), { taille })) : null;

  /** Toutes les valeurs de la fiche d'inscription (même dictionnaire que SCOLARIS : donnees_fiche). */
  function donneesFicheCEP(c) {
    const e = data.ecoles.find(x => x.id == c.ecoleId) || {};
    const naiss = [dateFr(c.dateNaiss), c.lieuNaiss ? 'à ' + c.lieuNaiss : ''].filter(Boolean).join(' ');
    const v = qrDoc('CEP', c.id, 'Fiche CEP · ' + nomComplet(c) + ' · ' + (e.nom || ''));
    return {
      emblemes: emblemesDoc(), ddemp: 'PLATEAU', session: c.session || ('JUIN ' + sessionCEP()), centre: c.centre || '',
      option: c.option, commune: /^pob[eè]$/i.test(e.commune || '') || !e.commune ? 'POBÈ' : e.commune, cs: 'POBÈ', ecole: e.nom || '', statut: e.statut || '',
      directeur: e.directeur || '', directeur_tel: telDirecteur(e),
      nom: c.nom, prenoms: c.prenoms, sexe: c.sexe === 'F' ? 'Féminin' : (c.sexe === 'M' ? 'Masculin' : ''),
      naissance: naiss, educmaster: c.matricule || '', etab: [c.choix1, c.choix2, c.choix3],
      residence: c.residence, dispense_age: c.dispense_age === 'Oui', dispense_sport: c.dispense_sport === 'Oui',
      fait_a: e.commune ? (String(e.commune).toUpperCase() === 'POBE' ? 'Pobè' : e.commune) : 'Pobè',
      fait_le: new Date().toLocaleDateString('fr-FR'),
      parent_nom: c.parent_signataire || c.pere || c.mere || '',
      parent_contact: [c.telParent, c.parente ? '(' + c.parente + ')' : ''].filter(Boolean).join(' '),
      photo: c.photo, sig_parent: c.sig_parent, sig_candidat: c.sig_candidat, sig_directeur: e.signature_image,
      certifie_a: 'Pobè', certifie_le: new Date().toLocaleDateString('fr-FR'),
      titre_directeur: titreDir(e), directeur_nom: e.directeur || '', cachet: cachetDe(e), qr: v.qr, numero: v.numero
    };
  }

  const barreDoc = boutons => '<div class="barre-doc">' + boutons.join(' ') + '</div>';

  /** La fiche d'inscription au CEP, au format officiel de SCOLARIS / GESCOL. */
  function printFicheCEP(id) {
    const c = data.cep.find(x => x.id == id);
    if (!c) return;
    const e = data.ecoles.find(x => x.id == c.ecoleId) || {};
    const manque = [!c.sig_candidat && 'signature du candidat', !c.sig_parent && 'signature du parent',
      !e.signature_image && 'signature du directeur (Cachets et signatures)'].filter(Boolean);
    openModal('Fiche d’inscription au CEP — ' + nomComplet(c),
      barreDoc([
        '<button class="btn btn-primary" onclick="DocScol.imprimer()">🖨️ Imprimer / PDF</button>',
        '<button class="btn btn-info" onclick="signerCEP(\'' + c.id + '\', \'sig_candidat\')">✍️ Signature du candidat</button>',
        '<button class="btn btn-info" onclick="signerCEP(\'' + c.id + '\', \'sig_parent\')">✍️ Signature du parent</button>',
        '<button class="btn btn-success" onclick="carteCandidat(\'' + c.id + '\')">🪪 Carte du candidat</button>'])
      + (manque.length ? '<p class="petit muet">À compléter : ' + manque.join(', ') + '.</p>' : '')
      + '<div class="zone-feuilles">' + D().ficheCEP(donneesFicheCEP(c)) + '</div>');
  }

  /** Signature digitale (élève, parent) tracée au doigt ou au stylet, apposée sur la fiche et la carte. */
  function signerCEP(id, champ_) {
    const c = data.cep.find(x => x.id == id);
    if (!c) return;
    const qui = champ_ === 'sig_parent' ? 'Parent — ' + (c.parent_signataire || c.pere || c.mere || nomComplet(c)) : 'Candidat — ' + nomComplet(c);
    global.Pieces.capturerSignature(qui, c[champ_], image => D().reduireSignature(image).then(img => {
      if (img) c[champ_] = img; else delete c[champ_];
      saveData();
      printFicheCEP(id);
    }));
  }

  /** Données d'une carte (recto + verso), communes à la carte du candidat et à la carte d'identité scolaire. */
  function donneesCarte(eleve, e, options) {
    const v = qrDoc(options.type, eleve.id, nomComplet(eleve).slice(0, 26), true);
    const commune = e.commune && String(e.commune).toUpperCase() !== 'POBE' ? e.commune : 'Pobè';
    return {
      emblemes: emblemesDoc(), titre: options.titre, annee: anneeActive(), photo: eleve.photo,
      champs: options.champs, admin: [['DDEMP', 'PLATEAU'], ['CS', 'POBÈ'], ['ÉCOLE', e.nom || ''], ['CLASSE', options.classe || '']],
      sig_eleve: options.sig, sig_dir: e.signature_image, dir_titre: titreDir(e) === 'LA DIRECTRICE' ? 'La Directrice' : 'Le Directeur',
      dir_nom: e.directeur || '', cachet: cachetDe(e), qr: v.qr, code: v.numero, logo: e.logo,
      ecole: e.nom || '', sous: [e.statut === 'Public' ? 'Publique' : (e.statut || ''), commune].filter(Boolean).join(' · '),
      lignes: [['Téléphone', e.telephone], ['DDEMP / CS', 'PLATEAU / POBÈ'], ['Commune', commune],
        ['Arrondissement', e.arrondissement]].concat(options.verso || []),
      note: options.note || 'Cette carte est strictement personnelle. En cas de perte, prière de la rapporter à l’école ou à la Circonscription Scolaire de Pobè.',
      urgence: options.urgence
    };
  }

  function carteDuCandidat(c) {
    const e = data.ecoles.find(x => x.id == c.ecoleId) || {};
    return donneesCarte(c, e, {
      type: 'CC', titre: 'CARTE SCOLAIRE DU CANDIDAT(E)', classe: 'CM2', sig: c.sig_candidat,
      champs: [['N° DE TABLE', c.numTable], ['MATRICULE', c.matricule], ['NIP', c.npi], ['NOM', String(c.nom || '').toUpperCase()],
        ['PRÉNOM(S)', c.prenoms], ['SEXE', c.sexe], ['DATE DE NAISSANCE', dateFr(c.dateNaiss)], ['LIEU DE NAISSANCE', c.lieuNaiss],
        ["CENTRE D'EXAMEN", c.centre], ['CLASSE', 'CM2']],
      verso: [["Centre d'examen", c.centre], ['Session', c.session]],
      urgence: [c.parent_signataire || c.pere || c.mere, c.telParent].filter(Boolean).join(' ')
    });
  }

  function carteCandidat(id) {
    const c = data.cep.find(x => x.id == id);
    if (!c) return;
    const k = carteDuCandidat(c);
    openModal('Carte scolaire du candidat — ' + nomComplet(c),
      barreDoc([
        '<button class="btn btn-primary" onclick="DocScol.imprimer()">🖨️ Imprimer / PDF</button>',
        '<button class="btn btn-info" onclick="signerCarteCEP(\'' + c.id + '\')">✍️ Signature de l’élève</button>',
        '<button class="btn btn-warning" onclick="printFicheCEP(\'' + c.id + '\')">📋 Fiche d’inscription</button>'])
      + '<div class="zone-feuilles">' + D().apercuCarte(k) + '<div class="planche-cachee">'
      + D().planche([k], 'Carte scolaire du candidat') + '</div></div>'
      + '<p class="petit muet">À l’impression, le recto et le verso tombent l’un derrière l’autre en recto-verso (bord long), à 100 %.</p>');
  }
  function signerCarteCEP(id) {
    const c = data.cep.find(x => x.id == id);
    if (!c) return;
    global.Pieces.capturerSignature('Candidat — ' + nomComplet(c), c.sig_candidat, image => D().reduireSignature(image).then(img => {
      if (img) c.sig_candidat = img; else delete c.sig_candidat;
      saveData(); carteCandidat(id);
    }));
  }

  /** Planche A4 de 10 cartes pour toute une école (candidats au CEP ou cartes d'identité). */
  function plancheCartes(quoi) {
    const liste = quoi === 'cni' ? data.cni : data.cep;
    const parEcole = {};
    liste.forEach(x => { if (x.ecoleId) parEcole[x.ecoleId] = (parEcole[x.ecoleId] || 0) + 1; });
    const ids = Object.keys(parEcole);
    if (!ids.length) { alert('Aucune fiche rattachée à une école.'); return; }
    if (ids.length === 1) { plancheEcole(quoi, ids[0]); return; }
    openModal('Planche de cartes — choisir l’école',
      '<div class="form-group"><label>École</label><select id="choixPlanche">'
      + ids.map(i => '<option value="' + i + '">' + echapper(nomEcole(i)) + ' (' + parEcole[i] + ')</option>').join('')
      + '</select></div><div class="text-center mt-15"><button class="btn btn-primary" onclick="plancheEcole(\'' + quoi
      + '\', document.getElementById(\'choixPlanche\').value)">🪪 Préparer la planche</button></div>');
  }
  function plancheEcole(quoi, ecoleId) {
    const cartes = quoi === 'cni'
      ? data.cni.filter(x => x.ecoleId == ecoleId).map(carteIdentite)
      : data.cep.filter(x => x.ecoleId == ecoleId).sort((a, b) => nomComplet(a).localeCompare(nomComplet(b), 'fr')).map(carteDuCandidat);
    const titre = (quoi === 'cni' ? 'Cartes d’identité scolaires' : 'Cartes scolaires des candidats') + ' — ' + nomEcole(ecoleId);
    openModal(titre, barreDoc(['<button class="btn btn-primary" onclick="DocScol.imprimer()">🖨️ Imprimer / PDF</button>'])
      + '<p class="petit muet">' + cartes.length + ' carte(s), 10 par page A4. Imprimez en recto-verso (bord long) à 100 %, puis découpez le long des repères.</p>'
      + '<div class="zone-feuilles planche-visible">' + D().planche(cartes, titre) + '</div>');
  }

  /* ---------------- Cartes d'identité ---------------- */

  function renderCni() {
    document.getElementById('cniTable').innerHTML = data.cni.map(c =>
      '<tr><td><b>' + echapper([c.nom, c.prenoms].filter(Boolean).join(' ')) + '</b>' + (c.classe ? '<br><span class="petit muet">' + echapper(c.classe) + '</span>' : '') + '</td><td>' + echapper(c.sexe || '—') + '</td>'
      + '<td>' + formatDate(c.dateNaiss) + '</td><td>' + echapper(c.lieuNaiss || '—') + '</td>'
      + '<td>' + echapper(c.pere || '—') + '</td><td>' + echapper(c.mere || '—') + '</td>'
      + '<td>' + echapper(nomEcole(c.ecoleId)) + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-success btn-sm" title="Carte d’identité scolaire" onclick="printCNI(\'' + c.id + '\')">🪪</button>'
      + '<button class="btn btn-info btn-sm" title="Fiche de demande" onclick="printDemandeCNI(\'' + c.id + '\')">🖨️</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editCni(\'' + c.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteCni(\'' + c.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="8" class="text-center">Aucune fiche</td></tr>';
  }

  function openCniModal(id) {
    const c = id ? data.cni.find(x => x.id == id) || {} : {};
    openModal(id ? 'Modifier la fiche' : "Demande de carte d'identité",
      '<form onsubmit="saveCni(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>Nom et prénoms *</label><input name="nom" value="'
      + echapper(c.nom || '') + '" required></div>'
      + selecteur('Sexe', 'sexe', [['M', 'Masculin'], ['F', 'Féminin']], c.sexe)
      + '<div class="form-group"><label>Date de naissance</label><input type="date" '
      + 'name="dateNaiss" value="' + echapper(c.dateNaiss || '') + '"></div>'
      + champ('Lieu de naissance', 'lieuNaiss', c.lieuNaiss)
      + champ("N° acte de naissance", 'numActe', c.numActe)
      + champ('Nom du père', 'pere', c.pere) + champ('Nom de la mère', 'mere', c.mere)
      + champ('Nationalité', 'nationalite', c.nationalite || 'Béninoise')
      + champ('Domicile', 'domicile', c.domicile) + champ('Téléphone', 'telephone', c.telephone)
      + '<div class="form-group"><label>École</label><select name="ecoleId">'
      + '<option value="">—</option>' + optionsEcoles(c.ecoleId) + '</select></div>'
      + champ('Signes particuliers', 'signes', c.signes)
      + champ('Classe', 'classe', c.classe)
      + champ('Matricule EDUCMaster / NPI', 'matricule', c.matricule)
      + champ('Parent à prévenir (nom)', 'parent', c.parent)
      + '</div>'
      + '<div class="form-group"><label>Photo d’identité</label>'
      + '<p class="petit muet mb-15">La photo est réduite puis conservée sur cet ordinateur ; '
      + 'elle ne part sur aucun réseau.</p>'
      + '<input type="file" id="photoApprenant" accept="image/*" onchange="chargerPhoto(this)">'
      + '<div id="apercuPhoto" class="mt-15">' + (c.photo
        ? '<img src="' + c.photo + '" style="max-height:120px;border-radius:6px;">' : '')
      + '</div><input type="hidden" name="photo" value="' + echapper(c.photo || '') + '">'
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }
  function saveCni(ev, id) {
    ev.preventDefault();
    enregistrer('cni', Object.fromEntries(new FormData(ev.target)), id, renderCni);
  }
  function deleteCni(id) {
    if (!confirm('Supprimer ?')) return;
    data.cni = data.cni.filter(x => x.id != id);
    saveData(); renderCni();
  }
  /** Carte d'identité scolaire au format de la carte SCOLARIS / GESCOL (85,6 × 54 mm). */
  function carteIdentite(c) {
    const e = data.ecoles.find(x => x.id == c.ecoleId) || {};
    const mots = String(c.prenoms ? c.nom : (c.nom || '')).trim().split(/\s+/);
    const nom = c.prenoms ? c.nom : mots[0], prenoms = c.prenoms || mots.slice(1).join(' ');
    return donneesCarte(c, e, {
      type: 'CI', titre: 'CARTE D’IDENTITÉ SCOLAIRE', classe: c.classe, sig: c.sig_eleve,
      champs: [['MATRICULE', c.matricule], ['NOM', String(nom || '').toUpperCase()], ['PRÉNOM(S)', prenoms], ['SEXE', c.sexe],
        ['DATE DE NAISSANCE', dateFr(c.dateNaiss)], ['LIEU DE NAISSANCE', c.lieuNaiss], ['N° ACTE NAISS.', c.numActe],
        ['NATIONALITÉ', c.nationalite || 'Béninoise'], ['DOMICILE', c.domicile], ['CLASSE', c.classe]],
      verso: [['Père', c.pere], ['Mère', c.mere], ['Signes particuliers', c.signes || 'Néant']],
      urgence: [c.parent || c.pere || c.mere, c.telephone].filter(Boolean).join(' ')
    });
  }
  function printCNI(id) {
    const c = data.cni.find(x => x.id == id);
    if (!c) return;
    const k = carteIdentite(c);
    openModal('Carte d’identité scolaire — ' + (c.nom || ''),
      barreDoc([
        '<button class="btn btn-primary" onclick="DocScol.imprimer()">🖨️ Imprimer / PDF</button>',
        '<button class="btn btn-info" onclick="signerCNI(\'' + c.id + '\')">✍️ Signature de l’élève</button>',
        '<button class="btn btn-warning" onclick="printDemandeCNI(\'' + c.id + '\')">📋 Fiche de demande</button>'])
      + '<div class="zone-feuilles">' + D().apercuCarte(k) + '<div class="planche-cachee">'
      + D().planche([k], 'Carte d’identité scolaire') + '</div></div>'
      + '<p class="petit muet">À l’impression, le recto et le verso tombent l’un derrière l’autre en recto-verso (bord long), à 100 %.</p>');
  }
  function signerCNI(id) {
    const c = data.cni.find(x => x.id == id);
    if (!c) return;
    global.Pieces.capturerSignature('Élève — ' + (c.nom || ''), c.sig_eleve, image => D().reduireSignature(image).then(img => {
      if (img) c.sig_eleve = img; else delete c.sig_eleve;
      saveData(); printCNI(id);
    }));
  }

  /** La fiche de demande de carte d'identité, au même format officiel que
      les autres pièces : en-tête, cadre photo, cachet, signature et QR. */
  function printDemandeCNI(id) {
    const c = data.cni.find(x => x.id == id);
    if (!c) return;
    const ecole = data.ecoles.find(x => x.id == c.ecoleId) || {};
    const point = v => v ? echapper(v) : '……………………';
    const ligne = (l, v) => '<tr><td style="background:#f8fafc;width:40%;">' + l
      + '</td><td>' + v + '</td></tr>';

    openModal('Fiche de demande de carte d’identité — ' + (c.nom || ''),
      '<div class="page-a4">'
      + enteteDocument({
        direction: 'DIRECTION DÉPARTEMENTALE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE : PLATEAU',
        circonscription: ecole.nom || 'CIRCONSCRIPTION SCOLAIRE DE POBÈ' })
      + '<h2 class="titre-a4">FICHE DE DEMANDE DE<br>CARTE D’IDENTITÉ SCOLAIRE</h2>'

      + '<div style="display:flex;gap:14px;align-items:flex-start;">'
      + '<table style="flex:1;font-size:12.5px;"><tbody>'
      + ligne('NOM <span class="petit muet">(en lettres capitales)</span>',
        '<b>' + point(String(c.nom || '').toUpperCase()) + '</b>')
      + ligne('SEXE', point(c.sexe === 'F' ? 'Féminin' : (c.sexe === 'M' ? 'Masculin' : '')))
      + ligne('DATE ET LIEU DE NAISSANCE', formatDate(c.dateNaiss) + ' à ' + point(c.lieuNaiss))
      + ligne("N° D'ACTE DE NAISSANCE", point(c.numActe))
      + ligne('NOM DU PÈRE', point(c.pere))
      + ligne('NOM DE LA MÈRE', point(c.mere))
      + ligne('NATIONALITÉ', point(c.nationalite || 'Béninoise'))
      + ligne('DOMICILE', point(c.domicile))
      + ligne('TÉLÉPHONE', point(c.telephone))
      + ligne('SIGNES PARTICULIERS', point(c.signes || 'Néant'))
      + ligne('ÉCOLE', point(ecole.nom))
      + '</tbody></table>'
      + '<div class="cadre-photo">' + (c.photo
        ? '<img src="' + c.photo + '" alt="Photo">'
        : '<span>Photo</span>') + '</div>'
      + '</div>'

      + '<p class="mt-15">Je certifie exacts les renseignements ci-dessus.</p>'
      + '<p>Fait à ' + point(ecole.commune || 'Pobè') + ', le '
      + new Date().toLocaleDateString('fr-FR') + '.</p>'

      + piedDocument(ecole.id ? ecole : null, 'CNI', c.id, 'Le Directeur')
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button></div>');
  }

  /* ---------------- Fiches officielles ---------------- */

  const R = () => global.Rapports;

  function ecoleFiche() {
    const sel = document.getElementById('ficheEcole');
    return sel && sel.value ? data.ecoles.find(x => x.id == sel.value) : null;
  }

  function typeFiche() {
    const sel = document.getElementById('ficheType');
    return sel ? sel.value : 'RECENSEMENT';
  }

  function cycleDe(ecole) {
    return ecole && String(ecole.type).indexOf('EM') === 0 ? 'MATERNELLE' : 'PRIMAIRE';
  }

  /** Les compléments saisis pour une école, conservés d'une fiche à l'autre. */
  function complementsDe(ecoleId, creer) {
    let c = data.fiches.filter(f => f.ecoleId == ecoleId && f.annee === anneeActive())[0];
    if (!c) {
      c = { id: uid(), ecoleId: ecoleId, annee: anneeActive() };
      if (creer) data.fiches.push(c);
    }
    return c;
  }

  /** Rassemble le contexte de l'école et le passe au canevas. */
  function donneesFiche(ecole) {
    return R().preRemplir({
      ecole: ecole,
      releve: data.effectifs.filter(e => e.ecoleId == ecole.id
        && (!e.annee || e.annee === anneeActive()))[0],
      agents: data.personnel.filter(p => p.ecoleId == ecole.id),
      estActif: global.Carriere.estActif,
      locaux: data.infrastructures.filter(i => i.ecoleId == ecole.id),
      mobilier: data.mobilier.filter(m => m.ecoleId == ecole.id)
    });
  }

  function renderFiches() {
    const sel = document.getElementById('ficheEcole');
    if (sel.options.length <= 1) {
      sel.innerHTML = '<option value="">— École —</option>' + optionsEcoles();
    }
    const ecole = ecoleFiche();
    const etat = document.getElementById('etatFiche');
    const formulaire = document.getElementById('formulaireFiche');

    if (!ecole) {
      etat.innerHTML = '';
      formulaire.innerHTML = '<div class="alert alert-info">Choisissez une école.</div>';
      return;
    }

    const cycle = cycleDe(ecole);
    const donnees = donneesFiche(ecole);
    const comp = complementsDe(ecole.id);
    const absents = R().manquants(donnees, comp);

    etat.innerHTML = '<div class="stats-grid">'
      + carte(donnees.classes.ouvertes + ' / ' + donnees.classes.autorisees,
        'Classes ouvertes / autorisées')
      + carte(U(donnees.eleves.total), 'Apprenants',
        donnees.eleves.total ? 'blue' : 'red')
      + carte(donnees.personnel.enseignants.total, 'Enseignants en poste',
        donnees.personnel.enseignants.total ? '' : 'red')
      + carte(donnees.locaux.length + ' / ' + donnees.mobilier.length, 'Locaux / mobiliers')
      + '</div>'
      + (absents.length
        ? '<div class="alert alert-warning">La fiche est incomplète : il manque '
          + absents.map(echapper).join(', ') + '.</div>'
        : '<div class="alert alert-success">Toutes les rubriques essentielles sont '
          + 'renseignées.</div>');

    /* Les rubriques que l'application ne peut pas déduire, groupées comme sur
       le formulaire officiel. */
    const groupes = [
      { titre: '1. Identification — références et actes',
        champs: R().IDENTIFICATION.filter(c =>
          ['annee_creation', 'statut', 'village', 'telephone', 'email'].indexOf(c.cle) < 0) },
      { titre: '2. Renseignements généraux', champs: R().generales(cycle) }
    ].concat(R().sections(cycle))
      .concat([{ titre: 'Remplissage, contrôles et visas', champs: R().VALIDATION }]);

    const valeurDe = c => (RUBRIQUES_ECOLE.indexOf(c.cle) >= 0 ? ecole : comp)[c.cle];
    const total = groupes.reduce((t, g) => t + g.champs.length, 0);
    const remplis = groupes.reduce((t, g) =>
      t + g.champs.filter(c => valeurDe(c) !== undefined && valeurDe(c) !== '').length, 0);

    formulaire.innerHTML = '<div class="form-container">'
      + '<h3 style="color:#006633;">Compléments — ' + echapper(ecole.nom) + '</h3>'
      + '<p class="muet mb-15">Ce qui figure déjà dans la fiche de l’école n’est pas '
      + 'redemandé ici. <b>' + remplis + ' rubrique(s) sur ' + total + '</b> renseignée(s).</p>'
      + groupes.map(g => {
        const faits = g.champs.filter(c => valeurDe(c) !== undefined && valeurDe(c) !== '').length;
        return '<div class="form-section"><h4>' + echapper(g.titre)
          + ' <span class="petit muet">— ' + faits + ' / ' + g.champs.length + '</span></h4>'
          + '<div class="form-grid">'
          + g.champs.map(c => champComplement(c, comp, ecole)).join('')
          + '</div></div>';
      }).join('')
      + '</div>';
  }

  function champComplement(c, comp, ecole) {
    const source = (ecole && RUBRIQUES_ECOLE.indexOf(c.cle) >= 0) ? ecole : comp;
    const valeur = source[c.cle] === undefined ? '' : source[c.cle];

    if (c.cle === 'zone_ped' || c.cle === 'unite_ped') {
      const choix = c.cle === 'zone_ped' ? global.Donnees.ZONES : unitesConnues();
      return '<div class="form-group"><label>' + echapper(c.libelle) + '</label>'
        + '<select onchange="majComplement(\'' + c.cle + '\', this.value)">'
        + ['', ...choix].map(v => '<option value="' + echapper(v) + '"'
          + (valeur === v ? ' selected' : '') + '>' + echapper(v || '—')
          + '</option>').join('') + '</select></div>';
    }
    if (c.type === 'liste') {
      return '<div class="form-group"><label>' + echapper(c.libelle) + '</label>'
        + '<select onchange="majComplement(\'' + c.cle + '\', this.value)">'
        + ['—'].concat(c.valeurs).map(v => '<option value="' + (v === '—' ? '' : v) + '"'
          + (valeur === v ? ' selected' : '') + '>' + echapper(v) + '</option>').join('')
        + '</select></div>';
    }
    const type = c.type === 'entier' || c.type === 'decimal' ? 'number'
      : (c.type === 'date' ? 'date' : 'text');
    return '<div class="form-group"><label>' + echapper(c.libelle) + '</label>'
      + '<input type="' + type + '"' + (c.type === 'decimal' ? ' step="0.1"' : '')
      + ' value="' + echapper(valeur)
      + '" onchange="majComplement(\'' + c.cle + '\', this.value)"></div>';
  }

  /* Quatre rubriques appartiennent à l'école elle-même : les y écrire évite
     d'entretenir deux vérités pour la même information. */
  const RUBRIQUES_ECOLE = ['directeur', 'contact_directeur', 'zone_ped', 'unite_ped'];

  function majComplement(cle, valeur) {
    const ecole = ecoleFiche();
    if (!ecole) return;
    if (RUBRIQUES_ECOLE.indexOf(cle) >= 0) {
      ecole[cle] = valeur;
    } else {
      complementsDe(ecole.id, true)[cle] = valeur;
    }
    saveData();
    renderFiches();
  }

  /** La fiche officielle, remplie et prête à imprimer. */
  function editerFiche() {
    const ecole = ecoleFiche();
    if (!ecole) { alert('Choisissez d’abord une école.'); return; }
    const type = typeFiche();
    const cycle = cycleDe(ecole);
    const donnees = donneesFiche(ecole);
    const comp = complementsDe(ecole.id);
    const niveaux = R().niveaux(cycle);

    const ligne = (l, v) => '<tr><td style="background:#f8fafc;width:34%;">' + l
      + '</td><td>' + v + '</td></tr>';
    const id = donnees.identification;

    const tableauCours = cycle === 'PRIMAIRE'
      ? '<table style="width:100%;font-size:12px;"><thead><tr><th>Cours</th>'
        + donnees.parCours.map(c => '<th>' + c.cours + '</th>').join('')
        + '<th>Total</th></tr></thead><tbody>'
        + [['Garçons', 'G'], ['Filles', 'F']].map(([lib, k]) =>
          '<tr><td>' + lib + '</td>'
          + donnees.parCours.map(c => '<td>' + c[k] + '</td>').join('')
          + '<td><b>' + donnees.parCours.reduce((s2, c) => s2 + c[k], 0) + '</b></td></tr>').join('')
        + '<tr><td><b>Total</b></td>'
        + donnees.parCours.map(c => '<td><b>' + (c.G + c.F) + '</b></td>').join('')
        + '<td><b>' + donnees.eleves.total + '</b></td></tr>'
        + '</tbody></table>'
      : '<table style="width:100%;font-size:12px;"><thead><tr><th>Section</th><th>Garçons</th><th>Filles</th><th>Total</th></tr></thead><tbody>'
        + (donnees.parSection || []).map(x => '<tr><td>' + x.section + '</td><td>' + x.G + '</td><td>' + x.F + '</td><td><b>' + (x.G + x.F) + '</b></td></tr>').join('')
        + '<tr><td><b>Total</b></td><td><b>' + donnees.eleves.G + '</b></td><td><b>' + donnees.eleves.F + '</b></td><td><b>' + donnees.eleves.total + '</b></td></tr></tbody></table>';

    const pf = donnees.personnel.fichier;
    const personnelFichier = pf ? '<p class="petit">Effectif du personnel par statut <i>(pré-rempli : ' + echapper(pf.source || 'fichier de la CS') + ')</i> : '
      + [['fe', 'FE'], ['acdpe', 'ACDPE'], ['ame', 'AME'], ['autres', 'autres']].filter(([k]) => pf[k]).map(([k, l]) => l + ' ' + pf[k]).join(', ')
      + (pf.total !== undefined ? ' — total <b>' + pf.total + '</b>' : '') + '.</p>' : '';
    const personnel = personnelFichier + (donnees.personnel.liste.length
      ? '<table style="width:100%;font-size:11px;"><thead><tr><th>N°</th><th>Matricule</th>'
        + '<th>Nom et prénoms</th><th>Sexe</th><th>Naissance</th><th>Grade</th>'
        + '<th>Statut</th><th>Fonction</th><th>Cours</th><th>Indice</th></tr></thead><tbody>'
        + donnees.personnel.liste.map((a2, i) => '<tr><td>' + (i + 1) + '</td>'
          + '<td>' + echapper(a2.matricule || '') + '</td>'
          + '<td>' + echapper(a2.nom) + '</td><td>' + echapper(a2.sexe || '') + '</td>'
          + '<td>' + formatDate(a2.dateNaissance) + '</td>'
          + '<td>' + echapper(a2.grade || '') + '</td><td>' + echapper(a2.statut || '') + '</td>'
          + '<td>' + echapper(a2.fonction || '') + '</td><td>' + echapper(a2.cours || '') + '</td>'
          + '<td>' + echapper(a2.indice || '') + '</td></tr>').join('')
        + '</tbody></table>'
      : '<p class="muet">Aucun enseignant enregistré pour cette école.</p>');

    const locaux = donnees.locaux.length
      ? '<table style="width:100%;font-size:11px;"><thead><tr><th>Local</th><th>Murs</th>'
        + '<th>Toit</th><th>État</th><th>Année</th><th>Financeur</th></tr></thead><tbody>'
        + donnees.locaux.map(l => '<tr><td>' + echapper(l.typeLocal || '') + '</td>'
          + '<td>' + echapper(l.natureMurs || '') + '</td>'
          + '<td>' + echapper(l.natureToit || '') + '</td>'
          + '<td>' + echapper(l.etat || '') + '</td>'
          + '<td>' + echapper(l.anneeService || '') + '</td>'
          + '<td>' + echapper(l.financeur || '') + '</td></tr>').join('')
        + '</tbody></table>'
      : '<p class="muet">Aucun local enregistré.</p>';

    const intitule = type === 'RECENSEMENT'
      ? 'FICHE DE RECENSEMENT ANNUEL — ÉCOLES '
        + (cycle === 'MATERNELLE' ? 'MATERNELLES' : 'PRIMAIRES')
      : R().titre(type, cycle);

    openModal(intitule,
      '<div style="border:2px solid #006633;padding:18px;">'
      + enteteDocument({ etablissement: ecole.nom })
      + '<div class="text-center"><h2 style="color:#006633;margin:8px 0;">'
      + echapper(intitule) + '</h2>'
      + 'Année scolaire ' + echapper(anneeActive()) + '</div>'

      + '<h4 style="margin-top:12px;color:#006633;">1. Identification et localisation</h4>'
      + '<table style="width:100%;font-size:12px;"><tbody>'
      + ligne('Nom de l’école', '<b>' + echapper(id.nom) + '</b>')
      + ligne('Code', echapper(id.code || '—'))
      + ligne('Année de création', echapper(id.annee_creation || '—')
        + (comp.reference_creation ? ' — réf. ' + echapper(comp.reference_creation) : ''))
      + ligne('Statut et type', echapper(id.statut || '—') + ' · '
        + echapper(id.type || '—'))
      + ligne('Circonscription et zone', 'CS Pobè · '
        + echapper(id.zone_ped || '—') + ' · ' + echapper(id.unite_ped || '—'))
      + ligne('Département, commune, arrondissement', echapper(id.departement || '—')
        + ' · ' + echapper(id.commune || '—') + ' · ' + echapper(id.arrondissement || '—'))
      + ligne('Village ou quartier', echapper(id.village || '—'))
      + ligne('Contacts', echapper(id.telephone || '—') + ' · '
        + echapper(id.email || '—'))
      + ligne('Directeur', echapper(id.directeur || '—')
        + (id.contact_directeur ? ' — ' + echapper(id.contact_directeur) : ''))
      + '</tbody></table>'

      + '<h4 style="margin-top:12px;color:#006633;">2. Renseignements généraux</h4>'
      + '<table style="width:100%;font-size:12px;"><tbody>'
      + ligne('Classes autorisées / ouvertes', donnees.classes.autorisees + ' / '
        + donnees.classes.ouvertes)
      + ligne('Salles existantes / utilisées', donnees.classes.salles_existantes + ' / '
        + donnees.classes.salles_utilisees)
      + ligne('Cantine', echapper(comp.cantine || '—')
        + (comp.cantine_organisme ? ' — ' + echapper(comp.cantine_organisme) : ''))
      + ligne('Dispositif de lavage des mains', echapper(comp.lavage_mains || '—'))
      + ligne('Gestion collégiale', echapper(comp.gestion_collegiale || '—')
        + ' (APE ' + echapper(comp.ape || '—') + ', AME ' + echapper(comp.ame || '—') + ')')
      + '</tbody></table>'

      + '<h4 style="margin-top:12px;color:#006633;">3. Effectif des apprenants</h4>'
      + tableauCours
      + '<h4 style="margin-top:12px;color:#006633;">4. État nominatif du personnel</h4>'
      + personnel
      + '<p class="petit muet">Enseignants : ' + donnees.personnel.enseignants.H
      + ' hommes, ' + donnees.personnel.enseignants.F + ' femmes. Personnel de soutien : '
      + donnees.personnel.soutien.total + '.</p>'
      + '<h4 style="margin-top:12px;color:#006633;">5. Locaux</h4>' + locaux
      + sectionsRenseignees(cycle, comp)

      + '<table style="width:100%;font-size:12px;margin-top:12px;"><tbody>'
      + ligne('Date de remplissage', comp.date_remplissage
        ? formatDate(comp.date_remplissage)
        : '<span class="muet">à renseigner</span>')
      + ligne('Rempli par', echapper(comp.rempli_par || id.directeur || '—')
        + (comp.fonction ? ', ' + echapper(comp.fonction) : ''))
      + ligne('Contrôlé par le responsable d’unité pédagogique',
        echapper(comp.controle_rup || '—'))
      + ligne('Contrôlé par le conseiller pédagogique de zone',
        echapper(comp.controle_cp || '—'))
      + ligne('Visa du chef de la circonscription', echapper(comp.visa_ccs || '—'))
      + '</tbody></table>'
      + '<p class="mt-15">Fait à ' + echapper(id.commune || 'Pobè') + ', le '
      + (comp.date_remplissage ? formatDate(comp.date_remplissage)
        : new Date().toLocaleDateString('fr-FR')) + '<br>'
      + 'Par ' + echapper(comp.rempli_par || id.directeur || '—')
      + (comp.fonction ? ', ' + echapper(comp.fonction) : '') + '</p>'
      + piedDocument(ecole, 'FICHE-' + type, ecole.id + '-' + anneeActive(), 'Le Directeur')
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button> '
      + '<button class="btn btn-warning" onclick="exporterModule(\'fiches\')">📤 Excel</button>'
      + '</div>');
  }

  /**
   * Les sections du recensement effectivement renseignées. Une rubrique laissée
   * vide ne figure pas au document : mieux vaut une fiche courte qu'une page de
   * pointillés.
   */
  function sectionsRenseignees(cycle, comp) {
    return R().sections(cycle).map(sec => {
      const remplis = sec.champs.filter(c => comp[c.cle] !== undefined && comp[c.cle] !== '');
      if (!remplis.length) return '';
      let corps = remplis.map(c => '<tr><td style="background:#f8fafc;width:52%;">'
        + echapper(c.libelle) + '</td><td>' + echapper(comp[c.cle]) + '</td></tr>').join('');
      /* Le total du budget se calcule, il ne se saisit pas. */
      if (sec.titre.indexOf('financières') >= 0) {
        corps += '<tr style="background:#f1f5f9;"><td><b>Total du budget de l’année en '
          + 'cours</b></td><td><b>' + U(R().totalBudget(comp)) + ' FCFA</b></td></tr>';
      }
      if (sec.titre.indexOf('CEP') >= 0) {
        const lire = k => parseInt(comp[k], 10) || 0;
        const composes = lire('cep_composes_g') + lire('cep_composes_f');
        const admis = lire('cep_admis_g') + lire('cep_admis_f');
        corps += '<tr style="background:#f1f5f9;"><td><b>Taux de réussite</b></td><td><b>'
          + (composes ? Math.round(admis / composes * 1000) / 10 + ' %' : '—')
          + '</b></td></tr>';
      }
      return '<h4 style="margin-top:12px;color:#006633;">' + echapper(sec.titre) + '</h4>'
        + '<table style="width:100%;font-size:12px;"><tbody>' + corps + '</tbody></table>';
    }).join('');
  }

  /** La fiche au format tableur, rubrique par rubrique. */
  function exporterFiches() {
    const ecole = ecoleFiche();
    if (!ecole) { alert('Choisissez d’abord une école.'); return; }
    const donnees = donneesFiche(ecole);
    const comp = complementsDe(ecole.id);
    const id = donnees.identification;
    const lignes = [['Rubrique', 'Valeur']];
    const pousser = (l, v) => lignes.push([l, v === undefined || v === null ? '' : v]);

    lignes.push(['FICHE ' + typeFiche() + ' — ' + anneeActive(), '']);
    pousser('Nom de l’école', id.nom);
    pousser('Code', id.code);
    pousser('Statut', id.statut);
    pousser('Type d’enseignement', id.type);
    pousser('Année de création', id.annee_creation);
    pousser('Département', id.departement);
    pousser('Commune', id.commune);
    pousser('Arrondissement', id.arrondissement);
    pousser('Zone pédagogique', id.zone_ped);
    pousser('Unité pédagogique', id.unite_ped);
    pousser('Village ou quartier', id.village);
    pousser('Téléphone', id.telephone);
    pousser('Adresse mail', id.email);
    pousser('Directeur', id.directeur);
    pousser('Classes autorisées', donnees.classes.autorisees);
    pousser('Classes ouvertes', donnees.classes.ouvertes);
    pousser('Salles existantes', donnees.classes.salles_existantes);
    pousser('Salles utilisées', donnees.classes.salles_utilisees);

    lignes.push(['', '']);
    lignes.push(['EFFECTIF PAR COURS', '']);
    lignes.push(['Cours', 'Garçons', 'Filles', 'Total']);
    donnees.parCours.forEach(c => lignes.push([c.cours, c.G, c.F, c.G + c.F]));
    lignes.push(['Total', donnees.eleves.G, donnees.eleves.F, donnees.eleves.total]);

    lignes.push(['', '']);
    lignes.push(['PERSONNEL ENSEIGNANT', '']);
    lignes.push(['Matricule', 'Nom et prénoms', 'Sexe', 'Naissance', 'Grade', 'Statut',
      'Fonction', 'Cours', 'Indice']);
    donnees.personnel.liste.forEach(a2 => lignes.push([a2.matricule || '', a2.nom || '',
      a2.sexe || '', a2.dateNaissance || '', a2.grade || '', a2.statut || '',
      a2.fonction || '', a2.cours || '', a2.indice || '']));

    R().sections(cycleDe(ecole)).forEach(sec => {
      const remplis = sec.champs.filter(c => comp[c.cle] !== undefined && comp[c.cle] !== '');
      if (!remplis.length) return;
      lignes.push(['', '']);
      lignes.push([sec.titre.toUpperCase(), '']);
      remplis.forEach(c => lignes.push([c.libelle, comp[c.cle]]));
      if (sec.titre.indexOf('financières') >= 0) {
        lignes.push(['Total du budget de l’année en cours', R().totalBudget(comp)]);
      }
    });

    lignes.push(['', '']);
    lignes.push(['REMPLISSAGE ET VISAS', '']);
    R().VALIDATION.concat(R().generales(cycleDe(ecole))).forEach(c => {
      if (comp[c.cle] !== undefined && comp[c.cle] !== '') {
        lignes.push([c.libelle, comp[c.cle]]);
      }
    });

    telecharger('cs-pobe-fiche-' + typeFiche().toLowerCase() + '-'
      + String(ecole.code || ecole.nom).replace(/[^A-Za-z0-9]+/g, '-') + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Certificats ---------------- */

  const CE = () => global.Certificats;

  function agentCertificat() {
    const sel = document.getElementById('certAgent');
    if (!sel || !sel.value) return null;
    return modeleCertificat().source === 'apprenant'
      ? data.apprenants.find(x => x.id == sel.value)
      : data.personnel.find(x => x.id == sel.value);
  }

  /* Le certificat de scolarité porte sur un élève : la liste change de source.
     Elle n'est reconstruite que si la source change, sinon chaque rendu
     effacerait la personne déjà choisie. */
  let sourceListeSujets = null;

  function remplirListeSujets() {
    const sel = document.getElementById('certAgent');
    const surApprenant = modeleCertificat().source === 'apprenant';
    const source = surApprenant ? 'apprenant' : 'agent';
    const attendu = (surApprenant ? data.apprenants : data.personnel).length + 1;
    if (source === sourceListeSujets && sel.options.length === attendu) return;

    const liste = surApprenant ? data.apprenants : data.personnel;
    const nom = x => surApprenant ? nomComplet(x) : x.nom;
    const choisi = sel.value;
    sel.innerHTML = '<option value="">— ' + (surApprenant ? 'Élève' : 'Agent') + ' —</option>'
      + liste.slice().sort((a2, b2) => nom(a2).localeCompare(nom(b2), 'fr'))
        .map(x => '<option value="' + x.id + '">' + echapper(nom(x))
          + (x.matricule ? ' — ' + echapper(x.matricule) : '') + '</option>').join('');
    if (source === sourceListeSujets) sel.value = choisi;
    sourceListeSujets = source;
  }

  function modeleCertificat() {
    const sel = document.getElementById('certModele');
    return CE().modele(sel ? sel.value : '');
  }

  /** Les mentions saisies pour un certificat, conservées par agent et modèle. */
  function mentionsDe(agentId, cle, creer) {
    let m = data.certificats.filter(c => c.agentId == agentId && c.modele === cle)[0];
    if (!m) {
      m = { id: uid(), agentId: agentId, modele: cle };
      if (creer) data.certificats.push(m);
    }
    return m;
  }

  function renderCertificats() {
    const selM = document.getElementById('certModele');
    if (!selM.options.length) {
      selM.innerHTML = CE().MODELES.map(m => '<option value="' + m.cle + '">'
        + echapper(m.titre + (m.signataire === 'ECOLE' ? ' (directeur)' : ' (chef CS)'))
        + '</option>').join('');
    }
    remplirListeSujets();

    const modele = modeleCertificat();
    const agent = agentCertificat();
    const zone = document.getElementById('formulaireCertificat');

    if (!agent) {
      zone.innerHTML = '<div class="alert alert-info">Choisissez un agent.</div>';
      return;
    }
    const mentions = mentionsDe(agent.id, modele.cle);

    zone.innerHTML = '<div class="form-container">'
      + '<h3 style="color:#006633;">' + echapper(modele.titre) + '</h3>'
      + '<p class="muet mb-15">Repris de la fiche de l’agent : ' + echapper(agent.nom)
      + ' · ' + echapper(agent.grade || 'grade non renseigné')
      + ' · matricule ' + echapper(agent.matricule || '—')
      + ' · ' + echapper(nomEcole(agent.ecoleId)) + '</p>'
      + '<div class="form-grid">'
      + modele.champs.map(c => {
        if (CE().TYPES_LONG.indexOf(c) >= 0) {
          return '<div class="form-group" style="grid-column:1/-1;"><label>'
            + echapper(CE().LIBELLES[c] || c) + '</label><textarea rows="2" '
            + 'onchange="majMention(\'' + c + '\', this.value)">'
            + echapper(mentions[c] || '') + '</textarea></div>';
        }
        const type = CE().TYPES_DATE.indexOf(c) >= 0 ? 'date' : 'text';
        return '<div class="form-group"><label>'
          + echapper(CE().LIBELLES[c] || c) + '</label>'
          + '<input type="' + type + '" value="' + echapper(mentions[c] || '')
          + '" onchange="majMention(\'' + c + '\', this.value)"></div>';
      }).join('')
      + '</div>'
      + (modele.evaluation
        ? '<h4 style="margin-top:14px;color:#006633;">Notes du supérieur hiérarchique '
          + 'et du comité de direction</h4>'
          + '<div class="table-scroll"><table><thead><tr><th>Critère</th><th>Barème</th>'
          + '<th>Supérieur hiérarchique</th><th>Comité de direction</th></tr></thead><tbody>'
          + CE().CRITERES.map(cr => '<tr><td>' + echapper(cr.libelle)
            + '<br><span class="petit muet">' + echapper(cr.groupe) + '</span></td>'
            + '<td>' + cr.bareme + '</td>'
            + ['sup', 'com'].map(q => '<td><input type="number" step="0.25" min="0" max="'
              + cr.bareme + '" style="width:76px;" value="'
              + echapper(mentions[q + '_' + cr.cle] || '')
              + '" onchange="majMention(\'' + q + '_' + cr.cle + '\', this.value)"></td>').join('')
            + '</tr>').join('')
          + '</tbody></table></div>'
          + '<div id="totalEvaluation" class="alert alert-info mt-15"></div>'
        : '')
      + '</div>';
    if (modele.evaluation) majTotalEvaluation();
  }

  /** Les deux totaux de la fiche d'évaluation, sur vingt. */
  function totauxEvaluation(mentions) {
    const somme = q => CE().CRITERES.reduce((t, cr) => {
      const v = parseFloat(String(mentions[q + '_' + cr.cle] || '').replace(',', '.'));
      return t + (isNaN(v) ? 0 : Math.min(v, cr.bareme));
    }, 0);
    return { sup: Math.round(somme('sup') * 100) / 100,
      com: Math.round(somme('com') * 100) / 100 };
  }

  function classeDePerformance(note) {
    if (note >= 18) return 'Classe I — Très bonne performance';
    if (note >= 15) return 'Classe II — Bonne performance';
    if (note >= 12) return 'Classe III — Performance moyenne';
    if (note >= 10) return 'Classe IV — Performance passable';
    return 'Classe V — Performance insuffisante';
  }

  function majTotalEvaluation() {
    const zone = document.getElementById('totalEvaluation');
    const agent = agentCertificat();
    if (!zone || !agent) return;
    const t = totauxEvaluation(mentionsDe(agent.id, modeleCertificat().cle));
    zone.innerHTML = 'Supérieur hiérarchique : <b>' + t.sup + '/20</b> — '
      + classeDePerformance(t.sup) + '<br>Comité de direction : <b>' + t.com
      + '/20</b> — ' + classeDePerformance(t.com);
  }

  function majMention(cle, valeur) {
    const agent = agentCertificat();
    if (!agent) return;
    const m = mentionsDe(agent.id, modeleCertificat().cle, true);
    m[cle] = valeur;
    saveData();
    if (modeleCertificat().evaluation) majTotalEvaluation();
  }

  /** Le certificat, au format d'une page A4. */
  function editerCertificat() {
    const agent = agentCertificat();
    if (!agent) { alert('Choisissez d’abord un agent.'); return; }
    const modele = modeleCertificat();
    const mentions = mentionsDe(agent.id, modele.cle);
    const ecole = data.ecoles.find(x => x.id == agent.ecoleId);
    const cs = identiteCS('CCS');
    const numero = (document.getElementById('certNumero').value || '……');
    /* Sans nom de responsable réglé, le certificat le signale plutôt que de
       laisser une ligne de pointillés muette. */
    if (modele.signataire === 'CS' && !cs.responsable) {
      alert('Renseignez le nom du Chef de la Circonscription Scolaire dans '
        + '« Cachets et signatures » : il doit figurer sur le certificat.');
    }

    const jour = d => d ? formatDate(d) : '……………';
    const surApprenant = modele.source === 'apprenant';
    const ecoleSujet = surApprenant
      ? data.ecoles.find(x => x.id == agent.ecoleId) : ecole;
    const donnees = surApprenant ? {
      civilite: String(agent.sexe || '').toUpperCase().charAt(0) === 'F' ? 'l’élève' : 'l’élève',
      nom: nomComplet(agent),
      naissance: jour(agent.dateNaiss),
      lieuNaiss: agent.lieuNaiss || '……………',
      commune: (ecoleSujet && ecoleSujet.commune) || 'Pobè',
      pere: agent.pere || '……………', mere: agent.mere || '……………',
      matricule: agent.matricule || '……', nip: agent.npi || '……',
      cours: agent.cours || '……',
      ecole: ecoleSujet ? ecoleSujet.nom : '……',
      directeur: (ecoleSujet && ecoleSujet.directeur) || '……………',
      aujourdhui: new Date().toLocaleDateString('fr-FR')
    } : {
      civilite: String(agent.sexe || '').toUpperCase().charAt(0) === 'F' ? 'Madame' : 'Monsieur',
      nom: agent.nom || '……',
      naissance: jour(agent.dateNaissance),
      lieuNaiss: agent.lieuNaiss || '……………',
      priseServiceFP: jour(agent.datePriseServiceFP),
      priseServiceEcole: jour(agent.datePriseServiceEcole),
      matricule: agent.matricule || '……',
      nip: agent.npi || agent.nip || '……',
      grade: (agent.corps ? agent.corps + ' ' : '') + (agent.grade || '……'),
      fonction: agent.fonction || '……',
      indice: agent.indice || '……',
      telephone: agent.telephone || '……',
      diplomePro: agent.diplomePro || '……',
      cours: agent.cours || '……',
      ecole: ecole ? ecole.nom : '……',
      directeur: (ecole && ecole.directeur) || '……………',
      signataire: cs.responsable || '……………',
      aujourdhui: new Date().toLocaleDateString('fr-FR')
    };

    /* Les dates saisies doivent paraître en français sur le document : une date
       en 2026-09-01 sur un certificat officiel ne passerait pas. */
    const mentionsAffichees = {};
    Object.keys(mentions).forEach(k => {
      mentionsAffichees[k] = CE().TYPES_DATE.indexOf(k) >= 0 && mentions[k]
        ? formatDate(mentions[k]) : mentions[k];
    });

    const reference = modele.reference
      .replace('{numero}', numero)
      .replace('{ecole}', ecole ? ecole.nom : 'EPP/EM');

    const parEcole = modele.signataire === 'ECOLE';
    const libelleSignature = parEcole ? 'Le Directeur'
      : 'Le Chef de la Circonscription Scolaire';

    openModal(modele.titre + ' — ' + agent.nom,
      '<div class="page-a4">'
      + enteteDocument({ etablissement: parEcole && ecoleSujet ? ecoleSujet.nom : '',
        direction: modele.direction, reference: reference })
      + '<h2 class="titre-a4">' + echapper(modele.titre) + '</h2>'
      + (modele.sousTitre ? '<p class="text-center"><i>' + echapper(modele.sousTitre)
        + '</i></p>' : '')
      + '<div class="corps-a4">'
      + modele.corps(donnees, mentionsAffichees).filter(Boolean)
        .map(l => '<p>' + echapper(l) + '</p>').join('')
      + '<p class="mt-15">En foi de quoi, la présente attestation lui est délivrée pour '
      + 'servir et valoir ce que de droit.</p>'
      + '<p class="mt-15">Fait à Pobè, le ' + donnees.aujourdhui + '.</p>'
      + '</div>'
      + (modele.evaluation ? tableauxEvaluation(mentions) : '')
      + (modele.visas
        ? '<div class="visas"><div class="petit"><b>Visas</b></div>'
          + '<div class="bloc-visas">'
          + modele.visas.map(v => '<div class="visa"><div class="ligne-signature"></div>'
            + '<div class="petit">' + echapper(v) + '</div>'
            + '<div class="petit muet">Nom et prénoms, téléphone</div></div>').join('')
          + '</div></div>' : '')
      + piedDocument(parEcole ? ecoleSujet : null, 'CERT-' + modele.cle,
        agent.id + '-' + modele.cle, libelleSignature, 'CCS')
      + (modele.contreSeing ? blocContreSeing(modele.contreSeing, ecoleSujet) : '')
      + '</div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer ou enregistrer en PDF</button>'
      + '</div>');
  }

  /** Le conseiller pédagogique de la zone d'une école. */
  function cpDeZone(ecole) {
    const zone = ecole && ecole.zone_ped;
    if (!zone) return null;
    return identitesCS().filter(x => x.zone === zone)[0] || null;
  }

  /* Les pièces des agents du programme de pré-insertion sont contresignées par
     le conseiller pédagogique de la zone, non par le chef de circonscription. */
  function blocContreSeing(cible, ecole) {
    let porteur = null, libelle = '';
    if (cible === 'CP_ZONE') {
      porteur = cpDeZone(ecole);
      if (!porteur) {
        return '<div class="contreseing"><div class="petit muet">Zone pédagogique de '
          + 'l’école non renseignée : le conseiller pédagogique ne peut pas être '
          + 'identifié.</div></div>';
      }
      libelle = 'Vu et contresigné — ' + porteur.libelleSignature;
    } else {
      porteur = identiteCS(cible);
      libelle = 'Vu et contresigné — ' + (porteur.libelleSignature || porteur.nom);
    }
    return '<div class="contreseing">'
      + global.Pieces.blocSignature(porteur, libelle)
      + '<div>' + global.Pieces.cachet(porteur, { taille: 92 }) + '</div></div>';
  }

  /** Les deux grilles de notation, telles qu'elles figurent sur la fiche. */
  function tableauxEvaluation(mentions) {
    const t = totauxEvaluation(mentions);
    const grille = (q, titre, total) =>
      '<h4 style="margin-top:12px;color:#006633;">' + titre + '</h4>'
      + '<table style="width:100%;font-size:11.5px;"><thead><tr>'
      + '<th>Critère de performance</th><th>Note</th><th>Barème</th></tr></thead><tbody>'
      + CE().CRITERES.map(cr => '<tr><td>' + echapper(cr.libelle)
        + ' <span class="muet">— ' + echapper(cr.groupe) + '</span></td>'
        + '<td>' + echapper(mentions[q + '_' + cr.cle] || '') + '</td>'
        + '<td>' + cr.bareme + '</td></tr>').join('')
      + '<tr style="background:#f1f5f9;"><td><b>Total</b></td><td><b>' + total
      + '</b></td><td><b>20</b></td></tr>'
      + '<tr><td colspan="3">Classe de performance : <b>'
      + echapper(classeDePerformance(total)) + '</b></td></tr>'
      + '</tbody></table>';

    return (mentions.objectifs ? '<p><b>Rappel des objectifs :</b> '
        + echapper(mentions.objectifs) + '</p>' : '')
      + (mentions.resultats ? '<p><b>Résultats de la période :</b> '
        + echapper(mentions.resultats) + '</p>' : '')
      + (mentions.contraintes ? '<p><b>Contraintes et difficultés :</b> '
        + echapper(mentions.contraintes) + '</p>' : '')
      + grille('sup', 'Note et appréciation du supérieur hiérarchique', t.sup)
      + grille('com', 'Note et appréciation du comité de direction', t.com);
  }

  /* ---------------- Rapports ---------------- */

  function renderRapports() {
    document.getElementById('rapportsTable').innerHTML = data.rapports.map(r =>
      '<tr><td>' + echapper(nomEcole(r.ecoleId)) + '</td><td>' + echapper(r.anneeScolaire || '—')
      + '</td><td>' + formatDate(r.date) + '</td><td>' + echapper(r.auteur || '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-info btn-sm" onclick="viewRapport(\'' + r.id + '\')">👁️</button>'
      + '<button class="btn btn-warning btn-sm" onclick="editRapport(\'' + r.id + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteRapport(\'' + r.id + '\')">🗑️</button>'
      + '</td></tr>').join('')
      || '<tr><td colspan="5" class="text-center">Aucun rapport</td></tr>';
  }

  function openRapportModal(id) {
    const r = id ? data.rapports.find(x => x.id == id) || {} : {};
    const aire = (label, nom, valeur, lignes) => '<div class="form-group mt-15"><label>' + label
      + '</label><textarea name="' + nom + '" rows="' + lignes + '">' + echapper(valeur || '')
      + '</textarea></div>';
    openModal(id ? 'Modifier le rapport' : 'Nouveau rapport de rentrée',
      '<form onsubmit="saveRapport(event, \'' + (id || '') + '\')"><div class="form-grid">'
      + '<div class="form-group"><label>École *</label><select name="ecoleId" required>'
      + '<option value="">—</option>' + optionsEcoles(r.ecoleId) + '</select></div>'
      + champ('Année scolaire', 'anneeScolaire', r.anneeScolaire || anneeActive())
      + '<div class="form-group"><label>Date du rapport</label><input type="date" name="date" '
      + 'value="' + echapper(r.date || new Date().toISOString().slice(0, 10)) + '"></div>'
      + champ('Auteur', 'auteur', r.auteur)
      + champ('Effectif au début', 'effectifDebut', r.effectifDebut || 0, 'number')
      + champ("Nombre d'enseignants", 'nbEnseignants', r.nbEnseignants || 0, 'number')
      + '</div>'
      + aire('Situation générale', 'situation', r.situation, 4)
      + aire('Difficultés rencontrées', 'difficultes', r.difficultes, 3)
      + aire('Suggestions', 'suggestions', r.suggestions, 3)
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }
  function saveRapport(ev, id) {
    ev.preventDefault();
    enregistrer('rapports', Object.fromEntries(new FormData(ev.target)), id, renderRapports);
  }
  function deleteRapport(id) {
    if (!confirm('Supprimer ?')) return;
    data.rapports = data.rapports.filter(x => x.id != id);
    saveData(); renderRapports();
  }
  function viewRapport(id) {
    const r = data.rapports.find(x => x.id == id);
    if (!r) return;
    openModal('Rapport de rentrée',
      '<div style="padding:20px;"><h3>' + echapper(nomEcole(r.ecoleId)) + ' — '
      + echapper(r.anneeScolaire || '') + '</h3>'
      + '<p><b>Auteur :</b> ' + echapper(r.auteur || '—') + ' — <b>Date :</b> ' + formatDate(r.date) + '</p>'
      + '<p><b>Effectif :</b> ' + (r.effectifDebut || 0) + ' élèves — <b>Enseignants :</b> '
      + (r.nbEnseignants || 0) + '</p>'
      + '<h4 style="margin-top:15px;color:#006633;">Situation générale</h4><p>'
      + echapper(r.situation || '—') + '</p>'
      + '<h4 style="margin-top:15px;color:#E8112D;">Difficultés</h4><p>'
      + echapper(r.difficultes || '—') + '</p>'
      + '<h4 style="margin-top:15px;color:#0369a1;">Suggestions</h4><p>'
      + echapper(r.suggestions || '—') + '</p></div>'
      + '<div class="text-center"><button class="btn btn-primary" onclick="window.print()">🖨️ Imprimer</button></div>');
  }

  /* ---------------- Courriers ---------------- */

  function renderCourriers() {
    const ligne = (c, i, type) => '<tr><td>' + echapper(c.numero || (i + 1)) + '</td>'
      + '<td>' + formatDate(c.date) + '</td>'
      + '<td>' + echapper((type === 'arr' ? c.expediteur : c.destinataire) || '—') + '</td>'
      + '<td>' + echapper(c.objet || '—') + '</td><td>' + echapper(c.reference || '—') + '</td>'
      + '<td class="actions">'
      + '<button class="btn btn-warning btn-sm" onclick="editCourrier(\'' + c.id + '\',\'' + type + '\')">✏️</button>'
      + '<button class="btn btn-danger btn-sm" onclick="deleteCourrier(\'' + c.id + '\',\'' + type + '\')">🗑️</button>'
      + '</td></tr>';

    document.getElementById('courriersArrTable').innerHTML =
      data.courriersArr.map((c, i) => ligne(c, i, 'arr')).join('')
      || '<tr><td colspan="6" class="text-center">Aucun courrier arrivé</td></tr>';
    document.getElementById('courriersDepTable').innerHTML =
      data.courriersDep.map((c, i) => ligne(c, i, 'dep')).join('')
      || '<tr><td colspan="6" class="text-center">Aucun courrier départ</td></tr>';
  }

  function openCourrierModal(type, id) {
    type = type || 'arr';
    const liste = type === 'arr' ? data.courriersArr : data.courriersDep;
    const c = id ? liste.find(x => x.id == id) || {} : {};
    const tiers = type === 'arr' ? 'expediteur' : 'destinataire';
    openModal(id ? 'Modifier le courrier' : 'Enregistrer un courrier',
      '<div class="form-group"><label>Type de courrier *</label>'
      + '<select id="courrType"' + (id ? ' disabled' : '') + '>'
      + '<option value="arr"' + (type === 'arr' ? ' selected' : '') + '>Courrier ARRIVÉ (entrant)</option>'
      + '<option value="dep"' + (type === 'dep' ? ' selected' : '') + '>Courrier DÉPART (sortant)</option>'
      + '</select></div>'
      + '<form onsubmit="saveCourrier(event, \'' + (id || '') + '\', \'' + type + '\')">'
      + '<div class="form-grid">'
      + champ('Numéro', 'numero', c.numero)
      + '<div class="form-group"><label>Date *</label><input type="date" name="date" value="'
      + echapper(c.date || new Date().toISOString().slice(0, 10)) + '" required></div>'
      + '<div class="form-group"><label>' + (type === 'arr' ? 'Expéditeur' : 'Destinataire')
      + ' *</label><input name="' + tiers + '" value="'
      + echapper(c.expediteur || c.destinataire || '') + '" required></div>'
      + '<div class="form-group"><label>Objet *</label><input name="objet" value="'
      + echapper(c.objet || '') + '" required></div>'
      + champ('Référence', 'reference', c.reference)
      + selecteur('Nature', 'nature', ['Note de service', 'Circulaire', 'Correspondance',
        'Rapport', 'Autre'], c.nature)
      + '</div>'
      + '<div class="form-group mt-15"><label>Observations et suivi</label>'
      + '<textarea name="observations" rows="3">' + echapper(c.observations || '') + '</textarea></div>'
      + '<div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">💾 Enregistrer</button> '
      + '<button type="button" class="btn btn-danger" onclick="closeModal()">Annuler</button>'
      + '</div></form>');
  }

  function saveCourrier(ev, id, typeOrigine) {
    ev.preventDefault();
    const select = document.getElementById('courrType');
    const type = select ? select.value : typeOrigine;
    const obj = Object.fromEntries(new FormData(ev.target));
    const liste = type === 'arr' ? data.courriersArr : data.courriersDep;

    if (id) {
      /* Changer un courrier de sens revient à le déplacer d'une liste à l'autre. */
      const ancienne = typeOrigine === 'arr' ? data.courriersArr : data.courriersDep;
      const idx = ancienne.findIndex(x => x.id == id);
      if (type === typeOrigine) {
        if (idx >= 0) ancienne[idx] = Object.assign({}, ancienne[idx], obj);
      } else {
        const enregistrement = idx >= 0 ? Object.assign({}, ancienne[idx], obj) : obj;
        if (idx >= 0) ancienne.splice(idx, 1);
        liste.push(enregistrement);
      }
    } else {
      obj.id = uid();
      liste.push(obj);
    }
    saveData();
    closeModal();
    renderCourriers();
  }

  function deleteCourrier(id, type) {
    if (!confirm('Supprimer ?')) return;
    if (type === 'arr') data.courriersArr = data.courriersArr.filter(x => x.id != id);
    else data.courriersDep = data.courriersDep.filter(x => x.id != id);
    saveData(); renderCourriers();
  }

  /* ---------------- Import de classeurs ---------------- */

  let importEnCours = null;

  function preparerImport(modele) {
    const choix = document.getElementById('choixImport');
    /* En mode ÉCOLE, importer la liste des écoles n'a pas de sens : ce poste
       ne connaît que le sien, et ne doit connaître que lui. */
    const cles = Object.keys(global.Import.MODELES)
      .filter(k => !global.Config.estEcole() || k !== 'ecoles');
    choix.innerHTML = cles
      .map(k => '<option value="' + k + '">' + global.Import.MODELES[k].titre + '</option>').join('');
    if (modele) choix.value = modele;
    /* École à laquelle rattacher les lignes d'un fichier sans colonne « École » (listes EDUCMaster d'une école) */
    const defaut = document.getElementById('ecoleImportDefaut');
    if (defaut) {
      const poste = ecoleDuPoste();
      defaut.innerHTML = poste ? '<option value="' + poste.id + '">' + echapper(poste.nom) + '</option>'
        : '<option value="">— Prise dans la colonne « École » du fichier —</option>' + optionsEcoles();
    }
    document.getElementById('resultatImport').innerHTML = '';
    importEnCours = null;
  }

  function lireFichierImport(fichier) {
    const modeleCle = document.getElementById('choixImport').value;
    const modele = global.Import.MODELES[modeleCle];
    const zone = document.getElementById('resultatImport');
    zone.innerHTML = '<p class="alert alert-info">Lecture de « ' + echapper(fichier.name) + ' »…</p>';

    global.Tableur.lire(fichier).then(lignes => {
      if (!lignes || lignes.length < 2) {
        zone.innerHTML = '<p class="alert alert-danger">Le fichier est vide, ou ne contient '
          + "qu'une ligne d'en-tête.</p>";
        return;
      }
      const entetes = lignes[0].map(x => String(x || '').trim());
      const correspondances = global.Import.reconnaitre(entetes, modele);
      importEnCours = { modeleCle, modele, entetes, lignes: lignes.slice(1), correspondances };
      afficherApercu();
    }).catch(err => {
      zone.innerHTML = '<p class="alert alert-danger">Lecture impossible : '
        + echapper(err.message) + '</p>';
    });
  }

  function afficherApercu() {
    const { modele, entetes, lignes, correspondances } = importEnCours;
    const reconnues = correspondances.filter(Boolean).length;
    const zone = document.getElementById('resultatImport');

    const choixChamps = i => '<select onchange="majCorrespondance(' + i + ', this.value)">'
      + '<option value="">— Ignorer cette colonne —</option>'
      + modele.champs.map(c => '<option value="' + c.n + '"'
        + (correspondances[i] === c.n ? ' selected' : '') + '>' + echapper(c.l) + '</option>').join('')
      + '</select>';

    const apercu = lignes.slice(0, 8);
    zone.innerHTML =
      '<div class="alert ' + (reconnues ? 'alert-success' : 'alert-warning') + ' mt-15">'
      + lignes.length + ' ligne(s) lue(s) · ' + reconnues + ' colonne(s) sur ' + entetes.length
      + ' reconnue(s). Vérifiez les correspondances ci-dessous avant d\'enregistrer.</div>'
      + '<div class="correspondances">' + entetes.map((t, i) =>
        '<div class="correspondance' + (correspondances[i] ? ' reconnue' : '') + '">'
        + '<b>' + echapper(t || 'Colonne ' + (i + 1)) + '</b>' + choixChamps(i) + '</div>').join('')
      + '</div>'
      + '<h4 class="mt-15">Aperçu des ' + apercu.length + ' premières lignes</h4>'
      + '<div class="apercu-import"><table><thead><tr>'
      + entetes.map(t => '<th>' + echapper(t) + '</th>').join('') + '</tr></thead><tbody>'
      + apercu.map(l => '<tr>' + entetes.map((_, i) =>
        '<td>' + echapper(l[i] || '') + '</td>').join('') + '</tr>').join('')
      + '</tbody></table></div>'
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-primary" onclick="validerImport()">✅ Enregistrer ces données</button> '
      + '<button class="btn btn-danger" onclick="preparerImport()">Annuler</button></div>';
  }

  function majCorrespondance(index, valeur) {
    if (!importEnCours) return;
    importEnCours.correspondances[index] = valeur || null;
    afficherApercu();
  }

  /** Retrouve une école par son nom, avec tolérance sur la casse et les accents. */
  function trouverEcole(nom) {
    if (!nom) return null;
    const cible = global.Import.normaliser(nom);
    let trouvee = data.ecoles.find(e => global.Import.normaliser(e.nom) === cible);
    if (!trouvee) trouvee = data.ecoles.find(e => global.Import.normaliser(e.code) === cible);
    if (!trouvee) {
      const proches = data.ecoles.filter(e =>
        global.Import.normaliser(e.nom).indexOf(cible) >= 0
        || cible.indexOf(global.Import.normaliser(e.nom)) >= 0);
      if (proches.length === 1) trouvee = proches[0];
    }
    return trouvee || null;
  }

  /* Les intitulés qui désignent le bureau de la circonscription elle-même,
     et non une école : c'est à ça qu'on reconnaît un agent du bureau dans un
     état où sa colonne « école » porte en réalité son poste, du type
     « DAF/CS Pobè » ou « DS/CS Pobè ». Un nom d'école simplement absent du
     référentiel — une coquille, une école pas encore ajoutée — ne contient
     aucune de ces mentions. */
  const MOTIF_BUREAU = /\bcs pobe\b|\bcirconscription\b|\bbureau\b|\bddemp\b/;

  function texteDesigneLeBureau(texte) {
    return !texte || MOTIF_BUREAU.test(global.Import.normaliser(texte));
  }

  function validerImport() {
    if (!importEnCours) return;
    const { modeleCle, modele, lignes, correspondances } = importEnCours;
    const parNom = {};
    modele.champs.forEach(c => { parNom[c.n] = c; });

    let crees = 0, majs = 0, ignorees = 0, sansEcole = 0;
    /* Certains modèles écrivent dans une collection au nom différent. */
    const collection = data[modele.collection || modeleCle];

    lignes.forEach(ligne => {
      const obj = {};
      correspondances.forEach((cle, i) => {
        if (!cle) return;
        const v = global.Import.convertir(ligne[i], parNom[cle]);
        if (v !== '') obj[cle] = v;
      });
      if (Object.keys(obj).length === 0) { ignorees++; return; }

      /* Les états du personnel séparent le nom des prénoms : on les réunit,
         car l'application n'en tient qu'un seul champ pour un agent. Les
         apprenants, eux, gardent les deux colonnes : EDUCMaster les attend
         séparées. */
      if (modeleCle === 'personnel' && obj.prenoms) {
        obj.nom = [obj.nom, obj.prenoms].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
        delete obj.prenoms;
      }
      /* Le nom d'épouse reste dans sa propre rubrique : le coller au nom
         exposait à recopier n'importe quelle colonne mal reconnue. */

      /* Un agent ACDPCTD ou de statut Éducateur (deux statuts distincts)
         relève de la catégorie Éducateur, distincte des Enseignants : sans
         catégorie explicite dans le fichier, c'est le statut qui la
         détermine. */
      if (modeleCle === 'personnel' && !obj.categorie
        && (global.Carriere.estStatutACDPCTD(obj.statut)
          || global.Carriere.statutDe({ statut: obj.statut }) === 'EDUCATEUR')) {
        obj.categorie = 'Éducateur';
      }

      /* Les relevés d'évaluation reçoivent la période affichée à l'écran. */
      if (modeleCle === 'evaluations') {
        const periode = periodeCourante();
        obj.type = periode.type;
        obj.numero = periode.numero;
        obj.mois = periode.mois;
        obj.annee = anneeActive();
      }

      /* Les candidats de l'examen blanc rejoignent le centre affiché ; leur
         école de provenance est retrouvée quand elle est reconnue, sinon le
         nom écrit reste tel quel sur le procès-verbal. */
      if (modeleCle === 'examen') {
        const centre = centreCourant();
        obj.centreId = centre ? centre.id : null;
        if (obj.ecoleNom) {
          const ecole = trouverEcole(obj.ecoleNom);
          if (ecole) obj.ecoleId = ecole.id;
        }
      }

      /* Rattachement à une école, quand le modèle l'exige. */
      if (modele.ecole) {
        const idDefaut = (document.getElementById('ecoleImportDefaut') || {}).value;
        const ecole = trouverEcole(obj.ecoleNom) || (!obj.ecoleNom || modeleCle === 'cep' || modeleCle === 'cni'
          ? (data.ecoles.find(x => x.id == idDefaut) || ecoleDuPoste()) : null);
        if (ecole) {
          obj.ecoleId = ecole.id;
          delete obj.ecoleNom;
        } else if (modeleCle === 'personnel' && obj.nom && global.Config.estEcole()) {
          /* En mode ÉCOLE, un agent qui n'appartient pas à l'établissement du
             poste — personnel d'une autre école ou du bureau de la
             circonscription — n'a rien à faire dans les données locales : il
             est ignoré plutôt que rattaché par défaut. */
          sansEcole++; return;
        } else if (modeleCle === 'personnel' && obj.nom) {
          const texteEcole = obj.ecoleNom || '';
          if (texteDesigneLeBureau(texteEcole)) {
            /* Les agents en poste au bureau de la circonscription n'ont pas
               d'école : ils sont rangés dans le personnel administratif, avec
               leur poste conservé, au lieu d'être écartés. */
            obj.categorie = obj.categorie || 'Administratif';
            obj.poste = texteEcole;
          } else {
            /* Une école simplement introuvable dans le référentiel ne fait
               pas de l'agent un employé de bureau : sa catégorie d'origine
               (enseignant, par défaut) est conservée, et le nom reçu reste
               visible dans « poste » en attendant d'être rattaché à la main. */
            obj.poste = texteEcole;
          }
          delete obj.ecoleNom;
          sansEcole++;
        } else { sansEcole++; return; }
      }

      /* Un enregistrement déjà présent est complété, pas dupliqué. Pour les
         écoles, le nom fait foi même si le code n'est pas encore renseigné :
         deux établissements ne portent pas le même nom, alors qu'un code
         manquant ferait dupliquer l'école à chaque réimport. */
      const existant = collection.find(x => (modeleCle !== 'examen'
        || x.centreId == obj.centreId) && modele.cle.every(k => {
        const cleObjet = k === 'ecoleNom' ? 'ecoleId' : k;
        const a = global.Import.normaliser(x[cleObjet]);
        const b = global.Import.normaliser(obj[cleObjet]);
        if (modeleCle === 'ecoles' && k === 'code' && (!a || !b)) return true;
        if (k === 'prenoms' && !a && !b) return true; // listes sans colonne Prénoms
        if (k === 'nom' && (modeleCle === 'cep' || modeleCle === 'cni') && x.matricule && obj.matricule) {
          return global.Import.normaliser(x.matricule) === global.Import.normaliser(obj.matricule);
        }
        return a && b && a === b;
      }));

      if (existant) { Object.assign(existant, obj); majs++; }
      else { obj.id = uid(); collection.push(obj); crees++; }
    });

    /* Les effectifs par cours font foi : quand ils sont renseignés, ils
       recalculent les totaux par sexe, puis le total général. */
    if (modeleCle === 'effectifs') {
      collection.forEach(e => {
        let g = 0, f = 0, detaille = false;
        CLASSES.forEach(c => {
          const cg = parseInt(e['c_' + c.toLowerCase() + '_G'], 10);
          const cf = parseInt(e['c_' + c.toLowerCase() + '_F'], 10);
          if (!isNaN(cg)) { g += cg; detaille = true; }
          if (!isNaN(cf)) { f += cf; detaille = true; }
        });
        if (detaille) { e.totalG = g; e.totalF = f; }
        e.total = (parseInt(e.totalG, 10) || 0) + (parseInt(e.totalF, 10) || 0);
      });
    }

    saveData();
    document.getElementById('resultatImport').innerHTML =
      '<div class="alert alert-success mt-15"><b>Import terminé.</b><br>'
      + crees + ' enregistrement(s) créé(s), ' + majs + ' mis à jour, '
      + ignorees + ' ligne(s) vide(s) ignorée(s).'
      + (sansEcole ? '<br><b>' + sansEcole + ' ligne(s) sans école reconnue</b> : '
        + (modeleCle === 'personnel'
          ? 'rangée(s) dans le personnel administratif, avec leur poste conservé.'
          : 'écartée(s), le nom de l’école n’ayant pas été retrouvé.') : '')
      + '</div>';
    importEnCours = null;
    renderDashboard();
  }

  /* ---------------- Téléchargement des modules ---------------- */

  /* Les colonnes exportées, module par module. Les identifiants internes sont
     remplacés par le nom de l'école : un fichier doit rester lisible seul. */
  const EXPORTS = {
    ecoles: { nom: 'ecoles', colonnes: [
      ['code', "Code de l'école"], ['nom', "Nom de l'école"], ['type', 'Type'],
      ['statut', 'Statut'], ['typeEns', "Type d'enseignement"],
      ['departement', 'Département'], ['commune', 'Commune'],
      ['arrondissement', 'Arrondissement'], ['zone_ped', 'Zone pédagogique'],
      ['unite_ped', 'Unité pédagogique'], ['village', 'Village ou quartier'],
      ['annee_creation', 'Année de création'],
      ['classes_autorisees', 'Classes autorisées'], ['classes_existantes', 'Classes existantes'],
      ['salles_existantes', 'Salles existantes'], ['salles_utilisees', 'Salles utilisées'],
      ['directeur', 'Directeur'], ['contact_directeur', 'Contact du directeur'],
      ['telephone', 'Téléphone'], ['email', 'Adresse mail']] },
    personnel: { nom: 'personnel-enseignant', collection: 'personnel',
      filtre: p => (p.categorie || 'Enseignant') === 'Enseignant', colonnes: colonnesAgent() },
    administratif: { nom: 'personnel-administratif', collection: 'personnel',
      filtre: p => p.categorie === 'Administratif', colonnes: colonnesAgent() },
    soutien: { nom: 'personnel-soutien', collection: 'personnel',
      filtre: p => p.categorie === 'Soutien', colonnes: colonnesAgent() },
    educateur: { nom: 'personnel-educateur', collection: 'personnel',
      filtre: p => p.categorie === 'Éducateur', colonnes: colonnesAgent() },
    effectifs: { nom: 'effectifs', colonnes: [['_ecole', 'École'], ['annee', 'Année scolaire']]
      .concat(['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'].reduce((acc, c) => acc.concat(
        [['c_' + c.toLowerCase() + '_G', c + ' G'], ['c_' + c.toLowerCase() + '_F', c + ' F']]), []))
      .concat([['totalG', 'Total garçons'], ['totalF', 'Total filles'], ['total', 'Total'],
        ['handicapes', 'Dont handicapés'], ['redoublants', 'Redoublants'],
        ['sansActe', 'Sans acte de naissance']]) },
    infrastructures: { nom: 'infrastructures', colonnes: [
      ['_ecole', 'École'], ['typeLocal', 'Type de local'], ['anneeService', 'Année mise en service'],
      ['superficie', 'Superficie'], ['natureMurs', 'Nature des murs'],
      ['natureToit', 'Nature du toit'], ['etat', 'État'], ['financeur', 'Financeur']] },
    mobilier: { nom: 'mobilier', colonnes: [
      ['_ecole', 'École'], ['categorie', 'Catégorie'], ['designation', 'Désignation'],
      ['quantite', 'Quantité'], ['etat', 'État'], ['classe', 'Classe concernée']] },
    /* Mêmes rubriques que le modèle d'importation « Candidats au CEP (liste EDUCMaster ou Excel) » :
       le fichier téléchargé se réimporte tel quel, et les identifiants (matricule EDUCMaster, NPI) restent du texte. */
    cep: { nom: 'candidats-cep', colonnes: [
      ['_rang', 'N°'], ['matricule', 'Matricule / N° EDUCMaster'], ['npi', 'NPI'], ['numTable', 'N° de table'],
      ['nom', 'Nom'], ['prenoms', 'Prénoms'], ['sexe', 'Sexe'], ['dateNaiss', 'Date de naissance'],
      ['lieuNaiss', 'Lieu de naissance'], ['numActe', "N° d'acte de naissance"], ['pere', 'Nom du père'],
      ['mere', 'Nom de la mère'], ['parent_signataire', 'Parent signataire'], ['telParent', 'Téléphone du parent'],
      ['residence', 'Résidence des parents'], ['_ecole', 'École'], ['option', 'Option'], ['session', 'Session'],
      ['centre', "Centre d'examen"]] }
  };

  function colonnesAgent() {
    return [
      ['matricule', 'Matricule'], ['nom', 'Nom et prénoms'], ['sexe', 'Sexe'],
      ['dateNaissance', 'Date de naissance'], ['lieuNaiss', 'Lieu de naissance'],
      ['categorie', 'Catégorie'], ['grade', 'Grade'], ['statut', 'Statut'],
      ['fonction', 'Fonction'], ['qualite', 'Qualité'], ['cours', 'Cours tenu'],
      ['_ecole', 'École'], ['diplomeAca', 'Diplôme académique'],
      ['diplomePro', 'Diplôme professionnel'], ['indice', 'Indice actuel'],
      ['indicePaye', 'Indice payé'],
      ['datePriseServiceFP', 'Première prise de service'],
      ['datePriseServiceDept', 'Prise de service département'],
      ['datePriseServiceEcole', "Prise de service école"],
      ['_ancFP', 'Ancienneté fonction publique'], ['_ancDept', 'Ancienneté département'],
      ['_ancEcole', 'Ancienneté école']
    ].concat(global.Carriere.ANNEES_NOTES.map(a2 => ['note' + a2, 'Note ' + a2]))
      .concat([['_moyenneNotes', 'Moyenne des notes'], ['_retraite', 'Date de retraite'],
        ['telephone', 'Téléphone'], ['ph', 'Personne handicapée']]);
  }

  /** Valeurs calculées, reconnaissables à leur préfixe. */
  function valeurExport(ligne, cle) {
    if (cle.charAt(0) !== '_') return ligne[cle];
    if (cle === '_rang') return ligne.__rang || '';
    const anc = global.Carriere.anciennetes(ligne, anneeReference());
    switch (cle) {
      case '_ecole': return nomEcole(ligne.ecoleId);
      case '_ancFP': return anc.fonctionPublique;
      case '_ancDept': return anc.departement;
      case '_ancEcole': return anc.ecole;
      case '_moyenneNotes': return global.Carriere.moyenneNotes(ligne);
      case '_retraite': {
        const d = global.Carriere.dateRetraite(ligne.dateNaissance, ligne.grade, ligne.statut);
        return d ? d.toISOString().slice(0, 10) : '';
      }
      default: return '';
    }
  }

  function champCSV(v) {
    const t = String(v === null || v === undefined ? '' : v);
    return /[;"\n\r]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t;
  }

  /* Les boutons « Excel » produisaient des fichiers CSV : sur un téléphone ils s'ouvraient vides ou en une seule
     colonne, et ne passaient pas à l'importation. Ils donnent maintenant un vrai classeur .xlsx : rubriques en gras,
     identifiants en texte ; chaque tableau qui suit une ligne vide et un titre va sur sa propre feuille. */
  function classeurDepuisCSV(nom, contenu) {
    const lignes = global.XlsxEcrire.lireCSV(contenu), feuilles = [];
    const base = nom.replace(/\.csv$/i, '').replace(/^cs-pobe-/, '').replace(/-?\d{4}-\d{4}$/, '');
    let cur = { nom: base === 'educmaster' ? 'Apprenants' : (base.charAt(0).toUpperCase() + base.slice(1)).replace(/-/g, ' '), lignes: [] };
    for (let i = 0; i < lignes.length; i++) {
      const l = lignes[i], prec = lignes[i - 1], suiv = lignes[i + 1];
      const titre = l.length && l.filter(x => x !== '').length === 1 && prec && !prec.length && suiv && suiv.filter(x => x !== '').length >= 2;
      if (titre && cur.lignes.length) {
        while (cur.lignes.length && !cur.lignes[cur.lignes.length - 1].length) cur.lignes.pop();
        feuilles.push(cur); cur = { nom: String(l.find(x => x !== '')).slice(0, 31), lignes: [] };
        if (base !== 'educmaster') cur.lignes.push(l);
        continue;
      }
      cur.lignes.push(l);
    }
    feuilles.push(cur);
    return global.XlsxEcrire.classeur(feuilles);
  }

  function telecharger(nom, contenu, type) {
    if (!type && /\.csv$/i.test(nom) && global.XlsxEcrire) {
      nom = nom.replace(/\.csv$/i, '.xlsx');
      contenu = classeurDepuisCSV(nom.replace(/\.xlsx$/i, '.csv'), contenu);
    }
    const blob = contenu instanceof Blob ? contenu : new Blob(['\ufeff' + contenu], { type: type || 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = nom;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function exporterModule(cle) {
    if (cle === 'analyses') return exporterAnalyses();
    if (cle === 'cm2') return exporterCM2();
    if (cle === 'examen') return exporterExamen();
    if (cle === 'evaluations') return exporterEvaluations();
    if (cle === 'apprenants') return exporterApprenants();
    if (cle === 'notes') return exporterNotes();
    if (cle === 'carriere') return exporterCarrieres();
    if (cle === 'fiches') return exporterFiches();
    if (cle === 'visites') return exporterVisites();
    if (cle === 'classes') return exporterClasses();
    if (cle === 'collegiale') return exporterCollegiale();
    if (cle === 'repertoires') return exporterRepertoires();
    const modele = EXPORTS[cle];
    if (!modele) return;
    let lignes = data[modele.collection || cle] || [];
    if (modele.filtre) lignes = lignes.filter(modele.filtre);
    if (!lignes.length) { alert('Rien à télécharger dans ce module.'); return; }

    lignes = lignes.map((l, i) => Object.assign({}, l, { __rang: i + 1 }));
    const contenu = [modele.colonnes.map(c => champCSV(c[1])).join(';')]
      .concat(lignes.map(l => modele.colonnes.map(c => champCSV(valeurExport(l, c[0]))).join(';')))
      .join('\r\n');
    telecharger('cs-pobe-' + modele.nom + '-' + anneeActive() + '.csv', contenu);
  }

  /** Les carrières de tous les agents, une ligne par agent. */
  function exporterCarrieres() {
    const C = global.Carriere;
    if (!data.personnel.length) { alert('Aucun agent enregistré.'); return; }
    const lignes = [['Matricule', 'Nom et prénoms', 'Sexe', 'Date de naissance',
      'Catégorie', 'Grade', 'Statut', 'Fonction', 'Indice actuel', 'Indice payé',
      'École', 'Situation', 'Première prise de service', 'Prise de service département',
      'Prise de service école', 'Ancienneté FP', 'Ancienneté département',
      'Ancienneté école']
      .concat(C.ANNEES_NOTES.map(a2 => 'Note ' + a2))
      .concat(['Moyenne des notes', 'Départ à la retraite', 'Avancements',
        'Écoles précédentes'])];

    data.personnel.forEach(p => {
      const anc = C.anciennetes(p, anneeReference());
      const dr = C.dateRetraite(p.dateNaissance, p.grade, p.statut);
      lignes.push([p.matricule || '', p.nom || '', p.sexe || '', p.dateNaissance || '',
        p.categorie || 'Enseignant', p.grade || '', p.statut || '', p.fonction || '',
        p.indice || '', p.indicePaye || '', nomEcole(p.ecoleId),
        C.situationDe(p).libelle, p.datePriseServiceFP || '', p.datePriseServiceDept || '',
        p.datePriseServiceEcole || '',
        anc.fonctionPublique === null ? '' : anc.fonctionPublique,
        anc.departement === null ? '' : anc.departement,
        anc.ecole === null ? '' : anc.ecole]
        .concat(C.ANNEES_NOTES.map(a2 => p['note' + a2] || ''))
        .concat([C.moyenneNotes(p) === null ? '' : C.moyenneNotes(p),
          dr ? dr.toISOString().slice(0, 10) : '',
          (p.avancements || []).map(a2 => a2.grade + ' le ' + a2.date).join(' | '),
          (p.historique || []).map(h => h.ecoleNom + ' jusqu’au ' + h.jusquau).join(' | ')]));
    });

    telecharger('cs-pobe-carrieres-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  function exporterNotes() {
    const lignes = resultatsClasse();
    if (!lignes.length) { alert('Choisissez une école et un cours ayant des apprenants.'); return; }
    const periode = periodeNotes();
    const sortie = [['Rang', 'Nom et prénoms', 'Sexe']
      .concat(V().MATIERES.map(m => m.libelle))
      .concat(['Total', 'Moyenne', 'Maîtrises', 'Matières composées', 'Seuil exigé',
        'Seuil atteint'])];
    lignes.sort((a2, b2) => (a2.rang || 9999) - (b2.rang || 9999)).forEach(x => {
      sortie.push([x.rang || '', nomComplet(x.apprenant), x.apprenant.sexe || '']
        .concat(x.notes.map(n => n === null ? '' : n))
        .concat([x.aCompose ? x.total : '', x.moyenne === null ? '' : x.moyenne,
          x.aCompose ? x.maitrises : '', x.composees, x.requis,
          !x.aCompose ? 'non composé' : (x.admis ? 'oui' : 'non')]));
    });
    telecharger('cs-pobe-notes-' + clePeriodeNotes().toLowerCase() + '.csv',
      sortie.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  function exporterApprenants() {
    const liste = data.apprenants;
    if (!liste.length) { alert('Aucun apprenant à télécharger.'); return; }
    const colonnes = [['nom', 'Nom'], ['prenoms', 'Prénoms'], ['sexe', 'Sexe'],
      ['dateNaiss', 'Date de naissance'], ['lieuNaiss', 'Lieu de naissance'],
      ['numActe', "N° d'acte"], ['npi', 'NPI'], ['matricule', 'Matricule'],
      ['_ecole', 'École'], ['cours', 'Cours'], ['redoublant', 'Redoublant'],
      ['pere', 'Nom du père'], ['mere', 'Nom de la mère'], ['telParent', 'Téléphone du parent']];
    const lignes = [colonnes.map(c => c[1])].concat(liste.map(a2 =>
      colonnes.map(c => c[0] === '_ecole' ? nomEcole(a2.ecoleId) : (a2[c[0]] || ''))));
    telecharger('cs-pobe-apprenants-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /** Les relevés de la période affichée, puis les synthèses par cours et école. */
  function exporterEvaluations() {
    const periode = periodeCourante();
    const releves = data.evaluations.filter(e => e.annee === anneeActive()
      && e.type === periode.type && String(e.numero) === String(periode.numero));
    if (!releves.length) { alert('Aucun relevé pour cette période.'); return; }

    const lignes = [['École', 'Unité pédagogique', 'Cours', 'Période',
      'Inscrits G', 'Inscrits F', 'Inscrits', 'Ont composé G', 'Ont composé F', 'Ont composé',
      'Ont atteint le seuil G', 'Ont atteint le seuil F', 'Ont atteint le seuil',
      'Taux G (%)', 'Taux F (%)', 'Taux (%)', 'Appréciation']];
    releves.forEach(e => {
      const b = V().bilan(e);
      const ecole = data.ecoles.find(x => x.id == e.ecoleId) || {};
      lignes.push([ecole.nom || '', ecole.unite_ped || '', e.cours,
        V().libellePeriode(periode),
        b.g.inscrits, b.f.inscrits, b.total.inscrits,
        b.g.composes, b.f.composes, b.total.composes,
        b.g.admis, b.f.admis, b.total.admis,
        b.g.taux === null ? '' : b.g.taux, b.f.taux === null ? '' : b.f.taux,
        b.total.taux === null ? '' : b.total.taux, V().appreciation(b.total.taux)]);
    });

    const bloc = (titre, entrees) => {
      lignes.push([]);
      lignes.push([titre]);
      lignes.push(['Ensemble', 'Inscrits', 'Ont composé', 'Ont atteint le seuil',
        'Taux (%)', 'Appréciation']);
      entrees.forEach(([libelle, sous]) => {
        const b = cumuler(sous);
        lignes.push([libelle, b.total.inscrits, b.total.composes, b.total.admis,
          b.total.taux === null ? '' : b.total.taux, V().appreciation(b.total.taux)]);
      });
    };

    bloc('SYNTHÈSE PAR COURS', V().COURS.filter(c => releves.some(e => e.cours === c))
      .map(c => [c, releves.filter(e => e.cours === c)]));

    const parUP = {};
    releves.forEach(e => {
      const ecole = data.ecoles.find(x => x.id == e.ecoleId) || {};
      const up = ecole.unite_ped || '(unité non renseignée)';
      (parUP[up] = parUP[up] || []).push(e);
    });
    bloc('SYNTHÈSE PAR UNITÉ PÉDAGOGIQUE',
      Object.keys(parUP).sort().map(up => [up, parUP[up]]));
    bloc('ENSEMBLE DE LA CIRCONSCRIPTION', [['Circonscription', releves]]);

    telecharger('cs-pobe-evaluation-' + clePeriode(periode).toLowerCase() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /** Le relevé du centre affiché, puis la synthèse de tous les centres. */
  function exporterExamen() {
    const c = centreCourant();
    const b = E().bilan(candidatsDe(c.id));
    const lignes = [['Rang', 'Nom et prénoms', 'Sexe', 'École de provenance']
      .concat(E().MATIERES.map(m => m.libelle))
      .concat(['Total', 'Moyenne', 'Nombre de maîtrises', 'Seuil atteint'])];

    b.classes.slice().sort((a, d) => (a.rang || 9999) - (d.rang || 9999)).forEach(x => {
      lignes.push([x.rang || '', x.candidat.nom, x.candidat.sexe || '',
        x.candidat.ecoleNom || nomEcole(x.candidat.ecoleId)]
        .concat(x.notes.map(n => n === null ? '' : n))
        .concat([x.aCompose ? x.total : '', x.moyenne === null ? '' : x.moyenne,
          x.aCompose ? x.maitrises : '', !x.aCompose ? 'absent' : (x.admis ? 'oui' : 'non')]));
    });

    lignes.push([]);
    lignes.push(['SYNTHÈSE DES CENTRES — ' + anneeActive()]);
    lignes.push(['Centre', 'Inscrits G', 'Inscrits F', 'Inscrits', 'Ont composé',
      'Ont atteint le seuil', 'Taux G (%)', 'Taux F (%)', 'Taux (%)', 'Moyenne', 'Écart type']);
    centres().forEach(ce => {
      const bb = E().bilan(candidatsDe(ce.id));
      lignes.push([ce.nom, bb.g.inscrits, bb.f.inscrits, bb.inscrits, bb.composes, bb.admis,
        bb.g.taux === null ? '' : bb.g.taux, bb.f.taux === null ? '' : bb.f.taux,
        bb.taux === null ? '' : bb.taux,
        bb.moyenneCentre === null ? '' : bb.moyenneCentre, bb.ecartTypeMoyennes]);
    });

    telecharger('cs-pobe-examen-blanc-' + c.nom.replace(/[^A-Za-z0-9]+/g, '-') + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /** Les écoles à CM2, leurs candidats, puis la synthèse public / privé. */
  function exporterCM2() {
    const toutes = lignesCM2();
    const lignes = [['École', 'Secteur', 'Arrondissement', 'Zone pédagogique',
      'CM2 G', 'CM2 F', 'CM2 total', 'Candidats G', 'Candidats F', 'Candidats total',
      'Taux de présentation (%)', 'Décrochage']];
    toutes.forEach(l => lignes.push([l.ecole.nom,
      l.ecole.type === 'EPP' ? 'Public' : 'Privé', l.ecole.arrondissement || '',
      l.ecole.zone_ped || '', l.g, l.f, l.total,
      l.saisi ? l.cg : '', l.saisi ? l.cf : '', l.saisi ? l.candidats : '',
      l.taux === null ? '' : l.taux, l.saisi ? l.total - l.candidats : '']));

    lignes.push([]);
    lignes.push(['SYNTHÈSE — CEP session de ' + SESSION_CEP]);
    lignes.push(['Ensemble', 'Écoles à CM2', 'CM2 G', 'CM2 F', 'CM2 total',
      'Candidats G', 'Candidats F', 'Candidats total', 'Taux (%)', 'Décrochage']);
    [['EPP', 'Primaire public'], ['EPPRIV', 'Primaire privé'],
      [null, 'Ensemble de la circonscription']].forEach(([type, libelle]) => {
      const sous = toutes.filter(l => !type || l.ecole.type === type);
      const dits = sous.filter(l => l.saisi);
      const base = dits.reduce((s2, l) => s2 + l.total, 0);
      const cand = dits.reduce((s2, l) => s2 + l.candidats, 0);
      lignes.push([libelle, sous.length,
        sous.reduce((s2, l) => s2 + l.g, 0), sous.reduce((s2, l) => s2 + l.f, 0),
        sous.reduce((s2, l) => s2 + l.total, 0),
        dits.reduce((s2, l) => s2 + l.cg, 0), dits.reduce((s2, l) => s2 + l.cf, 0),
        cand, base ? Math.round(cand / base * 1000) / 10 : '', base ? base - cand : '']);
    });

    telecharger('cs-pobe-cep-' + SESSION_CEP.replace(' ', '-') + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /** La feuille d'analyses réunit les trois tableaux d'écarts. */
  function exporterAnalyses() {
    const C = global.Carriere;
    const eff = effectifsParEcole();
    const parEcole = {};
    data.personnel.forEach(p => { (parEcole[p.ecoleId] = parEcole[p.ecoleId] || []).push(p); });

    const lignes = [['École', 'Arrondissement', 'Zone pédagogique', 'Unité pédagogique',
      'Garçons', 'Filles', 'Total', 'Écart F-G', 'Part des filles (%)',
      'Classes autorisées', 'Classes ouvertes', 'Écart classes', 'Situation classes',
      'Enseignants', 'Enseignants requis', 'Écart enseignants', 'Situation effectif']];

    data.ecoles.forEach(e => {
      const g = eff[e.id] ? eff[e.id].g : 0;
      const f = eff[e.id] ? eff[e.id].f : 0;
      const genre = C.ecartGenre(g, f);
      const cl = C.ecartClasses(e);
      const bes = C.besoinEnseignants(e, parEcole[e.id] || []);
      lignes.push([e.nom, e.arrondissement || '', e.zone_ped || '', e.unite_ped || '',
        genre.g, genre.f, genre.total, genre.ecart,
        genre.partFilles === null ? '' : genre.partFilles,
        cl.autorisees, cl.ouvertes, cl.ecart, cl.etat,
        bes.enseignants, bes.requis, bes.ecart, bes.etat]);
    });

    /* La synthèse par cycle et par secteur ferme le fichier : c'est elle que
       la circonscription transmet, le détail par école reste au-dessus. */
    const ventilation = C.ventiler(data.ecoles, e => {
      const cl = C.ecartClasses(e);
      const bes = C.besoinEnseignants(e, parEcole[e.id] || []);
      return {
        autorisees: cl.autorisees, ouvertes: cl.ouvertes,
        salles: Number(e.salles_utilisees) || 0,
        garcons: eff[e.id] ? eff[e.id].g : 0,
        filles: eff[e.id] ? eff[e.id].f : 0,
        enseignants: bes.enseignants, requis: bes.renseignee ? bes.requis : 0
      };
    });
    /* Répartition par âge, par cours et par sexe. */
    const grilleAges = {};
    AGES.forEach(age => {
      grilleAges[age] = {};
      CLASSES.forEach(c => { grilleAges[age][c] = { G: 0, F: 0 }; });
    });
    data.effectifs.filter(e => !e.annee || e.annee === anneeActive()).forEach(e => {
      if (!e.ages) return;
      AGES.forEach(age => CLASSES.forEach(c => ['G', 'F'].forEach(sx => {
        grilleAges[age][c][sx] += parseInt(e.ages[age + '_' + c + '_' + sx], 10) || 0;
      })));
    });
    const utiles = AGES.filter(age => CLASSES.some(c =>
      grilleAges[age][c].G + grilleAges[age][c].F > 0));
    if (utiles.length) {
      lignes.push([]);
      lignes.push(['RÉPARTITION PAR ÂGE, PAR COURS ET PAR SEXE — ' + anneeActive()]);
      lignes.push(['Âge'].concat(CLASSES.reduce((acc, c) =>
        acc.concat([c + ' G', c + ' F']), [])).concat(['Ensemble G', 'Ensemble F', 'Total']));
      utiles.forEach(age => {
        const g = CLASSES.reduce((s2, c) => s2 + grilleAges[age][c].G, 0);
        const f = CLASSES.reduce((s2, c) => s2 + grilleAges[age][c].F, 0);
        lignes.push([age].concat(CLASSES.reduce((acc, c) =>
          acc.concat([grilleAges[age][c].G, grilleAges[age][c].F]), [])).concat([g, f, g + f]));
      });
    }

    /* Personnel par statut et par rôle, pour le primaire puis la maternelle. */
    [['EP', 'ÉCOLES PRIMAIRES', ['EPP', 'EPPRIV']],
     ['EM', 'ÉCOLES MATERNELLES', ['EM', 'EMPRIV']],
     ['CS', 'ENSEMBLE DE LA CIRCONSCRIPTION', null]].forEach(([, titre, types]) => {
      const ecolesBloc = types
        ? data.ecoles.filter(e => types.indexOf(e.type) >= 0) : data.ecoles;
      const ids = {};
      ecolesBloc.forEach(e => { ids[e.id] = true; });
      const agentsBloc = types ? data.personnel.filter(p => ids[p.ecoleId]) : data.personnel;
      const vent = C.ventilerPersonnel(agentsBloc, ecolesBloc);
      if (!vent.length) return;
      lignes.push([]);
      lignes.push(['PERSONNEL PAR STATUT — ' + titre]);
      lignes.push(['Statut et rôle', 'Hommes', 'Femmes', 'Total', 'Part de femmes (%)',
        'Écoles concernées', 'Écart type par école']);
      vent.forEach(l => lignes.push([l.libelle, l.H, l.F, l.total,
        l.partFemmes === null ? '' : l.partFemmes, l.ecoles, l.ecartType]));
      const actifsBloc = agentsBloc.filter(C.estActif);
      const h = actifsBloc.filter(p => C.sexeDe(p) === 'H').length;
      const fe = actifsBloc.filter(p => C.sexeDe(p) === 'F').length;
      lignes.push(['Total', h, fe, h + fe,
        (h + fe) ? Math.round(fe / (h + fe) * 1000) / 10 : '', '', '']);
    });

    lignes.push([]);
    lignes.push(['SYNTHÈSE DE LA CIRCONSCRIPTION — ' + anneeActive()]);
    lignes.push(['Ensemble', 'Écoles', 'Classes autorisées', 'Classes ouvertes', 'Écart',
      'Salles utilisées', 'Garçons', 'Filles', 'Total élèves', 'Enseignants', 'Requis', 'Écart']);
    ['EPP', 'EPPRIV', 'Primaire', 'EM', 'EMPRIV', 'Maternelle', 'TOTAL'].forEach(cle => {
      const l = ventilation[cle];
      lignes.push([l.libelle, l.ecoles, l.autorisees, l.ouvertes, l.ouvertes - l.autorisees,
        l.salles, l.garcons, l.filles, l.garcons + l.filles,
        l.enseignants, l.requis, l.enseignants - l.requis]);
    });

    telecharger('cs-pobe-analyses-' + anneeActive() + '.csv',
      lignes.map(l => l.map(champCSV).join(';')).join('\r\n'));
  }

  /* ---------------- Sauvegarde ---------------- */

  function majEtatStockage() {
    const total = COLLECTIONS.reduce((s, c) => s + data[c].length, 0);
    let taille = 0;
    taille = global.Stockage ? global.Stockage.taille : 0;
    const zone = document.getElementById('etatStockage');
    zone.textContent = total + ' enregistrement(s) au total, soit environ '
      + Math.round(taille / 1024) + ' Ko' + (global.Stockage ? ' (' + global.Stockage.moteur + ')' : '') + ' dans ce navigateur.';
    if (global.Stockage) global.Stockage.estimation().then(est => {
      if (est && est.quota) zone.textContent += ' Espace disponible sur l’appareil : environ '
        + Math.round((est.quota - (est.usage || 0)) / 1048576) + ' Mo.';
    });
  }

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (global.Config.estEcole() ? 'ecole_pobe_' : 'cs_pobe_') + new Date().toISOString().slice(0, 10) + '.json';
    try { localStorage.setItem('derniereSauvegarde:' + CLE_STOCKAGE, new Date().toISOString()); } catch (e) { /* rien */ }
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  function importSauvegarde(e) {
    const fichier = e.target.files[0];
    if (!fichier) return;
    const lecteur = new FileReader();
    lecteur.onload = ev => {
      try {
        const importe = JSON.parse(ev.target.result);
        const inconnues = COLLECTIONS.filter(c => !Array.isArray(importe[c]));
        if (inconnues.length === COLLECTIONS.length) {
          alert('Ce fichier ne ressemble pas à une sauvegarde de cette application.');
          return;
        }
        if (!confirm('Remplacer toutes les données actuelles par cette sauvegarde ?')) return;
        COLLECTIONS.forEach(c => { data[c] = Array.isArray(importe[c]) ? importe[c] : []; });
        /* Une sauvegarde restaurée par erreur ne doit jamais faire entrer les
           autres écoles ou le personnel de la circonscription sur un poste
           d'école : l'isolation s'applique aussi après une restauration. */
        if (global.Config.estEcole()) isolerDonneesEcole(false);
        saveData();
        alert('Import réussi.');
        showPage('dashboard', document.querySelector('.menu-item'));
      } catch (err) {
        alert('Erreur : fichier illisible.');
      }
    };
    lecteur.readAsText(fichier);
    e.target.value = '';
  }

  function resetData() {
    if (!confirm('⚠️ Toutes les données seront supprimées. Continuer ?')) return;
    if (!confirm('Êtes-vous vraiment sûr ? Exportez d\'abord vos données si besoin.')) return;
    localStorage.removeItem(CLE_STOCKAGE);
    (global.Stockage ? global.Stockage.effacer() : Promise.resolve()).then(() => location.reload());
  }

  /* ---------------- Démarrage ---------------- */

  /* ---------------- Mode école ---------------- */

  /** L'école du poste, en mode ÉCOLE : une seule, nommée par le directeur. */
  function ecoleDuPoste() {
    if (!global.Config.estEcole()) return null;
    return data.ecoles.filter(e => e.posteLocal)[0] || null;
  }

  /**
   * Purge défensive du mode ÉCOLE : ni les autres écoles, ni le personnel du
   * bureau de la circonscription, ni aucune donnée rattachée à une autre
   * école ne doivent subsister sur ce poste — que ce soit par une donnée
   * héritée d'avant cette isolation, ou par une sauvegarde restaurée par
   * erreur. Appelée au démarrage, après le choix de l'école du poste, et
   * après toute restauration de sauvegarde.
   */
  function isolerDonneesEcole(sauvegarderSiModifie) {
    if (!global.Config.estEcole()) return false;
    const avant = JSON.stringify(data);
    const poste = data.ecoles.filter(e => e.posteLocal)[0] || null;
    const posteId = poste ? poste.id : null;

    data.ecoles = poste ? data.ecoles.filter(e => e.id === posteId) : [];
    /* Le personnel du bureau de la circonscription n'a pas d'école : c'est
       justement ce qui le distingue du personnel de l'établissement, et ce
       qui le fait écarter ici. */
    data.personnel = posteId ? data.personnel.filter(p => p.ecoleId === posteId) : [];
    COLLECTIONS.forEach(c => {
      if (c === 'ecoles' || c === 'personnel' || !Array.isArray(data[c])) return;
      data[c] = data[c].filter(x => !x || typeof x !== 'object' || !('ecoleId' in x)
        || !x.ecoleId || x.ecoleId === posteId);
    });
    /* Les cachets des responsables de la circonscription restent nécessaires
       (armoiries, sceau communs à tous les documents), mais leurs signatures
       personnelles, elles, n'ont rien à faire sur le poste d'une école. */
    if (Array.isArray(data.identite)) {
      data.identite.forEach(x => { if (x && x.signature_image) delete x.signature_image; });
    }

    const modifie = JSON.stringify(data) !== avant;
    if (modifie && sauvegarderSiModifie) saveData();
    return modifie;
  }

  /**
   * Première ouverture en mode école : le directeur retrouve son
   * établissement dans la liste des écoles de la circonscription — ce qui
   * complète au passage arrondissement, code, année de création… — ou, s'il
   * préfère (établissement non listé, ou nom qu'il souhaite lui-même
   * inscrire), saisit directement le nom. Dans les deux cas, la main reste
   * la sienne : aucune autre donnée de la circonscription (les autres
   * écoles, le personnel de bureau) n'entre jamais ici.
   */
  function choisirEcoleDuPoste() {
    openModal('Bienvenue — quelle est votre école ?',
      '<p class="mb-15">Cette application est celle de votre seul établissement. '
      + 'Retrouvez-le dans la liste des écoles de la circonscription, ou inscrivez '
      + 'directement son nom : aucune autre école ni aucune donnée de la circonscription '
      + 'ne figurera jamais ici.</p>'
      + '<form onsubmit="fixerEcoleDuPoste(event)">'
      + '<div class="form-group"><label>Mon école, dans la liste de la circonscription</label>'
      + '<select name="ecoleRef" onchange="choisirEcoleReferentiel(this)">'
      + '<option value="">— Choisir dans la liste (facultatif) —</option>'
      + optionsEcolesReferentiel() + '</select></div>'
      + '<div class="form-grid">'
      + '<div class="form-group"><label>Nom de l’établissement *</label>'
      + '<input name="nouveauNom" id="champNomEcoleRef" placeholder="EPP …" required autofocus></div>'
      + selecteur('Type', 'type', [['EPP', 'Primaire publique'], ['EPPRIV', 'Primaire privée'],
        ['EM', 'Maternelle publique'], ['EMPRIV', 'Maternelle privée']], 'EPP')
      + '</div><div class="text-center mt-15">'
      + '<button type="submit" class="btn btn-primary">Continuer</button></div></form>');
  }

  function fixerEcoleDuPoste(ev) {
    ev.preventDefault();
    const obj = Object.fromEntries(new FormData(ev.target));
    const nom = (obj.nouveauNom || '').trim();
    if (!nom) {
      alert('Inscrivez le nom de votre école.');
      return;
    }
    const ecole = {
      id: uid(), nom: nom, type: obj.type || 'EPP',
      statut: String(obj.type).indexOf('PRIV') >= 0 ? 'Privé Laïc' : 'Public',
      commune: 'POBE', departement: 'PLATEAU', typeEns: 'Classique',
      classes_autorisees: 6, classes_existantes: 6, posteLocal: true
    };
    /* École retrouvée dans le référentiel : on reprend ses renseignements de
       base (arrondissement, code, année de création…), toujours modifiables
       ensuite depuis « Modifier ma fiche école ». */
    if (obj.ecoleRef) {
      const ref = referentielEcoles().find(r => r.code === obj.ecoleRef);
      if (ref) {
        ['code', 'arrondissement', 'annee_creation', 'classes_autorisees',
          'classes_existantes', 'zone_ped'].forEach(champ => {
          if (ref[champ]) ecole[champ] = ref[champ];
        });
      }
    }
    data.ecoles.push(ecole);

    /* Les autres écoles n'ont rien à faire sur le poste d'un établissement,
       mais ce qui les concerne n'est pas détruit pour autant : seules les
       fiches d'écoles disparaissent. */
    data.ecoles = data.ecoles.filter(e => e.id === ecole.id);
    isolerDonneesEcole(false);
    /* v2.3 : l'école retrouvée dans les fichiers de la CS reçoit sa zone, son UP, ses effectifs et son personnel par statut */
    if (UPO) UPO.migrer(true);
    saveData();
    closeModal();
    appliquerMode();
    showPage('dashboard', document.querySelector('.menu-item'));
  }

  /** Adapte le titre et le menu au mode du poste. */
  function appliquerMode() {
    const modele = global.Config.TITRES[global.Config.MODE]
      || global.Config.TITRES.CIRCONSCRIPTION;
    const ecole = ecoleDuPoste();
    document.getElementById('titreApplication').textContent =
      modele.titre.replace('{ecole}', ecole ? ecole.nom : 'Mon école');
    document.getElementById('sousTitreApplication').textContent = modele.sousTitre;

    /* La page « Écoles » est masquée en mode ÉCOLE : ce bouton reste le seul
       moyen de corriger la fiche de l'établissement une fois configuré. */
    const btnEcole = document.getElementById('btnEcolePoste');
    if (btnEcole) btnEcole.classList.toggle('hidden', !global.Config.estEcole());
    const btnChanger = document.getElementById('btnChangerEcole');
    if (btnChanger) btnChanger.classList.toggle('hidden', !global.Config.estEcole());

    document.querySelectorAll('.menu-item').forEach(item => {
      if (!global.Config.pageVisible(item.dataset.page)) item.remove();
    });
    document.querySelectorAll('.sidebar h3').forEach(titre => {
      /* Un intitulé de section sans aucune entrée en dessous n'a plus lieu d'être. */
      let suivant = titre.nextElementSibling, garni = false;
      while (suivant && !/^H3$/.test(suivant.tagName)) {
        if (suivant.classList.contains('menu-item')) garni = true;
        suivant = suivant.nextElementSibling;
      }
      if (!garni) titre.remove();
    });
  }

  function demarrer() {
    document.getElementById('currentDate').textContent =
      new Date().toLocaleDateString('fr-FR',
        { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    document.querySelectorAll('.menu-item').forEach(item => {
      item.addEventListener('click', () => showPage(item.dataset.page, item));
    });
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab));
    });

    /* Les filtres se déclenchent à la saisie, sans attribut dans le HTML. */
    const brancher = (id, evenement, action) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener(evenement, action);
    };
    brancher('searchEcole', 'input', renderEcoles);
    brancher('filterType', 'change', renderEcoles);
    brancher('filterArrond', 'change', renderEcoles);
    brancher('searchPersonnel', 'input', renderPersonnel);
    brancher('filterEcolePers', 'change', renderPersonnel);
    brancher('filterGrade', 'change', renderPersonnel);
    brancher('filterSituation', 'change', renderPersonnel);
    brancher('searchCarriere', 'input', renderCarriere);
    brancher('filterZoneVisite', 'change', renderVisites);
    brancher('filterTypeVisite', 'change', renderVisites);
    brancher('searchVisite', 'input', renderVisites);
    brancher('ficheEcole', 'change', renderFiches);
    brancher('ficheType', 'change', renderFiches);
    brancher('certModele', 'change', renderCertificats);
    brancher('certAgent', 'change', renderCertificats);
    brancher('filterEcoleCarriere', 'change', renderCarriere);
    brancher('filterEcoleEff', 'change', renderEffectifs);
    brancher('searchCep', 'input', renderCep);
    brancher('searchCm2', 'input', renderCM2);
    brancher('filterSecteurAge', 'change', renderAges);
    brancher('filterCyclePersonnel', 'change', renderPersonnelStatut);
    brancher('filterCategoriePersonnel', 'change', renderPersonnelStatut);
    brancher('searchIdentite', 'input', renderIdentite);
    brancher('searchCandidat', 'input', renderExamen);
    brancher('filterCentre', 'change', renderExamen);
    brancher('filterPeriode', 'change', renderEval);
    brancher('filterCoursEval', 'change', renderEval);
    brancher('searchEval', 'input', renderEval);
    brancher('classesEcole', 'change', renderClassesAttrib);
    brancher('collegialeEcole', 'change', renderCollegiale);
    brancher('collegialeInstance', 'change', renderCollegiale);
    brancher('filterSecteurRep', 'change', renderDirecteurs);
    brancher('searchDirecteur', 'input', renderDirecteurs);
    brancher('filterEcoleApp', 'change', renderApprenants);
    brancher('filterCoursApp', 'change', renderApprenants);
    brancher('searchApprenant', 'input', renderApprenants);
    brancher('notesEcole', 'change', renderNotes);
    brancher('notesCours', 'change', renderNotes);
    brancher('notesPeriode', 'change', renderNotes);
    brancher('filterSecteurCm2', 'change', renderCM2);
    brancher('filterZone', 'change', renderEcoles);
    brancher('filterUP', 'change', renderEcoles);
    brancher('searchAdmin', 'input', () => renderCategorie('Administratif'));
    brancher('searchSoutien', 'input', () => renderCategorie('Soutien'));

    /* Les filtres pédagogiques se remplissent à partir des écoles enregistrées. */
    const zones = document.getElementById('filterZone');
    if (zones) {
      zones.innerHTML = '<option value="">Toutes zones pédagogiques</option>'
        + global.Donnees.ZONES.map(z => '<option>' + z + '</option>').join('');
    }
    const ups = document.getElementById('filterUP');
    if (ups) {
      ups.innerHTML = '<option value="">Toutes unités pédagogiques</option>'
        + unitesConnues().map(u => '<option>' + echapper(u) + '</option>').join('');
    }

    /* Sélecteur d'année scolaire de l'en-tête. */
    const selectAnnee = document.getElementById('anneeActive');
    selectAnnee.innerHTML = data.annees.map(a2 => '<option value="' + echapper(a2.id) + '"'
      + (a2.active ? ' selected' : '') + '>' + echapper(a2.libelle) + '</option>').join('');
    selectAnnee.addEventListener('change', () => {
      activerAnnee(selectAnnee.value);
      const active = document.querySelector('.menu-item.active');
      if (active) showPage(active.dataset.page, active);
    });

    document.querySelectorAll('[data-export]').forEach(b2 => {
      b2.addEventListener('click', () => exporterModule(b2.dataset.export));
    });
    brancher('importFile', 'change', importSauvegarde);

    /* Boutons « Importer » présents sur plusieurs pages. */
    document.querySelectorAll('[data-import]').forEach(b => {
      b.addEventListener('click', () => {
        const menu = document.querySelector('.menu-item[data-page="importation"]');
        showPage('importation', menu);
        preparerImport(b.dataset.import);
      });
    });

    const zone = document.getElementById('zoneDepot');
    const fichier = document.getElementById('fichierImport');
    zone.addEventListener('click', () => fichier.click());
    fichier.addEventListener('change', () => {
      if (fichier.files[0]) lireFichierImport(fichier.files[0]);
      fichier.value = '';
    });
    ['dragenter', 'dragover'].forEach(e => zone.addEventListener(e, ev => {
      ev.preventDefault(); zone.classList.add('survol');
    }));
    ['dragleave', 'drop'].forEach(e => zone.addEventListener(e, ev => {
      ev.preventDefault(); zone.classList.remove('survol');
    }));
    zone.addEventListener('drop', ev => {
      const f = ev.dataTransfer.files[0];
      if (f) lireFichierImport(f);
    });

    document.getElementById('modal').addEventListener('click', ev => {
      if (ev.target.id === 'modal') closeModal();
    });

    appliquerMode();
    if (global.Config.estEcole() && !ecoleDuPoste()) {
      choisirEcoleDuPoste();
    }
    renderDashboard();
  }

  /* Passerelle pour les modules ajoutés (bilans, documents de référence). */
  global.AppBridge = {
    get data() { return data; }, saveData, echapper, openModal, closeModal, anneeActive, formatDate, uid,
    COLLECTIONS, exportData, showPage, nomEcole, ecoleDuPoste, porteurEcole, CLE_STOCKAGE,
    enteteDocument, emblemes, attributionDe, nomComplet, feuilleDe, clePeriode, telecharger
  };

  /* Ce que le HTML appelle directement. */
  Object.assign(global, {
    showPage, closeModal, calcTotalEff, fixerEcoleDuPoste,
    openEcoleModal, saveEcole, viewEcole, deleteEcole, editerEcoleDuPoste,
    changerNomEcoleDuPoste, saveNomEcoleDuPoste, choisirEcoleReferentiel,
    editEcole: openEcoleModal,
    openPersonnelModal, savePersonnel, deletePersonnel,
    changerSituation, majChampsSituation, saveSituation,
    renderFiches, majComplement, editerFiche,
    renderCertificats, majMention, editerCertificat, majTotalEvaluation,
    renderVisites, openVisiteModal, saveVisite, supprimerVisite, editerRapportVisite,
    majEnseignantsVisite, majChampsVisite,
    renderCarriere, ouvrirCarriere, ajouterAvancement, saveAvancement, editerFicheCarriere,
    editPersonnel: openPersonnelModal,
    genererActeRetraite,
    openEffectifModal, saveEffectif, deleteEffectif, editEffectif: openEffectifModal,
    openInfraModal, saveInfra, deleteInfra, editInfra: openInfraModal,
    openMobilierModal, saveMobilier, deleteMobilier, editMobilier: openMobilierModal,
    openEvalModal, saveEval, deleteEval, editEval: openEvalModal,
    renderEval, majApercuEval, editerPVEvaluation,
    renderClassesAttrib, majAttribution, renderCollegiale, openMembreModal,
    saveMembre, supprimerMembre, renderMaFiche,
    renderUASCEP, openMembreUASCEPModal, saveMembreUASCEP, supprimerMembreUASCEP, exporterUASCEP,
    renderRepertoires, modifierDirecteur, saveDirecteur, modifierCP, saveCP,
    modifierUP, saveUP, supprimerUP, renderUP, renderRubriquesEcoles, ecoleNeFonctionnePlus, remettreEnActivite, reinitialiserUP, reinitialiserToutesUP, rattacherEcoleUP, saveRattachement,
    reinitialiserEffectifs, reinitialiserTousEffectifs, reinitialiserEcole, modifierComite, saveComite, supprimerComite,
    ajouterAuRepertoire,
    renderApprenants, openApprenantModal, saveApprenant, supprimerApprenant,
    chargerPhoto, inscrireAuCEP, editerListeClasse, exporterEducmaster,
    renderNotes, majNote, editerBulletin, editerReleveClasse,
    openCepModal, saveCep, deleteCep, editCep: openCepModal, printFicheCEP,
    openCniModal, saveCni, deleteCni, editCni: openCniModal, printCNI, printDemandeCNI, signerCNI,
    signerCEP, carteCandidat, signerCarteCEP, plancheCartes, plancheEcole,
    openRapportModal, saveRapport, deleteRapport, editRapport: openRapportModal, viewRapport,
    openCourrierModal, saveCourrier, deleteCourrier,
    editCourrier: (id, type) => openCourrierModal(type, id),
    preparerImport, majCorrespondance, validerImport, exporterModule,
    renderCM2, majCandidats, renderAges, renderPersonnelStatut,
    renderExamen, openCentreModal, saveCentre, openCandidatModal, saveCandidat,
    supprimerCandidat, editerPV,
    renderIdentite, reglerCachet, apercuCachetCS, signerAgent, effacerSignatureAgent, chargerEmbleme, retirerEmbleme, majApercuCachet, saveCachet, signer, apercuPiece,
    openModal,
    renderCategorie, majApercuAgent, verifierCategoriesAdministratif,
    openAnneeModal, saveAnnee, activerAnnee, supprimerAnnee, reporterEffectifsAnneePrecedente,
    reporterAttributionsAnneePrecedente,
    openJourFerieModal, saveJourFerie, deleteJourFerie,
    renderPresenceApprenantsJour, enregistrerPresenceApprenants, renderBilanPresenceApprenants,
    renderPresencePersonnelJour, basculerAbsencePersonnel, enregistrerPresencePersonnel,
    renderBilanPresencePersonnel, imprimerRegistrePresence,
    exportData, resetData
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', demarrer);
  } else {
    demarrer();
  }
})(window);
