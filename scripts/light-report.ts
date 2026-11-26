/**
 * Rapport du solveur sur les énigmes de lumière.
 *   node scripts/light-report.ts            → toutes les énigmes
 *   node scripts/light-report.ts b2 c1      → seulement celles-ci
 */
import { analyze, initialState, parsePuzzle, renderAscii } from '../src/core/light/index.ts';
import { ZONE1 } from '../src/puzzles/zone1.ts';

const only = process.argv.slice(2);
for (const def of ZONE1) {
  if (only.length && !only.includes(def.id)) continue;
  const p = parsePuzzle(def);
  const init = initialState(p);
  const a = analyze(p, init);
  const flags = [
    a.count === 0 ? '❌ INSOLUBLE' : '',
    a.distinct > 1 ? `⚠ ${a.distinct} solutions distinctes` : '',
    a.dead.length ? `⚠ pièces jamais atteintes: ${a.dead.join(',')}` : '',
    a.minClicks === 0 ? '❌ déjà résolue' : '',
  ].filter(Boolean);
  console.log(`\n══ ${def.id} — ${def.note}`);
  console.log(`   ${p.width}×${p.height}, ${p.interactive.length} pièces, espace ${a.space}, solutions ${a.count} (distinctes ${a.distinct}), clics min ${a.minClicks} ${flags.join(' ')}`);
  console.log('   départ :');
  console.log(renderAscii(p, init).replace(/^/gm, '     '));
  if (a.solutions[0]) {
    console.log('   solution :');
    console.log(renderAscii(p, a.solutions[0]).replace(/^/gm, '     '));
  }
}
