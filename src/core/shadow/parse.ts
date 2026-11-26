import { N, shadowOn } from './engine.ts';
import type { Axis, ShadowPuzzle, Voxel, Wall } from './engine.ts';

/**
 * Formes : chaque forme est décrite par ses 3 étages (du bas vers le haut),
 * chaque étage étant 3 rangées (du fond vers le joueur) de 3 caractères (gauche → droite).
 * « # » = cube, « . » = vide.
 */
export const SHAPES: Record<string, string> = {
  // une équerre debout (plate, dans le plan du mur du fond)
  L: '... ... #.. | ... ... #.. | ... ... ###',
  // marche d'escalier
  marche: '### ### ### | ##. ##. ##. | #.. #.. #..',
  // un « T » plat
  T: '... ... .#. | ... ... .#. | ... ... ###',
  // colonne et bras : vue de face un « Γ », de côté un « L »
  bras: '#.. ... ... | #.. ... ... | ### ... ...',
  // tétracube en zigzag
  zigzag: '##. ... ... | .## ... ... | ... ... ...',
  // un pont : deux pieds et un tablier
  pont: '#.# ... ... | #.# ... ... | ### ... ...',
  // coin en trois dimensions
  coin: '##. #.. ... | #.. ... ... | ... ... ...',
  // anneau : un carré creux (laisse passer la lumière)
  anneau: '### ... ... | #.# ... ... | ### ... ...',
  // la croix
  croix: '.#. ... ... | ### ... ... | .#. ... ...',
  // escalier en diagonale
  diag: '#.. .#. ..# | ... #.. .#. | ... ... #..',
};

export function parseShape(text: string): Voxel[] {
  const floors = text.split(/[|/]/).map((f) => f.trim().split(/\s+/));
  if (floors.length !== N) throw new Error(`forme : ${N} étages attendus`);
  const out: Voxel[] = [];
  floors.forEach((rows, y) => {
    if (rows.length !== N) throw new Error(`forme : ${N} rangées par étage`);
    rows.forEach((row, z) => {
      [...row].forEach((ch, x) => {
        if (ch === '#') out.push([x, y, z]);
      });
    });
  });
  return out;
}

export interface ShadowObjectDef {
  shape: keyof typeof SHAPES | string;
  /** case de la scène (en boîtes) : [colonne, rangée] */
  slot: [number, number];
  axis?: Axis;
  /** quarts de tour au départ */
  start: number;
  /** quarts de tour de la solution (sert à calculer les silhouettes) */
  solution: number;
}

export interface ShadowPuzzleDef {
  id: string;
  note: string;
  objects: ShadowObjectDef[];
  walls: Wall[];
}

export function parseShadow(def: ShadowPuzzleDef): ShadowPuzzle {
  const cols = Math.max(...def.objects.map((o) => o.slot[0])) + 1;
  const rows = Math.max(...def.objects.map((o) => o.slot[1])) + 1;
  const p: ShadowPuzzle = {
    id: def.id,
    width: cols * N,
    depth: rows * N,
    height: N,
    objects: def.objects.map((o) => {
      const text = SHAPES[o.shape];
      if (!text) throw new Error(`${def.id} : forme inconnue ${o.shape}`);
      return { shape: parseShape(text), ox: o.slot[0] * N, oz: o.slot[1] * N, axis: o.axis ?? 'y' };
    }),
    walls: def.walls,
    targets: {},
  };
  const sol = def.objects.map((o) => o.solution);
  for (const w of def.walls) p.targets[w] = shadowOn(p, sol, w);
  return p;
}

export function startState(def: ShadowPuzzleDef): number[] {
  return def.objects.map((o) => o.start);
}
