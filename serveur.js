#!/usr/bin/env node
/* CS Pobè — serveur local.
 *
 *   node serveur.js            démarre sur le port 8080
 *   node serveur.js 9000       démarre sur le port 9000
 *
 * Il ne sert que les fichiers de ce dossier, uniquement sur cet ordinateur.
 * Aucune dépendance : rien à installer, rien à télécharger. Node.js suffit.
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');

const RACINE = __dirname;
const PORT = Number(process.argv[2] || process.env.PORT || 8080);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.pdf': 'application/pdf',
  '.md': 'text/markdown; charset=utf-8'
};

function repondre(res, code, corps, entetes) {
  res.writeHead(code, Object.assign({
    'Cache-Control': 'no-cache',
    'X-Content-Type-Options': 'nosniff'
  }, entetes || {}));
  res.end(corps);
}

const serveur = http.createServer((req, res) => {
  let chemin;
  try {
    chemin = decodeURIComponent(req.url.split('?')[0].split('#')[0]);
  } catch (e) {
    return repondre(res, 400, 'Requête illisible', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
  if (chemin === '/' || chemin === '') chemin = '/index.html';

  /* Le lien court /v/<numéro> mène à la page de vérification, comme en ligne. */
  const verif = chemin.match(/^\/v\/(.+)$/);
  if (verif) chemin = '/verification.html?n=' + verif[1];

  const requete = chemin.split('?')[0];
  const fichier = path.join(RACINE, path.normalize(requete));

  /* On ne sort jamais du dossier de l'application. */
  if (!fichier.startsWith(RACINE)) {
    return repondre(res, 403, 'Accès refusé', { 'Content-Type': 'text/plain; charset=utf-8' });
  }

  fs.readFile(fichier, (err, contenu) => {
    if (err) {
      return repondre(res, 404, 'Fichier introuvable : ' + requete,
        { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    const type = TYPES[path.extname(fichier).toLowerCase()] || 'application/octet-stream';
    const entetes = { 'Content-Type': type };
    /* Le service worker doit toujours être relu, sinon les mises à jour
       n'arrivent jamais sur les appareils déjà ouverts. */
    if (requete === '/sw.js') entetes['Service-Worker-Allowed'] = '/';
    repondre(res, 200, contenu, entetes);
  });
});

serveur.on('error', err => {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Le port ' + PORT + ' est déjà pris.');
    console.error('  Essayez un autre port :  node serveur.js 8090\n');
  } else {
    console.error('\n  Démarrage impossible : ' + err.message + '\n');
  }
  process.exit(1);
});

serveur.listen(PORT, '127.0.0.1', () => {
  console.log('');
  console.log('  CS Pobè tourne sur   http://localhost:' + PORT);
  console.log('  Ouvrez cette adresse dans votre navigateur.');
  console.log('  Ctrl+C pour arrêter.');
  console.log('');
});
