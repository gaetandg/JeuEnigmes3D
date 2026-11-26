import * as THREE from 'three';
import { mulberry32 } from './noise.ts';
import { HORIZON } from '../render/environment.ts';

/**
 * Ce qui bouge sans le joueur : nuages qui dérivent, oiseaux qui tournent au-dessus de
 * l'île, papillons autour des massifs de fleurs. Tout est léger (quelques appels de dessin).
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
    for (let k = 0; k < n; k++) {
      const s = 11 + rnd() * 12;
      const m = new THREE.Mesh(new THREE.IcosahedronGeometry(s, 0), cloudMat);
      m.scale.y = 0.55;
      m.position.set((k - n / 2) * 15 + rnd() * 8, rnd() * 6, rnd() * 14);
      c.add(m);
    }
    const cl = { mesh: c, speed: 0.004 + rnd() * 0.004, r: 160 + rnd() * 200, a: rnd() * Math.PI * 2, y: 70 + rnd() * 40 };
    clouds.push(cl);
    g.add(c);
  }

  // ── oiseaux : deux ailes qui battent, en cercles lents ──────────────────
  const birdMat = new THREE.MeshBasicMaterial({ color: '#3a3330', side: THREE.DoubleSide });
  const wing = new THREE.BufferGeometry();
  wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, -0.25, 0, 0, 0.25, 1.1, 0, 0], 3));
  const birds: { root: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; cx: number; cz: number; rad: number; a: number; sp: number; y: number; ph: number }[] = [];
  for (let i = 0; i < 7; i++) {
    const root = new THREE.Group();
    const l = new THREE.Mesh(wing, birdMat);
    const r = new THREE.Mesh(wing, birdMat);
    r.scale.x = -1;
    root.add(l, r);
    root.scale.setScalar(0.9);
    g.add(root);
    birds.push({ root, l, r, cx: (rnd() - 0.5) * 120, cz: -20 + (rnd() - 0.5) * 140, rad: 25 + rnd() * 40, a: rnd() * 6, sp: (0.12 + rnd() * 0.1) * (rnd() < 0.5 ? 1 : -1), y: 32 + rnd() * 25, ph: rnd() * 6 });
  }

  // ── papillons autour des massifs du jardin ──────────────────────────────
  const butterflyCols = ['#ffd45e', '#ffffff', '#f49ac1', '#8fc0ff', '#ff9a5c'];
  const flies: { root: THREE.Group; l: THREE.Mesh; r: THREE.Mesh; home: THREE.Vector3; ph: number; sp: number }[] = [];
  const bwing = new THREE.CircleGeometry(0.07, 5);
  bwing.translate(0.06, 0, 0);
  for (let i = 0; i < Math.min(18, beds.length); i++) {
    const home = beds[(i * 7) % beds.length]!;
    const mat = new THREE.MeshBasicMaterial({ color: butterflyCols[i % butterflyCols.length]!, side: THREE.DoubleSide });
    const root = new THREE.Group();
    const l = new THREE.Mesh(bwing, mat);
    const r = new THREE.Mesh(bwing, mat);
    r.scale.x = -1;
    l.rotation.x = r.rotation.x = -Math.PI / 2;
    root.add(l, r);
    g.add(root);
    flies.push({ root, l, r, home, ph: rnd() * 10, sp: 0.6 + rnd() * 0.6 });
  }

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
  };
  return { group: g, update };
}
