/**
 * Moteur des énigmes de pliage (zone 2). Logique pure, sans rendu.
 *
 * Une feuille quadrillée porte des marques sur ses deux faces. On la plie le long
 * de lignes de la grille : la plus petite moitié se rabat (tourne de 180°) sur l'autre.
 * À égalité, le joueur choisit quel côté se rabat.
 *
 * Règles de réussite (toutes celles présentes sur la feuille) :
 *  - POINTS : tous les points d'une même couleur finissent dans la même pile,
 *             et une pile ne contient jamais deux couleurs de points ;
 *  - TACHES : aucune tache n'est visible du dessus ;
 *  - ÉTOILES : toutes les étoiles sont visibles du dessus.
 * Une case trouée laisse voir ce qu'il y a dessous.
 */

export type MarkColor = 'R' | 'B' | 'G' | 'Y';
export type Mark = { kind: 'none' } | { kind: 'dot'; color: MarkColor } | { kind: 'stain' } | { kind: 'star' };

export interface FoldCellDef {
  x: number;
  y: number;
  front: Mark;
  back: Mark;
  hole: boolean;
}

export interface FoldPuzzle {
  id: string;
  width: number;
  height: number;
  cells: FoldCellDef[]; // seulement les cases présentes
  /** nombre de plis permis (affiché sur le panneau) */
  maxFolds: number;
}

/** Un pli : axe, position de la ligne (entre `at - 1` et `at`), côté qui se rabat. */
export interface Fold {
  axis: 'x' | 'y';
  at: number;
  /** -1 : le côté bas (gauche / haut) se rabat ; +1 : le côté haut (droite / bas) se rabat */
  side: -1 | 1;
}

/** Position courante d'une case de la feuille. */
export interface CellPose {
  x: number;
  y: number;
  layer: number;
  /** retournée ? (face arrière vers le haut) */
  flipped: boolean;
}

export interface FoldState {
  folds: Fold[];
  poses: CellPose[];
  bounds: { x0: number; x1: number; y0: number; y1: number }; // x1, y1 exclus
}

export function initialFoldState(p: FoldPuzzle): FoldState {
  return {
    folds: [],
    poses: p.cells.map((c) => ({ x: c.x, y: c.y, layer: 0, flipped: false })),
    bounds: boundsOf(p.cells.map((c) => ({ x: c.x, y: c.y }))),
  };
}

function boundsOf(pts: { x: number; y: number }[]) {
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  for (const p of pts) {
    x0 = Math.min(x0, p.x);
    x1 = Math.max(x1, p.x + 1);
    y0 = Math.min(y0, p.y);
    y1 = Math.max(y1, p.y + 1);
  }
  return { x0, x1, y0, y1 };
}

/** Plis possibles dans l'état courant (ligne strictement intérieure, petite moitié sur la grande). */
export function legalFolds(s: FoldState, maxFolds = Infinity): Fold[] {
  const out: Fold[] = [];
  if (s.folds.length >= maxFolds) return out;
  const { x0, x1, y0, y1 } = s.bounds;
  for (let at = x0 + 1; at < x1; at++) {
    const low = at - x0;
    const high = x1 - at;
    if (low <= high) out.push({ axis: 'x', at, side: -1 });
    if (high <= low) out.push({ axis: 'x', at, side: 1 });
  }
  for (let at = y0 + 1; at < y1; at++) {
    const low = at - y0;
    const high = y1 - at;
    if (low <= high) out.push({ axis: 'y', at, side: -1 });
    if (high <= low) out.push({ axis: 'y', at, side: 1 });
  }
  return out;
}

export function isLegal(s: FoldState, f: Fold, maxFolds = Infinity): boolean {
  return legalFolds(s, maxFolds).some((g) => g.axis === f.axis && g.at === f.at && g.side === f.side);
}

/** Applique un pli (sans vérifier qu'il est permis). */
export function applyFold(s: FoldState, f: Fold): FoldState {
  const moving = (p: CellPose) => {
    const v = f.axis === 'x' ? p.x : p.y;
    return f.side === -1 ? v < f.at : v >= f.at;
  };
  let maxAll = 0;
  let maxMoving = 0;
  for (const p of s.poses) {
    maxAll = Math.max(maxAll, p.layer);
    if (moving(p)) maxMoving = Math.max(maxMoving, p.layer);
  }
  const poses = s.poses.map((p) => {
    if (!moving(p)) return p;
    const q = { ...p, flipped: !p.flipped, layer: maxAll + 1 + (maxMoving - p.layer) };
    if (f.axis === 'x') q.x = 2 * f.at - 1 - p.x;
    else q.y = 2 * f.at - 1 - p.y;
    return q;
  });
  return { folds: [...s.folds, f], poses, bounds: boundsOf(poses) };
}

export function foldSequence(p: FoldPuzzle, folds: Fold[]): FoldState {
  let s = initialFoldState(p);
  for (const f of folds) {
    if (!isLegal(s, f, p.maxFolds)) throw new Error(`${p.id} : pli interdit ${JSON.stringify(f)}`);
    s = applyFold(s, f);
  }
  return s;
}

/** Marque vers le haut d'une case selon son orientation. */
export function upMark(c: FoldCellDef, pose: CellPose): Mark {
  return pose.flipped ? c.back : c.front;
}

export interface FoldCheck {
  solved: boolean;
  /** pour chaque case : sa marque du dessus est-elle visible ? */
  visible: boolean[];
  /** marques en défaut (index de case) */
  badDots: number[];
  badStains: number[];
  badStars: number[];
}

export function checkFold(p: FoldPuzzle, s: FoldState): FoldCheck {
  const n = p.cells.length;
  // piles par position
  const stacks = new Map<string, number[]>();
  s.poses.forEach((pose, i) => {
    const k = `${pose.x},${pose.y}`;
    const st = stacks.get(k);
    if (st) st.push(i);
    else stacks.set(k, [i]);
  });
  const visible = new Array<boolean>(n).fill(false);
  for (const st of stacks.values()) {
    st.sort((a, b) => s.poses[b]!.layer - s.poses[a]!.layer); // du haut vers le bas
    for (const i of st) {
      if (p.cells[i]!.hole) continue; // on voit à travers
      visible[i] = true;
      break;
    }
  }
  // points
  const badDots: number[] = [];
  const colorPos = new Map<MarkColor, Set<string>>();
  const posColors = new Map<string, Set<MarkColor>>();
  const dotsAt: { i: number; color: MarkColor; pos: string }[] = [];
  p.cells.forEach((c, i) => {
    for (const m of [c.front, c.back]) {
      if (m.kind !== 'dot') continue;
      const pos = `${s.poses[i]!.x},${s.poses[i]!.y}`;
      dotsAt.push({ i, color: m.color, pos });
      if (!colorPos.has(m.color)) colorPos.set(m.color, new Set());
      colorPos.get(m.color)!.add(pos);
      if (!posColors.has(pos)) posColors.set(pos, new Set());
      posColors.get(pos)!.add(m.color);
    }
  });
  for (const d of dotsAt) {
    if (colorPos.get(d.color)!.size > 1 || posColors.get(d.pos)!.size > 1) badDots.push(d.i);
  }
  // taches et étoiles : visibles seulement si sur la face du dessus d'une case visible
  const badStains: number[] = [];
  const badStars: number[] = [];
  p.cells.forEach((c, i) => {
    const pose = s.poses[i]!;
    const up = upMark(c, pose);
    const down = pose.flipped ? c.front : c.back;
    const faces: [Mark, boolean][] = [[up, true], [down, false]];
    for (const [m, isUp] of faces) {
      const seen = visible[i] && isUp;
      if (m.kind === 'stain' && seen) badStains.push(i);
      if (m.kind === 'star' && !seen) badStars.push(i);
    }
  });
  const hasRule = dotsAt.length > 0 || p.cells.some((c) => c.front.kind !== 'none' || c.back.kind !== 'none');
  return {
    solved: hasRule && badDots.length === 0 && badStains.length === 0 && badStars.length === 0,
    visible,
    badDots,
    badStains,
    badStars,
  };
}

/** Clé canonique de l'état (pour le solveur). */
export function stateKey(s: FoldState): string {
  return s.poses.map((p) => `${p.x},${p.y},${p.layer},${p.flipped ? 1 : 0}`).join(';');
}

export interface FoldSolveReport {
  /** nombre minimal de plis */
  minFolds: number;
  /** une solution la plus courte */
  solution: Fold[] | null;
  /** nombre d'états finaux résolus distincts (toutes longueurs ≤ maxDepth) */
  solvedStates: number;
  /** nombre d'états explorés */
  explored: number;
}

/** Recherche en largeur sur les séquences de plis. */
export function solveFold(p: FoldPuzzle, maxDepth = p.maxFolds): FoldSolveReport {
  const start = initialFoldState(p);
  const seen = new Set<string>([stateKey(start)]);
  let frontier = [start];
  const report: FoldSolveReport = { minFolds: Infinity, solution: null, solvedStates: 0, explored: 1 };
  if (checkFold(p, start).solved) return { ...report, minFolds: 0, solution: [], solvedStates: 1 };
  for (let depth = 1; depth <= maxDepth && frontier.length; depth++) {
    const next: FoldState[] = [];
    for (const s of frontier) {
      for (const f of legalFolds(s)) {
        const t = applyFold(s, f);
        const k = stateKey(t);
        if (seen.has(k)) continue;
        seen.add(k);
        report.explored++;
        if (checkFold(p, t).solved) {
          report.solvedStates++;
          if (!report.solution) {
            report.solution = t.folds;
            report.minFolds = depth;
          }
        }
        next.push(t);
      }
    }
    frontier = next;
  }
  return report;
}
