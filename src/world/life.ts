import * as THREE from 'three';
import { mulberry32 } from './noise.ts';
import { HORIZON } from '../render/environment.ts';
import { mergeMeshes } from '../render/merge.ts';

/**
 * Ce qui bouge sans le joueur : nuages qui dérivent, oiseaux qui tournent au-dessus de
 * l'île, papillons autour des massifs de fleurs. Tout est léger : un appel de dessin par nuage,
 * un pour tous les oiseaux, un pour tous les papillons.
 */
export function buildLife(beds: THREE.Vector3[]): { group: THREE.Group; update: (t: number, dt: number) => void } {
  const g = new THREE.Group();
  g.name = 'vie';
  const rnd = mulberry32(77);

  // ── nuages : grappes de boules à facettes ───────────────────────────────
  const cloudMat = new THREE.MeshStandardMaterial({ color: '#ffffff', flatShading: true, roughness: 1, fog: false, transparent: true, opacity: 0.92 });
  const clouds: { mesh: THREE.Group; speed: number; r: number; a: number; y: number }[] = [];
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Group();
    const n = 5 + Math.floor(rnd() * 5);
    const puffs: THREE.Mesh[] = [];
    for (let k = 0; k < n; k++) {
      const s = 11 + rnd() * 12;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), cloudMat);
      m.scale.y = 0.55;
      m.position.set((k - n / 2) * 15 + rnd() * 8, rnd() * 6, rnd() * 14);
      c.add(m);
      puffs.push(m);
    }
    // un nuage = un seul maillage (ses boules ne bougent pas entre elles)
    mergeMeshes(puffs, c, cloudMat);
    const cl = { mesh: c, speed: 0.004 + rnd() * 0.004, r: 160 + rnd() * 200, a: rnd() * Math.PI * 2, y: 70 + rnd() * 40 };
    clouds.push(cl);
    g.add(c);
  }

  // ── oiseaux : deux ailes qui battent, en cercles lents ──────────────────
  // chaque aile est une instance d'un seul maillage (un appel de dessin pour tous les oiseaux) ;
  // les « os » (racine, ailes) ne sont pas dans la scène : ils servent à calculer les matrices
  const birdMat = new THREE.MeshBasicMaterial({ color: '#3a3330', side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1.1, 0, 0], 3));
  type Rig = { root: THREE.Object3D; l: THREE.Object3D; r: THREE.Object3D };
  const rig = (): Rig => {
    const root = new THREE.Object3D();
    const l = new THREE.Object3D();
    const r = new THREE.Object3D();
    r.scale.x = -1;
    root.add(l, r);
    return { root, l, r };
  };
  const birds: (Rig & { cx: number; cz: number; rad: number; a: number; sp: number; y: number; ph: number })[] = [];
  for (let i = 0; i < 7; i++) {
    const b = rig();
    b.root.scale.setScalar(0.9);
    birds.push({ ...b, cx: (rnd() - 0.5) * 120, cz: -20 + (rnd() - 0.5) * 140, rad: 25 + rnd() * 40, a: rnd() * 6, sp: (0.12 + rnd() * 0.1) * (rnd() < 0.5 ? 1 : -1), y: 32 + rnd() * 25, ph: rnd() * 6 });
  }
  const birdWings = new THREE.InstancedMesh(wing, birdMat, birds.length * 2);
  birdWings.frustumCulled = false;
  g.add(birdWings);

  // ── papillons autour des massifs du jardin ──────────────────────────────
  const butterflyCols = ['#ffd45e', '#ffffff', '#f49ac1', '#8fc0ff', '#ff9a5c'];
  const flies: (Rig & { home: THREE.Vector3; ph: number; sp: number })[] = [];
  const bwing = new THREE.CircleGeometry(0.07, 5);
  bwing.translate(0.06, 0, 0);
  const nFlies = Math.min(18, beds.length);
  const flyWings = new THREE.InstancedMesh(bwing, new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), Math.max(1, nFlies * 2));
  flyWings.count = nFlies * 2;
  flyWings.frustumCulled = false;
  const col = new THREE.Color();
  for (let i = 0; i < nFlies; i++) {
    const home = beds[(i * 7) % beds.length]!;
    const f = rig();
    f.l.rotation.x = f.r.rotation.x = -Math.PI / 2;
    col.set(butterflyCols[i % butterflyCols.length]!);
    flyWings.setColorAt(i * 2, col);
    flyWings.setColorAt(i * 2 + 1, col);
    flies.push({ ...f, home, ph: rnd() * 10, sp: 0.6 + rnd() * 0.6 });
  }
  g.add(flyWings);

  const update = (t: number) => {
    // les nuages prennent la teinte du ciel (rosés au crépuscule)
    cloudMat.color.copy(HORIZON).lerp(new THREE.Color('#ffffff'), 0.7);
    cloudMat.emissive.copy(cloudMat.color).multiplyScalar(0.55);
    for (const c of clouds) {
      c.a += c.speed * 0.016;
      c.mesh.position.set(Math.cos(c.a) * c.r, c.y, -15 + Math.sin(c.a) * c.r);
      c.mesh.rotation.y = -c.a;
    }
    for (const b of birds) {
      const a = b.a + t * b.sp;
      b.root.position.set(b.cx + Math.cos(a) * b.rad, b.y + Math.sin(t * 0.4 + b.ph) * 2, b.cz + Math.sin(a) * b.rad);
      b.root.rotation.y = -a + (b.sp > 0 ? 0 : Math.PI);
      const flap = Math.sin(t * 7 + b.ph) * 0.5;
      b.l.rotation.z = flap;
      b.r.rotation.z = -flap;
    }
    birds.forEach((b, i) => {
      b.root.updateMatrixWorld(true);
      birdWings.setMatrixAt(i * 2, b.l.matrixWorld);
      birdWings.setMatrixAt(i * 2 + 1, b.r.matrixWorld);
    });
    birdWings.instanceMatrix.needsUpdate = true;
    for (const f of flies) {
      const u = t * f.sp + f.ph;
      f.root.position.set(
        f.home.x + Math.sin(u * 0.9) * 1.4 + Math.sin(u * 2.3) * 0.3,
        f.home.y + 0.6 + Math.sin(u * 1.7) * 0.35 + 0.2,
        f.home.z + Math.cos(u * 0.7) * 1.2,
      );
      f.root.rotation.y = u;
      const flap = Math.abs(Math.sin(u * 18)) * 1.2;
      f.l.rotation.y = flap;
      f.r.rotation.y = -flap;
    }
    flies.forEach((f, i) => {
      f.root.updateMatrixWorld(true);
      flyWings.setMatrixAt(i * 2, f.l.matrixWorld);
      flyWings.setMatrixAt(i * 2 + 1, f.r.matrixWorld);
    });
    flyWings.instanceMatrix.needsUpdate = true;
  };
  return { group: g, update };
}
