/** Sauvegarde locale de la partie (navigateur). Toute erreur de stockage est ignorée. */

const KEY = 'lueur-sauvegarde-v1';

export interface SaveData {
  solved: string[];
  states: Record<string, number[]>;
  player?: { x: number; z: number; yaw: number };
  settings?: { volume: number; sensitivity: number };
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData>;
      return { solved: d.solved ?? [], states: d.states ?? {}, player: d.player, settings: d.settings };
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
