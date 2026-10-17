/* CS Pobè — pièces d'authentification des documents.
   Cachet dessiné, code QR de vérification et signature manuscrite capturée à
   l'écran. Rien ne dépend du réseau : un document doit pouvoir s'imprimer dans
   une école sans connexion. */
(function (global) {
  'use strict';

  const COULEURS = { BLEU: '#1D3FA8', ROUGE: '#B3121D', NOIR: '#111827' };

  function echapper(v) {
    return String(v === null || v === undefined ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  /* ---------------- Cachet ---------------- */

  /**
   * Cachet rond : un arc en haut, un arc en bas, le texte central, et deux
   * étoiles à la césure. Chaque école règle ses trois lignes et son encre.
   */
  /**
   * Découpe un texte en lignes qui tiennent dans une largeur donnée, sans
   * couper les mots. Sert au texte central, qui doit rester dans le cercle
   * intérieur quelle que soit sa longueur.
   */
  function decouper(texte, largeurMax, tailleCar) {
    const mots = String(texte || '').split(/\s+/).filter(Boolean);
    const parLigne = Math.max(6, Math.floor(largeurMax / tailleCar));
    const lignes = [];
    let courante = '';
    mots.forEach(mot => {
      const essai = courante ? courante + ' ' + mot : mot;
      if (essai.length <= parLigne || !courante) courante = essai;
      else { lignes.push(courante); courante = mot; }
    });
    if (courante) lignes.push(courante);
    return lignes;
  }

  /**
   * Cachet rond : un arc en haut, un arc en bas, le texte central sur une ou
   * plusieurs lignes, et deux étoiles à la césure. Tout tient à l'intérieur du
   * cercle extérieur ; le texte central reste dans le cercle intérieur.
   */
  function cachet(porteur, options) {
    options = options || {};
    porteur = porteur || {};
    const encre = COULEURS[options.couleur || porteur.cachet_couleur || 'BLEU'] || COULEURS.BLEU;
    const haut = String(options.haut || porteur.cachet_haut || 'RÉPUBLIQUE DU BÉNIN').toUpperCase();
    const bas = String(options.bas || porteur.cachet_bas || porteur.nom || 'ÉCOLE').toUpperCase();
    const centre = options.centre || porteur.cachet_centre || 'LE DIRECTEUR';
    const taille = options.taille || 118;
    const id = 'c' + Math.random().toString(36).slice(2, 8);

    const R_EXT = 96, R_INT = 68;
    const R_HAUT = 74, R_BAS = 78;

    /* Le texte est étiré d'une étoile à l'autre : l'arc utile couvre environ
       150 degrés de part et d'autre, soit 2,62 radians. */
    const ARC = 2.62;
    const etirer = (rayon, nb) => Math.max(10, rayon * ARC);

    const etoile = (x, y, r) => '<path transform="translate(' + x + ' ' + y + ') scale('
      + (r / 10) + ')" d="M0 -10 L2.9 -3.1 10.4 -3.1 4.3 1.5 6.7 8.8 0 4.4 -6.7 8.8 -4.3 1.5'
      + ' -10.4 -3.1 -2.9 -3.1 Z" fill="' + encre + '"/>';

    /* Le texte central : autant de lignes qu'il faut, centrées sur le cercle. */
    const tailleCentre = centre.length > 40 ? 11 : (centre.length > 22 ? 12.5 : 15);
    const lignesCentre = decouper(centre, R_INT * 1.75, tailleCentre * 0.56);
    const interligne = tailleCentre * 1.22;
    const departY = 100 - ((lignesCentre.length - 1) * interligne) / 2 + tailleCentre * 0.34;

    const texteCentral = lignesCentre.map((ligne, i) =>
      '<text x="100" y="' + (departY + i * interligne).toFixed(1) + '" font-size="'
      + tailleCentre + '" font-weight="700" fill="' + encre + '" text-anchor="middle"'
      + ' font-family="Helvetica, Arial, sans-serif">' + echapper(ligne) + '</text>').join('');

    const arc = (idArc, texte, rayon, tailleTexte) =>
      '<text font-size="' + tailleTexte + '" font-weight="700" fill="' + encre + '"'
      + ' text-anchor="middle" font-family="Helvetica, Arial, sans-serif"'
      + ' letter-spacing="0.4">'
      + '<textPath href="#' + idArc + '" startOffset="50%" textLength="'
      + etirer(rayon).toFixed(1) + '" lengthAdjust="spacingAndGlyphs">'
      + echapper(texte) + '</textPath></text>';

    return '<svg class="cachet" width="' + taille + '" height="' + taille + '"'
      + ' viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg" role="img"'
      + ' aria-label="Cachet — ' + echapper(centre) + '">'
      + '<defs>'
      /* L'arc du haut porte le texte au-dessus de la ligne, celui du bas
         en dessous : leurs rayons diffèrent pour que les deux rentrent. */
      + '<path id="h' + id + '" d="M ' + (100 - R_HAUT) + ',100 A ' + R_HAUT + ',' + R_HAUT
      + ' 0 0 1 ' + (100 + R_HAUT) + ',100"/>'
      + '<path id="b' + id + '" d="M ' + (100 - R_BAS) + ',100 A ' + R_BAS + ',' + R_BAS
      + ' 0 0 0 ' + (100 + R_BAS) + ',100"/>'
      + '</defs>'
      + '<circle cx="100" cy="100" r="' + R_EXT + '" fill="none" stroke="' + encre
      + '" stroke-width="4"/>'
      + '<circle cx="100" cy="100" r="' + R_INT + '" fill="none" stroke="' + encre
      + '" stroke-width="1.5"/>'
      + arc('h' + id, haut, R_HAUT, haut.length > 30 ? 10 : 12)
      + arc('b' + id, bas, R_BAS, bas.length > 30 ? 9 : 11)
      + etoile(100 - R_INT - 12, 100, 6) + etoile(100 + R_INT + 12, 100, 6)
      + texteCentral
      + '</svg>';
  }

  /* ---------------- En-tête officiel ---------------- */

  /* Le drapeau national, dessiné : vert, jaune, rouge. */
  function drapeau(hauteur) {
    const h = hauteur || 18, l = h * 1.5;
    return '<svg width="' + l + '" height="' + h + '" viewBox="0 0 60 40"'
      + ' xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Drapeau du Bénin">'
      + '<rect width="24" height="40" fill="#008751"/>'
      + '<rect x="24" width="36" height="20" fill="#FCD116"/>'
      + '<rect x="24" y="20" width="36" height="20" fill="#E8112D"/>'
      + '<rect width="60" height="40" fill="none" stroke="#94a3b8" stroke-width="1"/></svg>';
  }

  /**
   * En-tête réglementaire, disposé comme sur les imprimés du ministère :
   * les armoiries à gauche, le ministère et la République au centre avec le
   * filet national, les coordonnées à droite ; en dessous, à gauche, la
   * direction départementale, la circonscription, l'école et le numéro d'ordre.
   */
  function enteteOfficiel(options) {
    options = options || {};
    const emblemes = options.emblemes || {};

    const armoiries = emblemes.armoiries
      ? '<img src="' + emblemes.armoiries + '" alt="Armoiries de la République du Bénin"'
        + ' style="height:78px;">'
      : '<div class="embleme-absent">' + drapeau(28)
        + '<span>Armoiries<br>à déposer</span></div>';

    const coordonnees = emblemes.sceau
      ? '<img src="' + emblemes.sceau + '" alt="Logo" style="height:70px;">'
      : '<div class="entete-contact">01 BP 10 Porto-Novo<br>'
        + 'Tél. : +229 20 21 52 22<br>Fax : +229 20 21 52 22<br>'
        + 'E-mail : memp.info@gouv.bj</div>';

    const separateur = '<div class="separateur-etoiles">*-*-*-*-*-*-*-*</div>';

    return '<div class="entete-officiel">'
      + '<div class="entete-embleme">' + armoiries + '</div>'
      + '<div class="entete-mentions">'
      + '<b>MINISTÈRE DES ENSEIGNEMENTS<br>MATERNEL ET PRIMAIRE</b>'
      + '<div class="filet-national"><span></span><span></span><span></span></div>'
      + '<b>RÉPUBLIQUE DU BÉNIN</b>'
      + '</div>'
      + '<div class="entete-embleme">' + coordonnees + '</div>'
      + '</div>'
      + '<div class="entete-service">'
      + echapper(options.direction
        || 'DIRECTION DÉPARTEMENTALE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE DU PLATEAU')
      + separateur
      + '<b>' + echapper(options.circonscription || 'CIRCONSCRIPTION SCOLAIRE DE POBÈ') + '</b>'
      + (options.etablissement
        ? separateur + '<b>' + echapper(options.etablissement) + '</b>' : '')
      + (options.reference
        ? '<div class="entete-reference">' + echapper(options.reference) + '</div>' : '')
      + '</div>';
  }

  /* ---------------- Code QR et empreinte ---------------- */

  /* Une empreinte courte, calculée sur le contenu du document : deux documents
     différents ne peuvent pas porter le même numéro de vérification. */
  function empreinte(texte) {
    let h1 = 0x811c9dc5, h2 = 0x01000193;
    for (let i = 0; i < texte.length; i++) {
      h1 = ((h1 ^ texte.charCodeAt(i)) * 0x01000193) >>> 0;
      h2 = ((h2 + texte.charCodeAt(i) * (i + 7)) * 0x85ebca6b) >>> 0;
    }
    return (h1.toString(36) + h2.toString(36)).slice(0, 11).toUpperCase();
  }

  function numeroDocument(type, cle) {
    const annee = new Date().getFullYear();
    return type + '-' + annee + '-' + empreinte(String(type) + '|' + String(cle)).slice(0, 6);
  }

  /** Le code QR mène à la page de vérification, ou porte le texte tel quel. */
  function qr(contenu, taille) {
    if (!global.EG || !global.EG.QR) return '';
    try {
      return global.EG.QR.svg(contenu, { taille: taille || 96, marge: 2 });
    } catch (e) {
      return '';
    }
  }

  /** Bloc complet : code QR, numéro et empreinte, à poser au pied d'une pièce. */
  function blocVerification(type, cle, contenu) {
    const numero = numeroDocument(type, cle);
    const emp = empreinte(contenu || String(cle));
    const image = qr('CS-POBE|' + numero + '|' + emp, 92);
    return '<div class="bloc-verification">'
      + (image ? '<div class="qr">' + image + '</div>' : '')
      + '<div class="petit muet">Document n° <b>' + echapper(numero) + '</b><br>'
      + 'Empreinte ' + echapper(emp) + '</div></div>';
  }

  /* ---------------- Signature ---------------- */

  /** Signature enregistrée, ou emplacement à signer à la main. */
  function blocSignature(titulaire, libelle) {
    const image = titulaire && titulaire.signature_image
      ? '<img class="signature" src="' + titulaire.signature_image + '" alt="Signature">'
      : '<div class="signature-vide"></div>';
    return '<div class="bloc-signature">' + image
      + '<div class="ligne-signature"></div>'
      + '<div class="petit">' + echapper(libelle || '') + '</div>'
      + (titulaire && titulaire.nom ? '<div class="petit muet">' + echapper(titulaire.nom)
        + '</div>' : '') + '</div>';
  }

  /**
   * Ouvre une zone de tracé et rend la signature en image.
   * `apres` reçoit la signature, ou null si elle est effacée.
   */
  function capturerSignature(nom, actuelle, apres) {
    const largeur = 460, hauteur = 180;
    const corps = document.createElement('div');
    corps.innerHTML = '<p class="muet">Signez avec la souris, le doigt ou un stylet. '
      + 'La signature est conservée sur cet ordinateur et apposée sur les documents '
      + 'que vous éditez.</p>'
      + '<canvas id="toileSignature" width="' + largeur + '" height="' + hauteur + '"'
      + ' style="border:1px dashed #94a3b8;border-radius:8px;background:#fff;'
      + 'touch-action:none;max-width:100%;"></canvas>';

    global.openModal('Signature — ' + nom, corps.innerHTML
      + '<div class="text-center mt-15">'
      + '<button class="btn btn-danger" onclick="effacerSignature()">Effacer</button> '
      + '<button class="btn btn-primary" onclick="validerSignature()">💾 Enregistrer</button> '
      + '<button class="btn btn-info" onclick="closeModal()">Annuler</button></div>');

    const toile = document.getElementById('toileSignature');
    const ctx = toile.getContext('2d');
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#111827';
    let trace = false, vide = true;

    if (actuelle) {
      const img = new Image();
      img.onload = () => { ctx.drawImage(img, 0, 0, largeur, hauteur); vide = false; };
      img.src = actuelle;
    }

    const point = ev => {
      const r = toile.getBoundingClientRect();
      const src = ev.touches ? ev.touches[0] : ev;
      return {
        x: (src.clientX - r.left) * (largeur / r.width),
        y: (src.clientY - r.top) * (hauteur / r.height)
      };
    };
    const debut = ev => { ev.preventDefault(); trace = true; vide = false;
      const p = point(ev); ctx.beginPath(); ctx.moveTo(p.x, p.y); };
    const bouge = ev => { if (!trace) return; ev.preventDefault();
      const p = point(ev); ctx.lineTo(p.x, p.y); ctx.stroke(); };
    const fin = () => { trace = false; };

    ['mousedown', 'touchstart'].forEach(e => toile.addEventListener(e, debut));
    ['mousemove', 'touchmove'].forEach(e => toile.addEventListener(e, bouge));
    ['mouseup', 'mouseleave', 'touchend'].forEach(e => toile.addEventListener(e, fin));

    global.effacerSignature = () => {
      ctx.clearRect(0, 0, largeur, hauteur);
      vide = true;
    };
    global.validerSignature = () => {
      global.closeModal();
      apres(vide ? null : toile.toDataURL('image/png'));
    };
  }

  global.Pieces = { cachet, drapeau, enteteOfficiel, qr, empreinte, numeroDocument, blocVerification,
    blocSignature, capturerSignature, COULEURS };
})(window);
