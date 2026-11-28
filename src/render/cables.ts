import * as THREE from 'three';
import { heightAt } from '../world/terrain.ts';

/**
 * Câbles lumineux au sol : relient un panneau à ce qu'il alimente
 * (panneau suivant ou porte). Ils s'allument progressivement quand la source est résolue.
 */
interface Cable {
  from: string;
  /** première tuile du câble dans le maillage commun, et nombre de tuiles */
  start: number;
  count: number;
  progress: number; // 0..1
  lit: boolean;
}

const OFF = new THREE.Color('#5e513c');
const ON = new THREE.Color('#ffc23d');

/**
 * Tous les câbles en un seul maillage instancié (un appel de dessin) : chaque câble est une
 * tranche de tuiles, qu'on colore à mesure que la lumière y court.
 */
export class Cables {
  readonly group = new THREE.Group();
  private cables: Cable[] = [];
  private mesh: THREE.InstancedMesh;

  /** `links` : un câble par lien « source → cible » (positions au sol). */
  constructor(links: { from: string; ax: number; az: number; bx: number; bz: number }[]) {
    this.group.name = 'câbles';
    const step = 0.55;
    const counts = links.map((l) => Math.max(2, Math.floor(Math.hypot(l.bx - l.ax, l.bz - l.az) / step)));
    const total = counts.reduce((a, b) => a + b, 0);
    this.mesh = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.05, 0.42), new THREE.MeshBasicMaterial({ toneMapped: false }), Math.max(1, total));
    this.mesh.receiveShadow = false;
    const m = new THREE.Matrix4();
    let at = 0;
    links.forEach((l, k) => {
      const n = counts[k]!;
      const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(l.bx - l.ax, l.bz - l.az));
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n;
        const x = l.ax + (l.bx - l.ax) * t;
        const z = l.az + (l.bz - l.az) * t;
        m.compose(new THREE.Vector3(x, heightAt(x, z) + 0.02, z), q, new THREE.Vector3(1, 1, 1));
        this.mesh.setMatrixAt(at + i, m);
        this.mesh.setColorAt(at + i, OFF);
      }
      this.cables.push({ from: l.from, start: at, count: n, progress: 0, lit: false });
      at += n;
    });
    this.mesh.count = total;
    // les câbles couvrent toute l'île : on ne les écarte jamais du champ en bloc
    this.mesh.frustumCulled = false;
    this.group.add(this.mesh);
  }

  /** Allume les câbles qui partent de ce panneau (animé sauf si `instant`). */
  light(from: string, instant = false): boolean {
    let any = false;
    for (const c of this.cables) {
      if (c.from !== from || c.lit) continue;
      c.lit = true;
      any = true;
      if (instant) {
        c.progress = 1;
        this.paint(c);
      }
    }
    return any;
  }

  reset(): void {
    for (const c of this.cables) {
      c.lit = false;
      c.progress = 0;
      this.paint(c);
    }
  }

  private paint(c: Cable): void {
    const col = new THREE.Color();
    const white = new THREE.Color('#ffffff');
    for (let i = 0; i < c.count; i++) {
      const t = i / c.count;
      const on = t < c.progress;
      const head = on && t > c.progress - 0.06 && c.progress < 1;
      this.mesh.setColorAt(c.start + i, on ? col.copy(ON).lerp(white, head ? 0.7 : 0) : OFF);
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  update(dt: number): void {
    for (const c of this.cables) {
      if (c.lit && c.progress < 1) {
        c.progress = Math.min(1, c.progress + dt * (10 / (c.count * 0.55)));
        this.paint(c);
      }
    }
  }
}
