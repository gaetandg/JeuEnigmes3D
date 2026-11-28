import * as THREE from 'three';

/** Anneau lumineux doux (texture partagée). */
function ringTexture(): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 14, 32, 32, 31);
  grd.addColorStop(0, 'rgba(255,255,255,0)');
  grd.addColorStop(0.55, 'rgba(255,255,255,1)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const POOL = 24;

/** Un anneau autour d'un objet : sa position dans le monde, et un rayon d'après sa taille. */
export function ringAround(obj: THREE.Object3D, k = 1.4): { pos: THREE.Vector3; r: number } {
  obj.updateWorldMatrix(true, false);
  const pos = obj.getWorldPosition(new THREE.Vector3());
  let r = 0.15;
  if (obj instanceof THREE.Mesh) {
    obj.geometry.computeBoundingSphere();
    const scale = obj.getWorldScale(new THREE.Vector3());
    r = obj.geometry.boundingSphere!.radius * Math.max(scale.x, scale.y, scale.z);
  }
  return { pos, r: r * k };
}

/**
 * Aide, premier palier : des anneaux qui palpitent sur ce qui n'est pas encore comme il faut
 * (cristaux non éclairés, creux sans leur bille…). Ils se voient à travers le plateau, quelques
 * secondes, puis s'effacent.
 */
export class GoalRings {
  readonly group = new THREE.Group();
  private rings: THREE.Sprite[] = [];
  private until = -1;
  private start = 0;

  constructor() {
    this.group.name = 'aide : où regarder';
    const tex = ringTexture();
    for (let i = 0; i < POOL; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({
        map: tex, color: '#9fe8ff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, depthTest: false, toneMapped: false,
      }));
      s.renderOrder = 10;
      s.visible = false;
      this.rings.push(s);
      this.group.add(s);
    }
  }

  get active(): boolean {
    return this.until > 0;
  }

  show(points: { pos: THREE.Vector3; r: number }[], time: number, duration = 4.5): void {
    this.start = time;
    this.until = time + duration;
    this.rings.forEach((s, i) => {
      const p = points[i];
      s.visible = !!p;
      if (!p) return;
      s.position.copy(p.pos);
      s.userData.r = p.r;
    });
  }

  update(time: number): void {
    if (this.until < 0) return;
    const left = this.until - time;
    if (left <= 0) {
      this.until = -1;
      for (const s of this.rings) s.visible = false;
      return;
    }
    // apparition, trois pulsations, effacement
    const fade = Math.min(1, (time - this.start) / 0.3, left / 0.8);
    const beat = 0.5 + 0.5 * Math.sin((time - this.start) * 5);
    for (const s of this.rings) {
      if (!s.visible) continue;
      const r = (s.userData.r as number) * (1.2 + 0.35 * beat);
      s.scale.set(r * 2, r * 2, 1);
      (s.material as THREE.SpriteMaterial).opacity = fade * (0.55 + 0.45 * beat);
    }
  }
}
