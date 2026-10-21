/* CS Pobè — calculs de carrière et d'écarts.
   Tout ce qui se déduit d'une date ou d'un effectif vit ici : anciennetés,
   retraite, écarts entre effectifs, besoins en enseignants. */
(function (global) {
  'use strict';

  const ANNEES_NOTES = [2022, 2023, 2024, 2025, 2026];

  /* La situation d'un agent vis-à-vis de son école et de la circonscription.
     Seul un agent en poste occupe une classe : les autres ne doivent plus
     compter dans les effectifs ni dans le calcul des besoins. */
  const SITUATIONS = [
    { cle: 'EN_POSTE', libelle: 'En poste', ton: 'success', actif: true },
    { cle: 'AFFECTE', libelle: 'Affecté dans une autre école', ton: 'info', actif: true },
    { cle: 'MUTE', libelle: 'Muté hors circonscription', ton: 'warning', actif: false },
    { cle: 'DETACHE', libelle: 'Détaché ou en disponibilité', ton: 'warning', actif: false },
    { cle: 'RETRAITE', libelle: 'Admis à la retraite', ton: 'info', actif: false },
    { cle: 'DECEDE', libelle: 'Décédé', ton: 'danger', actif: false }
  ];

  function situationDe(agent) {
    const cle = (agent && agent.situation) || 'EN_POSTE';
    return SITUATIONS.filter(s => s.cle === cle)[0] || SITUATIONS[0];
  }

  /** Un agent compte-t-il encore dans les effectifs de la circonscription ? */
  function estActif(agent) {
    return situationDe(agent).actif;
  }

  /* ---------------- Retraite ---------------- */

  /* Un agent ACDPCTD ne suit pas l'âge légal de départ de la fonction
     publique : sa retraite propre est 58 ans pour les grades C et D, et
     60 ans pour les grades A et B. Les fonctionnaires (FE, ACDPE, etc.)
     restent sur 55/58/60 ans. AME est l'ancienne appellation des agents
     ACDPCTD : les deux désignent le même agent, jamais deux statuts
     distincts, d'où le test explicit sur « AME » ci-dessous. */
  function estStatutACDPCTD(statut) {
    const brut = String(statut || '').toUpperCase().replace(/[^A-Z]/g, '');
    return brut.indexOf('ACDPCTD') === 0 || brut === 'AME';
  }

  /* Sans grade, l'âge de départ n'est pas déterminé : l'agent n'a pas encore de
     date de retraite, et il ne faut pas en inventer une. */
  function ageRetraite(grade, statut) {
    if (!grade) return null;
    const g = String(grade).toUpperCase().charAt(0);
    if (estStatutACDPCTD(statut)) {
      if (g === 'A' || g === 'B') return 60;
      if (['C', 'D', 'E'].indexOf(g) >= 0) return 58;
      return null;
    }
    if (g === 'A') return 60;
    if (g === 'B') return 58;
    if (['C', 'D', 'E'].indexOf(g) >= 0) return 55;
    return null;
  }

  /* Condition d'ACCÈS au grade, distincte de l'âge de départ à la retraite
     ci-dessus : un agent ACDPCTD (AME) ne peut bénéficier des grades A et B
     qu'à partir de 40 ans, et des grades C et D qu'à partir de 35 ans. Ne
     s'applique pas aux fonctionnaires, qui n'ont pas cette condition d'âge
     pour leur grade. */
  function ageMinimalGrade(grade, statut) {
    if (!grade || !estStatutACDPCTD(statut)) return null;
    const g = String(grade).toUpperCase().charAt(0);
    if (g === 'A' || g === 'B') return 40;
    if (['C', 'D', 'E'].indexOf(g) >= 0) return 35;
    return null;
  }

  /**
   * Le départ prend effet le premier jour du trimestre qui SUIT l'anniversaire :
   *   né de janvier à mars    → 1er avril
   *   né d'avril à juin       → 1er juillet
   *   né de juillet à septembre → 1er octobre
   *   né d'octobre à décembre → 1er janvier de l'année suivante
   */
  function dateRetraite(dateNaissance, grade, statut) {
    const age = ageRetraite(grade, statut);
    if (!dateNaissance || age === null) return null;
    const dn = new Date(dateNaissance);
    if (isNaN(dn.getTime())) return null;
    const annee = dn.getFullYear() + age;
    const trimestre = Math.floor(dn.getMonth() / 3);      // 0 à 3
    if (trimestre === 3) return new Date(annee + 1, 0, 1);
    return new Date(annee, (trimestre + 1) * 3, 1);
  }

  /* ---------------- Ancienneté ---------------- */

  /* L'ancienneté se compte jusqu'au 31 décembre de l'année en cours : c'est la
     règle administrative, et elle évite qu'un agent change d'ancienneté d'un
     jour à l'autre. */
  function anciennete(dateDebut, anneeReference) {
    if (!dateDebut) return null;
    const d = new Date(dateDebut);
    if (isNaN(d.getTime())) return null;
    const fin = new Date((anneeReference || new Date().getFullYear()), 11, 31);
    if (d > fin) return 0;
    let ans = fin.getFullYear() - d.getFullYear();
    const anniversaire = new Date(fin.getFullYear(), d.getMonth(), d.getDate());
    if (anniversaire > fin) ans--;
    return Math.max(0, ans);
  }

  /** Les trois anciennetés d'un agent, en années révolues. */
  function anciennetes(agent, anneeReference) {
    return {
      fonctionPublique: anciennete(agent.datePriseServiceFP, anneeReference),
      departement: anciennete(agent.datePriseServiceDept, anneeReference),
      ecole: anciennete(agent.datePriseServiceEcole, anneeReference)
    };
  }

  /** Moyenne des notes d'évaluation renseignées. */
  function moyenneNotes(agent) {
    const notes = ANNEES_NOTES
      .map(a => parseFloat(String(agent['note' + a] || '').replace(',', '.')))
      .filter(n => !isNaN(n));
    if (!notes.length) return null;
    return Math.round(notes.reduce((s, n) => s + n, 0) / notes.length * 100) / 100;
  }

  /* ---------------- Écarts et besoins ---------------- */

  function ecartType(valeurs) {
    const v = valeurs.filter(x => typeof x === 'number' && !isNaN(x));
    if (v.length < 2) return 0;
    const m = v.reduce((s, x) => s + x, 0) / v.length;
    return Math.round(Math.sqrt(v.reduce((s, x) => s + (x - m) * (x - m), 0) / v.length) * 100) / 100;
  }

  /**
   * Besoin ou surplus d'enseignants d'une école.
   * La référence est le nombre de classes ouvertes : une classe, un maître.
   * Le directeur est compté à part : il ne tient pas de classe dans une école
   * à six classes ou plus.
   */
  function besoinEnseignants(ecole, agents) {
    const classes = Number(ecole.classes_existantes) || 0;
    /* Un agent muté, décédé ou retraité ne tient plus de classe : le compter
       masquerait un poste vacant. */
    const presents = agents.filter(estActif);
    const enseignants = presents.filter(a => (a.categorie || 'Enseignant') === 'Enseignant').length;
    const directeurDecharge = classes >= 6
      && presents.some(a => String(a.fonction || '').toLowerCase().indexOf('direct') === 0);
    const requis = classes + (directeurDecharge ? 1 : 0);
    const ecart = enseignants - requis;
    /* Une école dont aucun agent n'est encore enregistré n'est pas en déficit :
       elle est simplement non renseignée. Les confondre gonflerait le déficit
       de la circonscription d'un chiffre qui ne veut rien dire. */
    const renseignee = presents.length > 0;
    return {
      classes, enseignants, requis, ecart, renseignee,
      etat: !renseignee ? 'Personnel non saisi'
        : (ecart < 0 ? 'Déficit' : (ecart > 0 ? 'Surplus' : 'Équilibre')),
      directeurDecharge
    };
  }

  /** Écart entre classes autorisées et classes ouvertes. */
  function ecartClasses(ecole) {
    const autorisees = Number(ecole.classes_autorisees) || 0;
    const ouvertes = Number(ecole.classes_existantes) || 0;
    return {
      autorisees, ouvertes, ecart: ouvertes - autorisees,
      etat: ouvertes > autorisees ? 'Dépassement'
        : (ouvertes < autorisees ? 'Sous-ouverture' : 'Conforme')
    };
  }

  /** Écart entre garçons et filles, en effectif et en points de pourcentage. */
  function ecartGenre(garcons, filles) {
    const g = Number(garcons) || 0, f = Number(filles) || 0, total = g + f;
    if (!total) return { g, f, total, ecart: 0, partFilles: null, ecartPoints: null };
    const partFilles = Math.round(f / total * 1000) / 10;
    return {
      g, f, total, ecart: f - g, partFilles,
      ecartPoints: Math.round((partFilles - 50) * 10) / 10
    };
  }

  /* ---------------- Répartition par cycle et par statut ---------------- */

  /* Le type de l'école porte les deux informations à la fois : EPP et EPPRIV
     sont du primaire, EM et EMPRIV de la maternelle ; le suffixe PRIV marque
     le privé. Les compter ensemble n'aurait pas de sens : une classe autorisée
     de maternelle privée ne se compare pas à une classe de primaire public. */
  const GROUPES = [
    { cle: 'EPP', libelle: 'Primaire public', cycle: 'Primaire', secteur: 'Public' },
    { cle: 'EPPRIV', libelle: 'Primaire privé', cycle: 'Primaire', secteur: 'Privé' },
    { cle: 'EM', libelle: 'Maternelle publique', cycle: 'Maternelle', secteur: 'Public' },
    { cle: 'EMPRIV', libelle: 'Maternelle privée', cycle: 'Maternelle', secteur: 'Privé' }
  ];

  function groupeDe(ecole) {
    return GROUPES.filter(g => g.cle === ecole.type)[0] || null;
  }

  /**
   * Ventile les écoles par groupe, puis par cycle, puis en ensemble.
   * `mesure` reçoit une école et renvoie l'objet à cumuler.
   */
  function ventiler(ecoles, mesure) {
    const vide = () => ({ ecoles: 0, autorisees: 0, ouvertes: 0, salles: 0,
      garcons: 0, filles: 0, enseignants: 0, requis: 0 });
    const lignes = {};
    GROUPES.forEach(g => { lignes[g.cle] = Object.assign({ libelle: g.libelle }, vide()); });
    lignes.Primaire = Object.assign({ libelle: 'Ensemble du primaire' }, vide());
    lignes.Maternelle = Object.assign({ libelle: 'Ensemble de la maternelle' }, vide());
    lignes.TOTAL = Object.assign({ libelle: 'Circonscription' }, vide());

    ecoles.forEach(e => {
      const g = groupeDe(e);
      if (!g) return;
      const m = mesure(e);
      [lignes[g.cle], lignes[g.cycle], lignes.TOTAL].forEach(cible => {
        cible.ecoles += 1;
        Object.keys(m).forEach(k => { cible[k] += Number(m[k]) || 0; });
      });
    });
    return lignes;
  }

  /* ---------------- Ventilation du personnel ---------------- */

  /* Les statuts tels qu'ils figurent sur les états de la circonscription.
     ACDPCTD (Enseignants ACDPCTD) est la catégorie qui remplace
     progressivement les AME : AME est simplement l'ancienne appellation des
     agents ACDPCTD — ce sont les mêmes agents, jamais deux statuts
     distincts, donc statutDe() les fait converger vers une seule entrée.
     Éducateur, lui, est un statut à part entière, distinct d'ACDPCTD — ne
     pas les confondre. ACDPCTD est vérifié avant ACDPE pour éviter qu'un
     statut abrégé en ACDP… ne soit reconnu comme ACDPE par erreur. */
  const STATUTS = ['FE', 'ACDPCTD', 'ACDPE', 'EDUCATEUR', 'PRIVEE'];

  /* Les ACDPCTD (AME) et les Éducateurs ne se distinguent pas par le rôle :
     ce sont des collaborateurs mis à disposition, sans fonction de
     direction. */
  const SANS_ROLE = ['ACDPCTD', 'EDUCATEUR'];

  function statutDe(agent) {
    /* Les accents (Éducateur) doivent être neutralisés avant de ne garder
       que les lettres, sans quoi le É initial serait perdu et le statut
       resterait méconnaissable. */
    const brut = String(agent.statut || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toUpperCase().replace(/[^A-Z]/g, '').replace(/^PRIVE$/, 'PRIVEE');
    /* AME est l'ancienne appellation des agents ACDPCTD : les deux désignent
       le même agent, jamais deux catégories distinctes. */
    if (brut === 'AME') return 'ACDPCTD';
    for (let i = 0; i < STATUTS.length; i++) {
      if (brut.indexOf(STATUTS[i]) === 0) return STATUTS[i];
    }
    return brut ? 'Autres' : 'Non renseigné';
  }

  /* Un directeur dirige ; tout le reste collabore. */
  function roleDe(agent) {
    return String(agent.fonction || '').toLowerCase().indexOf('direct') === 0
      ? 'Directeur' : 'Collaborateur';
  }

  /* Certains statuts, en toutes lettres plutôt qu'en sigle, gagnent un
     intitulé lisible plutôt que la forme normalisée utilisée pour la
     reconnaissance (EDUCATEUR). ACDPCTD garde le rappel « (AME) » pour que
     les deux appellations restent reconnaissables à l'affichage. */
  const LIBELLES_STATUT = { EDUCATEUR: 'Éducateur', ACDPCTD: 'ACDPCTD (AME)' };

  /** L'intitulé d'un groupe : statut et rôle, sauf pour les statuts sans rôle. */
  function groupeDePersonnel(agent) {
    const st = statutDe(agent);
    const libelle = LIBELLES_STATUT[st] || st;
    return SANS_ROLE.indexOf(st) >= 0 ? libelle : libelle + ' — ' + roleDe(agent);
  }

  function sexeDe(agent) {
    const s = String(agent.sexe || '').toUpperCase().charAt(0);
    return s === 'F' ? 'F' : (s === 'M' || s === 'G' ? 'H' : '?');
  }

  /**
   * Ventile le personnel par statut et par rôle, avec le nombre d'hommes et de
   * femmes, la part de femmes et l'écart type du nombre d'agents par école.
   * L'écart type dit si le groupe est réparti régulièrement ou concentré.
   */
  function ventilerPersonnel(agents, ecoles) {
    const groupes = {};
    const cle = groupeDePersonnel;

    agents.filter(estActif).forEach(a => {
      const k = cle(a);
      const g = groupes[k] = groupes[k] || { libelle: k, H: 0, F: 0, autre: 0, parEcole: {} };
      const sx = sexeDe(a);
      if (sx === 'H') g.H++; else if (sx === 'F') g.F++; else g.autre++;
      g.parEcole[a.ecoleId] = (g.parEcole[a.ecoleId] || 0) + 1;
    });

    const nbEcoles = (ecoles || []).length;
    return Object.keys(groupes).sort().map(k => {
      const g = groupes[k];
      const total = g.H + g.F + g.autre;
      /* Les écoles sans aucun agent du groupe comptent pour zéro : sans elles,
         l'écart type dirait seulement la dispersion là où le groupe est présent. */
      const effectifs = [];
      for (let i = 0; i < nbEcoles; i++) {
        effectifs.push(g.parEcole[ecoles[i].id] || 0);
      }
      return {
        libelle: g.libelle, H: g.H, F: g.F, autre: g.autre, total: total,
        partFemmes: total ? Math.round(g.F / total * 1000) / 10 : null,
        ecoles: Object.keys(g.parEcole).length,
        ecartType: nbEcoles ? ecartType(effectifs) : 0
      };
    });
  }

  global.Carriere = {
    GROUPES, groupeDe, ventiler, SITUATIONS, situationDe, estActif,
    STATUTS, SANS_ROLE, statutDe, roleDe, groupeDePersonnel, sexeDe, ventilerPersonnel,
    ANNEES_NOTES, ageRetraite, dateRetraite, ageMinimalGrade, estStatutACDPCTD, anciennete, anciennetes, moyenneNotes,
    ecartType, besoinEnseignants, ecartClasses, ecartGenre
  };
})(window);
