// CS Pobè — génère data/pobe-up.js (zones, unités pédagogiques, écoles, effectifs officiels de la circonscription)
// à partir de pobe_up.json (consolidation du document Word « Unités pédagogiques par zone » et du classeur Excel
// « Les écoles de la CS par zone »), avec les noms d'écoles de l'application (js/donnees.js).
//   node tools/gen-pobe-up.mjs /chemin/pobe_up.json
import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const racine = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = JSON.parse(readFileSync(process.argv[2], 'utf8'));
globalThis.window = globalThis;
// eslint-disable-next-line no-eval
(0, eval)(readFileSync(join(racine, 'js/donnees.js'), 'utf8').replace(/global\.Donnees = /, 'global.__D = '));
let n = 0;
const cs = globalThis.__D.ecolesInitiales(() => 'i' + (n++));

export const norm = t => String(t || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/Œ/g, 'OE')
  .replace(/[^A-Z0-9/]+/g, ' ')
  .replace(/\b(EPP|EPM|EPV|EP|EM|ECOLE|COMPLEXE SCOLAIRE|CS|LE|LA|LES|L|DE|DU|D|DES|ET|JARDINS?|ENFANTS?)\b/g, ' ')
  .replace(/\s*\/\s*/g, '/').replace(/\s+/g, '').trim();
// noms officiels -> nom dans l'application CS Pobè (orthographes différentes)
const ALIAS = {
  'EPV Céleste': 'EPP Céleste EL BETHEL', 'EPV EL-AMIR': 'EPP MAKAZ AL AMIR',
  'EM Catholique Ste Claire': 'EM CATHOLIQUE SAINTE CLAIRE', 'EM Espoir': 'EM ESPOIR DE POBE'
};
const ARR = { 'POBE': 'POBE', 'AHOYEYE': 'AHOYEYE', 'IGANA': 'IGANNA', 'IGANNA': 'IGANNA', 'ISSABA': 'ISSABA', 'TOWE': 'TOWE' };
const arr = a => ARR[String(a || '').normalize('NFKD').replace(/[̀-ͯ]/g, '').toUpperCase().trim()] || '';
const cycleCS = e => String(e.type).indexOf('EM') === 0 ? 'Maternelle' : 'Primaire';
const idx = {};
cs.forEach(e => { idx[norm(e.nom) + '|' + cycleCS(e)] = e; });
const nomCS = {};
P.ecoles.forEach(p => {
  const e = ALIAS[p.nom] ? cs.find(x => x.nom === ALIAS[p.nom]) : idx[norm(p.nom) + '|' + p.cycle];
  nomCS[p.nom] = e ? e.nom : (p.nom.replace(/^EPV /, 'EPP '));
});
const nomUP = u => u.cycle === 'Maternelle' ? u.nom + ' (maternelle)' : u.nom;
const zone = z => (z ? 'Zone ' + z : '');
const ups = P.ups.map(u => ({
  nom: nomUP(u), nomOfficiel: u.nom, zone: zone(u.zone), cycle: u.cycle, numero: u.numero,
  arrondissement: arr(u.arrondissement), rup: u.rup, corup: u.corup, ecoles: u.ecoles.map(x => nomCS[x]), ...(u.ajoutee ? { ajoutee: true } : {})
}));
const upDe = {};
ups.forEach(u => u.ecoles.forEach(e => { upDe[e] = u.nom; }));
const typeDe = p => p.cycle === 'Maternelle' ? (p.secteur === 'Public' ? 'EM' : 'EMPRIV') : (p.secteur === 'Public' ? 'EPP' : 'EPPRIV');
const statutDe = p => p.secteur === 'Public' ? 'Public' : /confession/i.test(p.secteur) ? 'Privé Confessionnel' : 'Privé Laïc';
const ecoles = P.ecoles.map(p => {
  const ref = cs.find(x => x.nom === nomCS[p.nom]);
  const o = {
    nom: nomCS[p.nom], nomOfficiel: p.nom, type: ref ? ref.type : typeDe(p), statut: ref ? ref.statut : statutDe(p),
    arrondissement: (ref && ref.arrondissement) || arr(p.arrondissement), zone: zone(p.zone), zone_up: zone(p.zone_up), up: upDe[nomCS[p.nom]] || '', rubrique: p.rubrique || '',
    annee_creation: p.annee_creation || null, classes_autorisees: p.classes_autorisees ?? null, personnel: p.personnel || null,
    effectifs: p.effectifs || null
  };
  if (!ref) o.nouveau = true;
  return o;
});
const sansUP = ecoles.filter(e => !e.up).map(e => e.nom);
const sortie = {
  version: '2026-10-27.4', source: P.source, annee_fichier: P.annee,
  note: 'Effectifs ' + P.annee + ' du fichier de la CS ; zones et unités pédagogiques du document du 1er décembre 2023.',
  zones: P.zones.map(z => ({ nom: 'Zone ' + z.numero, libelle: z.nom, code: z.code, ecoles: z.ecoles })), ups, ecoles, sansUP, rubriques: P.rubriques
};
for (const f of ['data/pobe-up.js', 'ecole/data/pobe-up.js']) writeFileSync(join(racine, f), '/* CS Pobè — zones, unités pédagogiques (RUP, co-RUP), écoles et effectifs officiels de la circonscription.\n'
  + '   Fichier généré par tools/gen-pobe-up.mjs : ne pas modifier à la main. */\nwindow.POBE_UP = ' + JSON.stringify(sortie) + ';\n');
console.log(ups.length, 'UP ;', ecoles.length, 'écoles (', ecoles.filter(e => e.nouveau).length, 'nouvelles) ;', sansUP.length, 'sans UP');
console.log('nouvelles :', ecoles.filter(e => e.nouveau).map(e => e.nom + ' [' + e.type + ']').join(', '));

// effectifs de chaque école au format d'importation (module Effectifs) : donnees/effectifs-CS-POBE.csv
const COURS = ['CI', 'CP', 'CE1', 'CE2', 'CM1', 'CM2'];
const ent = ['École', 'Année scolaire', ...COURS.flatMap(c => [c + ' G', c + ' F']), 'SP G', 'SP F', 'SG G', 'SG F', 'Total garçons', 'Total filles'];
const lignes = [ent.join(';')];
ecoles.filter(e => e.effectifs).forEach(e => {
  const f = e.effectifs, v = (k, sx) => (f[k] && f[k][sx] != null ? f[k][sx] : '');
  const mat = String(e.type).indexOf('EM') === 0;
  lignes.push([e.nom, '2026-2027', ...COURS.flatMap(c => mat ? ['', ''] : [v(c, 'G'), v(c, 'F')]),
    ...(mat ? [v('petits', 'G'), v('petits', 'F'), v('grands', 'G'), v('grands', 'F')] : ['', '', '', '']), f.TOTAL.G, f.TOTAL.F].join(';'));
});
// lignes de l'ancien fichier pour les écoles absentes du classeur : conservées (maternelles : sections remises à leur place)
{
  const ancien = readFileSync(join(racine, 'donnees/effectifs-CS-POBE.csv'), 'utf8').replace(/^\ufeff/, '').split(/\r?\n/).filter(Boolean).map(l => l.split(';'));
  const h = ancien[0], col = k => h.indexOf(k), presents = new Set(ecoles.filter(e => e.effectifs).map(e => norm(e.nom)));
  const nomApp = n => (cs.find(x => norm(x.nom) === norm(n)) || {}).nom || n.replace(/\s+/g, ' ').trim();
  ancien.slice(1).forEach(l => {
    const nom = nomApp(l[0]); if (presents.has(norm(nom))) return; presents.add(norm(nom));
    const v = k => (col(k) >= 0 ? l[col(k)] : '');
    const mat = /^EM\b/i.test(nom.trim());
    let sp = [v('SP G'), v('SP F')], sg = [v('SG G'), v('SG F')];
    if (mat && !sp.join('') && !sg.join('')) { sp = [v('CI G'), v('CI F')]; sg = [v('CP G'), v('CP F')]; }   // ancien rangement erroné
    const tg = mat ? (+sp[0] || 0) + (+sg[0] || 0) : v('Total garçons'), tf = mat ? (+sp[1] || 0) + (+sg[1] || 0) : v('Total filles');
    lignes.push([nom, v('Année scolaire') || '2026-2027', ...COURS.flatMap(c => mat ? ['', ''] : [v(c + ' G'), v(c + ' F')]), ...(mat ? [...sp, ...sg] : ['', '', '', '']), tg, tf].join(';'));
  });
}
for (const f of ['donnees/effectifs-CS-POBE.csv', 'ecole/donnees/effectifs-CS-POBE.csv']) writeFileSync(join(racine, f), '\ufeff' + lignes.join('\r\n') + '\r\n');
console.log('CSV :', lignes.length - 1, 'écoles');
