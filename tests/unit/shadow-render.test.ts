import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { N, SHAPES, parseShape, rotated } from '../../src/core/shadow/index.ts';
import { objectEuler } from '../../src/render/shadowMath.ts';

/** Position (en cases) de chaque cube une fois l'objet tourné comme à l'écran. */
function displayed(shape: [number, number, number][], axis: 'x' | 'y', turns: number): string[] {
  const pivot = new THREE.Object3D();
  pivot.rotation.copy(objectEuler(axis, turns));
  pivot.updateMatrixWorld(true);
  return shape
    .map(([x, y, z]) => new THREE.Vector3(x - 1, y - 1, z - 1).applyMatrix4(pivot.matrixWorld))
    .map((p) => `${Math.round(p.x + 1)},${Math.round(p.y + 1)},${Math.round(p.z + 1)}`)
    .sort();
}

describe("ombres — ce qu'on voit tourne comme le moteur", () => {
  for (const [name, text] of Object.entries(SHAPES)) {
    for (const axis of ['x', 'y'] as const) {
      it(`${name}, axe ${axis}`, () => {
        const shape = parseShape(text);
        for (let t = 0; t < 4; t++) {
          const logic = rotated(shape, axis, t).map(([x, y, z]) => `${x},${y},${z}`).sort();
          expect(displayed(shape, axis, t)).toEqual(logic);
        }
      });
    }
  }
  it('la boîte fait bien 3 cases', () => expect(N).toBe(3));
});
