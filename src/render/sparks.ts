import * as THREE from 'three';

/** Point lumineux rond et doux. */
function dotTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 32;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.35, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 32, 32);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

/**
 * Étincelles de lumière : un petit jaillissement de points lumineux qui montent et
 * s'éteignent, quand une énigme est résolue. Un seul objet pour tout le jeu (un appel de dessin).
 */
export class Sparks {
  readonly points: THREE.Points;
  private pos: Float32Array;
  private col: Float32Array;
  private vel: Float32Array;
  private life: Float32Array;
  private base: Float32Array;
  private next = 0;

  constructor(private max = 400) {
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    this.vel = new Float32Array(max * 3);
    this.life = new Float32Array(max);
    this.base = new Float32Array(max * 3);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.col, 3));
    this.points = new THREE.Points(g, new THREE.PointsMaterial({
      size: 0.16, map: dotTexture(), vertexColors: true, transparent: true, blending: THREE.AdditiveBlending,
      depthWrite: false, toneMapped: false,
    }));
    this.points.frustumCulled = false;
    this.points.name = 'étincelles';
    for (let i = 0; i < max; i++) this.pos[i * 3 + 1] = -1000;
  }

  /** Fait jaillir `n` étincelles depuis `at`, dans la couleur donnée (blanche au cœur). */
  burst(at: THREE.Vector3, color: THREE.Color, n = 60, spread = 0.6): void {
    for (let k = 0; k < n; k++) {
      const i = this.next;
      this.next = (this.next + 1) % this.max;
      const a = Math.random() * Math.PI * 2;
      const r = Math.random() * spread;
      this.pos[i * 3] = at.x + Math.cos(a) * r * 0.5;
      this.pos[i * 3 + 1] = at.y + Math.random() * 0.2;
      this.pos[i * 3 + 2] = at.z + Math.sin(a) * r * 0.5;
      this.vel[i * 3] = Math.cos(a) * r * 1.2;
      this.vel[i * 3 + 1] = 0.8 + Math.random() * 1.8;
      this.vel[i * 3 + 2] = Math.sin(a) * r * 1.2;
      const c = color.clone().lerp(new THREE.Color('#ffffff'), Math.random() * 0.25);
      this.base[i * 3] = c.r;
      this.base[i * 3 + 1] = c.g;
      this.base[i * 3 + 2] = c.b;
      this.life[i] = 1.2 + Math.random() * 0.8;
    }
  }

  update(dt: number): void {
    let any = false;
    for (let i = 0; i < this.max; i++) {
      if (this.life[i]! <= 0) continue;
      any = true;
      this.life[i]! -= dt;
      const l = Math.max(0, this.life[i]!);
      this.vel[i * 3 + 1]! -= dt * 0.6; // légère retombée
      this.vel[i * 3]! *= 1 - dt * 0.8;
      this.vel[i * 3 + 2]! *= 1 - dt * 0.8;
      this.pos[i * 3]! += this.vel[i * 3]! * dt;
      this.pos[i * 3 + 1]! += this.vel[i * 3 + 1]! * dt;
      this.pos[i * 3 + 2]! += this.vel[i * 3 + 2]! * dt;
      const fade = Math.min(1, l * 1.5) * (0.7 + 0.3 * Math.sin(l * 40 + i));
      for (let c = 0; c < 3; c++) this.col[i * 3 + c] = this.base[i * 3 + c]! * fade;
      if (l <= 0) this.pos[i * 3 + 1] = -1000;
    }
    if (any) {
      this.points.geometry.attributes.position!.needsUpdate = true;
      this.points.geometry.attributes.color!.needsUpdate = true;
    }
  }
}
