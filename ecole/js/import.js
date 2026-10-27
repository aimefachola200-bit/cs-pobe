/* CS Pobè — import de classeurs Excel ou CSV.
   Le principe : on lit le fichier, on devine à quoi correspond chaque colonne,
   on montre le résultat avant d'enregistrer quoi que ce soit. Rien n'entre dans
   la base sans avoir été vu. */
(function (global) {
  'use strict';

  /* Ce que l'on sait importer, et les colonnes attendues pour chaque cas.
     `alias` liste les intitulés que l'on reconnaît dans le fichier reçu. */
  const MODELES = {
    ecoles: {
      titre: 'Écoles',
      cle: ['code', 'nom'],
      champs: [
        { n: 'code', l: "Code de l'école", alias: ['code', 'code ecole', "code de l'école", 'code_ecole'] },
        { n: 'nom', l: "Nom de l'école", alias: ['nom', "nom de l'ecole", "nom de l'école", 'ecole', 'école', 'etablissement'] },
        { n: 'type', l: 'Type', alias: ['type'], valeurs: { 'primaire publique': 'EPP', 'epp': 'EPP', 'primaire privee': 'EPPRIV', 'primaire privée': 'EPPRIV', 'eppriv': 'EPPRIV', 'maternelle publique': 'EM', 'em': 'EM', 'maternelle privee': 'EMPRIV', 'maternelle privée': 'EMPRIV', 'empriv': 'EMPRIV' } },
        { n: 'statut', l: 'Statut', alias: ['statut'] },
        { n: 'typeEns', l: "Type d'enseignement", alias: ["type d'enseignement", 'enseignement'] },
        { n: 'arrondissement', l: 'Arrondissement', alias: ['arrondissement', 'arrond'] },
        { n: 'commune', l: 'Commune', alias: ['commune'] },
        { n: 'departement', l: 'Département', alias: ['departement', 'département'] },
        { n: 'village', l: 'Village ou quartier', alias: ['village', 'quartier', 'village ou quartier'] },
        { n: 'annee_creation', l: 'Année de création', alias: ['annee de creation', 'année de création', 'annee creation', 'création', 'annee_creation'], type: 'entier' },
        { n: 'classes_autorisees', l: 'Classes autorisées', alias: ['classes autorisees', 'classes autorisées', 'classes_autorisees'], type: 'entier' },
        { n: 'classes_existantes', l: 'Classes existantes', alias: ['classes existantes', 'classes_existantes'], type: 'entier' },
        { n: 'salles_existantes', l: 'Salles existantes', alias: ['salles existantes', 'salles_existantes'], type: 'entier' },
        { n: 'salles_utilisees', l: 'Salles utilisées', alias: ['salles utilisees', 'salles utilisées', 'salles_utilisees'], type: 'entier' },
        { n: 'directeur', l: 'Directeur', alias: ['directeur', 'directrice', 'nom du directeur'] },
        { n: 'telephone', l: 'Téléphone', alias: ['telephone', 'téléphone', 'contact', 'tel'] },
        { n: 'email', l: 'Adresse mail', alias: ['email', 'mail', 'adresse mail'] },
        { n: 'zone_ped', l: 'Zone pédagogique', alias: ['zone pedagogique', 'zone pédagogique', 'zone'] },
        { n: 'unite_ped', l: 'Unité pédagogique', alias: ['unite pedagogique', 'unité pédagogique', 'up', 'unite'] },
        { n: 'contact_directeur', l: 'Contact du directeur', alias: ['contact du directeur', 'contact directeur'] }
      ]
    },
    personnel: {
      titre: 'Personnel',
      cle: ['matricule', 'nom'],
      ecole: true,
      champs: [
        { n: 'matricule', l: 'Matricule', alias: ['matricule', 'n° matricule', 'no matricule', 'identifiant a m e', 'identifiant ame'] },
        { n: 'nom', l: 'Nom (ou nom complet)', alias: ['nom', 'nom et prenoms', 'nom et prénoms', 'noms et prenoms', 'nom & prenoms'] },
        { n: 'prenoms', l: 'Prénoms (colonne séparée)', alias: ['prenoms', 'prénoms'] },
        { n: 'nomEpoux', l: "Nom d'épouse", alias: ['nom epoux', 'nom époux', "nom d'epouse"] },
        { n: 'sexe', l: 'Sexe', alias: ['sexe', 'le genre', 'genre'], valeurs: { 'masculin': 'M', 'feminin': 'F', 'féminin': 'F', 'h': 'M', 'homme': 'M', 'femme': 'F' } },
        { n: 'dateNaissance', l: 'Date de naissance', alias: ['date de naissance', 'naissance', 'ne le', 'né(e) le', 'date naissance'], type: 'date' },
        { n: 'lieuNaiss', l: 'Lieu de naissance', alias: ['lieu de naissance', 'lieu naissance'] },
        { n: 'grade', l: 'Grade', alias: ['grade', 'categorie', 'catégorie'] },
        { n: 'statut', l: 'Statut', alias: ['statut', 'nom statut', 'nom statut a m e'], valeurs: { 'f e': 'FE', 'fe': 'FE', 'a c d p c t d': 'ACDPCTD', 'acdpctd': 'ACDPCTD', 'a c d p e': 'ACDPE', 'acdpe': 'ACDPE', 'a m e': 'AME', 'ame': 'AME', 'a c e': 'ACE', 'ace': 'ACE', 'educateur': 'Éducateur', 'educatrice': 'Éducateur' } },
        { n: 'fonction', l: 'Fonction', alias: ['fonction'] },
        { n: 'cours', l: 'Cours tenu', alias: ['cours', 'cours tenu', 'classe'] },
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', "nom de l'ecole", 'etablissement', 'affectation', 'nom poste', 'poste'] },
        { n: 'diplomeAca', l: 'Diplôme académique', alias: ['diplome academique', 'diplôme académique', 'diplome aca'] },
        { n: 'diplomePro', l: 'Diplôme professionnel', alias: ['diplome professionnel', 'diplôme professionnel', 'diplome pro'], valeurs: { 'cap ep': 'CAP/EP', 'cap em': 'CAP/EM', 'capep': 'CAP/EP', 'capem': 'CAP/EM' } },
        { n: 'indice', l: 'Indice', alias: ['indice', 'indice reel', 'indice réel'] },
        { n: 'situationFamiliale', l: 'Situation familiale', alias: ['sit famille', 'situation familiale', 'sit famille m0e'] },
        { n: 'corps', l: 'Corps', alias: ['corps'] },
        { n: 'dateCA', l: "Date d'obtention du CA", alias: ['date optention du ca', "date obtention du ca", 'date ca'], type: 'date' },
        { n: 'anneeDeploiement', l: 'Année de déploiement', alias: ['annee de deploiement', 'année de déploiement'] },
        { n: 'anciennete', l: 'Ancienneté', alias: ['anciennete', 'ancienneté'], type: 'entier' },
        { n: 'telephone', l: 'Téléphone', alias: ['telephone', 'téléphone', 'tel', 'contact'] },
        { n: 'ph', l: 'Personne handicapée', alias: ['ph', 'handicap', 'personne handicapee'] },
        { n: 'categorie', l: 'Catégorie', alias: ['categorie', 'catégorie', 'categorie de personnel'], valeurs: { 'enseignant': 'Enseignant', 'administratif': 'Administratif', 'soutien': 'Soutien', 'personnel de soutien': 'Soutien' } },
        { n: 'qualite', l: 'Qualité', alias: ['qualite', 'qualité'] },
        { n: 'indicePaye', l: 'Indice payé', alias: ['indice paye', 'indice payé'] },
        /* Les alias couvrent à la fois la saisie manuelle et les intitulés des
           états de la circonscription (« Date 1ère Prise Serv », etc.). */
        { n: 'datePriseServiceFP', l: 'Première prise de service', alias: ['premiere prise de service', 'première prise de service', 'prise de service fonction publique', 'date de recrutement', 'date 1ere prise serv', 'date 1ère prise serv'], type: 'date' },
        { n: 'datePriseServiceDept', l: 'Prise de service département', alias: ['prise de service departement', 'prise de service département', 'arrivee dans le departement', 'date arrive departem', 'arrivee departement'], type: 'date' },
        { n: 'datePriseServiceEcole', l: "Prise de service école", alias: ['prise de service ecole', "prise de service école", "arrivee dans l'ecole", 'date arrive poste', 'arrivee au poste'], type: 'date' },
        { n: 'note2022', l: 'Note 2022', alias: ['note 2022', '2022', 'note evaluation 2022'] },
        { n: 'note2023', l: 'Note 2023', alias: ['note 2023', '2023', 'note evaluation 2023'] },
        { n: 'note2024', l: 'Note 2024', alias: ['note 2024', '2024', 'note evaluation 2024'] },
        { n: 'note2025', l: 'Note 2025', alias: ['note 2025', '2025', 'note evaluation 2025'] },
        { n: 'note2026', l: 'Note 2026', alias: ['note 2026', '2026', 'note evaluation 2026'] }
      ]
    },
    effectifs: {
      titre: 'Effectifs',
      cle: ['ecoleNom', 'annee'],
      ecole: true,
      champs: [
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', "nom de l'ecole", 'etablissement'] },
        { n: 'annee', l: 'Année scolaire', alias: ['annee', 'année', 'annee scolaire', 'année scolaire'] },
        { n: 'totalG', l: 'Total garçons', alias: ['garcons', 'garçons', 'total garcons', 'total g', 'masculin', 'g'], type: 'entier' },
        { n: 'totalF', l: 'Total filles', alias: ['filles', 'total filles', 'total f', 'feminin', 'féminin', 'f'], type: 'entier' },
        { n: 'handicapes', l: 'Dont handicapés', alias: ['handicapes', 'handicapés', 'enfants handicapes'], type: 'entier' },
        { n: 'redoublants', l: 'Redoublants', alias: ['redoublants', 'redoublant'], type: 'entier' },
        { n: 'sansActe', l: 'Sans acte de naissance', alias: ['sans acte', "sans acte de naissance"], type: 'entier' },
        { n: 'c_ci_G', l: 'CI G', alias: ['ci g', 'cig', 'ci garçons'], type: 'entier' },
        { n: 'c_ci_F', l: 'CI F', alias: ['ci f', 'cif', 'ci filles'], type: 'entier' },
        { n: 'c_cp_G', l: 'CP G', alias: ['cp g', 'cpg', 'cp garçons'], type: 'entier' },
        { n: 'c_cp_F', l: 'CP F', alias: ['cp f', 'cpf', 'cp filles'], type: 'entier' },
        { n: 'c_ce1_G', l: 'CE1 G', alias: ['ce1 g', 'ce1g', 'ce1 garçons'], type: 'entier' },
        { n: 'c_ce1_F', l: 'CE1 F', alias: ['ce1 f', 'ce1f', 'ce1 filles'], type: 'entier' },
        { n: 'c_ce2_G', l: 'CE2 G', alias: ['ce2 g', 'ce2g', 'ce2 garçons'], type: 'entier' },
        { n: 'c_ce2_F', l: 'CE2 F', alias: ['ce2 f', 'ce2f', 'ce2 filles'], type: 'entier' },
        { n: 'c_cm1_G', l: 'CM1 G', alias: ['cm1 g', 'cm1g', 'cm1 garçons'], type: 'entier' },
        { n: 'c_cm1_F', l: 'CM1 F', alias: ['cm1 f', 'cm1f', 'cm1 filles'], type: 'entier' },
        { n: 'c_cm2_G', l: 'CM2 G', alias: ['cm2 g', 'cm2g', 'cm2 garçons'], type: 'entier' },
        { n: 'c_cm2_F', l: 'CM2 F', alias: ['cm2 f', 'cm2f', 'cm2 filles'], type: 'entier' },
        // maternelle : effectif par section (petits, grands)
        { n: 's_eff_sp_G', l: 'SP G', alias: ['sp g', 'petits g', 'section des petits g', 'section petits g'], type: 'entier' },
        { n: 's_eff_sp_F', l: 'SP F', alias: ['sp f', 'petits f', 'section des petits f', 'section petits f'], type: 'entier' },
        { n: 's_eff_sg_G', l: 'SG G', alias: ['sg g', 'grands g', 'section des grands g', 'section grands g'], type: 'entier' },
        { n: 's_eff_sg_F', l: 'SG F', alias: ['sg f', 'grands f', 'section des grands f', 'section grands f'], type: 'entier' }
      ]
    },
    infrastructures: {
      titre: 'Infrastructures',
      cle: ['ecoleNom', 'typeLocal'],
      ecole: true,
      champs: [
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement'] },
        { n: 'typeLocal', l: 'Type de local', alias: ['type de local', 'local', 'type local'] },
        { n: 'anneeService', l: 'Année mise en service', alias: ['annee de mise en service', 'année mise en service', 'annee service'], type: 'entier' },
        { n: 'superficie', l: 'Superficie', alias: ['superficie', 'surface'], type: 'entier' },
        { n: 'natureMurs', l: 'Nature des murs', alias: ['nature des murs', 'murs'] },
        { n: 'natureToit', l: 'Nature du toit', alias: ['nature du toit', 'toit', 'toiture'] },
        { n: 'etat', l: 'État', alias: ['etat', 'état'] },
        { n: 'financeur', l: 'Financeur', alias: ['financeur', 'financement'] }
      ]
    },
    mobilier: {
      titre: 'Mobilier et matériel',
      cle: ['ecoleNom', 'designation'],
      ecole: true,
      champs: [
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement'] },
        { n: 'categorie', l: 'Catégorie', alias: ['categorie', 'catégorie'] },
        { n: 'designation', l: 'Désignation', alias: ['designation', 'désignation', 'libelle', 'libellé', 'article'] },
        { n: 'quantite', l: 'Quantité', alias: ['quantite', 'quantité', 'nombre', 'qte'], type: 'entier' },
        { n: 'etat', l: 'État', alias: ['etat', 'état'] },
        { n: 'classe', l: 'Classe concernée', alias: ['classe', 'cours', 'niveau'] }
      ]
    },
    examen: {
      titre: 'Candidats à l’examen blanc',
      collection: 'compositions',
      cle: ['nom'],
      ecole: false,
      champs: [
        { n: 'ordre', l: 'N° d’ordre', alias: ['n ordre', 'no ordre', "n° d'ordre", 'ordre'] },
        { n: 'nom', l: 'Nom et prénoms', alias: ['nom', 'noms et prenoms', 'nom et prenoms', 'candidat'] },
        { n: 'sexe', l: 'Sexe', alias: ['sexe', 'genre'], valeurs: { 'masculin': 'G', 'garcon': 'G', 'garçon': 'G', 'm': 'G', 'feminin': 'F', 'féminin': 'F', 'fille': 'F' } },
        { n: 'ecoleNom', l: 'École de provenance', alias: ['ecole de provenance', 'école de provenance', 'ecole', 'provenance'] },
        { n: 'dictee', l: 'Dictée', alias: ['dictee', 'dictée', 'dictee expression ecrite', 'dictée expression écrite'] },
        { n: 'communication', l: 'Communication écrite', alias: ['communication ecrite', 'communication écrite', 'expression ecrite', 'expression écrite', 'communication'] },
        { n: 'comprehension', l: 'Compréhension de l’écrit', alias: ["comprehension de l ecrit", 'comprehension', 'compréhension'] },
        { n: 'maths', l: 'Mathématique', alias: ['mathematique', 'mathématique', 'maths', 'mathematiques'] },
        { n: 'est', l: 'EST', alias: ['est'] },
        { n: 'es', l: 'ES', alias: ['es'] },
        { n: 'ea_vivant', l: 'EA vivant', alias: ['ea vivant', 'ea v'] },
        { n: 'ea_artistique', l: 'EA artistique', alias: ['ea artistique', 'ea a', 'ea plastique'] },
        { n: 'eps', l: 'EPS', alias: ['eps'] }
      ]
    },
    apprenants: {
      titre: 'Apprenants',
      cle: ['nom', 'prenoms', 'dateNaiss'],
      ecole: true,
      champs: [
        { n: 'npi', l: 'NPI', alias: ['npi', 'n p i', 'numero personnel'] },
        { n: 'matricule', l: 'Matricule', alias: ['matricule', 'matricule educmaster'] },
        { n: 'nom', l: 'Nom', alias: ['nom', 'noms'] },
        { n: 'prenoms', l: 'Prénoms', alias: ['prenoms', 'prénoms'] },
        { n: 'sexe', l: 'Sexe', alias: ['sexe', 'genre'], valeurs: { 'masculin': 'G', 'garcon': 'G', 'garçon': 'G', 'm': 'G', 'feminin': 'F', 'féminin': 'F', 'fille': 'F' } },
        { n: 'dateNaiss', l: 'Date de naissance', alias: ['date de naissance', 'naissance', 'ne le', 'né(e) le'], type: 'date' },
        { n: 'lieuNaiss', l: 'Lieu de naissance', alias: ['lieu de naissance', 'lieu'] },
        { n: 'numActe', l: "N° d'acte de naissance", alias: ["n° d'acte de naissance", 'numero acte', "n acte"] },
        { n: 'pere', l: 'Nom du père', alias: ['nom du pere', 'pere', 'père'] },
        { n: 'mere', l: 'Nom de la mère', alias: ['nom de la mere', 'mere', 'mère'] },
        { n: 'telParent', l: 'Téléphone du parent', alias: ['telephone du parent', 'contact parent', 'telephone'] },
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement'] },
        { n: 'cours', l: 'Cours', alias: ['cours', 'classe', 'niveau'] },
        { n: 'redoublant', l: 'Redoublant', alias: ['redoublant', 'redoublante'], valeurs: { 'oui': 'Oui', 'non': 'Non', 'o': 'Oui', 'n': 'Non' } }
      ]
    },
    evaluations: {
      titre: 'Relevés d’évaluation',
      cle: ['ecoleNom', 'cours'],
      ecole: true,
      champs: [
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement'] },
        { n: 'cours', l: 'Cours', alias: ['cours', 'classe', 'niveau'] },
        { n: 'inscritsG', l: 'Inscrits G', alias: ['inscrits g', 'inscrits garcons'], type: 'entier' },
        { n: 'inscritsF', l: 'Inscrits F', alias: ['inscrits f', 'inscrits filles'], type: 'entier' },
        { n: 'composesG', l: 'Ont composé G', alias: ['ont compose g', 'ont composé g', 'composes g'], type: 'entier' },
        { n: 'composesF', l: 'Ont composé F', alias: ['ont compose f', 'ont composé f', 'composes f'], type: 'entier' },
        { n: 'admisG', l: 'Ont atteint le seuil G', alias: ['ont atteint le seuil g', 'admis g', 'seuil g'], type: 'entier' },
        { n: 'admisF', l: 'Ont atteint le seuil F', alias: ['ont atteint le seuil f', 'admis f', 'seuil f'], type: 'entier' }
      ]
    },
    cep: {
      titre: 'Candidats au CEP (liste EDUCMaster ou Excel)',
      cle: ['nom', 'prenoms', 'dateNaiss'],
      ecole: true,
      champs: [
        { n: 'matricule', l: 'Matricule / N° EDUCMaster', alias: ['matricule', 'matricule educmaster', 'numero educmaster', 'n educmaster', 'educmaster', 'identifiant', 'id eleve', 'matricule eleve'] },
        { n: 'npi', l: 'NPI', alias: ['npi', 'n p i', 'numero personnel d identification', 'nip'] },
        { n: 'numTable', l: 'N° de table', alias: ['n de table', 'numero de table', 'n table', 'table'] },
        { n: 'nom', l: 'Nom (ou nom et prénoms)', alias: ['nom', 'noms', 'nom et prenoms', 'nom & prenoms', 'nom prenoms', 'candidat', 'nom de l eleve', 'nom eleve'] },
        { n: 'prenoms', l: 'Prénoms', alias: ['prenoms', 'prénoms', 'prenom', 'prénom', 'prenoms de l eleve'] },
        { n: 'sexe', l: 'Sexe', alias: ['sexe', 'genre', 's'], valeurs: { 'masculin': 'M', 'm': 'M', 'g': 'M', 'garcon': 'M', 'garçon': 'M', 'feminin': 'F', 'féminin': 'F', 'f': 'F', 'fille': 'F' } },
        { n: 'dateNaiss', l: 'Date de naissance', alias: ['date de naissance', 'naissance', 'ne le', 'né(e) le', 'date naissance', 'date nais'], type: 'date' },
        { n: 'lieuNaiss', l: 'Lieu de naissance', alias: ['lieu de naissance', 'lieu', 'lieu naissance', 'ne a'] },
        { n: 'numActe', l: "N° d'acte", alias: ["n° acte", 'numero acte', "numéro d'acte", 'acte', 'n acte de naissance'] },
        { n: 'pere', l: 'Nom du père', alias: ['pere', 'père', 'nom du pere'] },
        { n: 'mere', l: 'Nom de la mère', alias: ['mere', 'mère', 'nom de la mere'] },
        { n: 'parent_signataire', l: 'Parent / tuteur', alias: ['parent', 'tuteur', 'nom du parent', 'parent tuteur', 'nom du tuteur'] },
        { n: 'telParent', l: 'Téléphone du parent', alias: ['telephone du parent', 'contact parent', 'telephone', 'contact', 'tel parent', 'tel'] },
        { n: 'residence', l: 'Résidence des parents', alias: ['residence', 'residence des parents', 'adresse', 'domicile'] },
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement', 'ecole de provenance'] },
        { n: 'option', l: 'Option', alias: ['option'] },
        { n: 'choix1', l: '1er établissement choisi', alias: ['choix 1', 'choix1', 'etablissement 1', '1er choix'] },
        { n: 'choix2', l: '2e établissement choisi', alias: ['choix 2', 'choix2', 'etablissement 2', '2e choix'] },
        { n: 'choix3', l: '3e établissement choisi', alias: ['choix 3', 'choix3', 'etablissement 3', '3e choix'] },
        { n: 'session', l: 'Session', alias: ['session', 'annee', 'année'] },
        { n: 'centre', l: "Centre d'examen", alias: ['centre', "centre d'examen", 'centre de composition'] }
      ]
    },
    cni: {
      titre: "Cartes d'identité scolaires (liste EDUCMaster ou Excel)",
      cle: ['nom', 'prenoms', 'dateNaiss'],
      ecole: true,
      champs: [
        { n: 'matricule', l: 'Matricule / N° EDUCMaster', alias: ['matricule', 'matricule educmaster', 'numero educmaster', 'educmaster', 'identifiant', 'npi', 'nip'] },
        { n: 'nom', l: 'Nom (ou nom et prénoms)', alias: ['nom', 'noms', 'nom et prenoms', 'nom & prenoms', 'eleve', 'nom de l eleve'] },
        { n: 'prenoms', l: 'Prénoms', alias: ['prenoms', 'prénoms', 'prenom', 'prénom'] },
        { n: 'sexe', l: 'Sexe', alias: ['sexe', 'genre', 's'], valeurs: { 'masculin': 'M', 'm': 'M', 'g': 'M', 'garcon': 'M', 'garçon': 'M', 'feminin': 'F', 'féminin': 'F', 'f': 'F', 'fille': 'F' } },
        { n: 'dateNaiss', l: 'Date de naissance', alias: ['date de naissance', 'naissance', 'ne le', 'né(e) le', 'date naissance'], type: 'date' },
        { n: 'lieuNaiss', l: 'Lieu de naissance', alias: ['lieu de naissance', 'lieu', 'lieu naissance'] },
        { n: 'numActe', l: "N° d'acte", alias: ["n° acte", 'numero acte', 'acte', 'n acte de naissance'] },
        { n: 'classe', l: 'Classe', alias: ['classe', 'cours', 'niveau'] },
        { n: 'pere', l: 'Nom du père', alias: ['pere', 'père', 'nom du pere'] },
        { n: 'mere', l: 'Nom de la mère', alias: ['mere', 'mère', 'nom de la mere'] },
        { n: 'parent', l: 'Parent à prévenir', alias: ['parent', 'tuteur', 'nom du parent'] },
        { n: 'telephone', l: 'Téléphone', alias: ['telephone', 'téléphone', 'contact', 'tel', 'telephone du parent'] },
        { n: 'domicile', l: 'Domicile', alias: ['domicile', 'adresse', 'residence'] },
        { n: 'nationalite', l: 'Nationalité', alias: ['nationalite', 'nationalité'] },
        { n: 'ecoleNom', l: 'École', alias: ['ecole', 'école', 'etablissement'] }
      ]
    }
  };

  /* ---------------- Reconnaissance des colonnes ---------------- */

  function normaliser(texte) {
    return String(texte || '').toLowerCase().trim()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, ' ').trim();
  }

  /** Associe chaque colonne du fichier à une rubrique, quand elle est reconnue. */
  function reconnaitre(entetes, modele) {
    return entetes.map(titre => {
      const t = normaliser(titre);
      if (!t) return null;
      let exact = null, partiel = null;
      modele.champs.forEach(champ => {
        const candidats = [champ.l].concat(champ.alias || []).map(normaliser);
        if (candidats.indexOf(t) >= 0) exact = champ.n;
        /* rapprochement partiel seulement pour un intitulé d'au moins 3 lettres (« N° » n'est pas « NPI ») */
        else if (!partiel && t.length >= 3 && candidats.some(c => c && c.length >= 3 && (t.indexOf(c) === 0 || c.indexOf(t) === 0))) {
          partiel = champ.n;
        }
      });
      return { exact, partiel };
    }).map((r, i, tous) => r && (r.exact || (r.partiel && !tous.some(x => x && x.exact === r.partiel) ? r.partiel : null)));
  }

  function convertir(valeur, champ) {
    let v = String(valeur === undefined || valeur === null ? '' : valeur).trim();
    if (v === '') return '';
    if (champ.valeurs) {
      const cle = normaliser(v);
      for (const k in champ.valeurs) {
        if (normaliser(k) === cle) return champ.valeurs[k];
      }
    }
    if (champ.type === 'entier') {
      const n = parseInt(v.replace(/[^0-9-]/g, ''), 10);
      return isNaN(n) ? '' : n;
    }
    if (champ.type === 'date') return convertirDate(v);
    return v;
  }

  /** Accepte 12/03/1975, 1975-03-12, et le numéro de série d'Excel. */
  function convertirDate(v) {
    let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(v);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    m = /^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/.exec(v);
    if (m) {
      return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
    }
    if (/^\d{4,6}$/.test(v)) {
      /* Numéro de série Excel : jours écoulés depuis le 30 décembre 1899. */
      const d = new Date(Date.UTC(1899, 11, 30) + Number(v) * 86400000);
      if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
    }
    return v;
  }

  global.Import = { MODELES, reconnaitre, convertir, normaliser };
})(window);
