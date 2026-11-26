import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Fusionne les maillages fixes (userData.static) d'un groupe : un seul maillage par
 * matériau et par réglage d'ombre. Divise le nombre d'appels de dessin d'un panneau.
 * Les maillages marqués userData.keep restent visibles quand on masque les détails.
 */
export function mergeStatic(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  const inv = root.matrixWorld.clone().invert();
  const groups = new Map<string, { mat: THREE.Material; cast: boolean; keep: boolean; geos: THREE.BufferGeometry[] }>();
  const done: THREE.Mesh[] = [];
  root.traverse((o) => {
    if (!(o instanceof THREE.Mesh) || !o.userData.static || Array.isArray(o.material)) return;
    const g = o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = `${o.material.uuid}|${o.castShadow}|${!!o.userData.keep}`;
    let e = groups.get(key);
    if (!e) {
      e = { mat: o.material, cast: o.castShadow, keep: !!o.userData.keep, geos: [] };
      groups.set(key, e);
    }
    e.geos.push(g.index ? g : g);
    done.push(o);
  });
  for (const o of done) o.parent?.remove(o);
  for (const e of groups.values()) {
    const indexed = e.geos.every((g) => g.index);
    const geos = indexed ? e.geos : e.geos.map((g) => (g.index ? g.toNonIndexed() : g));
    // mêmes attributs pour tous (position, normale, uv)
    for (const g of geos) for (const name of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(name)) g.deleteAttribute(name);
    const merged = mergeGeometries(geos, false);
    if (!merged) continue;
    const m = new THREE.Mesh(merged, e.mat);
    m.castShadow = e.cast;
    m.receiveShadow = true;
    m.userData.keep = e.keep;
    m.userData.merged = true;
    root.add(m);
  }
}

/** Fusionne des cubes (ou toute liste de maillages au même matériau) en un seul maillage. */
export function mergeMeshes(meshes: THREE.Mesh[], parent: THREE.Object3D, material: THREE.Material): THREE.Mesh {
  parent.updateMatrixWorld(true);
  const inv = parent.matrixWorld.clone().invert();
  const geos = meshes.map((o) => o.geometry.clone().applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld)));
  for (const o of meshes) o.parent?.remove(o);
  const m = new THREE.Mesh(mergeGeometries(geos, false)!, material);
  parent.add(m);
  return m;
}
