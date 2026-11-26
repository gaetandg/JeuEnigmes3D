import type * as THREE from 'three';

export type InteractResult = 'ok' | 'denied' | 'locked';

/** Ce que le jeu attend d'une énigme affichée (panneau ou énigme d'environnement). */
export interface PuzzleView {
  readonly id: string;
  readonly group: THREE.Group;
  readonly pickables: THREE.Mesh[];
  /** distance maximale d'interaction */
  readonly reach: number;
  /** état sérialisable (sauvegarde) */
  state: number[];
  solved: boolean;
  powered: boolean;
  onSolved: (() => void) | null;
  setPowered(on: boolean): void;
  setHover(k: number | null): void;
  interact(k: number, reverse?: boolean): InteractResult;
  applyState(s: number[], instant?: boolean): void;
  /** une solution (état) trouvée par le solveur — pour les tests */
  solution(): number[] | null;
  /**
   * Aide discrète : fait luire une pièce à changer (ou la pierre de remise à zéro).
   * Renvoie l'indice de la pièce désignée, ou null s'il n'y a rien à montrer.
   */
  hint(): number | null;
  markSolved(): void;
  setDetail(visible: boolean): void;
  update(dt: number, time: number): void;
}
