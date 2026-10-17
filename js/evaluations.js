/* CS Pobè — règles des évaluations.
   Les onze matières, le calendrier des évaluations formatives et sommatives,
   et le seuil de réussite. Le CI ne compose pas la première sommative. */
(function (global) {
  'use strict';

  /* Les onze matières, dans l'ordre du relevé. */
  const MATIERES = [
    { cle: 'comm_orale', libelle: 'Communication orale', abrege: 'CO' },
    { cle: 'dictee', libelle: 'Dictée', abrege: 'DICT' },
    { cle: 'expression_ecrite', libelle: 'Expression écrite', abrege: 'EE' },
    { cle: 'comprehension', libelle: 'Compréhension de l’écrit', abrege: 'COMP' },
    { cle: 'anglais', libelle: 'Anglais', abrege: 'ANG' },
    { cle: 'maths', libelle: 'Mathématique', abrege: 'MATH' },
    { cle: 'est', libelle: 'EST', abrege: 'EST' },
    { cle: 'es', libelle: 'ES', abrege: 'ES' },
    { cle: 'ea_vivant', libelle: 'EA vivant', abrege: 'EA-V' },
    { cle: 'ea_plastique', libelle: 'EA plastique', abrege: 'EA-P' },
    { cle: 'eps', libelle: 'EPS', abrege: 'EPS' }
  ];

  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  const SEUIL_MATIERE = 10;

  /* Formatives chaque mois, sommatives à la fin de chaque trimestre. Les
     sommatives portent un numéro de 1 à 3, les formatives de 1 à 6. */
  const PERIODES = [
    { type: 'FORMATIVE', numero: 1, mois: 'Octobre' },
    { type: 'FORMATIVE', numero: 2, mois: 'Novembre' },
    { type: 'SOMMATIVE', numero: 1, mois: 'Décembre' },
    { type: 'FORMATIVE', numero: 3, mois: 'Janvier' },
    { type: 'FORMATIVE', numero: 4, mois: 'Février' },
    { type: 'SOMMATIVE', numero: 2, mois: 'Mars' },
    { type: 'FORMATIVE', numero: 5, mois: 'Avril' },
    { type: 'FORMATIVE', numero: 6, mois: 'Mai' },
    { type: 'SOMMATIVE', numero: 3, mois: 'Juin' }
  ];

  function libellePeriode(p) {
    return (p.type === 'SOMMATIVE' ? 'Sommative n° ' : 'Formative n° ')
      + p.numero + ' — ' + p.mois;
  }

  /**
   * Le CI ne compose pas la première évaluation sommative : les apprenants
   * arrivent tout juste et n'ont pas encore couvert le programme.
   */
  function concerne(cours, periode) {
    if (cours === 'CI' && periode.type === 'SOMMATIVE' && Number(periode.numero) === 1) {
      return false;
    }
    return true;
  }

  function periodesDe(cours) {
    return PERIODES.filter(p => concerne(cours, p));
  }

  /**
   * Nombre de maîtrises exigées.
   * Neuf matières composées : six. Onze matières : les deux tiers, soit huit.
   * Entre les deux, la proportion des deux tiers s'applique aussi, pour ne pas
   * créer de marche d'escalier.
   */
  function maitrisesRequises(nombreComposees) {
    const n = Number(nombreComposees) || 0;
    if (n <= 0) return 0;
    if (n <= 9) return Math.min(6, n);
    return Math.ceil(n * 2 / 3);
  }

  function note(source, cle) {
    const v = parseFloat(String(source[cle] === undefined ? '' : source[cle]).replace(',', '.'));
    return isNaN(v) ? null : v;
  }

  /** Résultat d'un apprenant : maîtrises, seuil exigé, moyenne. */
  function resultat(source) {
    const notes = MATIERES.map(m => note(source, m.cle));
    const composees = notes.filter(n => n !== null);
    const maitrises = composees.filter(n => n >= SEUIL_MATIERE).length;
    const requis = maitrisesRequises(composees.length);
    const total = composees.reduce((s, n) => s + n, 0);
    return {
      notes: notes, composees: composees.length, aCompose: composees.length > 0,
      maitrises: maitrises, requis: requis,
      total: Math.round(total * 100) / 100,
      moyenne: composees.length ? Math.round(total / composees.length * 100) / 100 : null,
      admis: composees.length > 0 && maitrises >= requis
    };
  }

  /** Agrège un relevé : inscrits, composants, reçus, taux, par sexe. */
  function bilan(releve) {
    const lire = c => Math.max(0, parseInt(releve[c], 10) || 0);
    const g = { inscrits: lire('inscritsG'), composes: lire('composesG'), admis: lire('admisG') };
    const f = { inscrits: lire('inscritsF'), composes: lire('composesF'), admis: lire('admisF') };
    const taux = x => x.composes ? Math.round(x.admis / x.composes * 1000) / 10 : null;
    const total = {
      inscrits: g.inscrits + f.inscrits,
      composes: g.composes + f.composes,
      admis: g.admis + f.admis
    };
    g.taux = taux(g); f.taux = taux(f); total.taux = taux(total);
    total.absents = total.inscrits - total.composes;
    total.ecartGenre = (g.taux !== null && f.taux !== null)
      ? Math.round((f.taux - g.taux) * 10) / 10 : null;
    return { g: g, f: f, total: total };
  }

  function appreciation(taux) {
    if (taux === null || taux === undefined) return 'Non communiqué';
    if (taux >= 90) return 'Très satisfaisant';
    if (taux >= 75) return 'Satisfaisant';
    if (taux >= 60) return 'Acceptable';
    if (taux >= 40) return 'Préoccupant';
    return 'À renforcer';
  }

  /** Cohérence d'un relevé : les sous-ensembles ne peuvent pas dépasser. */
  function anomalies(releve) {
    const b = bilan(releve);
    const sortie = [];
    [['G', b.g], ['F', b.f]].forEach(([sexe, x]) => {
      if (x.composes > x.inscrits) {
        sortie.push('Ont composé (' + sexe + ') = ' + x.composes
          + ' dépasse les inscrits (' + x.inscrits + ').');
      }
      if (x.admis > x.composes) {
        sortie.push('Ont atteint le seuil (' + sexe + ') = ' + x.admis
          + ' dépasse ceux qui ont composé (' + x.composes + ').');
      }
    });
    return sortie;
  }

  global.Evaluations = { MATIERES, COURS, PERIODES, SEUIL_MATIERE, libellePeriode,
    concerne, periodesDe, maitrisesRequises, resultat, bilan, appreciation, anomalies };
})(window);
