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
import { initialState, interact, parsePuzzle, pieceCount, simulate, solve } from '../src/core/light/index.ts';
import type { LightPuzzleDef } from '../src/core/light/index.ts';
import { applyFold, checkFold, initialFoldState, legalFolds, parseFold, solveFold } from '../src/core/fold/index.ts';
import type { FoldPuzzleDef } from '../src/core/fold/index.ts';
import { checkShadow, parseShadow, solveShadow, startState } from '../src/core/shadow/index.ts';
import type { ShadowPuzzleDef } from '../src/core/shadow/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../src/puzzles/zone1.ts';
import { greedyFold, greedyLight, greedyShadow } from './greedy.ts';
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
  const n = pieceCount(p);
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
  return { zone, id: def.id, kind: p.objects.length ? 'lumière+objets' : 'lumière', pieces: n, minActions: r.minClicks, space: r.space, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyLight(p, init)) * 100) };
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
  const r = solveShadow(p);
  const start = startState(def);
  const n = p.objects.length;
  const runs: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const s = start.slice();
    let steps = 0;
    while (!checkShadow(p, s).solved && steps < CAP) {
      const k = Math.floor(rnd() * n);
      s[k] = (s[k]! + (rnd() < 0.5 ? 1 : 3)) % 4;
      steps++;
    }
    runs.push(steps);
  }
  const blind = median(runs);
  const minActions = Math.min(...r.solutions.map((sol) => sol.reduce((a, t, i) => a + Math.min((t - start[i]! + 4) % 4, (start[i]! - t + 4) % 4), 0)));
  return { zone, id: def.id, kind: 'ombres', pieces: n, minActions, space: r.space, blind, score: Math.round(Math.log2(blind + 1) * 10) / 10, insight: Math.round((1 - greedyShadow(p, start)) * 100) };
}

export function allRows(): Row[] {
  return [
    ...[...ZONE1, ZONE1_TOWERS].map((d) => lightRow('1 Lumière', d)),
    ...[...ZONE2, ZONE2_GRAND_PLI].map((d) => foldRow('2 Pliage', d)),
    ...[...ZONE3, ZONE3_CADRAN].map((d) => shadowRow('3 Ombres', d)),
    ...['f1', 'f2', 'f3', 'f4', 'f5'].map((id) => {
      const l = ZONE4_LIGHT.find((d) => d.id === id);
      return l ? lightRow('4 Phare', l) : foldRow('4 Phare', ZONE4_FOLD.find((d) => d.id === id)!);
    }),
  ];
}

if (process.argv[1]?.endsWith('difficulty.ts')) {
  const rows = allRows();
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
