/** Rapport du solveur sur les énigmes de pliage : node scripts/fold-report.ts [ids…] */
import { checkFold, foldSequence, initialFoldState, legalFolds, parseFold, solveFold } from '../src/core/fold/index.ts';
import type { FoldPuzzle, FoldState } from '../src/core/fold/index.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../src/puzzles/zone2.ts';

function draw(p: FoldPuzzle, s: FoldState): string {
  const { x0, x1, y0, y1 } = s.bounds;
  const lines: string[] = [];
  const chk = checkFold(p, s);
  for (let y = y0; y < y1; y++) {
    let line = '';
    for (let x = x0; x < x1; x++) {
      const st = s.poses.map((q, i) => ({ q, i })).filter((e) => e.q.x === x && e.q.y === y).sort((a, b) => b.q.layer - a.q.layer);
      const top = st.find((e) => chk.visible[e.i]);
      let ch = st.length ? (st[0]!.i !== undefined && p.cells[st[0]!.i]!.hole && !top ? 'O' : '□') : ' ';
      if (top) {
        const c = p.cells[top.i]!;
        const m = top.q.flipped ? c.back : c.front;
        ch = m.kind === 'dot' ? m.color : m.kind === 'stain' ? 's' : m.kind === 'star' ? '*' : '□';
      }
      line += ch + (st.length > 1 ? String(st.length) : ' ') + ' ';
    }
    lines.push(line);
  }
  return lines.join('\n');
}

const only = process.argv.slice(2);
for (const def of [...ZONE2, ZONE2_GRAND_PLI]) {
  if (only.length && !only.includes(def.id)) continue;
  const p = parseFold(def);
  const r = solveFold(p);
  const first = legalFolds(initialFoldState(p), p.maxFolds).length;
  console.log(`\n══ ${def.id} — ${def.note}`);
  console.log(`   ${p.width}×${p.height}, plis min ${r.minFolds} (permis ${p.maxFolds}), états résolus ${r.solvedStates}, états explorés ${r.explored}, choix au départ ${first}${r.solution ? '' : '  ❌ INSOLUBLE'}`);
  console.log(draw(p, initialFoldState(p)).replace(/^/gm, '     '));
  if (r.solution) {
    console.log('   solution : ' + r.solution.map((f) => `${f.axis}${f.at}${f.side < 0 ? '←' : '→'}`).join(' '));
    console.log(draw(p, foldSequence(p, r.solution)).replace(/^/gm, '     '));
  }
}
