/* CS Pobè — canevas des rapports de rentrée et de fin d'année.
   Les rubriques suivent les fiches officielles de la Direction de l'enseignement
   primaire : mêmes intitulés, même ordre, pour que la saisie et le document
   imprimé se superposent au formulaire papier. */
(function (global) {
  'use strict';

  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  const SECTIONS = ['Petits', 'Grands'];

  function f(cle, libelle, type, valeurs) {
    return { cle: cle, libelle: libelle, type: type || 'texte', valeurs: valeurs };
  }

  const OUI_NON = ['OUI', 'NON'];

  /* --- Identification, commune aux quatre canevas --- */
  const IDENTIFICATION = [
    f('annee_creation', 'Année de création', 'entier'),
    f('reference_creation', 'Référence de création'),
    f('annee_extension', 'Année de dernière extension', 'entier'),
    f('reference_extension', "Référence de l'extension"),
    f('statut', 'Statut', 'liste', ['Public', 'Privé', 'Communautaire']),
    f('initiative', 'Si communautaire, préciser l’initiative'),
    f('zone_ped', 'Zone pédagogique'),
    f('unite_ped', 'Unité pédagogique'),
    f('village', 'Village ou quartier de ville'),
    f('bp', 'Boîte postale'),
    f('telephone', 'Téléphone'),
    f('email', 'Adresse électronique'),
    f('fondateur', 'Nom et prénoms du fondateur (privé)'),
    f('directeur', 'Nom et prénoms du directeur ou de la directrice'),
    f('contact_directeur', 'Contact du directeur ou de la directrice')
  ];

  /* --- 2. Environnement socio-économique (recensement primaire) --- */
  const DISTANCES = [
    f('d_departement', 'Distance au chef-lieu du département (km)', 'decimal'),
    f('d_commune', 'Distance au chef-lieu de commune (km)', 'decimal'),
    f('d_arrondissement', 'Distance au chef-lieu d’arrondissement (km)', 'decimal'),
    f('d_cs', 'Distance au bureau de la circonscription (km)', 'decimal'),
    f('d_sante', 'Distance au centre de santé le plus proche (km)', 'decimal'),
    f('d_marche', 'Distance au marché le plus proche (km)', 'decimal'),
    f('d_village', 'Distance au village le plus éloigné desservi (km)', 'decimal')
  ];

  const ACCESSIBILITE = [
    f('acces_permanent', 'L’accès est-il permanent ?', 'liste', OUI_NON),
    f('periode_favorable', 'Si non, période favorable'),
    f('r_bitumee', 'Route bitumée (km)', 'decimal'),
    f('r_tous_vehicules', 'Piste accessible à tous véhicules (km)', 'decimal'),
    f('r_tout_terrain', 'Piste accessible aux véhicules tout terrain (km)', 'decimal'),
    f('r_deux_roues', 'Piste accessible aux deux roues (km)', 'decimal'),
    f('r_a_pieds', 'Piste accessible à pied (km)', 'decimal'),
    f('autres_acces', 'Autres moyens d’accès'),
    f('acces_handicape', 'École accessible à tout enfant handicapé ?', 'liste', OUI_NON),
    f('inondable', 'L’école est-elle inondable ?', 'liste', OUI_NON),
    f('electrifiee', 'La localité est-elle électrifiée ?', 'liste', OUI_NON),
    f('source_electricite', 'Source d’électricité', 'liste',
      ['SBEE', 'Groupe électrogène', 'Énergie solaire', 'Autre']),
    f('pollution', 'Environnement scolaire pollué ?', 'liste', OUI_NON),
    f('type_pollution', 'Type de pollution', 'liste', ['Sonore', 'Atmosphérique', 'Autre'])
  ];

  const ENVIRONNANTS = [
    f('e_em', 'École maternelle la plus proche (km)', 'decimal'),
    f('e_ep1', 'Première école primaire la plus proche (km)', 'decimal'),
    f('e_ep2', 'Deuxième école primaire la plus proche (km)', 'decimal'),
    f('e_ceg', 'CEG ou lycée le plus proche (km)', 'decimal'),
    f('eau_potable', 'Approvisionnement de la localité en eau potable', 'liste',
      ['Eau courante', 'Forage', 'Puits', 'Citerne', 'Autre'])
  ];

  /* --- 3. Informations générales sur l'école (recensement) --- */
  const DOMAINE = [
    f('titre_propriete', 'Titre de propriété', 'liste',
      ['Titre foncier', 'Acte de l’autorité administrative', 'Acte de donation',
        'Contrat de location', 'Aucun acte']),
    f('domaine_delimite', 'Domaine scolaire délimité ?', 'liste', OUI_NON),
    f('superficie', 'Superficie du domaine (ha)', 'decimal'),
    f('cloture', 'Domaine limité par une clôture ?', 'liste', OUI_NON),
    f('cour_ombragee', 'Cour de récréation ombragée ?', 'liste', OUI_NON),
    f('point_eau', 'Point d’eau potable dans le domaine ?', 'liste', OUI_NON),
    f('source_eau', 'Source du point d’eau', 'liste',
      ['SONEB', 'Forage fonctionnel', 'Adduction d’eau villageoise', 'Puits',
        'Citerne', 'Autre']),
    f('distance_eau', 'Sinon, distance du point d’eau le plus proche', 'liste',
      ['Moins de 1 km', '2 km', '3 km', '5 km', 'Plus de 5 km']),
    f('equipement_cuisine', 'Équipement de cuisine ?', 'liste', OUI_NON),
    f('magasin_vivres', 'Magasin de vivres en bon état ?', 'liste', OUI_NON),
    f('jardin_scolaire', 'Jardin ou champ scolaire ?', 'liste', OUI_NON)
  ];

  const COMMODITES = [
    f('latrines', 'Latrines fonctionnelles ?', 'liste', OUI_NON),
    f('latrines_blocs', 'Nombre de blocs de latrines', 'entier'),
    f('latrines_cabines', 'Nombre de cabines', 'entier'),
    f('latrines_separees', 'Latrines séparées filles et garçons ?', 'liste', OUI_NON),
    f('latrines_enseignants', 'Latrines pour le personnel enseignant ?', 'liste', OUI_NON),
    f('latrines_handi', 'Latrines handi-sexospécifiques ?', 'liste', OUI_NON),
    f('urinoir', 'Urinoir aménagé ?', 'liste', OUI_NON),
    f('bibliotheque', 'Bibliothèque fonctionnelle ?', 'liste', OUI_NON),
    f('nb_ouvrages', 'Nombre d’ouvrages', 'entier'),
    f('pharmacie', 'Boîte à pharmacie ?', 'liste', OUI_NON),
    f('sport_trace', 'Terrain de sport tracé ?', 'liste', OUI_NON),
    f('sport_equipe', 'Terrain de sport équipé ?', 'liste', OUI_NON),
    f('amenagements_handi', 'Aménagements adaptés aux enfants handicapés ?', 'liste', OUI_NON),
    f('type_amenagement', 'Type d’aménagement sportif')
  ];

  const ORGANES = [
    f('org_ape', 'Association des parents d’élèves ?', 'liste', OUI_NON),
    f('org_ame', 'Association des mères d’élèves ?', 'liste', OUI_NON),
    f('org_direction', 'Comité de direction ?', 'liste', OUI_NON),
    f('org_maitres', 'Conseil des maîtres ?', 'liste', OUI_NON),
    f('org_cantine', 'Comité de gestion de la cantine ?', 'liste', OUI_NON),
    f('org_sante', 'Comité de santé ?', 'liste', OUI_NON),
    f('org_livre', 'Comité de gestion du livre ?', 'liste', OUI_NON),
    f('org_espace_vert', 'Comité espace vert ?', 'liste', OUI_NON),
    f('org_gouvernement', 'Gouvernement des enfants ?', 'liste', OUI_NON),
    f('org_genre', 'Comité genre ?', 'liste', OUI_NON),
    f('org_reception', 'Comité de réception du matériel ?', 'liste', OUI_NON),
    f('ape_parent_handi', 'Parent d’enfant handicapé au bureau APE ?', 'liste', OUI_NON),
    f('ape_personne_handi', 'Personne handicapée au bureau APE ?', 'liste', OUI_NON)
  ];

  const LANGUES = [
    f('l_francais', 'Enseignement en français ?', 'liste', OUI_NON),
    f('l_anglais', 'Enseignement en anglais ?', 'liste', OUI_NON),
    f('l_arabe', 'Enseignement en arabe ?', 'liste', OUI_NON),
    f('l_nationale', 'Enseignement en langue nationale ?', 'liste', OUI_NON),
    f('l_nationale_precision', 'Préciser la langue nationale'),
    f('l_signes', 'Enseignement en langue des signes ?', 'liste', OUI_NON),
    f('l_autre', 'Autre langue d’enseignement')
  ];

  /* --- 9. Résultats aux examens de la dernière session (primaire) --- */
  const RESULTATS_CEP = [
    f('cep_inscrits_g', 'CEP — inscrits garçons', 'entier'),
    f('cep_inscrits_f', 'CEP — inscrites filles', 'entier'),
    f('cep_composes_g', 'CEP — ont composé, garçons', 'entier'),
    f('cep_composes_f', 'CEP — ont composé, filles', 'entier'),
    f('cep_admis_g', 'CEP — admis garçons', 'entier'),
    f('cep_admis_f', 'CEP — admises filles', 'entier'),
    f('cep_eh_inscrits', 'Dont enfants handicapés inscrits', 'entier'),
    f('cep_eh_admis', 'Dont enfants handicapés admis', 'entier')
  ];

  /* --- 11. Gestion participative --- */
  const GESTION = [
    f('ape_fonctionnel', 'Le bureau APE est-il fonctionnel ?', 'liste', OUI_NON),
    f('ape_complet', 'Comporte-t-il tous les membres requis ?', 'liste', OUI_NON),
    f('nb_reunions', 'Réunions tenues l’année précédente', 'entier'),
    f('nb_ag', 'Assemblées générales tenues', 'entier'),
    f('ag_budget', 'AG ayant traité du budget', 'entier'),
    f('ag_resultats', 'AG ayant traité des résultats scolaires', 'entier'),
    f('sujets_ag', 'Autres sujets abordés en AG'),
    f('communication_resultats', 'Communication des résultats', 'liste',
      ['Carnet de correspondance', 'Assemblée générale', 'Réunion APE',
        'Échange avec les parents', 'Autre']),
    f('projet_ecole_verte', 'Projet d’éducation au développement (école verte) ?',
      'liste', OUI_NON),
    f('projet_inclusif', 'Projet de développement inclusif ?', 'liste', OUI_NON)
  ];

  /* --- 12. Données financières --- */
  const FINANCES = [
    f('budget_precedent', 'Budget exécuté l’année précédente (FCFA)', 'entier'),
    f('solde_anterieur', 'Solde de l’exercice antérieur (FCFA)', 'entier'),
    f('subvention_etat', 'Subvention reçue de l’État (FCFA)', 'entier'),
    f('cotisation_parents', 'Cotisation des parents d’élèves (FCFA)', 'entier'),
    f('autres_ressources', 'Autres ressources (FCFA)', 'entier')
  ];

  /* --- Rubriques propres à la maternelle --- */
  const MATERNELLE_ENV = [
    f('d_ep_proche', 'Distance de la plus proche école primaire', 'liste',
      ['≤ 0,5 km', 'Entre 0,5 et 1 km', 'Entre 1 et 3 km', '> 3 km']),
    f('d_sante_proche', 'Distance du plus proche centre de santé', 'liste',
      ['≤ 0,5 km', 'Entre 0,5 et 1 km', 'Entre 1 et 3 km', '> 3 km']),
    f('aire_jeu', 'Aire de jeu ?', 'liste', OUI_NON),
    f('salle_adaptee', 'Salle de classe adaptée aux personnes handicapées ?',
      'liste', OUI_NON),
    f('latrines_modules', 'Nombre de modules de latrines', 'entier'),
    f('latrines_isoloirs', 'Nombre d’isoloirs', 'entier')
  ];

  /** Les sections du recensement, dans l'ordre du formulaire officiel. */
  function sections(cycle) {
    const primaire = cycle !== 'MATERNELLE';
    const liste = [
      { titre: '2. Environnement socio-économique — distances', champs: DISTANCES },
      { titre: '2. Accessibilité', champs: ACCESSIBILITE },
      { titre: '2. Établissements environnants et eau potable', champs: ENVIRONNANTS },
      { titre: '3. Domaine et commodités de l’école', champs: DOMAINE },
      { titre: '3. Latrines, bibliothèque et sport', champs: COMMODITES },
      { titre: '3. Organes de gestion', champs: ORGANES },
      { titre: '3. Langues d’enseignement', champs: LANGUES },
      { titre: '11. Gestion participative', champs: GESTION },
      { titre: '12. Données financières', champs: FINANCES }
    ];
    if (primaire) {
      liste.splice(7, 0, { titre: '9. Résultats au CEP de la dernière session',
        champs: RESULTATS_CEP });
    } else {
      liste.splice(3, 0, { titre: '2. Environnement de la maternelle',
        champs: MATERNELLE_ENV });
    }
    return liste;
  }

  /** Total du budget de l'année en cours. */
  function totalBudget(c) {
    return ['solde_anterieur', 'subvention_etat', 'cotisation_parents', 'autres_ressources']
      .reduce((t, k) => t + (parseInt(c[k], 10) || 0), 0);
  }

  /* --- Informations générales --- */
  function generales(cycle) {
    const unite = cycle === 'MATERNELLE' ? 'sections' : 'classes';
    return [
      f('autorisees', 'Nombre de ' + unite + ' autorisées', 'entier'),
      f('ouvertes', 'Nombre de ' + unite + ' ouvertes', 'entier'),
      f('salles_existantes', 'Nombre de salles de classe existantes', 'entier'),
      f('salles_utilisees', 'Nombre de salles de classe utilisées', 'entier'),
      f('cantine', 'L’école dispose-t-elle d’une cantine ?', 'liste', OUI_NON),
      f('cantine_fonctionne', 'Si oui, a-t-elle fonctionné ?', 'liste', OUI_NON),
      f('cantine_raison', 'Si non, donnez la raison'),
      f('cantine_organisme', 'Organisme de soutien de la cantine'),
      f('lavage_mains', 'Dispositif de lavage des mains fonctionnel ?', 'liste', OUI_NON),
      f('gestion_collegiale', 'Structure de gestion collégiale ?', 'liste', OUI_NON),
      f('ape', 'APE', 'liste', OUI_NON),
      f('ame', 'AME', 'liste', OUI_NON),
      f('comite_direction', 'Comité de direction', 'liste', OUI_NON),
      f('autres_structures', 'Autres structures à préciser')
    ];
  }

  /* --- Effectifs : les lignes changent selon le moment de l'année --- */
  function lignesEffectifs(type, cycle) {
    if (cycle === 'MATERNELLE') {
      return type === 'RENTREE'
        ? [['debut', 'Effectif au début de l’année'],
           ['besoins', 'Dont enfants à besoin spécifique']]
        : [['debut', 'Effectif au début de l’année'],
           ['fin', 'Effectif en fin d’année'],
           ['besoins', 'Dont enfants à besoin spécifique'],
           ['abandons', 'Abandons']];
    }
    return type === 'RENTREE'
      ? [['debut', 'Nombre d’élèves en début d’année'],
         ['redoublants', 'Dont redoublants']]
      : [['debut', 'Nombre d’élèves en début d’année'],
         ['fin', 'Nombre d’élèves en fin d’année'],
         ['promus', 'Promus'],
         ['redoublants', 'Redoublants'],
         ['abandons', 'Abandons']];
  }

  function niveaux(cycle) {
    return cycle === 'MATERNELLE' ? SECTIONS : COURS;
  }

  /* --- Structure pédagogique --- */
  const TYPES_CLASSE = [['simple', 'Simple'], ['jumelee', 'Jumelée'],
    ['multigrade', 'Multigrade']];

  /* --- Infrastructures, mobilier, manuels, structures de gestion --- */
  const COLONNES_INFRA = [['definitifs', 'En matériaux définitifs'],
    ['provisoires', 'En matériaux provisoires'], ['sans_mur', 'Sans mur et sans toit'],
    ['construction', 'En construction']];

  function lignesInfra(cycle) {
    return cycle === 'MATERNELLE'
      ? [['salles', 'Salles de classe'], ['bureaux', 'Bureaux et magasins']]
      : [['salles', 'Salles de classe'], ['bureaux', 'Bureau ou magasin']];
  }

  const MOBILIER_PRIMAIRE = [['table_chaise', 'Table + chaise'],
    ['banc2', 'Table-banc à 2 places'], ['banc3', 'Table-banc à 3 places et plus'],
    ['bureau_maitre', 'Bureau du maître + chaise']];

  const MANUELS = [['francais', 'Manuel de français'], ['maths', 'Manuel de mathématiques']];

  const MOBILIER_MATERNELLE = [['bureaux_ens', 'Bureaux enseignants'],
    ['chaises_ens', 'Chaises enseignants'], ['armoires', 'Armoires et placards'],
    ['tables_jeux', 'Tables de jeux'], ['tablettes', 'Tablettes'],
    ['chaises_enfants', 'Chaises pour enfants'], ['tables_enfants', 'Tables pour enfants'],
    ['nattes', 'Nattes'], ['autres', 'Autres']];

  const MATERIEL_MATERNELLE = [['programmes', 'Programmes d’activités (PAEAPEM)'],
    ['guides', 'Guides pédagogiques'], ['recueils', 'Recueils de jeux'],
    ['autres', 'Autres']];

  const EQUIP_EXTERIEURS = [['tourniquet', 'Tourniquet'], ['cage', 'Cage à écureuil'],
    ['escalier', 'Escalier de géant'], ['toboggan', 'Toboggan'], ['bac_sable', 'Bac à sable'],
    ['balancoire', 'Balançoire'], ['corde', 'Corde à grimper'], ['tunnel', 'Tunnel'],
    ['poutre', 'Poutre'], ['filet', 'Ensemble filet-échelle']];

  const EQUIP_INTERIEURS = [['peinture', 'Piste de peinture'],
    ['encastrement', 'Encastrement'], ['puzzle', 'Puzzle'],
    ['graphisme', 'Matériel de graphisme et de dessin'], ['chevalet', 'Tableau sur chevalet'],
    ['muraux', 'Tableaux muraux'], ['presentoir', 'Présentoir'],
    ['bricolage', 'Matériel de bricolage']];

  function structuresGestion(cycle) {
    return cycle === 'MATERNELLE'
      ? [['ag', 'Assemblée générale'], ['conseil', 'Conseil des maîtres'],
         ['ame', 'Réunion AME'], ['ape', 'Réunion APE']]
      : [['ag', 'Assemblée générale'], ['ape', 'Réunion bureau APE'],
         ['conseil', 'Conseil des maîtres']];
  }

  const VALIDATION = [
    f('date_remplissage', 'Date de remplissage', 'date'),
    f('rempli_par', 'Rempli par (nom et prénoms)'),
    f('fonction', 'Fonction'),
    f('controle_rup', 'Contrôlé par le responsable d’unité pédagogique'),
    f('controle_cp', 'Contrôlé par le conseiller pédagogique de zone'),
    f('visa_ccs', 'Visa du chef de la circonscription scolaire')
  ];

  function titre(type, cycle) {
    return 'FICHE DE ' + (type === 'RENTREE' ? 'RAPPORT DE RENTRÉE' : 'FIN D’ANNÉE')
      + ' DES ÉCOLES ' + (cycle === 'MATERNELLE' ? 'MATERNELLES' : 'PRIMAIRES');
  }

  /** Total d'une ligne d'effectifs, tous niveaux et tous sexes confondus. */
  function totalLigne(rapport, ligne, cycle, sexe) {
    return niveaux(cycle).reduce((somme, n) => {
      const cle = 'eff_' + ligne + '_' + n.toLowerCase() + '_' + sexe;
      return somme + (parseInt(rapport[cle], 10) || 0);
    }, 0);
  }

  /** Contrôles de cohérence propres au rapport de fin d'année. */
  function anomalies(rapport, type, cycle) {
    const sortie = [];
    if (type !== 'FIN_ANNEE') return sortie;
    niveaux(cycle).forEach(n => {
      ['G', 'F'].forEach(sexe => {
        const lire = ligne => parseInt(rapport['eff_' + ligne + '_' + n.toLowerCase()
          + '_' + sexe], 10) || 0;
        const debut = lire('debut'), fin = lire('fin'), abandons = lire('abandons');
        if (fin > debut && debut > 0) {
          sortie.push(n + ' (' + sexe + ') : l’effectif de fin (' + fin
            + ') dépasse celui du début (' + debut + ').');
        }
        if (cycle === 'PRIMAIRE') {
          const promus = lire('promus'), redoublants = lire('redoublants');
          if (fin > 0 && promus + redoublants > fin) {
            sortie.push(n + ' (' + sexe + ') : promus et redoublants (' + (promus + redoublants)
              + ') dépassent l’effectif de fin (' + fin + ').');
          }
        }
        if (debut > 0 && fin + abandons > debut) {
          sortie.push(n + ' (' + sexe + ') : effectif de fin et abandons (' + (fin + abandons)
            + ') dépassent l’effectif du début (' + debut + ').');
        }
      });
    });
    return sortie;
  }

  /**
   * Rassemble ce que l'application sait déjà de l'école : rien de tout cela ne
   * doit être ressaisi sur la fiche.
   */
  function preRemplir(contexte) {
    const e = contexte.ecole || {};
    const releve = contexte.releve || {};
    const agents = (contexte.agents || []).filter(contexte.estActif || (() => true));
    const enseignants = agents.filter(a => (a.categorie || 'Enseignant') === 'Enseignant');

    const compteSexe = liste => ({
      H: liste.filter(a => String(a.sexe || '').toUpperCase().charAt(0) === 'M'
        || String(a.sexe || '').toUpperCase().charAt(0) === 'G').length,
      F: liste.filter(a => String(a.sexe || '').toUpperCase().charAt(0) === 'F').length
    });

    const eleves = {
      G: parseInt(releve.totalG, 10) || 0,
      F: parseInt(releve.totalF, 10) || 0
    };

    return {
      identification: {
        nom: e.nom, code: e.code, statut: e.statut, type: e.typeEns,
        annee_creation: e.annee_creation, departement: e.departement,
        commune: e.commune, arrondissement: e.arrondissement,
        village: e.village, zone_ped: e.zone_ped, unite_ped: e.unite_ped,
        telephone: e.telephone, email: e.email, directeur: e.directeur,
        contact_directeur: e.contact_directeur
      },
      classes: {
        autorisees: Number(e.classes_autorisees) || 0,
        ouvertes: Number(e.classes_existantes) || 0,
        salles_existantes: Number(e.salles_existantes) || 0,
        salles_utilisees: Number(e.salles_utilisees) || 0
      },
      eleves: Object.assign(eleves, { total: eleves.G + eleves.F }),
      parCours: COURS.map(c => ({
        cours: c,
        G: parseInt(releve['c_' + c.toLowerCase() + '_G'], 10) || 0,
        F: parseInt(releve['c_' + c.toLowerCase() + '_F'], 10) || 0
      })),
      personnel: {
        enseignants: Object.assign(compteSexe(enseignants), { total: enseignants.length }),
        soutien: (function () {
          const l = agents.filter(a => a.categorie === 'Soutien');
          return Object.assign(compteSexe(l), { total: l.length });
        })(),
        liste: enseignants
      },
      locaux: contexte.locaux || [],
      mobilier: contexte.mobilier || []
    };
  }

  /** Ce que la fiche réclame encore, une fois le pré-remplissage fait. */
  function manquants(donnees, complements) {
    const sortie = [];
    const id = donnees.identification;
    if (!id.directeur) sortie.push('le nom du directeur');
    if (!id.zone_ped) sortie.push('la zone pédagogique');
    if (!id.unite_ped) sortie.push("l'unité pédagogique");
    if (!donnees.eleves.total) sortie.push("l'effectif des apprenants");
    if (!donnees.personnel.enseignants.total) sortie.push("l'état du personnel enseignant");
    if (!(complements || {}).date_remplissage) sortie.push('la date de remplissage');
    return sortie;
  }

  global.Rapports = {
    preRemplir, manquants, sections, totalBudget, RESULTATS_CEP, FINANCES,
    COURS, SECTIONS, OUI_NON, IDENTIFICATION, VALIDATION, TYPES_CLASSE,
    COLONNES_INFRA, MOBILIER_PRIMAIRE, MANUELS, MOBILIER_MATERNELLE,
    MATERIEL_MATERNELLE, EQUIP_EXTERIEURS, EQUIP_INTERIEURS,
    generales, lignesEffectifs, niveaux, lignesInfra, structuresGestion,
    titre, totalLigne, anomalies
  };
})(window);
