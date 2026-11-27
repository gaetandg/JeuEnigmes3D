/**
 * Générateur des Racines : un arbre couvrant tiré au hasard sur la grille (chaque case est une
 * tuile), la graine sur un nœud, des cristaux sur les bouts ; on mélange les rotations et l'on
 * garde les grilles à solution unique. Affiche la grille au format texte du jeu.
 *
 *   W=4 H=4 SEED=3 TOP=1 node scripts/roots-gen.ts
 */
import { E, N, S, W as WEST, checkRoots, parseRoots, rotateMask, solveRoots } from '../src/core/roots/index.ts';

const W = Number(process.env.W ?? 4);
const H = Number(process.env.H ?? 4);
let seed = Number(process.env.SEED ?? 1);
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const BITS = [N, E, S, WEST];
const DX = [0, 1, 0, -1];
const DY = [-1, 0, 1, 0];
const OPP = [S, WEST, N, E];

function shapeOf(m: number): { sym: string; turns: number } {
  const forms: [string, number][] = [['o', N], ['|', N | S], ['L', N | E], ['T', N | E | S], ['+', 15]];
  for (const [sym, base] of forms) for (let r = 0; r < 4; r++) if (rotateMask(base, r) === m) return { sym, turns: r };
  throw new Error('forme ' + m);
}

function attempt(): string | null {
  const n = W * H;
  const mask = new Array(n).fill(0);
  // arbre couvrant (parcours aléatoire)
  const seen = new Array(n).fill(false);
  const start = Math.floor(rnd() * n);
  seen[start] = true;
  const frontier = [start];
  while (frontier.length) {
    const k = Math.floor(rnd() * frontier.length);
    const i = frontier[k]!;
    const x = i % W;
    const y = Math.floor(i / W);
    const opts = [0, 1, 2, 3].filter((d) => {
      const nx = x + DX[d]!;
      const ny = y + DY[d]!;
      return nx >= 0 && ny >= 0 && nx < W && ny < H && !seen[ny * W + nx];
    });
    if (!opts.length) {
      frontier.splice(k, 1);
      continue;
    }
    const d = opts[Math.floor(rnd() * opts.length)]!;
    const j = (y + DY[d]!) * W + x + DX[d]!;
    seen[j] = true;
    mask[i] |= BITS[d]!;
    mask[j] |= OPP[d]!;
    frontier.push(j);
  }
  // la graine : un nœud d'au moins deux racines ; les bouts : des cristaux
  const deg = (m: number) => [N, E, S, WEST].filter((b) => m & b).length;
  const hubs = mask.map((m, i) => (deg(m) >= 2 ? i : -1)).filter((i) => i >= 0);
  const seedAt = hubs[Math.floor(rnd() * hubs.length)]!;
  const toks = mask.map((m, i) => {
    const { sym, turns } = shapeOf(m);
    if (i === seedAt) return `${sym}*${turns}`;
    // rotation de départ mélangée (différente de la solution pour les tuiles qui tournent)
    const spins = sym === '+' ? 1 : sym === '|' ? 2 : 4;
    const off = spins === 1 ? 0 : 1 + Math.floor(rnd() * (spins - 1));
    const t0 = (turns - off + 4) % 4;
    return `${sym}${deg(m) === 1 ? 'c' : ''}${t0}`;
  });
  const grid = Array.from({ length: H }, (_, y) => toks.slice(y * W, y * W + W).map((t) => t.padEnd(4)).join(' ')).join('\n');
  const { puzzle, start: st } = parseRoots({ id: 'gen', grid });
  if (checkRoots(puzzle, st).solved) return null;
  if (solveRoots(puzzle, 2).count !== 1) return null;
  return grid;
}

if (process.argv[1]?.endsWith('roots-gen.ts')) {
  let found = 0;
  for (let t = 0; t < Number(process.env.TRIES ?? 400) && found < Number(process.env.TOP ?? 1); t++) {
    const g = attempt();
    if (g) {
      console.log(g + '\n');
      found++;
    }
  }
  if (!found) console.log('rien trouvé');
}
