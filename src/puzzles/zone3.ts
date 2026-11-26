import type { ShadowPuzzleDef } from '../core/shadow/parse.ts';

/**
 * Énigmes de la zone 3 (Ombres), dans l'ordre d'apprentissage.
 * Les silhouettes gravées sont calculées à partir des orientations `solution` ;
 * le solveur vérifie qu'aucune autre orientation ne convient (tests/unit/puzzles.test.ts).
 */
export const ZONE3: ShadowPuzzleDef[] = [
  {
    id: 'o1', note: "Un quart de tour : l'ombre change de forme.", walls: ['back'],
    objects: [{ shape: 'L', slot: [0, 0], start: 1, solution: 0 }],
  },
  {
    id: 'o2', note: "L'ombre peut être à l'envers : un demi-tour.", walls: ['back'],
    objects: [{ shape: 'marche', slot: [0, 0], start: 2, solution: 0 }],
  },
  {
    id: 'o3', note: "Deux objets : leurs ombres s'additionnent.", walls: ['back'],
    objects: [
      { shape: 'T', slot: [0, 0], start: 1, solution: 0 },
      { shape: 'L', slot: [1, 0], start: 3, solution: 2 },
    ],
  },
  {
    id: 'o4', note: 'Une lampe de côté : le mur de droite.', walls: ['right'],
    objects: [{ shape: 'bras', slot: [0, 0], start: 0, solution: 3 }],
  },
  {
    id: 'o5', note: 'Deux lampes, deux murs : une seule orientation convient aux deux.', walls: ['back', 'right'],
    objects: [{ shape: 'bras', slot: [0, 0], start: 2, solution: 1 }],
  },
  {
    id: 'o6', note: 'Le coin vu de deux côtés.', walls: ['back', 'right'],
    objects: [{ shape: 'coin', slot: [0, 0], start: 0, solution: 2 }],
  },
  {
    id: 'o7', note: "Le berceau : l'objet bascule vers soi.", walls: ['back'],
    objects: [{ shape: 'pont', slot: [0, 0], axis: 'x', start: 1, solution: 0 }],
  },
  {
    id: 'o8', note: 'Plateau et berceau ensemble.', walls: ['back', 'right'],
    objects: [
      { shape: 'zigzag', slot: [0, 0], axis: 'x', start: 0, solution: 1 },
      { shape: 'bras', slot: [1, 0], start: 0, solution: 2 },
    ],
  },
  {
    id: 'o9', note: "L'anneau : une ombre trouée laisse passer la lumière.", walls: ['back', 'right'],
    objects: [
      { shape: 'anneau', slot: [0, 0], axis: 'x', start: 1, solution: 0 },
      { shape: 'croix', slot: [1, 0], axis: 'x', start: 0, solution: 1 },
    ],
  },
  {
    id: 'o10', note: 'Trois objets, deux murs : la synthèse.', walls: ['back', 'right'],
    objects: [
      { shape: 'bras', slot: [0, 0], axis: 'x', start: 0, solution: 3 },
      { shape: 'T', slot: [1, 1], start: 2, solution: 1 },
      { shape: 'T', slot: [1, 0], start: 1, solution: 0 },
    ],
  },
  // ── les manivelles : un levier entraîne plusieurs objets ──
  {
    id: 'o11', note: "La manivelle de gauche entraîne aussi le voisin : il faut le rattraper.", walls: ['back'],
    cranks: [[0, 1], [1]],
    objects: [
      { shape: 'zigzag', slot: [0, 0], start: 0, solution: 1 },
      { shape: 'zigzag', slot: [1, 0], start: 0, solution: 0 },
    ],
  },
  {
    id: 'o12', note: "Trois manivelles en chaîne : l'ordre et le sens comptent.", walls: ['back', 'right'],
    cranks: [[0, 1], [1, 2], [2]],
    objects: [
      { shape: 'T', slot: [0, 0], start: 2, solution: 0 },
      { shape: 'L', slot: [1, 0], start: 1, solution: 2 },
      { shape: 'croix', slot: [2, 0], axis: 'x', start: 1, solution: 3 },
    ],
  },
];

/** Énigme d'environnement de la zone 3 : le Cadran, une scène d'ombres monumentale à manivelles. */
export const ZONE3_CADRAN: ShadowPuzzleDef = {
  id: 'cadran', note: "Le même théâtre d'ombres, à la taille du cloître, mené par trois manivelles en chaîne.", walls: ['back', 'right'],
  cranks: [[0, 1], [1, 2], [2]],
  objects: [
    { shape: 'bras', slot: [0, 0], start: 2, solution: 0 },
    { shape: 'anneau', slot: [1, 1], start: 0, solution: 3 },
    { shape: 'pont', slot: [1, 0], axis: 'x', start: 0, solution: 3 },
  ],
};
