import * as THREE from 'three';
import { heightAt } from '../world/terrain.ts';

/**
 * Câbles lumineux au sol : relient un panneau à ce qu'il alimente
 * (panneau suivant ou porte). Ils s'allument progressivement quand la source est résolue.
 */
interface Cable {
  from: string;
  mesh: THREE.InstancedMesh;
  count: number;
  progress: number; // 0..1
  lit: boolean;
}

const OFF = new THREE.Color('#5e513c');
const ON = new THREE.Color('#ffc23d');

export class Cables {
  readonly group = new THREE.Group();
  private cables: Cable[] = [];

  /** `links` : un câble par lien « source → cible » (positions au sol). */
  constructor(links: { from: string; ax: number; az: number; bx: number; bz: number }[]) {
    this.group.name = 'câbles';
    const tile = new THREE.BoxGeometry(0.16, 0.05, 0.42);
    for (const l of links) this.add(l.from, l.ax, l.az, l.bx, l.bz, tile);
  }

  private add(from: string, ax: number, az: number, bx: number, bz: number, geo: THREE.BufferGeometry): void {
    const len = Math.hypot(bx - ax, bz - az);
    const step = 0.55;
    const n = Math.max(2, Math.floor(len / step));
    const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
    const mesh = new THREE.InstancedMesh(geo, mat, n);
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.atan2(bx - ax, bz - az));
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n;
      const x = ax + (bx - ax) * t;
      const z = az + (bz - az) * t;
      m.compose(new THREE.Vector3(x, heightAt(x, z) + 0.02, z), q, new THREE.Vector3(1, 1, 1));
      mesh.setMatrixAt(i, m);
      mesh.setColorAt(i, OFF);
    }
    mesh.receiveShadow = false;
    this.group.add(mesh);
    this.cables.push({ from, mesh, count: n, progress: 0, lit: false });
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
    for (let i = 0; i < c.count; i++) {
      const t = i / c.count;
      const on = t < c.progress;
      const head = on && t > c.progress - 0.06 && c.progress < 1;
      c.mesh.setColorAt(i, on ? col.copy(ON).lerp(new THREE.Color('#ffffff'), head ? 0.7 : 0) : OFF);
    }
    if (c.mesh.instanceColor) c.mesh.instanceColor.needsUpdate = true;
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
