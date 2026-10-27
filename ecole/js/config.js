/* CS Pobè — configuration du poste.
   Le même code sert la circonscription et une école : seul ce fichier change.
   En mode ÉCOLE, l'application ne connaît qu'un établissement, celui que le
   directeur inscrit à la première ouverture, et les écrans propres à
   l'administration de la circonscription ne s'affichent pas. */
(function (global) {
  'use strict';

  const MODE = 'ECOLE';   // ou 'CIRCONSCRIPTION'

  /* Les pages réservées à la circonscription. */
  const PAGES_CIRCONSCRIPTION = [
    'ecoles',            // la liste des 155 écoles
    'administratif',     // le personnel du bureau de la circonscription
    'analyses',          // les écarts et synthèses de la circonscription
    'cm2',               // le suivi des candidats au CEP de toutes les écoles
    'examen',            // l'examen blanc et ses centres
    'visites',           // les visites et inspections
    'courriers',         // l'archive du courrier de la circonscription
    'repertoires', 'bilans',       // les répertoires de la circonscription
    'whatsapp',          // le groupe WhatsApp des directeurs, administré par la circonscription
    'maFiche'            // le choix de son école parmi toutes celles de la circonscription ;
                          // en mode ÉCOLE, le bouton du bandeau suffit, l'école étant déjà unique
  ];
  /* Le cachet et les signatures restent accessibles à l'école : elle a les
     siens, et ses documents ne valent rien sans eux. */

  const TITRES = {
    CIRCONSCRIPTION: {
      titre: '\uE022 Circonscription Scolaire de POBÈ',
      sousTitre: 'Département du Plateau — République du Bénin'
    },
    ECOLE: {
      titre: '\uE022 {ecole}',
      sousTitre: 'Circonscription Scolaire de Pobè — Département du Plateau'
    }
  };

  function estEcole() { return MODE === 'ECOLE'; }

  /** Une page est-elle visible dans ce mode ? */
  function pageVisible(page) {
    return !estEcole() || PAGES_CIRCONSCRIPTION.indexOf(page) < 0;
  }

  /* Version de l'application (affichée dans le menu ; lue aussi pour l'APK et l'installateur Windows). */
  global.Config = { MODE, estEcole, pageVisible, PAGES_CIRCONSCRIPTION, TITRES,
    version: '2.11.1' };
})(window);
