/** API de test exposée par le jeu (window.__game), partagée par les fichiers de test. */
export type Api = {
  ready: boolean;
  frames: () => number;
  panels: () => { id: string; powered: boolean; solved: boolean }[];
  view: (id: string) => void;
  teleport: (x: number, z: number, yaw: number, pitch?: number) => void;
  solve: (id: string) => boolean;
  solveAll: () => string[];
  interact: (id: string, k: number, reverse?: boolean) => string | undefined;
  aim: (id: string, k: number) => void;
  state: (id: string) => number[];
  gateOpen: (id: string) => number;
  advance: (s: number) => void;
  player: () => { x: number; y: number; z: number };
  move: (f: number, r: number, s: number) => void;
  hovered: () => { id: string; k: number } | null;
  drawCalls: () => number;
  ended: () => boolean;
  hint: (id: string) => number | null;
  hintMove: (id: string) => { k: number; reverse: boolean } | null;
  lightErrors: (id: string) => number;
  notes: () => string[];
  hoveredNote: () => string | null;
  readNote: (id: string) => void;
  aimNote: (id: string) => void;
  startRise: () => void;
  skyRisen: () => boolean;
  sequences: () => { rise: boolean; lift: string | null; finale: boolean; bascule: boolean; passage: boolean; roots: boolean };
  startBascule: () => void;
  deep: () => boolean;
  cheat: (action: 'goto' | 'before' | 'upto' | 'all', id: string) => void;
  lighthouseY: () => number;
  requestHelp: () => void;
  mapTable: () => number;
  goalRings: () => boolean;
  help: (id: string, addStuck?: number) => { level: number; gesture: boolean; stuck: number };
  map: () => { marks: { id: string; zone: string; state: 'solved' | 'open' | 'locked' }[]; shards: unknown[]; sky: boolean; deep: boolean };
  answered: () => boolean;
  homecoming: () => boolean;
  guides: () => number;
  shards: () => number;
  memory: () => { geometries: number; textures: number };
  hover: (id: string, k: number | null) => void;
};
declare global {
  interface Window {
    __game: Api;
  }
}

