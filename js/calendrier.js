/* CS Pobè — calendrier scolaire.
   Détermine les jours ouvrables (ni week-end, ni jour férié) pour les
   relevés de présence : apprenants et personnel. Les fêtes à date fixe et
   les fêtes chrétiennes mobiles (calculées à partir de Pâques) sont connues
   d'avance ; les fêtes musulmanes (Tabaski, Maouloud, fin du Ramadan) se
   fixent par observation de la lune et ne peuvent pas être calculées de
   façon fiable ici — elles s'ajoutent à la main, une fois pour toutes,
   depuis la rubrique « Jours fériés ». */
(function (global) {
  'use strict';

  /* Fêtes à date fixe, valables chaque année. */
  const FERIES_FIXES = [
    [1, 1, 'Jour de l’An'],
    [1, 10, 'Fête du Vodoun (Traditions)'],
    [5, 1, 'Fête du Travail'],
    [8, 1, 'Fête de l’Indépendance'],
    [8, 15, 'Assomption'],
    [11, 1, 'Toussaint'],
    [12, 25, 'Noël']
  ];

  /* Algorithme de Meeus/Jones/Butcher : date du dimanche de Pâques (calendrier
     grégorien), à partir de laquelle se calculent les fêtes chrétiennes
     mobiles de la circonscription. */
  function datePaques(annee) {
    const a = annee % 19, b = Math.floor(annee / 100), c = annee % 100;
    const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const mois = Math.floor((h + l - 7 * m + 114) / 31);
    const jour = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(annee, mois - 1, jour);
  }

  function ajouterJours(date, n) {
    const d = new Date(date);
    d.setDate(d.getDate() + n);
    return d;
  }

  function iso(date) {
    const d = new Date(date);
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
      + '-' + String(d.getDate()).padStart(2, '0');
  }

  /* Jours fériés calculables (fixes + chrétiens mobiles) pour une année
     civile donnée, en {date ISO: libellé}. */
  function feriesCalcules(anneeCivile) {
    const feries = {};
    FERIES_FIXES.forEach(([mois, jour, libelle]) => {
      feries[iso(new Date(anneeCivile, mois - 1, jour))] = libelle;
    });
    const paques = datePaques(anneeCivile);
    feries[iso(ajouterJours(paques, 1))] = 'Lundi de Pâques';
    feries[iso(ajouterJours(paques, 39))] = 'Ascension';
    feries[iso(ajouterJours(paques, 50))] = 'Lundi de Pentecôte';
    return feries;
  }

  function estWeekend(dateStr) {
    const j = new Date(dateStr).getDay();
    return j === 0 || j === 6;
  }

  /**
   * Un jour est-il férié ? Combine les fêtes calculables de son année civile
   * et les jours fériés ajoutés à la main (Tabaski, Maouloud, fin du
   * Ramadan, ou toute fermeture exceptionnelle) dans data.joursFeries.
   */
  function estFerie(dateStr, joursFeriesManuels) {
    const annee = new Date(dateStr).getFullYear();
    if (feriesCalcules(annee)[dateStr]) return true;
    return (joursFeriesManuels || []).some(f => f.date === dateStr);
  }

  /** Un jour de classe : ni week-end, ni jour férié. */
  function estJourEcole(dateStr, joursFeriesManuels) {
    return !estWeekend(dateStr) && !estFerie(dateStr, joursFeriesManuels);
  }

  /** Libellé du jour férié à cette date, calculé ou ajouté à la main. */
  function libelleFerie(dateStr, joursFeriesManuels) {
    const annee = new Date(dateStr).getFullYear();
    const calc = feriesCalcules(annee)[dateStr];
    if (calc) return calc;
    const manuel = (joursFeriesManuels || []).find(f => f.date === dateStr);
    return manuel ? manuel.libelle : null;
  }

  /** Tous les jours de classe d'un mois (mois : 1 à 12). */
  function joursEcoleDuMois(anneeCivile, mois, joursFeriesManuels) {
    const jours = [];
    const dernier = new Date(anneeCivile, mois, 0).getDate();
    for (let j = 1; j <= dernier; j++) {
      const d = iso(new Date(anneeCivile, mois - 1, j));
      if (estJourEcole(d, joursFeriesManuels)) jours.push(d);
    }
    return jours;
  }

  global.Calendrier = {
    FERIES_FIXES, datePaques, feriesCalcules, estWeekend, estFerie,
    estJourEcole, libelleFerie, joursEcoleDuMois, iso
  };
})(window);
