/** Sauvegarde locale de la partie (navigateur). Toute erreur de stockage est ignorée. */

const KEY = 'lueur-sauvegarde-v2';

export type Quality = 'haute' | 'moyenne' | 'basse';

export interface Settings {
  volume: number;
  sensitivity: number;
  quality?: Quality;
  /** symboles sur les couleurs (daltonisme) */
  symbols?: boolean;
  /** aides discrètes quand on bloque longtemps */
  hints?: boolean;
  /** volume de la musique (0..1) */
  music?: number;
}

export interface SaveData {
  solved: string[];
  states: Record<string, number[]>;
  player?: { x: number; z: number; yaw: number };
  /** temps de jeu en secondes */
  playTime?: number;
  settings?: Settings;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      return { solved: d.solved ?? [], states: d.states ?? {}, player: d.player, settings: d.settings, playTime: d.playTime };
    }
  } catch {
    /* stockage indisponible */
  }
  return { solved: [], states: {} };
}

export function writeSave(d: SaveData): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(d));
  } catch {
    /* stockage indisponible */
  }
}

export function clearSave(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible */
  }
}
