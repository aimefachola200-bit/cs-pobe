/* République du Bénin — MEMP — CS Pobè
   Fiche d'inscription au CEP et cartes scolaires, au format de SCOLARIS et GESCOL (module m_cep) :
   - fiche A4 : emblème du MEMP (armoiries + ministère + République) en en-tête, cadre titre vert,
     sections « ÉCOLE DE PROVENANCE » et « CANDIDAT (E) », photo, « TRÈS IMPORTANT », agent de la DDEMP,
     cachet rond, signatures digitales du parent, du candidat et du directeur ;
   - carte au format carte bancaire (85,6 × 54 mm), bordure aux couleurs du drapeau, armoiries et drapeau,
     recto (photo, identité, informations administratives, signature de l'élève, QR, cachet, directeur)
     et verso (école, consignes, contact d'urgence) ; planche A4 de 10 cartes recto-verso.
   Tout est dessiné en SVG : l'impression (ou « Enregistrer en PDF ») donne le même rendu sur PC,
   tablette et téléphone, sans réseau. Conception : Maître Aimé FACHOLA */
(function (global) {
  'use strict';

  const VERT_F = '#194730', OR_F = '#A3780D', OR_CLAIR = '#C9962B', BORD = '#BAC4BA', TEXTE = '#1C1A14',
    GRIS_T = '#6B6553', FOND_AGENT = '#FAF5ED', DRAP_VERT = '#008751', DRAP_JAUNE = '#FCD116', DRAP_ROUGE = '#E8112D';
  const TIMES = "'Times New Roman', Times, 'Liberation Serif', serif";
  const HELV = 'Helvetica, Arial, \'Liberation Sans\', sans-serif';
  const PT = 0.35278; // 1 pt en mm

  const NOTES_IMPORTANT = [
    "Les Directeurs d'écoles doivent remplir les fiches d'inscription conformément aux informations telles "
    + "qu'inscrites sur les actes de naissance. Ils doivent collationner les différentes listes envoyées par la DDEMP "
    + "afin que la liste d'inscription porte la bonne graphie des noms et prénoms, date et lieu de naissance, sexe et "
    + 'école de provenance des candidats.',
    "Les Directeurs doivent s'assurer que sur les listes d'inscription, le nom de leur école est exclusivement porté "
    + 'devant chacun de leurs candidats afin de garantir la fiabilité des statistiques des résultats par école.',
    "Les Directeurs doivent associer les parents d'élèves aux choix des établissements d'accueil de l'enseignement "
    + 'secondaire en cas de succès.'
  ];

  const esc = v => String(v === null || v === undefined ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const n2 = v => (Math.round(v * 1000) / 1000).toString();

  /* ---------------- mesure du texte (même police que le rendu) ---------------- */
  let ctx = null;
  function largeur(texte, famille, taille, gras, italique) {
    try {
      if (!ctx) ctx = document.createElement('canvas').getContext('2d');
      ctx.font = (italique ? 'italic ' : '') + (gras ? 'bold ' : '') + '100px ' + famille;
      return ctx.measureText(String(texte)).width * taille / 100;
    } catch (e) {
      return String(texte).length * taille * 0.52;
    }
  }

  /** <text> ; le texte trop long est resserré (taille réduite jusqu'à `mini`, puis compressé). */
  function texte(x, y, contenu, o) {
    o = o || {};
    const fam = o.famille || TIMES;
    let t = o.taille || 9;
    const s = String(contenu === null || contenu === undefined ? '' : contenu);
    if (!s) return '';
    let compresse = false;
    if (o.max) {
      const mini = o.mini || t * 0.6;
      while (t > mini && largeur(s, fam, t, o.gras, o.italique) > o.max) t -= t * 0.03;
      compresse = largeur(s, fam, t, o.gras, o.italique) > o.max;
    }
    const ancre = o.ancre === 'c' ? 'middle' : (o.ancre === 'd' ? 'end' : 'start');
    /* style en ligne : il l'emporte sur les règles CSS de la page (une simple propriété SVG serait écrasée) */
    return '<text x="' + n2(x) + '" y="' + n2(y) + '" style="font-family:' + fam.replace(/"/g, "'") + ';font-size:' + n2(t) + 'px;'
      + 'font-weight:' + (o.gras ? 'bold' : 'normal') + ';font-style:' + (o.italique ? 'italic' : 'normal') + ';letter-spacing:' + (o.espace || 0) + '"'
      + ' fill="' + (o.couleur || TEXTE) + '" text-anchor="' + ancre + '"'
      + (compresse ? ' textLength="' + n2(o.max) + '" lengthAdjust="spacingAndGlyphs"' : '') + '>' + esc(s) + '</text>';
  }
  const rect = (x, y, w, h, o) => '<rect x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(w) + '" height="' + n2(h) + '"'
    + (o.r ? ' rx="' + n2(o.r) + '"' : '') + ' fill="' + (o.fond || 'none') + '"'
    + (o.trait ? ' stroke="' + o.trait + '" stroke-width="' + n2(o.ep || 0.6) + '"' : '') + '/>';
  const ligne = (x1, y1, x2, y2, coul, ep, tirets) => '<line x1="' + n2(x1) + '" y1="' + n2(y1) + '" x2="' + n2(x2)
    + '" y2="' + n2(y2) + '" stroke="' + coul + '" stroke-width="' + n2(ep) + '"' + (tirets ? ' stroke-dasharray="' + tirets + '"' : '') + '/>';
  const image = (src, x, y, w, h, aligne) => src ? '<image href="' + esc(src) + '" xlink:href="' + esc(src) + '" x="' + n2(x) + '" y="' + n2(y) + '" width="'
    + n2(w) + '" height="' + n2(h) + '" preserveAspectRatio="' + (aligne || 'xMidYMid') + ' meet"/>' : '';
  /** Un SVG (cachet, QR) imbriqué à la position voulue. */
  function imbriquer(svg, x, y, w, h) {
    if (!svg) return '';
    return String(svg).replace(/^<svg\b([^>]*?)\swidth="[^"]*"\s+height="[^"]*"/, '<svg$1')
      .replace(/^<svg\b/, '<svg x="' + n2(x) + '" y="' + n2(y) + '" width="' + n2(w) + '" height="' + n2(h) + '"');
  }
  function decouper(s, fam, taille, max, gras, italique) {
    const lignes = []; let cour = '';
    String(s || '').split(/\s+/).filter(Boolean).forEach(mot => {
      const essai = cour ? cour + ' ' + mot : mot;
      if (!cour || largeur(essai, fam, taille, gras, italique) <= max) cour = essai;
      else { lignes.push(cour); cour = mot; }
    });
    if (cour) lignes.push(cour);
    return lignes;
  }
  function drapeau(x, y, w, h, ep) {
    return rect(x, y, w * 0.4, h, { fond: DRAP_VERT }) + rect(x + w * 0.4, y, w * 0.6, h / 2, { fond: DRAP_JAUNE })
      + rect(x + w * 0.4, y + h / 2, w * 0.6, h / 2, { fond: DRAP_ROUGE }) + rect(x, y, w, h, { trait: '#98A2B3', ep: ep || 0.2 });
  }
  /** Emblème du MEMP : bandeau officiel (armoiries + ministère + République) ou, à défaut, armoiries + mentions. */
  function blocMemp(x, y, h, emb) {
    if (emb.bandeau) return image(emb.bandeau, x, y, h * 573 / 210, h, 'xMinYMid');
    let s = image(emb.armoiries, x, y, h * 171 / 210, h, 'xMinYMid');
    const tx = x + h * 171 / 210 + 4;
    ['MINISTÈRE DES ENSEIGNEMENTS', 'MATERNEL ET PRIMAIRE', '', 'RÉPUBLIQUE DU BÉNIN'].forEach((t, i) => {
      s += texte(tx, y + (i + 1) * h / 4.6, t, { famille: HELV, taille: h / 6.5 });
    });
    return s;
  }

  /* =============== 1. FICHE D'INSCRIPTION AU CEP (A4, mesures en points depuis le haut) =============== */
  function ficheCEP(d) {
    const emb = d.emblemes || {};
    let s = '';
    const lab = (x, y, t, taille, coul, gras, italique) => {
      const fam = TIMES; taille = taille || 7.6;
      gras = gras === undefined ? true : gras;
      s += texte(x, y, t, { taille, couleur: coul || VERT_F, gras, italique, famille: fam });
      return x + largeur(t, fam, taille, gras, italique);
    };
    const champ = (x1, x2, y, valeur, taille, gras) => {
      s += ligne(x1, y + 1.8, x2, y + 1.8, BORD, 0.6, '1 1.2');
      if (valeur) s += texte(x1 + 2, y, valeur, { taille: taille || 9, gras, max: x2 - x1 - 4, mini: 5 });
    };
    const caseC = (x, y, coche, libelle) => {
      s += rect(x, y - 6, 7, 7, { trait: TEXTE, ep: 0.6 });
      if (coche) s += texte(x + 3.5, y - 0.2, 'X', { famille: HELV, taille: 7, gras: true, ancre: 'c' });
      s += texte(x + 10, y, libelle, { taille: 8.5, gras: !!coche });
    };
    const section = (y1, y2, titre) => {
      s += rect(28, y1 + 15, 523, y2 - y1 - 15, { trait: BORD, ep: 0.7 });
      s += rect(28, y1, 523, 15, { fond: VERT_F, r: 2.5 });
      s += texte(39, y1 + 10.5, titre, { taille: 8.3, gras: true, couleur: '#fff' });
    };

    // en-tête : emblème du MEMP + coordonnées du ministère
    s += blocMemp(30, 2, 52, emb);
    [['01 BP 10 Porto-Novo', 10], ['Tél : +229 20 21 52 22  •  Fax : +229 20 21 52 22', 20],
      ['E-mail : mempmatprim@gmail.com', 29]].forEach(([t, y]) => {
      s += texte(552, y, t, { famille: HELV, taille: 6.4, couleur: GRIS_T, ancre: 'd' });
    });
    s += ligne(27, 55, 552, 55, OR_CLAIR, 1.4);
    // direction départementale + cadre titre
    s += texte(157, 80, 'Direction Départementale des Enseignements', { taille: 8.3, gras: true, ancre: 'c' });
    s += texte(157, 91, 'Maternel et Primaire : ' + (d.ddemp || ''), { taille: 8.3, gras: true, ancre: 'c', max: 250 });
    s += texte(157, 107, 'Service des Examens et Concours', { taille: 8.3, ancre: 'c' });
    s += rect(287, 67, 264, 54, { fond: VERT_F, r: 5 });
    s += texte(419, 84, "FICHE D'INSCRIPTION À L'EXAMEN DU", { taille: 11.5, gras: true, couleur: '#fff', ancre: 'c' });
    s += texte(419, 97, "CERTIFICAT D'ÉTUDES PRIMAIRES (CEP)", { taille: 11.5, gras: true, couleur: '#fff', ancre: 'c' });
    const opt = 'OPTION : CEP + entrée en 6è';
    s += texte(419, 108, opt, { taille: 6.8, couleur: OR_CLAIR, ancre: 'c' });
    if (/^cep$|cep seul/i.test(String(d.option || '').trim())) { // « rayer la mention inutile »
      const w = largeur(opt, TIMES, 6.8), xp = 419 - w / 2 + largeur('OPTION : CEP ', TIMES, 6.8);
      s += ligne(xp, 105.8, 419 + w / 2, 105.8, '#fff', 0.8);
    }
    s += texte(419, 116, '(Rayer la mention inutile)', { taille: 5, italique: true, couleur: '#E3E8E3', ancre: 'c' });
    lab(178, 139, 'SESSION DE :', 8.3, TEXTE);
    champ(244, 363, 139, d.session, 8.5, true);
    lab(178, 153, 'CENTRE DE :', 8.3, TEXTE);
    champ(244, 385, 153, d.centre, 8.5, true);

    // école de provenance
    section(168, 286, 'ÉCOLE DE PROVENANCE');
    let x = lab(36, 201, 'COMMUNE DE :'); champ(x + 4, 270, 201, d.commune);
    x = lab(284, 201, 'CIRCONSCRIPTION SCOLAIRE DE :'); champ(x + 4, 543, 201, d.cs);
    x = lab(36, 219, "NOM DE L'ÉCOLE :"); champ(x + 4, 543, 219, d.ecole);
    lab(36, 237, "STATUT DE L'ÉCOLE :");
    const statut = String(d.statut || '').toLowerCase();
    caseC(134, 237, statut.indexOf('pub') === 0, 'Publique');
    caseC(195, 237, statut.indexOf('priv') === 0, 'Privée');
    x = lab(36, 255, 'NOM ET PRÉNOM DU DIRECTEUR OU DE LA DIRECTRICE :'); champ(x + 4, 543, 255, d.directeur);
    x = lab(36, 273, 'CONTACT TÉLÉPHONIQUE DU DIRECTEUR OU DE LA DIRECTRICE :'); champ(x + 4, 543, 273, d.directeur_tel);

    // candidat
    section(293, 592, 'CANDIDAT (E)');
    s += rect(468, 318, 76, 85, { fond: '#EDF5ED', trait: VERT_F, ep: 0.9, r: 4 });
    s += image(d.photo, 470, 320, 72, 81);
    s += texte(506, 411, 'Photo du candidat', { taille: 5.2, italique: true, couleur: GRIS_T, ancre: 'c' });
    x = lab(36, 328, 'NOM :'); champ(x + 4, 457, 328, String(d.nom || '').toUpperCase(), 9.5, true);
    lab(38, 338.5, '(À écrire en lettres capitales)', 5, GRIS_T, false, true);
    x = lab(36, 350, 'PRÉNOMS :'); champ(x + 4, 457, 350, d.prenoms, 9.5);
    lab(38, 359.5, "(Écrire tous les prénoms sans abréviation suivant l'ordre et l'orthographe de la pièce d'état civil)", 5, GRIS_T, false, true);
    x = lab(36, 371, 'SEXE :'); champ(x + 4, 197, 371, d.sexe);
    x = lab(210, 371, 'DATE ET LIEU DE NAISSANCE :'); champ(x + 4, 457, 371, d.naissance);
    x = lab(36, 390, 'NUMÉRO EDUCMASTER :'); champ(x + 4, 457, 390, d.educmaster);
    x = lab(36, 408, 'ÉTABLISSEMENTS CHOISIS');
    lab(x + 8, 408, '(trois établissements par ordre de préférence, sans abréviation)', 5.4, GRIS_T, false, true);
    for (let i = 0; i < 3; i++) {
      const y = 422 + 15.5 * i;
      lab(36, y, (i + 1) + ' -', 7.6, TEXTE);
      champ(56, 457, y, (d.etab || [])[i]);
    }
    x = lab(36, 475, 'RÉSIDENCE DES PARENTS :'); champ(x + 4, 543, 475, d.residence);
    lab(36, 493, "DISPENSE D'ÂGE :");
    caseC(118, 493, d.dispense_age, 'Oui'); caseC(157, 493, !d.dispense_age, 'Non');
    lab(215, 493, 'DISPENSE DE SPORT :');
    caseC(312, 493, d.dispense_sport, 'Oui'); caseC(351, 493, !d.dispense_sport, 'Non');
    lab(36, 509, 'Je certifie exacts les renseignements ci-dessus.', 7.8, TEXTE, false, true);
    lab(154, 525, 'Fait à', 7.8, TEXTE, false); champ(185, 298, 525, d.fait_a);
    lab(311, 525, 'le', 7.8, TEXTE, false); champ(325, 430, 525, d.fait_le);
    x = lab(36, 542, 'NOM, PRÉNOM ET SIGNATURE DU PARENT :');
    champ(x + 4, 543, 542, d.parent_nom);
    s += image(d.sig_parent, 452, 527, 88, 19, 'xMaxYMid');
    x = lab(36, 561, 'CONTACT TÉLÉPHONIQUE DU PARENT :'); champ(x + 4, 543, 561, d.parent_contact);
    lab(38, 571.5, '(Préciser le degré de parenté)', 5, GRIS_T, false, true);
    x = lab(36, 582, 'SIGNATURE DU (DE LA) CANDIDAT (E) :'); champ(x + 4, 543, 582, '');
    s += image(d.sig_candidat, x + 30, 567, 70, 17, 'xMinYMid');

    // très important
    s += texte(28, 605, 'TRÈS IMPORTANT :', { taille: 8.3, gras: true });
    s += ligne(28, 606.5, 28 + largeur('TRÈS IMPORTANT :', TIMES, 8.3, true), 606.5, TEXTE, 0.5);
    let y = 610;
    NOTES_IMPORTANT.forEach((note, i) => {
      const lignes = decouper((i + 1) + '. ' + note, TIMES, 6.4, 517);
      lignes.forEach((l, j) => { s += texte(j ? 36 : 28, y + 6.4 + j * 7.3, l, { taille: 6.4 }); });
      y += lignes.length * 7.3 + 0.5;
    });
    const yc = Math.max(668, y + 10);
    lab(375, yc, 'Certifié à', 8, TEXTE, false); champ(413, 470, yc, d.certifie_a, 8);
    lab(470, yc, ', le', 8, TEXTE, false); champ(486, 551, yc, d.certifie_le, 8);
    // agent de la DDEMP (rempli par la DDEMP)
    s += rect(28, 709, 280, 60, { fond: FOND_AGENT, trait: '#DED6BF', ep: 0.7 });
    s += rect(28, 694, 280, 16, { fond: OR_F, r: 3 });
    s += texte(39, 705, 'AGENT DE LA DDEMP', { taille: 8.3, gras: true, couleur: '#fff' });
    ['DOSSIER ÉTUDIÉ PAR :', 'CODE :', 'COLLATIONNÉ PAR :'].forEach((t, i) => {
      const yy = 726 + 18 * i; const xx = lab(36, yy, t, 7); champ(xx + 4, 300, yy);
    });
    // le directeur : titre, cachet rond, signature digitale, nom
    s += texte(358, 714, d.titre_directeur || 'LE DIRECTEUR', { taille: 8.3, gras: true, ancre: 'c' });
    s += texte(358, 735, '(Nom, prénom, signature et', { taille: 5.5, italique: true, couleur: GRIS_T, ancre: 'c' });
    s += texte(358, 743, 'cachet du Directeur)', { taille: 5.5, italique: true, couleur: GRIS_T, ancre: 'c' });
    if (d.cachet) s += '<g opacity="0.92">' + imbriquer(d.cachet(58), 411, 699, 58, 58) + '</g>';
    s += image(d.sig_directeur, 418, 708, 110, 40);
    s += ligne(397, 750, 551, 750, BORD, 0.6);
    s += texte(474, 760, d.directeur_nom, { taille: 8.3, gras: true, ancre: 'c', max: 150 });
    if (d.qr) {
      s += imbriquer(d.qr, 488, 772, 52, 52);
      s += texte(486, 786, 'Fiche vérifiable', { famille: HELV, taille: 5.6, gras: true, couleur: VERT_F, ancre: 'd' });
      if (d.numero) s += texte(486, 794, 'N° ' + d.numero, { famille: HELV, taille: 5.2, couleur: GRIS_T, ancre: 'd' });
    }
    s += texte(297.6, 828, 'Conception : Maître Aimé FACHOLA', { famille: HELV, taille: 5, italique: true, couleur: '#BFC4CC', ancre: 'c' });

    return '<svg class="feuille-a4" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 595.28 841.89"'
      + ' role="img" aria-label="Fiche d\'inscription au CEP">' + rect(0, 0, 595.28, 841.89, { fond: '#fff' }) + s + '</svg>';
  }

  /* =============== 2. CARTE SCOLAIRE (85,6 × 54 mm, mesures en mm depuis le haut) =============== */
  const CW = 85.6, CH = 54;

  function bordure(id) {
    const e = 1.3;
    return '<defs><clipPath id="' + id + '"><rect width="' + CW + '" height="' + CH + '" rx="2.5"/></clipPath></defs>'
      + '<g clip-path="url(#' + id + ')">'
      + [DRAP_VERT, DRAP_JAUNE, DRAP_ROUGE].map((c, i) => rect(i * CW / 3, 0, CW / 3 + 0.2, CH, { fond: c })).join('')
      + '</g>' + rect(e, e, CW - 2 * e, CH - 2 * e, { fond: '#fff', r: 1.6 });
  }
  const tp = (x, y, t, pt, o) => texte(x, y, t, Object.assign({ famille: HELV, taille: pt * PT }, o || {},
    o && o.max ? { mini: (o.miniPt || pt * 0.62) * PT } : {}));

  function carteRecto(k) {
    const id = 'b' + Math.random().toString(36).slice(2, 8);
    let s = bordure(id);
    const emb = k.emblemes || {};
    s += image(emb.armoiries, 8.6 - 4.6, 2.6, 9.2, 11);
    s += drapeau(CW - 14.2, 4.2, 10.2, 6.8);
    s += tp(CW / 2, 4.4, 'RÉPUBLIQUE DU BÉNIN', 4.6, { ancre: 'c' });
    s += tp(CW / 2, 6.6, 'MINISTÈRE DES ENSEIGNEMENTS MATERNEL ET PRIMAIRE', 4.9, { ancre: 'c', gras: true });
    s += tp(CW / 2, 9.8, k.titre || 'CARTE SCOLAIRE DU CANDIDAT(E)', 7.6, { ancre: 'c', gras: true, couleur: VERT_F, max: 52 });
    s += rect(CW / 2 - 15, 10.9, 30, 3.2, { fond: VERT_F, r: 1.6 });
    s += tp(CW / 2, 13.1, 'ANNÉE SCOLAIRE  ' + (k.annee || ''), 4.8, { ancre: 'c', gras: true, couleur: '#fff' });
    s += ligne(3, 15.4, CW - 3, 15.4, OR_CLAIR, 0.18);
    // photo
    s += rect(3.4, 20.8, 14.6, 18.6, { fond: '#EDF1EE', trait: VERT_F, ep: 0.21, r: 1 });
    if (k.photo) s += image(k.photo, 3.8, 21.2, 13.8, 17.8);
    else s += tp(3.4 + 7.3, 30.6, 'Photo élève', 4.5, { ancre: 'c', couleur: '#98A2B3' });
    // identité
    let yy = 18;
    (k.champs || []).slice(0, 10).forEach(([lib, val]) => {
      s += tp(20.2, yy, lib, 3.9, { gras: true, couleur: VERT_F, max: 14.8 });
      s += tp(35.2, yy, ':', 3.9, { gras: true, couleur: VERT_F });
      s += tp(36.3, yy, val || '', 5, { gras: true, couleur: '#111827', max: 21.8, miniPt: 3.2 });
      s += ligne(20.2, yy + 0.7, 58.3, yy + 0.7, '#E4E7EC', 0.07);
      yy += 2.28;
    });
    // informations administratives
    const bx = 59.6, by = 16.8, bw = 22.8, bh = 24.6;
    s += rect(bx, by, bw, bh, { fond: '#fff', trait: VERT_F, ep: 0.18, r: 1.2 });
    s += rect(bx + 0.8, by + 0.8, bw - 1.6, 3.8, { fond: VERT_F, r: 0.8 });
    s += tp(bx + bw / 2, by + 2.5, 'INFORMATIONS', 3.5, { ancre: 'c', gras: true, couleur: '#fff' });
    s += tp(bx + bw / 2, by + 3.9, 'ADMINISTRATIVES', 3.5, { ancre: 'c', gras: true, couleur: '#fff' });
    yy = by + 7;
    (k.admin || []).slice(0, 4).forEach(([lib, val]) => {
      s += tp(bx + 1.5, yy, lib, 3.7, { gras: true, couleur: OR_F });
      s += tp(bx + 1.5, yy + 1.9, ': ' + (val || ''), 4.4, { gras: true, couleur: '#111827', max: bw - 2.5, miniPt: 3 });
      yy += 4.4;
    });
    // pied : signature de l'élève, QR, cachet, directeur
    s += ligne(3, 41.9, CW - 3, 41.9, '#D0D5DD', 0.1);
    s += tp(19, 43.4, "Signature de l'élève", 3.8, { ancre: 'c', gras: true, couleur: '#344054' });
    s += image(k.sig_eleve, 12, 43.7, 14, 3.4);
    s += ligne(11.6, 47.2, 26.4, 47.2, '#D0D5DD', 0.1);
    if (k.qr) s += imbriquer(k.qr, 2.6, 43.8, 8.4, 8.4);
    s += tp(11.8, 49.6, 'Carte sécurisée', 3.4, { gras: true, couleur: VERT_F });
    if (k.code) s += tp(11.8, 50.9, 'Code : ' + k.code, 2.8, { couleur: '#344054', max: 18 });
    if (k.cachet) s += '<g opacity="0.92">' + imbriquer(k.cachet(11.6), 44 - 5.8, 47.6 - 5.8, 11.6, 11.6) + '</g>';
    s += tp(69, 43.4, k.dir_titre || 'Le Directeur', 3.9, { ancre: 'c', gras: true, couleur: '#344054' });
    s += image(k.sig_dir, 60, 43.9, 18, 4);
    s += ligne(59, 48, 79, 48, '#D0D5DD', 0.1);
    s += tp(69, 50.1, k.dir_nom || '', 4.3, { ancre: 'c', gras: true, couleur: '#111827', max: 24 });
    s += tp(CW - 2.2, 52.3, 'Conception : Maître Aimé FACHOLA', 2.6, { ancre: 'd', italique: true, couleur: '#BFC4CC' });
    return s;
  }

  function carteVerso(k) {
    const id = 'b' + Math.random().toString(36).slice(2, 8);
    let s = bordure(id);
    s += rect(2.6, 2.6, CW - 5.2, 10.8, { fond: VERT_F, r: 1.2 });
    let tx = 5;
    if (k.logo) {
      s += '<circle cx="9.2" cy="8" r="4.6" fill="#fff"/>' + image(k.logo, 5.4, 4.2, 7.6, 7.6);
      tx = 15.4;
    }
    s += tp(tx, 7, String(k.ecole || '').toUpperCase(), 7, { gras: true, couleur: '#fff', max: CW - tx - 4, miniPt: 4.5 });
    s += tp(tx, 10.6, k.sous || '', 4.3, { couleur: '#fff', max: CW - tx - 4 });
    let yy = 17.4;
    (k.lignes || []).filter(l => l[1]).slice(0, 8).forEach(([lib, val]) => {
      s += tp(5, yy, lib, 4.2, { gras: true, couleur: VERT_F, max: 18.5 });
      s += tp(24, yy, ': ' + val, 4.8, { couleur: '#111827', max: CW - 30, miniPt: 3.4 });
      yy += 2.9;
    });
    s += ligne(4, 40.4, CW - 4, 40.4, OR_CLAIR, 0.14);
    decouper(k.note || '', HELV, 4.1 * PT, CW - 10, false, true).slice(0, 3).forEach((l, i) => {
      s += tp(5, 43.1 + i * 1.9, l, 4.1, { italique: true, couleur: '#344054' });
    });
    if (k.urgence) s += tp(5, 49.5, "En cas d'urgence : " + k.urgence, 4.2, { gras: true, couleur: DRAP_ROUGE, max: CW - 22 });
    s += drapeau(CW - 12.5, 45.6, 7.5, 5, 0.07);
    return s;
  }

  const carteSVG = (contenu, x, y) => '<svg x="' + n2(x || 0) + '" y="' + n2(y || 0) + '" width="' + CW + '" height="' + CH
    + '" viewBox="0 0 ' + CW + ' ' + CH + '" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' + contenu + '</svg>';

  /** Aperçu écran d'une carte : recto et verso côte à côte. */
  function apercuCarte(k) {
    const f = (c, t) => '<figure class="carte-face"><svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ' + CW + ' ' + CH + '">' + c
      + '</svg><figcaption>' + t + '</figcaption></figure>';
    return '<div class="cartes-apercu">' + f(carteRecto(k), 'Recto') + f(carteVerso(k), 'Verso') + '</div>';
  }

  /** Planche A4 : 10 cartes par page (2 × 5), recto puis verso (colonnes inversées : impression recto-verso, bord long). */
  function planche(cartes, titre) {
    const W = 210, H = 297, mx = (W - 2 * CW - 4) / 2, my = (H - 5 * CH - 12) / 2 + 3;
    const pos = (i, inv) => { let col = i % 2; const lig = Math.floor(i / 2); if (inv) col = 1 - col; return [mx + col * (CW + 4), my + lig * (CH + 3)]; };
    const pages = [];
    for (let d = 0; d < cartes.length; d += 10) {
      const lot = cartes.slice(d, d + 10);
      [['RECTO', carteRecto], ['VERSO', carteVerso]].forEach(([face, fn]) => {
        let s = rect(0, 0, W, H, { fond: '#fff' })
          + texte(mx, 8, (titre || 'Cartes scolaires') + ' — ' + face + ' — page ' + (d / 10 + 1)
            + ' (imprimer en recto-verso, bord long, à 100 %)', { famille: HELV, taille: 2.5, couleur: '#667085' });
        lot.forEach((k, i) => {
          const [x, y] = pos(i, face === 'VERSO');
          s += carteSVG(fn(k), x, y);
          [[x - 3, y + CH, x - 1, y + CH], [x, y + CH + 1, x, y + CH + 3], [x + CW + 1, y, x + CW + 3, y], [x + CW, y - 3, x + CW, y - 1]]
            .forEach(([a, b, c, e]) => { s += ligne(a, b, c, e, '#98A2B3', 0.12); });
        });
        pages.push('<svg class="feuille-a4" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 210 297">' + s + '</svg>');
      });
    }
    return pages.join('');
  }

  /* ---------------- impression au format exact (A4, sans marge) ---------------- */
  function imprimer() {
    const st = document.createElement('style');
    st.textContent = '@page { size: A4 portrait; margin: 0; } @media print { body * { visibility: hidden !important; }'
      + ' .zone-feuilles, .zone-feuilles * { visibility: visible !important; }'
      + ' .zone-feuilles { position: absolute; left: 0; top: 0; width: 210mm; margin: 0; padding: 0; }'
      + ' .zone-feuilles svg.feuille-a4 { width: 210mm; height: 296.5mm; display: block; box-shadow: none; margin: 0;'
      + ' break-after: page; page-break-after: always; } .zone-feuilles .cartes-apercu { display: none !important; } }';
    document.head.appendChild(st);
    const fin = () => { st.remove(); global.removeEventListener('afterprint', fin); };
    global.addEventListener('afterprint', fin);
    setTimeout(() => { global.print(); setTimeout(fin, 60000); }, 60);
  }

  /** Réduit une signature tracée (PNG 460 × 180) pour ménager la mémoire du navigateur. */
  function reduireSignature(url) {
    return new Promise(res => {
      if (!url) return res(null);
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = 260; c.height = 102;
        c.getContext('2d').drawImage(img, 0, 0, 260, 102);
        res(c.toDataURL('image/png'));
      };
      img.onerror = () => res(url);
      img.src = url;
    });
  }

  global.DocScol = { ficheCEP, carteRecto, carteVerso, apercuCarte, planche, imprimer, reduireSignature, NOTES_IMPORTANT };
})(window);
