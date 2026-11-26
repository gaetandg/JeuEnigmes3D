import * as THREE from 'three';
import { mulberry32, smoothstep } from './noise.ts';
import { heightAt, distToPath, distToSegment } from './terrain.ts';
import { FLATS, GARDEN, GATES, LIGHTHOUSE, PLAZA, WALLS } from './layout.ts';
import type { Colliders } from '../game/colliders.ts';

export const STONE = new THREE.Color('#efe7da');
const STONE_DARK = new THREE.Color('#d8cdbb');

export function stoneMaterial(color: THREE.ColorRepresentation = STONE): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.9, metalness: 0, flatShading: true });
}

function nearWall(x: number, z: number, margin: number): boolean {
  return WALLS.some(([ax, az, bx, bz]) => distToSegment(x, z, ax, az, bx, bz) < margin);
}

function freeSpot(x: number, z: number, margin: number): boolean {
  if (distToPath(x, z) < 2.5 + margin) return false;
  if (FLATS.some((f) => Math.hypot(x - f.x, z - f.z) < f.r + 1.5 + margin)) return false;
  if (nearWall(x, z, 1.5 + margin)) return false;
  if (Math.hypot(x - LIGHTHOUSE.x, z - LIGHTHOUSE.z) < 10) return false;
  return true;
}

/** Arbres, rochers et buissons (instanciés). */
export function buildVegetation(colliders: Colliders): THREE.Group {
  const rnd = mulberry32(42);
  const group = new THREE.Group();
  group.name = 'végétation';

  type Tree = { x: number; z: number; y: number; s: number; kind: number };
  const trees: Tree[] = [];
  for (let i = 0; i < 4000 && trees.length < 420; i++) {
    const x = (rnd() - 0.5) * 300;
    const z = -15 + (rnd() - 0.5) * 300;
    const y = heightAt(x, z);
    if (y < 1.6) continue;
    const inGarden = x > GARDEN.x0 && x < GARDEN.x1 && z > GARDEN.z0 && z < GARDEN.z1;
    if (inGarden && rnd() < 0.55) continue; // jardin plus clairsemé
    if (!freeSpot(x, z, 0.5)) continue;
    if (trees.some((t) => Math.hypot(t.x - x, t.z - z) < 3.2)) continue;
    const slope = Math.abs(heightAt(x + 1, z) - y) + Math.abs(heightAt(x, z + 1) - y);
    if (slope > 1.2) continue;
    trees.push({ x, z, y, s: 0.75 + rnd() * 0.6, kind: rnd() < 0.25 ? 1 : rnd() < 0.15 ? 2 : 0 });
  }

  const trunkGeo = new THREE.CylinderGeometry(0.12, 0.22, 1, 5);
  trunkGeo.translate(0, 0.5, 0);
  const blobGeo = new THREE.IcosahedronGeometry(1, 0);
  const coneGeo = new THREE.ConeGeometry(1, 1, 6);
  coneGeo.translate(0, 0.5, 0);

  const trunkMat = new THREE.MeshStandardMaterial({ color: '#8a6a4f', flatShading: true, roughness: 1 });
  const leafMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.9 });

  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, trees.length);
  const blobs = new THREE.InstancedMesh(blobGeo, leafMat, trees.length * 2);
  const cones = new THREE.InstancedMesh(coneGeo, leafMat, trees.length * 3);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  const greens = ['#7fb24a', '#6aa443', '#92c25a', '#5d9a45'].map((c) => new THREE.Color(c));
  const blossoms = ['#f2a7b8', '#f4c06a', '#e98f6f'].map((c) => new THREE.Color(c));
  const pineCol = ['#4e8a4f', '#3f7a52'].map((c) => new THREE.Color(c));
  let nb = 0;
  let nc = 0;
  trees.forEach((t, i) => {
    const th = (t.kind === 1 ? 1.2 : 2.2) * t.s;
    m.compose(new THREE.Vector3(t.x, t.y - 0.1, t.z), q.identity(), new THREE.Vector3(t.s, th, t.s));
    trunks.setMatrixAt(i, m);
    if (t.kind === 1) {
      // pin : cônes empilés
      for (let k = 0; k < 3; k++) {
        const r = (1.5 - k * 0.38) * t.s;
        const h = 1.6 * t.s;
        m.compose(new THREE.Vector3(t.x, t.y + th + k * h * 0.55 - 0.2, t.z), q.setFromEuler(e.set(0, rnd() * 3, 0)), new THREE.Vector3(r, h, r));
        cones.setMatrixAt(nc, m);
        cones.setColorAt(nc, pineCol[k % 2]!);
        nc++;
      }
    } else {
      const col = t.kind === 2 ? blossoms[Math.floor(rnd() * blossoms.length)]! : greens[Math.floor(rnd() * greens.length)]!;
      for (let k = 0; k < 2; k++) {
        const r = (k === 0 ? 1.7 : 1.15) * t.s;
        const off = k === 0 ? 0 : 0.9 * t.s;
        m.compose(
          new THREE.Vector3(t.x + (k ? (rnd() - 0.5) * 0.8 : 0), t.y + th + r * 0.55 + off, t.z + (k ? (rnd() - 0.5) * 0.8 : 0)),
          q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)),
          new THREE.Vector3(r, r * 0.85, r),
        );
        blobs.setMatrixAt(nb, m);
        blobs.setColorAt(nb, col.clone().offsetHSL(0, 0, (rnd() - 0.5) * 0.06));
        nb++;
      }
    }
    colliders.addCircle(t.x, t.z, 0.35 * t.s + 0.1);
  });
  blobs.count = nb;
  cones.count = nc;
  for (const im of [trunks, blobs, cones]) {
    im.castShadow = true;
    im.receiveShadow = true;
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    group.add(im);
  }

  // rochers
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const rockMat = new THREE.MeshStandardMaterial({ color: '#b8afa3', flatShading: true, roughness: 1 });
  const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 260);
  let nr = 0;
  for (let i = 0; i < 3000 && nr < 260; i++) {
    const x = (rnd() - 0.5) * 300;
    const z = -15 + (rnd() - 0.5) * 300;
    const y = heightAt(x, z);
    if (y < -1.5) continue;
    if (!freeSpot(x, z, 0)) continue;
    const s = 0.3 + rnd() * rnd() * 1.8;
    m.compose(
      new THREE.Vector3(x, y + s * 0.2, z),
      q.setFromEuler(e.set(rnd() * 3, rnd() * 3, rnd() * 3)),
      new THREE.Vector3(s * (0.8 + rnd() * 0.6), s * (0.5 + rnd() * 0.4), s * (0.8 + rnd() * 0.6)),
    );
    rocks.setMatrixAt(nr, m);
    rocks.setColorAt(nr, new THREE.Color('#b8afa3').offsetHSL(0, 0, (rnd() - 0.5) * 0.12));
    if (s > 0.7) colliders.addCircle(x, z, s * 0.8);
    nr++;
  }
  rocks.count = nr;
  rocks.castShadow = true;
  rocks.receiveShadow = true;
  group.add(rocks);

  // touffes d'herbe et fleurs
  const tuftGeo = new THREE.ConeGeometry(0.12, 0.5, 3);
  tuftGeo.translate(0, 0.2, 0);
  const tuftMat = new THREE.MeshStandardMaterial({ flatShading: true, roughness: 1 });
  const tufts = new THREE.InstancedMesh(tuftGeo, tuftMat, 2500);
  const flowerCols = ['#ffffff', '#ffd45e', '#f49ac1', '#b9a2f0'].map((c) => new THREE.Color(c));
  let nt = 0;
  for (let i = 0; i < 20000 && nt < 2500; i++) {
    const x = (rnd() - 0.5) * 260;
    const z = -15 + (rnd() - 0.5) * 260;
    const y = heightAt(x, z);
    if (y < 1.8) continue;
    if (distToPath(x, z) < 1.8) continue;
    const s = 0.6 + rnd() * 0.8;
    m.compose(new THREE.Vector3(x, y - 0.05, z), q.setFromEuler(e.set((rnd() - 0.5) * 0.4, rnd() * 3, (rnd() - 0.5) * 0.4)), new THREE.Vector3(s, s, s));
    tufts.setMatrixAt(nt, m);
    const flower = rnd() < 0.18;
    tufts.setColorAt(nt, flower ? flowerCols[Math.floor(rnd() * 4)]! : greens[Math.floor(rnd() * 4)]!.clone().offsetHSL(0, 0.05, -0.05));
    nt++;
  }
  tufts.count = nt;
  tufts.receiveShadow = true;
  group.add(tufts);
  return group;
}

/** Murs du jardin, découpés en tronçons qui suivent le sol. */
export function buildWalls(colliders: Colliders): THREE.Group {
  const group = new THREE.Group();
  group.name = 'murs';
  const mat = stoneMaterial();
  const capMat = stoneMaterial(STONE_DARK);
  const pieces: THREE.Matrix4[] = [];
  const caps: THREE.Matrix4[] = [];
  const pillars: THREE.Matrix4[] = [];
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const rnd = mulberry32(3);
  for (const [ax, az, bx, bz] of WALLS) {
    colliders.addSegment({ ax, az, bx, bz, r: 0.45 });
    const len = Math.hypot(bx - ax, bz - az);
    const n = Math.max(1, Math.round(len / 3));
    const angle = Math.atan2(-(bz - az), bx - ax);
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      const y = heightAt(x, z);
      const h = 2.3 + (rnd() < 0.15 ? -0.9 * rnd() : 0); // quelques pans écroulés
      m.compose(new THREE.Vector3(x, y + h / 2 - 1, z), q, new THREE.Vector3(len / n + 0.02, h + 2, 0.8));
      pieces.push(m.clone());
      m.compose(new THREE.Vector3(x, y + h + 0.08, z), q, new THREE.Vector3(len / n + 0.05, 0.16, 1.0));
      caps.push(m.clone());
      if (i % 3 === 0) {
        m.compose(new THREE.Vector3(ax + (bx - ax) * (i / n), y + 0.6, az + (bz - az) * (i / n)), q, new THREE.Vector3(1.1, 5.2, 1.1));
        pillars.push(m.clone());
      }
    }
  }
  const box = new THREE.BoxGeometry(1, 1, 1);
  const add = (list: THREE.Matrix4[], material: THREE.Material) => {
    const im = new THREE.InstancedMesh(box, material, list.length);
    list.forEach((mm, i) => im.setMatrixAt(i, mm));
    im.castShadow = true;
    im.receiveShadow = true;
    group.add(im);
  };
  add(pieces, mat);
  add(caps, capMat);
  add(pillars, mat);
  return group;
}

export interface GateView {
  id: string;
  group: THREE.Group;
  /** 0 = fermée, 1 = ouverte */
  setOpen: (t: number) => void;
}

/** Porte : deux piliers, un linteau et une dalle qui s'enfonce dans le sol. */
export function buildGate(id: string, x: number, z: number, rot: number, width: number, colliders: Colliders, isOpen: () => boolean): GateView {
  const g = new THREE.Group();
  g.name = `porte ${id}`;
  const y = heightAt(x, z);
  g.position.set(x, y, z);
  g.rotation.y = rot;
  const mat = stoneMaterial();
  for (const s of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.2, 4.6, 1.2), mat);
    p.position.set(s * (width / 2 + 0.6), 2.0, 0);
    p.castShadow = p.receiveShadow = true;
    g.add(p);
  }
  const lintel = new THREE.Mesh(new THREE.BoxGeometry(width + 2.8, 0.7, 1.4), stoneMaterial(STONE_DARK));
  lintel.position.set(0, 4.5, 0);
  lintel.castShadow = true;
  g.add(lintel);
  // dalle
  const slab = new THREE.Group();
  const slabMesh = new THREE.Mesh(new THREE.BoxGeometry(width, 3.9, 0.45), stoneMaterial('#e2d6c2'));
  slabMesh.position.y = 1.95;
  slabMesh.castShadow = slabMesh.receiveShadow = true;
  slab.add(slabMesh);
  // motif lumineux : un losange
  const glowMat = new THREE.MeshBasicMaterial({ color: '#5e513c', toneMapped: false });
  const diamond = new THREE.Mesh(new THREE.TorusGeometry(0.55, 0.06, 4, 4), glowMat);
  diamond.position.set(0, 2.2, 0.24);
  slab.add(diamond);
  const diamond2 = diamond.clone();
  diamond2.position.z = -0.24;
  slab.add(diamond2);
  g.add(slab);

  // collision de la dalle
  const c = Math.cos(rot);
  const s = Math.sin(rot);
  colliders.addSegment({
    ax: x - (c * width) / 2, az: z + (s * width) / 2, bx: x + (c * width) / 2, bz: z - (s * width) / 2,
    r: 0.4, active: () => !isOpen(),
  });
  // collision des piliers
  colliders.addCircle(x - c * (width / 2 + 0.6), z + s * (width / 2 + 0.6), 0.8);
  colliders.addCircle(x + c * (width / 2 + 0.6), z - s * (width / 2 + 0.6), 0.8);

  const setOpen = (t: number) => {
    slab.position.y = -4.0 * smoothstep(0, 1, t);
    glowMat.color.set('#5e513c').lerp(new THREE.Color('#ffc23d'), Math.min(1, t * 3));
  };
  setOpen(0);
  return { id, group: g, setOpen };
}

export function buildGates(colliders: Colliders, isOpen: (id: string) => boolean): GateView[] {
  return GATES.map((gt) => buildGate(gt.id, gt.x, gt.z, gt.rot, gt.width, colliders, () => isOpen(gt.id)));
}

/** Place centrale : dallage, colonnes et grand cristal endormi. */
export function buildPlaza(colliders: Colliders): { group: THREE.Group; crystal: THREE.Mesh } {
  const g = new THREE.Group();
  g.name = 'place';
  const y = heightAt(PLAZA.x, PLAZA.z);
  g.position.set(PLAZA.x, y, PLAZA.z);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(PLAZA.r, PLAZA.r + 0.3, 0.4, 24), stoneMaterial('#e6dccb'));
  floor.position.y = 0.05;
  floor.receiveShadow = true;
  g.add(floor);
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(3.2, 3.4, 0.35, 8), stoneMaterial(STONE_DARK));
  ring.position.y = 0.4;
  ring.receiveShadow = true;
  g.add(ring);
  const columnMat = stoneMaterial();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
    const r = PLAZA.r - 1.2;
    const h = i % 3 === 1 ? 2.2 : 5;
    const col = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, h, 8), columnMat);
    col.position.set(Math.cos(a) * r, h / 2, Math.sin(a) * r);
    col.castShadow = col.receiveShadow = true;
    g.add(col);
    colliders.addCircle(PLAZA.x + Math.cos(a) * r, PLAZA.z + Math.sin(a) * r, 0.65);
  }
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.3, 2.2, 6), columnMat);
  pedestal.position.y = 1.4;
  pedestal.castShadow = true;
  g.add(pedestal);
  colliders.addCircle(PLAZA.x, PLAZA.z, 1.5);
  const crystal = new THREE.Mesh(
    new THREE.OctahedronGeometry(1.1, 0),
    new THREE.MeshStandardMaterial({ color: '#c9d6e8', emissive: '#334455', roughness: 0.2, metalness: 0.1, flatShading: true }),
  );
  crystal.scale.set(1, 1.6, 1);
  crystal.position.y = 4.4;
  crystal.castShadow = true;
  g.add(crystal);
  return { group: g, crystal };
}

/** Le phare au sommet de l'île : repère visible de partout. */
export function buildLighthouse(colliders: Colliders): { group: THREE.Group; lamp: THREE.Mesh } {
  const g = new THREE.Group();
  g.name = 'phare';
  const y = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
  g.position.set(LIGHTHOUSE.x, y - 0.5, LIGHTHOUSE.z);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 3, 8), stoneMaterial(STONE_DARK));
  base.position.y = 1.5;
  g.add(base);
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 4.2, 24, 8), stoneMaterial());
  tower.position.y = 15;
  g.add(tower);
  for (const hy of [8, 16]) {
    const band = new THREE.Mesh(new THREE.CylinderGeometry(4.25 - hy * 0.068, 4.3 - hy * 0.068, 1.2, 8), stoneMaterial('#c96f5a'));
    band.position.y = hy;
    g.add(band);
  }
  const gallery = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 3.6, 0.6, 8), stoneMaterial(STONE_DARK));
  gallery.position.y = 27.3;
  g.add(gallery);
  const lamp = new THREE.Mesh(
    new THREE.CylinderGeometry(2, 2, 3, 8),
    new THREE.MeshStandardMaterial({ color: '#36414d', emissive: '#000000', roughness: 0.2, metalness: 0.3, flatShading: true }),
  );
  lamp.position.y = 29.1;
  g.add(lamp);
  const dome = new THREE.Mesh(new THREE.ConeGeometry(2.6, 2.4, 8), stoneMaterial('#c96f5a'));
  dome.position.y = 31.8;
  g.add(dome);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  colliders.addCircle(LIGHTHOUSE.x, LIGHTHOUSE.z, 7);
  return { group: g, lamp };
}
