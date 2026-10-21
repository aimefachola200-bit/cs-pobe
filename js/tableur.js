/* CS Pobè — lecture des classeurs .xlsx et .csv, sans aucune bibliothèque.
   Un .xlsx est une archive ZIP contenant du XML : on la décompresse et on lit
   la première feuille. Les .csv sont lus directement, séparateur détecté. */
(function (global) {
  'use strict';

  /* ---------------- Décompression ---------------- */

  function lireEntier(vue, position) {
    return vue[position] | (vue[position + 1] << 8)
      | (vue[position + 2] << 16) | (vue[position + 3] << 24);
  }
  function lireCourt(vue, position) {
    return vue[position] | (vue[position + 1] << 8);
  }

  /** Extrait les fichiers d'une archive ZIP. */
  function dezipper(octets) {
    const vue = new Uint8Array(octets);
    const fichiers = {};
    let position = vue.length - 22;

    /* On remonte jusqu'à la fin du répertoire central. */
    while (position >= 0 && lireEntier(vue, position) !== 0x06054b50) position--;
    if (position < 0) throw new Error('archive illisible');

    const nombre = lireCourt(vue, position + 10);
    let entree = lireEntier(vue, position + 16);

    const lectures = [];
    for (let i = 0; i < nombre; i++) {
      const tailleNom = lireCourt(vue, entree + 28);
      const tailleExtra = lireCourt(vue, entree + 30);
      const tailleCommentaire = lireCourt(vue, entree + 32);
      const decalage = lireEntier(vue, entree + 42);
      const nom = new TextDecoder().decode(vue.subarray(entree + 46, entree + 46 + tailleNom));

      const nomLocal = lireCourt(vue, decalage + 26);
      const extraLocal = lireCourt(vue, decalage + 28);
      const debut = decalage + 30 + nomLocal + extraLocal;
      const compression = lireCourt(vue, decalage + 8);
      const tailleCompressee = lireEntier(vue, decalage + 18);
      const donnees = vue.subarray(debut, debut + tailleCompressee);

      lectures.push(decompresser(donnees, compression).then(texte => { fichiers[nom] = texte; }));
      entree += 46 + tailleNom + tailleExtra + tailleCommentaire;
    }
    return Promise.all(lectures).then(() => fichiers);
  }

  function decompresser(donnees, compression) {
    if (compression === 0) return Promise.resolve(new TextDecoder().decode(donnees));
    if (typeof DecompressionStream === 'undefined') {
      return Promise.reject(new Error(
        'votre navigateur ne sait pas décompresser ce classeur — enregistrez-le en CSV'));
    }
    const flux = new Blob([donnees]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Response(flux).text();
  }

  /* ---------------- Lecture d'une feuille ---------------- */

  function balises(xml, nom) {
    const sortie = [];
    const regex = new RegExp('<' + nom + '(\\s[^>]*)?(/>|>([\\s\\S]*?)</' + nom + '>)', 'g');
    let m;
    while ((m = regex.exec(xml)) !== null) sortie.push({ attrs: m[1] || '', contenu: m[3] || '' });
    return sortie;
  }

  function attribut(attrs, nom) {
    const m = new RegExp(nom + '="([^"]*)"').exec(attrs || '');
    return m ? m[1] : null;
  }

  /* Excel écrit volontiers les accents en entités numériques : « &#233; » pour
     « é ». Sans cette conversion, les intitulés de colonnes ne sont plus
     reconnus et les noms arrivent abîmés. */
  function deshtml(texte) {
    return String(texte)
      .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
      .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
  }

  /** Numéro de colonne d'une référence de cellule : A→1, AB→28. */
  function numeroColonne(reference) {
    const lettres = (reference || '').replace(/[0-9]/g, '');
    let n = 0;
    for (let i = 0; i < lettres.length; i++) n = n * 26 + (lettres.charCodeAt(i) - 64);
    return n;
  }

  function lireXlsx(fichiers) {
    /* Table des chaînes partagées. */
    const chaines = [];
    const partagees = fichiers['xl/sharedStrings.xml'];
    if (partagees) {
      balises(partagees, 'si').forEach(si => {
        const morceaux = balises(si.contenu, 't').map(t => deshtml(t.contenu));
        chaines.push(morceaux.join(''));
      });
    }

    /* Première feuille du classeur. */
    let nomFeuille = 'xl/worksheets/sheet1.xml';
    if (!fichiers[nomFeuille]) {
      const candidat = Object.keys(fichiers).filter(n => /^xl\/worksheets\/.*\.xml$/.test(n)).sort()[0];
      if (!candidat) throw new Error('aucune feuille trouvée dans le classeur');
      nomFeuille = candidat;
    }

    const lignes = [];
    balises(fichiers[nomFeuille], 'row').forEach(row => {
      const cellules = [];
      balises(row.contenu, 'c').forEach(c => {
        const colonne = numeroColonne(attribut(c.attrs, 'r'));
        const type = attribut(c.attrs, 't');
        let valeur = '';
        if (type === 'inlineStr') {
          valeur = balises(c.contenu, 't').map(t => deshtml(t.contenu)).join('');
        } else {
          const v = balises(c.contenu, 'v')[0];
          if (v) {
            valeur = deshtml(v.contenu);
            if (type === 's') valeur = chaines[Number(valeur)] || '';
          }
        }
        cellules[colonne - 1] = valeur;
      });
      for (let i = 0; i < cellules.length; i++) {
        if (cellules[i] === undefined) cellules[i] = '';
      }
      lignes.push(cellules);
    });
    return lignes;
  }

  /* ---------------- CSV ---------------- */

  function lireCSV(texte) {
    const separateur = (texte.split('\n')[0].match(/;/g) || []).length
      >= (texte.split('\n')[0].match(/,/g) || []).length ? ';' : ',';
    const lignes = [];
    let ligne = [], champ = '', guillemets = false;

    for (let i = 0; i < texte.length; i++) {
      const c = texte[i];
      if (guillemets) {
        if (c === '"' && texte[i + 1] === '"') { champ += '"'; i++; }
        else if (c === '"') guillemets = false;
        else champ += c;
      } else if (c === '"') guillemets = true;
      else if (c === separateur) { ligne.push(champ); champ = ''; }
      else if (c === '\n') { ligne.push(champ); lignes.push(ligne); ligne = []; champ = ''; }
      else if (c !== '\r') champ += c;
    }
    if (champ !== '' || ligne.length) { ligne.push(champ); lignes.push(ligne); }
    return lignes.filter(l => l.some(x => String(x).trim() !== ''));
  }

  /* ---------------- Entrée publique ---------------- */

  /** Lit un fichier choisi par l'utilisateur et renvoie un tableau de lignes. */
  function lire(fichier) {
    const nom = (fichier.name || '').toLowerCase();
    if (nom.endsWith('.csv') || nom.endsWith('.txt')) {
      return fichier.text().then(lireCSV);
    }
    return fichier.arrayBuffer()
      .then(dezipper)
      .then(lireXlsx)
      .then(lignes => lignes.filter(l => l.some(x => String(x).trim() !== '')));
  }

  global.Tableur = { lire, lireCSV };
})(window);
