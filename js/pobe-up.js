/* CS Pobè — zones pédagogiques, unités pédagogiques (RUP, co-RUP) et effectifs officiels de la circonscription
   (données : data/pobe-up.js, tirées du document « Unités pédagogiques par zone » et du classeur « Les écoles de la CS
   par zone »).
   • premier démarrage et installations existantes : une seule fois par version des données (migration), les rubriques
     vides sont remplies ; les valeurs posées automatiquement par l'ancien référentiel (zones des maternelles, unités
     « UP … » provisoires) et les effectifs de maternelle mal rangés (sections dans CI / CP / CE1) sont corrigés ;
     ce que l'utilisateur a saisi lui-même reste ;
   • ♻ réinitialiser : remet les valeurs officielles (une UP, une école, des effectifs, ou tout).
   Chaque valeur posée est notée sur la fiche (_officiel) : une mise à jour ultérieure des données ne remplace que ce
   qui n'a pas été modifié depuis. */
(function (global) {
  'use strict';
  const SOURCE = 'Fichier de la CS (classes autorisées 2024-2025)';
  const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
  const norm = t => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Œ/g, 'OE')
    .replace(/[^A-Z0-9/]+/g, ' ').replace(/\s+/g, ' ').trim();
  const P = () => global.POBE_UP || { ups: [], ecoles: [], zones: [], sansUP: [] };
  const officielEcole = nom => P().ecoles.find(e => norm(e.nom) === norm(nom)) || null;
  const officielUP = nom => P().ups.find(u => u.nom === nom) || null;
  const vide = v => v === undefined || v === null || v === '' || v === 0 || v === '0';

  /** Relevé d'effectifs (modèle de l'application) tiré des effectifs officiels d'une école. */
  function releveOfficiel(o, ecoleId, annee, uid) {
    const ef = o.effectifs || {};
    const r = { id: uid(), ecoleId, annee, source: SOURCE, _officiel: true, handicapes: 0, redoublants: 0, sansActe: 0 };
    if (String(o.type).indexOf('EM') === 0) {
      [['petits', 'sp'], ['grands', 'sg']].forEach(([k, s]) => {
        const v = ef[k] || {};
        ['G', 'F'].forEach(sx => { r['s_eff_' + s + '_' + sx] = v[sx] || 0; r['rent_debut_' + s + '_' + sx] = v[sx] || 0; });
      });
    } else {
      COURS.forEach(c => { const v = ef[c] || {}; ['G', 'F'].forEach(sx => { r['c_' + c.toLowerCase() + '_' + sx] = v[sx] || 0; }); });
    }
    const t = ef.TOTAL || {};
    r.totalG = t.G || 0; r.totalF = t.F || 0; r.total = (t.G || 0) + (t.F || 0);
    return r;
  }

  /** Relevé de maternelle rangé comme un primaire (sections dans CI / CP, total recopié dans CE1) : ancien import. */
  function releveMaternelleMalRange(r) {
    const sec = ['sp', 'sg'].some(s => ['G', 'F'].some(sx => +r['s_eff_' + s + '_' + sx] > 0));
    const cours = ['ci', 'cp', 'ce1'].some(c => ['G', 'F'].some(sx => +r['c_' + c + '_' + sx] > 0));
    return !sec && cours;
  }

  function installer(ctx) {
    const { data, uid, saveData, anneeActive } = ctx;
    const estEcole = () => !!(global.Config && global.Config.estEcole && global.Config.estEcole());
    const reglage = (cle, val) => {
      data.reglages = data.reglages || [];
      let r = data.reglages.find(x => x.id === cle);
      if (val === undefined) return r ? r.valeur : undefined;
      if (!r) { r = { id: cle }; data.reglages.push(r); }
      r.valeur = val;
    };
    const ecoleDe = nom => data.ecoles.find(e => norm(e.nom) === norm(nom));

    /** Pose une valeur officielle : forcer, ou rubrique vide, ou valeur encore égale à celle posée la fois d'avant. */
    function poser(e, champ, valeur, forcer, remplacables) {
      if (valeur === undefined || valeur === null || valeur === '') return false;
      e._officiel = e._officiel || {};
      const avant = e[champ];
      const libre = forcer || vide(avant) || (e._officiel[champ] !== undefined && String(e._officiel[champ]) === String(avant))
        || (remplacables && remplacables(avant));
      if (libre) { e[champ] = valeur; e._officiel[champ] = valeur; return String(avant) !== String(valeur); }
      return false;
    }

    function appliquerEcole(e, o, forcer) {
      const D = global.Donnees || {};
      let n = 0;
      // zone : l'ancien référentiel en posait une d'office pour les maternelles (rapport de fin d'année) ; l'UP fait foi
      if (poser(e, 'zone_ped', o.zone, forcer, v => D.zoneReferentiel && v === D.zoneReferentiel(e.nom))) n++;
      if (poser(e, 'unite_ped', o.up, forcer, v => (D.UNITES_PROVISOIRES || []).indexOf(v) >= 0)) n++;
      // école sans UP dans le document mais rangée dans une unité provisoire « UP X » devenue officielle (ex. UP Agbarou -> Agbarou)
      if (!o.up && (D.UNITES_PROVISOIRES || []).indexOf(e.unite_ped) >= 0) {
        const u = P().ups.find(x => norm('UP ' + x.nomOfficiel) === norm(e.unite_ped));
        if (u) { e.unite_ped = u.nom; if (vide(e.zone_ped)) e.zone_ped = u.zone; n++; }
      }
      if (poser(e, 'annee_creation', o.annee_creation, forcer)) n++;
      if (poser(e, 'classes_autorisees', o.classes_autorisees, forcer)) n++;
      if (o.personnel) {
        const avant = JSON.stringify(e.personnel_fichier || null);
        if (forcer || !e.personnel_fichier || (e._officiel && e._officiel.personnel_fichier === avant)) {
          e.personnel_fichier = Object.assign({ source: SOURCE }, o.personnel);
          e._officiel = e._officiel || {}; e._officiel.personnel_fichier = JSON.stringify(e.personnel_fichier);
          if (avant !== JSON.stringify(e.personnel_fichier)) n++;
        }
      }
      return n;
    }

    function appliquerEffectifs(e, o, forcer) {
      if (!o.effectifs) return 0;
      const annee = anneeActive();
      const existants = data.effectifs.filter(r => r.ecoleId == e.id && (!r.annee || r.annee === annee));
      const officiel = releveOfficiel(o, e.id, annee, uid);
      if (!existants.length) { data.effectifs.push(officiel); return 1; }
      const r = existants[0];
      const mat = String(e.type).indexOf('EM') === 0;
      const intact = r._officiel && r._empreinte && r._empreinte === empreinte(r);
      if (forcer || intact || (mat && releveMaternelleMalRange(r))) {
        Object.keys(r).forEach(k => { if (/^(c_|s_eff_|rent_debut_)/.test(k)) delete r[k]; });
        Object.assign(r, officiel, { id: r.id, handicapes: r.handicapes || 0, redoublants: r.redoublants || 0, sansActe: r.sansActe || 0 });
        r._empreinte = empreinte(r);
        return 1;
      }
      return 0;
    }
    const empreinte = r => JSON.stringify(Object.keys(r).filter(k => /^(c_|s_eff_|total)/.test(k)).sort().map(k => [k, +r[k] || 0]));

    function appliquerUP(u, forcer) {
      data.unites = data.unites || [];
      let f = data.unites.find(x => x.nom === u.nom);
      if (!f) { f = { id: uid(), nom: u.nom }; data.unites.push(f); }
      ['zone', 'cycle', 'numero', 'arrondissement', 'rup', 'corup'].forEach(k => { poser(f, k, u[k], forcer); });
      f.officielle = true;
      return f;
    }

    /** Migration (une fois par version des données) — aussi au tout premier démarrage. */
    function migrer(nouvelleEcole) {
      const version = P().version;
      if (!version || (!nouvelleEcole && reglage('pobeUP') === version)) return null;
      // Mon école : rien à faire tant que le directeur n'a pas inscrit son école (la migration attend)
      if (estEcole() && !data.ecoles.length) return null;
      const rapport = { ecoles: 0, ajoutees: 0, effectifs: 0, ups: 0 };
      if (estEcole()) {
        // Mon école : seulement l'école de ce poste et son unité pédagogique
        data.ecoles.forEach(e => {
          const o = officielEcole(e.nom); if (!o) return;
          rapport.ecoles += appliquerEcole(e, o, false) ? 1 : 0;
          rapport.effectifs += appliquerEffectifs(e, o, false);
          const u = officielUP(o.up); if (u) { appliquerUP(u, false); rapport.ups++; }
        });
      } else {
        P().ecoles.forEach(o => {
          let e = ecoleDe(o.nom);
          if (!e) {
            e = { id: uid(), code: '', nom: o.nom, type: o.type, statut: o.statut, arrondissement: o.arrondissement, commune: 'POBE',
              departement: 'PLATEAU', typeEns: 'Classique', directeur: '', telephone: '', classes_existantes: o.classes_autorisees || 0,
              source: SOURCE };
            data.ecoles.push(e); rapport.ajoutees++;
          }
          rapport.ecoles += appliquerEcole(e, o, false) ? 1 : 0;
          rapport.effectifs += appliquerEffectifs(e, o, false);
        });
        P().ups.forEach(u => { appliquerUP(u, false); rapport.ups++; });
      }
      // relevés de maternelle mal rangés (sections dans CI / CP, total recopié dans CE1) sans valeur officielle : remis en sections
      data.effectifs.forEach(r => {
        const e = data.ecoles.find(x => x.id == r.ecoleId);
        if (!e || String(e.type).indexOf('EM') !== 0 || !releveMaternelleMalRange(r)) return;
        const n = k => parseInt(r[k], 10) || 0;
        r.s_eff_sp_G = n('c_ci_G'); r.s_eff_sp_F = n('c_ci_F'); r.s_eff_sg_G = n('c_cp_G'); r.s_eff_sg_F = n('c_cp_F');
        ['ci', 'cp', 'ce1', 'ce2', 'cm1', 'cm2'].forEach(c => { delete r['c_' + c + '_G']; delete r['c_' + c + '_F']; });
        r.totalG = r.s_eff_sp_G + r.s_eff_sg_G; r.totalF = r.s_eff_sp_F + r.s_eff_sg_F; r.total = r.totalG + r.totalF;
        rapport.effectifs++;
      });
      reglage('pobeUP', version);
      reglage('pobeUPRapport', Object.assign({ date: new Date().toISOString() }, rapport));
      saveData();
      return rapport;
    }

    /* ---------------- réinitialisations (valeurs officielles) ---------------- */
    function reinitUP(nom) {
      const u = officielUP(nom); if (!u) return false;
      appliquerUP(u, true);
      // une UP ajoutée sans liste d'écoles (Agbarou) garde les écoles que la CS y a rattachées
      if (!u.ajoutee && u.ecoles.length) data.ecoles.forEach(e => { if (e.unite_ped === nom && u.ecoles.every(n => norm(n) !== norm(e.nom))) { e.unite_ped = ''; } });
      u.ecoles.forEach(n => { const e = ecoleDe(n); if (e) { poser(e, 'unite_ped', u.nom, true); poser(e, 'zone_ped', u.zone, true); } });
      saveData(); return true;
    }
    function reinitToutesUP() {
      P().ups.forEach(u => appliquerUP(u, true));
      const officielles = new Set(P().ups.filter(u => !u.ajoutee && u.ecoles.length).map(u => u.nom));
      data.ecoles.forEach(e => {
        const o = officielEcole(e.nom);
        if (o) { if (o.up) poser(e, 'unite_ped', o.up, true); else if (officielles.has(e.unite_ped)) e.unite_ped = ''; if (o.zone) poser(e, 'zone_ped', o.zone, true); }
      });
      saveData();
    }
    function reinitEcole(id) {
      const e = data.ecoles.find(x => x.id == id); const o = e && officielEcole(e.nom);
      if (!o) return false;
      appliquerEcole(e, o, true); saveData(); return true;
    }
    function reinitEffectifs(id) {
      const e = data.ecoles.find(x => x.id == id); const o = e && officielEcole(e.nom);
      if (!o || !o.effectifs) return false;
      appliquerEffectifs(e, o, true); saveData(); return true;
    }
    function reinitTousEffectifs() {
      let n = 0;
      data.ecoles.forEach(e => { const o = officielEcole(e.nom); if (o && o.effectifs) n += appliquerEffectifs(e, o, true); });
      saveData(); return n;
    }
    /** Écoles qu'aucune unité pédagogique ne contient (d'après les données officielles ou parce que l'UP a été vidée). */
    function aRattacher() {
      return data.ecoles.filter(e => !e.unite_ped).sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr'));
    }

    // les relevés posés à la migration reçoivent leur empreinte (pour savoir s'ils ont été retouchés depuis)
    const migration = migrer();
    data.effectifs.forEach(r => { if (r._officiel && !r._empreinte) r._empreinte = empreinte(r); });
    if (migration) saveData();
    return { migration, migrer, reinitUP, reinitToutesUP, reinitEcole, reinitEffectifs, reinitTousEffectifs, aRattacher,
      officielEcole, officielUP, SOURCE };
  }

  global.PobeUP = { installer, officielEcole, officielUP, releveOfficiel, releveMaternelleMalRange, norm };
})(window);
