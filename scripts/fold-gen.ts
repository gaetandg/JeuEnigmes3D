/**
 * Générateur d'énigmes de pliage par construction : on plie une feuille vierge au hasard,
 * on pose les marques compatibles avec ce pliage, puis on garde les feuilles où cette
 * solution est la SEULE dans la limite de plis.
 *   node scripts/fold-gen.ts <largeur> <hauteur> <plis> [graine] [nombre] [options]
 * options : dots=2 stains=1 stars=1 holes=1 back=1 cut=1
 */
import { applyFold, checkFold, legalFolds, initialFoldState, solveFold } from '../src/core/fold/index.ts';
import type { FoldCellDef, FoldPuzzle, Mark, MarkColor } from '../src/core/fold/index.ts';

const [W = 4, H = 3, L = 3, SEED = 1, COUNT = 3] = process.argv.slice(2, 7).map(Number);
const opts = Object.fromEntries(process.argv.slice(7).map((a) => a.split('=')).map(([k, v]) => [k, Number(v)]));
const want = { dots: opts.dots ?? 2, stains: opts.stains ?? 1, stars: opts.stars ?? 1, holes: opts.holes ?? 0, back: opts.back ?? 0, cut: opts.cut ?? 0 };

let seed = SEED;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;
const NONE: Mark = { kind: 'none' };

function attempt(): FoldPuzzle | null {
  // feuille (éventuellement découpée)
  const cells: FoldCellDef[] = [];
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const corner = (x === 0 || x === W - 1) && (y === 0 || y === H - 1);
      if (want.cut && corner && rnd() < 0.5) continue;
      cells.push({ x, y, front: NONE, back: NONE, hole: false });
    }
  let p: FoldPuzzle = { id: 'gen', width: W, height: H, cells, maxFolds: L };
  // pliage au hasard
  let s = initialFoldState(p);
  for (let i = 0; i < L; i++) {
    const legal = legalFolds(s);
    if (!legal.length) return null;
    s = applyFold(s, pick(legal));
  }
  // piles finales
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
  const free = (i: number) => !used.has(i) && !cells[i]!.hole;
  // trous : le dessus d'une pile devient un trou, une étoile sur la case du dessous
  for (let h = 0; h < want.holes; h++) {
    const st = pick(sorted.filter((t) => t.length >= 2 && free(t[0]!) && free(t[1]!)));
    if (!st) return null;
    cells[st[0]!]!.hole = true;
    used.add(st[0]!);
    setFace(st[1]!, true, { kind: 'star' });
  }
  // points : deux cases d'une même pile
  const colors: MarkColor[] = ['R', 'B', 'Y', 'G'];
  for (let d = 0; d < want.dots; d++) {
    const st = pick(sorted.filter((t) => t.filter(free).length >= 2 && !t.some((i) => cells[i]!.front.kind === 'dot' || cells[i]!.back.kind === 'dot')));
    if (!st) return null;
    const [a, b] = st.filter(free).sort(() => rnd() - 0.5);
    setFace(a!, rnd() < 0.5 || !want.back, { kind: 'dot', color: colors[d]! });
    setFace(b!, rnd() < 0.5 || !want.back, { kind: 'dot', color: colors[d]! });
  }
  // étoiles : face du dessus de la case visible d'une pile
  for (let k = 0; k < want.stars; k++) {
    const st = pick(sorted.filter((t) => free(t[0]!)));
    if (!st) return null;
    setFace(st[0]!, true, { kind: 'star' });
  }
  // taches : faces cachées
  for (let k = 0; k < want.stains; k++) {
    const cand = cells.map((_, i) => i).filter((i) => free(i));
    if (!cand.length) return null;
    const i = pick(cand);
    const top = sorted.find((t) => t.includes(i))![0] === i;
    if (top) setFace(i, false, { kind: 'stain' });
    else setFace(i, rnd() < 0.5, { kind: 'stain' });
  }
  p = { ...p, cells };
  if (!checkFold(p, s).solved) return null;
  return p;
}

function toGrid(p: FoldPuzzle): string {
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
    rows.push(r.map((t) => t.padEnd(2)).join(' '));
  }
  return rows.join('\n');
}

const found: { score: number; grid: string; explored: number }[] = [];
for (let i = 0; i < 20000 && found.length < 40; i++) {
  const p = attempt();
  if (!p) continue;
  const r = solveFold(p);
  if (r.minFolds !== L || r.solvedStates !== 1) continue;
  const grid = toGrid(p);
  if (found.some((f) => f.grid === grid)) continue;
  // score : beaucoup de choix possibles = plus difficile
  found.push({ score: r.explored, grid, explored: r.explored });
}
found.sort((a, b) => b.score - a.score);
for (const f of found.slice(0, COUNT)) console.log(`\n── états explorés ${f.explored}\n${f.grid}`);
console.log(`\n${found.length} feuilles valides`);
