import * as THREE from 'three';

/**
 * Rotation affichée d'un objet après `turns` quarts de tour (pivot au centre de sa boîte).
 * Doit correspondre exactement à `rotateOnce` du moteur (vérifié par un test).
 */
export function objectEuler(axis: 'x' | 'y', turns: number): THREE.Euler {
  return axis === 'y' ? new THREE.Euler(0, -turns * (Math.PI / 2), 0) : new THREE.Euler(turns * (Math.PI / 2), 0, 0);
}
