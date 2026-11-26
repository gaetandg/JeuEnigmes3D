import type * as THREE from 'three';
import type { LightPuzzle, LightState } from '../core/light/index.ts';

export type InteractResult = 'ok' | 'denied' | 'locked';

/** Ce que le jeu attend d'une énigme affichée (panneau ou énigme d'environnement). */
export interface PuzzleView {
  readonly puzzle: LightPuzzle;
  readonly group: THREE.Group;
  readonly pickables: THREE.Mesh[];
  /** distance maximale d'interaction */
  readonly reach: number;
  state: LightState;
  solved: boolean;
  powered: boolean;
  onSolved: (() => void) | null;
  setPowered(on: boolean): void;
  setHover(k: number | null): void;
  interact(k: number, reverse?: boolean): InteractResult;
  applyState(s: LightState, instant?: boolean): void;
  markSolved(): void;
  setDetail(visible: boolean): void;
  update(dt: number, time: number): void;
}
