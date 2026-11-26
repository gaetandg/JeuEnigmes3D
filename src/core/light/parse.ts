import type { Cell, Color, Dir, LightObject, LightPuzzle, LightState } from './types.ts';
import { SHAPES, parseShape } from '../shadow/parse.ts';
import { BLUE, GREEN, RED, WHITE } from './types.ts';

/**
 * Format texte d'une énigme (une ligne = une rangée, cases séparées par des espaces).
 * Utiliser String.raw pour garder les « \ ».
 *
 *   .        vide                    #        bloc de pierre
 *   >R ^G vB <W  émetteur (direction + couleur)
 *   /  \     miroir fixe              M/ M\   miroir orientable (orientation de départ)
 *   s/ s\    lame fixe                S/ S\   lame orientable
 *   oR oM …  cristal à allumer avec cette couleur
 *   x        cristal noir (ne doit pas être touché)
 *   fR …     filtre coloré            P       prisme
 *   _        socle (on peut y poser un miroir)
 *
 * Couleurs : R G B, Y (jaune = R+G), M (magenta = R+B), C (cyan = G+B), W (blanc).
 */
export interface LightPuzzleDef {
  id: string;
  grid: string;
  inventory?: number;
  /** objets en cubes (formes de la zone des ombres), posés sur des cases vides */
  objects?: { shape: string; at: [number, number]; axis?: 'x' | 'y'; start: number }[];
}

const COLOR_LETTERS: Record<string, Color> = {
  R: RED,
  G: GREEN,
  B: BLUE,
  Y: RED | GREEN,
  M: RED | BLUE,
  C: GREEN | BLUE,
  W: WHITE,
};

const DIR_CHARS: Record<string, Dir> = { '^': 0, '>': 1, v: 2, '<': 3 };

export function colorLetter(c: Color): string {
  for (const [k, v] of Object.entries(COLOR_LETTERS)) if (v === c) return k;
  return '?';
}

function parseColor(ch: string | undefined, token: string): Color {
  const c = ch ? COLOR_LETTERS[ch] : undefined;
  if (c === undefined) throw new Error(`Couleur inconnue dans « ${token} »`);
  return c;
}

function parseOrient(ch: string | undefined, token: string): 0 | 1 {
  if (ch === '/') return 0;
  if (ch === '\\') return 1;
  throw new Error(`Orientation inconnue dans « ${token} »`);
}

export function parseToken(token: string): Cell {
  const head = token[0];
  const rest = token[1];
  switch (head) {
    case '.':
      return { kind: 'empty' };
    case '#':
      return { kind: 'wall' };
    case '/':
      return { kind: 'mirror', orient: 0, fixed: true };
    case '\\':
      return { kind: 'mirror', orient: 1, fixed: true };
    case 'M':
      return { kind: 'mirror', orient: parseOrient(rest, token), fixed: false };
    case 's':
      return { kind: 'splitter', orient: parseOrient(rest, token), fixed: true };
    case 'S':
      return { kind: 'splitter', orient: parseOrient(rest, token), fixed: false };
    case 'o':
      return { kind: 'target', color: parseColor(rest, token) };
    case 'x':
      return { kind: 'dark' };
    case 'f':
      return { kind: 'filter', color: parseColor(rest, token) };
    case 'P':
      return { kind: 'prism' };
    case '_':
      return { kind: 'socket' };
    default: {
      const dir = head !== undefined ? DIR_CHARS[head] : undefined;
      if (dir !== undefined) return { kind: 'source', dir, color: parseColor(rest, token) };
      throw new Error(`Case inconnue « ${token} »`);
    }
  }
}

export function parsePuzzle(def: LightPuzzleDef): LightPuzzle {
  const rows = def.grid
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0)
    .map((l) => l.split(/\s+/));
  const height = rows.length;
  const width = rows[0]?.length ?? 0;
  if (height === 0 || width === 0) throw new Error(`${def.id} : grille vide`);
  const cells: Cell[] = [];
  rows.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`${def.id} : la rangée ${y} a ${row.length} cases au lieu de ${width}`);
    }
    for (const token of row) cells.push(parseToken(token));
  });
  const interactive: number[] = [];
  cells.forEach((c, i) => {
    if (((c.kind === 'mirror' || c.kind === 'splitter') && !c.fixed) || c.kind === 'socket') {
      interactive.push(i);
    }
  });
  const objects: LightObject[] = (def.objects ?? []).map((o) => {
    const text = SHAPES[o.shape];
    if (!text) throw new Error(`${def.id} : forme inconnue ${o.shape}`);
    const [ax, ay] = o.at;
    for (let dy = 0; dy < 3; dy++)
      for (let dx = 0; dx < 3; dx++) {
        const c = cells[(ay + dy) * width + ax + dx];
        if (!c || c.kind !== 'empty') throw new Error(`${def.id} : l'objet en (${ax},${ay}) doit reposer sur des cases vides`);
      }
    return { shape: parseShape(text), ax, ay, axis: o.axis ?? 'y' };
  });
  return {
    id: def.id, width, height, cells, inventory: def.inventory ?? 0, interactive,
    objects, objectStart: (def.objects ?? []).map((o) => o.start),
  };
}

/** État de départ : orientations écrites dans la grille, socles vides. */
export function initialState(p: LightPuzzle): LightState {
  return [
    ...p.interactive.map((i) => {
      const c = p.cells[i]!;
      if (c.kind === 'mirror' || c.kind === 'splitter') return c.orient;
      return -1;
    }),
    ...p.objectStart,
  ];
}

/**
 * Un état vient-il bien de cette énigme ? (une sauvegarde abîmée ou d'une ancienne version
 * ne doit jamais produire une grille impossible : valeurs hors domaine, trop de miroirs posés…)
 */
export function isValidState(p: LightPuzzle, s: readonly number[]): boolean {
  if (!Array.isArray(s) || s.length !== pieceCount(p)) return false;
  if (!s.every((v) => Number.isInteger(v))) return false;
  const cellsOk = p.interactive.every((i, k) => {
    const v = s[k]!;
    return p.cells[i]!.kind === 'socket' ? v >= -1 && v <= 1 : v === 0 || v === 1;
  });
  if (!cellsOk) return false;
  if (!p.objects.every((_, j) => s[p.interactive.length + j]! >= 0 && s[p.interactive.length + j]! <= 3)) return false;
  return piecesUsed(p, s) <= p.inventory;
}

/** Nombre total de pièces manipulables (cases + objets). */
export function pieceCount(p: LightPuzzle): number {
  return p.interactive.length + p.objects.length;
}

/** Nombre de miroirs posés sur des socles. */
export function piecesUsed(p: LightPuzzle, s: LightState): number {
  let n = 0;
  p.interactive.forEach((i, k) => {
    if (p.cells[i]!.kind === 'socket' && s[k]! >= 0) n++;
  });
  return n;
}

/**
 * Action du joueur sur la case manipulable n° k. Renvoie le nouvel état,
 * ou null si l'action est impossible (plus de miroir en réserve).
 */
export function interact(p: LightPuzzle, s: LightState, k: number, reverse = false): LightState | null {
  const next = s.slice();
  if (k >= p.interactive.length) {
    // objet : un quart de tour
    next[k] = (s[k]! + (reverse ? 3 : 1)) % 4;
    return next;
  }
  const cell = p.cells[p.interactive[k]!]!;
  const v = s[k]!;
  if (cell.kind === 'socket') {
    // cycle : vide → / → \ → vide (ou l'inverse)
    const cycle = [-1, 0, 1];
    const pos = cycle.indexOf(v);
    const nv = cycle[(pos + (reverse ? 2 : 1)) % 3]!;
    if (v === -1 && nv !== -1 && piecesUsed(p, s) >= p.inventory) return null;
    next[k] = nv;
  } else {
    next[k] = v === 0 ? 1 : 0;
  }
  return next;
}

/** Représentation texte (utile au débogage et aux rapports du solveur). */
export function stateToGrid(p: LightPuzzle, s: LightState): string {
  const out: string[] = [];
  for (let y = 0; y < p.height; y++) {
    const row: string[] = [];
    for (let x = 0; x < p.width; x++) {
      const i = y * p.width + x;
      const c = p.cells[i]!;
      const k = p.interactive.indexOf(i);
      const v = k >= 0 ? s[k]! : 0;
      const o = (n: number) => (n === 0 ? '/' : '\\');
      switch (c.kind) {
        case 'empty': row.push('.'); break;
        case 'wall': row.push('#'); break;
        case 'source': row.push('^>v<'[c.dir]! + colorLetter(c.color)); break;
        case 'mirror': row.push(c.fixed ? o(c.orient) : 'M' + o(v)); break;
        case 'splitter': row.push((c.fixed ? 's' : 'S') + o(c.fixed ? c.orient : v)); break;
        case 'target': row.push('o' + colorLetter(c.color)); break;
        case 'dark': row.push('x'); break;
        case 'filter': row.push('f' + colorLetter(c.color)); break;
        case 'prism': row.push('P'); break;
        case 'socket': row.push(v < 0 ? '_' : '_' + o(v)); break;
      }
    }
    out.push(row.map((t) => t.padEnd(2)).join(' '));
  }
  return out.join('\n');
}
