/**
 * Testeur virtuel : chaque énigme est jouée des centaines de fois par un agent qui agit
 * au hasard (mais jamais deux fois de suite sur la même pièce, et qui recommence une feuille
 * de pliage quand ses plis sont épuisés). Le nombre moyen d'actions avant la solution
 * donne une mesure objective de la difficulté « à l'aveugle » ; on la compare d'une énigme
 * à la suivante pour repérer les sauts brusques de la courbe.
 *
 *   node scripts/difficulty.ts            → tableau
 *   node scripts/difficulty.ts --md       → tableau Markdown (docs/DIFFICULTE.md)
 */
import { initialState, interact, leverCount, parsePuzzle, simulate, solve } from '../src/core/light/index.ts';
import type { LightPuzzleDef } from '../src/core/light/index.ts';
import { applyFold, checkFold, initialFoldState, legalFolds, parseFold, solveFold } from '../src/core/fold/index.ts';
import type { FoldPuzzleDef } from '../src/core/fold/index.ts';
import { checkShadow, parseShadow, shadowLevers, shadowSearch, startState, turnShadow } from '../src/core/shadow/index.ts';
import type { ShadowPuzzleDef } from '../src/core/shadow/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../src/puzzles/zone1.ts';
import { greedyFold, greedyLight, greedyShadow } from './greedy.ts';
import { parseTilt, solveTilt, startTilt, tilt } from '../src/core/tilt/index.ts';
import type { TiltDir } from '../src/core/tilt/index.ts';
import { ZONE5, ZONE5_GRAND } from '../src/puzzles/zone5.ts';
import type { SkyPuzzleDef } from '../src/puzzles/zone5.ts';
import { greedyTilt } from './tilt-gen.ts';
import { checkRoots, distinctTurns, parseRoots, rotateMask, solveRoots } from '../src/core/roots/index.ts';
import type { RootPuzzle, RootPuzzleDef } from '../src/core/roots/index.ts';
import { ZONE6, ZONE6_MERE } from '../src/puzzles/zone6.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../src/puzzles/zone2.ts';
import { ZONE3, ZONE3_CADRAN } from '../src/puzzles/zone3.ts';
import { ZONE4_FOLD, ZONE4_LIGHT } from '../src/puzzles/zone4.ts';

const RUNS = 300;
const CAP = 20000;
let seed = 12345;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);

function median(xs: number[]): number {
  const s = xs.slice().sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
}

export { lightRow, foldRow };

export interface Row {
  zone: string;
  id: string;
  kind: string;
  pieces: number;
  minActions: number;
  space: number;
  /** médiane du nombre d'actions de l'agent aléatoire */
  blind: number;
  /** difficulté : log2 des actions à l'aveugle, arrondie au dixième */
  score: number;
  /** % d'échecs de l'agent glouton : plus c'est haut, plus il faut une idée */
  insight: number;
}

function lightRow(zone: string, def: LightPuzzleDef): Row {
  const p = parsePuzzle(def);
  const init = initialState(p);
  const r = solve(p, { keep: 1, initial: init });
  const n = leverCount(p);
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    let s = init.slice();
    let last = -1;
    let steps = 0;
    while (!simulate(p, s).solved && steps < CAP) {
      let k = Math.floor(rnd() * n);
      if (n > 1 && k === last) k = (k + 1) % n;
      const next = interact(p, s, k, rnd() < 0.5);
      steps++;
      if (next) s = next;
      last = k;
    }
    runs.push(steps);
  }
  const blind = median(runs);
  return { zone, id: def.id, kind: p.cranks ? 'lumière+objets+manivelles' : p.objects.length ? 'lumière+objets' : 'lumière', pieces: n, minActions: r.minClicks, space: r.space, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyLight(p, init)) * 100) };
}

function foldRow(zone: string, def: FoldPuzzleDef): Row {
  const p = parseFold(def);
  const sol = solveFold(p);
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    let s = initialFoldState(p);
    let steps = 0;
    while (!checkFold(p, s).solved && steps < CAP) {
      const legal = legalFolds(s, p.maxFolds);
      if (!legal.length) {
        s = initialFoldState(p); // la feuille se déplie : on recommence
        steps++;
        continue;
      }
      s = applyFold(s, legal[Math.floor(rnd() * legal.length)]!);
      steps++;
    }
    runs.push(steps);
  }
  const blind = median(runs);
  return { zone, id: def.id, kind: p.light ? 'pliage+lumière' : 'pliage', pieces: p.cells.length, minActions: sol.minFolds, space: sol.explored, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyFold(p)) * 100) };
}

function shadowRow(zone: string, def: ShadowPuzzleDef): Row {
  const p = parseShadow(def);
  const start = startState(def);
  const levers = shadowLevers(p).length;
  const search = shadowSearch(p, start);
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    let s = start.slice();
    let steps = 0;
    while (!checkShadow(p, s).solved && steps < CAP) {
      s = turnShadow(p, s, Math.floor(rnd() * levers), rnd() >= 0.5);
      steps++;
    }
    runs.push(steps);
  }
  const blind = median(runs);
  const minActions = search.path?.length ?? Infinity;
  const kind = p.cranks ? 'ombres+manivelles' : 'ombres';
  return { zone, id: def.id, kind, pieces: levers, minActions, space: search.reachable, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyShadow(p, start)) * 100) };
}

function tiltRow(zone: string, def: SkyPuzzleDef): Row {
  const p = parseTilt(def);
  const r = solveTilt(p);
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    let s = startTilt(p);
    let steps = 0;
    while (!s.balls.every((b) => b.home) && steps < CAP) {
      s = tilt(p, s, Math.floor(rnd() * 4) as TiltDir).state;
      steps++;
      // une bille perdue, ou coincé depuis longtemps (impasse) : on recommence, comme un joueur
      if (s.lost || steps % 40 === 0) s = startTilt(p);
    }
    runs.push(steps);
  }
  const blind = median(runs);
  return { zone, id: def.id, kind: 'inclinaison', pieces: p.balls.length, minActions: r.minMoves ?? Infinity, space: r.reachable, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyTilt(p)) * 100) };
}

/** Valeur visible d'un état des racines : tuiles allumées, moins les fuites. */
function rootsValue(p: RootPuzzle, s: number[]): number {
  const c = checkRoots(p, s);
  return c.lit.filter(Boolean).length * 2 - c.leaks - 2 * c.conflicts.length - 2 * c.wrong;
}

/** Agent glouton : tourne toujours la tuile qui améliore le plus la situation visible. */
function greedyRoots(p: RootPuzzle, start: number[], runs = 30): number {
  const free = p.tiles.map((t, i) => (t.seed || t.fixed ? -1 : i)).filter((i) => i >= 0);
  let ok = 0;
  for (let run = 0; run < runs; run++) {
    const s = start.slice();
    for (let step = 0; step < 300; step++) {
      if (checkRoots(p, s).solved) break;
      const v0 = rootsValue(p, s);
      let best = -Infinity;
      let moves: [number, number][] = [];
      for (const i of free) {
        for (const d of [1, 3]) {
          const old = s[i]!;
          s[i] = (old + d) % 4;
          const v = rootsValue(p, s);
          s[i] = old;
          if (v > best) {
            best = v;
            moves = [[i, d]];
          } else if (v === best) moves.push([i, d]);
        }
      }
      if (best <= v0) break;
      const [i, d] = moves[Math.floor(rnd() * moves.length)]!;
      s[i] = (s[i]! + d) % 4;
    }
    if (checkRoots(p, s).solved) ok++;
  }
  return ok / runs;
}

function rootsRow(zone: string, def: RootPuzzleDef): Row {
  const { puzzle: p, start } = parseRoots(def);
  const sol = solveRoots(p, 1).solution!;
  const free = p.tiles.map((t, i) => (t.seed || t.fixed ? -1 : i)).filter((i) => i >= 0);
  // gestes minimum : pour chaque tuile, le plus court (un sens ou l'autre) jusqu'à la bonne forme
  let minActions = 0;
  for (const i of free) {
    const t = p.tiles[i]!;
    const want = rotateMask(t.mask, sol[i]!);
    minActions += [0, 1, 2].find((k) => rotateMask(t.mask, start[i]! + k) === want || rotateMask(t.mask, start[i]! - k) === want)!;
  }
  const space = free.reduce((a, i) => a * distinctTurns(p.tiles[i]!.mask), 1);
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const s = start.slice();
    let steps = 0;
    while (!checkRoots(p, s).solved && steps < CAP) {
      const i = free[Math.floor(rnd() * free.length)]!;
      s[i] = (s[i]! + 1) % 4;
      steps++;
    }
    runs.push(steps);
  }
  const blind = median(runs);
  return { zone, id: def.id, kind: 'racines', pieces: free.length, minActions, space, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyRoots(p, start)) * 100) };
}

export function allRows(): Row[] {
  return [
    ...[...ZONE1, ZONE1_TOWERS].map((d) => lightRow('1 Lumière', d)),
    ...[...ZONE2, ZONE2_GRAND_PLI].map((d) => foldRow('2 Pliage', d)),
    ...[...ZONE3, ZONE3_CADRAN].map((d) => shadowRow('3 Ombres', d)),
    ...['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((id) => {
      const l = ZONE4_LIGHT.find((d) => d.id === id);
      return l ? lightRow('4 Phare', l) : foldRow('4 Phare', ZONE4_FOLD.find((d) => d.id === id)!);
    }),
    ...[...ZONE5, ZONE5_GRAND].map((d) => tiltRow('5 Ciel', d)),
    ...[...ZONE6, ZONE6_MERE].map((d) => rootsRow('6 Racines', d)),
  ];
}

/** Seulement les Racines (plus rapide : `node scripts/difficulty.ts --racines --md`). */
export function rootRows(): Row[] {
  return [...ZONE6, ZONE6_MERE].map((d) => rootsRow('6 Racines', d));
}

if (process.argv[1]?.endsWith('difficulty.ts')) {
  const rows = process.argv.includes('--racines') ? rootRows() : allRows();
  const md = process.argv.includes('--md');
  if (md) {
    console.log('| Zone | Énigme | Type | Pièces | Actions min. | Actions à l\'aveugle (médiane) | Difficulté | Déclic |');
    console.log('|---|---|---|---|---|---|---|---|');
  }
  let prev: Row | null = null;
  for (const r of rows) {
    const jump = prev && prev.zone === r.zone ? r.score - prev.score : 0;
    const flag = jump >= 3 ? ' ⚠ saut' : '';
    const bar = '█'.repeat(Math.round(r.score));
    if (md) console.log(`| ${r.zone} | ${r.id} | ${r.kind} | ${r.pieces} | ${r.minActions} | ${r.blind} | ${r.score.toFixed(1)} ${bar}${flag} | ${r.insight} % |`);
    else console.log(`${r.zone.padEnd(10)} ${r.id.padEnd(10)} ${String(r.minActions).padStart(3)} min  ${String(r.blind).padStart(6)} aveugle  ${r.score.toFixed(1).padStart(5)}  déclic ${String(r.insight).padStart(3)}%  ${bar}${flag}`);
    prev = r;
  }
}
