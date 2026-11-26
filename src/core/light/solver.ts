import type { LightPuzzle, LightState } from './types.ts';
import { simulate } from './simulate.ts';

export interface SolveReport {
  /** Nombre total de configurations explorées. */
  space: number;
  /** Nombre de configurations qui résolvent l'énigme. */
  count: number;
  /**
   * Nombre de solutions réellement différentes : deux solutions qui ne diffèrent que
   * par des pièces que la lumière ne touche pas comptent pour une seule.
   */
  distinct: number;
  /** Premières solutions trouvées (au plus `keep`). */
  solutions: LightState[];
  /** Pour chaque pièce : un rayon l'atteint-il dans au moins une configuration ? */
  reached: boolean[];
  /** Clics minimum depuis l'état `initial` jusqu'à une solution (Infinity sans solution). */
  minClicks: number;
}

/** Nombre minimal de clics pour passer d'un état à l'autre (clic droit = sens inverse). */
export function clicksBetween(a: LightState, b: LightState): number {
  let n = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) n++;
  return n;
}

/**
 * Solveur exhaustif : essaie toutes les configurations des pièces manipulables
 * en respectant la réserve de miroirs. Suffisant pour des panneaux jusqu'à ~10⁶ états.
 */
export function solve(
  p: LightPuzzle,
  opts: { keep?: number; initial?: LightState; maxSpace?: number } = {},
): SolveReport {
  const keep = opts.keep ?? 5;
  const maxSpace = opts.maxSpace ?? 5_000_000;
  const k = p.interactive.length;
  const isSocket = p.interactive.map((i) => p.cells[i]!.kind === 'socket');
  const state: LightState = new Array(k).fill(0);
  const keys = new Set<string>();
  const report: SolveReport = {
    space: 0, count: 0, distinct: 0, solutions: [], reached: new Array(k).fill(false), minClicks: Infinity,
  };

  const leaf = () => {
    report.space++;
    const r = simulate(p, state);
    for (let j = 0; j < k; j++) if (r.received[p.interactive[j]!]) report.reached[j] = true;
    if (!r.solved) return;
    report.count++;
    if (report.solutions.length < keep) report.solutions.push(state.slice());
    if (opts.initial) report.minClicks = Math.min(report.minClicks, clicksBetween(opts.initial, state));
    keys.add(state.map((v, j) => (r.received[p.interactive[j]!] ? v : '*')).join(','));
  };

  const rec = (j: number, used: number) => {
    if (report.space > maxSpace) throw new Error(`${p.id} : espace de recherche trop grand`);
    if (j === k) return leaf();
    if (isSocket[j]) {
      state[j] = -1;
      rec(j + 1, used);
      if (used < p.inventory) {
        state[j] = 0;
        rec(j + 1, used + 1);
        state[j] = 1;
        rec(j + 1, used + 1);
      }
    } else {
      state[j] = 0;
      rec(j + 1, used);
      state[j] = 1;
      rec(j + 1, used);
    }
  };
  rec(0, 0);
  report.distinct = keys.size;
  return report;
}

export interface PuzzleAnalysis extends SolveReport {
  /** Pièces qu'aucun rayon ne peut jamais atteindre : elles ne servent à rien. */
  dead: number[];
}

/** Analyse complète d'une énigme (utilisée par les tests de validation et le rapport). */
export function analyze(p: LightPuzzle, initial: LightState, keep = 5): PuzzleAnalysis {
  const r = solve(p, { keep, initial });
  const dead = r.reached.flatMap((ok, j) => (ok ? [] : [j]));
  return { ...r, dead };
}
