// CS Pobè — Conception : Maître Aimé FACHOLA (+229 01 96 51 03 33)
// Génère sw-assets.json : liste des fichiers à mettre en cache pour le mode hors ligne + empreinte de version.
import { readdirSync, statSync, readFileSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';

const root = new URL('..', import.meta.url).pathname;
const SKIP = new Set(['ecole', '.git', '.github', 'node_modules', 'tools', 'sw-assets.json', 'LISEZ-MOI.md', 'INSTALLATION.md', 'serveur.js', 'demarrer.sh', 'demarrer-windows.bat', 'README.md']);
const files = [];
(function walk(dir) {
  for (const n of readdirSync(dir)) {
    if (SKIP.has(n) && dir === root) continue;
    const p = join(dir, n);
    const rel = relative(root, p).split(sep).join('/');
    if (rel === 'docs/reference' || rel === 'data/pedagogie') continue;   // data/pedagogie : chargé et mis en cache par le module Pédagogie
      // gros documents de référence : mis en cache à la première ouverture
    if (statSync(p).isDirectory()) walk(p); else files.push(rel);
  }
})(root);
files.sort();
const h = createHash('sha256');
const RE_BUILD = /^const BUILD = '[^']*';$/m;
for (const f of files) {
  h.update(f);
  const c = readFileSync(join(root, f));
  h.update(f === 'sw.js' ? c.toString('utf8').replace(RE_BUILD, "const BUILD = '';") : c);
}
const version = h.digest('hex').slice(0, 12);
const swp = join(root, 'sw.js');
writeFileSync(swp, readFileSync(swp, 'utf8').replace(RE_BUILD, `const BUILD = '${version}';`));
writeFileSync(join(root, 'sw-assets.json'), JSON.stringify({ version, files: ['./', ...files] }, null, 1));
console.log(`sw-assets.json : ${files.length} fichiers, version ${version}`);
