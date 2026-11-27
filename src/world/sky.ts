import * as THREE from 'three';
import { GRAND_PLATEAU, LIFT, SKY, SKY_LIFT, SKY_PANELS, skyEdge } from './layout.ts';
import { addWind } from '../render/wind.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import type { Colliders } from '../game/colliders.ts';
import { NOTES } from './lore.ts';

/** rayon et profondeur du bassin du Grand Plateau */
export const BASIN = { r: 9.4, depth: 2.8 };

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
  const segs = 72;
  const pos: number[] = [];
  const col: number[] = [];
  const grass = [new THREE.Color('#79b84f'), new THREE.Color('#8cc65a'), new THREE.Color('#6aa847')];
  const plaza = new THREE.Color('#ddd3bf');
  // anneaux du bord du bassin jusqu'au bord (irrégulier) de l'île
  const pt = (ri: number, si: number) => {
    const a = (si / segs) * Math.PI * 2;
    const r = BASIN.r + (ri / rings) * (skyEdge(a) - 0.3 - BASIN.r);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    return [x, heightAt(SKY.x + x, SKY.z + z), z] as const;
  };
  for (let ri = 0; ri < rings; ri++)
    for (let si = 0; si < segs; si++) {
      const q = [pt(ri, si), pt(ri + 1, si), pt(ri + 1, si + 1), pt(ri, si + 1)];
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
  const cone = new THREE.ConeGeometry(SKY.r + 0.5, 75, 36, 6, true);
  cone.rotateX(Math.PI);
  const cp = cone.attributes.position!;
  let seed = 3;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < cp.count; i++) {
    const y = cp.getY(i);
    // la roche suit le contour découpé de l'île
    const e = skyEdge(Math.atan2(cp.getZ(i), cp.getX(i))) / (SKY.r + 0.5);
    cp.setX(i, cp.getX(i) * e);
    cp.setZ(i, cp.getZ(i) * e);
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
  const RIM = 90;
  const rim = new THREE.InstancedMesh(new THREE.DodecahedronGeometry(0.7, 0), stoneMaterial('#cfc4ae'), RIM);
  const mtx = new THREE.Matrix4();
  for (let i = 0; i < RIM; i++) {
    const a = (i / RIM) * Math.PI * 2;
    const x = Math.cos(a) * (skyEdge(a) - 0.9);
    const z = Math.sin(a) * (skyEdge(a) - 0.9);
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
  for (let t = 0; t < 600 && placed < 30; t++) {
    const a = rnd() * Math.PI * 2;
    const r = 14 + rnd() * (skyEdge(a) - 18);
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

  // ── la vie : fleurs, herbes au vent, ruisseaux et cascades, îlots, nuages, oiseaux, papillons ──
  const life = buildSkyLife(island, rnd, spots, colliders);

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
      life(time);
      glow.opacity = bridgeLevel * (0.22 + 0.06 * Math.sin(time * 1.5));
    },
  };
}

/** Un point libre sur l'île (repère de l'île), loin des énigmes, des billets et du bassin. */
function freeSkySpot(rnd: () => number, spots: { x: number; z: number }[], clear: number, edgeMargin = 2.5): { x: number; z: number } | null {
  for (let t = 0; t < 60; t++) {
    const a = rnd() * Math.PI * 2;
    const r = BASIN.r + 2 + rnd() * (skyEdge(a) - edgeMargin - BASIN.r - 2);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (spots.some((s) => Math.hypot(s.x - x, s.z - z) < clear)) continue;
    if (Math.hypot(SKY_LIFT.x - SKY.x - x, SKY_LIFT.z - SKY.z - z) < 6) continue;
    return { x, z };
  }
  return null;
}

/** La vie de l'Île du Ciel. Tout est enfant de l'île (et monte avec elle). Renvoie l'animation. */
function buildSkyLife(island: THREE.Group, rnd: () => number, spots: { x: number; z: number }[], colliders: Colliders): (time: number) => void {
  const H = (x: number, z: number) => heightAt(SKY.x + x, SKY.z + z);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // trois sources : un petit bassin, un ruisseau jusqu'au bord, et une cascade qui tombe dans le vide
  // (hors navigateur, pour le test de navigation : pas de texture)
  const streamTex = typeof document === 'undefined' ? null : (() => {
    const c = document.createElement('canvas');
    c.width = 32;
    c.height = 128;
    const g = c.getContext('2d')!;
    g.fillStyle = '#9fdcff';
    g.fillRect(0, 0, 32, 128);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.5})`;
      g.fillRect(rnd() * 32, rnd() * 128, 1 + rnd() * 2, 6 + rnd() * 18);
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  })();
  const waterMat = new THREE.MeshBasicMaterial({ map: streamTex, color: streamTex ? '#ffffff' : '#9fdcff', transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const fallTex = streamTex?.clone() ?? null;
  fallTex?.repeat.set(1, 6);
  const fallMat = new THREE.MeshBasicMaterial({ map: fallTex, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  for (const a of [0.9, 2.7, 4.6]) {
    const edge = skyEdge(a);
    const r0 = 16;
    const x0 = Math.cos(a) * r0;
    const z0 = Math.sin(a) * r0;
    const pond = new THREE.Mesh(new THREE.CircleGeometry(1.6, 16), waterMat);
    pond.rotation.x = -Math.PI / 2;
    pond.position.set(x0, H(x0, z0) + 0.06, z0);
    island.add(pond);
    colliders.addCircle(SKY.x + x0, SKY.z + z0, 1.4);
    spots.push({ x: x0, z: z0 });
    // le ruisseau : une bande d'eau qui court jusqu'au bord
    const len = edge - r0 + 0.5;
    const stripGeo = new THREE.PlaneGeometry(0.9, len);
    stripGeo.rotateX(-Math.PI / 2); // à plat, la longueur suit l'axe z…
    const strip = new THREE.Mesh(stripGeo, waterMat);
    strip.rotation.y = Math.PI / 2 - a; // … tourné vers le bord
    const xm = Math.cos(a) * (r0 + len / 2);
    const zm = Math.sin(a) * (r0 + len / 2);
    strip.position.set(xm, H(xm, zm) + 0.05, zm);
    island.add(strip);
    // la cascade, tout du long de la roche
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 70), fallMat);
    fall.position.set(Math.cos(a) * (edge + 0.6), SKY.y - 35, Math.sin(a) * (edge + 0.6));
    fall.rotation.y = -a + Math.PI / 2;
    island.add(fall);
  }

  // fleurs (six couleurs) et touffes d'herbe qui ondulent au vent
  const flowerColors = ['#ff8fb4', '#ffd45c', '#9fd0ff', '#ffffff', '#c39bff', '#ff9e5c'];
  for (const c of flowerColors) {
    const n = 45;
    const mesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.14, 0), new THREE.MeshStandardMaterial({ color: c, roughness: 0.6, emissive: c, emissiveIntensity: 0.15 }), n);
    for (let i = 0; i < n; i++) {
      const p = freeSkySpot(rnd, spots, 2.2) ?? { x: 0, z: 30 };
      m4.compose(new THREE.Vector3(p.x, H(p.x, p.z) + 0.22, p.z), q.setFromAxisAngle(up, rnd() * 6), new THREE.Vector3(1, 0.7, 1));
      mesh.setMatrixAt(i, m4);
    }
    island.add(mesh);
  }
  const grassMat = new THREE.MeshStandardMaterial({ color: '#5f9e3f', roughness: 0.9, flatShading: true });
  addWind(grassMat, 0.18, 0.2);
  const tufts = new THREE.InstancedMesh(new THREE.ConeGeometry(0.09, 0.6, 3), grassMat, 700);
  for (let i = 0; i < 700; i++) {
    const p = freeSkySpot(rnd, spots, 1.6, 1.5) ?? { x: 0, z: 30 };
    m4.compose(new THREE.Vector3(p.x, H(p.x, p.z) + 0.25, p.z), q.setFromAxisAngle(up, rnd() * 6), new THREE.Vector3(1, 0.7 + rnd() * 0.8, 1));
    tufts.setMatrixAt(i, m4);
  }
  island.add(tufts);

  // îlots flottants, chacun avec son arbre
  const islets: THREE.Group[] = [];
  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const r = 62 + rnd() * 18;
    g.position.set(Math.cos(a) * r, SKY.y - 6 + rnd() * 14, Math.sin(a) * r);
    const rock = new THREE.Mesh(new THREE.ConeGeometry(3.5 + rnd() * 2, 7, 7), new THREE.MeshStandardMaterial({ color: '#8a7d6c', roughness: 1, flatShading: true }));
    rock.rotation.x = Math.PI;
    rock.position.y = -3.5;
    const lawn = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.5, 7), new THREE.MeshStandardMaterial({ color: '#7dbb52', roughness: 0.95, flatShading: true }));
    const tree = new THREE.Mesh(new THREE.IcosahedronGeometry(1.3, 0), new THREE.MeshStandardMaterial({ color: ['#f0a8c8', '#a7d98a', '#f6d27a'][i % 3], roughness: 0.9, flatShading: true }));
    tree.position.y = 2.2;
    const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.22, 1.8, 6), new THREE.MeshStandardMaterial({ color: '#6b4a2e', roughness: 1 }));
    trunk.position.y = 0.9;
    g.add(rock, lawn, trunk, tree);
    g.userData = { y0: g.position.y, phase: rnd() * 6 };
    island.add(g);
    islets.push(g);
  }

  // une mer de nuages sous l'île : on sent l'altitude
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 1, flatShading: true, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 16; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 30 + rnd() * 120;
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry(8 + rnd() * 10, 0), cloudMat);
    c.scale.set(1.6, 0.35, 1.2);
    c.position.set(Math.cos(a) * r, SKY.y - 60 - rnd() * 25, Math.sin(a) * r);
    island.add(c);
  }

  // oiseaux qui tournent autour de l'île (deux ailes qui battent)
  const birds: { g: THREE.Group; wings: THREE.Mesh[]; r: number; h: number; s: number; p: number }[] = [];
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 0.9, 0, -0.25, 0, 0, -0.5], 3));
  wingGeo.computeVertexNormals();
  const birdMat = new THREE.MeshBasicMaterial({ color: '#3b3640', side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group();
    const wings = [1, -1].map((side) => {
      const w = new THREE.Mesh(wingGeo, birdMat);
      w.scale.x = side;
      g.add(w);
      return w;
    });
    island.add(g);
    birds.push({ g, wings, r: 20 + rnd() * 45, h: SKY.y + 9 + rnd() * 18, s: (0.08 + rnd() * 0.1) * (rnd() < 0.5 ? 1 : -1), p: rnd() * 6 });
  }

  // papillons près des fleurs
  const butterflies: { m: THREE.Mesh; x: number; z: number; p: number }[] = [];
  const bGeo = new THREE.PlaneGeometry(0.22, 0.16);
  for (let i = 0; i < 14; i++) {
    const p = freeSkySpot(rnd, spots, 2.5) ?? { x: 0, z: 30 };
    const m = new THREE.Mesh(bGeo, new THREE.MeshBasicMaterial({ color: flowerColors[i % flowerColors.length]!, side: THREE.DoubleSide }));
    island.add(m);
    butterflies.push({ m, x: p.x, z: p.z, p: rnd() * 6 });
  }

  return (time: number) => {
    const off = (time * 0.6) % 1;
    if (streamTex) streamTex.offset.y = -off;
    if (fallTex) fallTex.offset.y = -(time * 0.9) % 1;
    for (const g of islets) g.position.y = (g.userData.y0 as number) + Math.sin(time * 0.35 + (g.userData.phase as number)) * 1.4;
    for (const b of birds) {
      const a = time * b.s + b.p;
      b.g.position.set(Math.cos(a) * b.r, b.h + Math.sin(time * 0.7 + b.p) * 1.5, Math.sin(a) * b.r);
      b.g.rotation.y = -a + (b.s > 0 ? 0 : Math.PI);
      const flap = Math.sin(time * 9 + b.p) * 0.6;
      b.wings[0]!.rotation.z = flap;
      b.wings[1]!.rotation.z = -flap;
    }
    for (const b of butterflies) {
      const t = time * 1.3 + b.p;
      b.m.position.set(b.x + Math.sin(t) * 1.2, heightAt(SKY.x + b.x, SKY.z + b.z) + 0.8 + Math.sin(t * 2.3) * 0.3, b.z + Math.cos(t * 0.8) * 1.2);
      b.m.rotation.set(Math.sin(t * 12) * 0.9, t, 0);
    }
  };
}
