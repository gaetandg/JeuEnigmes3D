/** Collisions 2D (plan x/z) : cercles (arbres, piliers) et segments épais (murs, portes). */

export interface CircleCollider {
  x: number;
  z: number;
  r: number;
}

export interface SegmentCollider {
  ax: number;
  az: number;
  bx: number;
  bz: number;
  /** demi-épaisseur */
  r: number;
  /** collision active ? (une porte ouverte ne bloque plus) */
  active?: () => boolean;
}

export class Colliders {
  circles: CircleCollider[] = [];
  segments: SegmentCollider[] = [];

  addCircle(x: number, z: number, r: number): void {
    this.circles.push({ x, z, r });
  }

  addSegment(s: SegmentCollider): void {
    this.segments.push(s);
  }

  /** Repousse le point (x, z) hors des obstacles. Renvoie la position corrigée. */
  resolve(x: number, z: number, radius: number): { x: number; z: number } {
    for (let iter = 0; iter < 3; iter++) {
      for (const c of this.circles) {
        const dx = x - c.x;
        const dz = z - c.z;
        const min = c.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min && d2 > 1e-8) {
          const d = Math.sqrt(d2);
          x = c.x + (dx / d) * min;
          z = c.z + (dz / d) * min;
        }
      }
      for (const s of this.segments) {
        if (s.active && !s.active()) continue;
        const ex = s.bx - s.ax;
        const ez = s.bz - s.az;
        const l2 = ex * ex + ez * ez;
        const t = l2 === 0 ? 0 : Math.max(0, Math.min(1, ((x - s.ax) * ex + (z - s.az) * ez) / l2));
        const px = s.ax + t * ex;
        const pz = s.az + t * ez;
        const dx = x - px;
        const dz = z - pz;
        const min = s.r + radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < min * min) {
          const d = Math.sqrt(d2);
          if (d > 1e-6) {
            x = px + (dx / d) * min;
            z = pz + (dz / d) * min;
          } else {
            // exactement sur le segment : pousser selon la normale
            const l = Math.sqrt(l2) || 1;
            x = px + (-ez / l) * min;
            z = pz + (ex / l) * min;
          }
        }
      }
    }
    return { x, z };
  }
}
