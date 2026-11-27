import { ZONE1_TOWERS } from '../puzzles/zone1.ts';
/**
 * Plan de l'île : position des panneaux, portes, murs et chemins.
 * Repère : x vers l'est, z vers le sud (la caméra regarde vers -z quand yaw = 0).
 * yaw d'un panneau = direction dans laquelle regarde le joueur qui lui fait face.
 */

export const GARDEN_Y = 4; // altitude du jardin
export const GARDEN = { x0: -50, x1: 50, z0: -24, z1: 86 };
export const START = { x: 0, z: 104, yaw: 0 };
export const LIGHTHOUSE = { x: 0, z: -112 };

const N = 0; // regarder vers le nord
const W = Math.PI / 2; // regarder vers l'ouest
const E = -Math.PI / 2; // regarder vers l'est

export interface PanelSpot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** Panneaux à résoudre pour que celui-ci s'allume (un seul suffit s'il y en a plusieurs : non, tous). */
  requires: string[];
}

export interface GateSpot {
  id: string;
  x: number;
  z: number;
  /** Orientation du mur qui porte la porte (0 = mur est-ouest). */
  rot: number;
  width: number;
  requires: string[];
}

export const PANELS: PanelSpot[] = [
  // Allée A : de la plage au jardin
  { id: 'a1', x: 0, z: 95, yaw: N, requires: [] },
  { id: 'a2', x: -7, z: 78, yaw: N, requires: ['a1'] },
  { id: 'a3', x: 7, z: 70, yaw: N, requires: ['a2'] },
  { id: 'a4', x: -6, z: 62, yaw: N, requires: ['a3'] },
  { id: 'a5', x: 5, z: 55, yaw: N, requires: ['a4'] },
  // Allée B (ouest) : les couleurs
  { id: 'b1', x: -14, z: 39, yaw: W, requires: ['a5'] },
  { id: 'b2', x: -22, z: 44, yaw: W, requires: ['b1'] },
  { id: 'b3', x: -30, z: 37, yaw: W, requires: ['b2'] },
  { id: 'b4', x: -37, z: 44, yaw: W, requires: ['b3'] },
  { id: 'b5', x: -43, z: 35, yaw: W, requires: ['b4'] },
  { id: 'b6', x: -45, z: 45, yaw: W, requires: ['b5'] },
  // Allée C (est) : le verre
  { id: 'c1', x: 14, z: 39, yaw: E, requires: ['a5'] },
  { id: 'c2', x: 22, z: 44, yaw: E, requires: ['c1'] },
  { id: 'c3', x: 30, z: 37, yaw: E, requires: ['c2'] },
  { id: 'c4', x: 38, z: 43, yaw: E, requires: ['c3'] },
  { id: 'c5', x: 44, z: 35, yaw: E, requires: ['c4'] },
  // Allée D (nord) : socles et prisme
  { id: 'd1', x: 0, z: 19, yaw: N, requires: ['b6', 'c5'] },
  { id: 'd2', x: -9, z: 13, yaw: N, requires: ['d1'] },
  { id: 'd3', x: 9, z: 9, yaw: N, requires: ['d2'] },
  { id: 'd4', x: -8, z: 3, yaw: N, requires: ['d3'] },
  { id: 'd5', x: 4, z: -4, yaw: N, requires: ['d4'] },
  { id: 'd6', x: -12, z: -2, yaw: N, requires: ['d5'] },
];

export const GATES: GateSpot[] = [
  { id: 'porte-plage', x: 0, z: 86, rot: 0, width: 4, requires: ['a1'] },
  { id: 'porte-place', x: 0, z: 50, rot: 0, width: 4, requires: ['a5'] },
  { id: 'porte-nord', x: 0, z: 26, rot: 0, width: 4, requires: ['b6', 'c5'] },
  { id: 'porte-sortie', x: 0, z: -24, rot: 0, width: 4, requires: ['tours'] },
];

/**
 * Tours-Miroirs : la grille de l'énigme d'environnement posée sur le jardin.
 * Case (c, r) → x = x0 + c * dx, z = z0 + r * dz.
 */
export const TOWERS = { id: 'tours', requires: ['d6'], x0: -24, dx: 8, z0: -19, dz: 6, beamY: 3.2 };

export function towerCell(c: number, r: number): { x: number; z: number } {
  return { x: TOWERS.x0 + c * TOWERS.dx, z: TOWERS.z0 + r * TOWERS.dz };
}

/** Cases occupées de la grille des tours (lues dans la définition de l'énigme). */
export function towerCells(): [number, number][] {
  const rows = ZONE1_TOWERS.grid.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => l.split(/\s+/));
  const out: [number, number][] = [];
  rows.forEach((row, r) => row.forEach((t, c) => {
    if (t !== '.') out.push([c, r]);
  }));
  return out;
}

/** Murs du jardin (segments), percés aux portes. */
export const WALLS: [number, number, number, number][] = (() => {
  const { x0, x1, z0, z1 } = GARDEN;
  const segs: [number, number, number, number][] = [];
  // mur est-ouest avec une ouverture de largeur w centrée en x = 0
  const ew = (z: number, w: number) => {
    segs.push([x0, z, -w / 2, z], [w / 2, z, x1, z]);
  };
  ew(z1, 4);
  ew(50, 4);
  ew(26, 4);
  ew(z0, 4);
  segs.push([x0, z0, x0, z1], [x1, z0, x1, z1]);
  return segs;
})();

// ── zone 2 : l'Atelier de Papier (plateau à l'ouest, au-delà de la porte nord) ──
export const ATELIER = { x: -50, z: -56, r: 21 };

/** Treize pupitres en cercle autour de l'atelier, le joueur regarde vers le centre. */
export const FOLD_PANELS: PanelSpot[] = Array.from({ length: 13 }, (_, i) => {
  const a = 0.35 + (i / 13) * Math.PI * 2; // départ côté est (vers la porte nord)
  const r = 15;
  return {
    id: `p${i + 1}`,
    x: ATELIER.x + Math.cos(a) * r,
    z: ATELIER.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: i === 0 ? ['tours'] : [`p${i}`],
  };
});

/** Le Grand Pli, sur l'estrade au centre de l'atelier. */
export const GRAND_PLI = { id: 'grand-pli', x: ATELIER.x, z: ATELIER.z, yaw: 0, requires: ['p13'], cell: 2.6 };

// ── zone 3 : le Cloître des Ombres (plateau à l'est) ──
export const CLOITRE = { x: 50, z: -56, r: 23, half: 18 };

/** Douze théâtres d'ombres en cercle, le joueur regarde vers le centre. */
export const SHADOW_PANELS: PanelSpot[] = Array.from({ length: 12 }, (_, i) => {
  const a = Math.PI + 0.3 + (i / 12) * Math.PI * 2; // départ côté ouest (entrée)
  const r = 12.5;
  return {
    id: `o${i + 1}`,
    x: CLOITRE.x + Math.cos(a) * r,
    z: CLOITRE.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: i === 0 ? ['grand-pli'] : [`o${i}`],
  };
});

/** Le Cadran : théâtre d'ombres monumental au centre du cloître. */
export const CADRAN = { id: 'cadran', x: CLOITRE.x, z: CLOITRE.z - 1, yaw: 0, requires: ['o12'], voxel: 1 };

// ── zone 4 : le Phare (sommet de l'île) ──
export const PHARE = { x: LIGHTHOUSE.x, z: LIGHTHOUSE.z + 6, r: 17 };

/** Cinq panneaux en arc au pied du phare ; le joueur regarde vers le phare. */
export const FINAL_PANELS: (PanelSpot & { kind: 'light' | 'fold' })[] = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6'].map((id, i) => {
  const a = Math.PI / 2 + (i - 2.5) * 0.42;
  const r = 13;
  return {
    id,
    kind: id === 'f3' || id === 'f4' ? 'fold' : 'light',
    x: LIGHTHOUSE.x + Math.cos(a) * r,
    z: LIGHTHOUSE.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: i === 0 ? ['cadran'] : [['f1', 'f2', 'f3', 'f4', 'f5'][i - 1]!],
  };
});

// ── zone 5 : l'Île du Ciel (elle surgit de la mer et monte dans le ciel après la fin) ──
/** centre, altitude du sol et rayon de l'île ; elle flotte au-dessus de la mer, à l'est */
export const SKY = { x: 300, z: -20, y: 110, r: 44 };
/**
 * Bord de l'Île du Ciel selon l'angle (radians, autour de son centre) : des caps et des criques,
 * et un cap plus avancé à l'ouest, qui porte la pierre du retour. Jamais à moins de 33 m du centre
 * (les plateaux sont à 25 m).
 */
export function skyEdge(a: number): number {
  const west = Math.max(0, Math.cos(a - Math.PI)) ** 4;
  return SKY.r - 3 + 4 * Math.sin(3 * a + 0.7) + 2.5 * Math.sin(5 * a + 2.1) + 1.5 * Math.sin(9 * a + 0.3) + 6 * west;
}

/** pierre d'envol au pied du phare, et son pendant sur l'île (côté ouest, face à l'archipel) */
export const LIFT = { x: 0, z: -91 };
export const SKY_LIFT = { x: SKY.x - 37, z: SKY.z };
/** où l'on arrive sur l'île (quelques pas après la pierre, tourné vers le centre) */
export const SKY_ARRIVAL = { x: SKY.x - 33, z: SKY.z, yaw: -Math.PI / 2 };

/** Huit plateaux d'inclinaison en cercle (l'ouest, où l'on arrive, reste libre). */
export const SKY_PANELS: PanelSpot[] = Array.from({ length: 8 }, (_, i) => {
  const a = Math.PI + ((i + 1) * Math.PI * 2) / 9;
  const r = 25;
  return {
    id: `t${i + 1}`,
    x: SKY.x + Math.cos(a) * r,
    z: SKY.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: i === 0 ? ['f6'] : [`t${i}`],
  };
});
/** le Grand Plateau, au centre de l'île : on se tient au sud (côté +z) pour le regarder */
export const GRAND_PLATEAU = { id: 'grand-plateau', x: SKY.x, z: SKY.z, yaw: 0, requires: ['t8'], cell: 1.6 };

// ── zone 6 : les Racines du Phare (une grotte sous la mer, à l'ouest ; on s'y réveille après la bascule) ──
/** centre, altitude du sol et rayon moyen de la grotte */
export const CAVE = { x: -330, z: -20, y: -60, r: 30, height: 15 };
/** Bord de la grotte selon l'angle : des alcôves irrégulières. */
export function caveEdge(a: number): number {
  return CAVE.r + 3 * Math.sin(4 * a + 0.4) + 2 * Math.sin(7 * a + 1.3) + 1.2 * Math.sin(11 * a);
}
/** où l'on se réveille, et la pierre qui remonte au pied du phare (et celle qui y redescend) */
export const CAVE_ARRIVAL = { x: CAVE.x + 18, z: CAVE.z + 6, yaw: Math.PI / 2 - 0.32 };
export const CAVE_LIFT = { x: CAVE.x + 22, z: CAVE.z - 4 };
export const DEEP_LIFT = { x: 0, z: -103.6 };
/** six pupitres de racines en cercle, la Racine-mère au centre (au fond d'une fosse) */
export const ROOT_PANELS: PanelSpot[] = Array.from({ length: 6 }, (_, i) => {
  const a = Math.PI * 0.25 + (i * Math.PI * 2) / 7;
  const r = 19;
  return {
    id: `r${i + 1}`,
    x: CAVE.x + Math.cos(a) * r,
    z: CAVE.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: i === 0 ? ['grand-plateau'] : [`r${i}`],
  };
});
export const RACINE_MERE = { id: 'racine-mere', x: CAVE.x, z: CAVE.z, yaw: 0, requires: ['r6'], cell: 1.25 };

// ── les Éclats : énigmes secrètes ──
export type SecretKind = 'world-light' | 'light' | 'fold-desk' | 'fold-easel' | 'shadow';
export interface SecretSpot extends PanelSpot {
  kind: SecretKind;
}

export const SECRETS: SecretSpot[] = [
  { id: 'eclat-plage', kind: 'world-light', x: -46, z: 96, yaw: 0, requires: [] },
  { id: 'eclat-bosquet', kind: 'light', x: 66, z: 22, yaw: E, requires: [] },
  { id: 'eclat-voile', kind: 'fold-easel', x: -72, z: 8, yaw: W, requires: [] },
  { id: 'eclat-statues', kind: 'shadow', x: 84, z: -40, yaw: E, requires: [] },
  { id: 'eclat-belvedere', kind: 'light', x: -16, z: -104, yaw: W, requires: [] },
  { id: 'eclat-dunes', kind: 'fold-desk', x: 38, z: 102, yaw: N, requires: [] },
  { id: 'eclat-gardiens', kind: 'shadow', x: 8, z: -121, yaw: Math.PI, requires: [] },
];

/** Le jardin des lanternes (grille d'environnement de la plage ouest). */
export const SECRET_PLAGE = { x0: -46, z0: 96, dx: 4, dz: 4, beamY: 1.7, scale: 0.42, name: 'jardin des lanternes' };
/** Taille d'une case de la voile (chevalet) */
export const SECRET_VOILE_CELL = 1.3;

/** Plateaux aplanis hors du jardin. */
export const PLATEAUS: { x: number; z: number; r: number }[] = [ATELIER, CLOITRE, PHARE];

/** Chemins : suites de points (x, z). */
export const PATHS: [number, number][][] = [
  [[0, 108], [0, 98], [0, 86], [-4, 80], [2, 73], [-2, 65], [2, 58], [0, 50], [0, 38]],
  [[0, 38], [-10, 39], [-18, 42], [-26, 40], [-33, 41], [-40, 38], [-42, 42], [-43, 45]],
  [[0, 38], [10, 39], [18, 42], [26, 40], [34, 41], [41, 41], [42, 35]],
  [[0, 38], [0, 26], [0, 22], [-5, 16], [4, 12], [-3, 6], [2, 0], [0, -8], [0, -24], [0, -34]],
  [[0, -34], [-14, -40], [-26, -46], [-34, -50]],
  [[0, -34], [12, -40], [22, -48], [CLOITRE.x - CLOITRE.half - 3, CLOITRE.z]],
  [[0, -34], [3, -50], [-2, -64], [9, -72], [-3, -80], [4, -88], [0, -96]],
];

/** Place centrale du jardin. */
export const PLAZA = { x: 0, z: 38, r: 9 };

/** Zones à aplanir (cercles) : autour des panneaux, de la place, des portes. */
export const FLATS: { x: number; z: number; r: number }[] = [
  ...PANELS.map((p) => ({ x: p.x, z: p.z, r: 3.5 })),
  ...FOLD_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...SHADOW_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...FINAL_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...SECRETS.filter((s) => s.kind !== 'world-light').map((s) => ({ x: s.x, z: s.z, r: s.kind === 'fold-easel' ? 5 : 3 })),
  ...[0, 1, 2].flatMap((r) => [0, 1, 2, 3, 4].map((c) => ({ x: SECRET_PLAGE.x0 + c * SECRET_PLAGE.dx, z: SECRET_PLAGE.z0 + r * SECRET_PLAGE.dz, r: 1.5 }))),
  ...GATES.map((g) => ({ x: g.x, z: g.z, r: 4 })),
  PLAZA,
  // dalles des tours
  ...towerCells().map(([c, r]) => ({ ...towerCell(c, r), r: 2.5 })),
];


/** Position où se tient le joueur pour faire face à un panneau. */
export function standPoint(p: PanelSpot, dist = 1.9): { x: number; z: number } {
  return { x: p.x + Math.sin(p.yaw) * dist, z: p.z + Math.cos(p.yaw) * dist };
}
