import * as THREE from 'three';
import { heightAt } from './terrain.ts';
import { ATELIER, GRAND_PLI } from './layout.ts';
import { stoneMaterial } from './props.ts';
import { mergeStatic } from '../render/merge.ts';
import { mulberry32 } from './noise.ts';
import type { Colliders } from '../game/colliders.ts';

/**
 * Décor de l'Atelier de Papier : dallage, pergolas de bois avec des lés de papier
 * qui ondulent au vent, lanternes de papier.
 */
export function buildAtelier(colliders: Colliders): { group: THREE.Group; update: (t: number) => void } {
  const g = new THREE.Group();
  g.name = 'atelier';
  const rnd = mulberry32(11);
  const wood = new THREE.MeshStandardMaterial({ color: '#8a6446', roughness: 0.9, flatShading: true });
  const paper = new THREE.MeshStandardMaterial({ color: '#f5ecd6', roughness: 0.9, side: THREE.DoubleSide });
  const lantern = new THREE.MeshStandardMaterial({ color: '#ffe2a8', emissive: '#ffb45a', emissiveIntensity: 0.6, roughness: 0.8 });

  // dallage circulaire
  const y0 = heightAt(ATELIER.x, ATELIER.z);
  const floor = new THREE.Mesh(new THREE.CylinderGeometry(ATELIER.r - 2, ATELIER.r - 1.6, 0.3, 32), stoneMaterial('#e4d8c3'));
  floor.position.set(ATELIER.x, y0 - 0.05, ATELIER.z);
  floor.receiveShadow = true;
  g.add(floor);

  // pergolas en anneau
  const banners: { mesh: THREE.Mesh; phase: number }[] = [];
  const n = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + 0.2;
    // on laisse libre la vue sur le Grand Pli (côté sud)
    if (Math.abs(Math.atan2(Math.sin(a - Math.PI / 2), Math.cos(a - Math.PI / 2))) < 0.75) continue;
    const cx = ATELIER.x + Math.cos(a) * 11.2;
    const cz = ATELIER.z + Math.sin(a) * 11.2;
    const y = heightAt(cx, cz);
    const frame = new THREE.Group();
    frame.position.set(cx, y, cz);
    frame.rotation.y = -a;
    for (const s of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.25, 4.2, 0.25), wood);
      post.position.set(0, 2.1, s * 2);
      post.userData.static = true;
      frame.add(post);
      colliders.addCircle(cx + Math.sin(a) * s * 2, cz + Math.cos(a) * s * 2 * -1, 0.3);
    }
    const beam = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 5.2), wood);
    beam.position.y = 4.2;
    beam.userData.static = true;
    frame.add(beam);
    // lés de papier suspendus
    for (let k = -1; k <= 1; k++) {
      const geo = new THREE.PlaneGeometry(0.9, 2.4, 1, 6);
      geo.translate(0, -1.2, 0);
      const m = new THREE.Mesh(geo, paper);
      m.position.set(0, 4.05, k * 1.2);
      m.rotation.y = Math.PI / 2;
      m.castShadow = true;
      frame.add(m);
      banners.push({ mesh: m, phase: rnd() * 6 });
    }
    frame.traverse((o) => {
      if (o instanceof THREE.Mesh && o.material === wood) o.castShadow = o.receiveShadow = true;
    });
    g.add(frame);
  }

  // lanternes sur poteaux entre les pupitres
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const x = ATELIER.x + Math.cos(a) * 19.5;
    const z = ATELIER.z + Math.sin(a) * 19.5;
    const y = heightAt(x, z);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 2.6, 6), wood);
    pole.position.set(x, y + 1.3, z);
    pole.castShadow = true;
    g.add(pole);
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.26, 0.5, 8), lantern);
    l.position.set(x, y + 2.75, z);
    pole.userData.static = l.userData.static = true;
    g.add(l);
    colliders.addCircle(x, z, 0.25);
  }
  // poteaux, poutres, mâts et lanternes ne bougent pas : un maillage par matériau (les lés, eux, ondulent)
  mergeStatic(g);
  void GRAND_PLI;

  // les lés ondulent au vent
  const update = (t: number) => {
    for (const b of banners) {
      b.mesh.rotation.x = Math.sin(t * 1.3 + b.phase) * 0.12;
      b.mesh.rotation.z = Math.sin(t * 0.9 + b.phase * 2) * 0.05;
    }
  };
  return { group: g, update };
}
