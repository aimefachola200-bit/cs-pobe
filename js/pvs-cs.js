/* CS Pobè et Mon école — adaptateur du module commun « Pilotage et vie scolaire » (js/pvs.js, catalogue js/pvs-modules.js).
   Modules : sport scolaire, tableau de bord du pilotage (lot A) ; les lots suivants s'ajoutent au même catalogue.
   Données : réglage « pvs » (sauvegarde, restauration et échanges comme le reste). Entités, droits, cachets et visas :
   ceux des bureaux UASCEP (js/uascep-cs.js). Code QR : page publique v.html (numéro PVS-…).
   Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  const D = () => A().data;
  const U = () => global.UascepCS && global.UascepCS.adaptateur;
  const ecoleMode = () => !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const I = (n) => (global.Icones ? global.Icones.code(n) + ' ' : '');
  const PAGES = { pvsSport: 'sport', pvsPilotage: 'pilotage', pvsCommunication: 'communication', pvsSante: 'sante', pvsInspection: 'inspection', pvsPatrimoine: 'patrimoine', pvsExamens: 'examens' };

  function charger() { return Promise.resolve(((D().reglages || []).find(x => x.id === 'pvs') || {}).valeur || null); }
  function enregistrer(etat) {
    D().reglages = D().reglages || [];
    let r = D().reglages.find(x => x.id === 'pvs'); if (!r) { r = { id: 'pvs' }; D().reglages.push(r); }
    r.valeur = etat; A().saveData();
    return Promise.resolve();
  }
  /** Signature : numéro PVS-AAAA-XXXXXX, code QR vers v.html (empreinte des mentions, toute modification signalée) */
  const octets = (t) => new TextEncoder().encode(t).length;
  function signer(doc) {
    const p = global.Pieces; if (!p) return Promise.resolve(null);
    const r = doc.resume || {};
    const numero = 'PVS-' + new Date().getFullYear() + '-' + p.empreinte('PVS|' + doc.empreinte + '|' + Date.now()).slice(0, 6);
    const base = p.lienVerification('X', '').split('#')[0];
    const net = (t) => String(t || '').replace(/[|&#]/g, ' ').replace(/\s+/g, ' ').trim();
    const ch = { d: doc.code || 'LS', b: net(r.entite), m: net(r.objet), f: net(r.mention), t: net(r.date), s: net(r.signataire) };
    const lien = () => {
      const e = p.empreinte('CS-POBE|' + numero + '|' + [ch.d, ch.b, ch.m, ch.f, ch.t, ch.s].join('|')).slice(0, 8);
      return { e, url: base + '#n=' + encodeURIComponent(numero) + '&e=' + e + Object.keys(ch).filter(k => ch[k]).map(k => '&' + k + '=' + encodeURIComponent(ch[k]).replace(/%20/g, '+')).join('') };
    };
    let l = lien(), garde = 0;
    while (octets(l.url) > 255 && garde++ < 200) {
      const k = ['b', 's', 'm', 'f'].sort((x, y) => octets(ch[y]) - octets(ch[x]))[0];
      ch[k] = ch[k].slice(0, Math.max(8, ch[k].length - 4)).trim() + (ch[k].endsWith('…') ? '' : '…');
      if (ch[k].length <= 9) break;
      l = lien();
    }
    return Promise.resolve({ numero, code: l.e, qr: p.qr(l.url, 96, 'L'), url: l.url,
      mention: 'Scannez le code QR : la page de vérification de la Circonscription Scolaire de Pobè contrôle le numéro et les mentions du document.' });
  }

  /* ---------- indicateurs calculés depuis les données de l'application (effectifs, personnel, CEP, fiches) ---------- */
  const n0 = (x) => { const n = parseFloat(x); return Number.isFinite(n) ? n : 0; };
  function indicateurs(annee) {
    const d = D(), out = {};
    d.ecoles.forEach(e => {
      const v = {}, cle = String(e.id);
      const ef = (d.effectifs || []).filter(x => String(x.ecoleId) === cle && x.annee === annee).pop();
      if (ef) { v.effG = n0(ef.totalG); v.effF = n0(ef.totalF); if (ef.redoublants !== undefined && ef.redoublants !== '') v.redoublantsG = n0(ef.redoublants); }
      if (e.classes_existantes) v.groupes = n0(e.classes_existantes);
      const pers = (d.personnel || []).filter(p => String(p.ecoleId) === cle && !/retrait|décéd|decede|parti/i.test(p.situation || ''));
      if (pers.length) {
        v.enseignants = pers.length; v.enseignantsF = pers.filter(p => p.sexe === 'F').length;
        v.ensFE = pers.filter(p => /^(APE|FE)$/i.test(p.statut || '')).length;
        v.ensContractuels = pers.filter(p => /^(ACE|ACDPE)/i.test(p.statut || '')).length;
        v.ensCommunautaires = pers.filter(p => /ACDPCTD|AME|communaut|volont/i.test(p.statut || '')).length;
        v.ensAutres = pers.length - v.ensFE - v.ensContractuels - v.ensCommunautaires;
      } else if (e.personnel_fichier && e.personnel_fichier.total) {
        const pf = e.personnel_fichier; v.enseignants = n0(pf.total); v.ensFE = n0(pf.fe); v.ensContractuels = n0(pf.acdpe); v.ensCommunautaires = n0(pf.ame); v.ensAutres = n0(pf.autres);
      }
      if (global.CepZone && global.CepZone.cepEcole) {
        try { const c = global.CepZone.cepEcole(e, annee); if (c && (c.insc[0] + c.insc[1])) { v.cepInscritsG = c.insc[0]; v.cepInscritsF = c.insc[1]; v.cepPresentsG = c.comp[0]; v.cepPresentsF = c.comp[1]; v.cepAdmisG = c.adm[0]; v.cepAdmisF = c.adm[1]; } } catch (x) { /* fiche incomplète */ }
      }
      const f = (d.fiches || []).find(y => String(y.ecoleId) === cle && y.annee === annee);
      if (f) {
        if (f.salles_classe_bon !== undefined || f.salles_bon !== undefined) v.salles = n0(f.salles_classe_bon || f.salles_bon) + n0(f.salles_classe_passable || f.salles_passable);
        if (f.tables_bancs_bon !== undefined) v.tablesBancs = n0(f.tables_bancs_bon);
        if (f.latrines !== undefined) v.latrines = n0(f.latrines);
        if (f.abandons_g !== undefined) { v.abandonsG = n0(f.abandons_g); v.abandonsF = n0(f.abandons_f); }
        if (f.redoublants_g !== undefined) { v.redoublantsG = n0(f.redoublants_g); v.redoublantsF = n0(f.redoublants_f); }
      }
      if (e.cantine !== undefined && e.cantine !== '') v.cantine = /oui|true|1/i.test(String(e.cantine)) ? 'Oui' : 'Non';
      out[cle] = v;
    });
    /* examen blanc : candidats ayant composé et seuil atteint, par école de provenance (centres de la session) */
    if (global.ExamenBlanc) {
      const ids = new Set((d.centres || []).filter(c => !c.session || String(c.session) === annee || String(c.session).includes(String(annee).slice(-4))).map(c => String(c.id)));
      (d.compositions || []).filter(c => ids.has(String(c.centreId)) && c.ecoleId && out[String(c.ecoleId)]).forEach(c => { const r = global.ExamenBlanc.resultat(c), o = out[String(c.ecoleId)];
        o.ebComposes = (o.ebComposes || 0) + (r.aCompose ? 1 : 0); o.ebAdmis = (o.ebAdmis || 0) + (r.admis ? 1 : 0); });
    }
    return Promise.resolve(out);
  }
  /** Élèves d'une école (listes des apprenants) pour les licences */
  function eleves(ecoleCle) {
    return Promise.resolve((D().apprenants || []).filter(x => String(x.ecoleId) === String(ecoleCle)).map(x => ({ nom: x.nom, prenoms: x.prenoms || x.prenom || '', sexe: /^f/i.test(x.sexe || '') ? 'F' : 'M',
      dateNaissance: x.dateNaissance || x.date_naissance || '', lieuNaissance: x.lieuNaissance || x.lieu_naissance || '', cours: String(x.cours || x.classe || '').toUpperCase().replace(/\s+/g, '') })));
  }

  /** Absences des 30 derniers jours (registre d'appel : demi-journées) par élève d'une école */
  function absences(ecoleCle) {
    const d = D(), lim = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), n = {};
    (d.presencesApprenants || []).filter(r => String(r.ecoleId) === String(ecoleCle) && String(r.date || '') >= lim)
      .forEach(r => (r.absentsMatin || []).concat(r.absentsApresMidi || []).forEach(id => { n[id] = (n[id] || 0) + 1; }));
    return Promise.resolve((d.apprenants || []).filter(x => n[x.id]).map(x => ({ nom: x.nom, prenoms: x.prenoms || x.prenom || '', sexe: /^f/i.test(x.sexe || '') ? 'F' : 'M', cours: x.cours || x.classe || '', absences: n[x.id] })));
  }
  /** Candidats inscrits au CEP dans l'application (rubrique « Inscription CEP ») */
  function cepCandidats() {
    return Promise.resolve((D().cep || []).map(c => ({ ecole: String(c.ecoleId), nom: c.nom, prenoms: c.prenoms, sexe: /^f/i.test(c.sexe || '') ? 'F' : 'M', dateNaissance: c.dateNaiss || '', lieuNaissance: c.lieuNaiss || '' })));
  }
  function adaptateur() {
    const u = U() || {};
    return {
      app: ecoleMode() ? 'Mon école' : 'CS Pobè', charger, enregistrer, signer, indicateurs, eleves, absences, cepCandidats,
      exclure: ['patrimoine.batiments', 'patrimoine.tables'],
      utilisateur: () => { const p = ecoleMode() && A().ecoleDuPoste ? A().ecoleDuPoste() : null; return p ? (p.directeur || p.nom) : 'Circonscription scolaire de Pobè'; },
      contexte: u.contexte, cachet: u.cachet, visa: u.visa, imprimer: u.imprimer, toast: u.toast, xlsxEcrire: u.xlsxEcrire, xlsxLire: u.xlsxLire, telecharger: u.telecharger,
      memo: { get: (k) => { try { return localStorage.getItem('pvs.' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('pvs.' + k, v); } catch (e) { /* stockage indisponible */ } } },
      uascep: () => ({ charger: u.charger, enregistrer: u.enregistrer }),
      ouvrir: (route) => global.showPage && global.showPage(route),
      liens: { sport: [{ l: '\uE047 Bureaux UASCEP', route: 'uascep' }], communication: [{ l: I('alerte') + 'Alertes de l’application', route: 'alertes' }, { l: I('message') + 'Groupe WhatsApp des directeurs', route: 'whatsapp' }, { l: I('courrier') + 'Archive courriers', route: 'courriers' }],
        sante: [{ l: I('calendrier') + 'Présence des apprenants', route: 'presenceApprenants' }, { l: I('eleve') + 'Listes des apprenants', route: 'apprenants' }],
        inspection: [{ l: I('inspection') + 'Visites et inspections (CS)', route: 'visites' }],
        patrimoine: [{ l: I('chantier') + 'Infrastructures', route: 'infrastructures' }, { l: I('chaise') + 'Mobilier et matériel', route: 'mobilier' }, { l: I('chantier') + 'Infrastructures et mobilier (consolidé)', route: 'infraZone' }],
        examens: [{ l: I('inscription') + 'Inscription CEP', route: 'cep' }, { l: I('stade') + 'Examen blanc', route: 'examen' }, { l: I('diplome') + 'Candidats au CEP par sexe', route: 'cepZone' }],
        pilotage: [{ l: I('stade') + 'Examen blanc', route: 'examen' }, { l: '\uE016 Effectifs par âge, zone et CS', route: 'effectifsZone' }, { l: '\uE020 Candidats au CEP', route: 'cepZone' }, { l: '\uE026 Infrastructures (consolidé)', route: 'infraZone' }] }
    };
  }

  global.Extra = global.Extra || { pages: {} };
  Object.entries(PAGES).forEach(([page, mod]) => {
    global.Extra.pages[page] = function () {
      const el = document.getElementById(page); if (!el) return;
      if (!global.PVS || !global.UascepCS) { el.textContent = 'Module indisponible : rechargez l’application.'; return; }
      global.PVS.monter(el, adaptateur(), mod).catch(e => { console.error(e); el.textContent = 'Le module n’a pas pu s’ouvrir.'; });
    };
  });
  global.PvsCS = { adaptateur, PAGES };
})(window);
