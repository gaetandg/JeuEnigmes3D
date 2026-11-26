import type { LightPuzzleDef } from '../core/light/parse.ts';
import type { FoldPuzzleDef } from '../core/fold/parse.ts';

/**
 * Zone 4 (le Phare) : les langages se combinent.
 *  - f1, f2, f5 : lumière + objets en cubes (une empreinte au sol arrête les rayons)
 *  - f3, f4 : pliage + lumière (la feuille trouée sert de pochoir sur une table lumineuse)
 */
export interface FinalLightDef extends LightPuzzleDef {
  note: string;
}

export const ZONE4_LIGHT: FinalLightDef[] = [
  {
    id: 'f1', note: "Le garde-fou : l'anneau couché arrête un rayon et laisse passer l'autre.",
    objects: [{ shape: 'anneau', at: [2, 1], start: 0 }],
    grid: String.raw`
      .  .  .  .  .  .  .
      >R .  .  .  .  .  oR
      .  .  .  .  .  .  .
      >B .  .  .  .  .  x
      .  .  .  .  .  .  .
    `,
  },
  {
    id: 'f2', note: 'Le berceau : le pont basculé change son empreinte au sol.',
    objects: [{ shape: 'pont', at: [3, 1], axis: 'x', start: 1 }],
    grid: String.raw`
      .  .  .  .  .  .  .  .
      >R .  .  .  .  .  .  oR
      >G .  .  .  .  .  .  oG
      >B .  .  .  .  .  .  x
      .  .  .  .  .  .  .  .
    `,
  },
  {
    id: 'f5', note: 'Synthèse : deux objets et une lame.',
    objects: [
      { shape: 'anneau', at: [1, 2], start: 0 },
      { shape: 'pont', at: [5, 2], axis: 'x', start: 1 },
    ],
    grid: String.raw`
      .  .  .  .  .  .  vB .  .
      .  .  .  .  .  .  .  .  .
      >R .  .  .  oR .  .  .  .
      >W .  .  .  S/ .  .  .  x
      .  .  .  .  .  .  .  .  .
      .  .  .  .  .  .  .  .  .
      .  .  .  .  oW .  x  .  .
    `,
  },
];

export const ZONE4_FOLD: FoldPuzzleDef[] = [
  {
    id: 'f3', folds: 1, note: 'Le pochoir : la lumière passe là où le papier est parti, et par des trous superposés.',
    grid: `
      O  .  .  O
      .  .  .  .
    `,
    light: `
      o  o  .  o
      o  o  .  .
    `,
  },
  {
    id: 'f4', folds: 3, note: 'Le pochoir en trois plis.',
    grid: `
      .  O  .  .
      .  .  .  .
      .  O  .  .
      .  .  O  .
    `,
    light: `
      o  o  o  o
      o  o  o  o
      o  .  .  .
      o  .  o  .
    `,
  },
];
