/**
 * Recherche de pochoirs (zone 4 : pliage + lumière) : une feuille trouée posée sur une table
 * lumineuse. On plie au hasard une feuille, le motif éclairé obtenu devient la cible ; on garde
 * les feuilles où il faut exactement L plis, avec peu d'états gagnants, classées par « déclic ».
 *
 *   W=4 H=4 L=3 HOLES=3 TRIES=3000 node scripts/stencil-search.ts
 */
import { applyFold, checkFold, initialFoldState, legalFolds, litCells, solveFold } from '../src/core/fold/index.ts';
import type { FoldPuzzle } from '../src/core/fold/index.ts';
import { greedyFold } from './greedy.ts';

const W = Number(process.env.W ?? 4);
const H = Number(process.env.H ?? 4);
const L = Number(process.env.L ?? 3);
const HOLES = Number(process.env.HOLES ?? 3);
let seed = Number(process.env.SEED ?? 3);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

const out: { p: FoldPuzzle; ins: number; solved: number }[] = [];
const seen = new Set<string>();
const why: Record<string, number> = {};
const no = (k: string) => (why[k] = (why[k] ?? 0) + 1);
for (let t = 0; t < Number(process.env.TRIES ?? 2000); t++) {
  const holes = new Set<number>();
  while (holes.size < HOLES) holes.add(Math.floor(rnd() * W * H));
  const cells = Array.from({ length: W * H }, (_, i) => ({ x: i % W, y: Math.floor(i / W), front: { kind: 'none' } as const, back: { kind: 'none' } as const, hole: holes.has(i) }));
  const base: FoldPuzzle = { id: 'f', width: W, height: H, cells, maxFolds: L };
  let s = initialFoldState(base);
  for (let k = 0; k < L; k++) {
    const opts = legalFolds(s, L);
    if (!opts.length) break;
    s = applyFold(s, opts[Math.floor(rnd() * opts.length)]!);
  }
  if (s.folds.length !== L) { no('plis'); continue; }
  const p: FoldPuzzle = { ...base, light: litCells(base, s) };
  // cases éclairées à travers des trous superposés (au moins deux épaisseurs de papier)
  const stack = new Map<string, { n: number; holes: number }>();
  s.poses.forEach((q, i) => {
    const k = `${q.x},${q.y}`;
    const e = stack.get(k) ?? { n: 0, holes: 0 };
    e.n++;
    if (cells[i]!.hole) e.holes++;
    stack.set(k, e);
  });
  const through = [...stack.values()].filter((e) => e.n >= 2 && e.holes === e.n).length;
  if (through < Number(process.env.STACK ?? 0)) { no('pas de trous superposés'); continue; }
  if (checkFold(p, initialFoldState(p)).solved) { no('résolu au départ'); continue; }
  const r = solveFold(p);
  if (r.minFolds !== L) { no('min ' + r.minFolds); continue; }
  if (r.solvedStates > Number(process.env.MAXSOL ?? 2)) { no('gagnants ' + r.solvedStates); continue; }
  const key = [...holes].sort().join() + '|' + [...p.light!].sort().join();
  if (seen.has(key)) continue;
  seen.add(key);
  out.push({ p, ins: Math.round((1 - greedyFold(p)) * 100), solved: r.solvedStates });
}
out.sort((a, b) => b.ins - a.ins);
for (const o of out.slice(0, Number(process.env.TOP ?? 5))) {
  const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (o.p.cells[y * W + x]!.hole ? 'O' : '.')).join('  ')).join('\n');
  const light = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => (o.p.light!.has(`${x},${y}`) ? 'o' : '.')).join('  ')).join('\n');
  console.log(`déclic ${o.ins} %  états gagnants ${o.solved}\n${grid}\n--\n${light}\n`);
}
console.log('candidats', out.length, JSON.stringify(why));
