/**
 * Générateur des Racines : un arbre couvrant tiré au hasard sur la grille (chaque case est une
 * tuile), la graine sur un nœud, des cristaux sur les bouts ; on mélange les rotations et l'on
 * garde les grilles à solution unique. Affiche la grille au format texte du jeu.
 *
 *   W=4 H=4 SEED=3 TOP=1 node scripts/roots-gen.ts
 *   COLORS=2 (deux graines, or et bleue), HOLES=2 (trous), MINHARD=6 (difficulté minimale :
 *   tuiles que la déduction locale ne fixe pas), TRIES=4000
 */
import { E, N, S, W as WEST, checkRoots, parseRoots, rotateMask, solveRoots, undecided } from '../src/core/roots/index.ts';

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

const COLORS = Number(process.env.COLORS ?? 1);
const HOLES = Number(process.env.HOLES ?? 0);
/** tuiles qui tournent et que la déduction locale ne fixe pas (au moins) */
const MINHARD = Number(process.env.MINHARD ?? 0);

function attempt(): { grid: string; hard: number } | null {
  const n = W * H;
  const mask = new Array(n).fill(0);
  const hole = new Array(n).fill(false);
  for (let k = 0; k < HOLES; k++) hole[Math.floor(rnd() * n)] = true;
  // une forêt couvrante : un arbre par couleur, qui poussent ensemble (Prim aléatoire)
  const owner = new Array<number>(n).fill(-1);
  const roots: number[] = [];
  const frontier: number[] = [];
  for (let c = 0; c < COLORS; c++) {
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
  // toutes les cases (hors trous) doivent appartenir à un réseau
  if (owner.some((o, i) => o === -1 && !hole[i])) return null;
  const deg = (m: number) => [N, E, S, WEST].filter((b) => m & b).length;
  if (roots.some((r) => deg(mask[r]!) === 0)) return null;
  const toks = mask.map((m, i) => {
    if (hole[i]) return '.';
    const { sym, turns } = shapeOf(m);
    const blue = owner[i] === 1 ? 'b' : '';
    if (roots.includes(i)) return `${sym}*${blue}${turns}`;
    // rotation de départ mélangée (différente de la solution pour les tuiles qui tournent)
    const spins = sym === '+' ? 1 : sym === '|' ? 2 : 4;
    const off = spins === 1 ? 0 : 1 + Math.floor(rnd() * (spins - 1));
    const t0 = (turns - off + 4) % 4;
    return deg(m) === 1 ? `${sym}c${blue}${t0}` : `${sym}${t0}`;
  });
  const grid = Array.from({ length: H }, (_, y) => toks.slice(y * W, y * W + W).map((t) => t.padEnd(5)).join(' ').trimEnd()).join('\n');
  const { puzzle, start: st } = parseRoots({ id: 'gen', grid });
  if (checkRoots(puzzle, st).solved) return null;
  const hard = undecided(puzzle);
  if (hard < MINHARD) return null;
  if (solveRoots(puzzle, 2).count !== 1) return null;
  return { grid, hard };
}

if (process.argv[1]?.endsWith('roots-gen.ts')) {
  let found = 0;
  for (let t = 0; t < Number(process.env.TRIES ?? 400) && found < Number(process.env.TOP ?? 1); t++) {
    const g = attempt();
    if (g) {
      console.log(`indécises après déduction locale : ${g.hard}\n${g.grid}\n`);
      found++;
    }
  }
  if (!found) console.log('rien trouvé');
}
