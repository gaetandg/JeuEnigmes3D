/**
 * Moteur des énigmes d'ombres (zone 3). Logique pure, sans rendu.
 *
 * Des objets faits de cubes (dans une boîte 3×3×3) sont posés sur une scène.
 * Chacun tourne par quarts de tour, soit autour de l'axe vertical (plateau tournant),
 * soit autour de l'axe est-ouest (berceau). Des lampes éclairent la scène :
 *  - la lampe de face projette l'ombre sur le mur du fond (plan x/y) ;
 *  - la lampe de gauche projette l'ombre sur le mur de droite (plan z/y).
 * L'énigme est résolue quand chaque ombre coïncide exactement avec la silhouette gravée.
 */

export const N = 3; // taille de la boîte d'un objet

export type Voxel = [number, number, number]; // x (droite), y (haut), z (vers le joueur)
export type Axis = 'y' | 'x';
export type Wall = 'back' | 'right';

export interface ShadowObject {
  shape: Voxel[];
  /** position de la boîte sur la scène, en cases (multiples de N) */
  ox: number;
  oz: number;
  axis: Axis;
}

export interface ShadowPuzzle {
  id: string;
  /** dimensions de la scène en cases */
  width: number;
  depth: number;
  height: number;
  objects: ShadowObject[];
  walls: Wall[];
  /** silhouettes cibles : clé `${wall}` → ensemble « u,v » */
  targets: Record<string, Set<string>>;
  /**
   * Manivelles couplées (facultatif) : chacune fait tourner d'un quart de tour, ensemble,
   * tous les objets qu'elle liste. Sans manivelles, chaque objet se tourne seul.
   */
  cranks?: number[][];
}

/** État : nombre de quarts de tour (0..3) de chaque objet. */
export type ShadowState = number[];

/** Tourne une fois un cube d'un quart de tour autour de l'axe donné (centre de la boîte). */
export function rotateOnce([x, y, z]: Voxel, axis: Axis): Voxel {
  if (axis === 'y') return [N - 1 - z, y, x]; // vu de dessus : sens antihoraire
  return [x, N - 1 - z, y]; // le haut bascule vers le joueur
}

export function rotated(shape: Voxel[], axis: Axis, turns: number): Voxel[] {
  let s = shape;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) s = s.map((v) => rotateOnce(v, axis));
  return s;
}

/** Cubes de la scène dans l'état donné (coordonnées de scène). */
export function sceneVoxels(p: ShadowPuzzle, s: ShadowState): Voxel[] {
  const out: Voxel[] = [];
  p.objects.forEach((o, i) => {
    for (const [x, y, z] of rotated(o.shape, o.axis, s[i] ?? 0)) out.push([o.ox + x, y, o.oz + z]);
  });
  return out;
}

/** Ombre sur un mur : ensemble de cases « u,v » (u horizontal, v vertical depuis le bas). */
export function shadowOn(p: ShadowPuzzle, s: ShadowState, wall: Wall): Set<string> {
  const set = new Set<string>();
  for (const [x, y, z] of sceneVoxels(p, s)) {
    // mur du fond : u = x ; mur de droite (vu depuis la gauche) : u = profondeur, du fond vers le joueur
    set.add(wall === 'back' ? `${x},${y}` : `${z},${y}`);
  }
  return set;
}

export function sameSet(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const k of a) if (!b.has(k)) return false;
  return true;
}

export function checkShadow(p: ShadowPuzzle, s: ShadowState): { solved: boolean; walls: Record<string, boolean> } {
  const walls: Record<string, boolean> = {};
  let solved = true;
  for (const w of p.walls) {
    walls[w] = sameSet(shadowOn(p, s, w), p.targets[w]!);
    if (!walls[w]) solved = false;
  }
  return { solved, walls };
}

export interface ShadowSolveReport {
  space: number;
  count: number;
  solutions: ShadowState[];
}

export function solveShadow(p: ShadowPuzzle): ShadowSolveReport {
  const r: ShadowSolveReport = { space: 0, count: 0, solutions: [] };
  const k = p.objects.length;
  const st: ShadowState = new Array(k).fill(0);
  const rec = (i: number) => {
    if (i === k) {
      r.space++;
      if (checkShadow(p, st).solved) {
        r.count++;
        r.solutions.push(st.slice());
      }
      return;
    }
    for (let t = 0; t < 4; t++) {
      st[i] = t;
      rec(i + 1);
    }
  };
  rec(0);
  return r;
}

/** Les leviers du joueur : les manivelles, ou un levier par objet. */
export function shadowLevers(p: ShadowPuzzle): number[][] {
  return p.cranks ?? p.objects.map((_, i) => [i]);
}

/** Geste du joueur : le levier n° k fait tourner ses objets d'un quart de tour (ou en arrière). */
export function turnShadow(p: ShadowPuzzle, s: ShadowState, k: number, reverse = false): ShadowState {
  const next = s.slice();
  for (const i of shadowLevers(p)[k] ?? []) next[i] = (((next[i]! + (reverse ? -1 : 1)) % 4) + 4) % 4;
  return next;
}

export interface ShadowMove {
  lever: number;
  reverse: boolean;
}

const encodeState = (s: ShadowState) => s.reduce((a, t) => a * 4 + t, 0);

/**
 * Parcours en largeur des états atteignables depuis `from` : nombre d'états atteignables et
 * plus court chemin (en gestes) vers une solution, ou null si aucune n'est atteignable.
 */
export function shadowSearch(p: ShadowPuzzle, from: ShadowState): { reachable: number; path: ShadowMove[] | null } {
  const levers = shadowLevers(p).length;
  const start = from.map((t) => ((t % 4) + 4) % 4);
  const prev = new Map<number, { parent: number; move: ShadowMove } | null>([[encodeState(start), null]]);
  const queue: ShadowState[] = [start];
  let found: number | null = checkShadow(p, start).solved ? encodeState(start) : null;
  for (let qi = 0; qi < queue.length; qi++) {
    const s = queue[qi]!;
    const key = encodeState(s);
    for (let k = 0; k < levers; k++) {
      for (const reverse of [false, true]) {
        const n = turnShadow(p, s, k, reverse);
        const nk = encodeState(n);
        if (prev.has(nk)) continue;
        prev.set(nk, { parent: key, move: { lever: k, reverse } });
        queue.push(n);
        if (found === null && checkShadow(p, n).solved) found = nk;
      }
    }
  }
  if (found === null) return { reachable: queue.length, path: null };
  const path: ShadowMove[] = [];
  for (let k = found; prev.get(k); k = prev.get(k)!.parent) path.unshift(prev.get(k)!.move);
  return { reachable: queue.length, path };
}
