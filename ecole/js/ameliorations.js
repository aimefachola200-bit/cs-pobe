/* République du Bénin — MEMP — CS Pobè
   1. Échanges école → circonscription : l'école produit un « paquet » (fichier) envoyé par WhatsApp, Bluetooth
      ou clé USB ; la circonscription l'intègre en un clic, sans ressaisie (fiche de l'école, personnel, effectifs,
      candidats au CEP, cartes, présences, notes…). Un nouvel envoi remplace le précédent.
   2. Sauvegarde : rappel chaque semaine, sauvegarde automatique dans un dossier choisi (PC), envoi vers Drive /
      WhatsApp (téléphone).
   3. Alertes : ce qui manque ou approche (directeurs, numéros, fiches CEP et cartes incomplètes, signatures,
      départs à la retraite, sauvegarde, paquets non reçus, espace de stockage).
   Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const App = () => global.AppBridge;
  const D = () => App().data;
  const esc = v => App().echapper(v);
  const estEcole = () => global.Config.estEcole();
  const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const jours = iso => iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
  const dateFr = iso => iso ? new Date(iso).toLocaleDateString('fr-FR') : '';
  const lsGet = k => { try { return localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* rien */ } };

  function avis(t, duree) {
    const d = document.createElement('div'); d.className = 'xtoast on'; d.textContent = t; document.body.append(d);
    setTimeout(() => d.remove(), duree || 3500);
  }
  function telecharger(blob, nom) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = nom;
    document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
  }
  /** Partage d'un fichier (WhatsApp, Drive, Bluetooth…) sur téléphone ; téléchargement sinon. */
  function partagerFichier(blob, nom, texte) {
    const f = new File([blob], nom, { type: blob.type || 'application/json' });
    if (navigator.canShare && navigator.canShare({ files: [f] })) {
      return navigator.share({ files: [f], title: nom, text: texte }).then(() => true, () => false);
    }
    telecharger(blob, nom); return Promise.resolve(true);
  }
  const peutPartager = () => { try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] })); } catch (e) { return false; } };

  /* ======================= 1. ÉCHANGES ÉCOLE → CIRCONSCRIPTION ======================= */
  const EXCLUES = ['ecoles', 'annees', 'identite', 'joursFeries', 'themesDone', 'whatsapp'];
  const CLE_ENVOI = () => 'dernierPaquet:' + App().CLE_STOCKAGE;

  function paquetEcole() {
    const poste = App().ecoleDuPoste();
    if (!poste) return null;
    const collections = {};
    App().COLLECTIONS.filter(c => EXCLUES.indexOf(c) < 0).forEach(c => {
      const l = (D()[c] || []).filter(x => x && typeof x === 'object' && x.ecoleId === poste.id);
      if (l.length) collections[c] = l;
    });
    return { format: 'POBE-PAQUET-ECOLE', version: 2, cree: new Date().toISOString(), annee: App().anneeActive(),
      ecole: Object.assign({}, poste), collections, reglages: reglagesEcole(poste) };
  }
  /* Données rangées dans les réglages (sans identifiant d'école) qui doivent aussi remonter à la circonscription :
     vie des bureaux UASCEP de l'école (activités, engagements, réunions, caisse, budget, matériel, rapports, pièces signées)
     et modules sport, pilotage, communication, santé, inspection, patrimoine, examens (lots A à C). */
  function reglagesEcole(poste) {
    const r = (id) => (((D().reglages || []).find(x => x.id === id) || {}).valeur) || null;
    const out = {};
    const vie = r('uascepVie');
    if (vie) {
      const bur = new Set((D().uascepBureaux || []).filter(b => String(b.ecoleId) === String(poste.id)).map(b => b.id));
      const v = {};
      Object.keys(vie).forEach(k => { if (Array.isArray(vie[k])) { const l = vie[k].filter(x => x && (k === 'documents' || bur.has(x.bureauId))); if (l.length) v[k] = l; } });
      if (Object.keys(v).length) out.uascepVie = v;
    }
    const ped = r('pedagogieNotes');   // versions modifiées d'épreuves, de fiches, de résumés et notes du module Pédagogie
    if (ped && Object.keys(ped).length) out.pedagogieNotes = ped;
    const pvs = r('pvs');
    if (pvs) {
      const v = {};
      Object.keys(pvs).forEach(k => { if (Array.isArray(pvs[k]) && pvs[k].length) v[k] = pvs[k]; });
      if (Object.keys(v).length) out.pvs = v;
    }
    return out;
  }
  /** Intègre les réglages d'un paquet : chaque enregistrement est marqué de l'école d'origine ; ce que l'école a retiré
      depuis son envoi précédent est retiré aussi. Renvoie le nombre d'enregistrements intégrés. */
  function integrerReglages(paquet, cible, remap) {
    const d = D(); d.reglages = d.reglages || []; let n = 0;
    Object.keys(paquet.reglages || {}).forEach(id => {
      if (id === 'pedagogieNotes' && global.Pedagogie && global.Pedagogie.fusionnerNotes) {
        let reg = d.reglages.find(x => x.id === id); if (!reg) { reg = { id, valeur: {} }; d.reglages.push(reg); }
        const avant = global.Pedagogie.inventaireNotes(reg.valeur || {}).length;
        reg.valeur = global.Pedagogie.fusionnerNotes(reg.valeur || {}, paquet.reglages[id]);
        n += global.Pedagogie.inventaireNotes(reg.valeur).length - avant;
        return;
      }
      if (['uascepVie', 'pvs'].indexOf(id) < 0) return;
      let reg = d.reglages.find(x => x.id === id); if (!reg) { reg = { id, valeur: {} }; d.reglages.push(reg); }
      reg.valeur = reg.valeur || {};
      const src = paquet.reglages[id];
      const colls = new Set(Object.keys(src).concat(Object.keys(reg.valeur).filter(k => Array.isArray(reg.valeur[k]))));
      colls.forEach(k => {
        const dest = Array.isArray(reg.valeur[k]) ? reg.valeur[k] : (reg.valeur[k] = []);
        const garder = dest.filter(x => !(x && x._ecoleSync !== undefined && String(x._ecoleSync) === String(cible.id)));
        const venus = (src[k] || []).map(x => {
          const y = remap(Object.assign({}, x));
          const pris = garder.some(z => z.id === y.id);
          if (pris && k !== 'documents') y.id = 'S-' + cible.id + '-' + y.id;
          y._ecoleSync = cible.id; y._sync = paquet.cree; return y;
        });
        // pièces signées : une seule fois par numéro
        const nums = new Set(garder.filter(x => x && x.numero).map(x => x.numero));
        reg.valeur[k] = garder.concat(k === 'documents' ? venus.filter(x => !x.numero || !nums.has(x.numero)) : venus);
        n += venus.length;
      });
    });
    return n;
  }
  function envoyerPaquet() {
    const p = paquetEcole();
    if (!p) { alert('Inscrivez d’abord votre école (bandeau en haut de l’écran).'); return; }
    const n = Object.values(p.collections).reduce((s, l) => s + l.length, 0);
    const nom = 'paquet_' + norm(p.ecole.nom).replace(/ /g, '-') + '_' + p.cree.slice(0, 10) + '.json';
    partagerFichier(new Blob([JSON.stringify(p)], { type: 'application/json' }), nom,
      'Données de ' + p.ecole.nom + ' pour la Circonscription Scolaire de Pobè (' + n + ' enregistrements).').then(ok => {
      if (ok) { lsSet(CLE_ENVOI(), p.cree); rendreEchanges(); avis('Paquet prêt : ' + n + ' enregistrement(s). Envoyez-le à la circonscription.'); }
    });
  }

  /** Clé « naturelle » d'un enregistrement, pour retrouver ce que la CS a déjà saisi elle-même. */
  function cleNaturelle(c, x) {
    if (c === 'personnel') return norm(x.matricule) || norm(x.nom);
    if (c === 'cep' || c === 'cni' || c === 'apprenants') return norm([x.nom, x.prenoms, x.dateNaiss].join(' '));
    if (c === 'effectifs') return norm(x.annee || '');
    return '';
  }

  function integrer(paquet, cible) {
    const d = D(), touches = new Set(); let n = 0;
    Object.keys(paquet.ecole || {}).forEach(k => {
      if (['id', 'posteLocal', 'code'].indexOf(k) < 0 && paquet.ecole[k] !== '' && paquet.ecole[k] !== null && paquet.ecole[k] !== undefined) cible[k] = paquet.ecole[k];
    });
    /* 1er passage : identifiant final de chaque enregistrement (celui de l'école, sauf s'il est déjà pris ailleurs
       ou si la circonscription avait saisi la même personne : on garde alors le sien). */
    const plan = [], ids = {};
    Object.keys(paquet.collections || {}).forEach(c => {
      if (!Array.isArray(d[c]) || EXCLUES.indexOf(c) >= 0) return;
      paquet.collections[c].forEach(src => {
        const cn = cleNaturelle(c, src);
        let ex = d[c].find(y => y.id === src.id && y.ecoleId === cible.id)
          || d[c].find(y => y.id === 'S-' + cible.id + '-' + src.id)
          || (cn && d[c].find(y => y.ecoleId === cible.id && !touches.has(y.id) && cleNaturelle(c, y) === cn));
        let id = ex ? ex.id : src.id;
        if (!ex && d[c].some(y => y.id === id)) id = 'S-' + cible.id + '-' + src.id;
        touches.add(id); ids[src.id] = id;
        plan.push({ c, src, ex, id });
      });
    });
    /* les références internes (élève d'une note, agent d'une attribution…) suivent les identifiants */
    /* l'identifiant de l'école sur son poste devient celui de la circonscription (bureaux UASCEP « École », modules) */
    const ancien = paquet.ecole && paquet.ecole.id !== undefined ? String(paquet.ecole.id) : null;
    const CLES_ECOLE = { entite: 1, ecole: 1, ecoleId: 1, ecoleCle: 1 };
    const remap = (v, k) => Array.isArray(v) ? v.map(w => remap(w, k)) : (v && typeof v === 'object' ? Object.fromEntries(Object.entries(v).map(([kk, w]) => [kk, remap(w, kk)]))
      : (ancien !== null && CLES_ECOLE[k] && String(v) === ancien ? String(cible.id) : (typeof v === 'string' && ids[v] !== undefined ? ids[v] : v)));
    plan.forEach(({ c, src, ex, id }) => {
      const x = remap(Object.assign({}, src));
      Object.assign(x, { id, ecoleId: cible.id, _sync: paquet.cree });
      if (ex) Object.assign(ex, x); else d[c].push(x);
      n++;
    });
    // ce que l'école a supprimé depuis son précédent envoi disparaît aussi à la circonscription
    let retires = 0;
    App().COLLECTIONS.forEach(c => {
      if (!Array.isArray(d[c]) || EXCLUES.indexOf(c) >= 0) return;
      const avant = d[c].length;
      d[c] = d[c].filter(y => !(y && y.ecoleId === cible.id && y._sync && !touches.has(y.id)));
      retires += avant - d[c].length;
    });
    n += integrerReglages(paquet, cible, remap);
    cible._derniereSync = paquet.cree;
    App().saveData();
    return { n, retires };
  }

  function trouverCible(p) {
    const e = p.ecole || {};
    return D().ecoles.find(x => e.code && x.code === e.code && norm(x.nom) === norm(e.nom))
      || D().ecoles.find(x => norm(x.nom) === norm(e.nom))
      || D().ecoles.find(x => e.code && x.code === e.code) || null;
  }

  function recevoirPaquets(fichiers) {
    const liste = Array.from(fichiers || []);
    const bilan = [];
    const suivant = () => {
      const f = liste.shift();
      if (!f) { finir(); return; }
      f.text().then(t => {
        let p = null; try { p = JSON.parse(t); } catch (e) { p = null; }
        if (!p || p.format !== 'POBE-PAQUET-ECOLE') { bilan.push('\uE002 ' + f.name + ' : ce n’est pas un paquet d’école.'); suivant(); return; }
        const cible = trouverCible(p);
        if (cible) { const r = integrer(p, cible); bilan.push('\uE003 ' + cible.nom + ' : ' + r.n + ' enregistrement(s) intégrés' + (r.retires ? ', ' + r.retires + ' retiré(s)' : '') + ' (envoi du ' + dateFr(p.cree) + ').'); suivant(); return; }
        App().openModal('À quelle école correspond ce paquet ?',
          '<p>Le paquet « ' + esc(f.name) + ' » vient de <b>' + esc((p.ecole || {}).nom || '?') + '</b>, que l’application ne retrouve pas dans la liste.</p>'
          + '<div class="form-group"><label>École de la circonscription</label><select id="cibleSync"><option value="">— Ignorer ce paquet —</option>'
          + D().ecoles.slice().sort((a, b) => String(a.nom).localeCompare(String(b.nom), 'fr')).map(x => '<option value="' + x.id + '">' + esc(x.nom) + '</option>').join('')
          + '</select></div><div class="text-center mt-15"><button class="btn btn-primary" id="okSync">Continuer</button></div>');
        document.getElementById('okSync').onclick = () => {
          const id = document.getElementById('cibleSync').value, c = D().ecoles.find(x => x.id == id);
          if (c) { const r = integrer(p, c); bilan.push('\uE003 ' + c.nom + ' : ' + r.n + ' enregistrement(s) intégrés.'); } else bilan.push('— ' + f.name + ' ignoré.');
          App().closeModal(); suivant();
        };
      });
    };
    const finir = () => { App().openModal('Paquets reçus', '<ul>' + bilan.map(b => '<li>' + esc(b) + '</li>').join('') + '</ul>'); rendreEchanges(); majBadge(); };
    suivant();
  }

  function rendreEchanges() {
    const page = document.getElementById('echanges');
    if (!page) return;
    if (estEcole()) {
      const p = paquetEcole(), dernier = lsGet(CLE_ENVOI());
      const n = p ? Object.values(p.collections).reduce((s, l) => s + l.length, 0) : 0;
      page.innerHTML = '<div class="page-title">\uE058 Envoyer mes données à la circonscription</div><div class="form-container">'
        + '<p>Votre application prépare un <b>paquet</b> avec la fiche de l’école, le personnel, les effectifs, les candidats au CEP, les cartes, '
        + 'les présences et les notes. Envoyez-le à la circonscription par <b>WhatsApp</b>, Bluetooth ou clé USB : elle l’intègre en un clic, sans rien ressaisir.</p>'
        + '<p class="alert alert-info">' + (p ? n + ' enregistrement(s) prêts.' : 'Inscrivez d’abord votre école.') + ' Dernier envoi : <b>'
        + (dernier ? dateFr(dernier) + ' (il y a ' + jours(dernier) + ' jour(s))' : 'jamais') + '</b>.</p>'
        + '<button class="btn btn-primary" onclick="Ameliorations.envoyerPaquet()">\uE00C ' + (peutPartager() ? 'Envoyer le paquet (WhatsApp, Bluetooth…)' : 'Télécharger le paquet') + '</button>'
        + '<p class="petit muet mt-15">Conseil : envoyez un paquet chaque fin de mois et après chaque inscription au CEP. Chaque envoi remplace le précédent à la circonscription.</p></div>';
      return;
    }
    const ecoles = D().ecoles;
    const recus = ecoles.filter(e => e._derniereSync).sort((a, b) => String(b._derniereSync).localeCompare(String(a._derniereSync)));
    page.innerHTML = '<div class="page-title">\uE058 Paquets reçus des écoles</div><div class="form-container">'
      + '<p>Chaque école envoie son paquet (fichier <code>paquet_….json</code>) par WhatsApp ou clé USB. Enregistrez les fichiers reçus, puis '
      + 'sélectionnez-les ici (plusieurs à la fois) : fiches, personnel, effectifs, candidats au CEP, cartes, présences et notes sont intégrés à leur école.</p>'
      + '<button class="btn btn-primary" onclick="document.getElementById(\'fichiersPaquets\').click()">\uE00B Recevoir des paquets</button>'
      + '<input type="file" id="fichiersPaquets" hidden multiple accept=".json,application/json" onchange="Ameliorations.recevoirPaquets(this.files); this.value=\'\'">'
      + '<p class="alert alert-info mt-15"><b>' + recus.length + '</b> école(s) sur ' + ecoles.length + ' ont déjà envoyé un paquet.</p></div>'
      + '<div class="table-container"><div class="table-scroll"><table><thead><tr><th>École</th><th>Dernier paquet</th><th>Ancienneté</th></tr></thead><tbody>'
      + (recus.map(e => { const j = jours(e._derniereSync); return '<tr><td><b>' + esc(e.nom) + '</b></td><td>' + dateFr(e._derniereSync) + '</td><td><span class="badge badge-'
        + (j > 30 ? 'danger' : j > 14 ? 'warning' : 'success') + '">' + j + ' jour(s)</span></td></tr>'; }).join('')
        || '<tr><td colspan="3" class="text-center">Aucun paquet reçu pour le moment</td></tr>') + '</tbody></table></div></div>';
  }

  /* ======================= 2. SAUVEGARDE ======================= */
  const CLE_SAUV = () => 'derniereSauvegarde:' + App().CLE_STOCKAGE;
  const CLE_REPORT = () => 'sauvegardeReport:' + App().CLE_STOCKAGE;
  const CLE_DOSSIER = () => 'dossierSauvegarde:' + App().CLE_STOCKAGE;
  const nomSauvegarde = () => (estEcole() ? 'ecole_pobe_' : 'cs_pobe_') + new Date().toISOString().slice(0, 10) + '.json';
  const blobDonnees = () => new Blob([JSON.stringify(D(), null, 1)], { type: 'application/json' });
  const marquer = () => lsSet(CLE_SAUV(), new Date().toISOString());

  async function dossier() { return global.Stockage && global.Stockage.lireCle ? global.Stockage.lireCle(CLE_DOSSIER()) : null; }
  async function ecrireDansDossier(h) {
    const f = await h.getFileHandle(nomSauvegarde(), { create: true });
    const w = await f.createWritable(); await w.write(blobDonnees()); await w.close();
    marquer();
  }
  async function choisirDossier() {
    try {
      const h = await global.showDirectoryPicker({ mode: 'readwrite', id: 'sauvegarde-pobe' });
      await global.Stockage.ecrireCle(CLE_DOSSIER(), h);
      await ecrireDansDossier(h);
      avis('Dossier retenu : une sauvegarde y sera écrite chaque semaine, automatiquement.');
      rendreSauvegarde();
    } catch (e) { if (e && e.name !== 'AbortError') alert('Dossier non accessible : ' + e.message); }
  }
  async function sauvegarderMaintenant(partage) {
    if (partage) { const ok = await partagerFichier(blobDonnees(), nomSauvegarde(), 'Sauvegarde ' + nomSauvegarde()); if (ok) marquer(); }
    else {
      const h = await dossier();
      if (h) {
        try { if ((await h.requestPermission({ mode: 'readwrite' })) === 'granted') { await ecrireDansDossier(h); avis('Sauvegarde écrite dans votre dossier.'); fermerRappel(); rendreSauvegarde(); return; } } catch (e) { /* téléchargement */ }
      }
      App().exportData(); marquer();
    }
    fermerRappel(); rendreSauvegarde(); majBadge();
  }

  function rendreSauvegarde() {
    const page = document.getElementById('backup');
    if (!page) return;
    let z = document.getElementById('sauvegardeAuto');
    if (!z) { z = document.createElement('div'); z.id = 'sauvegardeAuto'; z.className = 'form-container mt-15'; page.appendChild(z); }
    const der = lsGet(CLE_SAUV());
    dossier().then(h => {
      z.innerHTML = '<h3 style="color:#006633;margin-bottom:10px;">Sauvegarde régulière</h3>'
        + '<p>Dernière sauvegarde : <b>' + (der ? dateFr(der) + ' (il y a ' + jours(der) + ' jour(s))' : 'jamais') + '</b>. Un rappel s’affiche chaque semaine.</p>'
        + (global.showDirectoryPicker
          ? '<p>' + (h ? '\uE013 Sauvegarde automatique active dans le dossier « <b>' + esc(h.name) + '</b> » (une fois par semaine, à l’ouverture).'
            : 'Sur ordinateur, choisissez un dossier (clé USB, Google Drive pour ordinateur…) : l’application y écrira seule une sauvegarde chaque semaine.') + '</p>'
            + '<button class="btn btn-primary" onclick="Ameliorations.choisirDossier()">\uE013 ' + (h ? 'Changer de dossier' : 'Choisir le dossier de sauvegarde') + '</button> '
          : '')
        + '<button class="btn btn-info" onclick="Ameliorations.sauvegarderMaintenant(false)">\uE007 Sauvegarder maintenant</button> '
        + (peutPartager() ? '<button class="btn btn-success" onclick="Ameliorations.sauvegarderMaintenant(true)">\uE00C Envoyer vers Drive, WhatsApp…</button>' : '');
    });
  }

  function fermerRappel() { const b = document.getElementById('rappelSauvegarde'); if (b) b.remove(); }
  async function verifierSauvegarde() {
    const total = App().COLLECTIONS.reduce((s, c) => s + ((D()[c] || []).length), 0);
    if (total < 5) return;
    const der = lsGet(CLE_SAUV()), j = jours(der);
    if (der && j < 7) return;
    const h = await dossier();
    if (h) {
      try { if ((await h.queryPermission({ mode: 'readwrite' })) === 'granted') { await ecrireDansDossier(h); avis('Sauvegarde automatique de la semaine faite dans « ' + h.name + ' ».'); return; } } catch (e) { /* rappel */ }
    }
    const report = lsGet(CLE_REPORT());
    if (report && jours(report) < 1) return;
    fermerRappel();
    const b = document.createElement('div');
    b.id = 'rappelSauvegarde'; b.className = 'rappel-sauvegarde';
    b.innerHTML = '<span>\uE007 ' + (der ? 'Dernière sauvegarde il y a ' + j + ' jours.' : 'Aucune sauvegarde de vos données pour l’instant.')
      + ' Sauvegardez pour ne rien perdre en cas de panne ou de perte de l’appareil.</span>'
      + '<button class="btn btn-sm btn-primary" onclick="Ameliorations.sauvegarderMaintenant(' + (peutPartager() ? 'true' : 'false') + ')">Sauvegarder</button>'
      + '<button class="btn btn-sm" onclick="Ameliorations.reporter()">Plus tard</button>';
    document.body.appendChild(b);
  }
  function reporter() { lsSet(CLE_REPORT(), new Date().toISOString()); fermerRappel(); }

  /* ======================= 3. ALERTES ======================= */
  const NUM_OK = n => global.WhatsApp ? !!global.WhatsApp.normaliser(n) : /\d{8,}/.test(String(n || ''));

  function alertes() {
    const d = D(), l = [];
    const ajoute = (niveau, titre, details, action, libelle) => l.push({ niveau, titre, details: details || [], action, libelle });
    const ecoles = d.ecoles;
    if (!estEcole()) {
      const sansDir = ecoles.filter(e => !String(e.directeur || '').trim());
      if (sansDir.length) ajoute('warning', sansDir.length + ' école(s) sans directeur renseigné', sansDir.map(e => e.nom), "showPage('ecoles', document.querySelector('.menu-item[data-page=ecoles]'))", 'Ouvrir les écoles');
      const sansNum = ecoles.filter(e => String(e.directeur || '').trim() && !NUM_OK(e.contact_directeur));
      if (sansNum.length) ajoute('info', sansNum.length + ' directeur(s) sans numéro WhatsApp valide', sansNum.map(e => e.nom + ' — ' + e.directeur), "showPage('whatsapp', document.querySelector('.menu-item[data-page=whatsapp]'))", 'Compléter les numéros');
      const anciens = ecoles.filter(e => e._derniereSync && jours(e._derniereSync) > 30);
      if (anciens.length) ajoute('warning', anciens.length + ' école(s) sans nouveau paquet depuis plus de 30 jours', anciens.map(e => e.nom + ' (' + dateFr(e._derniereSync) + ')'), "showPage('echanges', document.querySelector('.menu-item[data-page=echanges]'))", 'Voir les échanges');
    }
    const sansSig = ecoles.filter(e => (!estEcole() || e.posteLocal) && (d.cep.some(c => c.ecoleId === e.id) || d.cni.some(c => c.ecoleId === e.id)) && !e.signature_image);
    if (sansSig.length) ajoute('danger', sansSig.length + ' école(s) sans signature du directeur (fiches et cartes non signées)', sansSig.map(e => e.nom), "showPage('identite', document.querySelector('.menu-item[data-page=identite]'))", 'Cachets et signatures');
    const manqueCEP = c => [!c.photo && 'photo', !c.dateNaiss && 'date de naissance', !c.lieuNaiss && 'lieu de naissance', !c.matricule && 'N° EDUCMaster',
      !c.centre && 'centre', !c.sig_candidat && 'signature du candidat', !c.sig_parent && 'signature du parent', !c.choix1 && 'établissements choisis'].filter(Boolean);
    const cepInc = d.cep.map(c => ({ c, m: manqueCEP(c) })).filter(x => x.m.length);
    if (cepInc.length) ajoute('warning', cepInc.length + ' fiche(s) d’inscription au CEP incomplète(s) sur ' + d.cep.length,
      cepInc.map(x => [x.c.nom, x.c.prenoms].filter(Boolean).join(' ') + ' (' + App().nomEcole(x.c.ecoleId) + ') : ' + x.m.join(', ')), "showPage('cep', document.querySelector('.menu-item[data-page=cep]'))", 'Inscription CEP');
    const cniInc = d.cni.map(c => ({ c, m: [!c.photo && 'photo', !c.sig_eleve && 'signature', !c.dateNaiss && 'date de naissance', !c.classe && 'classe'].filter(Boolean) })).filter(x => x.m.length);
    if (cniInc.length) ajoute('info', cniInc.length + ' carte(s) d’identité incomplète(s)', cniInc.map(x => [x.c.nom, x.c.prenoms].filter(Boolean).join(' ') + ' : ' + x.m.join(', ')), "showPage('cni', document.querySelector('.menu-item[data-page=cni]'))", 'Cartes d’identité');
    if (global.Carriere) {
      const dans2 = new Date(); dans2.setFullYear(dans2.getFullYear() + 2);
      const dep = d.personnel.filter(p => global.Carriere.estActif(p)).map(p => ({ p, dr: global.Carriere.dateRetraite(p.dateNaissance, p.grade, p.statut) }))
        .filter(x => x.dr && x.dr <= dans2).sort((a, b) => a.dr - b.dr);
      if (dep.length) ajoute(dep.some(x => x.dr < new Date()) ? 'danger' : 'warning', dep.length + ' départ(s) à la retraite d’ici deux ans',
        dep.map(x => x.p.nom + ' — ' + App().nomEcole(x.p.ecoleId) + ' : ' + x.dr.toLocaleDateString('fr-FR') + (x.dr < new Date() ? ' (date dépassée)' : '')), "showPage('retraite', document.querySelector('.menu-item[data-page=retraite]'))", 'Retraites');
    }
    const der = lsGet(CLE_SAUV());
    if (!der || jours(der) >= 7) ajoute(der ? 'warning' : 'danger', der ? 'Dernière sauvegarde il y a ' + jours(der) + ' jours' : 'Aucune sauvegarde des données', [], 'Ameliorations.sauvegarderMaintenant(' + (peutPartager() ? 'true' : 'false') + ')', 'Sauvegarder maintenant');
    if (estEcole()) {
      const env = lsGet(CLE_ENVOI());
      if (!env || jours(env) > 30) ajoute('info', env ? 'Dernier paquet envoyé à la circonscription il y a ' + jours(env) + ' jours' : 'Aucun paquet envoyé à la circonscription', [], 'Ameliorations.envoyerPaquet()', 'Envoyer le paquet');
    }
    return l;
  }

  async function rendreAlertes() {
    const page = document.getElementById('alertes');
    if (!page) return;
    const l = alertes();
    const est = global.Stockage ? await global.Stockage.estimation() : null;
    if (est && est.quota && est.usage / est.quota > 0.8) l.unshift({ niveau: 'danger', titre: 'Espace de stockage presque plein (' + Math.round(100 * est.usage / est.quota) + ' %)', details: ['Faites une sauvegarde, puis supprimez les photos et documents inutiles.'] });
    const ordre = { danger: 0, warning: 1, info: 2 };
    l.sort((a, b) => ordre[a.niveau] - ordre[b.niveau]);
    page.innerHTML = '<div class="page-title">\uE041 Alertes et points à compléter</div>'
      + (l.length ? l.map((a, i) => '<div class="alerte alerte-' + a.niveau + '"><div class="alerte-tete"><b>' + esc(a.titre) + '</b>'
        + (a.action ? '<button class="btn btn-sm btn-primary" onclick="' + a.action + '">' + esc(a.libelle) + '</button>' : '') + '</div>'
        + (a.details.length ? '<details' + (i < 2 ? ' open' : '') + '><summary>Détail (' + a.details.length + ')</summary><ul>'
          + a.details.slice(0, 60).map(x => '<li>' + esc(x) + '</li>').join('') + (a.details.length > 60 ? '<li>… et ' + (a.details.length - 60) + ' autre(s)</li>' : '') + '</ul></details>' : '')
        + '</div>').join('')
        : '<p class="alert alert-success">\uE003 Rien à signaler : tout est à jour.</p>');
    majBadge(l.length);
  }

  function majBadge(n) {
    const item = document.querySelector('.menu-item[data-page="alertes"]');
    if (!item) return;
    if (n === undefined) n = alertes().length;
    let b = item.querySelector('.badge-alertes');
    if (!b) { b = document.createElement('span'); b.className = 'badge-alertes'; item.appendChild(b); }
    b.textContent = n || ''; b.style.display = n ? '' : 'none';
  }

  global.Ameliorations = { envoyerPaquet, recevoirPaquets, integrer, paquetEcole, choisirDossier, sauvegarderMaintenant, reporter, alertes, rendreAlertes };
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.echanges = rendreEchanges;
  global.Extra.pages.alertes = rendreAlertes;

  // la page Sauvegarde reçoit le bloc « Sauvegarde régulière »
  const menuSauv = document.querySelector('.menu-item[data-page="backup"]');
  if (menuSauv) menuSauv.addEventListener('click', () => setTimeout(rendreSauvegarde, 0));
  setTimeout(() => { verifierSauvegarde(); majBadge(); }, 2500);
})(window);
