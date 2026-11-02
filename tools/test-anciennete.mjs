// Test : anciennetés arrêtées au 31 décembre de la seconde année de l'année scolaire (« 2026-2027 » → 31/12/2027) ;
// règle de retraite inchangée. Lancer : node tools/test-anciennete.mjs
import vm from 'node:vm'; import fs from 'node:fs'; import assert from 'node:assert/strict';
const R = new URL('..', import.meta.url).pathname;
// CS Pobè / Mon école : anciennetés au 31/12 de la seconde année
for (const d of [R, R + 'ecole'].filter(x => fs.existsSync(x + '/js/carriere.js'))) {
  const g = {}; vm.runInNewContext(fs.readFileSync(d + '/js/carriere.js', 'utf8'), { window: g, self: g, globalThis: g, module: undefined }, { filename: 'carriere.js' });
  const C = g.Carriere || g.window?.Carriere; assert.ok(C, 'Carriere');
  assert.equal(C.anciennete('2000-06-01', 2027), 27); assert.equal(C.anciennete('2000-06-01', 2026), 26);
  const app = fs.readFileSync(d + '/js/app.js', 'utf8');
  assert.ok(!/anciennetes\(\w+, anneeReference\(\)\)/.test(app), 'appel avec anneeReference');
  assert.equal((app.match(/anciennetes\(\w+, anneeAnciennete\(\)\)/g) || []).length, 6);
  const f = new Function('anneeActive', app.match(/function anneeReference\(\) \{[\s\S]*?\n  \}/)[0] + app.match(/function anneeAnciennete\(\) \{[\s\S]*?\n  \}/)[0] + 'return [anneeReference(), anneeAnciennete()];');
  assert.deepEqual(f(() => '2026-2027'), [2026, 2027]);
  console.log('ok', d);
}