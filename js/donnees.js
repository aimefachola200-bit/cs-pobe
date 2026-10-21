/* CS Pobè — liste initiale des écoles de la circonscription.
   Elle ne sert qu'au premier démarrage : ensuite, ce sont les données
   enregistrées dans le navigateur qui font foi. */
(function (global) {
  'use strict';

  const PRIMAIRES = [
    ['AHOYEYE', 'EPP AHOYEYE', 1978, 4], ['AHOYEYE', 'EPP AKPANMAN', 2020, 3],
    ['AHOYEYE', 'EPP BANIGBE POTO-POTO', 1966, 3], ['AHOYEYE', 'EPP IBERE-OKEITA/A', 1964, 6],
    ['AHOYEYE', 'EPP IBERE-OKEITA/B', 2003, 6], ['AHOYEYE', 'EPP IGBIDI-IDIORO', 1999, 3],
    ['AHOYEYE', 'EPP ITA-ADELEYE-OBELE', 2020, 3], ['AHOYEYE', 'EPP ITCHOUGBO IGBO-DEFE', 2018, 3],
    ['AHOYEYE', 'EPP OBELE', 2024, 1],
    ['IGANNA', 'EPP AKPATE', 1985, 4], ['IGANNA', 'EPP EGUELOU', 1978, 6],
    ['IGANNA', 'EPP IGANA/A', 1984, 6], ['IGANNA', 'EPP IGANA/B', 2008, 6],
    ['IGANNA', 'EPP IGBO-ASSOGBA', 2011, 2], ['IGANNA', 'EPP IGBO-OKO', 2011, 2],
    ['IGANNA', 'EPP IHORO', 1985, 2], ['IGANNA', 'EPP ILLEMON', 1978, 6],
    ['IGANNA', 'EPP KPANYIKPAN', 2011, 2], ['IGANNA', 'EPP OKO-ILAKPO', 2011, 3],
    ['ISSABA', 'EPP ABIGNANKPAN', 1997, 5], ['ISSABA', 'EPP ARAROMI', 2010, 1],
    ['ISSABA', 'EPP AYELADJOU', 2008, 2], ['ISSABA', 'EPP GBAGUI', 2007, 3],
    ['ISSABA', 'EPP GBANAGO', 1975, 6], ['ISSABA', 'EPP IDJAKOU', 2001, 2],
    ['ISSABA', 'EPP IGBO EWE', 2003, 4], ['ISSABA', 'EPP IGBODJE', 2010, 1],
    ['ISSABA', 'EPP IGBO-EKPE', 2010, 2], ['ISSABA', 'EPP IGBO-EWAN', 2008, 3],
    ['ISSABA', 'EPP IGBO-OLOCHOU MARE', 2007, 4], ['ISSABA', 'EPP IGBO-OSSOU', 2010, 2],
    ['ISSABA', 'EPP ILLEKPA', 2000, 4], ['ISSABA', 'EPP ILLOULOFIN', 1978, 5],
    ['ISSABA', 'EPP ISSABA', 1953, 8], ['ISSABA', 'EPP ITCHAKPO', 2010, 2],
    ['ISSABA', 'EPP ITCHOHOU-KETTY', 1992, 6], ['ISSABA', 'EPP KADJOLA', 1985, 5],
    ['ISSABA', 'EPP ONIGBOLO VILLAGE', 1976, 5], ['ISSABA', 'EPP ONIGBOLO-USINE/A', 1983, 6],
    ['ISSABA', 'EPP ONIGBOLO-USINE/B', 2002, 6], ['ISSABA', 'EPP ONIGBOLO-USINE/C', 2016, 5],
    ['ISSABA', 'EPP OUIGNAN ILE', 1978, 3],
    ['POBE', 'EPP AGBAROU', 2018, 3], ['POBE', 'EPP AKOUHO/A', 1968, 6],
    ['POBE', 'EPP AKOUHO/B', 1999, 8], ['POBE', 'EPP IGBO ITCHE OGOUBA', 2003, 6],
    ['POBE', 'EPP IGBODOGUI', 2020, 2], ['POBE', 'EPP ITA-ATINGA', 2010, 6],
    ['POBE', 'EPP LA RIVIERE DE POBE', 2002, 7], ['POBE', 'EPP LE PLATEAU/A', 1993, 6],
    ['POBE', 'EPP LE PLATEAU/B', 2009, 6], ['POBE', 'EPP OKE-ATA/A', 1952, 6],
    ['POBE', 'EPP OKE-ATA/B', 1981, 6], ['POBE', 'EPP OKE-ATA/C', 2008, 6],
    ['POBE', 'EPP OKE-OLA/A', 1971, 6], ['POBE', 'EPP OKE-OLA/B', 1991, 6],
    ['POBE', 'EPP OKE-OLA/C', 1994, 6], ['POBE', 'EPP OKE-OLA/D', 1996, 6],
    ['POBE', 'EPP OSSOMOU II', 2012, 6], ['POBE', 'EPP OSSOMOU', 2014, 6],
    ['POBE', 'EPP POBE NORD/A', 1976, 6], ['POBE', 'EPP POBE NORD/B', 1991, 6],
    ['POBE', 'EPP POBE/A', 1921, 6], ['POBE', 'EPP POBE/B', 1965, 6],
    ['POBE', 'EPP ISSALE AFFIN DOUANE (Ex POBE/C)', 1958, 5],
    ['POBE', 'EPP POBE-ADJEGOUNLE/A', 1981, 6], ['POBE', 'EPP POBE-ADJEGOUNLE/B', 1996, 6],
    ['POBE', 'EPP POBE-ADJEGOUNLE/C', 2005, 6], ['POBE', 'EPP ZONE RESIDENTIELLE/A', 1953, 6],
    ['POBE', 'EPP ZONE RESIDENTIELLE/B', 2005, 6],
    ['TOWE', 'EPP ABODJOUKPA', 1995, 1], ['TOWE', 'EPP AKPATE-AYEKOU', 2010, 2],
    ['TOWE', 'EPP AYEGBAMI', 2001, 2], ['TOWE', 'EPP EGUELOU-IBATE', 2006, 2],
    ['TOWE', 'EPP IBATE', 1997, 4], ['TOWE', 'EPP IBICHI AROGUI', 2024, 1],
    ['TOWE', 'EPP IGA', 1997, 5], ['TOWE', 'EPP IGBO-EDE', 1974, 6],
    ['TOWE', 'EPP IGBO-EDE ORILE', 2010, 3], ['TOWE', 'EPP IGBO-EDE-CHAFFOU', 1987, 5],
    ['TOWE', 'EPP IGBO-OTCHO', 2002, 6], ['TOWE', 'EPP ISSOKOU-ONIWERE', 2011, 3],
    ['TOWE', 'EPP KAHE', 1997, 6], ['TOWE', 'EPP LAFENWA', 2005, 3],
    ['TOWE', 'EPP MOSSAFEDJO', 2011, 3], ['TOWE', 'EPP OKE-ODJA', 2009, 2],
    ['TOWE', 'EPP OKERE', 2010, 2], ['TOWE', 'EPP OTETAN (EX OTETAN/A)', 1978, 6],
    ['TOWE', 'EPP OTETAN (EX OTETAN/B)', 2024, 3], ['TOWE', 'EPP TOWE/A', 1971, 6],
    ['TOWE', 'EPP TOWE/B', 1998, 7]
  ];

  /* Maternelles publiques, avec leur zone pédagogique telle qu'elle figure au
     rapport de fin d'année de la circonscription. */
  const MATERNELLES = [
    ['AHOYEYE', 'EM AHOYEYE', 2011, 2], ['AHOYEYE', 'EM IBERE', 2009, 2],
    ['AHOYEYE', 'EM OKEITA', 2010, 1], ['POBE', 'EM POBE-NORD', 1980, 3],
    ['POBE', 'EM OKE-OLA', 2008, 4], ['POBE', 'EM OKE-ATA', 1982, 2],
    ['POBE', 'EM IDOGAN', 2015, 2], ['POBE', 'EM AKOUHO', 2008, 2],
    ['POBE', 'EM ADJEGOUNLE', 1984, 2], ['POBE', 'EM ADJISSOU', 2019, 2],
    ['IGANNA', 'EM AKPATE', 2015, 1], ['IGANNA', 'EM EGUELOU', 2011, 2],
    ['IGANNA', 'EM OGOUBA', 2012, 2], ['ISSABA', 'EM ONIGBOLO USINE', 2005, 2],
    ['ISSABA', 'EM ABODJOUKPA', 2010, 1], ['TOWE', 'EM ILLOULOFIN', 2012, 2],
    ['TOWE', 'EM IGBO-EDE', 2009, 2], ['TOWE', 'EM TOWE', 2009, 2]
  ];

  const PRIVEES = [
    ['ISSABA', 'EPP LA SAGESSE-ONIGBOLO', 2006], ['POBE', 'EPP LA LICORNE', 2024],
    ['POBE', 'EPP LA GLOIRE MARIALE', 2016], ['POBE', 'EPP DIVINS TRESORS', 2015],
    ['POBE', 'EPP APOSTOLIQUE', 2005], ['POBE', 'EPP CATHOLIQUE Ste CLAIRE', 1959],
    ['POBE', 'EPP IMAM BAKINDAYA', 2021], ['POBE', 'EPP LES LYS NDA', 1953],
    ['POBE', 'EPP LA LUMIERE DU PLATEAU', 2013], ['POBE', 'EPP AL-AMAL/A', 2008],
    ['POBE', 'EPP AL-AMAL/B', 2022], ['POBE', 'EPP ESPOIR', 2009],
    ['POBE', 'EPP FOURSQUARE', 2007], ['POBE', 'EPP LA VOIE DU SUCCES', 2023],
    ['POBE', 'EPP IMMACULEE CONCEPTION', 2011], ['POBE', 'EPP GRAIN DE SOLEIL', 2017],
    ['ISSABA', 'EPP OLAC', 2024], ['IGANNA', 'EPP LA GLOIRE DIVINE', 2019],
    ['POBE', 'EPP NONVIDE BOUSSARI/A', 2006], ['POBE', 'EPP NONVIDE BOUSSARI/B', 2006],
    ['POBE', 'EPP LA CONFIANCE', 2016], ['POBE', 'EPP LA BONNE SEMENCE', 2024],
    ['POBE', 'EPP COEUR DU ROI', 2007], ['POBE', 'EPP DAMACY/A', 2006],
    ['POBE', 'EPP DAMACY/B', 2012], ['POBE', 'EPP TERRE PROMISE', 2016],
    ['ISSABA', 'EPP LA LUMIERE DU SAVOIR', 2013], ['POBE', 'EPP LA RELANCE (Annexe Ayere)', 2018],
    ['POBE', 'EPP LA RELANCE', 2018], ['POBE', 'EPP Céleste EL BETHEL', 2026],
    ['POBE', 'EPP LA SAINTE TRINITE', 2013],
    ['POBE', 'EPP MAKAZ AL AMIR', 2015],
    ['POBE', 'EPP PCA POBE', 2012]
  ];

  /* Les treize maternelles privées recensées au rapport de fin d'année :
     nom, arrondissement, année de création, zone pédagogique. */
  const MATERNELLES_PRIVEES = [
    ['POBE', 'EM GLOIRE MARIALE', 2016, 'Zone 1'],
    ['POBE', 'EM LES LYS NDA', 1953, 'Zone 1'],
    ['POBE', 'EM JARDINS D’ENFANTS DIVINS TRESORS', 2015, 'Zone 3'],
    ['POBE', 'EM CATHOLIQUE SAINTE CLAIRE', 2002, 'Zone 1'],
    ['POBE', 'EM GRAIN DE SOLEIL', 2017, 'Zone 1'],
    ['POBE', 'EM ESPOIR DE POBE', 2009, 'Zone 1'],
    ['POBE', 'EM FOURSQUARE', 2007, 'Zone 1'],
    ['POBE', 'EM REVEIL DU PLATEAU', 2013, 'Zone 1'],
    ['POBE', 'EM LE CŒUR DU ROI', 2007, 'Zone 1'],
    ['POBE', 'EM DAMACY', 2006, 'Zone 1'],
    ['POBE', 'EM LUMIERE DU PLATEAU', 2013, 'Zone 1'],
    ['POBE', 'EM IMMACULEE CONCEPTION', 2011, 'Zone 1'],
    ['POBE', 'EM LA SAINTE TRINITE', 2010, 'Zone 1']
  ];

  /* Zone pédagogique des maternelles publiques, d'après le rapport de la CS. */
  const ZONES_MATERNELLES = {
    'EM POBE-NORD': 'Zone 1', 'EM OKE-OLA': 'Zone 1', 'EM OKE-ATA': 'Zone 1',
    'EM IDOGAN': 'Zone 1', 'EM AKOUHO': 'Zone 1', 'EM ADJEGOUNLE': 'Zone 1',
    'EM ADJISSOU': 'Zone 1',
    'EM OKEITA': 'Zone 2', 'EM ILLOULOFIN': 'Zone 2', 'EM IBERE': 'Zone 2',
    'EM AHOYEYE': 'Zone 2', 'EM ONIGBOLO USINE': 'Zone 2',
    'EM ABODJOUKPA': 'Zone 3', 'EM AKPATE': 'Zone 3', 'EM EGUELOU': 'Zone 3',
    'EM IGBO-EDE': 'Zone 3', 'EM OGOUBA': 'Zone 3', 'EM TOWE': 'Zone 3'
  };

  /* Le découpage pédagogique de la circonscription : chaque école y est
     rattachée par sa zone et son unité. */
  const ZONES = ['Zone 1', 'Zone 2', 'Zone 3', 'Zone 4', 'Zone 5', 'Zone 6'];

  const UNITES = {
    'POBE': ['UP Pobè centre', 'UP Pobè nord', 'UP Adjegounlé', 'UP Oké-Ola', 'UP Oké-Ata',
      'UP Agbarou'],
    'AHOYEYE': ['UP Ahoyeye', 'UP Ibéré-Okéita'],
    'IGANNA': ['UP Iganna', 'UP Eguelou'],
    'ISSABA': ['UP Issaba', 'UP Onigbolo', 'UP Illoulofin'],
    'TOWE': ['UP Towè', 'UP Igbo-Edé', 'UP Kahé']
  };

  /** Années scolaires proposées par défaut. */
  function anneesInitiales() {
    return [
      { id: '2026-2027', libelle: '2026-2027', active: true },
      { id: '2025-2026', libelle: '2025-2026', active: false }
    ];
  }

  /** Construit la liste complète des écoles au premier démarrage. */
  function ecolesInitiales(identifiant) {
    const ecoles = [];
    const base = {
      commune: 'POBE', departement: 'PLATEAU', typeEns: 'Classique',
      directeur: '', telephone: ''
    };

    PRIMAIRES.forEach((e, i) => ecoles.push(Object.assign({}, base, {
      id: identifiant(), code: 'EPP' + String(i + 1).padStart(3, '0'),
      nom: e[1], type: 'EPP', statut: 'Public', arrondissement: e[0],
      annee_creation: e[2], classes_autorisees: e[3], classes_existantes: e[3]
    })));

    MATERNELLES.forEach((e, i) => ecoles.push(Object.assign({}, base, {
      id: identifiant(), code: 'EM' + String(i + 1).padStart(3, '0'),
      nom: e[1], type: 'EM', statut: 'Public', arrondissement: e[0],
      annee_creation: e[2], classes_autorisees: e[3], classes_existantes: e[3]
    })));

    PRIVEES.forEach((e, i) => ecoles.push(Object.assign({}, base, {
      id: identifiant(), code: 'EPRP' + String(i + 1).padStart(3, '0'),
      nom: e[1], type: 'EPPRIV', statut: 'Privé Laïc', arrondissement: e[0],
      annee_creation: e[2], classes_autorisees: 6, classes_existantes: 6
    })));

    MATERNELLES_PRIVEES.forEach((e, i) => ecoles.push(Object.assign({}, base, {
      id: identifiant(), code: 'EMPR' + String(i + 1).padStart(3, '0'),
      nom: e[1], type: 'EMPRIV', statut: 'Privé Laïc', arrondissement: e[0],
      annee_creation: e[2], zone_ped: e[3],
      classes_autorisees: 2, classes_existantes: 2
    })));

    ecoles.forEach(e => {
      if (!e.zone_ped && ZONES_MATERNELLES[e.nom]) e.zone_ped = ZONES_MATERNELLES[e.nom];
    });
    return ecoles;
  }

  /**
   * Complète une liste d'écoles déjà enregistrée : ajoute les établissements du
   * référentiel qui y manquent, et renseigne la zone pédagogique restée vide.
   * Rien n'est écrasé — les saisies de la circonscription font foi.
   */
  function completerEcoles(existantes, identifiant) {
    const cle = n => String(n || '').toUpperCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^A-Z0-9]+/g, ' ').trim();
    const connues = {};
    existantes.forEach(e => { connues[cle(e.nom)] = e; });

    const ajouts = [];
    ecolesInitiales(identifiant).forEach(ref => {
      const deja = connues[cle(ref.nom)];
      if (deja) {
        if (!deja.zone_ped && ref.zone_ped) deja.zone_ped = ref.zone_ped;
      } else {
        ajouts.push(ref);
      }
    });
    return ajouts;
  }

  global.Donnees = { ecolesInitiales, completerEcoles, anneesInitiales, ZONES, UNITES };
})(window);
