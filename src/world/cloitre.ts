import * as THREE from 'three';
import { heightAt } from './terrain.ts';
import { CLOITRE } from './layout.ts';
import { STONE, stoneMaterial } from './props.ts';
import type { Colliders } from '../game/colliders.ts';

/**
 * Cloître des Ombres : une colonnade carrée dont le soleil dessine les ombres
 * sur le dallage, un muret extérieur, une entrée à l'ouest.
 */
export function buildCloitre(colliders: Colliders): THREE.Group {
  const g = new THREE.Group();
  g.name = 'cloître';
  const { x: cx, z: cz, half } = CLOITRE;
  const y0 = heightAt(cx, cz);
  // dallage
  const floor = new THREE.Mesh(new THREE.BoxGeometry(half * 2 + 6, 0.4, half * 2 + 6), stoneMaterial('#ded2bd'));
  floor.position.set(cx, y0 - 0.18, cz);
  floor.receiveShadow = true;
  g.add(floor);
  // colonnade : colonnes tous les 3 m sur le carré, linteau continu
  const colGeo = new THREE.CylinderGeometry(0.42, 0.5, 4.6, 10);
  const capGeo = new THREE.BoxGeometry(1.2, 0.35, 1.2);
  const colMat = stoneMaterial(STONE);
  const positions: [number, number][] = [];
  const step = 3;
  for (let s = -half; s <= half + 0.01; s += step) {
    positions.push([cx + s, cz - half], [cx + s, cz + half]);
    if (Math.abs(s) < half - 0.01) {
      // l'entrée ouest reste ouverte
      if (Math.abs(s) > 2) positions.push([cx - half, cz + s]);
      positions.push([cx + half, cz + s]);
    }
  }
  const cols = new THREE.InstancedMesh(colGeo, colMat, positions.length);
  const caps = new THREE.InstancedMesh(capGeo, stoneMaterial('#d8cdbb'), positions.length);
  const m = new THREE.Matrix4();
  positions.forEach(([x, z], i) => {
    const y = heightAt(x, z);
    m.makeTranslation(x, y + 2.3, z);
    cols.setMatrixAt(i, m);
    m.makeTranslation(x, y + 4.7, z);
    caps.setMatrixAt(i, m);
    colliders.addCircle(x, z, 0.55);
  });
  cols.castShadow = cols.receiveShadow = true;
  caps.castShadow = true;
  g.add(cols, caps);
  // linteaux
  const beamMat = stoneMaterial('#e6dccb');
  const ly = y0 + 5.1;
  for (const [x, z, w, d] of [
    [cx, cz - half, half * 2 + 1.2, 0.9],
    [cx, cz + half, half * 2 + 1.2, 0.9],
    [cx + half, cz, 0.9, half * 2 + 1.2],
    [cx - half, cz - (half + 2) / 2 - 1, 0.9, half - 2 + 1.2],
    [cx - half, cz + (half + 2) / 2 + 1, 0.9, half - 2 + 1.2],
  ] as const) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6, d), beamMat);
    b.position.set(x, ly, z);
    b.castShadow = true;
    g.add(b);
  }
  // treille au-dessus de la galerie : des poutres fines qui hachent la lumière
  const slatGeo = new THREE.BoxGeometry(0.18, 0.18, 3.2);
  const slats = new THREE.InstancedMesh(slatGeo, beamMat, 200);
  let n = 0;
  const q = new THREE.Quaternion();
  for (let s = -half; s <= half; s += 1.2) {
    for (const side of [0, 1, 2]) {
      let x = cx + s, z = cz - half - 1.6, rot = 0;
      if (side === 1) z = cz + half + 1.6;
      if (side === 2) { x = cx + half + 1.6; z = cz + s; rot = Math.PI / 2; }
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rot);
      m.compose(new THREE.Vector3(x, ly + 0.1, z), q, new THREE.Vector3(1, 1, 1));
      slats.setMatrixAt(n++, m);
    }
  }
  slats.count = n;
  slats.castShadow = true;
  g.add(slats);
  // muret extérieur (sauf à l'ouest)
  const wallMat = stoneMaterial('#e8dfcf');
  const o = half + 3.4;
  for (const [ax, az, bx, bz] of [
    [cx - o, cz - o, cx + o, cz - o],
    [cx + o, cz - o, cx + o, cz + o],
    [cx + o, cz + o, cx - o, cz + o],
  ] as const) {
    const len = Math.hypot(bx - ax, bz - az);
    const w = new THREE.Mesh(new THREE.BoxGeometry(len, 1.4, 0.6), wallMat);
    w.position.set((ax + bx) / 2, heightAt((ax + bx) / 2, (az + bz) / 2) + 0.5, (az + bz) / 2);
    w.rotation.y = Math.atan2(-(bz - az), bx - ax);
    w.castShadow = w.receiveShadow = true;
    g.add(w);
    colliders.addSegment({ ax, az, bx, bz, r: 0.35 });
  }
  return g;
}
