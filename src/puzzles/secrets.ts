import type { LightPuzzleDef } from '../core/light/parse.ts';
import type { FoldPuzzleDef } from '../core/fold/parse.ts';
import type { ShadowPuzzleDef } from '../core/shadow/parse.ts';

/**
 * Les Éclats : sept énigmes secrètes cachées hors des chemins, sans câble ni guide.
 * Chacune a été choisie parce que l'agent glouton y échoue souvent (il faut une idée).
 */
export const SECRET_LIGHT: (LightPuzzleDef & { note: string })[] = [
  {
    id: 'eclat-plage', note: 'Jardin des lanternes, sur la plage ouest : la lumière jaune doit devenir rouge, en boucle.',
    grid: String.raw`
      .  M\ .  fR S/
      >Y M\ oR M/ .
      x  .  .  M\ M\
    `,
  },
  {
    id: 'eclat-bosquet', note: 'Panneau oublié dans le bosquet, à l\'est du jardin.',
    grid: String.raw`
      .  .  .  .  .  .  x
      .  #  .  .  .  .  x
      .  M\ M/ M\ .  .  S/
      >Y M\ oY fY .  .  .
      >W .  .  M\ .  .  .
      #  M\ .  M\ .  .  oY
    `,
  },
  {
    id: 'eclat-belvedere', note: 'Au bord du plateau du phare, face à la mer : le plus difficile des secrets.',
    inventory: 1,
    grid: String.raw`
      .  .  oG S/ .  .  .
      .  .  .  .  .  .  #
      >W fG .  _  .  .  .
      .  .  x  .  x  .  .
      .  .  M\ S\ M/ M/ .
      .  #  S\ _  S/ oB .
      .  .  ^R ^B oR .  .
    `,
  },
];

export const SECRET_FOLD: FoldPuzzleDef[] = [
  {
    id: 'eclat-voile', folds: 3, note: 'Une voile de papier tendue dans les bois, à l\'ouest du jardin.',
    grid: `
      *  B  B  O
      .  .  R  s
      .  R  .* .
    `,
  },
  {
    id: 'eclat-dunes', folds: 3, note: 'Une feuille découpée oubliée dans les dunes de l\'est.',
    grid: `
      _  B  R  *
      *  O  .s .
      .  .  .s .
      _  .B R  _
    `,
  },
];

export const SECRET_SHADOW: ShadowPuzzleDef[] = [
  {
    id: 'eclat-statues', note: 'Deux statues derrière le cloître.', walls: ['back', 'right'],
    objects: [
      { shape: 'coin', slot: [0, 0], axis: 'y', start: 3, solution: 1 },
      { shape: 'pont', slot: [1, 1], axis: 'y', start: 0, solution: 2 },
    ],
  },
  {
    id: 'eclat-gardiens', note: 'Les trois gardiens, derrière le phare.', walls: ['back', 'right'],
    objects: [
      { shape: 'zigzag', slot: [0, 0], axis: 'x', start: 1, solution: 0 },
      { shape: 'pont', slot: [1, 1], axis: 'y', start: 1, solution: 3 },
      { shape: 'croix', slot: [1, 0], axis: 'x', start: 3, solution: 1 },
    ],
  },
];

export const SECRET_IDS = [...SECRET_LIGHT, ...SECRET_FOLD, ...SECRET_SHADOW].map((d) => d.id);
