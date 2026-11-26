import type { Dir, LightPuzzle, LightState, SimResult } from './types.ts';
import { BLUE, GREEN, PRIMARIES, RED } from './types.ts';
import { rotated } from '../shadow/engine.ts';

const DX = [0, 1, 0, -1] as const;
const DY = [-1, 0, 1, 0] as const;

export const opposite = (d: Dir): Dir => ((d + 2) % 4) as Dir;

/** Réflexion sur un miroir « / » (0) ou « \ » (1). */
export function reflect(d: Dir, orient: number): Dir {
  // « / » : nord↔est, sud↔ouest. « \ » : nord↔ouest, sud↔est.
  return (orient === 0 ? [1, 0, 3, 2] : [3, 2, 1, 0])[d] as Dir;
}

/** Prisme : rouge tourne à gauche, vert continue, bleu tourne à droite. */
export function disperse(d: Dir, c: number): Dir {
  if (c === RED) return ((d + 3) % 4) as Dir;
  if (c === BLUE) return ((d + 1) % 4) as Dir;
  if (c === GREEN) return d;
  throw new Error('disperse attend une couleur primaire');
}

/** Orientation effective de chaque case (-1 = pas de miroir). */
function orientations(p: LightPuzzle, s: LightState): Int8Array {
  const o = new Int8Array(p.cells.length).fill(-1);
  p.cells.forEach((c, i) => {
    if (c.kind === 'mirror' || c.kind === 'splitter') o[i] = c.orient;
  });
  p.interactive.forEach((i, k) => {
    o[i] = s[k]!;
  });
  return o;
}

/** Cases occupées au sol par les objets (elles arrêtent la lumière). */
export function blockedCells(p: LightPuzzle, s: LightState): Uint8Array {
  const b = new Uint8Array(p.cells.length);
  p.objects.forEach((o, j) => {
    for (const [x, y, z] of rotated(o.shape, o.axis, s[p.interactive.length + j] ?? 0)) {
      if (y === 0) b[(o.ay + z) * p.width + o.ax + x] = 1;
    }
  });
  return b;
}

export function simulate(p: LightPuzzle, s: LightState): SimResult {
  const { width: w, height: h, cells } = p;
  const n = w * h;
  const orient = orientations(p, s);
  const blocked = blockedCells(p, s);
  const received = new Uint8Array(n);
  const halfEdges = new Uint8Array(n * 4);
  const visited = new Uint8Array(n * 4);
  // pile de rayons : [index de case, direction de sortie, couleur primaire]
  const stack: number[] = [];

  cells.forEach((c, i) => {
    if (c.kind !== 'source') return;
    for (const prim of PRIMARIES) if (c.color & prim) stack.push(i, c.dir, prim);
  });

  while (stack.length > 0) {
    const c = stack.pop()!;
    const d = stack.pop()! as Dir;
    const i = stack.pop()!;
    halfEdges[i * 4 + d]! |= c;
    const x = (i % w) + DX[d];
    const y = Math.floor(i / w) + DY[d];
    if (x < 0 || y < 0 || x >= w || y >= h) continue;
    const ni = y * w + x;
    const cell = cells[ni]!;
    if (cell.kind === 'wall' || cell.kind === 'source' || blocked[ni]) continue;
    const key = ni * 4 + d;
    if (visited[key]! & c) continue;
    visited[key]! |= c;
    halfEdges[ni * 4 + opposite(d)]! |= c;
    received[ni]! |= c;
    switch (cell.kind) {
      case 'empty':
        stack.push(ni, d, c);
        break;
      case 'socket':
      case 'mirror': {
        const o = orient[ni]!;
        stack.push(ni, o < 0 ? d : reflect(d, o), c);
        break;
      }
      case 'splitter':
        stack.push(ni, d, c, ni, reflect(d, orient[ni]!), c);
        break;
      case 'filter':
        if (cell.color & c) stack.push(ni, d, c);
        break;
      case 'prism':
        stack.push(ni, disperse(d, c), c);
        break;
      case 'target':
      case 'dark':
        break;
    }
  }

  const crystals: SimResult['crystals'] = [];
  let solved = true;
  let targets = 0;
  cells.forEach((c, i) => {
    if (c.kind === 'target') {
      targets++;
      const ok = received[i] === c.color;
      crystals.push({ index: i, ok, received: received[i]!, wanted: c.color });
      if (!ok) solved = false;
    } else if (c.kind === 'dark') {
      const ok = received[i] === 0;
      crystals.push({ index: i, ok, received: received[i]!, wanted: 0 });
      if (!ok) solved = false;
    }
  });
  if (targets === 0) solved = false;
  return { received, halfEdges, crystals, solved };
}

/** Dessin texte de l'énigme avec ses rayons (débogage). */
export function renderAscii(p: LightPuzzle, s: LightState): string {
  const r = simulate(p, s);
  const o = orientations(p, s);
  const blocked = blockedCells(p, s);
  const lines: string[] = [];
  for (let y = 0; y < p.height; y++) {
    let line = '';
    for (let x = 0; x < p.width; x++) {
      const i = y * p.width + x;
      const c = p.cells[i]!;
      const he = [0, 1, 2, 3].map((d) => r.halfEdges[i * 4 + d]! > 0);
      let ch = '·';
      switch (c.kind) {
        case 'wall': ch = '█'; break;
        case 'source': ch = '▲▶▼◀'[c.dir]!; break;
        case 'mirror': case 'socket': case 'splitter':
          ch = o[i]! < 0 ? '○' : o[i] === 0 ? '╱' : '╲';
          if (c.kind === 'splitter') ch = o[i] === 0 ? '⧄' : '⧅';
          break;
        case 'target': ch = r.received[i] === c.color ? '◆' : '◇'; break;
        case 'dark': ch = r.received[i] ? '✖' : '●'; break;
        case 'filter': ch = 'Φ'; break;
        case 'prism': ch = '△'; break;
        case 'empty': {
          if (blocked[i]) {
            ch = '▓';
            break;
          }
          const v = he[0] || he[2];
          const hz = he[1] || he[3];
          ch = v && hz ? '┼' : v ? '│' : hz ? '─' : '·';
        }
      }
      line += ch + (he[1] ? '─' : ' ');
    }
    lines.push(line);
  }
  return lines.join('\n') + (r.solved ? '\n✔ résolue' : '');
}

export { RED, GREEN, BLUE };
