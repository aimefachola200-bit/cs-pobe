/* CS Pobè / Mon école — « Synchronisation entre niveaux » (protocole commun memp-sync v1, /home/claude/outils/sync/spec.md).
   Mon école (niveau École) envoie à la CS Pobè ; la CS Pobè (hub par fichier) intègre les envois des écoles, prépare pour elles
   les notes de service, échéances et agenda, et relaie vers le niveau départemental (MEMP-CP DDEMP, SCOLARIS ddemp).
   Objets : bureaux et vie UASCEP, registres partagés, versions pédagogiques (js/sync-commun.js) + paquet « Échanges » de l'école.
   Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const A = () => global.AppBridge;
  if (!A() || !global.SyncClient || !global.SyncCommun || !global.Ed25519) return;
  const ecole = !!(global.Config && global.Config.estEcole && global.Config.estEcole());
  const norm = global.SyncCommun.norm, D = () => A().data;
  const reglage = (id) => ((D().reglages || []).find(x => x.id === id) || {}).valeur;
  const ecrireReglage = (id, v) => { D().reglages = D().reglages || []; let r = D().reglages.find(x => x.id === id); if (!r) { r = { id }; D().reglages.push(r); } r.valeur = v; A().saveData(); return Promise.resolve(); };
  const commun = global.SyncCommun.creer({
    uascep: global.UascepCS ? { charger: () => global.UascepCS.adaptateur.charger(), enregistrer: (e) => global.UascepCS.adaptateur.enregistrer(e) } : null,
    pvs: global.PvsCS ? { charger: () => global.PvsCS.adaptateur().charger(), enregistrer: (e) => global.PvsCS.adaptateur().enregistrer(e) } : null,
    pedagogie: { charger: () => Promise.resolve(reglage('pedagogieNotes') || {}), enregistrer: (e) => ecrireReglage('pedagogieNotes', e) },
    ecoleCode: (id) => { const e = (D().ecoles || []).find(x => String(x.id) === String(id)); return e ? { code: e.code || '', nom: e.nom } : null; },
    ecoleLocale: (code, nom, parNom) => { const l = D().ecoles || []; const e = (!parNom && l.find(x => x.code && norm(x.code) === norm(code))) || l.find(x => norm(x.nom) === norm(parNom ? code : nom)); return e ? e.id : null; }
  });
  const client = global.SyncClient.installer({
    application: ecole ? 'Mon-ecole' : 'CS-Pobe', version: (global.Config && global.Config.version) || '', titre: ecole ? 'Mon école' : 'CS Pobè', couleur: '#006633',
    identite: async () => {
      if (ecole) { const p = A().ecoleDuPoste() || {}; return { niveau: 'ECOLE', code: p.code || ('NOM:' + norm(p.nom || '')), nom: p.nom || 'École', cs: 'Pobè', departement: 'Plateau' }; }
      return { niveau: 'CS', code: 'POBE', nom: 'Circonscription scolaire de Pobè', cs: 'Pobè', departement: 'Plateau' };
    },
    objets: () => commun.objets(), appliquer: (o) => commun.appliquer(o), debut: () => commun.debut(), fin: () => commun.fin(),
    // paquet « Échanges » de l'école (fiche, personnel, effectifs, CEP…) ; les réglages passent déjà par les objets synchronisés
    transmission: ecole ? async () => { const p = global.Ameliorations && global.Ameliorations.paquetEcole(); if (!p) return null; delete p.reglages; ['uascepBureaux', 'uascepMembres'].forEach(c => { if (p.collections) delete p.collections[c]; }); return p; } : null,
    recevoirTransmission: ecole ? null : async (t, em) => {
      if (!t || t.format !== 'POBE-PAQUET-ECOLE' || !global.Ameliorations) return '';
      const e = t.ecole || {}, l = D().ecoles || [];
      const cible = l.find(x => e.code && x.code === e.code) || l.find(x => norm(x.nom) === norm(e.nom)) || null;
      if (!cible) return 'école « ' + (e.nom || em.nom) + ' » introuvable : paquet d’échanges à intégrer à la main (Échanges)';
      const r = global.Ameliorations.integrer(t, cible); return r.n + ' enregistrement(s) de ' + cible.nom;
    },
    estHub: () => !ecole
  });
  global.SyncCS = { client };
  function ouvrir() {
    const ov = document.createElement('div'); ov.dataset.sync = 'fenetre';
    ov.style.cssText = 'position:fixed;inset:0;z-index:9000;background:#F8FAFC;overflow:auto;padding:12px';
    const tete = document.createElement('div');
    tete.style.cssText = 'display:flex;justify-content:space-between;align-items:center;gap:8px;position:sticky;top:-12px;background:#006633;color:#fff;margin:-12px -12px 12px;padding:10px 14px;z-index:2';
    tete.innerHTML = '<b>Synchronisation entre niveaux</b><button type="button" aria-label="Fermer" style="background:none;border:0;color:#fff;font-size:24px;cursor:pointer;min-width:40px;min-height:40px">×</button>';
    tete.querySelector('button').onclick = () => ov.remove();
    const z = document.createElement('div'); ov.append(tete, z); document.body.append(ov);
    client.page(z).catch(e => { z.textContent = 'La synchronisation n’a pas pu s’ouvrir : ' + e.message; });
  }
  global.SyncCS.ouvrir = ouvrir;
  function menu() {
    const g = document.getElementById('menuSecurite') || document.getElementById('menuGuide');
    if (!g || document.getElementById('menuSync')) return;
    const d = document.createElement('div');
    d.className = 'menu-item'; d.id = 'menuSync'; d.setAttribute('role', 'button'); d.tabIndex = 0; d.dataset.sync = 'menu';
    d.innerHTML = '<span class="icon">' + (global.Icones ? global.Icones.icone('synchro', { taille: 18 }) : '') + '</span> Synchronisation';
    d.onclick = ouvrir; d.onkeydown = (e) => { if (e.key === 'Enter') ouvrir(); };
    g.after(d);
  }
  menu();
})(window);
