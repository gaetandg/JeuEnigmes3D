/**
 * Moteur des Racines (sous le phare). Logique pure, sans rendu.
 *
 * Une grille de tuiles ; chaque tuile porte des segments de racine vers certains côtés
 * (masque : nord = 1, est = 2, sud = 4, ouest = 8). On tourne une tuile d'un quart de tour.
 * La lumière part de la graine et suit les racines raccordées (deux tuiles voisines se touchent
 * si chacune a un segment vers l'autre). L'énigme est résolue quand toutes les tuiles sont
 * reliées à la graine et qu'aucune racine ne s'ouvre dans le vide (pas de fuite) : la lumière
 * arrive alors à tous les cristaux.
 */

export const N = 1;
export const E = 2;
export const S = 4;
export const W = 8;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const BIT = [N, E, S, W];
const OPP = [S, W, N, E];

export interface RootTile {
  /** segments à la rotation 0 */
  mask: number;
  /** la graine (source de lumière) ; ne tourne pas */
  seed?: boolean;
  /** un cristal (une tuile à un seul segment, qui s'allume) */
  crystal?: boolean;
  /** tuile fixe (ne tourne pas) */
  fixed?: boolean;
}

export interface RootPuzzle {
  id: string;
  width: number;
  height: number;
  tiles: RootTile[];
}

/** État : nombre de quarts de tour (sens horaire) de chaque tuile. */
export type RootState = number[];

/** Tourne un masque d'un quart de tour dans le sens horaire (nord → est → sud → ouest). */
export function rotateMask(m: number, turns: number): number {
  let r = m;
  for (let i = 0; i < ((turns % 4) + 4) % 4; i++) r = ((r << 1) | (r >> 3)) & 15;
  return r;
}

export function masks(p: RootPuzzle, s: RootState): number[] {
  return p.tiles.map((t, i) => rotateMask(t.mask, s[i] ?? 0));
}

export interface RootCheck {
  /** tuiles atteintes par la lumière */
  lit: boolean[];
  /** côtés ouverts dans le vide ou face à une tuile qui ne répond pas, sur des tuiles éclairées */
  leaks: number;
  solved: boolean;
}

export function checkRoots(p: RootPuzzle, s: RootState): RootCheck {
  const m = masks(p, s);
  const { width: w, height: h } = p;
  const lit = new Array(p.tiles.length).fill(false);
  const seed = p.tiles.findIndex((t) => t.seed);
  const stack = seed >= 0 ? [seed] : [];
  if (seed >= 0) lit[seed] = true;
  let leaks = 0;
  while (stack.length) {
    const i = stack.pop()!;
    const x = i % w;
    const y = Math.floor(i / w);
    for (let d = 0; d < 4; d++) {
      if (!(m[i]! & BIT[d]!)) continue;
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
        leaks++;
        continue;
      }
      const j = ny * w + nx;
      if (!(m[j]! & OPP[d]!)) {
        leaks++;
        continue;
      }
      if (!lit[j]) {
        lit[j] = true;
        stack.push(j);
      }
    }
  }
  const solved = leaks === 0 && lit.every(Boolean);
  return { lit, leaks, solved };
}

/** Nombre de rotations distinctes d'une tuile (une croix : 1 ; une droite : 2 ; sinon 4). */
export function distinctTurns(mask: number): number {
  if (mask === 15 || mask === 0) return 1;
  if (mask === (N | S) || mask === (E | W)) return 2;
  return 4;
}

export interface RootSolveReport {
  /** solutions distinctes (motifs de raccords différents), au plus `limit` */
  count: number;
  solution: RootState | null;
}

/**
 * Solveur par retour arrière, case par case (lecture ligne à ligne) : chaque tuile doit être
 * cohérente avec ses voisines déjà posées (nord, ouest) et avec le bord.
 */
export function solveRoots(p: RootPuzzle, limit = 2): RootSolveReport {
  const { width: w, height: h } = p;
  const n = p.tiles.length;
  const cur = new Array(n).fill(0);
  const m = new Array(n).fill(0);
  const report: RootSolveReport = { count: 0, solution: null };
  const rec = (i: number) => {
    if (report.count >= limit) return;
    if (i === n) {
      if (checkRoots(p, cur).solved) {
        report.count++;
        if (!report.solution) report.solution = cur.slice();
      }
      return;
    }
    const x = i % w;
    const y = Math.floor(i / w);
    const t = p.tiles[i]!;
    const options = t.seed || t.fixed ? 1 : distinctTurns(t.mask);
    for (let r = 0; r < options; r++) {
      const mm = rotateMask(t.mask, r);
      // bords
      if (y === 0 && mm & N) continue;
      if (x === 0 && mm & W) continue;
      if (y === h - 1 && mm & S) continue;
      if (x === w - 1 && mm & E) continue;
      // voisins déjà posés
      if (y > 0 && !!(mm & N) !== !!(m[i - w]! & S)) continue;
      if (x > 0 && !!(mm & W) !== !!(m[i - 1]! & E)) continue;
      cur[i] = r;
      m[i] = mm;
      rec(i + 1);
    }
  };
  rec(0);
  return report;
}
