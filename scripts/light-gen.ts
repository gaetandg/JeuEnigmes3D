/**
 * Générateur d'énigmes de lumière par construction inverse :
 * on trace des chemins de rayons au hasard (en posant des miroirs aux virages),
 * on pose les cristaux au bout, on ajoute des leurres et des cristaux noirs,
 * puis on ne garde que les grilles à solution UNIQUE où chaque pièce compte.
 *
 *   node scripts/light-gen.ts <profil> [graine] [nombre]
 *
 * Les meilleures grilles sont affichées ; on les recopie à la main dans src/puzzles/.
 */
import {
  analyze, initialState, parsePuzzle, renderAscii, stateToGrid, simulate,
} from '../src/core/light/index.ts';
import type { LightPuzzle } from '../src/core/light/index.ts';

type Elem = 'mirror' | 'fixed' | 'splitter' | 'filter' | 'dark' | 'wall' | 'prism' | 'socket';

interface Profile {
  w: number;
  h: number;
  sources: string[]; // couleurs des émetteurs, ex. ['R', 'B']
  turnsMin: number;
  turnsMax: number;
  allow: Elem[];
  decoys: number; // miroirs leurres
  darks: number;
  walls: number;
  filters: number;
  sockets?: number; // socles supplémentaires (réserve = miroirs du chemin convertis en socles)
  objects?: number; // objets en cubes posés sur des zones 3×3 vides
  socketPath?: number; // nombre de miroirs du chemin transformés en socles
  minSpace: number;
}

const PROFILES: Record<string, Profile> = {
  // couleurs + cristaux noirs
  b5: { w: 6, h: 6, sources: ['R', 'B', 'G'], turnsMin: 1, turnsMax: 3, allow: ['mirror', 'dark'], decoys: 2, darks: 2, walls: 1, filters: 0, minSpace: 64 },
  // verre : filtres + lames
  // énigmes intermédiaires (difficulté moyenne, pour lisser la courbe)
  bm: { w: 5, h: 5, sources: ['R', 'B'], turnsMin: 1, turnsMax: 2, allow: ['mirror', 'dark'], decoys: 1, darks: 1, walls: 1, filters: 0, minSpace: 16 },
  cm: { w: 6, h: 5, sources: ['W', 'B'], turnsMin: 1, turnsMax: 2, allow: ['mirror', 'splitter', 'filter', 'dark'], decoys: 1, darks: 1, walls: 1, filters: 1, minSpace: 16 },
  dm: { w: 5, h: 5, sources: ['Y'], turnsMin: 1, turnsMax: 3, allow: ['mirror', 'socket', 'dark'], decoys: 1, darks: 1, walls: 1, filters: 0, sockets: 2, socketPath: 1, minSpace: 16 },
  c3: { w: 6, h: 6, sources: ['W', 'W'], turnsMin: 1, turnsMax: 3, allow: ['mirror', 'splitter', 'filter', 'dark'], decoys: 1, darks: 1, walls: 1, filters: 2, minSpace: 64 },
  c4: { w: 7, h: 6, sources: ['W', 'Y'], turnsMin: 2, turnsMax: 3, allow: ['mirror', 'splitter', 'filter', 'dark'], decoys: 2, darks: 2, walls: 2, filters: 2, minSpace: 128 },
  // socles
  d3: { w: 6, h: 6, sources: ['R', 'G'], turnsMin: 1, turnsMax: 3, allow: ['mirror', 'socket', 'dark'], decoys: 1, darks: 2, walls: 2, filters: 0, sockets: 3, socketPath: 2, minSpace: 64 },
  // zone finale : lumière + objets en cubes
  f2: { w: 8, h: 7, sources: ['R', 'B'], turnsMin: 1, turnsMax: 2, allow: ['mirror', 'dark'], decoys: 1, darks: 2, walls: 1, filters: 0, objects: 2, minSpace: 64 },
  f3: { w: 9, h: 8, sources: ['W', 'R'], turnsMin: 1, turnsMax: 3, allow: ['mirror', 'splitter', 'filter', 'dark'], decoys: 1, darks: 2, walls: 1, filters: 1, objects: 2, minSpace: 256 },
  // grand final
  d5: { w: 7, h: 7, sources: ['W', 'R', 'B'], turnsMin: 2, turnsMax: 3, allow: ['mirror', 'splitter', 'filter', 'dark', 'prism', 'socket'], decoys: 2, darks: 2, walls: 2, filters: 1, sockets: 2, socketPath: 1, minSpace: 256 },
};

// ── aléatoire reproductible ────────────────────────────────────────────
let seed = 1;
const rnd = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 2 ** 32;
};
const pick = <T>(a: readonly T[]): T => a[Math.floor(rnd() * a.length)]!;
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];

function tryBuild(pr: Profile): string[][] | null {
  let g: string[][] = Array.from({ length: pr.h }, () => Array(pr.w).fill('.'));
  let used = new Set<string>(); // cases occupées par un chemin
  const k = (x: number, y: number) => `${x},${y}`;
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < pr.w && y < pr.h;
  let socketsLeft = pr.socketPath ?? 0;
  let inventory = 0;

  for (const col of pr.sources) {
    let ok = false;
    for (let attempt = 0; attempt < 40 && !ok; attempt++) {
      const g2 = g.map((r) => r.slice());
      const used2 = new Set(used);
      let sl = socketsLeft;
      let inv = inventory;
      ok = (() => {
        let x = 0, y = 0, d = 0;
        const side = Math.floor(rnd() * 4);
        if (side === 0) { x = Math.floor(rnd() * pr.w); y = 0; d = 2; }
        if (side === 1) { x = pr.w - 1; y = Math.floor(rnd() * pr.h); d = 3; }
        if (side === 2) { x = Math.floor(rnd() * pr.w); y = pr.h - 1; d = 0; }
        if (side === 3) { x = 0; y = Math.floor(rnd() * pr.h); d = 1; }
        if (g2[y]![x] !== '.' || used2.has(k(x, y))) return false;
        g2[y]![x] = '^>v<'[d]! + col;
        used2.add(k(x, y));
        const turns = pr.turnsMin + Math.floor(rnd() * (pr.turnsMax - pr.turnsMin + 1));
        let color = col;
        let filtersLeft = pr.filters > 0 && 'WYCM'.includes(col) ? 1 : 0;
        for (let t = 0; t <= turns; t++) {
          const len = Math.floor(rnd() * 3);
          for (let s = 0; s < len; s++) {
            x += DX[d]!; y += DY[d]!;
            if (!inside(x, y) || g2[y]![x] !== '.') return false;
            used2.add(k(x, y));
            if (filtersLeft > 0 && rnd() < 0.5) {
              const comps = { W: ['R', 'G', 'B', 'Y', 'C', 'M'], Y: ['R', 'G'], C: ['G', 'B'], M: ['R', 'B'] }[color as 'W'] ?? [];
              const f = pick(comps);
              g2[y]![x] = 'f' + f;
              color = f;
              filtersLeft--;
            }
          }
          x += DX[d]!; y += DY[d]!;
          if (!inside(x, y) || g2[y]![x] !== '.' || used2.has(k(x, y))) return false;
          used2.add(k(x, y));
          if (t === turns) {
            g2[y]![x] = 'o' + color;
            return true;
          }
          const nd = rnd() < 0.5 ? (d + 1) % 4 : (d + 3) % 4;
          const orient = [[1, 0, 3, 2], [3, 2, 1, 0]].findIndex((m) => m[d] === nd);
          const wrong = orient === 0 ? '\\' : '/';
          if (sl > 0 && pr.allow.includes('socket') && rnd() < 0.6) {
            g2[y]![x] = '_';
            sl--;
            inv++;
          } else if (pr.allow.includes('fixed') && rnd() < 0.2) {
            g2[y]![x] = orient === 0 ? '/' : '\\';
          } else if (pr.allow.includes('splitter') && rnd() < 0.25) {
            g2[y]![x] = 'S' + wrong;
          } else {
            g2[y]![x] = 'M' + wrong;
          }
          d = nd;
        }
        return true;
      })();
      if (ok) { g = g2; used = used2; socketsLeft = sl; inventory = inv; }
    }
    if (!ok) return null;
  }
  // éléments supplémentaires sur des cases libres
  const free = () => {
    for (let t = 0; t < 100; t++) {
      const x = Math.floor(rnd() * pr.w), y = Math.floor(rnd() * pr.h);
      if (g[y]![x] === '.') return [x, y] as const;
    }
    return null;
  };
  const place = (n: number, f: () => string, offPath: boolean) => {
    for (let i = 0; i < n; i++) {
      for (let t = 0; t < 30; t++) {
        const c = free();
        if (!c) return;
        if (offPath && used.has(k(c[0], c[1]))) continue;
        g[c[1]]![c[0]] = f();
        break;
      }
    }
  };
  place(pr.decoys, () => pick(['M/', 'M\\']), false);
  place(pr.darks, () => 'x', true);
  place(pr.walls, () => '#', true);
  place(pr.sockets ? pr.sockets - (pr.socketPath ?? 0) : 0, () => '_', false);
  (g as unknown as { inventory: number }).inventory = inventory;
  return g;
}

function score(p: LightPuzzle, a: ReturnType<typeof analyze>): number {
  // préfère : grand espace, beaucoup de clics, peu de cases vides
  const r = simulate(p, a.solutions[0]!);
  let lit = 0;
  for (let i = 0; i < p.cells.length; i++) if (r.halfEdges.slice(i * 4, i * 4 + 4).some((v) => v)) lit++;
  return Math.log2(a.space) * 2 + a.minClicks * 1.5 + lit / p.cells.length * 6;
}

const [profileName = 'b5', seedArg = '1', countArg = '3'] = process.argv.slice(2);
const pr = PROFILES[profileName];
if (!pr) throw new Error(`profil inconnu ; choix : ${Object.keys(PROFILES).join(', ')}`);
seed = Number(seedArg);
const found: { s: number; grid: string; inv: number; text: string }[] = [];
const stats = { built: 0, analyzed: 0 };
for (let attempt = 0; attempt < 40000 && found.length < 60; attempt++) {
  const g = tryBuild(pr);
  if (!g) continue;
  stats.built++;
  const inv = (g as unknown as { inventory: number }).inventory ?? 0;
  const grid = g.map((r) => r.join(' ')).join('\n');
  // objets en cubes sur des zones 3×3 entièrement vides
  const objects: { shape: string; at: [number, number]; axis: 'x' | 'y'; start: number }[] = [];
  const taken = new Set<string>();
  for (let o = 0; o < (pr.objects ?? 0); o++) {
    for (let t = 0; t < 60; t++) {
      const ax = Math.floor(rnd() * (pr.w - 2));
      const ay = Math.floor(rnd() * (pr.h - 2));
      let ok = true;
      for (let dy = 0; dy < 3 && ok; dy++) for (let dx = 0; dx < 3 && ok; dx++) {
        if (g[ay + dy]![ax + dx] !== '.' || taken.has(`${ax + dx},${ay + dy}`)) ok = false;
      }
      if (!ok) continue;
      for (let dy = 0; dy < 3; dy++) for (let dx = 0; dx < 3; dx++) taken.add(`${ax + dx},${ay + dy}`);
      objects.push({ shape: pick(['anneau', 'pont', 'coin', 'zigzag', 'croix', 'bras', 'T']), at: [ax, ay], axis: rnd() < 0.4 ? 'x' : 'y', start: Math.floor(rnd() * 4) });
      break;
    }
  }
  if ((pr.objects ?? 0) > objects.length) continue;
  let p: LightPuzzle;
  try {
    p = parsePuzzle({ id: 'gen', grid, inventory: inv, objects });
  } catch { continue; }
  const init = initialState(p);
  if (simulate(p, init).solved) continue;
  let a;
  try { a = analyze(p, init, 3); } catch { continue; }
  stats.analyzed++;
  const why = a.count === 0 ? "insoluble" : a.distinct > (pr.objects ? 2 : 1) ? "multi" : a.dead.length > 0 ? "dead" : a.space < pr.minSpace ? "petit" : "";
  (stats as Record<string, number>)[why || "ok"] = ((stats as Record<string, number>)[why || "ok"] ?? 0) + 1;
  if (why) continue;
  // tous les éléments demandés doivent compter : chaque cristal noir doit être « menacé »
  const s = score(p, a);
  found.push({ s, grid: stateToGrid(p, init) + (objects.length ? '\nobjets : ' + JSON.stringify(objects) : ''), inv, text: renderAscii(p, a.solutions[0]!), raw: grid, objects } as never);
}
found.sort((a, b) => b.s - a.s);
// export brut pour d'autres outils (ex. tri par difficulté) : OUT=fichier.json
if (process.env.OUT) (await import('node:fs')).writeFileSync(process.env.OUT, JSON.stringify(found));
for (const f of found.slice(0, Number(countArg))) {
  console.log(`\n── score ${f.s.toFixed(1)}  réserve ${f.inv}`);
  console.log(f.grid);
  console.log(f.text);
}
console.log(`\n${found.length} grilles valides trouvées`, stats);
