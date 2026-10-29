/* CS Pobè et Mon école — adaptateur du module commun « Bureaux UASCEP » (js/uascep.js).
   CS Pobè : toutes les écoles, UP, zones, la circonscription et la DDEMP du Plateau, en écriture.
   Mon école : le bureau de l'école du poste (écriture), celui de son UP et de sa zone (consultation).
   Données : collections « uascepBureaux » et « uascepMembres » (sauvegarde, restauration et import comme le reste).
   Reprise sans perte des anciens membres « UASCEP » de la gestion collégiale (école, UP, commune).
   Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  const D = () => A().data;
  const ecoleMode = () => !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const CS = { cle: 'CS-POBE', lib: 'Circonscription scolaire de Pobè', alias: ['CS Pobè', 'CS POBE', 'Pobè', 'POBE', 'Commune de Pobè'] };
  const DDEMP = { cle: 'DDEMP-PLATEAU', lib: 'DDEMP du Plateau', alias: ['DDEMP Plateau', 'Plateau', 'Direction départementale du Plateau'] };
  const uid = () => 'u' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  function zonesConnues() {
    const off = (global.POBE_UP && global.POBE_UP.zones) || [];
    const noms = new Set((global.Donnees && global.Donnees.ZONES) || []);
    off.forEach(z => noms.add(z.nom));
    D().ecoles.forEach(e => { if (e.zone_ped) noms.add(e.zone_ped); });
    return [...noms].sort().map(n => { const o = off.find(z => z.nom === n); return { cle: n, lib: n, alias: o ? [o.libelle, o.code].filter(Boolean) : [], zone: n }; });
  }
  function upsConnues() {
    const m = new Map();
    (D().unites || []).forEach(u => { if (u && u.nom) m.set(u.nom, { cle: u.nom, lib: u.nom, nomUp: u.nom, up: u.nom, zone: u.zone || '', rup: u.rup || '', alias: [u.nomOfficiel].filter(Boolean) }); });
    D().ecoles.forEach(e => { if (e.unite_ped && !m.has(e.unite_ped)) m.set(e.unite_ped, { cle: e.unite_ped, lib: e.unite_ped, nomUp: e.unite_ped, up: e.unite_ped, zone: e.zone_ped || '', rup: '' }); });
    return [...m.values()].sort((a, b) => a.lib.localeCompare(b.lib, 'fr'));
  }

  function contexte() {
    const ups = upsConnues(), rupDe = (n) => (ups.find(u => u.cle === n) || {}).rup || '';
    let ecoles = D().ecoles.filter(e => e && e.nom).map(e => ({ cle: String(e.id), lib: e.nom, ecole: e.nom, zone: e.zone_ped || '', up: e.unite_ped || '', rup: rupDe(e.unite_ped), alias: [e.nomOfficiel].filter(Boolean) }))
      .sort((a, b) => a.lib.localeCompare(b.lib, 'fr'));
    let zones = zonesConnues(), upsV = ups;
    if (ecoleMode()) {
      const p = A().ecoleDuPoste();
      ecoles = p ? ecoles.filter(e => e.cle === String(p.id)) : [];
      upsV = p && p.unite_ped ? ups.filter(u => u.cle === p.unite_ped) : [];
      zones = p && p.zone_ped ? zones.filter(z => z.cle === p.zone_ped) : [];
      const ecoleCle = p ? String(p.id) : null;
      return { niveaux: ['ECOLE', 'UP', 'ZONE'], entites: { ECOLE: ecoles, UP: upsV, ZONE: zones, CS: [], DDEMP: [] }, lieu: 'Pobè', fixe: { zone: true },
        autorite: ecoleCle ? { niveau: 'ECOLE', cle: ecoleCle } : null,
        droits: { ecrire: (niv, cle) => niv === 'ECOLE' && String(cle) === ecoleCle } };
    }
    return { niveaux: ['ECOLE', 'UP', 'ZONE', 'CS', 'DDEMP'], entites: { ECOLE: ecoles, UP: upsV, ZONE: zones, CS: [CS], DDEMP: [DDEMP] }, lieu: 'Pobè',
      autorite: { niveau: 'CS', cle: CS.cle },
      droits: { ecrire: () => true } };
  }

  function charger() {
    const r = (D().reglages || []).find(x => x.id === 'uascepFonctions');
    // vie des bureaux (activités, engagements, réunions, caisse, budget, matériel, rapports) et registre des pièces signées
    const v = ((D().reglages || []).find(x => x.id === 'uascepVie') || {}).valeur || {};
    return Promise.resolve(Object.assign({}, v, { version: 1, bureaux: D().uascepBureaux || [], membres: D().uascepMembres || [], fonctions: (r && r.valeur) || [] }));
  }
  function enregistrer(etat) {
    // l'école d'un bureau « École » est portée sur le bureau et ses membres : sur le poste d'une école, les bureaux
    // des autres écoles sont écartés comme toute donnée d'une autre école
    const ecoleDe = {};
    etat.bureaux.forEach(b => { if (b.niveau === 'ECOLE') { const ec = D().ecoles.find(e => String(e.id) === String(b.entite)); b.ecoleId = ec ? ec.id : b.entite; ecoleDe[b.id] = b.ecoleId; } else delete b.ecoleId; });
    etat.membres.forEach(m => { if (ecoleDe[m.bureauId] !== undefined) m.ecoleId = ecoleDe[m.bureauId]; else delete m.ecoleId; });
    D().uascepBureaux = etat.bureaux; D().uascepMembres = etat.membres;
    D().reglages = D().reglages || [];
    let r = D().reglages.find(x => x.id === 'uascepFonctions'); if (!r) { r = { id: 'uascepFonctions' }; D().reglages.push(r); }
    r.valeur = etat.fonctions || [];
    let v = D().reglages.find(x => x.id === 'uascepVie'); if (!v) { v = { id: 'uascepVie' }; D().reglages.push(v); }
    v.valeur = {}; (((global.UASCEP && global.UASCEP.COLLECTIONS) || []).concat(['documents'])).forEach(k => { if (Array.isArray(etat[k])) v.valeur[k] = etat[k]; });
    A().saveData();
    return Promise.resolve();
  }

  /** « ADJOVI Marc » → ['ADJOVI', 'Marc'] ; « ADJOVI MARC KOFFI » → ['ADJOVI', 'MARC KOFFI'] */
  function separer(t) {
    const mots = String(t || '').trim().split(/\s+/).filter(Boolean);
    if (mots.length < 2) return [mots.join(' ').toUpperCase(), ''];
    let k = 0; while (k < mots.length && mots[k] === mots[k].toUpperCase() && /\p{L}/u.test(mots[k])) k++;
    if (k === 0 || k === mots.length) k = 1;
    return [mots.slice(0, k).join(' ').toUpperCase(), mots.slice(k).join(' ')];
  }

  /** Reprise des anciens membres « UASCEP » de la gestion collégiale (école, unité pédagogique, commune → CS). */
  function migrer(etat) {
    const anciens = (D().collegiale || []).filter(m => m && m.instance === 'UASCEP' && !m.migreUascep);
    if (!anciens.length) return null;
    const ctx = contexte();
    anciens.forEach(m => {
      let niv, cle, lib;
      if (m.niveau === 'UP') { niv = 'UP'; cle = m.portee || ''; lib = cle; }
      else if (m.niveau === 'COMMUNE') { niv = 'CS'; cle = CS.cle; lib = CS.lib; }
      else if (m.ecoleId) { niv = 'ECOLE'; cle = String(m.ecoleId); lib = (D().ecoles.find(e => String(e.id) === cle) || {}).nom || cle; }
      if (!niv || !cle) return;
      let b = etat.bureaux.find(x => x.niveau === niv && String(x.entite) === cle && x.statut !== 'archive');
      if (!b) { b = { id: uid(), niveau: niv, entite: cle, entiteLib: lib, dateElection: '', duree: 2, dateFin: '', dateInstallation: '', agDate: '', agLieu: '', pv: '', observations: '', statut: 'actif', creeLe: new Date().toISOString().slice(0, 10), repris: true }; etat.bureaux.push(b); }
      const e = (ctx.entites[niv] || []).find(x => String(x.cle) === cle) || {};
      const ordre = etat.membres.filter(x => x.bureauId === b.id).reduce((s, x) => Math.max(s, +x.ordre || 0), 0) + 1;
      const np = separer(m.nom);
      etat.membres.push({ id: uid(), bureauId: b.id, ordre, nom: np[0], prenoms: np[1], sexe: m.sexe || '', ecole: e.ecole || '', up: e.up || (niv === 'UP' ? cle : ''),
        zone: e.zone || '', rup: e.rup || '', fonction: m.fonction || '', qualite: '', contact: m.contact || '', email: '', dateElection: m.depuis || '', duree: 2,
        dateFin: m.depuis && global.UASCEP ? global.UASCEP.plusAns(m.depuis, 2) : '', dateInstallation: '', observations: m.observation || '', reprisDe: m.id });
      if (!b.dateElection && m.depuis) { b.dateElection = m.depuis; b.dateFin = global.UASCEP ? global.UASCEP.plusAns(m.depuis, 2) : ''; }
      m.migreUascep = true;   // l'ancienne fiche est gardée (rien n'est perdu) mais n'est plus affichée
    });
    enregistrer(etat);
    return etat;
  }

  /* ---------- cachets, visas et code QR : les outils de l'application (Cachets et signatures, page v.html) ---------- */
  const P = () => global.Pieces;
  /** Cachet rond dessiné par l'application (même dessin que ses autres pièces) ; le module dessine les autres formes */
  function cachet(o) {
    const c = String(o.couleur || 'bleu').toUpperCase();
    if (o.forme !== 'rond' || !P() || !P().COULEURS[c]) return null;
    return P().cachet({ cachet_haut: o.haut, cachet_bas: o.bas, cachet_centre: o.centre, cachet_couleur: c, cachet_forme: 'ROND' }, { taille: o.taille || 104 });
  }
  function identite(code) { return (D().identite || []).find(x => x.code === code) || null; }
  /** Visa : le directeur (cachet et signature de l'école), le CP de la zone, le chef de la circonscription */
  function visa(niv, cle) {
    if (!P()) return Promise.resolve(null);
    if (niv === 'ECOLE') {
      const e = D().ecoles.find(x => String(x.id) === String(cle)); if (!e) return Promise.resolve(null);
      const p = A().porteurEcole(e);
      return Promise.resolve({ titre: 'Le Directeur / La Directrice', nom: e.directeur || p.cachet_nom || '', signature: e.signature_image || '', cachet: P().cachet(p, { taille: 100 }) });
    }
    const x = niv === 'ZONE' ? identite('CP-' + String(cle).replace(/\s+/g, '')) : niv === 'CS' ? identite('CCS') : null;
    if (!x) return Promise.resolve(null);
    return Promise.resolve({ titre: x.libelleSignature || x.nom, nom: x.cachet_nom || x.responsable || '', signature: x.signature_image || '', cachet: P().cachet(x, { taille: 100 }) });
  }
  /* Code QR : il mène à la page publique v.html, qui recalcule l'empreinte du numéro et des mentions
     (type de pièce, bureau, membre, fonction, date, signataire) : toute mention modifiée est signalée. */
  const CODES = { COMPOSITION: 'C', PV: 'P', ATTESTATION: 'A', LISTE: 'L', RAPPORT: 'S', CR: 'R', JOURNAL: 'J', ENGAGEMENTS: 'E', FINANCES: 'F', INVENTAIRE: 'I' };
  const octets = (t) => new TextEncoder().encode(t).length;
  function signer(doc) {
    const p = P(); if (!p) return Promise.resolve(null);
    const r = doc.resume || {};
    const numero = 'UASCEP-' + new Date().getFullYear() + '-' + p.empreinte('UASCEP|' + doc.empreinte + '|' + r.date).slice(0, 6);
    const base = p.lienVerification('X', '').split('#')[0];
    const net = (t) => String(t || '').replace(/[|&#]/g, ' ').replace(/\s+/g, ' ').trim();
    const ch = { d: CODES[doc.type] || 'C', b: net(r.bureau), m: net(r.membre), f: net(r.fonction), t: net(r.date), s: net(r.signataire) };
    const lien = () => {
      const e = p.empreinte('CS-POBE|' + numero + '|' + [ch.d, ch.b, ch.m, ch.f, ch.t, ch.s].join('|')).slice(0, 8);
      return { e, url: base + '#n=' + encodeURIComponent(numero) + '&e=' + e + Object.keys(ch).filter(k => ch[k]).map(k => '&' + k + '=' + encodeURIComponent(ch[k]).replace(/%20/g, '+')).join('') };
    };
    // le code QR de l'application va jusqu'à la version 10 : les mentions longues sont raccourcies
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

  async function imprimer(titre, corps) {
    if (typeof corps === 'function') corps = await corps();
    A().openModal(titre, '<div class="xbar no-print"><button class="btn btn-primary" type="button" id="uasImprimer">\uE008 Imprimer / PDF</button></div>'
      + '<div class="page-a4">' + A().enteteDocument({}) + corps + '</div>');
    document.getElementById('uasImprimer').onclick = () => { document.body.classList.add('bilan-print'); window.print(); setTimeout(() => document.body.classList.remove('bilan-print'), 1500); };
  }
  function toast(msg) {
    const t = document.createElement('div'); t.className = 'xtoast'; t.textContent = msg; document.body.append(t);
    setTimeout(() => t.classList.add('on'), 10); setTimeout(() => { t.classList.remove('on'); setTimeout(() => t.remove(), 400); }, 3200);
  }
  const memo = { get: (k) => { try { return localStorage.getItem('uascep.' + k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem('uascep.' + k, v); } catch (e) { /* stockage indisponible */ } } };

  const adaptateur = {
    app: ecoleMode() ? 'Mon école' : 'CS Pobè', charger, enregistrer, migrer, imprimer, toast, memo, cachet, visa, signer,
    contexte: () => Promise.resolve(contexte()),
    xlsxEcrire: (feuilles) => Promise.resolve(global.XlsxEcrire.classeur(feuilles)),
    xlsxLire: (f) => global.Tableur.lireClasseur(f),
    telecharger: (nom, blob) => A().telecharger(nom, blob, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  };

  function page() {
    const el = document.getElementById('uascep'); if (!el || !global.UASCEP) return;
    global.UASCEP.monter(el, adaptateur);
  }
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.uascep = page;
  global.UascepCS = { adaptateur, contexte, migrer: () => charger().then(migrer) };
  // reprise des anciennes fiches dès le démarrage (sans attendre l'ouverture du module)
  setTimeout(() => { try { if (A() && A().data) charger().then(migrer); } catch (e) { /* données pas encore prêtes */ } }, 1500);
})(window);
