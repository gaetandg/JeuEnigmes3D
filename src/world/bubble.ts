import * as THREE from 'three';
import { BEACH_STONE, BUBBLE, BUBBLE_ARRIVAL, BUBBLE_LIFT, GRANDE_ECLUSE, VASE_PANELS } from './layout.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import { NOTES } from './lore.ts';
import { mergeMeshes } from '../render/merge.ts';
import type { Colliders } from '../game/colliders.ts';

/**
 * La Bulle : une demi-sphère de verre posée au fond de l'océan. Dedans, l'air, du sable, des
 * coraux et des anémones qui luisent, les tables de vases et la Grande Écluse au centre. Dehors,
 * l'eau bleue, des forêts d'algues qui ondulent, des bancs de poissons qui tournent autour du dôme
 * et des rais de lumière qui tombent de la surface.
 */
export interface Bubble {
  group: THREE.Group;
  /** ce qu'on ne dessine que de près (tout, sauf la pierre de la plage) */
  interior: THREE.Group;
  /** les pierres de passage (plage ↔ Bulle) */
  setOpen(on: boolean): void;
  /** 0 → 1 : la fin de la Bulle (le dôme s'illumine) */
  setGlow(k: number): void;
  update(time: number): void;
}

export function buildBubble(colliders: Colliders): Bubble {
  const root = new THREE.Group();
  root.name = 'la Bulle';
  const g = new THREE.Group();
  g.position.set(BUBBLE.x, 0, BUBBLE.z);
  root.add(g);
  let seed = 23;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const H = (x: number, z: number) => heightAt(BUBBLE.x + x, BUBBLE.z + z);
  const spots = [...VASE_PANELS, GRANDE_ECLUSE, ...NOTES.filter((n) => n.zone === 'bulle'), BUBBLE_ARRIVAL, BUBBLE_LIFT].map((p) => ({ x: p.x - BUBBLE.x, z: p.z - BUBBLE.z }));
  const free = (x: number, z: number, clear: number) => !spots.some((s) => Math.hypot(s.x - x, s.z - z) < clear);

  // ── le fond de l'océan, autour ──
  const seabed = new THREE.Mesh(new THREE.CircleGeometry(170, 48), new THREE.MeshStandardMaterial({ color: '#3a5a66', roughness: 1 }));
  seabed.rotation.x = -Math.PI / 2;
  seabed.position.y = BUBBLE.y - 1.4;
  g.add(seabed);
  // ── le sol de la Bulle : du sable clair, un chemin en anneau ──
  const floorGeo = new THREE.CircleGeometry(BUBBLE.r + 0.5, 64, 0, Math.PI * 2);
  const fp = floorGeo.attributes.position!;
  for (let i = 0; i < fp.count; i++) fp.setZ(i, H(fp.getX(i), -fp.getY(i)) - BUBBLE.y);
  floorGeo.computeVertexNormals();
  const floor = new THREE.Mesh(floorGeo, new THREE.MeshStandardMaterial({ color: '#e3d3ad', roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = BUBBLE.y + 0.02;
  floor.receiveShadow = true;
  g.add(floor);
  const path = new THREE.Mesh(new THREE.RingGeometry(16.5, 18, 64), new THREE.MeshStandardMaterial({ color: '#cbb88e', roughness: 1 }));
  path.rotation.x = -Math.PI / 2;
  path.position.y = BUBBLE.y + 0.05;
  g.add(path);

  // ── le dôme : du verre à peine bleuté, tenu par des nervures ──
  const glass = new THREE.MeshStandardMaterial({ color: '#bfe9ff', roughness: 0.05, metalness: 0.2, transparent: true, opacity: 0.1, side: THREE.DoubleSide, depthWrite: false });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(BUBBLE.r, 48, 20, 0, Math.PI * 2, 0, Math.PI / 2), glass);
  dome.position.y = BUBBLE.y;
  dome.renderOrder = 3;
  g.add(dome);
  const ribMat = new THREE.MeshStandardMaterial({ color: '#d7e6ea', roughness: 0.4, metalness: 0.5, emissive: '#7fd6ff', emissiveIntensity: 0.05 });
  const ribs: THREE.Mesh[] = [];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    const pts = Array.from({ length: 13 }, (_, k) => {
      const t = (k / 12) * (Math.PI / 2);
      return new THREE.Vector3(Math.cos(a) * Math.cos(t) * BUBBLE.r, BUBBLE.y + Math.sin(t) * BUBBLE.r, Math.sin(a) * Math.cos(t) * BUBBLE.r);
    });
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.22, 6), ribMat);
    g.add(m);
    ribs.push(m);
  }
  for (const lat of [0.04, 0.35, 0.7]) {
    const t = lat * (Math.PI / 2);
    const m = new THREE.Mesh(new THREE.TorusGeometry(Math.cos(t) * BUBBLE.r, 0.2, 6, 64), ribMat);
    m.rotation.x = Math.PI / 2;
    m.position.y = BUBBLE.y + Math.sin(t) * BUBBLE.r;
    g.add(m);
    ribs.push(m);
  }
  mergeMeshes(ribs, g, ribMat);
  // le bord du dôme : on ne peut pas sortir dans l'eau
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2;
    colliders.addCircle(BUBBLE.x + Math.cos(a) * (BUBBLE.r - 0.4), BUBBLE.z + Math.sin(a) * (BUBBLE.r - 0.4), 0.9);
  }

  // ── dedans : coraux et anémones, au pied du dôme ──
  const coralMats = ['#ff7a6b', '#ffb347', '#c86bff', '#4fd1c5', '#ff6fb5'].map((c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, flatShading: true, emissive: c, emissiveIntensity: 0.12 }));
  const corals: THREE.Mesh[][] = coralMats.map(() => []);
  for (let i = 0; i < 90; i++) {
    const a = rnd() * Math.PI * 2;
    const r = BUBBLE.r - 2.2 - rnd() * 7;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!free(x, z, 4)) continue;
    const k = Math.floor(rnd() * coralMats.length);
    const kind = rnd();
    const geo = kind < 0.4 ? new THREE.ConeGeometry(0.25 + rnd() * 0.3, 0.8 + rnd() * 1.6, 5) : kind < 0.75 ? new THREE.DodecahedronGeometry(0.35 + rnd() * 0.5, 0) : new THREE.CylinderGeometry(0.08, 0.16, 1 + rnd() * 1.5, 5);
    // toutes au même format (non indexé) pour pouvoir les fusionner
    const m = new THREE.Mesh(geo.index ? geo.toNonIndexed() : geo, coralMats[k]!);
    m.position.set(x, H(x, z) + 0.4, z);
    m.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6, (rnd() - 0.5) * 0.4);
    g.add(m);
    corals[k]!.push(m);
  }
  corals.forEach((list, k) => list.length && mergeMeshes(list, g, coralMats[k]!));
  const anemoneMat = new THREE.MeshBasicMaterial({ color: '#9ff3ff', transparent: true, opacity: 0.75, toneMapped: false });
  const anemones: THREE.Mesh[] = [];
  for (let i = 0; i < 40; i++) {
    const a = rnd() * Math.PI * 2;
    const r = 5 + rnd() * (BUBBLE.r - 8);
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r;
    if (!free(x, z, 3.5) || (r > 15.5 && r < 19)) continue;
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.12 + rnd() * 0.12, 6, 4), anemoneMat);
    m.position.set(x, H(x, z) + 0.12, z);
    g.add(m);
    anemones.push(m);
  }
  if (anemones.length) mergeMeshes(anemones, g, anemoneMat);

  // ── dehors : algues qui ondulent, poissons, rais de lumière ──
  const kelpMat = new THREE.MeshStandardMaterial({ color: '#2f8a5a', roughness: 0.8, side: THREE.DoubleSide, emissive: '#0d3a22', emissiveIntensity: 0.3 });
  // un seul maillage instancié : chaque algue est une lame (hauteur par l'échelle) qui ondule
  const kelps: THREE.Object3D[] = [];
  for (let i = 0; i < 60; i++) {
    const a = rnd() * Math.PI * 2;
    const r = BUBBLE.r + 4 + rnd() * 40;
    const k = new THREE.Object3D();
    k.position.set(Math.cos(a) * r, BUBBLE.y - 1.3, Math.sin(a) * r);
    k.scale.set(1, 6 + rnd() * 14, 1);
    k.rotation.y = rnd() * 6;
    k.userData.phase = rnd() * 6;
    kelps.push(k);
  }
  const bladeGeo = new THREE.PlaneGeometry(0.7, 1, 1, 6);
  bladeGeo.translate(0, 0.5, 0);
  const kelpMesh = new THREE.InstancedMesh(bladeGeo, kelpMat, kelps.length);
  kelpMesh.frustumCulled = false;
  g.add(kelpMesh);
  const fishCount = 90;
  const fish = new THREE.InstancedMesh(new THREE.ConeGeometry(0.22, 0.8, 5).rotateZ(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: '#ffd27a', roughness: 0.4, emissive: '#7a4a10', emissiveIntensity: 0.4 }), fishCount);
  fish.frustumCulled = false;
  const fishData = Array.from({ length: fishCount }, (_, i) => ({ r: BUBBLE.r + 3 + (i % 3) * 4 + rnd() * 3, y: BUBBLE.y + 4 + (i % 5) * 4 + rnd() * 2, a0: rnd() * Math.PI * 2, sp: (0.08 + rnd() * 0.06) * (i % 2 ? 1 : -1) }));
  g.add(fish);
  const rayMat = new THREE.MeshBasicMaterial({ color: '#bff0ff', transparent: true, opacity: 0.035, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const rays: THREE.Mesh[] = [];
  for (let i = 0; i < 7; i++) {
    const a = rnd() * Math.PI * 2;
    const r = BUBBLE.r + 6 + rnd() * 30;
    const ray = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 2.4, -BUBBLE.y + 2, 10, 1, true), rayMat);
    ray.position.set(Math.cos(a) * r, BUBBLE.y / 2, Math.sin(a) * r);
    ray.rotation.z = (rnd() - 0.5) * 0.3;
    g.add(ray);
    rays.push(ray);
  }
  mergeMeshes(rays, g, rayMat); // les rais ne bougent pas : un seul maillage

  // ── les pierres de passage : la plage du départ ↔ la Bulle ──
  const glow = new THREE.MeshBasicMaterial({ color: '#8fe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const stones: THREE.Group[] = [];
  for (const L of [BEACH_STONE, BUBBLE_LIFT]) {
    const s = new THREE.Group();
    s.position.set(L.x, heightAt(L.x, L.z), L.z);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.35, 0.25, 20), stoneMaterial('#cfe9f2'));
    disc.position.y = 0.12;
    s.add(disc);
    const halo = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 5, 20, 1, true), glow);
    halo.position.y = 2.6;
    s.add(halo);
    // une bulle qui flotte au-dessus : c'est par là qu'on plonge
    const bub = new THREE.Mesh(new THREE.SphereGeometry(0.45, 16, 12), new THREE.MeshStandardMaterial({ color: '#dff6ff', transparent: true, opacity: 0.35, roughness: 0, metalness: 0.3 }));
    bub.position.y = 2.2;
    s.add(bub);
    s.userData.bub = bub;
    (L === BEACH_STONE ? root : g).add(s);
    if (L !== BEACH_STONE) s.position.x -= BUBBLE.x, s.position.z -= BUBBLE.z;
    stones.push(s);
  }

  // la fin : un rai de lumière part du sommet du dôme et remonte jusqu'à la surface (et au-delà)
  const beamMat = new THREE.MeshBasicMaterial({ color: '#bff6ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
  const beamH = 90 - (BUBBLE.y + BUBBLE.r);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 3.5, beamH, 20, 1, true), beamMat);
  beam.position.set(BUBBLE.x, BUBBLE.y + BUBBLE.r + beamH / 2, BUBBLE.z);
  beam.visible = false;
  root.add(beam);

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
      ribMat.emissiveIntensity = 0.05 + glowK * 1.2;
      glass.opacity = 0.1 + glowK * 0.12;
      beam.visible = glowK > 0.01;
      beamMat.opacity = 0.35 * glowK;
    },
    update(time: number) {
      glow.opacity = open ? 0.2 + 0.06 * Math.sin(time * 1.4) : 0;
      for (const s of stones) (s.userData.bub as THREE.Mesh).position.y = 2.2 + Math.sin(time * 1.3) * 0.25;
      kelps.forEach((k, i) => {
        k.rotation.z = Math.sin(time * 0.6 + (k.userData.phase as number)) * 0.12;
        k.updateMatrix();
        kelpMesh.setMatrixAt(i, k.matrix);
      });
      kelpMesh.instanceMatrix.needsUpdate = true;
      const m = new THREE.Matrix4();
      const q = new THREE.Quaternion();
      const one = new THREE.Vector3(1, 1, 1);
      fishData.forEach((f, i) => {
        const a = f.a0 + time * f.sp;
        const p = new THREE.Vector3(Math.cos(a) * f.r, f.y + Math.sin(time + i) * 0.3, Math.sin(a) * f.r);
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -a - (f.sp > 0 ? Math.PI / 2 : -Math.PI / 2));
        m.compose(p, q, one);
        fish.setMatrixAt(i, m);
      });
      fish.instanceMatrix.needsUpdate = true;
      if (glowK > 0) ribMat.emissiveIntensity = 0.05 + glowK * (1.0 + 0.2 * Math.sin(time * 2));
    },
  };
}
