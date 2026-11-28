import * as THREE from 'three';

/**
 * Les éclats gagnés : chacun vole depuis son énigme secrète jusqu'au phare puis tourne
 * en orbite autour de la lampe. Quand tous sont réunis, tout s'irise.
 * Dès le début, des alvéoles fantômes tournent déjà autour de la lampe, une par éclat à
 * trouver : on voit, sans un mot, qu'il y a des choses à chercher, et combien il en reste.
 */
interface Shard {
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  from: THREE.Vector3;
  t: number; // 0..1 pendant le vol, puis 1
  slot: number;
}

const COLORS = ['#ff5a4e', '#ffb33a', '#ffe14a', '#5be36f', '#3fd6ff', '#5d7bff', '#c86bff', '#ff7ad9', '#fff0b0'];

export class Shards {
  readonly group = new THREE.Group();
  private shards: Shard[] = [];
  private time = 0;

  /** les alvéoles vides (une par éclat), qui s'éteignent quand leur éclat arrive */
  private ghosts: THREE.Mesh[] = [];

  constructor(private lamp: THREE.Vector3, readonly total = 7) {
    this.group.name = 'éclats';
    const geo = new THREE.OctahedronGeometry(0.75, 0);
    const mat = new THREE.MeshBasicMaterial({ color: '#e8e4ff', transparent: true, opacity: 0.3, depthWrite: false, toneMapped: false });
    for (let i = 0; i < total; i++) {
      const g = new THREE.Mesh(geo, mat);
      g.scale.y = 1.6;
      this.ghosts.push(g);
      this.group.add(g);
    }
  }

  get count(): number {
    return this.shards.length;
  }

  get complete(): boolean {
    return this.shards.length >= this.total;
  }

  /** Ajoute un éclat ; `from` = d'où il s'envole (ou null : déjà en orbite). */
  add(from: THREE.Vector3 | null): void {
    const slot = this.shards.length;
    const col = new THREE.Color(COLORS[slot % COLORS.length]!);
    const mat = new THREE.MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, flatShading: true, roughness: 0.2 });
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(0.75, 0), mat);
    mesh.scale.y = 1.6;
    this.group.add(mesh);
    this.shards.push({ mesh, mat, from: from ? from.clone() : this.orbitPos(slot, 0), t: from ? 0 : 1, slot });
  }

  private orbitPos(slot: number, time: number): THREE.Vector3 {
    const a = (slot / this.total) * Math.PI * 2 + time * 0.4;
    return new THREE.Vector3(this.lamp.x + Math.cos(a) * 5.5, this.lamp.y + 1.2 + Math.sin(time * 1.3 + slot) * 0.4, this.lamp.z + Math.sin(a) * 5.5);
  }

  update(dt: number): void {
    this.time += dt;
    this.ghosts.forEach((g, slot) => {
      const s = this.shards[slot];
      g.visible = !s || s.t < 1;
      if (!g.visible) return;
      g.position.copy(this.orbitPos(slot, this.time));
      g.rotation.y = this.time * 0.6 + slot;
    });
    for (const s of this.shards) {
      const target = this.orbitPos(s.slot, this.time);
      if (s.t < 1) {
        s.t = Math.min(1, s.t + dt / 6);
        const e = s.t * s.t * (3 - 2 * s.t);
        // arc au-dessus de l'île
        const p = s.from.clone().lerp(target, e);
        p.y += Math.sin(Math.PI * e) * 30;
        s.mesh.position.copy(p);
      } else s.mesh.position.copy(target);
      s.mesh.rotation.y += dt * 2;
      if (this.complete) {
        // irisation : chaque éclat parcourt l'arc-en-ciel
        s.mat.emissive.setHSL((this.time * 0.08 + s.slot / this.total) % 1, 0.9, 0.55);
      }
    }
  }
}
