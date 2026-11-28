import * as THREE from 'three';
import { CAVE, CAVE_LIFT, DEEP_LIFT, ROOT_PANELS, caveEdge, SECRETS } from './layout.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import { NOTES } from './lore.ts';
import type { Colliders } from '../game/colliders.ts';
import { mergeMeshes } from '../render/merge.ts';

/** la fosse de la Racine-mère, au centre */
export const PIT = { r: 7.6, depth: 2.2 };

/**
 * La grotte des Racines, sous la mer : un sol de terre sombre, des parois irrégulières, une voûte
 * hérissée de stalactites, des racines lumineuses qui descendent du plafond (celles du phare),
 * des cristaux et de la mousse qui luisent. Au centre, la fosse de la Racine-mère. Quand elle est
 * résolue, toutes les racines s'allument (setGlow).
 */
export interface Cave {
  group: THREE.Group;
  /** l'intérieur de la grotte (masqué quand on est loin : il est sous la mer) */
  interior: THREE.Group;
  /** pierre qui ramène au pied du phare (et sa sœur, au pied du phare, qui redescend) */
  setOpen(on: boolean): void;
  /** 0 : racines éteintes ; 1 : la lumière remonte jusqu'au phare */
  setGlow(k: number): void;
  update(time: number): void;
}

export function buildCave(colliders: Colliders): Cave {
  const root = new THREE.Group();
  root.name = 'grotte des racines';
  const g = new THREE.Group();
  g.position.set(CAVE.x, 0, CAVE.z);
  root.add(g);
  let seed = 11;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const H = (x: number, z: number) => heightAt(CAVE.x + x, CAVE.z + z);

  // ── sol : anneaux du bord de la fosse jusqu'aux parois ──
  const rings = 10;
  const segs = 64;
  const pos: number[] = [];
  const col: number[] = [];
  const earth = [new THREE.Color('#5b4a44'), new THREE.Color('#665249'), new THREE.Color('#54443f')];
  const pt = (ri: number, si: number) => {
    const a = (si / segs) * Math.PI * 2;
    const r = PIT.r + (ri / rings) * (caveEdge(a) - 0.2 - PIT.r);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return [x, H(x, z), z] as const;
  };
  for (let ri = 0; ri < rings; ri++)
    for (let si = 0; si < segs; si++) {
      const q = [pt(ri, si), pt(ri + 1, si), pt(ri + 1, si + 1), pt(ri, si + 1)];
      for (const t of [[0, 1, 2], [0, 2, 3]]) {
        const c = earth[(ri * 5 + si * 3 + t[1]!) % 3]!;
        for (const v of t) {
          pos.push(...q[v]!);
          col.push(c.r, c.g, c.b);
        }
      }
    }
  const floorGeo = new THREE.BufferGeometry();
  floorGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  floorGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, side: THREE.DoubleSide }));
  floor.receiveShadow = true;
  g.add(floor);

  // ── la fosse de la Racine-mère ──
  const pitWall = new THREE.Mesh(new THREE.CylinderGeometry(PIT.r, PIT.r, PIT.depth, 40, 1, true), stoneMaterial('#5d5260'));
  (pitWall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  pitWall.position.y = CAVE.y - PIT.depth / 2;
  g.add(pitWall);
  const pitFloor = new THREE.Mesh(new THREE.CircleGeometry(PIT.r, 40), stoneMaterial('#4a4150'));
  pitFloor.rotation.x = -Math.PI / 2;
  pitFloor.position.y = CAVE.y - PIT.depth;
  g.add(pitFloor);
  colliders.addCircle(CAVE.x, CAVE.z, PIT.r);

  // ── parois et voûte ──
  const wallGeo = new THREE.CylinderGeometry(1, 1, CAVE.height + 4, segs, 4, true);
  const wp = wallGeo.attributes.position!;
  // les sommets en double (la couture du cylindre) reçoivent le même relief : sinon, une fente
  const jitter = new Map<string, [number, number]>();
  for (let i = 0; i < wp.count; i++) {
    const a = Math.atan2(wp.getZ(i), wp.getX(i));
    const y = wp.getY(i);
    // (Math.round : « -0 » et « 0 » donnent la même clé, contrairement à toFixed)
    const key = `${Math.round(wp.getX(i) * 1000)},${Math.round(y * 1000)},${Math.round(wp.getZ(i) * 1000)}`;
    let j = jitter.get(key);
    if (!j) jitter.set(key, (j = [(rnd() - 0.3) * 1.4, (rnd() - 0.5) * 1.2]));
    const r = caveEdge(a) + 0.6 + j[0];
    wp.setX(i, Math.cos(a) * r);
    wp.setZ(i, Math.sin(a) * r);
    wp.setY(i, y + j[1]);
  }
  wallGeo.computeVertexNormals();
  const rockMat = new THREE.MeshStandardMaterial({ color: '#4d4452', roughness: 1, flatShading: true, side: THREE.DoubleSide });
  const walls = new THREE.Mesh(wallGeo, rockMat);
  walls.position.y = CAVE.y + (CAVE.height + 4) / 2 - 2;
  walls.castShadow = true;
  g.add(walls);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(CAVE.r + 6, 32, 10, 0, Math.PI * 2, 0, Math.PI / 2), rockMat);
  dome.scale.y = 0.45;
  dome.position.y = CAVE.y + CAVE.height - 2;
  dome.castShadow = true;
  g.add(dome);

  // stalactites
  const stalMat = new THREE.MeshStandardMaterial({ color: '#5a4f5e', roughness: 1, flatShading: true });
  const stals: THREE.Mesh[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = rnd() * (caveEdge(a) - 2);
    const len = 1.5 + rnd() * 4;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.3 + rnd() * 0.5, len, 5), stalMat);
    s.rotation.x = Math.PI;
    s.position.set(Math.cos(a) * r, CAVE.y + CAVE.height + 1 - len / 2 - (r / (CAVE.r + 6)) ** 2 * 3, Math.sin(a) * r);
    g.add(s);
    stals.push(s);
  }
  // un seul maillage par famille d'objets : la grotte doit rester fluide
  mergeMeshes(stals, g, stalMat);

  // ── les racines du phare : elles percent la voûte en son centre (le phare est au-dessus),
  // s'écartent et vont s'ancrer au pied des parois, hors des chemins ; quelques-unes plongent
  // dans la fosse, vers la Racine-mère. Elles s'allument à la fin. ──
  const rootMat = new THREE.MeshStandardMaterial({ color: '#6b5236', roughness: 0.8, emissive: '#ffcf70', emissiveIntensity: 0.08 });
  const tubes: THREE.Mesh[] = [];
  const rootTube = (pts: THREE.Vector3[], radius: number) => {
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 28, radius, 6), rootMat);
    g.add(m);
    tubes.push(m);
  };
  for (let i = 0; i < 14; i++) {
    const a = (i / 14) * Math.PI * 2 + rnd() * 0.3;
    const r0 = 3 + rnd() * 4;
    const r1 = caveEdge(a) - 1.2 - rnd() * 1.5;
    rootTube([
      new THREE.Vector3(Math.cos(a) * r0, CAVE.y + CAVE.height + 2, Math.sin(a) * r0),
      new THREE.Vector3(Math.cos(a + 0.15) * (r0 + r1) * 0.55, CAVE.y + CAVE.height * 0.72, Math.sin(a + 0.15) * (r0 + r1) * 0.55),
      new THREE.Vector3(Math.cos(a + 0.1) * (r1 - 2.5), CAVE.y + 3.2, Math.sin(a + 0.1) * (r1 - 2.5)),
      new THREE.Vector3(Math.cos(a) * r1, CAVE.y + 0.1, Math.sin(a) * r1),
    ], 0.25 + rnd() * 0.2);
    colliders.addCircle(CAVE.x + Math.cos(a) * r1, CAVE.z + Math.sin(a) * r1, 0.7);
  }
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * Math.PI * 2 + 0.4;
    rootTube([
      new THREE.Vector3(Math.cos(a) * 2, CAVE.y + CAVE.height + 2, Math.sin(a) * 2),
      new THREE.Vector3(Math.cos(a + 0.3) * 5, CAVE.y + 8, Math.sin(a + 0.3) * 5),
      new THREE.Vector3(Math.cos(a + 0.5) * (PIT.r + 0.3), CAVE.y + 0.5, Math.sin(a + 0.5) * (PIT.r + 0.3)),
      new THREE.Vector3(Math.cos(a + 0.55) * (PIT.r - 0.6), CAVE.y - PIT.depth + 0.2, Math.sin(a + 0.55) * (PIT.r - 0.6)),
    ], 0.32);
  }

  mergeMeshes(tubes, g, rootMat);

  // cristaux et mousse qui luisent
  const crystalMat = new THREE.MeshStandardMaterial({ color: '#8fd8ff', roughness: 0.2, emissive: '#5fc0ff', emissiveIntensity: 0.9, flatShading: true });
  const mossMat = new THREE.MeshBasicMaterial({ color: '#4fbf8c', transparent: true, opacity: 0.35, toneMapped: false, depthWrite: false });
  const crystals: THREE.Mesh[] = [];
  const spots = [...ROOT_PANELS, ...NOTES.filter((n) => n.zone === 'racines'), CAVE_LIFT, ...SECRETS.filter((q) => q.kind === 'roots')].map((p) => ({ x: p.x - CAVE.x, z: p.z - CAVE.z }));
  for (let i = 0; i < 26; i++) {
    const a = rnd() * Math.PI * 2;
    const r = caveEdge(a) - 0.5 - rnd() * 2.5;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 4)) continue;
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.4 + rnd() * 0.6, 0), crystalMat);
    c.scale.y = 2 + rnd() * 1.5;
    c.position.set(x, H(x, z) + 0.6, z);
    c.rotation.set(rnd() * 0.5, rnd() * 6, rnd() * 0.5);
    g.add(c);
    crystals.push(c);
  }
  mergeMeshes(crystals, g, crystalMat);
  const mosses: THREE.Mesh[] = [];
  for (let i = 0; i < 70; i++) {
    const a = rnd() * Math.PI * 2;
    const r = PIT.r + 1.5 + rnd() * (caveEdge(a) - PIT.r - 3);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    const m = new THREE.Mesh(new THREE.CircleGeometry(0.2 + rnd() * 0.5, 6), mossMat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, H(x, z) + 0.03, z);
    g.add(m);
    mosses.push(m);
  }
  mergeMeshes(mosses, g, mossMat);

  // ── pierres de passage : au fond de la grotte, et au pied du phare enfoncé ──
  const glow = new THREE.MeshBasicMaterial({ color: '#b9e6ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const shaftMat = new THREE.MeshBasicMaterial({ color: '#fff3d6', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const stones: THREE.Group[] = [];
  for (const L of [CAVE_LIFT, DEEP_LIFT]) {
    const s = new THREE.Group();
    s.position.set(L.x, heightAt(L.x, L.z), L.z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.25, 20), stoneMaterial('#d9e6ef'));
    disc.position.y = 0.12;
    s.add(disc);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 20, 1, true), glow);
    halo.position.y = 2.6;
    s.add(halo);
    if (L === CAVE_LIFT) {
      // la sortie se voit de toute la grotte : un rai de jour qui tombe de la voûte sur la pierre
      const h = CAVE.y + CAVE.height + 2 - s.position.y;
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.7, h, 20, 1, true), shaftMat);
      shaft.position.y = h / 2;
      s.add(shaft);
      const spot = new THREE.Mesh(new THREE.CircleGeometry(2.4, 24), shaftMat);
      spot.rotation.x = -Math.PI / 2;
      spot.position.y = 0.27;
      s.add(spot);
    }
    root.add(s);
    stones.push(s);
  }

  let open = false;
  let glowK = 0;
  return {
    group: root,
    interior: g,
    setOpen(on: boolean) {
      open = on;
      for (const s of stones) s.visible = on;
    },
    setGlow(k: number) {
      glowK = THREE.MathUtils.clamp(k, 0, 1);
      rootMat.emissiveIntensity = 0.08 + glowK * 1.0;
      mossMat.opacity = 0.35 + glowK * 0.4;
    },
    update(time: number) {
      glow.opacity = open ? 0.18 + 0.06 * Math.sin(time * 1.4) : 0;
      shaftMat.opacity = open ? 0.2 + 0.05 * Math.sin(time * 0.9) : 0;
      if (glowK > 0) rootMat.emissiveIntensity = 0.08 + glowK * (0.85 + 0.15 * Math.sin(time * 2));
    },
  };
}
