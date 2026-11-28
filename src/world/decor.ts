import * as THREE from 'three';
import { mulberry32 } from './noise.ts';
import { distToSegment, heightAt } from './terrain.ts';
import { GARDEN, GATES, PANELS, PLAZA, reqIds } from './layout.ts';
import { freeSpot, stoneMaterial } from './props.ts';
import { mergeStatic } from '../render/merge.ts';
import type { Colliders } from '../game/colliders.ts';

/** Segments des câbles du jardin : le décor ne doit pas les recouvrir. */
function cableSegments(): [number, number, number, number][] {
  const pos = new Map(PANELS.map((p) => [p.id, p] as const));
  const segs: [number, number, number, number][] = [];
  for (const t of [...PANELS, ...GATES]) {
    for (const r of reqIds(t.requires)) {
      const a = pos.get(r);
      if (a) segs.push([a.x, a.z, t.x, t.z]);
    }
  }
  return segs;
}

/**
 * Décor du jardin : massifs de fleurs bordés de pierre, bassins, colonnes brisées,
 * vasques. Placement déterministe, à l'écart des chemins, des panneaux et des câbles.
 */
export function buildGardenDecor(colliders: Colliders): { group: THREE.Group; update: (t: number) => void; beds: THREE.Vector3[] } {
  const g = new THREE.Group();
  g.name = 'décor du jardin';
  const rnd = mulberry32(2024);
  const cables = cableSegments();
  const taken: { x: number; z: number; r: number }[] = [];
  const inGarden = (x: number, z: number, m: number) =>
    x > GARDEN.x0 + m && x < GARDEN.x1 - m && z > GARDEN.z0 + m && z < GARDEN.z1 - m;
  const ok = (x: number, z: number, r: number) =>
    inGarden(x, z, r + 2) &&
    freeSpot(x, z, r) &&
    Math.hypot(x - PLAZA.x, z - PLAZA.z) > PLAZA.r + 2 + r &&
    !cables.some(([ax, az, bx, bz]) => distToSegment(x, z, ax, az, bx, bz) < r + 1.2) &&
    !taken.some((t) => Math.hypot(t.x - x, t.z - z) < t.r + r + 1.5) &&
    !colliders.circles.some((c) => Math.hypot(c.x - x, c.z - z) < c.r + r + 0.8);
  const spot = (r: number, tries = 400): { x: number; z: number } | null => {
    for (let i = 0; i < tries; i++) {
      const x = GARDEN.x0 + rnd() * (GARDEN.x1 - GARDEN.x0);
      const z = GARDEN.z0 + rnd() * (GARDEN.z1 - GARDEN.z0);
      if (ok(x, z, r)) {
        taken.push({ x, z, r });
        return { x, z };
      }
    }
    return null;
  };
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);

  // ── massifs de fleurs ───────────────────────────────────────────────────
  const borders: THREE.Matrix4[] = [];
  const flowers: { m: THREE.Matrix4; c: THREE.Color }[] = [];
  const beds: THREE.Vector3[] = [];
  const palettes = [['#f2a7b8', '#ffffff', '#f4c06a'], ['#b9a2f0', '#ffffff', '#8fc0ff'], ['#ff8a5c', '#ffd45e', '#ffffff']];
  for (let i = 0; i < 40; i++) {
    const s = spot(1.8);
    if (!s) break;
    const y = heightAt(s.x, s.z);
    beds.push(new THREE.Vector3(s.x, y, s.z));
    const rot = rnd() * Math.PI;
    q.setFromAxisAngle(up, rot);
    const L = 2.6 + rnd() * 1.6;
    const W = 1.1;
    // bordure : 4 pierres basses
    for (const [dx, dz, sx, sz] of [[0, -W / 2, L, 0.2], [0, W / 2, L, 0.2], [-L / 2, 0, 0.2, W], [L / 2, 0, 0.2, W]] as const) {
      const off = new THREE.Vector3(dx, 0, dz).applyQuaternion(q);
      m.compose(new THREE.Vector3(s.x + off.x, y + 0.1, s.z + off.z), q, new THREE.Vector3(sx, 0.25, sz));
      borders.push(m.clone());
    }
    const pal = palettes[i % palettes.length]!;
    for (let k = 0; k < 18; k++) {
      const off = new THREE.Vector3((rnd() - 0.5) * (L - 0.4), 0, (rnd() - 0.5) * (W - 0.3)).applyQuaternion(q);
      const sc = 0.16 + rnd() * 0.12;
      m.compose(new THREE.Vector3(s.x + off.x, y + 0.28 + rnd() * 0.15, s.z + off.z), q, new THREE.Vector3(sc, sc, sc));
      flowers.push({ m: m.clone(), c: new THREE.Color(pal[Math.floor(rnd() * pal.length)]!) });
    }
  }
  const borderMesh = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), stoneMaterial('#d8cdbb'), borders.length);
  borders.forEach((mm, i) => borderMesh.setMatrixAt(i, mm));
  borderMesh.receiveShadow = true;
  const flowerMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.8 }), flowers.length);
  flowers.forEach((f, i) => {
    flowerMesh.setMatrixAt(i, f.m);
    flowerMesh.setColorAt(i, f.c);
  });
  g.add(borderMesh, flowerMesh);

  // ── bassins ──────────────────────────────────────────────────────────────
  const waterMat = new THREE.MeshStandardMaterial({ color: '#4fb3c4', roughness: 0.15, metalness: 0.1, transparent: true, opacity: 0.85 });
  const padMat = new THREE.MeshStandardMaterial({ color: '#5f9c48', roughness: 0.9, flatShading: true });
  // les nénuphars : un seul maillage instancié (ils tournent sur eux-mêmes, lentement)
  const pads: { pos: THREE.Vector3; r: number; a: number }[] = [];
  const rimMat = stoneMaterial('#e6dccb');
  for (let i = 0; i < 3; i++) {
    const r = 2.2 + rnd() * 0.8;
    const s = spot(r + 0.6);
    if (!s) break;
    const y = heightAt(s.x, s.z);
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(r + 0.45, r + 0.55, 0.5, 20, 1, true), rimMat);
    rim.position.set(s.x, y + 0.1, s.z);
    const rimTop = new THREE.Mesh(new THREE.RingGeometry(r, r + 0.5, 20), rimMat);
    rimTop.rotation.x = -Math.PI / 2;
    rimTop.position.set(s.x, y + 0.35, s.z);
    const water = new THREE.Mesh(new THREE.CircleGeometry(r, 20), waterMat);
    water.rotation.x = -Math.PI / 2;
    water.position.set(s.x, y + 0.22, s.z);
    for (const o of [rim, rimTop, water]) o.userData.static = true;
    g.add(rim, rimTop, water);
    for (let k = 0; k < 5; k++) {
      const a = rnd() * Math.PI * 2;
      const d = rnd() * (r - 0.6);
      pads.push({ r: 0.28 + rnd() * 0.15, a: rnd() * 6, pos: new THREE.Vector3(s.x + Math.cos(a) * d, y + 0.24, s.z + Math.sin(a) * d) });
    }
    colliders.addCircle(s.x, s.z, r + 0.5);
  }

  // ── colonnes brisées et vasques ──────────────────────────────────────────
  const colMat = stoneMaterial('#efe7da');
  const baseMat = stoneMaterial('#d8cdbb');
  const bloomMats = palettes.map((p) => new THREE.MeshStandardMaterial({ color: p[0], flatShading: true }));
  for (let i = 0; i < 16; i++) {
    const s = spot(0.8);
    if (!s) break;
    const y = heightAt(s.x, s.z);
    if (rnd() < 0.3) {
      // colonne tombée
      const len = 2 + rnd() * 2;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, len, 10), colMat);
      c.rotation.z = Math.PI / 2;
      c.rotation.y = rnd() * Math.PI;
      c.position.set(s.x, y + 0.35, s.z);
      c.castShadow = c.receiveShadow = true;
      c.userData.static = true;
      g.add(c);
      colliders.addCircle(s.x, s.z, len / 2);
    } else if (rnd() < 0.5) {
      const h = 0.8 + rnd() * 2.4;
      const c = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.45, h, 10), colMat);
      c.position.set(s.x, y + h / 2, s.z);
      c.castShadow = c.receiveShadow = true;
      const base = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.3, 1.1), baseMat);
      base.position.set(s.x, y + 0.15, s.z);
      base.receiveShadow = true;
      c.userData.static = base.userData.static = true;
      g.add(c, base);
      colliders.addCircle(s.x, s.z, 0.6);
    } else {
      // vasque fleurie
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 0.8, 8), colMat);
      foot.position.set(s.x, y + 0.4, s.z);
      const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.3, 0.4, 10), colMat);
      bowl.position.set(s.x, y + 0.95, s.z);
      const bloom = new THREE.Mesh(new THREE.IcosahedronGeometry(0.45, 0), bloomMats[i % 3]!);
      bloom.scale.y = 0.6;
      bloom.position.set(s.x, y + 1.2, s.z);
      for (const o of [foot, bowl, bloom]) {
        o.castShadow = true;
        o.userData.static = true;
      }
      g.add(foot, bowl, bloom);
      colliders.addCircle(s.x, s.z, 0.55);
    }
  }

  // bassins, colonnes et vasques ne bougent pas : un maillage par matériau
  mergeStatic(g);

  const padGeo = new THREE.CircleGeometry(1, 7, 0.3, Math.PI * 1.8);
  padGeo.rotateX(-Math.PI / 2);
  const padMesh = new THREE.InstancedMesh(padGeo, padMat, Math.max(1, pads.length));
  padMesh.count = pads.length;
  g.add(padMesh);
  const padDummy = new THREE.Object3D();
  const placePads = () => {
    pads.forEach((p, i) => {
      padDummy.position.copy(p.pos);
      padDummy.rotation.set(0, p.a, 0);
      padDummy.scale.setScalar(p.r);
      padDummy.updateMatrix();
      padMesh.setMatrixAt(i, padDummy.matrix);
    });
    padMesh.instanceMatrix.needsUpdate = true;
  };
  placePads();
  padMesh.computeBoundingSphere();

  // les nénuphars dérivent doucement
  const update = (t: number) => {
    pads.forEach((p, i) => (p.a += Math.sin(t * 0.3 + i) * 0.0006));
    placePads();
  };
  return { group: g, update, beds };
}
