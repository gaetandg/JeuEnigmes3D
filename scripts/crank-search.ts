/**
 * Recherche d'énigmes d'ombres à manivelles couplées (zone 3).
 * Tire des scènes au hasard (formes, places, axes, départ, solution), garde celles qui ont une
 * solution unique, toutes les positions atteignables et un plus court chemin de longueur voulue,
 * et les classe par « déclic » (échecs de l'agent glouton), avec et sans couplage.
 *
 *   OBJ=3 MINLEN=4 MAXLEN=6 TRIES=2500 node scripts/crank-search.ts
 *   OBJ=2 MINLEN=2 MAXLEN=2 SIDE=1 WALLS=back node scripts/crank-search.ts
 */
import { SHAPES, parseShadow, solveShadow, shadowSearch, checkShadow } from '../src/core/shadow/index.ts';
import type { ShadowPuzzleDef } from '../src/core/shadow/index.ts';
import { greedyShadow } from './greedy.ts';

const shapes = Object.keys(SHAPES);
let seed = Number(process.env.SEED ?? 5);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)]!;

const N = Number(process.env.OBJ ?? 3);
const SLOTS: [number, number][][] = N === 2 ? [[[0, 0], [1, 0]], [[0, 0], [1, 1]]] : [[[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [1, 1], [2, 0]], [[0, 1], [1, 0], [2, 1]]];
const CRANKS: number[][][] = N === 2 ? [[[0, 1], [1]]] : [[[0, 1], [1, 2], [2]]];
const walls = (process.env.WALLS ?? 'back,right').split(',') as ('back' | 'right')[];
const out: { def: ShadowPuzzleDef; len: number; ins: number; insFree: number }[] = [];
for (let tries = 0; tries < Number(process.env.TRIES ?? 4000); tries++) {
  const slots = pick(SLOTS);
  const cranks = pick(CRANKS);
  const def: ShadowPuzzleDef = {
    id: 'x', note: '', walls, cranks,
    objects: slots.map((slot) => ({ shape: pick(shapes), slot, axis: rnd() < 0.5 ? 'x' : 'y', start: Math.floor(rnd() * 4), solution: Math.floor(rnd() * 4) })),
  };
  const p = parseShadow(def);
  const start = def.objects.map((o) => o.start);
  if (checkShadow(p, start).solved) continue;
  if (solveShadow(p).count !== 1) continue;
  const s = shadowSearch(p, start);
  if (!s.path || s.reachable !== 4 ** N) continue;
  const len = s.path.length;
  if (len < Number(process.env.MINLEN ?? 3) || len > Number(process.env.MAXLEN ?? 99)) continue;
  if (process.env.SIDE && slots.some((s) => s[1] !== 0)) continue;
  const ins = Math.round((1 - greedyShadow(p, start)) * 100);
  const free = { ...p, cranks: undefined };
  const insFree = Math.round((1 - greedyShadow(free, start)) * 100);
  out.push({ def, len, ins, insFree });
}
out.sort((a, b) => b.ins - a.ins || b.len - a.len);
const seen = new Set<string>();
for (const o of out) {
  const k = JSON.stringify(o.def);
  if (seen.has(k)) continue;
  seen.add(k);
  console.log(o.ins, o.insFree, o.len, JSON.stringify({ cranks: o.def.cranks, objects: o.def.objects }));
  if (seen.size > Number(process.env.TOP ?? 12)) break;
}
console.log('candidats', out.length);
