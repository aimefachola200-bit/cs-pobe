/* CS Pobè — présence journalière des apprenants et du personnel.
   Calculs purs (bilans, taux, retards) séparés du rendu : app.js s'occupe de
   l'écran, ce module s'occupe des chiffres. */
(function (global) {
  'use strict';

  /* Heure officielle de prise de service, faute d'un règlement intérieur
     propre à chaque école : sert uniquement à signaler un retard, jamais à
     sanctionner automatiquement. Modifiable ci-dessous si la circonscription
     retient une autre heure. */
  const HEURE_DEBUT_SERVICE = '07:30';

  function minutesDepuisMinuit(heure) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(String(heure || '').trim());
    if (!m) return null;
    return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
  }

  /** Nombre de minutes de retard sur l'heure de service (0 si à l'heure ou en avance). */
  function minutesRetard(heureArrivee, heureDebut) {
    const arr = minutesDepuisMinuit(heureArrivee);
    const deb = minutesDepuisMinuit(heureDebut || HEURE_DEBUT_SERVICE);
    if (arr === null || deb === null) return null;
    return Math.max(0, arr - deb);
  }

  /* ---------------- Apprenants ---------------- */

  /* Une journée de classe compte deux demi-journées (matin, après-midi) :
     un apprenant absent seulement le matin, ou seulement l'après-midi,
     compte pour une demi-absence, pas une absence entière. */
  function demiAbsencesRecord(record) {
    const matin = (record && record.absentsMatin) || [];
    const aprem = (record && record.absentsApresMidi) || [];
    return matin.length + aprem.length;
  }

  /** Bilan d'une seule journée pour une classe : présences/absences en demi-journées. */
  function bilanJourApprenants(apprenants, record) {
    const effectif = apprenants.length;
    const matin = (record && record.absentsMatin) || [];
    const aprem = (record && record.absentsApresMidi) || [];
    const demiJourneesPossibles = effectif * 2;
    const demiAbsences = matin.length + aprem.length;
    return {
      effectif: effectif,
      absentsMatin: matin.length,
      absentsApresMidi: aprem.length,
      demiAbsences: demiAbsences,
      demiJourneesPossibles: demiJourneesPossibles,
      demiPresences: Math.max(0, demiJourneesPossibles - demiAbsences)
    };
  }

  /**
   * Bilan d'une période (mois ou année) pour une classe : nombre de jours
   * saisis (en demi-journées), présences/absences cumulées, taux de
   * présence, et le détail par apprenant (absences en demi-journées,
   * jamais manqué, plus de 4 absences). L'effectif total des apprenants
   * ayant manqué au plus 4 fois et celui des apprenants ayant manqué plus
   * de 4 fois, avec la somme des absences imputable à chacun de ces deux
   * groupes, se répartissent le total des absences (leur somme égale
   * toujours totalAbsences).
   */
  function bilanPeriodeApprenants(apprenants, records) {
    const parApprenant = {};
    apprenants.forEach(a => { parApprenant[a.id] = { apprenant: a, absences: 0 }; });

    let totalAbsences = 0;
    records.forEach(rec => {
      ((rec.absentsMatin) || []).forEach(id => {
        if (parApprenant[id]) { parApprenant[id].absences++; totalAbsences++; }
      });
      ((rec.absentsApresMidi) || []).forEach(id => {
        if (parApprenant[id]) { parApprenant[id].absences++; totalAbsences++; }
      });
    });

    const joursSaisis = records.length;
    const effectif = apprenants.length;
    const demiJourneesSaisies = joursSaisis * 2;
    const possibles = demiJourneesSaisies * effectif;
    const presencesTotal = Math.max(0, possibles - totalAbsences);

    const detail = Object.keys(parApprenant).map(id => parApprenant[id]);
    const groupePeu = joursSaisis ? detail.filter(d => d.absences <= 4) : [];
    const groupePlus = detail.filter(d => d.absences > 4);
    return {
      joursSaisis: joursSaisis,
      demiJourneesSaisies: demiJourneesSaisies,
      effectif: effectif,
      totalAbsences: totalAbsences,
      presencesTotal: presencesTotal,
      tauxPresence: possibles ? Math.round(presencesTotal / possibles * 1000) / 10 : null,
      jamaisManque: joursSaisis ? detail.filter(d => d.absences === 0) : [],
      plusDeQuatreAbsences: groupePlus,
      effectifGroupePeu: groupePeu.length,
      absencesGroupePeu: groupePeu.reduce((s, d) => s + d.absences, 0),
      effectifGroupePlus: groupePlus.length,
      absencesGroupePlus: groupePlus.reduce((s, d) => s + d.absences, 0),
      detail: detail.sort((x, y) => y.absences - x.absences)
    };
  }

  /* ---------------- Personnel ---------------- */

  /** Statut d'un agent pour une journée donnée, à partir du relevé. */
  function statutJourAgent(record, agentId) {
    const info = record && record.agents && record.agents[agentId];
    if (!info) return { saisi: false };
    if (info.absent) return { saisi: true, present: false, motif: info.motif || '' };
    const retard = minutesRetard(info.heureArrivee);
    return {
      saisi: true, present: true, heureArrivee: info.heureArrivee || '',
      retard: retard !== null && retard > 0, minutesRetard: retard || 0
    };
  }

  /**
   * Bilan d'une période pour le personnel d'une école : jours saisis,
   * présences/absences/retards cumulés par agent, et le taux de présence.
   */
  function bilanPeriodePersonnel(agents, records) {
    const parAgent = {};
    agents.forEach(a => { parAgent[a.id] = { agent: a, presences: 0, absences: 0, retards: 0, minutesRetardTotal: 0, joursSaisis: 0 }; });

    records.forEach(rec => {
      agents.forEach(a => {
        const st = statutJourAgent(rec, a.id);
        if (!st.saisi) return;
        const c = parAgent[a.id];
        c.joursSaisis++;
        if (st.present) {
          c.presences++;
          if (st.retard) { c.retards++; c.minutesRetardTotal += st.minutesRetard; }
        } else {
          c.absences++;
        }
      });
    });

    const detail = Object.keys(parAgent).map(id => parAgent[id]);
    const totalJours = detail.reduce((s, d) => s + d.joursSaisis, 0);
    const totalPresences = detail.reduce((s, d) => s + d.presences, 0);
    return {
      joursEnregistres: records.length,
      tauxPresence: totalJours ? Math.round(totalPresences / totalJours * 1000) / 10 : null,
      detail: detail.sort((x, y) => (y.retards + y.absences) - (x.retards + x.absences))
    };
  }

  global.Presences = {
    HEURE_DEBUT_SERVICE, minutesRetard, bilanJourApprenants, bilanPeriodeApprenants,
    statutJourAgent, bilanPeriodePersonnel
  };
})(window);
