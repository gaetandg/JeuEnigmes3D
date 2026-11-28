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

/**
 * Une condition d'allumage : une énigme précise, ou une liste dont **une seule** suffit.
 * Une énigme s'allume quand **toutes** ses conditions sont remplies.
 */
export type Req = string | readonly string[];

export interface PanelSpot {
  id: string;
  x: number;
  z: number;
  yaw: number;
  /** conditions d'allumage (toutes ; une liste interne : l'une d'elles suffit) */
  requires: Req[];
}

/** Les conditions sont-elles remplies ? */
export function reqMet(reqs: readonly Req[], solved: (id: string) => boolean): boolean {
  return reqs.every((r) => (typeof r === 'string' ? solved(r) : r.some(solved)));
}

/** Toutes les énigmes citées par des conditions (pour tracer les câbles). */
export function reqIds(reqs: readonly Req[]): string[] {
  return reqs.flatMap((r) => (typeof r === 'string' ? [r] : [...r]));
}

/**
 * Progression souple : dans une suite d'énigmes, les trois premières s'allument l'une après
 * l'autre (les deux premières, des leçons, sont obligatoires) ; ensuite, chacune s'allume dès que
 * **l'une des deux précédentes** est résolue. On peut toujours laisser une énigme de côté et
 * continuer, mais jamais deux de suite.
 */
export function chainReq(ids: readonly string[], i: number, entry: Req[]): Req[] {
  if (i === 0) return entry;
  if (i < 3) return [ids[i - 1]!];
  return [[ids[i - 1]!, ids[i - 2]!]];
}

/** La grande énigme d'une zone : l'une des deux dernières de la suite. */
export function endReq(ids: readonly string[]): Req[] {
  return [[ids[ids.length - 1]!, ids[ids.length - 2]!]];
}

const seq = (prefix: string, n: number) => Array.from({ length: n }, (_, i) => `${prefix}${i + 1}`);

export interface GateSpot {
  id: string;
  x: number;
  z: number;
  /** Orientation du mur qui porte la porte (0 = mur est-ouest). */
  rot: number;
  width: number;
  requires: Req[];
}

// Les allées du jardin : trois énigmes dans l'ordre, puis l'une des deux précédentes suffit
// (voir chainReq) ; l'allée D attend la fin des deux allées B et C.
export const PANELS: PanelSpot[] = [
  // Allée A : de la plage au jardin
  { id: 'a1', x: 0, z: 95, yaw: N, requires: [] },
  { id: 'a2', x: -7, z: 78, yaw: N, requires: ['a1'] },
  { id: 'a3', x: 7, z: 70, yaw: N, requires: ['a2'] },
  { id: 'a4', x: -6, z: 62, yaw: N, requires: [['a3', 'a2']] },
  { id: 'a5', x: 5, z: 55, yaw: N, requires: [['a4', 'a3']] },
  // Allée B (ouest) : les couleurs
  { id: 'b1', x: -14, z: 39, yaw: W, requires: [['a5', 'a4']] },
  { id: 'b2', x: -22, z: 44, yaw: W, requires: ['b1'] },
  { id: 'b3', x: -30, z: 37, yaw: W, requires: ['b2'] },
  { id: 'b4', x: -37, z: 44, yaw: W, requires: [['b3', 'b2']] },
  { id: 'b5', x: -43, z: 35, yaw: W, requires: [['b4', 'b3']] },
  { id: 'b6', x: -45, z: 45, yaw: W, requires: [['b5', 'b4']] },
  // Allée C (est) : le verre
  { id: 'c1', x: 14, z: 39, yaw: E, requires: [['a5', 'a4']] },
  { id: 'c2', x: 22, z: 44, yaw: E, requires: ['c1'] },
  { id: 'c3', x: 30, z: 37, yaw: E, requires: ['c2'] },
  { id: 'c4', x: 38, z: 43, yaw: E, requires: [['c3', 'c2']] },
  { id: 'c5', x: 44, z: 35, yaw: E, requires: [['c4', 'c3']] },
  // Allée D (nord) : socles et prisme
  { id: 'd1', x: 0, z: 19, yaw: N, requires: [['b6', 'b5'], ['c5', 'c4']] },
  { id: 'd2', x: -9, z: 13, yaw: N, requires: ['d1'] },
  { id: 'd3', x: 9, z: 9, yaw: N, requires: ['d2'] },
  { id: 'd4', x: -8, z: 3, yaw: N, requires: [['d3', 'd2']] },
  { id: 'd5', x: 4, z: -4, yaw: N, requires: [['d4', 'd3']] },
  { id: 'd6', x: -12, z: -2, yaw: N, requires: [['d5', 'd4']] },
];

export const GATES: GateSpot[] = [
  { id: 'porte-plage', x: 0, z: 86, rot: 0, width: 4, requires: ['a1'] },
  { id: 'porte-place', x: 0, z: 50, rot: 0, width: 4, requires: [['a5', 'a4']] },
  { id: 'porte-nord', x: 0, z: 26, rot: 0, width: 4, requires: [['b6', 'b5'], ['c5', 'c4']] },
  { id: 'porte-sortie', x: 0, z: -24, rot: 0, width: 4, requires: ['tours'] },
];

/**
 * Tours-Miroirs : la grille de l'énigme d'environnement posée sur le jardin.
 * Case (c, r) → x = x0 + c * dx, z = z0 + r * dz.
 */
export const TOWERS = { id: 'tours', requires: [['d6', 'd5']] as Req[], x0: -24, dx: 8, z0: -19, dz: 6, beamY: 3.2 };

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
    requires: chainReq(seq('p', 13), i, ['tours']),
  };
});

/** Le Grand Pli, sur l'estrade au centre de l'atelier. */
export const GRAND_PLI = { id: 'grand-pli', x: ATELIER.x, z: ATELIER.z, yaw: 0, requires: endReq(seq('p', 13)), cell: 2.6 };

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
    requires: chainReq(seq('o', 12), i, ['grand-pli']),
  };
});

/** Le Cadran : théâtre d'ombres monumental au centre du cloître. */
export const CADRAN = { id: 'cadran', x: CLOITRE.x, z: CLOITRE.z - 1, yaw: 0, requires: endReq(seq('o', 12)), voxel: 1 };

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
    requires: chainReq(seq('f', 6), i, ['cadran']),
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
    requires: chainReq(seq('t', 8), i, ['f6']),
  };
});
/** le Grand Plateau, au centre de l'île : on se tient au sud (côté +z) pour le regarder */
export const GRAND_PLATEAU = { id: 'grand-plateau', x: SKY.x, z: SKY.z, yaw: 0, requires: endReq(seq('t', 8)), cell: 1.6 };

// ── zone 6 : les Racines du Phare (une grotte sous la mer, à l'ouest ; on s'y réveille après la bascule) ──
/** centre, altitude du sol et rayon moyen de la grotte */
export const CAVE = { x: -330, z: -20, y: -60, r: 30, height: 15 };
/** Bord de la grotte selon l'angle : des alcôves irrégulières. */
export function caveEdge(a: number): number {
  return CAVE.r + 3 * Math.sin(4 * a + 0.4) + 2 * Math.sin(7 * a + 1.3) + 1.2 * Math.sin(11 * a);
}
/** où l'on se réveille, et la pierre qui remonte au pied du phare (et celle qui y redescend) */
export const CAVE_ARRIVAL = { x: CAVE.x + 18, z: CAVE.z + 6, yaw: Math.PI / 2 + 0.28 }; // la fosse à droite, r1 à gauche
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
    requires: chainReq(seq('r', 6), i, ['grand-plateau']),
  };
});
export const RACINE_MERE = { id: 'racine-mere', x: CAVE.x, z: CAVE.z, yaw: 0, requires: endReq(seq('r', 6)), cell: 1.25 };

// ── zone 7 : la Bulle (une demi-sphère de verre au fond de l'océan, juste sous la lumière qui a
// répondu au large à la première fin) ──
/** centre, altitude du sol et rayon de la Bulle */
export const BUBBLE = { x: 100, z: 380, y: -50, r: 34 };
/** on arrive au nord de la Bulle, face au centre ; la pierre du retour est juste à côté */
export const BUBBLE_ARRIVAL = { x: BUBBLE.x, z: BUBBLE.z - 24, yaw: Math.PI };
export const BUBBLE_LIFT = { x: BUBBLE.x + 7, z: BUBBLE.z - 27 };
/** sur la plage du départ, la pierre qui s'allume quand la Racine-mère est reliée */
export const BEACH_STONE = { x: START.x + 7, z: START.z - 3 };
/** le 100 % : là où la barque de papier attend, au bord de l'eau devant la plage du départ */
export const PAPER_BOAT = { x: START.x - 5, z: START.z + 10.5 };
/** six tables de vases en cercle, la Grande Écluse au centre */
export const VASE_PANELS: PanelSpot[] = Array.from({ length: 6 }, (_, i) => {
  // de l'arrivée (nord), dans le sens des aiguilles d'une montre ; la place nord reste libre
  const a = -Math.PI / 2 + ((i + 1) * Math.PI * 2) / 7;
  const r = 21;
  return {
    id: `v${i + 1}`,
    x: BUBBLE.x + Math.cos(a) * r,
    z: BUBBLE.z + Math.sin(a) * r,
    yaw: Math.atan2(Math.cos(a), Math.sin(a)),
    requires: chainReq(seq('v', 6), i, ['racine-mere']),
  };
});
export const GRANDE_ECLUSE = { id: 'grande-ecluse', x: BUBBLE.x, z: BUBBLE.z + 3, yaw: 0, requires: endReq(seq('v', 6)), unit: 0.55 };

// ── les Éclats : énigmes secrètes ──
export type SecretKind = 'world-light' | 'light' | 'fold-desk' | 'fold-easel' | 'shadow' | 'tilt' | 'roots';
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
  // la suite : un plateau caché au bord est de l'Île du Ciel, un pupitre au fond d'une alcôve de la grotte
  { id: 'eclat-nuages', kind: 'tilt', x: 340.67, z: -11.76, yaw: -1.7708, requires: [] },
  { id: 'eclat-alcove', kind: 'roots', x: -357.52, z: -34.27, yaw: 1.0924, requires: [] },
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
/** la table d'orientation (la carte du gardien), au nord-ouest de la place, entre deux colonnes */
export const MAP_TABLE = { x: PLAZA.x - 3.7, z: PLAZA.z - 3.7, yaw: Math.PI / 4 };

/** Zones à aplanir (cercles) : autour des panneaux, de la place, des portes. */
export const FLATS: { x: number; z: number; r: number }[] = [
  ...PANELS.map((p) => ({ x: p.x, z: p.z, r: 3.5 })),
  ...FOLD_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...SHADOW_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...FINAL_PANELS.map((p) => ({ x: p.x, z: p.z, r: 3 })),
  ...SECRETS.filter((s) => s.kind !== 'world-light' && s.kind !== 'tilt' && s.kind !== 'roots').map((s) => ({ x: s.x, z: s.z, r: s.kind === 'fold-easel' ? 5 : 3 })),
  // le jardin des lanternes, d'un seul tenant : ses rayons sont horizontaux, tous ses socles
  // doivent être à la même hauteur (sinon les rayons passent au-dessus ou en dessous des miroirs)
  { x: SECRET_PLAGE.x0 + 2 * SECRET_PLAGE.dx, z: SECRET_PLAGE.z0 + SECRET_PLAGE.dz, r: 10.5 },
  ...GATES.map((g) => ({ x: g.x, z: g.z, r: 4 })),
  PLAZA,
  // dalles des tours
  ...towerCells().map(([c, r]) => ({ ...towerCell(c, r), r: 2.5 })),
];


/** Position où se tient le joueur pour faire face à un panneau. */
export function standPoint(p: Pick<PanelSpot, 'x' | 'z' | 'yaw'> & Partial<PanelSpot>, dist = 1.9): { x: number; z: number } {
  return { x: p.x + Math.sin(p.yaw) * dist, z: p.z + Math.cos(p.yaw) * dist };
}

// ── La Grotte des Échos : des énigmes sans fin, une par langage ────────────
/** la salle, sous la mer, loin au sud-ouest (on n'y voit rien d'autre : vue courte sous terre) */
export const ECHO = { x: -300, z: 260, y: -60, r: 13 };
/** l'entrée : un rocher creux sur la côte ouest, son ouverture tournée vers la mer (ouest) */
export const ECHO_MOUTH = { x: -100.5, z: -10 };
/** en sortant, devant l'ouverture, face à la mer */
export const ECHO_OUTSIDE = { x: -104.5, z: -10, yaw: Math.PI / 2 };
export const ECHO_ARRIVAL = { x: ECHO.x, z: ECHO.z + 9, yaw: 0 };
/** la pierre du retour, à côté de l'arrivée */
export const ECHO_EXIT = { x: ECHO.x + 3.2, z: ECHO.z + 10.2 };
export type EchoLang = 'lumiere' | 'pliage' | 'ombres' | 'inclinaison' | 'racines' | 'vases';
/** les six alcôves en cercle (la place du sud reste libre : c'est l'arrivée), et ce qui les allume */
export const ECHO_MODULES: { kind: EchoLang; x: number; z: number; yaw: number; a: number; unlock: string }[] = (
  [['lumiere', 'tours'], ['pliage', 'grand-pli'], ['ombres', 'cadran'], ['inclinaison', 'grand-plateau'], ['racines', 'racine-mere'], ['vases', 'grande-ecluse']] as const
).map(([kind, unlock], i) => {
  const a = Math.PI / 2 + ((i + 1) * Math.PI * 2) / 7;
  const r = 8.2;
  return { kind, unlock, a, x: ECHO.x + Math.cos(a) * r, z: ECHO.z + Math.sin(a) * r, yaw: Math.atan2(Math.cos(a), Math.sin(a)) };
});
/** les trois pierres de taille d'une alcôve (petite, moyenne, grande), sur le côté */
export function echoStones(m: { x: number; z: number; a: number }): { x: number; z: number; r: number }[] {
  const tx = -Math.sin(m.a);
  const tz = Math.cos(m.a);
  const rx = -Math.cos(m.a);
  const rz = -Math.sin(m.a);
  return [0.3, 0.42, 0.54].map((r, k) => ({ x: m.x + tx * (1.9 + k * 0.95) + rx * 0.7, z: m.z + tz * (1.9 + k * 0.95) + rz * 0.7, r }));
}
