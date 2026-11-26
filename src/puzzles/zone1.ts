import type { LightPuzzleDef } from '../core/light/parse.ts';

/**
 * Énigmes de la zone 1 (Lumière), dans l'ordre d'apprentissage.
 * Chaque énigme est validée par le solveur (tests/unit/puzzles.test.ts).
 * `note` est un commentaire de conception, jamais affiché au joueur.
 */
export interface Zone1Puzzle extends LightPuzzleDef {
  note: string;
}

export const ZONE1: Zone1Puzzle[] = [
  // ── Allée A : le miroir ───────────────────────────────────────────────
  {
    id: 'a1',
    note: 'Un clic suffit : on apprend que le miroir bascule.',
    grid: String.raw`
      .  .  .  .
      >Y .  .  M/
      .  .  .  .
      .  .  .  oY
    `,
  },
  {
    id: 'a2',
    note: 'Deux miroirs en chaîne.',
    grid: String.raw`
      .  .  .  .  .
      >Y .  M/ .  .
      .  .  .  .  .
      .  .  M/ .  oY
      .  .  .  .  .
    `,
  },
  {
    id: 'a3',
    note: 'Un bloc impose un détour.',
    grid: String.raw`
      >Y M/ .  #  .
      .  .  .  #  oY
      .  M/ .  .  M\
    `,
  },
  {
    id: 'a4',
    note: 'Deux rayons, deux cristaux : les rayons se croisent sans se gêner.',
    grid: String.raw`
      .  .  .  oY .
      .  M\ .  .  oY
      >Y .  .  M\ .
      .  .  .  .  .
      .  ^Y .  .  .
    `,
  },
  {
    id: 'a5',
    note: 'Une spirale : suivre le rayon pas à pas.',
    grid: String.raw`
      .  .  .  .  .  .
      .  M\ .  .  M/ .
      .  .  .  oY .  .
      .  M/ .  M\ .  .
      .  .  .  .  .  .
      >Y .  .  .  M\ .
    `,
  },

  // ── Allée B : les couleurs ────────────────────────────────────────────
  {
    id: 'b1',
    note: 'Deux couleurs. Un même miroir renvoie les deux rayons : il faut les échanger.',
    grid: String.raw`
      .  vR .  .  .
      .  .  .  .  .
      >B M/ .  M/ .
      .  .  .  .  .
      .  oB .  oR .
    `,
  },
  {
    id: 'b2',
    note: 'Déclic du mélange : le cristal magenta veut le rouge ET le bleu.',
    grid: String.raw`
      .  .  .  .  .
      >R .  M/ .  .
      .  .  .  .  .
      .  .  oM .  M/
      .  .  .  .  ^B
    `,
  },
  {
    id: 'b3',
    note: "Couleur exacte : le bleu en trop transforme le jaune en blanc.",
    grid: String.raw`
      >R .  M/ .  .
      .  .  .  .  .
      .  .  oY .  M/
      >B .  M/ .  .
      .  .  oB .  ^G
    `,
  },
  {
    id: 'b4',
    note: 'Cristal noir : le chemin du haut est interdit, il faut faire le tour par le bas.',
    grid: String.raw`
      .  .  /  x  \
      .  .  .  .  .
      >R .  M/ .  oR
      .  .  .  .  .
      .  .  M/ .  M\
    `,
  },

  {
    id: 'b5',
    note: 'Synthèse des couleurs : trois rayons, deux cristaux noirs à éviter.',
    grid: String.raw`
      .  vR .  .  .  .
      x  .  M\ .  .  M/
      >G .  M\ M/ .  oG
      M\ M\ .  .  .  #
      oR M/ M\ .  M/ .
      .  .  oB x  M/ <B
    `,
  },

  // ── Allée C : le verre ────────────────────────────────────────────────
  {
    id: 'c1',
    note: 'Le vitrail rouge ne laisse passer que le rouge de la lumière blanche.',
    grid: String.raw`
      .  vW .  .  .
      .  .  .  .  .
      >W M/ fR .  oR
      .  .  .  .  .
      .  oW .  .  .
    `,
  },
  {
    id: 'c2',
    note: 'La lame : un rayon devient deux.',
    grid: String.raw`
      .  .  .  .  .
      >G .  S/ .  M/
      .  .  .  .  .
      .  .  oG .  oG
    `,
  },
  {
    id: 'c3',
    note: 'Deux lumières blanches, deux vitraux, une lame.',
    grid: String.raw`
      >W .  M/ M\ .  <W
      .  .  fB .  .  .
      .  .  .  fM .  .
      M\ .  S\ M/ .  M/
      oB .  .  .  .  oM
      .  .  M\ x  #  .
    `,
  },
  {
    id: 'c4',
    note: 'Le jaune contient du rouge : vitraux et lames combinés.',
    grid: String.raw`
      x  .  .  M/ S\ .  <Y
      .  .  .  .  M/ .  M/
      #  .  .  oM M/ .  oY
      M/ S\ fM .  S\ .  .
      .  .  x  .  .  .  .
      .  ^W .  .  #  .  .
    `,
  },

  // ── Allée D : les socles et le prisme ─────────────────────────────────
  {
    id: 'd1',
    note: 'Un socle vide et un miroir en réserve : on pose soi-même la pièce.',
    inventory: 1,
    grid: String.raw`
      .  .  .  .  .
      >Y .  .  _  .
      .  .  .  .  .
      .  .  .  oY .
    `,
  },
  {
    id: 'd2',
    note: 'Deux miroirs à poser, plusieurs socles : choisir les bons.',
    inventory: 2,
    grid: String.raw`
      >R .  M/ vG M/ .
      .  x  .  .  .  #
      .  x  .  .  _  .
      _  .  _  M/ M/ .
      oR .  .  .  .  .
      .  #  .  .  M/ oG
    `,
  },
  {
    id: 'd3',
    note: 'Le prisme : la lumière blanche contient le rouge, le vert et le bleu.',
    grid: String.raw`
      >W .  M/ .  .
      .  .  .  .  .
      oB .  P  .  oR
      .  .  .  .  .
      .  .  oG .  .
    `,
  },
  {
    id: 'd4',
    note: 'Décomposer puis recomposer : le rouge et le bleu se retrouvent en magenta.',
    grid: String.raw`
      .  .  .  vW .  .
      .  .  .  .  .  .
      .  .  .  .  .  .
      .  M\ .  P  .  M/
      .  .  .  oG .  .
      .  M/ oM .  .  M\
    `,
  },
  {
    id: 'd5',
    note: 'Grand panneau final de la zone : tout ce qui a été appris.',
    inventory: 1,
    grid: String.raw`
      .  #  .  M\ M\ .  <W
      .  x  .  _  .  oW .
      .  .  oR .  .  .  .
      x  .  M/ M/ M\ .  <B
      M\ .  S\ .  M\ _  #
      .  .  .  M/ .  .  <R
      .  .  oB .  .  .  .
    `,
  },
];

/**
 * Énigme d'environnement de la zone 1 : les Tours-Miroirs.
 * Même moteur, même règles, mais chaque case mesure plusieurs mètres :
 * les miroirs sont des tours, les filtres de grands vitraux, le cristal garde la porte nord.
 */
export const ZONE1_TOWERS: Zone1Puzzle = {
  id: 'tours',
  note: 'Le jardin est un panneau géant : la lumière du soleil, divisée, doit revenir en magenta.',
  grid: String.raw`
    .  M\ .  oM .  M/ .
    .  fR .  .  .  fB .
    >W S\ .  .  .  M\ .
  `,
};
