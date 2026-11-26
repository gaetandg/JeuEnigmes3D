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
