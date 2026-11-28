import * as THREE from 'three';
import { Perlin2D, clamp, lerp, smoothstep } from './noise.ts';
import { BUBBLE, CAVE, FLATS, GARDEN, GARDEN_Y, LIGHTHOUSE, PATHS, PLATEAUS, SKY, caveEdge, skyEdge } from './layout.ts';

const noise = new Perlin2D(7);
const ISLAND_CENTER = { x: 0, z: -15 };

/** Distance d'un point à un segment. */
export function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number): number {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  const t = l2 === 0 ? 0 : clamp(((px - ax) * dx + (pz - az) * dz) / l2, 0, 1);
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/** Distance au chemin le plus proche. */
export function distToPath(x: number, z: number): number {
  let d = Infinity;
  for (const path of PATHS) {
    for (let i = 0; i < path.length - 1; i++) {
      const [ax, az] = path[i]!;
      const [bx, bz] = path[i + 1]!;
      d = Math.min(d, distToSegment(x, z, ax, az, bx, bz));
    }
  }
  return d;
}

/** Altitude naturelle de l'île (sans aménagement). */
function natural(x: number, z: number): number {
  const dx = x - ISLAND_CENTER.x;
  const dz = z - ISLAND_CENTER.z;
  const ang = Math.atan2(dz, dx);
  const radius = 140 + 14 * noise.noise(Math.cos(ang) * 1.3 + 5, Math.sin(ang) * 1.3 + 5);
  const r = Math.hypot(dx, dz) / radius; // 0 au centre, 1 sur la côte
  const land = 1 - smoothstep(0.62, 1.05, r);
  let h = lerp(-7, GARDEN_Y + 1.5, land);
  h += noise.fbm(x * 0.018, z * 0.018, 4) * 7 * land;
  // colline du phare
  const lh = Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z);
  h += 24 * Math.exp(-(lh * lh) / (2 * 26 * 26));
  return h;
}

/** Masque du jardin : 1 à l'intérieur, 0 loin à l'extérieur (bord doux). */
function gardenMask(x: number, z: number): number {
  const m = 10;
  const ix = smoothstep(GARDEN.x0 - m, GARDEN.x0 + 2, x) * (1 - smoothstep(GARDEN.x1 - 2, GARDEN.x1 + m, x));
  const iz = smoothstep(GARDEN.z0 - m, GARDEN.z0 + 2, z) * (1 - smoothstep(GARDEN.z1 - 2, GARDEN.z1 + m, z));
  return ix * iz;
}

/** Altitude du sol en (x, z), aménagements compris. Utilisée par le rendu ET par le joueur. */
/** Altitude aménagée (jardin, plage, plateaux), sans chemins ni cercles aplanis. */
function baseHeight(x: number, z: number): number {
  let h = natural(x, z);
  // jardin : plateau légèrement ondulé
  const g = gardenMask(x, z);
  if (g > 0) h = lerp(h, GARDEN_Y + noise.fbm(x * 0.05, z * 0.05, 2) * 0.8, g);
  // plage au sud : pente douce vers la mer
  if (z > GARDEN.z1 - 4 && Math.abs(x) < 70) {
    const t = smoothstep(GARDEN.z1 - 4, 132, z);
    const beach = lerp(GARDEN_Y, -2.5, t) + noise.noise(x * 0.08, z * 0.08) * 0.3;
    const w = 1 - smoothstep(40, 70, Math.abs(x));
    h = lerp(h, beach, w);
  }
  // plateaux des autres zones
  for (const pl of PLATEAUS) {
    const d = Math.hypot(x - pl.x, z - pl.z);
    if (d < pl.r + 14) {
      const t = 1 - smoothstep(pl.r, pl.r + 14, d);
      h = lerp(h, plateauHeight(pl) + noise.fbm(x * 0.06, z * 0.06, 2) * 0.4, t);
    }
  }
  return h;
}

const plateauCache = new Map<string, number>();
function plateauHeight(pl: { x: number; z: number }): number {
  const key = `${pl.x},${pl.z}`;
  let v = plateauCache.get(key);
  if (v === undefined) {
    v = natural(pl.x, pl.z);
    plateauCache.set(key, v);
  }
  return v;
}

/** Altitude du sol en (x, z), aménagements compris. Utilisée par le rendu ET par le joueur. */
export function heightAt(x: number, z: number): number {
  return groundHeight(x, z);
}

/** Dans le sol de la grotte des Racines (sous le niveau de la mer, mais à pied sec). */
export function inCave(x: number, z: number): boolean {
  const dc = Math.hypot(x - CAVE.x, z - CAVE.z);
  return dc < CAVE.r + 8 && dc < caveEdge(Math.atan2(z - CAVE.z, x - CAVE.x));
}

/** Sous la Bulle (au fond de l'océan, mais à l'air libre). */
export function inBubble(x: number, z: number): boolean {
  return Math.hypot(x - BUBBLE.x, z - BUBBLE.z) < BUBBLE.r - 1.2;
}

/** Peut-on poser le pied ici ? Pas dans la mer (la grotte et la Bulle, elles, sont à pied sec). */
export function walkable(x: number, z: number): boolean {
  return inCave(x, z) || inBubble(x, z) || heightAt(x, z) >= -0.3;
}

function groundHeight(x: number, z: number): number {
  // l'Île du Ciel : un sol presque plat, très haut ; hors de son disque, c'est le vide
  // (la mer en dessous), où le joueur ne peut pas avancer, comme au bord de l'eau
  const ds = Math.hypot(x - SKY.x, z - SKY.z);
  if (ds < SKY.r + 14 && ds < skyEdge(Math.atan2(z - SKY.z, x - SKY.x))) return skyHeight(x, z, ds);
  // la Bulle : un sol de sable presque plat, au fond de l'océan
  const db = Math.hypot(x - BUBBLE.x, z - BUBBLE.z);
  if (db < BUBBLE.r + 4) return BUBBLE.y + noise.noise(x * 0.12, z * 0.12) * 0.25 * smoothstep(6, 12, db) - Math.max(0, db - BUBBLE.r) * 0.3;
  // la grotte des Racines : un sol de terre sous la mer ; au-delà de ses parois, le roc
  if (inCave(x, z)) {
    const dc = Math.hypot(x - CAVE.x, z - CAVE.z);
    return CAVE.y + noise.noise(x * 0.09, z * 0.09) * 0.5 * smoothstep(9, 13, dc);
  }
  let h = baseHeight(x, z);
  // chemins : légèrement adoucis
  const dp = distToPath(x, z);
  const pathW = 1 - smoothstep(1.2, 3.5, dp);
  if (pathW > 0) h = lerp(h, Math.min(h, baseHeight(x, z) - 0.05), pathW * 0.6);
  for (const f of FLATS) {
    const d = Math.hypot(x - f.x, z - f.z);
    if (d < f.r + 3) {
      const t = 1 - smoothstep(f.r, f.r + 3, d);
      h = lerp(h, flatHeight(f.x, f.z), t);
    }
  }
  return h;
}

/** Sol de l'Île du Ciel : une place plate au centre (le Grand Plateau), de douces ondulations autour. */
function skyHeight(x: number, z: number, ds: number): number {
  const wave = noise.noise(x * 0.07, z * 0.07) * 0.6 + noise.noise(x * 0.2, z * 0.2) * 0.12;
  return SKY.y + wave * smoothstep(11, 16, ds);
}

const flatCache = new Map<string, number>();
function flatHeight(x: number, z: number): number {
  const key = `${x},${z}`;
  let v = flatCache.get(key);
  if (v === undefined) {
    v = baseHeight(x, z);
    flatCache.set(key, v);
  }
  return v;
}

// ── maillage ─────────────────────────────────────────────────────────────

const C_SAND = new THREE.Color('#f2d69c');
const C_SAND_WET = new THREE.Color('#c7a874');
const C_GRASS = new THREE.Color('#8fbf5a');
const C_GRASS2 = new THREE.Color('#6fa84a');
const C_ROCK = new THREE.Color('#b9ad9d');
const C_PATH = new THREE.Color('#cdb88f');
const C_SEABED = new THREE.Color('#5aa7a0');

function colorAt(x: number, z: number, h: number, slope: number, out: THREE.Color): THREE.Color {
  if (h < -0.6) out.copy(C_SEABED).lerp(C_SAND_WET, clamp((h + 4) / 3.4, 0, 1));
  else if (h < 1.2) out.copy(C_SAND_WET).lerp(C_SAND, clamp((h + 0.6) / 1.8, 0, 1));
  else {
    const n = noise.noise(x * 0.07, z * 0.07) * 0.5 + 0.5;
    out.copy(C_GRASS).lerp(C_GRASS2, n);
    if (h < 2.2 && z > GARDEN.z1) out.lerp(C_SAND, clamp((2.2 - h) / 1.0, 0, 1));
  }
  // plage du sud : du sable jusqu'au mur du jardin
  if (z > GARDEN.z1 + 1 && h > -0.6) {
    const w = (1 - smoothstep(45, 65, Math.abs(x))) * smoothstep(GARDEN.z1 + 1, GARDEN.z1 + 7, z);
    out.lerp(C_SAND, w * clamp((5.5 - h) / 2, 0, 1));
  }
  if (slope > 0.55) out.lerp(C_ROCK, clamp((slope - 0.55) * 3, 0, 1));
  const dp = distToPath(x, z);
  if (dp < 2.2 && h > 0.5) out.lerp(C_PATH, 1 - smoothstep(1.2, 2.2, dp));
  return out;
}

/** Maillage low-poly à facettes (une couleur par triangle). */
/**
 * Carte des hauts-fonds pour la mer : l'altitude du sol près du niveau de l'eau, en niveaux de
 * gris (0 = 3 m sous l'eau ou plus, 1 = 1 m au-dessus ou plus). Réutilise les altitudes déjà
 * calculées pour le maillage du terrain : aucun coût au démarrage.
 */
export interface ShoreMap {
  texture: THREE.DataTexture;
  /** coin (x, z) et côté (m) de la zone couverte */
  x0: number;
  z0: number;
  size: number;
}
export const SHORE_MIN = -3;
export const SHORE_RANGE = 4;

export function buildTerrain(size = 320, segments = 160): { mesh: THREE.Mesh; shore: ShoreMap } {
  const step = size / segments;
  const half = size / 2;
  const cz = ISLAND_CENTER.z;
  const hs: number[] = [];
  for (let j = 0; j <= segments; j++) {
    for (let i = 0; i <= segments; i++) {
      const x = -half + i * step;
      const z = cz - half + j * step;
      hs.push(heightAt(x, z));
    }
  }
  const H = (i: number, j: number) => hs[j * (segments + 1) + i]!;
  const positions = new Float32Array(segments * segments * 6 * 3);
  const colors = new Float32Array(segments * segments * 6 * 3);
  const col = new THREE.Color();
  let p = 0;
  // pente et couleur calculées par CARRÉ (les deux triangles partagent la même teinte de
  // base) : sinon la diagonale alternée dessine un damier sur les pentes
  let quadSlope = 0;
  const pushTri = (pts: [number, number, number][]) => {
    const [a, b, c] = pts;
    const cx = (a![0] + b![0] + c![0]) / 3;
    const czz = (a![2] + b![2] + c![2]) / 3;
    const ch = (a![1] + b![1] + c![1]) / 3;
    colorAt(cx, czz, ch, quadSlope, col);
    // légère variation par triangle pour l'aspect « facettes »
    const v = 0.96 + ((Math.sin(cx * 12.9898 + czz * 78.233) * 43758.5453) % 1 + 1) % 1 * 0.08;
    for (const pt of pts) {
      positions[p] = pt[0];
      positions[p + 1] = pt[1];
      positions[p + 2] = pt[2];
      colors[p] = col.r * v;
      colors[p + 1] = col.g * v;
      colors[p + 2] = col.b * v;
      p += 3;
    }
  };
  for (let j = 0; j < segments; j++) {
    for (let i = 0; i < segments; i++) {
      const x0 = -half + i * step;
      const z0 = cz - half + j * step;
      const x1 = x0 + step;
      const z1 = z0 + step;
      const a: [number, number, number] = [x0, H(i, j), z0];
      const b: [number, number, number] = [x1, H(i + 1, j), z0];
      const c: [number, number, number] = [x0, H(i, j + 1), z1];
      const d: [number, number, number] = [x1, H(i + 1, j + 1), z1];
      quadSlope = (Math.max(a[1], b[1], c[1], d[1]) - Math.min(a[1], b[1], c[1], d[1])) / (step * Math.SQRT2);
      if ((i + j) % 2 === 0) {
        pushTri([a, c, b]);
        pushTri([b, c, d]);
      } else {
        pushTri([a, c, d]);
        pushTri([a, d, b]);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, metalness: 0 });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  mesh.name = 'terrain';
  // carte des hauts-fonds (même grille que le maillage)
  const n = segments + 1;
  const data = new Uint8Array(n * n);
  for (let k = 0; k < n * n; k++) data[k] = Math.round(THREE.MathUtils.clamp((hs[k]! - SHORE_MIN) / SHORE_RANGE, 0, 1) * 255);
  const texture = new THREE.DataTexture(data, n, n, THREE.RedFormat, THREE.UnsignedByteType);
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { mesh, shore: { texture, x0: -half, z0: cz - half, size } };
}
