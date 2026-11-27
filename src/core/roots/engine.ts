/**
 * Moteur des Racines (sous le phare). Logique pure, sans rendu.
 *
 * Une grille de tuiles ; chaque tuile porte des segments de racine vers certains côtés
 * (masque : nord = 1, est = 2, sud = 4, ouest = 8). On tourne une tuile d'un quart de tour.
 * La lumière part de la graine et suit les racines raccordées (deux tuiles voisines se touchent
 * si chacune a un segment vers l'autre). L'énigme est résolue quand toutes les tuiles sont
 * reliées à la graine et qu'aucune racine ne s'ouvre dans le vide (pas de fuite) : la lumière
 * arrive alors à tous les cristaux.
 *
 * Plus loin : deux graines de couleurs différentes (or, bleu). Chaque cristal attend sa couleur,
 * et les deux réseaux ne doivent jamais se toucher. Des trous (cases vides) percent la grille.
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
  /** couleur de la graine ou du cristal : 0 or (par défaut), 1 bleu */
  color?: number;
}

/** Un trou dans la grille : pas de tuile, pas de racine, rien à éclairer. */
export function isHole(t: RootTile): boolean {
  return t.mask === 0;
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
  /** couleur de la lumière reçue par chaque tuile (-1 : aucune) */
  color: number[];
  /** côtés ouverts dans le vide ou face à une tuile qui ne répond pas, sur des tuiles éclairées */
  leaks: number;
  /** raccords entre deux réseaux de couleurs différentes (interdits), avec leur tuile et leur côté */
  conflicts: { i: number; d: number }[];
  /** cristaux allumés de la mauvaise couleur */
  wrong: number;
  solved: boolean;
}

export function checkRoots(p: RootPuzzle, s: RootState): RootCheck {
  const m = masks(p, s);
  const { width: w, height: h } = p;
  const color = new Array<number>(p.tiles.length).fill(-1);
  let leaks = 0;
  const conflicts: { i: number; d: number }[] = [];
  // chaque graine allume son réseau ; deux réseaux qui se touchent sont en conflit
  // (les graines d'abord, pour qu'un réseau ne « vole » pas la graine de l'autre)
  p.tiles.forEach((t, i) => {
    if (t.seed) color[i] = t.color ?? 0;
  });
  p.tiles.forEach((t, seed) => {
    if (!t.seed) return;
    const c = t.color ?? 0;
    const stack = [seed];
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
        if (color[j] === -1) {
          color[j] = c;
          stack.push(j);
        } else if (color[j] !== c) conflicts.push({ i, d });
      }
    }
  });
  const lit = color.map((c) => c >= 0);
  const wrong = p.tiles.filter((t, i) => t.crystal && lit[i] && color[i] !== (t.color ?? 0)).length;
  const solved = leaks === 0 && conflicts.length === 0 && wrong === 0 && p.tiles.every((t, i) => lit[i] || isHole(t));
  return { lit, color, leaks, conflicts, wrong, solved };
}

/**
 * Déduction locale (comme un joueur qui regarde les bords) : chaque tuile garde les orientations
 * compatibles avec le bord, les trous et ce que ses voisines imposent déjà, jusqu'à ce que plus
 * rien ne change. Renvoie le nombre de tuiles qui tournent et restent indécises : plus il y en
 * a, plus il faut raisonner sur l'ensemble (réseaux, couleurs) pour s'en sortir.
 */
export function undecided(p: RootPuzzle): number {
  const { width: w, height: h } = p;
  const n = p.tiles.length;
  const dom: number[][] = p.tiles.map((t) => {
    const turns = t.seed || t.fixed || isHole(t) ? 1 : distinctTurns(t.mask);
    return Array.from({ length: turns }, (_, r) => rotateMask(t.mask, r));
  });
  for (let changed = true; changed; ) {
    changed = false;
    for (let i = 0; i < n; i++) {
      const x = i % w;
      const y = Math.floor(i / w);
      const keep = dom[i]!.filter((mm) => {
        for (let d = 0; d < 4; d++) {
          const open = !!(mm & BIT[d]!);
          const nx = x + DX[d]!;
          const ny = y + DY[d]!;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) {
            if (open) return false;
            continue;
          }
          const nd = dom[ny * w + nx]!;
          // la voisine doit pouvoir répondre (ouverte en face si l'on est ouvert, fermée sinon)
          if (!nd.some((q) => !!(q & OPP[d]!) === open)) return false;
        }
        return true;
      });
      if (keep.length !== dom[i]!.length) {
        dom[i] = keep;
        changed = true;
      }
    }
  }
  return p.tiles.filter((t, i) => !t.seed && !t.fixed && !isHole(t) && dom[i]!.length > 1).length;
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
