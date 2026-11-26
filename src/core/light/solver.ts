import type { LightPuzzle, LightState } from './types.ts';
import { simulate } from './simulate.ts';
import { rotated } from '../shadow/engine.ts';

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
  const k = p.interactive.length + p.objects.length;
  const nCells = p.interactive.length;
  const isSocket = p.interactive.map((i) => p.cells[i]!.kind === 'socket');
  // cases de la boîte de chaque objet et leurs voisines : l'objet compte si la lumière y passe
  const regions = p.objects.map((o) => {
    const out = new Set<number>();
    for (let dy = -1; dy <= 3; dy++)
      for (let dx = -1; dx <= 3; dx++) {
        const x = o.ax + dx;
        const y = o.ay + dy;
        if (x >= 0 && y >= 0 && x < p.width && y < p.height) out.add(y * p.width + x);
      }
    return [...out];
  });
  const state: LightState = new Array(k).fill(0);
  const keys = new Set<string>();
  const report: SolveReport = {
    space: 0, count: 0, distinct: 0, solutions: [], reached: new Array(k).fill(false), minClicks: Infinity,
  };

  const leaf = () => {
    report.space++;
    const r = simulate(p, state);
    for (let j = 0; j < nCells; j++) if (r.received[p.interactive[j]!]) report.reached[j] = true;
    regions.forEach((reg, o) => {
      if (reg.some((c) => r.received[c] || r.halfEdges[c * 4] || r.halfEdges[c * 4 + 1] || r.halfEdges[c * 4 + 2] || r.halfEdges[c * 4 + 3])) {
        report.reached[nCells + o] = true;
      }
    });
    if (!r.solved) return;
    report.count++;
    if (report.solutions.length < keep) report.solutions.push(state.slice());
    if (opts.initial) report.minClicks = Math.min(report.minClicks, clicksBetween(opts.initial, state));
    // deux orientations d'un objet qui laissent la même empreinte au sol sont équivalentes
    keys.add(state.map((v, j) => {
      if (j < nCells) return r.received[p.interactive[j]!] ? v : '*';
      const o = p.objects[j - nCells]!;
      return rotated(o.shape, o.axis, v).filter((c) => c[1] === 0).map((c) => `${c[0]}.${c[2]}`).sort().join('+');
    }).join(','));
  };

  const rec = (j: number, used: number) => {
    if (report.space > maxSpace) throw new Error(`${p.id} : espace de recherche trop grand`);
    if (j === k) return leaf();
    if (j >= nCells) {
      for (let t = 0; t < 4; t++) {
        state[j] = t;
        rec(j + 1, used);
      }
      return;
    }
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
