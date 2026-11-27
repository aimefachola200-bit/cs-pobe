/* République du Bénin — MEMP — CS Pobè
   Groupe WhatsApp des directeurs.
   WhatsApp ne permet à aucune application (site, PWA, logiciel) de créer un groupe ni d'y ajouter des membres
   à la place de l'administrateur. La page fait donc tout le reste automatiquement :
   - elle rassemble les numéros des directeurs (fiche de l'école, sinon fiche du personnel « Directeur »),
     les met au format international du Bénin (+229 01 XX XX XX XX) et écarte les numéros invalides ;
   - elle produit un fichier de contacts (.vcf) à ouvrir sur le téléphone : une fois les contacts importés,
     l'écran « Nouveau groupe » de WhatsApp ne propose QUE ceux qui ont un compte WhatsApp, préfixés « CSP Dir » :
     il suffit de tout cocher ;
   - elle envoie le lien d'invitation du groupe à chaque directeur en un toucher (wa.me), avec suivi des envois.
   Les numéros restent sur cet appareil. Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';
  const App = () => global.AppBridge;
  const esc = v => App().echapper(v);
  const PREFIXE = 'CSP Dir';

  function etat() {
    const d = App().data;
    if (!Array.isArray(d.whatsapp)) d.whatsapp = [];
    let g = d.whatsapp.find(x => x.id === 'groupe');
    if (!g) {
      g = { id: 'groupe', nom: 'Directeurs CS Pobè ' + App().anneeActive(), lien: '', contacts: {},
        message: 'Bonjour {directeur}, directeur/directrice de {ecole}. La Circonscription Scolaire de Pobè vous invite à rejoindre le groupe WhatsApp « {groupe} » : {lien}' };
      d.whatsapp.push(g);
    }
    g.contacts = g.contacts || {};
    return g;
  }

  /** Numéro béninois au format international sans « + » (2290197000000), ou '' s'il est invalide.
      Depuis le 30/11/2024, les numéros mobiles comptent 10 chiffres et commencent par 01 ; un ancien numéro
      à 8 chiffres reçoit le préfixe 01. */
  function normaliser(brut) {
    let n = String(brut || '').replace(/[^\d+]/g, '');
    if (!n) return '';
    n = n.replace(/^\+/, '').replace(/^00/, '');
    if (n.indexOf('229') === 0 && n.length >= 11) n = n.slice(3);
    if (n.length === 8) n = '01' + n;
    return /^01\d{8}$/.test(n) ? '229' + n : '';
  }
  const lisible = n => n ? '+229 ' + n.slice(3).replace(/(\d{2})(?=\d)/g, '$1 ') : '';

  /** Directeurs connus : un par école, avec leur numéro. */
  function directeurs() {
    const d = App().data, g = etat();
    return d.ecoles.slice().sort((a, b) => String(a.arrondissement || '').localeCompare(String(b.arrondissement || ''), 'fr')
      || String(a.nom || '').localeCompare(String(b.nom || ''), 'fr')).map(e => {
      const agent = d.personnel.find(p => p.ecoleId == e.id && /direct/i.test(p.fonction || '') && p.telephone);
      const brut = e.contact_directeur || (agent && agent.telephone) || '';
      const num = normaliser(brut);
      const c = g.contacts[e.id] || {};
      return { e, nom: e.directeur || (agent && agent.nom) || '', brut, num, wa: c.wa !== false, envoye: c.envoye || '',
        zone: e.zone_ped || e.arrondissement || '' };
    });
  }

  function filtre() {
    const z = (document.getElementById('waZone') || {}).value || '';
    const nonInv = (document.getElementById('waNonInvites') || {}).checked;
    return directeurs().filter(x => (!z || x.zone === z) && (!nonInv || !x.envoye));
  }

  function message(x) {
    const g = etat();
    return String(g.message || '').replace(/\{directeur\}/g, x.nom || 'Monsieur/Madame le Directeur')
      .replace(/\{ecole\}/g, x.e.nom || '').replace(/\{groupe\}/g, g.nom || '').replace(/\{lien\}/g, g.lien || '');
  }

  /* ---------------- Messages prêts à l'emploi ---------------- */
  const MODELES = {
    convocation: { l: 'Convocation à une réunion', t: '\uE050 *CONVOCATION — Circonscription Scolaire de Pobè*\n\n{salut}Les directeurs et directrices sont convoqués à {objet} le *{date}* à *{heure}* à {lieu}.\n{precisions}\nPrésence obligatoire.\n\nLe Chef de la Circonscription Scolaire' },
    rappel: { l: 'Rappel de rapport ou de document', t: '\uE01A *RAPPEL — CS Pobè*\n\n{salut}{objet} est attendu au plus tard le *{date}*.\n{precisions}\nMerci d’envoyer aussi le paquet de données de l’application École Pobè (menu « Échanges »).' },
    paquet: { l: 'Demande du paquet de données', t: '\uE058 *CS Pobè — Données des écoles*\n\n{salut}Merci d’envoyer avant le *{date}* le paquet de données de votre école : application École Pobè → « Échanges » → « Envoyer le paquet », puis choisir WhatsApp et ce numéro.\n{precisions}' },
    resultats: { l: 'Résultats / statistiques', t: '\uE015 *RÉSULTATS — CS Pobè*\n\n{salut}{objet}\n{precisions}' },
    information: { l: 'Information générale', t: '\uE07B *INFORMATION — CS Pobè*\n\n{salut}{objet}\n{precisions}' },
    libre: { l: 'Message libre', t: '{salut}{precisions}' }
  };
  function texteModele(x) {
    const g = etat(), m = g.modele || {};
    const v = k => String(m[k] || '').trim();
    const dt = v('date') ? new Date(v('date') + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : '…';
    return (MODELES[m.type || 'convocation'] || MODELES.information).t
      .replace('{salut}', x ? 'Bonjour ' + (x.nom || 'Monsieur/Madame le Directeur') + ' (' + x.e.nom + '),\n' : '')
      .replace('{objet}', v('objet') || '…').replace('{date}', dt).replace('{heure}', v('heure') || '…')
      .replace('{lieu}', v('lieu') || 'la Circonscription Scolaire').replace('{precisions}', v('precisions'))
      .replace(/\n{3,}/g, '\n\n').trim();
  }
  function lireModele() {
    const g = etat(); g.modele = g.modele || {};
    ['type', 'objet', 'date', 'heure', 'lieu', 'precisions'].forEach(k => { const el = document.getElementById('waM_' + k); if (el) g.modele[k] = el.value; });
    App().saveData();
    const ap = document.getElementById('waApercu'); if (ap) ap.textContent = texteModele(null);
  }
  function messageAuGroupe() {
    lireModele();
    global.open('https://wa.me/?text=' + encodeURIComponent(texteModele(null)), '_blank', 'noopener');
  }
  function messageSuivant() {
    lireModele();
    const g = etat(), cle = JSON.stringify(g.modele);
    if (!g.serie || g.serie.cle !== cle) g.serie = { cle, faits: {} };
    const x = filtre().find(y => y.num && y.wa && !g.serie.faits[y.e.id]);
    if (!x) { avis('Message envoyé à tous les directeurs retenus.'); return; }
    global.open('https://wa.me/' + x.num + '?text=' + encodeURIComponent(texteModele(x)), '_blank', 'noopener');
    g.serie.faits[x.e.id] = new Date().toISOString();
    App().saveData();
    const reste = filtre().filter(y => y.num && y.wa && !g.serie.faits[y.e.id]).length;
    avis('Ouvert pour ' + x.e.nom + '. Reste ' + reste + ' directeur(s) : touchez encore « Au suivant ».');
  }
  function blocMessages() {
    const m = etat().modele || {};
    const champ = (k, l, type) => '<div class="form-group"><label>' + l + '</label><input id="waM_' + k + '" type="' + (type || 'text') + '" value="' + esc(m[k] || '') + '" oninput="WhatsApp.lireModele()"></div>';
    return '<div class="card wa-carte"><h3 style="color:#006633;margin:0 0 8px;">\uE04F Messages prêts à l’emploi</h3>'
      + '<div class="form-grid"><div class="form-group"><label>Modèle</label><select id="waM_type" onchange="WhatsApp.lireModele()">'
      + Object.keys(MODELES).map(k => '<option value="' + k + '"' + ((m.type || 'convocation') === k ? ' selected' : '') + '>' + MODELES[k].l + '</option>').join('') + '</select></div>'
      + champ('objet', 'Objet (réunion, document, résultat…)') + champ('date', 'Date', 'date') + champ('heure', 'Heure', 'time') + champ('lieu', 'Lieu')
      + '<div class="form-group" style="grid-column:1/-1;"><label>Précisions</label><textarea id="waM_precisions" rows="2" oninput="WhatsApp.lireModele()">' + esc(m.precisions || '') + '</textarea></div></div>'
      + '<pre id="waApercu" class="wa-apercu">' + esc(texteModele(null)) + '</pre>'
      + '<div class="xbar"><button class="btn btn-success" onclick="WhatsApp.messageAuGroupe()">\uE01C Envoyer au groupe</button>'
      + '<button class="btn btn-info" onclick="WhatsApp.messageSuivant()">\uE01D À chaque directeur — au suivant</button></div>'
      + '<p class="petit muet">« Envoyer au groupe » ouvre WhatsApp avec le message : choisissez le groupe des directeurs. « À chaque directeur » ouvre une conversation personnalisée par directeur, l’un après l’autre.</p></div>';
  }

  function rendu() {
    const page = document.getElementById('whatsapp');
    if (!page) return;
    const g = etat(), tous = directeurs();
    const zones = [...new Set(tous.map(x => x.zone).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr'));
    const valides = tous.filter(x => x.num), retenus = valides.filter(x => x.wa), invites = retenus.filter(x => x.envoye);
    page.innerHTML = '<div class="page-title">\uE035 Groupe WhatsApp des directeurs</div>'
      + '<div class="card wa-carte">'
      + '<div class="wa-chiffres"><div><b>' + tous.length + '</b><span>écoles</span></div><div><b>' + valides.length
      + '</b><span>numéros valides</span></div><div><b>' + retenus.length + '</b><span>avec WhatsApp</span></div><div><b>'
      + invites.length + '</b><span>invités</span></div></div>'
      + '<ol class="wa-etapes">'
      + '<li><b>Contacts :</b> touchez « \uE012 Contacts pour WhatsApp » sur le téléphone qui administrera le groupe, puis ouvrez le fichier'
      + ' et importez les contacts. Ils s’appellent tous « ' + PREFIXE + ' … ».</li>'
      + '<li><b>Créer le groupe :</b> WhatsApp → ⋮ → Nouveau groupe → tapez « ' + PREFIXE + ' » et cochez tout. WhatsApp ne propose'
      + ' que les directeurs qui ont un compte WhatsApp : les autres sont écartés d’eux-mêmes.</li>'
      + '<li><b>Lien d’invitation :</b> dans le groupe → Infos → Inviter via un lien → Copier, puis collez-le ci-dessous.'
      + ' Envoyez-le aux directeurs absents du groupe (\uE035), un toucher par directeur ; l’envoi est noté.</li></ol>'
      + '<p class="petit muet">WhatsApp n’autorise aucune application à créer un groupe ou à y ajouter quelqu’un à votre place ;'
      + ' ces trois étapes sont le moyen le plus rapide. Les numéros restent sur cet appareil.</p>'
      + '<div class="form-grid">'
      + '<div class="form-group"><label>Nom du groupe</label><input id="waNom" value="' + esc(g.nom) + '"></div>'
      + '<div class="form-group"><label>Lien d’invitation du groupe</label><input id="waLien" placeholder="https://chat.whatsapp.com/…" value="'
      + esc(g.lien) + '"></div>'
      + '<div class="form-group" style="grid-column:1/-1;"><label>Message d’invitation ({directeur}, {ecole}, {groupe}, {lien})</label>'
      + '<textarea id="waMessage" rows="3">' + esc(g.message) + '</textarea></div></div>'
      + '<div class="xbar">'
      + '<button class="btn btn-primary" onclick="WhatsApp.enregistrer()">\uE007 Enregistrer</button>'
      + '<button class="btn btn-success" onclick="WhatsApp.vcf()">\uE012 Contacts pour WhatsApp (.vcf)</button>'
      + '<button class="btn btn-info" onclick="WhatsApp.copier()">\uE00F Copier les numéros</button>'
      + '<button class="btn btn-warning" onclick="WhatsApp.suivant()">\uE039 Inviter le suivant</button>'
      + '<button class="btn btn-info" onclick="WhatsApp.partager()">\uE00C Partager le lien</button>'
      + '</div></div>'
      + blocMessages()
      + '<div class="xbar"><select id="waZone" onchange="WhatsApp.tableau()"><option value="">Toutes les zones / arrondissements</option>'
      + zones.map(z => '<option>' + esc(z) + '</option>').join('') + '</select>'
      + '<label class="petit"><input type="checkbox" id="waNonInvites" onchange="WhatsApp.tableau()"> seulement les non invités</label>'
      + '<button class="btn btn-sm btn-danger" onclick="WhatsApp.reinitialiser()">↺ Remettre les envois à zéro</button></div>'
      + '<div class="table-container"><div class="table-scroll"><table><thead><tr><th>WhatsApp</th><th>École</th><th>Directeur</th>'
      + '<th>Numéro</th><th>Invitation</th><th></th></tr></thead><tbody id="waTable"></tbody></table></div></div>';
    tableau();
  }

  function tableau() {
    const t = document.getElementById('waTable');
    if (!t) return;
    t.innerHTML = filtre().map(x => '<tr' + (x.num ? '' : ' style="opacity:.65"') + '>'
      + '<td class="text-center"><input type="checkbox" ' + (x.wa ? 'checked' : '') + (x.num ? '' : ' disabled')
      + ' title="Ce directeur a un compte WhatsApp" onchange="WhatsApp.basculer(\'' + x.e.id + '\', this.checked)"></td>'
      + '<td><b>' + esc(x.e.nom) + '</b><br><span class="petit muet">' + esc(x.zone) + '</span></td>'
      + '<td>' + esc(x.nom || '—') + '</td>'
      + '<td><input style="min-width:150px" value="' + esc(x.num ? lisible(x.num) : x.brut) + '" placeholder="01 XX XX XX XX"'
      + ' onchange="WhatsApp.numero(\'' + x.e.id + '\', this.value)">'
      + (x.brut && !x.num ? '<br><span class="badge badge-danger">numéro invalide</span>' : '') + '</td>'
      + '<td>' + (x.envoye ? '<span class="badge badge-success">envoyée le ' + esc(new Date(x.envoye).toLocaleDateString('fr-FR')) + '</span>' : '—') + '</td>'
      + '<td>' + (x.num && x.wa ? '<button class="btn btn-success btn-sm" onclick="WhatsApp.inviter(\'' + x.e.id + '\')">\uE035</button>' : '') + '</td></tr>').join('')
      || '<tr><td colspan="6" class="text-center">Aucune école</td></tr>';
  }

  function enregistrer(silence) {
    const g = etat();
    const v = id => (document.getElementById(id) || {}).value;
    if (v('waNom') !== undefined) g.nom = v('waNom').trim();
    if (v('waLien') !== undefined) g.lien = v('waLien').trim();
    if (v('waMessage') !== undefined) g.message = v('waMessage');
    App().saveData();
    if (!silence) avis('Groupe enregistré.');
  }
  function avis(t) {
    const d = document.createElement('div'); d.className = 'xtoast on'; d.textContent = t; document.body.append(d);
    setTimeout(() => d.remove(), 3200);
  }

  function basculer(id, oui) { const g = etat(); g.contacts[id] = Object.assign({}, g.contacts[id], { wa: oui }); App().saveData(); rendu(); }
  function numero(id, valeur) {
    const e = App().data.ecoles.find(x => x.id == id);
    if (!e) return;
    const n = normaliser(valeur);
    e.contact_directeur = n ? lisible(n).replace('+229 ', '') : String(valeur || '').trim();
    App().saveData(); rendu();
    if (valeur && !n) avis('Numéro non reconnu : 10 chiffres commençant par 01 (ex. 01 97 00 00 00).');
  }

  function inviter(id) {
    enregistrer(true);
    const g = etat(), x = directeurs().find(y => y.e.id == id);
    if (!x || !x.num) return;
    if (!g.lien && !confirm('Aucun lien d’invitation n’est enregistré. Envoyer quand même le message ?')) return;
    global.open('https://wa.me/' + x.num + '?text=' + encodeURIComponent(message(x)), '_blank', 'noopener');
    g.contacts[id] = Object.assign({}, g.contacts[id], { envoye: new Date().toISOString() });
    App().saveData(); rendu();
  }
  function suivant() {
    const x = filtre().find(y => y.num && y.wa && !y.envoye);
    if (!x) { avis('Tous les directeurs retenus ont reçu l’invitation.'); return; }
    inviter(x.e.id);
  }
  function reinitialiser() {
    if (!confirm('Effacer le suivi des invitations envoyées ?')) return;
    const g = etat();
    Object.keys(g.contacts).forEach(k => { delete g.contacts[k].envoye; });
    App().saveData(); rendu();
  }

  const retenus = () => directeurs().filter(x => x.num && x.wa);
  function vcf() {
    enregistrer(true);
    const l = retenus();
    if (!l.length) { avis('Aucun numéro valide : renseignez les numéros des directeurs.'); return; }
    const echV = s => String(s || '').replace(/([,;\\])/g, '\\$1');
    const txt = l.map(x => ['BEGIN:VCARD', 'VERSION:3.0',
      'FN:' + echV(PREFIXE + ' ' + x.e.nom + (x.nom ? ' — ' + x.nom : '')),
      'N:' + echV(x.e.nom) + ';' + echV(PREFIXE) + ';;;',
      'ORG:' + echV('Circonscription Scolaire de Pobè'), 'TITLE:' + echV('Directeur — ' + x.e.nom),
      'TEL;TYPE=CELL:+' + x.num, 'CATEGORIES:' + echV(etat().nom || 'Directeurs CS Pobè'), 'END:VCARD'].join('\r\n')).join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt + '\r\n'], { type: 'text/vcard' }));
    a.download = 'directeurs-cs-pobe.vcf';
    document.body.append(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
    avis(l.length + ' contact(s) prêts à importer dans le téléphone.');
  }
  function copier() {
    const t = retenus().map(x => '+' + x.num).join('\n');
    if (!t) { avis('Aucun numéro valide.'); return; }
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(() => avis('Numéros copiés.'),
      () => App().openModal('Numéros des directeurs', '<textarea style="width:100%" rows="12">' + esc(t) + '</textarea>'));
  }
  function partager() {
    enregistrer(true);
    const g = etat();
    if (!g.lien) { avis('Collez d’abord le lien d’invitation du groupe.'); return; }
    const texte = 'Rejoignez le groupe WhatsApp « ' + g.nom + ' » : ' + g.lien;
    if (navigator.share) navigator.share({ title: g.nom, text: texte }).catch(() => {});
    else global.open('https://wa.me/?text=' + encodeURIComponent(texte), '_blank', 'noopener');
  }

  global.WhatsApp = { rendu, tableau, enregistrer, basculer, numero, inviter, suivant, reinitialiser, vcf, copier, partager, normaliser,
    lireModele, messageAuGroupe, messageSuivant, MODELES, texteModele };
  global.Extra = global.Extra || { pages: {} };
  global.Extra.pages.whatsapp = rendu;
})(window);
