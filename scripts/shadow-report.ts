/** Rapport du solveur sur les énigmes d'ombres : node scripts/shadow-report.ts [ids…] */
import { checkShadow, parseShadow, shadowOn, solveShadow, startState } from '../src/core/shadow/index.ts';
import type { ShadowPuzzle, Wall } from '../src/core/shadow/index.ts';
import { ZONE3, ZONE3_CADRAN } from '../src/puzzles/zone3.ts';

function drawWall(p: ShadowPuzzle, cells: Set<string>, wall: Wall): string[] {
  const w = wall === 'back' ? p.width : p.depth;
  const lines: string[] = [];
  for (let v = p.height - 1; v >= 0; v--) {
    let l = '';
    for (let u = 0; u < w; u++) l += cells.has(`${u},${v}`) ? '█' : '·';
    lines.push(l);
  }
  return lines;
}

const only = process.argv.slice(2);
for (const def of [...ZONE3, ZONE3_CADRAN]) {
  if (only.length && !only.includes(def.id)) continue;
  const p = parseShadow(def);
  const r = solveShadow(p);
  const start = startState(def);
  const flags = [r.count === 0 ? '❌ INSOLUBLE' : '', r.count > 1 ? `⚠ ${r.count} solutions` : '', checkShadow(p, start).solved ? '❌ déjà résolue' : ''].filter(Boolean);
  console.log(`\n══ ${def.id} — ${def.note}`);
  console.log(`   objets ${p.objects.length}, espace ${r.space}, solutions ${r.count} ${JSON.stringify(r.solutions)} ${flags.join(' ')}`);
  for (const w of p.walls) {
    const target = drawWall(p, p.targets[w]!, w);
    const now = drawWall(p, shadowOn(p, start, w), w);
    console.log(`   mur ${w} — cible / départ`);
    target.forEach((l, i) => console.log(`     ${l}   ${now[i]}`));
  }
}
