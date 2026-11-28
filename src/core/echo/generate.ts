/**
 * La Grotte des Échos : des énigmes tirées au hasard, sans fin, une par langage, à trois tailles.
 * Chaque générateur construit une énigme à rebours (on part d'une solution), puis le solveur du
 * langage la valide : elle a une solution (souvent unique), et le nombre de gestes voulu.
 *
 * Tout est pur (aucun Three.js) : ça tourne dans un Worker, et dans les tests.
 */
import { E, N, S, W as WEST, checkRoots, parseRoots, rotateMask, solveRoots, undecided } from '../roots/index.ts';
import type { RootPuzzleDef } from '../roots/index.ts';
import { allMoves, isSolved as vasesSolved, parseVases, pour, solveVases } from '../vases/index.ts';
import type { VasePuzzle, VasePuzzleDef, VaseState } from '../vases/index.ts';
import { parseTilt, solveTilt } from '../tilt/index.ts';
import type { TiltPuzzleDef } from '../tilt/index.ts';
import { applyFold, checkFold, initialFoldState, legalFolds, solveFold } from '../fold/index.ts';
import type { FoldCellDef, FoldPuzzle, FoldPuzzleDef, Mark, MarkColor } from '../fold/index.ts';
import { analyze, initialState, parsePuzzle, simulate, stateToGrid } from '../light/index.ts';
import type { LightPuzzleDef } from '../light/index.ts';
import { SHAPES, checkShadow, parseShadow, shadowSearch, solveShadow, startState } from '../shadow/index.ts';
import type { ShadowObjectDef, ShadowPuzzleDef, Wall } from '../shadow/index.ts';

export type Rng = () => number;
/** 0 : petite ; 1 : moyenne ; 2 : grande */
export type Tier = 0 | 1 | 2;

/** Aléatoire reproductible (même graine, même énigme) ; deux graines voisines divergent aussitôt. */
export function rngFrom(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    // mulberry32
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const ri = (rnd: Rng, a: number, b: number) => a + Math.floor(rnd() * (b - a + 1));
const pick = <T>(rnd: Rng, a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;

// ── Racines ───────────────────────────────────────────────────────────────

const ROOT_TIERS = [
  { w: 3, h: 3, colors: 1, holes: 0, minHard: 0 },
  { w: 4, h: 4, colors: 1, holes: 1, minHard: 5 },
  { w: 5, h: 4, colors: 2, holes: 1, minHard: 8 },
] as const;

function rootShape(m: number): { sym: string; turns: number } {
  const forms: [string, number][] = [['o', N], ['|', N | S], ['L', N | E], ['T', N | E | S], ['+', 15]];
  for (const [sym, base] of forms) for (let r = 0; r < 4; r++) if (rotateMask(base, r) === m) return { sym, turns: r };
  throw new Error('forme ' + m);
}

/** Un arbre couvrant au hasard (une forêt, une couleur par graine), les rotations mélangées. */
export function generateRoots(rnd: Rng, tier: Tier): RootPuzzleDef | null {
  const { w: W, h: H, colors, holes, minHard } = ROOT_TIERS[tier];
  const BITS = [N, E, S, WEST];
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  const OPP = [S, WEST, N, E];
  const n = W * H;
  const mask = new Array<number>(n).fill(0);
  const hole = new Array<boolean>(n).fill(false);
  for (let k = 0; k < holes; k++) hole[Math.floor(rnd() * n)] = true;
  const owner = new Array<number>(n).fill(-1);
  const roots: number[] = [];
  const frontier: number[] = [];
  for (let c = 0; c < colors; c++) {
    let r = -1;
    for (let t = 0; t < 50 && r < 0; t++) {
      const i = Math.floor(rnd() * n);
      if (!hole[i] && owner[i] === -1) r = i;
    }
    if (r < 0) return null;
    owner[r] = c;
    roots.push(r);
    frontier.push(r);
  }
  while (frontier.length) {
    const k = Math.floor(rnd() * frontier.length);
    const i = frontier[k]!;
    const x = i % W;
    const y = Math.floor(i / W);
    const opts = [0, 1, 2, 3].filter((d) => {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) return false;
      const j = ny * W + nx;
      return !hole[j] && owner[j] === -1;
    });
    if (!opts.length) {
      frontier.splice(k, 1);
      continue;
    }
    const d = opts[Math.floor(rnd() * opts.length)]!;
    const j = (y + DY[d]!) * W + x + DX[d]!;
    owner[j] = owner[i]!;
    mask[i] |= BITS[d]!;
    mask[j] |= OPP[d]!;
    frontier.push(j);
  }
  if (owner.some((o, i) => o === -1 && !hole[i])) return null;
  const deg = (m: number) => BITS.filter((b) => m & b).length;
  if (roots.some((r) => deg(mask[r]!) === 0)) return null;
  const toks = mask.map((m, i) => {
    if (hole[i]) return '.';
    const { sym, turns } = rootShape(m);
    const blue = owner[i] === 1 ? 'b' : '';
    if (roots.includes(i)) return `${sym}*${blue}${turns}`;
    const spins = sym === '+' ? 1 : sym === '|' ? 2 : 4;
    const off = spins === 1 ? 0 : 1 + Math.floor(rnd() * (spins - 1));
    const t0 = (turns - off + 4) % 4;
    return deg(m) === 1 ? `${sym}c${blue}${t0}` : `${sym}${t0}`;
  });
  const grid = Array.from({ length: H }, (_, y) => toks.slice(y * W, y * W + W).join(' ')).join('\n');
  const def: RootPuzzleDef = { id: 'echo-racines', grid };
  const { puzzle, start } = parseRoots(def);
  if (checkRoots(puzzle, start).solved) return null;
  if (undecided(puzzle) < minHard) return null;
  if (solveRoots(puzzle, 2).count !== 1) return null;
  return def;
}

// ── Vases ─────────────────────────────────────────────────────────────────

const VASE_TIERS = [
  { n: [2, 3], caps: [3, 8], pipes: 'chain', oneWay: 0, rings: 1, moves: [2, 4] },
  { n: [3, 3], caps: [3, 11], pipes: 'full', oneWay: 0, rings: 1, moves: [5, 7] },
  { n: [3, 4], caps: [4, 13], pipes: 'full', oneWay: 1, rings: 1, moves: [8, 12] },
] as const;

/** Des tubes et des tuyaux au hasard ; la cible est un état qu'on n'atteint qu'en N gestes. */
export function generateVases(rnd: Rng, tier: Tier): VasePuzzleDef | null {
  const T = VASE_TIERS[tier];
  const n = ri(rnd, T.n[0], T.n[1]);
  const caps = Array.from({ length: n }, () => ri(rnd, T.caps[0], T.caps[1]));
  const start = caps.map(() => 0);
  const full = ri(rnd, 1, Math.max(1, n - 2));
  for (let k = 0; k < full; k++) start[ri(rnd, 0, n - 1)] = caps[ri(rnd, 0, n - 1)]!;
  start.forEach((v, i) => (start[i] = Math.min(v, caps[i]!)));
  if (start.every((v) => v === 0)) return null;
  const pairs: [number, number][] = [];
  if (T.pipes === 'chain') for (let i = 0; i + 1 < n; i++) pairs.push([i, i + 1]);
  else for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) pairs.push([i, j]);
  const oneWay = new Set<number>();
  while (oneWay.size < Math.min(T.oneWay, pairs.length)) oneWay.add(ri(rnd, 0, pairs.length - 1));
  const pipes = pairs.map(([a, b], k) => (oneWay.has(k) ? (rnd() < 0.5 ? `${a}>${b}` : `${b}>${a}`) : `${a}-${b}`)).join(' ');
  const base: VasePuzzle = parseVases({ id: 'echo-vases', caps, start, targets: caps.map(() => null), pipes });
  // les états atteignables et leur profondeur
  const depth = new Map<string, number>([[start.join(','), 0]]);
  const queue: VaseState[] = [start];
  for (let h = 0; h < queue.length; h++) {
    for (const m of allMoves(base)) {
      const nx = pour(base, queue[h]!, m);
      if (nx && !depth.has(nx.join(','))) {
        depth.set(nx.join(','), depth.get(queue[h]!.join(','))! + 1);
        queue.push(nx);
      }
    }
  }
  const deep = queue.filter((s) => {
    const d = depth.get(s.join(','))!;
    return d >= T.moves[0] && d <= T.moves[1];
  });
  if (!deep.length) return null;
  const goal = pick(rnd, deep);
  const idx = Array.from({ length: n }, (_, i) => i).sort(() => rnd() - 0.5).slice(0, T.rings);
  const targets = caps.map((_, i) => (idx.includes(i) ? goal[i]! : null));
  // pas d'anneau tout en haut ni tout en bas (trop évident), ni déjà atteint
  if (idx.some((i) => targets[i] === 0 || targets[i] === caps[i] || targets[i] === start[i])) return null;
  const def: VasePuzzleDef = { id: 'echo-vases', caps, start, targets, pipes };
  const p = parseVases(def);
  if (vasesSolved(p, p.start)) return null;
  const r = solveVases(p);
  if (r.minMoves === null || r.minMoves < T.moves[0] || r.minMoves > T.moves[1]) return null;
  return def;
}

// ── Inclinaison ───────────────────────────────────────────────────────────

const TILT_TIERS = [
  { w: 4, h: 4, balls: ['R'], walls: 2, pits: 0, moves: [2, 4] },
  { w: 5, h: 5, balls: ['R', 'B'], walls: 4, pits: 1, moves: [4, 6] },
  { w: 6, h: 5, balls: ['R', 'B', 'G'], walls: 5, pits: 1, moves: [6, 9] },
] as const;

/** Murs, puits, billes et creux au hasard ; gardé si soluble en N gestes. */
export function generateTilt(rnd: Rng, tier: Tier): TiltPuzzleDef | null {
  const T = TILT_TIERS[tier];
  const g: string[][] = Array.from({ length: T.h }, () => Array.from({ length: T.w }, () => '.'));
  const free = () => {
    for (let t = 0; t < 100; t++) {
      const x = Math.floor(rnd() * T.w);
      const y = Math.floor(rnd() * T.h);
      if (g[y]![x] === '.') return [x, y] as const;
    }
    return null;
  };
  for (let i = 0; i < T.walls; i++) {
    const c = free();
    if (c) g[c[1]]![c[0]] = '#';
  }
  for (let i = 0; i < T.pits; i++) {
    const c = free();
    if (c) g[c[1]]![c[0]] = 'x';
  }
  for (const b of T.balls) {
    const c = free();
    if (!c) return null;
    g[c[1]]![c[0]] = 'o' + b;
  }
  for (const b of T.balls) {
    const c = free();
    if (!c) return null;
    g[c[1]]![c[0]] = b;
  }
  const def: TiltPuzzleDef = { id: 'echo-inclinaison', grid: g.map((r) => r.join(' ')).join('\n') };
  const r = solveTilt(parseTilt(def));
  if (r.minMoves === null || r.minMoves < T.moves[0] || r.minMoves > T.moves[1]) return null;
  return def;
}

// ── Pliage ────────────────────────────────────────────────────────────────

const FOLD_TIERS = [
  { w: 4, h: 1, folds: 1, dots: 1, stains: 1, stars: 0, holes: 0, back: 0 },
  { w: 4, h: 2, folds: 2, dots: 2, stains: 1, stars: 1, holes: 0, back: 1 },
  { w: 4, h: 3, folds: 3, dots: 2, stains: 1, stars: 1, holes: 1, back: 1 },
] as const;

/** On plie une feuille vierge au hasard, on pose des marques qui vont avec, et l'on garde les
 * feuilles où ce pliage est le SEUL qui marche, dans la limite de plis. */
export function generateFold(rnd: Rng, tier: Tier): FoldPuzzleDef | null {
  const T = FOLD_TIERS[tier];
  const NONE: Mark = { kind: 'none' };
  const cells: FoldCellDef[] = [];
  for (let y = 0; y < T.h; y++) for (let x = 0; x < T.w; x++) cells.push({ x, y, front: NONE, back: NONE, hole: false });
  let p: FoldPuzzle = { id: 'echo-pliage', width: T.w, height: T.h, cells, maxFolds: T.folds };
  let s = initialFoldState(p);
  for (let i = 0; i < T.folds; i++) {
    const legal = legalFolds(s);
    if (!legal.length) return null;
    s = applyFold(s, pick(rnd, legal));
  }
  const stacks = new Map<string, number[]>();
  s.poses.forEach((q, i) => {
    const k = `${q.x},${q.y}`;
    stacks.set(k, [...(stacks.get(k) ?? []), i]);
  });
  const sorted = [...stacks.values()].map((st) => st.sort((a, b) => s.poses[b]!.layer - s.poses[a]!.layer));
  const used = new Set<number>();
  const setFace = (i: number, up: boolean, m: Mark) => {
    const c = cells[i]!;
    const front = s.poses[i]!.flipped ? !up : up;
    if (front) c.front = m;
    else c.back = m;
    used.add(i);
  };
  const isFree = (i: number) => !used.has(i) && !cells[i]!.hole;
  for (let h = 0; h < T.holes; h++) {
    const cand = sorted.filter((t) => t.length >= 2 && isFree(t[0]!) && isFree(t[1]!));
    if (!cand.length) return null;
    const st = pick(rnd, cand);
    cells[st[0]!]!.hole = true;
    used.add(st[0]!);
    setFace(st[1]!, true, { kind: 'star' });
  }
  const colors: MarkColor[] = ['R', 'B', 'Y', 'G'];
  for (let d = 0; d < T.dots; d++) {
    const cand = sorted.filter((t) => t.filter(isFree).length >= 2);
    if (!cand.length) return null;
    const st = pick(rnd, cand);
    const [a, b] = st.filter(isFree).sort(() => rnd() - 0.5);
    setFace(a!, rnd() < 0.5 || !T.back, { kind: 'dot', color: colors[d]! });
    setFace(b!, rnd() < 0.5 || !T.back, { kind: 'dot', color: colors[d]! });
  }
  for (let k = 0; k < T.stars; k++) {
    const cand = sorted.filter((t) => isFree(t[0]!));
    if (!cand.length) return null;
    setFace(pick(rnd, cand)[0]!, true, { kind: 'star' });
  }
  for (let k = 0; k < T.stains; k++) {
    const cand = cells.map((_, i) => i).filter(isFree);
    if (!cand.length) return null;
    const i = pick(rnd, cand);
    const top = sorted.find((t) => t.includes(i))![0] === i;
    setFace(i, top ? false : rnd() < 0.5, { kind: 'stain' });
  }
  p = { ...p, cells };
  if (!checkFold(p, s).solved) return null;
  const r = solveFold(p);
  if (r.minFolds !== T.folds || r.solvedStates !== 1) return null;
  return { id: 'echo-pliage', note: '', folds: T.folds, grid: foldGrid(p) };
}

function foldGrid(p: FoldPuzzle): string {
  const tok = (m: Mark) => (m.kind === 'dot' ? m.color : m.kind === 'stain' ? 's' : m.kind === 'star' ? '*' : '.');
  const rows: string[] = [];
  for (let y = 0; y < p.height; y++) {
    const r: string[] = [];
    for (let x = 0; x < p.width; x++) {
      const c = p.cells.find((e) => e.x === x && e.y === y);
      if (!c) r.push('_');
      else if (c.hole) r.push('O');
      else r.push(c.back.kind === 'none' ? tok(c.front) : tok(c.front) + tok(c.back));
    }
    rows.push(r.join(' '));
  }
  return rows.join('\n');
}


// ── Lumière ───────────────────────────────────────────────────────────────

interface LightTier {
  w: number;
  h: number;
  sources: string[];
  turns: [number, number];
  splitters: boolean;
  filters: number;
  decoys: number;
  darks: number;
  walls: number;
  minSpace: number;
}

const LIGHT_TIERS: LightTier[] = [
  { w: 4, h: 4, sources: ['Y'], turns: [1, 2], splitters: false, filters: 0, decoys: 0, darks: 0, walls: 1, minSpace: 4 },
  { w: 5, h: 5, sources: ['R', 'B'], turns: [1, 2], splitters: false, filters: 0, decoys: 1, darks: 1, walls: 1, minSpace: 16 },
  { w: 6, h: 6, sources: ['W', 'W'], turns: [1, 3], splitters: true, filters: 2, decoys: 1, darks: 1, walls: 1, minSpace: 64 },
];

/**
 * À rebours : des chemins de rayons au hasard depuis le bord (un miroir à chaque virage, posé dans
 * le mauvais sens), un cristal au bout, puis des leurres, des cristaux noirs et des blocs ; on ne
 * garde que les grilles à solution UNIQUE où chaque pièce compte.
 */
export function generateLight(rnd: Rng, tier: Tier): LightPuzzleDef | null {
  const pr = LIGHT_TIERS[tier]!;
  const DX = [0, 1, 0, -1];
  const DY = [-1, 0, 1, 0];
  let g: string[][] = Array.from({ length: pr.h }, () => Array<string>(pr.w).fill('.'));
  let used = new Set<string>();
  const key = (x: number, y: number) => `${x},${y}`;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < pr.w && y < pr.h;
  for (const col of pr.sources) {
    let ok = false;
    for (let attempt = 0; attempt < 40 && !ok; attempt++) {
      const g2 = g.map((r) => r.slice());
      const used2 = new Set(used);
      ok = (() => {
        let x = 0;
        let y = 0;
        let d = 0;
        const side = Math.floor(rnd() * 4);
        if (side === 0) [x, y, d] = [Math.floor(rnd() * pr.w), 0, 2];
        if (side === 1) [x, y, d] = [pr.w - 1, Math.floor(rnd() * pr.h), 3];
        if (side === 2) [x, y, d] = [Math.floor(rnd() * pr.w), pr.h - 1, 0];
        if (side === 3) [x, y, d] = [0, Math.floor(rnd() * pr.h), 1];
        if (g2[y]![x] !== '.' || used2.has(key(x, y))) return false;
        g2[y]![x] = '^>v<'[d]! + col;
        used2.add(key(x, y));
        const turns = ri(rnd, pr.turns[0], pr.turns[1]);
        let color = col;
        let filtersLeft = pr.filters > 0 && 'WYCM'.includes(col) ? 1 : 0;
        for (let t = 0; t <= turns; t++) {
          const len = Math.floor(rnd() * 3);
          for (let s = 0; s < len; s++) {
            x += DX[d]!;
            y += DY[d]!;
            if (!inside(x, y) || g2[y]![x] !== '.') return false;
            used2.add(key(x, y));
            if (filtersLeft > 0 && rnd() < 0.5) {
              const comps = ({ W: ['R', 'G', 'B', 'Y', 'C', 'M'], Y: ['R', 'G'], C: ['G', 'B'], M: ['R', 'B'] } as Record<string, string[]>)[color] ?? [];
              const f = pick(rnd, comps);
              g2[y]![x] = 'f' + f;
              color = f;
              filtersLeft--;
            }
          }
          x += DX[d]!;
          y += DY[d]!;
          if (!inside(x, y) || g2[y]![x] !== '.' || used2.has(key(x, y))) return false;
          used2.add(key(x, y));
          if (t === turns) {
            g2[y]![x] = 'o' + color;
            return true;
          }
          const nd = rnd() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
          const orient = [[1, 0, 3, 2], [3, 2, 1, 0]].findIndex((m) => m[d] === nd);
          const wrong = orient === 0 ? '\\' : '/';
          g2[y]![x] = (pr.splitters && rnd() < 0.25 ? 'S' : 'M') + wrong;
          d = nd;
        }
        return true;
      })();
      if (ok) {
        g = g2;
        used = used2;
      }
    }
    if (!ok) return null;
  }
  const free = () => {
    for (let t = 0; t < 100; t++) {
      const x = Math.floor(rnd() * pr.w);
      const y = Math.floor(rnd() * pr.h);
      if (g[y]![x] === '.') return [x, y] as const;
    }
    return null;
  };
  const place = (n: number, f: () => string, offPath: boolean) => {
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 30; t++) {
        const c = free();
        if (!c) return;
        if (offPath && used.has(key(c[0], c[1]))) continue;
        g[c[1]]![c[0]] = f();
        break;
      }
    }
  };
  place(pr.decoys, () => pick(rnd, ['M/', 'M\\']), false);
  place(pr.darks, () => 'x', true);
  place(pr.walls, () => '#', true);
  const grid = g.map((r) => r.join(' ')).join('\n');
  let p;
  try {
    p = parsePuzzle({ id: 'echo-lumiere', grid });
  } catch {
    return null;
  }
  const init = initialState(p);
  if (simulate(p, init).solved) return null;
  let a;
  try {
    a = analyze(p, init, 3);
  } catch {
    return null;
  }
  if (a.count === 0 || a.distinct > 1 || a.dead.length > 0 || a.space < pr.minSpace) return null;
  return { id: 'echo-lumiere', grid: stateToGrid(p, init) };
}


// ── Ombres ────────────────────────────────────────────────────────────────

const SHADOW_TIERS = [
  { slots: [[0, 0]] as [number, number][], walls: [['back'], ['right']] as Wall[][], minPath: 1 },
  { slots: [[0, 0], [1, 0]] as [number, number][], walls: [['back', 'right']] as Wall[][], minPath: 2 },
  { slots: [[0, 0], [1, 0], [2, 0]] as [number, number][], walls: [['back', 'right']] as Wall[][], minPath: 4 },
];

/** Des formes au hasard, une orientation-solution au hasard (les silhouettes en découlent), un
 * départ mélangé ; on ne garde que les scènes où cette orientation est la SEULE qui convient. */
export function generateShadow(rnd: Rng, tier: Tier): ShadowPuzzleDef | null {
  const T = SHADOW_TIERS[tier]!;
  const shapes = Object.keys(SHAPES);
  const objects: ShadowObjectDef[] = T.slots.map((slot) => {
    const solution = Math.floor(rnd() * 4);
    return { shape: pick(rnd, shapes), slot, axis: rnd() < 0.35 ? 'x' : 'y', solution, start: (solution + 1 + Math.floor(rnd() * 3)) % 4 };
  });
  const def: ShadowPuzzleDef = { id: 'echo-ombres', note: '', walls: pick(rnd, T.walls), objects };
  let p;
  try {
    p = parseShadow(def);
  } catch {
    return null;
  }
  if (checkShadow(p, startState(def)).solved) return null;
  if (solveShadow(p).count !== 1) return null;
  const path = shadowSearch(p, startState(def)).path;
  if (!path || path.length < T.minPath) return null;
  return def;
}

// ── l'appel commun ────────────────────────────────────────────────────────

export type EchoKind = 'lumiere' | 'pliage' | 'ombres' | 'inclinaison' | 'racines' | 'vases';

export type EchoDef =
  | { kind: 'racines'; def: RootPuzzleDef }
  | { kind: 'vases'; def: VasePuzzleDef }
  | { kind: 'inclinaison'; def: TiltPuzzleDef }
  | { kind: 'pliage'; def: FoldPuzzleDef }
  | { kind: 'lumiere'; def: LightPuzzleDef }
  | { kind: 'ombres'; def: ShadowPuzzleDef };

const GENERATORS = {
  racines: generateRoots,
  vases: generateVases,
  inclinaison: generateTilt,
  pliage: generateFold,
  lumiere: generateLight,
  ombres: generateShadow,
} as const;

/**
 * Une énigme du langage `kind`, à la taille `tier`, à partir de la graine `seed` : on tire
 * jusqu'à en trouver une bonne (au plus `tries` essais). null : aucune trouvée (très rare).
 */
export function generateEcho(kind: EchoKind, tier: Tier, seed: number, tries = 3000): EchoDef | null {
  const rnd = rngFrom(seed);
  const gen = GENERATORS[kind] as (r: Rng, t: Tier) => EchoDef['def'] | null;
  for (let t = 0; t < tries; t++) {
    const def = gen(rnd, tier);
    if (def) return { kind, def } as EchoDef;
  }
  return null;
}
