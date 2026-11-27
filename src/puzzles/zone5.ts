import type { TiltPuzzleDef } from '../core/tilt/parse.ts';

/**
 * Zone 5 : l'Île du Ciel, quatrième langage, l'inclinaison. On incline le plateau d'un côté :
 * toutes les billes roulent jusqu'à buter (mur, bord, autre bille). Chacune doit finir dans le
 * creux de sa couleur, sans tomber dans un puits noir.
 * Générées par scripts/tilt-gen.ts, validées par le solveur (tests/unit/puzzles.test.ts).
 */
export interface SkyPuzzleDef extends TiltPuzzleDef {
  /** gestes minimum (vérifié par le solveur) */
  moves: number;
}

export const ZONE5: SkyPuzzleDef[] = [
  {
    id: 't1', moves: 2, note: 'Incliner : la bille roule jusqu\'au bord, puis tombe dans son creux.',
    grid: `
      .  R  .  .
      oR .  .  .
      .  .  #  .
    `,
  },
  {
    id: 't2', moves: 4, note: 'Les puits noirs avalent les billes.',
    grid: `
      .  oR x  .  #
      .  .  .  .  .
      .  .  x  .  R
      .  .  #  .  .
    `,
  },
  {
    id: 't3', moves: 4, note: 'Deux billes : celle qui est arrêtée sert de butée à l\'autre.',
    grid: `
      .  .  .  oR R
      .  #  .  #  .
      .  .  .  oR .
      .  .  .  .  R
    `,
  },
  {
    id: 't4', moves: 5, note: 'Deux couleurs, deux creux.',
    grid: `
      .  #  .  .  oR
      .  B  .  .  .
      .  .  R  .  .
      .  .  .  .  .
      .  #  oB .  #
    `,
  },
  {
    id: 't5', moves: 6, note: 'Un puits sur le chemin.',
    grid: `
      .  .  R  B  .
      .  .  .  .  x
      oB #  .  .  .
      #  .  .  .  .
      oR .  #  .  .
    `,
  },
  {
    id: 't6', moves: 7, note: 'Trois couleurs.',
    grid: `
      .  #  .  .  R  #
      #  oB .  .  oG .
      .  .  .  .  .  .
      oR B  x  .  #  .
      .  .  G  .  .  .
    `,
  },
  {
    id: 't7', moves: 8, note: 'Trois billes, deux puits.',
    grid: `
      .  .  B  .  .  R
      .  .  .  .  oR .
      oG x  .  x  #  .
      .  .  .  #  .  #
      .  .  .  oB .  .
      #  .  .  .  #  G
    `,
  },
  {
    id: 't8', moves: 9, note: 'Deux paires.',
    grid: `
      .  B  #  .  oB .
      B  oB .  .  #  R
      .  oR .  .  .  .
      .  .  .  .  R  oR
      .  x  .  .  x  #
      .  .  #  .  .  #
    `,
  },
];

/** Le Grand Plateau, au centre de l'île : quatre couleurs, à la taille de la place. */
export const ZONE5_GRAND: SkyPuzzleDef = {
  id: 'grand-plateau', moves: 12, note: 'Le Grand Plateau : quatre couleurs.',
  grid: `
    .  .  x  .  .  #  #
    #  .  x  Y  G  oB x
    .  .  .  .  .  #  .
    .  .  oY B  .  .  .
    #  .  .  .  #  .  oR
    .  .  .  #  .  .  .
    .  oG .  .  R  .  .
  `,
};
