/* CS Pobè — certificats administratifs.
   Les modèles reprennent les formulations des imprimés de la circonscription :
   même intitulé, mêmes mentions, même signataire. Ce que l'application connaît
   de l'agent est reporté automatiquement ; le reste est demandé. */
(function (global) {
  'use strict';

  /* Le signataire commande le cachet apposé : le chef de circonscription, ou
     le directeur d'école pour les deux certificats qui relèvent de lui. */
  const MODELES = [
    {
      cle: 'PRESENCE_POSTE_CS', titre: 'CERTIFICAT DE PRÉSENCE AU POSTE',
      signataire: 'CS', verbe: 'certifie',
      reference: 'SO N° {numero}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'depuis', 'jusqua'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.signataire + ', Chef de la Circonscription Scolaire '
          + 'de Pobè,', 'Certifie que ' + a.civilite + ' ' + a.nom + ',',
          'Né(e) le ' + a.naissance + ' à ' + a.lieuNaiss + ',',
          'Première prise de service : ' + a.priseServiceFP + ',',
          'Numéro matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Corps et grade payé : ' + a.grade + ',',
          'Est en service à ' + a.ecole + ', Circonscription Scolaire de Pobè, '
            + 'département du Plateau,',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En qualité de ' + a.fonction + ',',
          'Depuis le ' + (c.depuis || a.priseServiceEcole) + ' jusqu’à ce jour '
            + (c.jusqua || a.aujourdhui) + '.'];
      }
    },
    {
      cle: 'PRESENCE_POSTE_ECOLE', titre: 'CERTIFICAT DE PRÉSENCE AU POSTE',
      signataire: 'ECOLE', verbe: 'atteste',
      reference: 'SO N° {numero}/{ecole}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'depuis', 'jusqua'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.directeur + ', Directeur de ' + a.ecole + ',',
          'Atteste que ' + a.civilite + ' ' + a.nom + ',',
          'Né(e) le ' + a.naissance + ' à ' + a.lieuNaiss + ',',
          'Première prise de service : ' + a.priseServiceFP + ',',
          'Numéro matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Corps et grade payé : ' + a.grade + ',',
          'Est en service à ' + a.ecole + ', Circonscription Scolaire de Pobè, '
            + 'département du Plateau,',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En qualité de ' + a.fonction + ',',
          'Depuis le ' + (c.depuis || a.priseServiceEcole) + ' jusqu’à ce jour '
            + (c.jusqua || a.aujourdhui) + '.'];
      }
    },
    {
      cle: 'TRAVAIL', titre: 'CERTIFICAT DE TRAVAIL',
      signataire: 'CS', verbe: 'certifie',
      reference: 'SO N° {numero}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'depuis', 'jusqua'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.signataire + ', Chef de la Circonscription Scolaire '
          + 'de Pobè,', 'Certifie que ' + a.civilite + ' ' + a.nom + ',',
          'Grade : ' + a.grade + ' — Matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Est en service à l’école ' + a.ecole + ',',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En qualité de ' + a.fonction + ',',
          'Depuis le ' + (c.depuis || a.priseServiceEcole) + ' jusqu’à ce jour '
            + (c.jusqua || a.aujourdhui) + '.'];
      }
    },
    {
      cle: 'PRISE_SERVICE_CS', titre: 'CERTIFICAT DE PRISE DE SERVICE',
      signataire: 'CS', verbe: 'certifie',
      reference: 'SO N° {numero}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'remplacement', 'nb_classes',
        'date_prise', 'motif'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.signataire + ', Chef de la Circonscription Scolaire '
          + 'de Pobè,', 'Certifie que ' + a.civilite + ' ' + a.nom + ',',
          'Grade : ' + a.grade + ' — Matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Affecté(e) à l’école ' + a.ecole + ',',
          'En remplacement de ' + (c.remplacement || '…') + ',',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En qualité de ' + a.fonction
            + (c.nb_classes ? ' de ' + c.nb_classes + ' classe(s)' : '') + ',',
          'A effectivement pris service le ' + (c.date_prise || a.priseServiceEcole) + '.',
          c.motif ? 'Motif : ' + c.motif + '.' : ''];
      }
    },
    {
      cle: 'PRISE_SERVICE_ECOLE', titre: 'CERTIFICAT DE PRISE DE SERVICE',
      signataire: 'ECOLE', verbe: 'certifie',
      reference: 'SO N° {numero}/{ecole}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'date_prise'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.directeur + ', Directeur de ' + a.ecole + ',',
          'Certifie que ' + a.civilite + ' ' + a.nom + ',',
          'Grade : ' + a.grade + ' — Matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Affecté(e) à l’école ' + a.ecole + ',',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En qualité de ' + a.fonction + ',',
          'A effectivement pris service le ' + (c.date_prise || a.priseServiceEcole) + '.'];
      }
    },
    {
      cle: 'DIRECTION', titre: 'ATTESTATION DE DIRECTION',
      signataire: 'CS', verbe: 'atteste',
      reference: 'SO N° {numero}/CS-POBE/DDEMP-P/SP',
      champs: ['reference_acte', 'date_acte', 'depuis', 'nb_classes', 'pour_compter',
        'remplacement', 'matricule_remplace', 'motif'],
      corps: function (a, c) {
        return ['Je soussigné ' + a.signataire + ', Chef de la Circonscription Scolaire '
          + 'de Pobè,', 'Atteste que ' + a.civilite + ' ' + a.nom + ',',
          'Grade : ' + a.grade + ' — Matricule : ' + a.matricule + ' — NIP : ' + a.nip + ',',
          'Affecté(e) à ' + a.ecole + ' du ' + (c.depuis || a.priseServiceEcole) + ',',
          'Est effectivement Directeur de ' + a.ecole + ',',
          'Depuis le ' + (c.depuis || a.priseServiceEcole) + ',',
          'Et demeurant réellement Directeur de '
            + (c.nb_classes || '…') + ' classe(s),',
          'Pour compter du ' + (c.pour_compter || '…') + ',',
          'Suivant ' + (c.reference_acte || '…') + ' du ' + (c.date_acte || '…') + ',',
          'En remplacement de ' + (c.remplacement || '…')
            + (c.matricule_remplace ? ', matricule ' + c.matricule_remplace : '') + '.',
          c.motif ? 'Motif : ' + c.motif + '.' : ''];
      }
    },
    {
      cle: 'PRESENCE_AME', titre: 'ATTESTATION DE PRÉSENCE AU POSTE',
      signataire: 'ECOLE', verbe: 'atteste',
      reference: 'N° {numero}/{annee}/DIR/……',
      /* Le chef d'établissement délivre, l'APE et le conseiller pédagogique
         visent, le chef de circonscription contresigne. */
      visas: ['Le Représentant de l’APE', 'Le Conseiller Pédagogique'],
      contreSeing: 'CP_ZONE',
      champs: ['qualite_ame', 'classe_attribuee', 'edition', 'mois', 'periode_du',
        'periode_au', 'jours_presence', 'total_exigible', 'ponctualite', 'observations'],
      corps: function (a, c) {
        return ['Délivrée à ' + a.civilite + ' ' + a.nom + ',',
          'Titulaire de : ' + (c.qualite_ame || a.fonction) + ',',
          'Classe attribuée : ' + (c.classe_attribuee || a.cours) + ',',
          'Pour sa présence effective au poste dans le cadre du Programme spécial de '
            + 'pré-insertion professionnelle dans l’enseignement, édition '
            + (c.edition || '……') + ', au titre du mois de ' + (c.mois || '……') + '.',
          'Période allant du ' + (c.periode_du || '……') + ' au ' + (c.periode_au || '……') + '.',
          'Nombre de jours de présence : ' + (c.jours_presence || '……')
            + ' sur un total exigible de ' + (c.total_exigible || '……') + ' jours.',
          'Ponctualité : ' + (c.ponctualite || '……') + '.',
          c.observations ? 'Autres observations : ' + c.observations + '.' : ''];
      }
    },
    {
      cle: 'REPRISE_SERVICE', titre: 'CERTIFICAT DE REPRISE DE SERVICE',
      signataire: 'ECOLE', verbe: 'certifie',
      reference: 'N° {numero}/{annee}/DIR/……',
      /* Le chef d'établissement délivre, l'APE vise, et le conseiller
         pédagogique de la zone contresigne : le chef de circonscription
         n'intervient pas sur cette pièce. */
      visas: ['Le Président ou Secrétaire de l’APE'],
      contreSeing: 'CP_ZONE',
      champs: ['qualite_ame', 'classe_attribuee', 'edition', 'date_reprise',
        'titre_affectation', 'date_acte'],
      corps: function (a, c) {
        return ['Nous, soussignés, certifions que ' + a.civilite + ' ' + a.nom + ',',
          'Titulaire de : ' + (c.qualite_ame || a.fonction) + ',',
          'Et mis(e) à disposition dans le cadre du Programme spécial de pré-insertion '
            + 'professionnelle dans l’enseignement, édition ' + (c.edition || '……') + ',',
          'A effectivement repris service le ' + (c.date_reprise || '……') + ',',
          'Conformément au titre d’affectation n° ' + (c.titre_affectation || '……')
            + ' du ' + (c.date_acte || '……') + ',',
          'En qualité de ' + (c.qualite_ame || a.fonction) + '.',
          'Classe ou section attribuée : ' + (c.classe_attribuee || a.cours) + '.'];
      }
    },
    {
      cle: 'EVALUATION_ACE', titre: 'FICHE D’ÉVALUATION DE L’AGENT CONTRACTUEL DE L’ÉTAT',
      sousTitre: 'Pour ACE n’ayant pas la qualité de supérieur hiérarchique immédiat',
      direction: 'DIRECTION DE L’ADMINISTRATION ET DES FINANCES',
      signataire: 'CS', verbe: 'évalue', evaluation: true,
      reference: 'N° {numero}/{annee}/DAF',
      visas: ['Le supérieur hiérarchique immédiat', 'Le responsable de la structure'],
      champs: ['situation_familiale', 'situation_militaire', 'diplome_recrutement',
        'adresse', 'categorie', 'echelle', 'echelon', 'emploi', 'contrat_initial',
        'contrat_renouvele', 'contrat_indetermine', 'avenant',
        'periode_du', 'periode_au', 'objectifs', 'resultats', 'contraintes'],
      corps: function (a, c) {
        return ['Nom et prénoms : ' + a.nom + '.',
          'Lieu et date de naissance : ' + a.lieuNaiss + ', le ' + a.naissance + '.',
          'Téléphone : ' + a.telephone + ' — Adresse : ' + (c.adresse || '……') + '.',
          'Situation familiale : ' + (c.situation_familiale || '……')
            + ' — Situation militaire : ' + (c.situation_militaire || '……') + '.',
          'Diplôme de recrutement : ' + (c.diplome_recrutement || a.diplomePro) + '.',
          'Matricule : ' + a.matricule + '.',
          'Date de première prise de service : ' + a.priseServiceFP + '.',
          'Grade actuel : ' + a.grade + ' — Catégorie : ' + (c.categorie || '……')
            + ' — Échelle : ' + (c.echelle || '……') + ' — Échelon : '
            + (c.echelon || '……') + '.',
          'Emploi : ' + (c.emploi || a.fonction) + '.',
          'Références des actes de carrière — contrat initial : '
            + (c.contrat_initial || '……') + ' ; contrat renouvelé : '
            + (c.contrat_renouvele || '……') + ' ; contrat à durée indéterminée : '
            + (c.contrat_indetermine || '……') + ' ; avenant : ' + (c.avenant || '……') + '.',
          'Période de référence : du ' + (c.periode_du || '……') + ' au '
            + (c.periode_au || '……') + '.'];
      }
    },
    {
      cle: 'SCOLARITE', titre: 'CERTIFICAT DE SCOLARITÉ',
      signataire: 'ECOLE', verbe: 'certifie', source: 'apprenant',
      reference: 'N° {numero}',
      champs: ['inscrit_depuis', 'assiduite', 'conduite', 'travail', 'observations'],
      corps: function (a, c) {
        return ['Le Directeur de ' + a.ecole + ',',
          'Certifie que l’élève ' + a.nom + ',',
          'Né(e) le ' + a.naissance + ' à ' + a.lieuNaiss + ', commune de ' + a.commune + ',',
          'Fils ou fille de ' + a.pere + ' et de ' + a.mere + ',',
          'Est effectivement inscrit(e) dans ladite école sous le numéro matricule '
            + a.matricule + ' depuis le ' + (c.inscrit_depuis || '……')
            + ', et y poursuit actuellement ses études en classe de ' + a.cours + '.',
          'Avec les appréciations suivantes — assiduité : ' + (c.assiduite || '……')
            + ' ; conduite : ' + (c.conduite || '……') + ' ; travail : '
            + (c.travail || '……') + '.',
          'Matricule EDUCMaster : ' + a.matricule + ' — NPI : ' + a.nip + '.',
          c.observations ? 'Observations particulières : ' + c.observations + '.' : ''];
      }
    },
    {
      cle: 'PRISE_EN_CHARGE', titre: 'CERTIFICAT DE PRISE EN CHARGE',
      sousTitre: 'Admission des fonctionnaires et assimilés',
      signataire: 'CS', verbe: 'certifie',
      reference: 'SO N° {numero}/CS-POBE/DDEMP-P/SP',
      champs: ['budget', 'categorie_hospitalisation'],
      corps: function (a, c) {
        return ['Nom et prénoms : ' + a.nom + ',',
          'Profession : ' + a.fonction + ',',
          'En service à ' + a.ecole + ',',
          'Indice de traitement : ' + a.indice + ',',
          'Budget devant supporter l’hospitalisation : ' + (c.budget || '…') + ',',
          'Catégorie d’hospitalisation : ' + (c.categorie_hospitalisation || '…') + '.'];
      }
    }
  ];

  /* Les critères de la fiche d'évaluation, avec leur barème. */
  const CRITERES = [
    { groupe: 'Compétence professionnelle (08)', cle: 'taux_realisation',
      libelle: 'Taux de réalisation des attentes assignées', bareme: 8 },
    { groupe: 'Conscience professionnelle (07)', cle: 'ponctualite_note',
      libelle: 'Ponctualité', bareme: 2 },
    { groupe: 'Conscience professionnelle (07)', cle: 'assiduite_note',
      libelle: 'Assiduité', bareme: 2 },
    { groupe: 'Conscience professionnelle (07)', cle: 'ethique',
      libelle: 'Éthique professionnelle', bareme: 1.5 },
    { groupe: 'Conscience professionnelle (07)', cle: 'valeurs',
      libelle: 'Sens des valeurs', bareme: 1.5 },
    { groupe: 'Sens du service public (05)', cle: 'sacrifice',
      libelle: 'Esprit de sacrifice', bareme: 1 },
    { groupe: 'Sens du service public (05)', cle: 'bien_public',
      libelle: 'Respect du bien public', bareme: 2 },
    { groupe: 'Sens du service public (05)', cle: 'hierarchie',
      libelle: 'Respect de la hiérarchie', bareme: 2 }
  ];

  const LIBELLES = {
    qualite_ame: 'Qualité (instituteur, adjoint, élève-instituteur)',
    classe_attribuee: 'Classe ou section attribuée',
    edition: 'Édition du programme',
    mois: 'Mois concerné',
    periode_du: 'Période du',
    periode_au: 'Période au',
    jours_presence: 'Nombre de jours de présence',
    total_exigible: 'Total exigible (jours)',
    ponctualite: 'Ponctualité (bonne, moyenne, mauvaise)',
    observations: 'Observations',
    date_reprise: 'Date de reprise de service',
    titre_affectation: 'Titre d’affectation n°',
    situation_familiale: 'Situation familiale',
    situation_militaire: 'Situation militaire',
    diplome_recrutement: 'Diplôme de recrutement',
    adresse: 'Adresse',
    categorie: 'Catégorie', echelle: 'Échelle', echelon: 'Échelon', emploi: 'Emploi',
    contrat_initial: 'Contrat initial',
    contrat_renouvele: 'Contrat de travail renouvelé',
    contrat_indetermine: 'Contrat à durée indéterminée',
    avenant: 'Avenant',
    objectifs: 'Rappel des objectifs de la période',
    resultats: 'Résultats de la période',
    contraintes: 'Contraintes et difficultés',
    inscrit_depuis: 'Inscrit dans l’école depuis le',
    assiduite: 'Assiduité', conduite: 'Conduite', travail: 'Travail',
    reference_acte: 'Arrêté, décision ou note de service n°',
    date_acte: 'Date de l’acte',
    depuis: 'Depuis le',
    jusqua: 'Jusqu’au',
    remplacement: 'En remplacement de',
    matricule_remplace: 'Matricule du remplacé',
    nb_classes: 'Nombre de classes',
    date_prise: 'Date de prise de service',
    pour_compter: 'Pour compter du',
    motif: 'Motif',
    budget: 'Budget supportant l’hospitalisation',
    categorie_hospitalisation: 'Catégorie d’hospitalisation'
  };

  const TYPES_DATE = ['date_acte', 'depuis', 'jusqua', 'date_prise', 'pour_compter',
    'periode_du', 'periode_au', 'date_reprise', 'inscrit_depuis'];
  const TYPES_LONG = ['observations', 'objectifs', 'resultats', 'contraintes'];

  function modele(cle) {
    return MODELES.filter(m => m.cle === cle)[0] || MODELES[0];
  }

  global.Certificats = { MODELES, LIBELLES, TYPES_DATE, TYPES_LONG, CRITERES, modele };
})(window);
