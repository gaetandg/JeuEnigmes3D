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
  // Allée C (est) : le verre
  { id: 'c1', x: 14, z: 39, yaw: E, requires: ['a5'] },
  { id: 'c2', x: 22, z: 44, yaw: E, requires: ['c1'] },
  { id: 'c3', x: 30, z: 37, yaw: E, requires: ['c2'] },
  { id: 'c4', x: 38, z: 43, yaw: E, requires: ['c3'] },
  // Allée D (nord) : socles et prisme
  { id: 'd1', x: 0, z: 19, yaw: N, requires: ['b5', 'c4'] },
  { id: 'd2', x: -9, z: 13, yaw: N, requires: ['d1'] },
  { id: 'd3', x: 9, z: 9, yaw: N, requires: ['d2'] },
  { id: 'd4', x: -8, z: 3, yaw: N, requires: ['d3'] },
  { id: 'd5', x: 4, z: -4, yaw: N, requires: ['d4'] },
];

export const GATES: GateSpot[] = [
  { id: 'porte-plage', x: 0, z: 86, rot: 0, width: 4, requires: ['a1'] },
  { id: 'porte-place', x: 0, z: 50, rot: 0, width: 4, requires: ['a5'] },
  { id: 'porte-nord', x: 0, z: 26, rot: 0, width: 4, requires: ['b5', 'c4'] },
  { id: 'porte-sortie', x: 0, z: -24, rot: 0, width: 4, requires: ['tours'] },
];

/**
 * Tours-Miroirs : la grille de l'énigme d'environnement posée sur le jardin.
 * Case (c, r) → x = x0 + c * dx, z = z0 + r * dz.
 */
export const TOWERS = { id: 'tours', requires: ['d5'], x0: -24, dx: 8, z0: -19, dz: 6, beamY: 3.2 };

export function towerCell(c: number, r: number): { x: number; z: number } {
  return { x: TOWERS.x0 + c * TOWERS.dx, z: TOWERS.z0 + r * TOWERS.dz };
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

/** Douze pupitres en cercle autour de l'atelier, le joueur regarde vers le centre. */
export const FOLD_PANELS: PanelSpot[] = Array.from({ length: 12 }, (_, i) => {
  const a = 0.35 + (i / 12) * Math.PI * 2; // départ côté est (vers la porte nord)
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
export const GRAND_PLI = { id: 'grand-pli', x: ATELIER.x, z: ATELIER.z, yaw: 0, requires: ['p12'], cell: 2.6 };

/** Plateaux aplanis hors du jardin. */
export const PLATEAUS: { x: number; z: number; r: number }[] = [ATELIER];

/** Chemins : suites de points (x, z). */
export const PATHS: [number, number][][] = [
  [[0, 108], [0, 98], [0, 86], [-4, 80], [2, 73], [-2, 65], [2, 58], [0, 50], [0, 38]],
  [[0, 38], [-10, 39], [-18, 42], [-26, 40], [-33, 41], [-40, 38], [-45, 35]],
  [[0, 38], [10, 39], [18, 42], [26, 40], [34, 41], [41, 42]],
  [[0, 38], [0, 26], [0, 22], [-5, 16], [4, 12], [-3, 6], [2, 0], [0, -8], [0, -24], [0, -34]],
  [[0, -34], [-14, -40], [-26, -46], [-34, -50]],
];

/** Place centrale du jardin. */
export const PLAZA = { x: 0, z: 38, r: 9 };

/** Zones à aplanir (cercles) : autour des panneaux, de la place, des portes. */
export const FLATS: { x: number; z: number; r: number }[] = [
  ...PANELS.map((p) => ({ x: p.x, z: p.z, r: 3.5 })),
  ...FOLD_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...GATES.map((g) => ({ x: g.x, z: g.z, r: 4 })),
  PLAZA,
  // dalles des tours
  ...[[1, 0], [3, 0], [5, 0], [1, 1], [5, 1], [0, 2], [1, 2], [5, 2]].map(([c, r]) => ({ ...towerCell(c!, r!), r: 2.5 })),
];


/** Position où se tient le joueur pour faire face à un panneau. */
export function standPoint(p: PanelSpot, dist = 1.9): { x: number; z: number } {
  return { x: p.x + Math.sin(p.yaw) * dist, z: p.z + Math.cos(p.yaw) * dist };
}
