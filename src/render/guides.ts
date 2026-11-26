import * as THREE from 'three';

/**
 * Guide lumineux : une colonne de lumière douce au-dessus de chaque énigme allumée et
 * non résolue, visible de loin, qui s'efface quand on s'approche.
 */
export class GuideBeams {
  readonly mesh: THREE.InstancedMesh;
  private mat: THREE.MeshBasicMaterial;

  constructor(max = 64) {
    const geo = new THREE.CylinderGeometry(0.15, 0.6, 12, 10, 1, true);
    geo.translate(0, 6, 0);
    this.mat = new THREE.MeshBasicMaterial({
      color: '#ffcf70', transparent: true, opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    });
    this.mesh = new THREE.InstancedMesh(geo, this.mat, max);
    this.mesh.count = 0;
    this.mesh.frustumCulled = false;
    this.mesh.name = 'guides';
  }

  set(points: THREE.Vector3[]): void {
    const m = new THREE.Matrix4();
    const n = Math.min(points.length, this.mesh.instanceMatrix.count);
    for (let i = 0; i < n; i++) this.mesh.setMatrixAt(i, m.makeTranslation(points[i]!.x, points[i]!.y, points[i]!.z));
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  update(t: number, visible: boolean): void {
    this.mesh.visible = visible;
    this.mat.opacity = 0.12 + 0.1 * (0.5 + 0.5 * Math.sin(t * 1.6));
  }
}
