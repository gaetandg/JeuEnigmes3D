import * as THREE from 'three';
import { GRAND_PLATEAU, LIFT, SKY, SKY_LIFT, SKY_PANELS } from './layout.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import type { Colliders } from '../game/colliders.ts';
import { NOTES } from './lore.ts';

/** anneaux du dessus retirés au centre (le bassin du Grand Plateau) */
const BASIN_RINGS = 3;
/** rayon et profondeur du bassin */
export const BASIN = { r: (BASIN_RINGS / 14) * (SKY.r - 0.3), depth: 2.8 };

/** profondeur sous la mer d'où l'île part avant de monter */
const SUNK = SKY.y + 90;

/**
 * L'Île du Ciel : un disque de prairie posé sur une masse rocheuse en cône renversé, des rochers
 * qui flottent autour, des arbres, une bordure de pierres. Elle commence sous la mer et monte
 * quand la transformation a lieu (setRise de 0 à 1). Le relief suit heightAt (mêmes altitudes que
 * pour le joueur) ; seule l'île visible monte, les énigmes apparaissent une fois arrivée.
 */
export interface SkyIsland {
  group: THREE.Group;
  /** 0 : sous la mer ; 1 : à sa place dans le ciel */
  setRise(k: number): void;
  /** le pont de lumière et les deux pierres d'envol (0 : éteints, 1 : allumés) */
  setBridge(k: number): void;
  /** courbe du pont de lumière, du pied du phare à l'île */
  bridgeCurve: THREE.CatmullRomCurve3;
  update(time: number): void;
}

export function buildSkyIsland(colliders: Colliders): SkyIsland {
  const root = new THREE.Group();
  root.name = 'île du ciel';
  const island = new THREE.Group();
  island.position.set(SKY.x, 0, SKY.z);
  root.add(island);

  // ── dessus : prairie en anneaux (relief de heightAt) ──
  const rings = 14;
  const segs = 48;
  const pos: number[] = [];
  const col: number[] = [];
  const grass = [new THREE.Color('#79b84f'), new THREE.Color('#8cc65a'), new THREE.Color('#6aa847')];
  const plaza = new THREE.Color('#ddd3bf');
  const pt = (ri: number, si: number) => {
    const r = (ri / rings) * (SKY.r - 0.3);
    const a = (si / segs) * Math.PI * 2;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return [x, heightAt(SKY.x + x, SKY.z + z), z] as const;
  };
  for (let ri = 0; ri < rings; ri++)
    for (let si = 0; si < segs; si++) {
      const q = [pt(ri, si), pt(ri + 1, si), pt(ri + 1, si + 1), pt(ri, si + 1)];
      // le centre est creusé : le bassin du Grand Plateau
      if (ri < BASIN_RINGS) continue;
      const tris = [[0, 1, 2], [0, 2, 3]];
      for (const t of tris) {
        const c = Math.hypot(q[t[0]!]![0], q[t[0]!]![2]) < 11.5 ? plaza : grass[(ri * 7 + si * 3 + t[1]!) % 3]!;
        for (const v of t) {
          pos.push(...q[v]!);
          col.push(c.r, c.g, c.b);
        }
      }
    }
  const topGeo = new THREE.BufferGeometry();
  topGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  topGeo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  topGeo.computeVertexNormals();
  const top = new THREE.Mesh(topGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95, side: THREE.DoubleSide }));
  top.receiveShadow = true;
  island.add(top);

  // ── le bassin du Grand Plateau : un puits de pierre peu profond, qu'on regarde d'en haut ──
  const basinWall = new THREE.Mesh(new THREE.CylinderGeometry(BASIN.r, BASIN.r, BASIN.depth, 36, 1, true), stoneMaterial('#cfc4ae'));
  (basinWall.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
  basinWall.position.y = SKY.y - BASIN.depth / 2;
  island.add(basinWall);
  const basinFloor = new THREE.Mesh(new THREE.CircleGeometry(BASIN.r, 36), stoneMaterial('#b9ae99'));
  basinFloor.rotation.x = -Math.PI / 2;
  basinFloor.position.y = SKY.y - BASIN.depth;
  basinFloor.receiveShadow = true;
  island.add(basinFloor);
  const lip = new THREE.Mesh(new THREE.TorusGeometry(BASIN.r, 0.35, 6, 36), stoneMaterial('#e6dccb'));
  lip.rotation.x = Math.PI / 2;
  lip.position.y = SKY.y + 0.1;
  island.add(lip);
  // on ne marche pas dans le bassin
  colliders.addCircle(SKY.x, SKY.z, BASIN.r);

  // ── dessous : la masse rocheuse, un cône renversé aux arêtes irrégulières ──
  const cone = new THREE.ConeGeometry(SKY.r + 0.5, 75, 18, 6, true);
  cone.rotateX(Math.PI);
  const cp = cone.attributes.position!;
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    if (y > 37) continue; // le bord du dessus reste net
    const k = 1 + (rnd() - 0.5) * 0.25;
    cp.setX(i, cp.getX(i) * k);
    cp.setZ(i, cp.getZ(i) * k);
    cp.setY(i, y + (rnd() - 0.5) * 4);
  }
  cone.computeVertexNormals();
  const rock = new THREE.Mesh(cone, new THREE.MeshStandardMaterial({ color: '#8a7d6c', roughness: 1, flatShading: true }));
  rock.position.y = SKY.y - 0.4 - 37.5;
  island.add(rock);

  // ── rochers qui flottent autour ──
  const floaters: THREE.Mesh[] = [];
  const fMat = new THREE.MeshStandardMaterial({ color: '#968a78', roughness: 1, flatShading: true });
  for (let i = 0; i < 9; i++) {
    const a = (i / 9) * Math.PI * 2 + 0.3;
    const m = new THREE.Mesh(new THREE.DodecahedronGeometry(2 + rnd() * 3.5, 0), fMat);
    m.position.set(Math.cos(a) * (SKY.r + 10 + rnd() * 14), SKY.y - 12 - rnd() * 30, Math.sin(a) * (SKY.r + 10 + rnd() * 14));
    m.userData.phase = rnd() * 6;
    m.userData.y0 = m.position.y;
    island.add(m);
    floaters.push(m);
  }

  // ── bordure de pierres et arbres ──
  const rim = new THREE.InstancedMesh(new THREE.BoxGeometry(1.4, 0.7, 0.9), stoneMaterial('#cfc4ae'), 60);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const x = Math.cos(a) * (SKY.r - 0.8);
    const z = Math.sin(a) * (SKY.r - 0.8);
    mtx.compose(new THREE.Vector3(x, heightAt(SKY.x + x, SKY.z + z) + 0.3, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a), new THREE.Vector3(1, 0.6 + rnd() * 0.6, 1));
    rim.setMatrixAt(i, mtx);
  }
  rim.castShadow = true;
  island.add(rim);
  const trunk = new THREE.CylinderGeometry(0.18, 0.28, 2.2, 6);
  const crown = new THREE.IcosahedronGeometry(1.6, 0);
  const trunkMat = new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1, flatShading: true });
  const crownMats = ['#f0a8c8', '#f6d27a', '#a7d98a'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, flatShading: true }));
  const spots = [...SKY_PANELS, GRAND_PLATEAU, ...NOTES.filter((n) => n.zone === 'ciel')].map((p) => ({ x: p.x - SKY.x, z: p.z - SKY.z }));
  let placed = 0;
  for (let t = 0; t < 400 && placed < 22; t++) {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * (SKY.r - 18);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < 6.5)) continue;
    if (Math.hypot(SKY_LIFT.x - SKY.x - x, SKY_LIFT.z - SKY.z - z) < 10) continue;
    const y = heightAt(SKY.x + x, SKY.z + z);
    const tr = new THREE.Mesh(trunk, trunkMat);
    tr.position.set(x, y + 1.1, z);
    const cr = new THREE.Mesh(crown, crownMats[placed % 3]!);
    cr.position.set(x, y + 2.9, z);
    cr.rotation.set(rnd(), rnd(), rnd());
    tr.castShadow = cr.castShadow = true;
    island.add(tr, cr);
    colliders.addCircle(SKY.x + x, SKY.z + z, 0.4);
    placed++;
  }

  // ── pierres d'envol et pont de lumière ──
  const glow = new THREE.MeshBasicMaterial({ color: '#ffe7a8', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const liftStones: THREE.Group[] = [];
  for (const L of [LIFT, SKY_LIFT]) {
    const g = new THREE.Group();
    g.position.set(L.x, heightAt(L.x, L.z), L.z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.45, 0.25, 20), stoneMaterial('#efe6d2'));
    disc.position.y = 0.12;
    disc.receiveShadow = true;
    g.add(disc);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 7, 20, 1, true), glow);
    halo.position.y = 3.6;
    g.add(halo);
    liftStones.push(g);
  }
  root.add(liftStones[0]!);
  island.add(liftStones[1]!);
  liftStones[1]!.position.set(SKY_LIFT.x - SKY.x, heightAt(SKY_LIFT.x, SKY_LIFT.z), SKY_LIFT.z - SKY.z);
  const a = new THREE.Vector3(LIFT.x, heightAt(LIFT.x, LIFT.z) + 1, LIFT.z);
  const b = new THREE.Vector3(SKY_LIFT.x, SKY.y + 1, SKY_LIFT.z);
  const bridgeCurve = new THREE.CatmullRomCurve3([
    a,
    new THREE.Vector3(a.x + 6, a.y + 45, a.z + 10),
    new THREE.Vector3((a.x + b.x) / 2, b.y + 55, (a.z + b.z) / 2 + 20),
    new THREE.Vector3(b.x - 18, b.y + 14, b.z),
    b,
  ]);
  const bridge = new THREE.Mesh(new THREE.TubeGeometry(bridgeCurve, 160, 0.9, 10), glow);
  bridge.frustumCulled = false;
  root.add(bridge);

  let rise = 1;
  let bridgeLevel = 0;
  return {
    group: root,
    bridgeCurve,
    setRise(k: number) {
      rise = THREE.MathUtils.clamp(k, 0, 1);
      island.position.y = (rise - 1) * SUNK;
      island.visible = rise > 0.001;
    },
    setBridge(k: number) {
      bridgeLevel = THREE.MathUtils.clamp(k, 0, 1);
      glow.opacity = 0.28 * bridgeLevel;
      bridge.visible = liftStones[0]!.visible = bridgeLevel > 0.001;
    },
    update(time: number) {
      for (const f of floaters) f.position.y = (f.userData.y0 as number) + Math.sin(time * 0.4 + (f.userData.phase as number)) * 1.2;
      glow.opacity = bridgeLevel * (0.22 + 0.06 * Math.sin(time * 1.5));
    },
  };
}
