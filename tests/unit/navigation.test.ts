import { describe, expect, it } from 'vitest';
import { Colliders } from '../../src/game/colliders.ts';
import { heightAt, walkable } from '../../src/world/terrain.ts';
import {
  CADRAN, FINAL_PANELS, FOLD_PANELS, GRAND_PLI, PANELS, PLAZA, SECRETS, SECRET_PLAGE, SHADOW_PANELS, START, standPoint, towerCell, towerCells,
  LIFT, LIGHTHOUSE, SKY, SKY_ARRIVAL, SKY_LIFT, SKY_PANELS, GRAND_PLATEAU, skyEdge,
  CAVE, CAVE_ARRIVAL, CAVE_LIFT, DEEP_LIFT, ROOT_PANELS, RACINE_MERE, caveEdge, MAP_TABLE,
  BUBBLE, BUBBLE_ARRIVAL, BUBBLE_LIFT, BEACH_STONE, VASE_PANELS, GRANDE_ECLUSE,
} from '../../src/world/layout.ts';
import { buildGates, buildLighthouse, buildPlaza, buildVegetation, buildWalls } from '../../src/world/props.ts';
import { buildAtelier } from '../../src/world/atelier.ts';
import { buildGardenDecor } from '../../src/world/decor.ts';
import { buildCloitre } from '../../src/world/cloitre.ts';
import { addPuzzleColliders } from '../../src/world/puzzleColliders.ts';
import { WorldLightPuzzle } from '../../src/render/worldPuzzle.ts';
import { parsePuzzle } from '../../src/core/light/index.ts';
import { ZONE1_TOWERS } from '../../src/puzzles/zone1.ts';
import { SECRET_LIGHT } from '../../src/puzzles/secrets.ts';
import { NOTES } from '../../src/world/lore.ts';
import { buildSkyIsland } from '../../src/world/sky.ts';
import { buildCave } from '../../src/world/cave.ts';
import { buildBubble } from '../../src/world/bubble.ts';

/**
 * Test de navigation : on reconstruit tous les obstacles du jeu (sans rendu) et on vérifie,
 * par un parcours en largeur avec les mêmes règles que le joueur (rayon, pente maximale,
 * pas de baignade), qu'on peut réellement marcher jusqu'à chaque énigme — et que les
 * portes fermées bloquent bien le passage.
 */
const RADIUS = 0.35;
const STEP = 0.6;
const MAX_SLOPE = 1.6;

function world(open: Set<string>) {
  const c = new Colliders();
  buildVegetation(c);
  buildGardenDecor(c);
  buildWalls(c);
  buildGates(c, (id) => open.has(id));
  buildPlaza(c);
  c.addCircle(MAP_TABLE.x, MAP_TABLE.z, 0.65);
  buildLighthouse(c);
  buildAtelier(c);
  buildCloitre(c);
  new WorldLightPuzzle(parsePuzzle(ZONE1_TOWERS), c);
  new WorldLightPuzzle(parsePuzzle(SECRET_LIGHT[0]!), c, SECRET_PLAGE);
  addPuzzleColliders(c);
  // l'Île du Ciel : arbres, plateaux, Grand Plateau (comme dans le jeu)
  buildSkyIsland(c);
  for (const s of SKY_PANELS) c.addCircle(s.x, s.z, 0.75);
  // la grotte des Racines : fosse de la Racine-mère, pupitres
  buildCave(c);
  for (const s of ROOT_PANELS) c.addCircle(s.x, s.z, 0.6);
  // la Bulle : son bord, ses tables, la Grande Écluse
  buildBubble(c);
  for (const s of VASE_PANELS) c.addCircle(s.x, s.z, 0.9);
  c.addCircle(GRANDE_ECLUSE.x, GRANDE_ECLUSE.z, 6.5);
  for (const n of NOTES) c.addCircle(n.x, n.z, 0.3);
  // index spatial des cercles
  const B = 4;
  const buckets = new Map<string, { x: number; z: number; r: number }[]>();
  for (const k of c.circles) {
    for (let bx = Math.floor((k.x - k.r - 1) / B); bx <= Math.floor((k.x + k.r + 1) / B); bx++)
      for (let bz = Math.floor((k.z - k.r - 1) / B); bz <= Math.floor((k.z + k.r + 1) / B); bz++) {
        const key = `${bx},${bz}`;
        buckets.set(key, [...(buckets.get(key) ?? []), k]);
      }
  }
  const free = (x: number, z: number): boolean => {
    for (const k of buckets.get(`${Math.floor(x / B)},${Math.floor(z / B)}`) ?? []) {
      if ((x - k.x) ** 2 + (z - k.z) ** 2 < (k.r + RADIUS) ** 2) return false;
    }
    for (const s of c.segments) {
      if (s.active && !s.active()) continue;
      const ex = s.bx - s.ax;
      const ez = s.bz - s.az;
      const l2 = ex * ex + ez * ez;
      const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2));
      if ((x - s.ax - t * ex) ** 2 + (z - s.az - t * ez) ** 2 < (s.r + RADIUS) ** 2) return false;
    }
    return true;
  };
  return { free };
}

/** Parcours en largeur depuis le départ ; renvoie une fonction « atteignable ? ». */
function explore(open: Set<string>, from: { x: number; z: number } = START, area = { x0: -160, z0: -175, size: 320 }) {
  const { free } = world(open);
  const X0 = area.x0, Z0 = area.z0, NX = Math.ceil(area.size / STEP), NZ = Math.ceil(area.size / STEP);
  const seen = new Uint8Array(NX * NZ);
  const hts = new Float32Array(NX * NZ).fill(NaN);
  const H = (i: number, j: number) => {
    const k = j * NX + i;
    if (Number.isNaN(hts[k]!)) hts[k] = heightAt(X0 + i * STEP, Z0 + j * STEP);
    return hts[k]!;
  };
  const si = Math.round((from.x - X0) / STEP);
  const sj = Math.round((from.z - Z0) / STEP);
  const queue = [sj * NX + si];
  seen[sj * NX + si] = 1;
  while (queue.length) {
    const k = queue.pop()!;
    const i = k % NX;
    const j = (k - i) / NX;
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ni = i + di;
      const nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue;
      const nk = nj * NX + ni;
      if (seen[nk]) continue;
      const h1 = H(ni, nj);
      if (!walkable(X0 + ni * STEP, Z0 + nj * STEP)) continue;
      if ((h1 - H(i, j)) / STEP > MAX_SLOPE) continue;
      if (!free(X0 + ni * STEP, Z0 + nj * STEP)) continue;
      seen[nk] = 1;
      queue.push(nk);
    }
  }
  /** un point est atteignable si une case de la grille à moins d'un mètre l'est */
  return (x: number, z: number): boolean => {
    const ci = Math.round((x - X0) / STEP);
    const cj = Math.round((z - Z0) / STEP);
    for (let dj = -2; dj <= 2; dj++)
      for (let di = -2; di <= 2; di++) {
        const i = ci + di;
        const j = cj + dj;
        if (i >= 0 && j >= 0 && i < NX && j < NZ && seen[j * NX + i]) return true;
      }
    return false;
  };
}

const ALL_GATES = new Set(['porte-plage', 'porte-place', 'porte-nord', 'porte-sortie']);

describe('navigation — on peut marcher jusqu\'à chaque énigme', () => {
  const reach = explore(ALL_GATES);

  it('contrôle : la pleine mer et l\'intérieur du phare sont inaccessibles', () => {
    expect(reach(0, 160)).toBe(false);
    expect(reach(0, -112)).toBe(false);
  });

  it('chaque billet du gardien (lore) et la pierre d\'envol au pied du phare', () => {
    expect(NOTES.filter((n) => n.zone !== 'ciel' && n.zone !== 'racines' && n.zone !== 'bulle' && !reach(n.x, n.z)).map((n) => n.id)).toEqual([]);
    // la pierre de la plage, d'où l'on plonge vers la Bulle
    expect(reach(BEACH_STONE.x, BEACH_STONE.z)).toBe(true);
    expect(reach(BEACH_STONE.x - 3, BEACH_STONE.z - 4)).toBe(true);
    expect(reach(LIFT.x, LIFT.z)).toBe(true);
    // et la pierre qui descend à la grotte (après la bascule)
    expect(reach(DEEP_LIFT.x, DEEP_LIFT.z)).toBe(true);
    expect(reach(DEEP_LIFT.x + 4.5, DEEP_LIFT.z + 4.1)).toBe(true);
    expect(reach(LIGHTHOUSE.x + 8, LIGHTHOUSE.z + 17)).toBe(true);
    // la table d'orientation, sur la place
    const t = standPoint({ ...MAP_TABLE, id: 'carte', requires: [] }, 1.2);
    expect(reach(t.x, t.z)).toBe(true);
  });

  it('chaque panneau, pupitre et théâtre d\'ombres', () => {
    const missing: string[] = [];
    for (const s of [...PANELS, ...FOLD_PANELS, ...FINAL_PANELS]) {
      const p = standPoint(s, 1.6);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    for (const s of SHADOW_PANELS) {
      const yaw = s.yaw - 0.4;
      if (!reach(s.x + Math.sin(yaw) * 2.3, s.z + Math.cos(yaw) * 2.3)) missing.push(s.id);
    }
    expect(missing).toEqual([]);
  });

  it('les énigmes d\'environnement (tours, Grand Pli, Cadran)', () => {
    // chaque tour pivotante : on doit pouvoir s'en approcher à moins de 4 m
    const tours = parsePuzzle(ZONE1_TOWERS);
    for (const [c, r] of tours.interactive.map((i) => [i % tours.width, Math.floor(i / tours.width)] as const)) {
      const t = towerCell(c, r);
      const ok = [[2.5, 0], [-2.5, 0], [0, 2.5], [0, -2.5]].some(([dx, dz]) => reach(t.x + dx!, t.z + dz!));
      expect(ok, `tour ${c},${r}`).toBe(true);
    }
    expect(reach(GRAND_PLI.x, GRAND_PLI.z + 10.5)).toBe(true);
    expect(reach(CADRAN.x - 7, CADRAN.z + 10)).toBe(true);
  });
});

describe('navigation — les secrets sont accessibles', () => {
  const reach = explore(ALL_GATES);
  it('chaque énigme secrète de l\'île', () => {
    const missing: string[] = [];
    for (const s of SECRETS.filter((q) => q.kind !== 'tilt' && q.kind !== 'roots')) {
      let ok: boolean;
      if (s.kind === 'world-light') ok = reach(SECRET_PLAGE.x0 + 8, SECRET_PLAGE.z0 + 13) || reach(SECRET_PLAGE.x0 + 8, SECRET_PLAGE.z0 - 3);
      else if (s.kind === 'fold-easel') ok = reach(s.x + Math.sin(s.yaw) * 6.5, s.z + Math.cos(s.yaw) * 6.5);
      else if (s.kind === 'shadow') ok = reach(s.x + Math.sin(s.yaw - 0.4) * 2.3, s.z + Math.cos(s.yaw - 0.4) * 2.3);
      else {
        const p = standPoint(s, 1.6);
        ok = reach(p.x, p.z);
      }
      if (!ok) missing.push(s.id);
    }
    expect(missing).toEqual([]);
  });
});

describe('navigation — les portes fermées bloquent le passage', () => {
  it('sans aucune porte ouverte, le premier panneau est accessible mais pas le jardin', () => {
    const reach = explore(new Set());
    const a1 = standPoint(PANELS[0]!, 1.6);
    expect(reach(a1.x, a1.z)).toBe(true);
    expect(reach(PLAZA.x, PLAZA.z + 5)).toBe(false);
    const a2 = standPoint(PANELS[1]!, 1.6);
    expect(reach(a2.x, a2.z)).toBe(false);
  });

  it('la porte de la plage ouvre l\'allée A, pas la place', () => {
    const reach = explore(new Set(['porte-plage']));
    for (const s of PANELS.slice(1, 5)) {
      const p = standPoint(s, 1.6);
      expect(reach(p.x, p.z), s.id).toBe(true);
    }
    expect(reach(PLAZA.x, PLAZA.z + 5)).toBe(false);
  });
});

describe('navigation — l\'Île du Ciel', () => {
  const reach = explore(ALL_GATES, SKY_ARRIVAL, { x0: SKY.x - 54, z0: SKY.z - 54, size: 108 });
  it('depuis l\'arrivée : chaque plateau, le Grand Plateau, les billets et la pierre du retour', () => {
    const missing: string[] = [];
    for (const s of SKY_PANELS) {
      const p = standPoint(s, 1.5);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    if (!reach(GRAND_PLATEAU.x, GRAND_PLATEAU.z + 11)) missing.push(GRAND_PLATEAU.id);
    for (const n of NOTES.filter((m) => m.zone === 'ciel')) if (!reach(n.x, n.z)) missing.push(n.id);
    if (!reach(SKY_LIFT.x, SKY_LIFT.z)) missing.push('pierre du retour');
    for (const s of SECRETS.filter((q) => q.kind === 'tilt')) {
      const p = standPoint(s, 1.5);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    expect(missing).toEqual([]);
  });
  it('contrôle : on ne peut pas sortir de l\'île (le vide), quel que soit le cap', () => {
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = skyEdge(a) + 3.5; // au-delà de la tolérance du test (les criques rapprochent la rive)
      expect(reach(SKY.x + Math.cos(a) * r, SKY.z + Math.sin(a) * r), `cap ${i}`).toBe(false);
    }
  });
});

describe('navigation — la grotte des Racines', () => {
  const reach = explore(ALL_GATES, CAVE_ARRIVAL, { x0: CAVE.x - 42, z0: CAVE.z - 42, size: 84 });
  it('depuis le réveil : chaque pupitre, la Racine-mère, les billets et la pierre du retour', () => {
    const missing: string[] = [];
    for (const s of ROOT_PANELS) {
      const p = standPoint(s, 1.5);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    if (!reach(CAVE.x + 9.5, CAVE.z + 3)) missing.push(RACINE_MERE.id);
    for (const n of NOTES.filter((m) => m.zone === 'racines')) if (!reach(n.x, n.z)) missing.push(n.id);
    if (!reach(CAVE_LIFT.x, CAVE_LIFT.z)) missing.push('pierre du retour');
    for (const s of SECRETS.filter((q) => q.kind === 'roots')) {
      const p = standPoint(s, 1.5);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    expect(missing).toEqual([]);
  });
  it('contrôle : ni la fosse ni le roc au-delà des parois', () => {
    expect(reach(CAVE.x, CAVE.z)).toBe(false);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      const r = caveEdge(a) + 3;
      expect(reach(CAVE.x + Math.cos(a) * r, CAVE.z + Math.sin(a) * r), `cap ${i}`).toBe(false);
    }
  });
});

describe('énigmes d\'environnement : rayons horizontaux', () => {
  it('tous les socles d\'une même grille sont à la même hauteur (le jardin des lanternes, les Tours-Miroirs)', () => {
    const beach: number[] = [];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) beach.push(heightAt(SECRET_PLAGE.x0 + c * SECRET_PLAGE.dx, SECRET_PLAGE.z0 + r * SECRET_PLAGE.dz));
    expect(Math.max(...beach) - Math.min(...beach)).toBeLessThan(0.05);
    const towers = towerCells().map(([c, r]) => { const t = towerCell(c, r); return heightAt(t.x, t.z); });
    expect(Math.max(...towers) - Math.min(...towers)).toBeLessThan(0.4); // grandes tours : les rayons suivent le sol
  });
});

describe('navigation — la Bulle', () => {
  const reach = explore(ALL_GATES, BUBBLE_ARRIVAL, { x0: BUBBLE.x - 42, z0: BUBBLE.z - 42, size: 84 });
  it('depuis l\'arrivée : chaque table de vases, la Grande Écluse, les billets et la pierre du retour', () => {
    const missing: string[] = [];
    for (const s of VASE_PANELS) {
      const p = standPoint(s, 2.6);
      if (!reach(p.x, p.z)) missing.push(s.id);
    }
    if (!reach(GRANDE_ECLUSE.x, GRANDE_ECLUSE.z + 15)) missing.push(GRANDE_ECLUSE.id);
    for (const n of NOTES.filter((m) => m.zone === 'bulle')) if (!reach(n.x, n.z)) missing.push(n.id);
    if (!reach(BUBBLE_LIFT.x, BUBBLE_LIFT.z)) missing.push('pierre du retour');
    expect(missing).toEqual([]);
  });
  it('contrôle : on ne sort pas dans l\'eau', () => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      expect(reach(BUBBLE.x + Math.cos(a) * (BUBBLE.r + 3), BUBBLE.z + Math.sin(a) * (BUBBLE.r + 3)), `cap ${i}`).toBe(false);
    }
  });
});
