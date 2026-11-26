/**
 * Moteur des énigmes de lumière (zone 1).
 * Logique pure, sans dépendance au rendu : testable et utilisable par le solveur.
 */

/** Direction sur la grille : 0 = nord (y-1), 1 = est (x+1), 2 = sud (y+1), 3 = ouest (x-1). */
export type Dir = 0 | 1 | 2 | 3;

/** Couleur additive en masque de bits : rouge = 1, vert = 2, bleu = 4. */
export type Color = number;

export const RED = 1;
export const GREEN = 2;
export const BLUE = 4;
export const WHITE = RED | GREEN | BLUE;
export const PRIMARIES = [RED, GREEN, BLUE] as const;

/** Orientation d'un miroir : 0 = « / », 1 = « \ ». */
export type Orient = 0 | 1;

export type Cell =
  | { kind: 'empty' }
  | { kind: 'wall' }
  | { kind: 'source'; dir: Dir; color: Color }
  | { kind: 'mirror'; orient: Orient; fixed: boolean }
  | { kind: 'splitter'; orient: Orient; fixed: boolean }
  | { kind: 'target'; color: Color }
  | { kind: 'dark' }
  | { kind: 'filter'; color: Color }
  | { kind: 'prism' }
  /** Socle où le joueur peut poser un miroir (réserve limitée). */
  | { kind: 'socket' };

/** Objet en cubes posé sur la grille (zone finale) : il bloque les rayons là où il touche le sol. */
export interface LightObject {
  /** cubes dans une boîte 3×3×3 : x (droite), y (haut), z (vers le joueur) */
  shape: [number, number, number][];
  /** case de la grille du coin arrière gauche de sa boîte */
  ax: number;
  ay: number;
  axis: 'x' | 'y';
}

export interface LightPuzzle {
  id: string;
  width: number;
  height: number;
  /** Cases en ordre ligne par ligne : index = y * width + x. */
  cells: Cell[];
  /** Nombre de miroirs que le joueur peut poser sur les socles. */
  inventory: number;
  /** Index des cases manipulables (miroirs/lames orientables, socles), dans l'ordre. */
  interactive: number[];
  /** Objets tournants (leurs états suivent ceux des cases dans LightState). */
  objects: LightObject[];
  /** Quarts de tour de départ des objets. */
  objectStart: number[];
}

/**
 * État modifiable d'une énigme : une valeur par case manipulable (même ordre que `interactive`).
 * - miroir / lame orientable : 0 ou 1 (orientation)
 * - socle : -1 (vide), 0 (« / ») ou 1 (« \ »)
 * puis, pour chaque objet, son nombre de quarts de tour (0..3).
 */
export type LightState = number[];

export interface SimResult {
  /** Couleur reçue par chaque case (union des rayons). Index = y * width + x. */
  received: Uint8Array;
  /**
   * Demi-segments lumineux pour le rendu : pour la case i et la direction d,
   * `halfEdges[i * 4 + d]` = couleur du rayon entre le centre de la case et son bord côté d.
   */
  halfEdges: Uint8Array;
  /** Pour chaque cristal (cible ou noir) : est-il satisfait ? */
  crystals: { index: number; ok: boolean; received: Color; wanted: Color }[];
  solved: boolean;
}
