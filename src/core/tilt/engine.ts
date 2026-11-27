/**
 * Moteur des énigmes d'inclinaison (l'Île du Ciel). Logique pure, sans rendu.
 *
 * Un plateau quadrillé porte des billes de couleur. On l'incline d'un côté : TOUTES les billes
 * roulent dans cette direction jusqu'à buter contre un mur, le bord ou une autre bille.
 * - Une bille qui passe sur le creux de SA couleur y tombe et s'y loge (le creux est alors plein
 *   et les autres billes roulent par-dessus).
 * - Une bille qui passe sur un puits noir y tombe : c'est raté, on recommence.
 * - Les creux d'une autre couleur ne retiennent pas la bille.
 * L'énigme est résolue quand chaque bille est logée dans un creux de sa couleur.
 */

export type TiltColor = 'R' | 'G' | 'B' | 'Y';
export type TiltCell = { kind: 'floor' } | { kind: 'wall' } | { kind: 'pit' } | { kind: 'hole'; color: TiltColor };

export interface TiltPuzzle {
  id: string;
  width: number;
  height: number;
  cells: TiltCell[];
  /** billes au départ : couleur et case */
  balls: { color: TiltColor; x: number; y: number }[];
}

/** Direction d'inclinaison : 0 = nord (haut), 1 = est, 2 = sud, 3 = ouest. */
export type TiltDir = 0 | 1 | 2 | 3;
const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

/** Une bille : position, ou -1 si elle est logée dans son creux. */
export interface BallState {
  x: number;
  y: number;
  /** logée dans un creux de sa couleur */
  home: boolean;
}

export interface TiltState {
  balls: BallState[];
  /** une bille est tombée dans un puits */
  lost: boolean;
}

export function startTilt(p: TiltPuzzle): TiltState {
  return { balls: p.balls.map((b) => ({ x: b.x, y: b.y, home: false })), lost: false };
}

export const cellAt = (p: TiltPuzzle, x: number, y: number): TiltCell | null =>
  x < 0 || y < 0 || x >= p.width || y >= p.height ? null : p.cells[y * p.width + x]!;

/** Trajet d'une bille pendant une inclinaison (cases traversées, pour l'animation). */
export interface BallMove {
  path: { x: number; y: number }[];
  /** ce qui l'a arrêtée */
  end: 'stop' | 'home' | 'pit';
}

/**
 * Incline le plateau. Les billes partent dans l'ordre (la plus en avant d'abord), chacune roule
 * jusqu'à un obstacle (mur, bord, bille arrêtée), un creux libre de sa couleur ou un puits.
 */
export function tilt(p: TiltPuzzle, s: TiltState, d: TiltDir): { state: TiltState; moves: BallMove[] } {
  const balls = s.balls.map((b) => ({ ...b }));
  const moves: BallMove[] = balls.map((b) => ({ path: [{ x: b.x, y: b.y }], end: 'stop' as const }));
  // creux déjà pleins (une bille logée y reste)
  const filled = new Set<string>();
  for (const b of balls) if (b.home) filled.add(`${b.x},${b.y}`);
  // ordre : la bille la plus avancée dans la direction roule d'abord
  const order = balls.map((_, i) => i).filter((i) => !balls[i]!.home);
  order.sort((a, b) => (balls[b]!.x * DX[d] + balls[b]!.y * DY[d]) - (balls[a]!.x * DX[d] + balls[a]!.y * DY[d]));
  let lost = s.lost;
  const occupied = (x: number, y: number, self: number) =>
    balls.some((b, j) => j !== self && !b.home && b.x === x && b.y === y && b.x >= 0);
  for (const i of order) {
    const b = balls[i]!;
    const color = p.balls[i]!.color;
    for (;;) {
      const nx = b.x + DX[d];
      const ny = b.y + DY[d];
      const c = cellAt(p, nx, ny);
      if (!c || c.kind === 'wall' || occupied(nx, ny, i)) break;
      b.x = nx;
      b.y = ny;
      moves[i]!.path.push({ x: nx, y: ny });
      if (c.kind === 'pit') {
        moves[i]!.end = 'pit';
        lost = true;
        b.x = b.y = -10; // hors du plateau
        break;
      }
      if (c.kind === 'hole' && c.color === color && !filled.has(`${nx},${ny}`)) {
        b.home = true;
        filled.add(`${nx},${ny}`);
        moves[i]!.end = 'home';
        break;
      }
    }
  }
  return { state: { balls, lost }, moves };
}

export function isSolved(s: TiltState): boolean {
  return !s.lost && s.balls.every((b) => b.home);
}

const key = (s: TiltState) => s.balls.map((b) => (b.home ? `h${b.x},${b.y}` : `${b.x},${b.y}`)).join('|');

export interface TiltSolveReport {
  /** gestes minimum (null : insoluble) */
  minMoves: number | null;
  /** plus court chemin (directions) */
  path: TiltDir[] | null;
  /** états atteignables sans perdre de bille */
  reachable: number;
}

/** Parcours en largeur des inclinaisons (on ne passe jamais par un état où une bille est perdue). */
export function solveTilt(p: TiltPuzzle, from: TiltState = startTilt(p), maxStates = 200_000): TiltSolveReport {
  if (isSolved(from)) return { minMoves: 0, path: [], reachable: 1 };
  if (from.lost) return { minMoves: null, path: null, reachable: 0 };
  const prev = new Map<string, { parent: string; d: TiltDir } | null>([[key(from), null]]);
  const states = new Map<string, TiltState>([[key(from), from]]);
  let frontier = [from];
  while (frontier.length && prev.size < maxStates) {
    const next: TiltState[] = [];
    for (const s of frontier) {
      const k0 = key(s);
      for (const d of [0, 1, 2, 3] as TiltDir[]) {
        const t = tilt(p, s, d).state;
        if (t.lost) continue;
        const k = key(t);
        if (prev.has(k)) continue;
        prev.set(k, { parent: k0, d });
        states.set(k, t);
        if (isSolved(t)) {
          const path: TiltDir[] = [];
          for (let c = k; prev.get(c); c = prev.get(c)!.parent) path.unshift(prev.get(c)!.d);
          return { minMoves: path.length, path, reachable: prev.size };
        }
        next.push(t);
      }
    }
    frontier = next;
  }
  return { minMoves: null, path: null, reachable: prev.size };
}
