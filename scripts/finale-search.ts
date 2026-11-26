/**
 * Recherche de la finale du Phare : lumière + objets en cubes + manivelles couplées.
 * Sources sur les bords, trois objets dans des boîtes 3×3, éventuellement des miroirs fixes ;
 * les cristaux sont posés sur le pourtour, par construction, jusqu'à ce que la solution choisie
 * soit la seule (à empreinte près). On garde les grilles dont le plus court chemin aux manivelles
 * est long et où l'agent glouton échoue.
 *
 *   TRIES=400 MINLEN=5 node scripts/finale-search.ts
 */
import { blockedCells, initialState, objectPath, parsePuzzle, simulate, solve } from '../src/core/light/index.ts';
import type { LightPuzzleDef } from '../src/core/light/index.ts';
import { SHAPES } from '../src/core/shadow/index.ts';
import { greedyLight } from './greedy.ts';

let seed = Number(process.env.SEED ?? 11);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const pick = <T>(a: readonly T[]) => a[Math.floor(rnd() * a.length)]!;
const W = Number(process.env.W ?? 9);
const H = Number(process.env.H ?? 7);
const CRANKS = [[0, 1], [1, 2], [2]];
const shapes = Object.keys(SHAPES).filter((s) => s !== 'marche'); // la marche couvre tout le sol

const why: Record<string, number> = {};
const fail = (k: string) => {
  why[k] = (why[k] ?? 0) + 1;
  return null;
};

function attempt(): { def: LightPuzzleDef; len: number; ins: number } | null {
  const g: string[][] = Array.from({ length: H }, () => Array.from({ length: W }, () => '.'));
  // trois boîtes d'objets sans chevauchement, à l'intérieur (pas sur le pourtour)
  const boxes: [number, number][] = [];
  for (let t = 0; boxes.length < 3 && t < 200; t++) {
    const ax = 1 + Math.floor(rnd() * (W - 4));
    const ay = Math.floor(rnd() * (H - 2));
    if (boxes.some(([bx, by]) => Math.abs(bx - ax) < 3 && Math.abs(by - ay) < 3)) continue;
    boxes.push([ax, ay]);
  }
  if (boxes.length < 3) return fail('boîtes');
  boxes.sort((a, b) => a[0] - b[0] || a[1] - b[1]); // de gauche à droite (comme les manivelles)
  const inBox = (x: number, y: number) => boxes.some(([bx, by]) => x >= bx && x < bx + 3 && y >= by && y < by + 3);
  // sources : à gauche (vers l'est) ou en haut (vers le sud)
  const colors = pick([['R', 'G', 'B', 'W'], ['W', 'R', 'B', 'G'], ['R', 'G', 'B', 'Y', 'C']]);
  for (const c of colors) {
    for (let t = 0; t < 50; t++) {
      // le rayon traverse au moins une boîte : rangée ou colonne d'une boîte au hasard
      const [bx, by] = pick(boxes);
      const left = rnd() < 0.6 || by === 0;
      const x = left ? 0 : bx + Math.floor(rnd() * 3);
      const y = left ? by + Math.floor(rnd() * 3) : 0;
      if (g[y]![x] !== '.' || inBox(x, y)) continue;
      g[y]![x] = (left ? '>' : 'v') + c;
      break;
    }
  }
  // un ou deux miroirs fixes / lames, hors des boîtes et hors du pourtour
  const extras = 1 + Math.floor(rnd() * 3);
  for (let e = 0; e < extras; e++) {
    const x = 1 + Math.floor(rnd() * (W - 2));
    const y = 1 + Math.floor(rnd() * (H - 2));
    if (g[y]![x] !== '.' || inBox(x, y)) continue;
    g[y]![x] = pick(['/', '\\', 's/', 's\\']);
  }
  const objects = boxes.map(([ax, ay]) => ({ shape: pick(shapes), at: [ax, ay] as [number, number], axis: (rnd() < 0.6 ? 'y' : 'x') as 'x' | 'y', start: 0 }));
  // solution : l'état qui laisse arriver le plus de lumière au pourtour (de belles cibles)
  let sol = objects.map(() => Math.floor(rnd() * 4));
  {
    const p0 = parsePuzzle({ id: 'f', grid: g.map((r) => r.map((c) => c.padEnd(2)).join(' ')).join('\n'), objects, cranks: CRANKS });
    let bestLit = -1;
    for (let a = 0; a < 64; a++) {
      const st = [a >> 4, (a >> 2) & 3, a & 3];
      const rr = simulate(p0, st);
      let lit = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && rr.received[y * W + x] && !inBox(x, y)) lit++;
      lit += rnd() * 0.9; // départage au hasard
      if (lit > bestLit) {
        bestLit = lit;
        sol = st;
      }
    }
  }
  const text = () => g.map((r) => r.map((c) => c.padEnd(2)).join(' ')).join('\n');
  const all: number[][] = [];
  for (let a = 0; a < 64; a++) all.push([a >> 4, (a >> 2) & 3, a & 3]);
  // pose des cristaux sur le pourtour jusqu'à l'unicité
  const border: [number, number][] = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ((x === 0 || y === 0 || x === W - 1 || y === H - 1) && g[y]![x] === '.' && !inBox(x, y)) border.push([x, y]);
  for (let step = 0; step < 8; step++) {
    const def: LightPuzzleDef = { id: 'f', grid: text(), objects, cranks: CRANKS };
    const p = parsePuzzle(def);
    const base = p.interactive.length; // 0 ici : pas de cases manipulables
    const res = all.map((s) => simulate(p, [...new Array(base).fill(0), ...s]));
    const solR = res[all.findIndex((s) => s.join() === sol.join())]!;
    // états encore compatibles avec les cristaux posés et différents de la solution
    // (deux états de même empreinte au sol sont équivalents : on ne cherche pas à les séparer)
    const solFoot = blockedCells(p, sol).join('');
    const compatible = all.filter((s, i) => blockedCells(p, s).join('') !== solFoot && res[i]!.crystals.every((c) => c.received === solR.crystals.find((d) => d.index === c.index)!.received));
    if (step > 0 && compatible.length === 0) break;
    let best: [number, number] | null = null;
    let bestKill = 0;
    for (const [x, y] of border) {
      if (g[y]![x] !== '.') continue;
      const i = y * W + x;
      const want = solR.received[i]!;
      const kill = compatible.filter((s) => res[all.indexOf(s)]!.received[i] !== want).length;
      if (kill > bestKill) {
        bestKill = kill;
        best = [x, y];
      }
    }
    if (!best) break; // plus rien à séparer : les états restants donnent la même lumière
    const want = solR.received[best[1] * W + best[0]]!;
    g[best[1]]![best[0]] = want ? 'o' + ({ 1: 'R', 2: 'G', 3: 'Y', 4: 'B', 5: 'M', 6: 'C', 7: 'W' } as Record<number, string>)[want]! : 'x';
  }
  const def: LightPuzzleDef = { id: 'f', grid: text(), objects, cranks: CRANKS };
  const p = parsePuzzle(def);
  if (!p.cells.some((c) => c.kind === 'target')) return fail('pas de cible');
  const r = solve(p, { keep: 100 });
  if (r.count < 1) return fail('insoluble');
  if (r.count > Number(process.env.MAXSOL ?? 4)) return fail('trop de solutions');
  // chaque objet compte : le tourner seul défait chaque solution
  for (const sol2 of r.solutions) {
    for (let j = 0; j < 3; j++) {
      const breaks = [1, 2, 3].some((d) => {
        const t = sol2.slice();
        t[j] = (t[j]! + d) % 4;
        return !simulate(p, t).solved;
      });
      if (!breaks) return fail('objet inutile');
    }
  }
  // départ : le plus loin possible (en gestes de manivelle) de toutes les solutions
  let bestStart: number[] | null = null;
  let bestLen = -1;
  for (const s of all) {
    if (simulate(p, s).solved) continue;
    const len = Math.min(...r.solutions.map((x) => objectPath(p, s, x)?.length ?? Infinity));
    if (len > bestLen && len <= Number(process.env.MAXLEN ?? 6)) {
      bestLen = len;
      bestStart = s;
    }
  }
  if (!bestStart || bestLen < Number(process.env.MINLEN ?? 5)) return fail('trop court ' + bestLen);
  objects.forEach((o, j) => (o.start = bestStart![j]!));
  const p2 = parsePuzzle(def);
  const ins = Math.round((1 - greedyLight(p2, initialState(p2))) * 100);
  const nCrystals = p2.cells.filter((c) => c.kind === 'target' || c.kind === 'dark').length;
  if (nCrystals > Number(process.env.MAXCRYS ?? 7)) return fail('trop de cristaux');
  if (process.env.REQX && !p2.cells.some((c) => c.kind === 'dark')) return fail('pas de cristal noir');
  return { def, len: bestLen, ins };
}

const found: { def: LightPuzzleDef; len: number; ins: number }[] = [];
for (let t = 0; t < Number(process.env.TRIES ?? 300); t++) {
  const r = attempt();
  if (r) found.push(r);
}
found.sort((a, b) => b.ins - a.ins || b.len - a.len);
for (const f of found.slice(0, Number(process.env.TOP ?? 4))) {
  console.log(`déclic ${f.ins} %  gestes ${f.len}  solutions ${solve(parsePuzzle(f.def)).count}`);
  console.log(JSON.stringify(f.def.objects));
  console.log(f.def.grid + '\n');
}
console.log('trouvés', found.length, JSON.stringify(why));
