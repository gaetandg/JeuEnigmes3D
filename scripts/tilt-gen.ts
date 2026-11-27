/**
 * Générateur d'énigmes d'inclinaison (l'Île du Ciel) : plateaux tirés au hasard (murs, puits,
 * billes, creux), gardés s'ils sont solubles en MIN..MAX gestes, classés par « déclic » (échecs
 * d'un agent glouton qui rapproche toujours les billes de leurs creux).
 *
 *   W=5 H=5 BALLS=R,B WALLS=4 PITS=1 MIN=4 MAX=6 TRIES=4000 node scripts/tilt-gen.ts
 */
import { isSolved, parseTilt, solveTilt, startTilt, tilt } from '../src/core/tilt/index.ts';
import type { TiltDir, TiltPuzzle, TiltState } from '../src/core/tilt/index.ts';

const W = Number(process.env.W ?? 5);
const H = Number(process.env.H ?? 5);
const BALLS = (process.env.BALLS ?? 'R').split(',');
const WALLS = Number(process.env.WALLS ?? 3);
const PITS = Number(process.env.PITS ?? 0);
const MIN = Number(process.env.MIN ?? 3);
const MAX = Number(process.env.MAX ?? 6);
let seed = Number(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

/** valeur visible : billes logées, et distance des autres à un creux libre de leur couleur */
function value(p: TiltPuzzle, s: TiltState): number {
  if (s.lost) return -1e6;
  let v = 0;
  s.balls.forEach((b, i) => {
    if (b.home) {
      v += 100;
      return;
    }
    let best = 99;
    p.cells.forEach((c, k) => {
      if (c.kind !== 'hole' || c.color !== p.balls[i]!.color) return;
      const x = k % p.width;
      const y = Math.floor(k / p.width);
      if (s.balls.some((o) => o.home && o.x === x && o.y === y)) return;
      best = Math.min(best, Math.abs(x - b.x) + Math.abs(y - b.y));
    });
    v -= best;
  });
  return v;
}

/** taux de réussite d'un agent glouton (pas au hasard parmi les meilleurs ex aequo) */
export function greedyTilt(p: TiltPuzzle, runs = 100, steps = 30): number {
  let ok = 0;
  for (let r = 0; r < runs; r++) {
    let s = startTilt(p);
    let v = value(p, s);
    let flat = 0;
    for (let i = 0; i < steps && !isSolved(s); i++) {
      const next = ([0, 1, 2, 3] as TiltDir[]).map((d) => tilt(p, s, d).state).map((t) => ({ t, v: value(p, t) }));
      const best = Math.max(...next.map((n) => n.v));
      if (best < v) break;
      const pool = next.filter((n) => n.v === best);
      const pick = pool[Math.floor(rnd() * pool.length)]!;
      flat = best === v ? flat + 1 : 0;
      if (flat > 6) break;
      s = pick.t;
      v = best;
    }
    if (isSolved(s)) ok++;
  }
  return ok / runs;
}

function attempt(): { grid: string; len: number; ins: number } | null {
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  const free = () => {
    for (let t = 0; t < 100; t++) {
      const x = Math.floor(rnd() * W);
      const y = Math.floor(rnd() * H);
      if (g[y]![x] === '.') return [x, y] as const;
    }
    return null;
  };
  for (let i = 0; i < WALLS; i++) { const c = free(); if (c) g[c[1]]![c[0]] = '#'; }
  for (let i = 0; i < PITS; i++) { const c = free(); if (c) g[c[1]]![c[0]] = 'x'; }
  for (const b of BALLS) { const c = free(); if (!c) return null; g[c[1]]![c[0]] = 'o' + b; }
  for (const b of BALLS) { const c = free(); if (!c) return null; g[c[1]]![c[0]] = b; }
  const grid = g.map((r) => r.map((t) => t.padEnd(2)).join(' ')).join('\n');
  const p = parseTilt({ id: 'gen', grid });
  const r = solveTilt(p);
  if (r.minMoves === null || r.minMoves < MIN || r.minMoves > MAX) return null;
  return { grid, len: r.minMoves, ins: Math.round((1 - greedyTilt(p)) * 100) };
}

if (process.argv[1]?.endsWith('tilt-gen.ts')) {
  const out: { grid: string; len: number; ins: number }[] = [];
  for (let t = 0; t < Number(process.env.TRIES ?? 3000); t++) {
    const a = attempt();
    if (a && !out.some((o) => o.grid === a.grid)) out.push(a);
  }
  out.sort((a, b) => (process.env.EASY ? a.ins - b.ins : b.ins - a.ins) || b.len - a.len);
  for (const o of out.slice(0, Number(process.env.TOP ?? 4))) console.log(`déclic ${o.ins} %  gestes ${o.len}\n${o.grid}\n`);
  console.log('candidats', out.length);
}
