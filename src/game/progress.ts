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
  /** champ de vision (degrés) */
  fov?: number;
  invertY?: boolean;
  bob?: boolean;
  /** colonnes de lumière au-dessus des énigmes en attente */
  guides?: boolean;
}

export interface SaveData {
  solved: string[];
  states: Record<string, number[]>;
  player?: { x: number; z: number; yaw: number };
  /** temps de jeu en secondes */
  playTime?: number;
  /** billets du gardien déjà lus */
  notes?: string[];
  /** l'Île du Ciel est montée (la suite après la fin) */
  sky?: boolean;
  /** la bascule a eu lieu : la grotte des Racines est ouverte, le phare s'est enfoncé */
  deep?: boolean;
  /** on a plongé jusqu'à la Bulle (la première plongée est une séquence) */
  bubble?: boolean;
  settings?: Settings;
}

export function loadSave(): SaveData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const d = JSON.parse(raw) as Partial<SaveData> | null;
      // une sauvegarde abîmée mais lisible ne doit pas passer telle quelle (« "d1" ».includes…)
      const solved = Array.isArray(d?.solved) ? d.solved.filter((x): x is string => typeof x === 'string') : [];
      const states = d?.states && typeof d.states === 'object' && !Array.isArray(d.states) ? d.states : {};
      const p = d?.player;
      const player = p && [p.x, p.z, p.yaw].every((v) => Number.isFinite(v)) ? p : undefined;
      const settings = d?.settings && typeof d.settings === 'object' ? d.settings : undefined;
      const playTime = Number.isFinite(d?.playTime) ? d!.playTime : undefined;
      const notes = Array.isArray(d?.notes) ? d.notes.filter((x): x is string => typeof x === 'string') : [];
      return { solved, states, player, settings, playTime, notes, sky: d?.sky === true, deep: d?.deep === true, bubble: d?.bubble === true };
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
