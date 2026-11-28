/**
 * Moteur des Vases (la Bulle, sous l'océan). Logique pure, sans rendu.
 *
 * Des tubes de verre de hauteurs différentes (capacités), plus ou moins remplis d'eau, reliés par
 * des tuyaux. Ouvrir un tuyau verse l'eau d'un tube dans l'autre, jusqu'à ce que le premier soit
 * vide ou le second plein. Le but : que l'eau arrive pile aux anneaux d'or marqués sur certains
 * tubes (toutes les cibles en même temps).
 */
export interface VasePipe {
  a: number;
  b: number;
  /** sens unique : on ne peut verser que de a vers b */
  oneWay?: boolean;
}

export interface VasePuzzle {
  id: string;
  /** capacité de chaque tube */
  caps: number[];
  /** eau au départ */
  start: number[];
  /** niveau visé par tube (null : pas de cible) */
  targets: (number | null)[];
  pipes: VasePipe[];
}

export type VaseState = number[];

/** Un geste : verser par le tuyau `pipe`, dans le sens a→b (ou b→a si `reverse`). */
export interface VaseMove {
  pipe: number;
  reverse: boolean;
}

/** Verse ; renvoie le nouvel état, ou null si rien ne coule (source vide, cible pleine, sens interdit). */
export function pour(p: VasePuzzle, s: VaseState, m: VaseMove): VaseState | null {
  const pipe = p.pipes[m.pipe];
  if (!pipe) return null;
  if (m.reverse && pipe.oneWay) return null;
  const from = m.reverse ? pipe.b : pipe.a;
  const to = m.reverse ? pipe.a : pipe.b;
  const amount = Math.min(s[from]!, p.caps[to]! - s[to]!);
  if (amount <= 0) return null;
  const next = s.slice();
  next[from]! -= amount;
  next[to]! += amount;
  return next;
}

export function isSolved(p: VasePuzzle, s: VaseState): boolean {
  return p.targets.every((t, i) => t === null || s[i] === t);
}

export function allMoves(p: VasePuzzle): VaseMove[] {
  return p.pipes.flatMap((pipe, i) => (pipe.oneWay ? [{ pipe: i, reverse: false }] : [{ pipe: i, reverse: false }, { pipe: i, reverse: true }]));
}

export interface VaseSolveReport {
  /** nombre minimal de gestes (null : impossible) */
  minMoves: number | null;
  /** un chemin optimal */
  path: VaseMove[] | null;
  /** états atteignables */
  reachable: number;
}

/** Parcours en largeur des états (petits espaces : quelques tubes de capacité ≤ 15). */
export function solveVases(p: VasePuzzle, from: VaseState = p.start): VaseSolveReport {
  const key = (s: VaseState) => s.join(',');
  const moves = allMoves(p);
  const prev = new Map<string, { k: string; m: VaseMove } | null>([[key(from), null]]);
  const queue: VaseState[] = [from];
  let goal: string | null = isSolved(p, from) ? key(from) : null;
  for (let h = 0; h < queue.length && !goal; h++) {
    const s = queue[h]!;
    for (const m of moves) {
      const n = pour(p, s, m);
      if (!n) continue;
      const k = key(n);
      if (prev.has(k)) continue;
      prev.set(k, { k: key(s), m });
      if (isSolved(p, n)) {
        goal = k;
        break;
      }
      queue.push(n);
    }
  }
  // tout l'espace (pour la mesure)
  if (goal) {
    for (let h = 0; h < queue.length; h++) {
      for (const m of moves) {
        const n = pour(p, queue[h]!, m);
        if (n && !prev.has(key(n))) {
          prev.set(key(n), { k: key(queue[h]!), m });
          queue.push(n);
        }
      }
    }
  }
  if (!goal) return { minMoves: null, path: null, reachable: prev.size };
  const path: VaseMove[] = [];
  for (let k: string | null = goal; k; ) {
    const e = prev.get(k);
    if (!e) break;
    path.unshift(e.m);
    k = e.k;
  }
  return { minMoves: path.length, path, reachable: prev.size };
}
