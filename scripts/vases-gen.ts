/**
 * Générateur des Vases (la Bulle) : tubes et tuyaux tirés au hasard ; pour chaque état atteignable,
 * on cherche une cible (un ou deux anneaux) qu'on ne peut atteindre qu'en MIN..MAX gestes ; on
 * classe par « déclic » (échecs d'un agent glouton qui rapproche toujours l'eau des anneaux).
 *
 *   N=3 CAPMIN=3 CAPMAX=11 RINGS=1 MIN=5 MAX=8 PIPES=chain|ring|full ONEWAY=0 TOP=4 node scripts/vases-gen.ts
 */
import { allMoves, isSolved, pour, solveVases } from '../src/core/vases/index.ts';
import type { VasePuzzle, VaseState } from '../src/core/vases/index.ts';

const N = Number(process.env.N ?? 3);
const CAPMIN = Number(process.env.CAPMIN ?? 3);
const CAPMAX = Number(process.env.CAPMAX ?? 11);
const RINGS = Number(process.env.RINGS ?? 1);
const MIN = Number(process.env.MIN ?? 5);
const MAX = Number(process.env.MAX ?? 8);
const PIPES = process.env.PIPES ?? 'full';
const ONEWAY = Number(process.env.ONEWAY ?? 0);
let seed = Number(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const ri = (a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));

function pipesString(): string {
  const pairs: [number, number][] = [];
  if (PIPES === 'chain' || PIPES === 'ring') for (let i = 0; i + 1 < N; i++) pairs.push([i, i + 1]);
  if (PIPES === 'ring' && N > 2) pairs.push([N - 1, 0]);
  if (PIPES === 'full') for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) pairs.push([i, j]);
  const oneWay = new Set<number>();
  while (oneWay.size < Math.min(ONEWAY, pairs.length)) oneWay.add(ri(0, pairs.length - 1));
  return pairs.map(([a, b], k) => (oneWay.has(k) ? (rnd() < 0.5 ? `${a}>${b}` : `${b}>${a}`) : `${a}-${b}`)).join(' ');
}

/** Agent glouton : verse toujours ce qui rapproche le plus l'eau des anneaux. */
export function greedyVases(p: VasePuzzle, runs = 30): number {
  const dist = (s: VaseState) => p.targets.reduce((d: number, t, i) => d + (t === null ? 0 : Math.abs(s[i]! - t)), 0);
  let ok = 0;
  for (let r = 0; r < runs; r++) {
    let s = p.start;
    const seen = new Set([s.join(',')]);
    for (let step = 0; step < 40 && !isSolved(p, s); step++) {
      const opts = allMoves(p).map((m) => pour(p, s, m)).filter((n): n is VaseState => !!n && !seen.has(n.join(',')));
      if (!opts.length) break;
      const best = Math.min(...opts.map(dist));
      const pick = opts.filter((n) => dist(n) === best);
      s = pick[Math.floor(rnd() * pick.length)]!;
      seen.add(s.join(','));
    }
    if (isSolved(p, s)) ok++;
  }
  return ok / runs;
}

function attempt(): { p: VasePuzzle; moves: number; greedy: number; pipes: string } | null {
  const caps = Array.from({ length: N }, () => ri(CAPMIN, CAPMAX));
  // au départ : un ou deux tubes pleins, les autres vides (l'eau ne se crée pas)
  const start = caps.map(() => 0);
  const full = ri(1, Math.max(1, N - 2));
  for (let k = 0; k < full; k++) start[ri(0, N - 1)] = caps[ri(0, N - 1)]!;
  start.forEach((v, i) => (start[i] = Math.min(v, caps[i]!)));
  if (start.every((v) => v === 0)) return null;
  const pipes = pipesString();
  const base: VasePuzzle = { id: 'gen', caps, start, targets: caps.map(() => null), pipes: [] };
  // tuyaux
  base.pipes = pipes.split(' ').map((t) => {
    const m = /^(\d+)([->])(\d+)$/.exec(t)!;
    return m[2] === '>' ? { a: +m[1]!, b: +m[3]!, oneWay: true } : { a: +m[1]!, b: +m[3]! };
  });
  // états atteignables et leur profondeur
  const depth = new Map<string, number>([[start.join(','), 0]]);
  const queue: VaseState[] = [start];
  for (let h = 0; h < queue.length; h++) {
    for (const m of allMoves(base)) {
      const n = pour(base, queue[h]!, m);
      if (n && !depth.has(n.join(','))) {
        depth.set(n.join(','), depth.get(queue[h]!.join(','))! + 1);
        queue.push(n);
      }
    }
  }
  // une cible : RINGS tubes d'un état profond, dont la valeur n'est pas déjà au départ
  const deep = queue.filter((s) => {
    const d = depth.get(s.join(','))!;
    return d >= MIN && d <= MAX;
  });
  if (!deep.length) return null;
  const goal = deep[Math.floor(rnd() * deep.length)]!;
  const idx = Array.from({ length: N }, (_, i) => i).sort(() => rnd() - 0.5).slice(0, RINGS);
  const targets = caps.map((_, i) => (idx.includes(i) ? goal[i]! : null));
  // pas d'anneau tout en haut ou tout en bas (trop évident), ni déjà atteint
  if (idx.some((i) => targets[i] === 0 || targets[i] === caps[i] || targets[i] === start[i])) return null;
  const p: VasePuzzle = { ...base, targets };
  const r = solveVases(p);
  if (r.minMoves === null || r.minMoves < MIN || r.minMoves > MAX) return null;
  return { p, moves: r.minMoves, greedy: greedyVases(p), pipes };
}

if (process.argv[1]?.endsWith('vases-gen.ts')) {
  const found: { p: VasePuzzle; moves: number; greedy: number; pipes: string }[] = [];
  for (let t = 0; t < Number(process.env.TRIES ?? 3000); t++) {
    const a = attempt();
    if (a) found.push(a);
  }
  found.sort((x, y) => x.greedy - y.greedy || y.moves - x.moves);
  for (const f of found.slice(0, Number(process.env.TOP ?? 4))) {
    console.log(`gestes ${f.moves}  glouton ${Math.round(f.greedy * 100)} %  caps [${f.p.caps}] start [${f.p.start}] targets [${f.p.targets.map((t) => t ?? 'null')}] pipes '${f.pipes}'`);
  }
  console.log('candidats', found.length);
}
