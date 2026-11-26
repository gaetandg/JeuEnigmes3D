import type { LightPuzzleDef } from '../core/light/parse.ts';
import type { FoldPuzzleDef } from '../core/fold/parse.ts';

/**
 * Zone 4 (le Phare) : les langages se combinent.
 *  - f1, f2, f5 : lumière + objets en cubes (une empreinte au sol arrête les rayons)
 *  - f6 (finale) : lumière + objets + manivelles couplées de la zone des ombres
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
  {
    // finale : la lumière (zone 1), les objets en cubes (zone 3) et les manivelles couplées.
    // Le rayon rouge qui tombe doit être arrêté (sinon le cristal bleu virerait au magenta),
    // le vert aussi (cristal noir) ; les trois autres doivent passer. Six gestes au minimum.
    id: 'f6', note: 'Finale : trois objets menés par trois manivelles en chaîne, cinq rayons à trier.',
    cranks: [[0, 1], [1, 2], [2]],
    objects: [
      { shape: 'pont', at: [1, 3], axis: 'x', start: 2 },
      { shape: 'diag', at: [4, 4], axis: 'x', start: 2 },
      { shape: 'pont', at: [5, 1], start: 2 },
    ],
    grid: String.raw`
      .  .  .  vR .  .  .  .  .
      >C .  .  .  .  .  .  .  oC
      .  .  .  .  .  .  .  .  .
      .  .  .  .  .  .  .  .  .
      >G .  .  .  .  .  .  .  x
      >Y .  .  .  .  .  .  .  oY
      >B .  .  oB .  .  .  .  .
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
    id: 'f4', folds: 2, note: 'Le pochoir en deux plis : aligner trois trous.',
    grid: `
      .  .  .  O
      .  O  .  O
      .  .  .  .
      .  .  .  .
    `,
    light: `
      o  .  .  o
      o  .  .  o
      o  .  .  .
      o  o  o  o
    `,
  },
];
