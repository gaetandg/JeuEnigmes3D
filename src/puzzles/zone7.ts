import type { VasePuzzleDef } from '../core/vases/parse.ts';

/**
 * Zone 7 : la Bulle, au fond de l'océan. Sixième langage : les vases. Des tubes de verre de
 * hauteurs différentes, reliés par des tuyaux ; ouvrir un tuyau verse l'eau d'un tube dans l'autre
 * jusqu'à ce que le premier soit vide ou le second plein. L'eau doit arriver pile aux anneaux d'or.
 * Générées par scripts/vases-gen.ts, validées par le solveur (tests/unit/vases-engine.test.ts).
 */
export interface BubblePuzzleDef extends VasePuzzleDef {
  /** gestes minimum (vérifié par le solveur) */
  moves: number;
}

export const ZONE7: BubblePuzzleDef[] = [
  { id: 'v1', moves: 1, note: 'Verser : le petit tube se remplit, il en reste dans le grand.', caps: [5, 3], start: [5, 0], targets: [2, null], pipes: '0-1' },
  { id: 'v2', moves: 3, note: 'Trois tubes.', caps: [6, 8, 5], start: [0, 8, 0], targets: [null, null, 3], pipes: '0-1 0-2 1-2' },
  { id: 'v3', moves: 6, note: 'En chaîne : on ne verse qu\'à son voisin.', caps: [9, 6, 7], start: [9, 0, 0], targets: [null, null, 1], pipes: '0-1 1-2' },
  { id: 'v4', moves: 7, note: 'Presque plein.', caps: [11, 10, 4], start: [11, 0, 0], targets: [null, 9, null], pipes: '0-1 0-2 1-2' },
  { id: 'v5', moves: 9, note: 'Un tuyau à sens unique.', caps: [10, 6, 5], start: [10, 0, 0], targets: [2, null, null], pipes: '0-1 1-2 0>2' },
  { id: 'v6', moves: 11, note: 'Quatre tubes, deux anneaux.', caps: [10, 5, 8, 10], start: [8, 0, 0, 5], targets: [7, 4, null, null], pipes: '0-1 1-2 2-3 0>3' },
];

/** La Grande Écluse, au centre de la Bulle : quatre grands tubes, deux anneaux, 14 gestes. */
export const ZONE7_GRANDE: BubblePuzzleDef = {
  id: 'grande-ecluse', moves: 14, note: 'La Grande Écluse.',
  caps: [12, 12, 9, 13], start: [12, 0, 0, 9], targets: [null, null, 2, 8], pipes: '0>1 0-2 0-3 1-2 1>3 2-3',
};
