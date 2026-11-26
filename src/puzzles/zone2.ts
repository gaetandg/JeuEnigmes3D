import type { FoldPuzzleDef } from '../core/fold/parse.ts';

/**
 * Énigmes de la zone 2 (Pliage), dans l'ordre d'apprentissage.
 * `folds` = nombre de plis permis. Validées par le solveur (tests/unit/puzzles.test.ts).
 */
export const ZONE2: FoldPuzzleDef[] = [
  // ── points ─────────────────────────────────────────────────────────────
  { id: 'p1', folds: 1, note: 'Un seul pli : les deux points se rejoignent.', grid: 'R R' },
  { id: 'p2', folds: 1, note: 'Choisir le bon pli : seul le milieu réunit les points.', grid: 'R . . R' },
  {
    id: 'p3', folds: 2, note: 'Deux plis, deux directions.',
    grid: `
      R .
      . R
    `,
  },
  {
    id: 'p4', folds: 1, note: 'Deux couleurs qui ne doivent pas se mélanger.',
    grid: `
      R . . R
      . . . .
      B . . B
    `,
  },
  // ── taches ─────────────────────────────────────────────────────────────
  { id: 'p5', folds: 2, note: 'La tache doit disparaître : la couvrir ou la retourner.', grid: 's . R R' },
  // leçon du clic droit : la ligne du milieu plie dans les deux sens ; replier la moitié gauche
  // (clic gauche) retourne la tache du dos, il faut replier la moitié droite (clic droit)
  { id: 'p6', folds: 1, note: "Une tache au dos : retourner la mauvaise moitié la fait apparaître. Clic droit : l'autre moitié.", grid: 'R. .s .. R.' },
  // ── étoiles et trous ───────────────────────────────────────────────────
  {
    id: 'p7', folds: 2, note: "L'étoile doit rester visible : plier de l'autre côté.",
    grid: `
      * B . B
      . . . .
    `,
  },
  { id: 'p8', folds: 1, note: "Le trou : l'étoile se voit à travers.", grid: 'B * O B' },
  // ── combinaisons (générées puis choisies : solution unique) ─────────────
  {
    id: 'p9', folds: 2, note: 'Première combinaison, en deux plis : trou, étoile, tache et points.',
    grid: `
      .  R  .  R
      s  .  .* .
      .  *  O  .
    `,
  },
  {
    id: 'p10', folds: 3, note: 'Trou, étoile, tache et points ensemble.',
    grid: `
      .  .s R  .
      O  R  .  *
      .* .  .  .
    `,
  },
  {
    id: 'p11', folds: 3, note: 'Les marques du dos comptent aussi.',
    grid: `
      B  .  .  B
      .  R  .  .s
      .  .* .  .R
    `,
  },
  {
    id: 'p12', folds: 3, note: 'Feuille découpée.',
    grid: `
      s  .  .  .s
      .* .  B  .
      R  .  .  .
      _  R  B  _
    `,
  },
  {
    id: 'p13', folds: 4, note: "Grand pli final de l'atelier.",
    grid: `
      .R .  O  .  s
      .  .  .  R  .*
      .  .  .B .  .
      .s .B *  .  .
    `,
  },
];

/**
 * Énigme d'environnement de la zone 2 : le Grand Pli.
 * Une immense feuille de papier posée sur une estrade ; on la plie depuis le bord.
 */
export const ZONE2_GRAND_PLI: FoldPuzzleDef = {
  id: 'grand-pli', folds: 3, note: 'Le grand pli : la même règle, à l\'échelle du paysage.',
  grid: `
    .* .* .  .s .
    B  .  .s .  .B
    .  *  O  R  R
  `,
};
