import * as THREE from 'three';
import { MAP_TABLE } from './layout.ts';
import { heightAt } from './terrain.ts';
import { stoneMaterial } from './props.ts';
import { drawMap, mapAspect } from '../ui/map.ts';
import type { MapData } from '../ui/map.ts';
import type { Colliders } from '../game/colliders.ts';

const WIDTH = 1.5;
const TILT = 0.62;
/** de combien la table est enfoncée avant d'apparaître (m) */
const BURIED = 2.6;

/**
 * La table d'orientation de la place : la carte du gardien, gravée sur une table de pierre
 * inclinée. Elle sort du sol quand le jardin est fini (les Tours-Miroirs) ; il faut revenir sur
 * la place pour la consulter. Aucun texte : des lanternes, des étoiles, un anneau qui se remplit.
 */
export interface MapTable {
  group: THREE.Group;
  /** 0 : enfouie ; 1 : sortie */
  setRaise(k: number): void;
  /** redessine la carte (les lanternes à faire palpitent) */
  redraw(data: MapData, time: number): void;
  /** point au centre de la carte (pour savoir si on la regarde de près) */
  center: THREE.Vector3;
}

export function buildMapTable(colliders: Colliders): MapTable {
  const root = new THREE.Group();
  root.name = 'table d\'orientation';
  root.position.set(MAP_TABLE.x, heightAt(MAP_TABLE.x, MAP_TABLE.z), MAP_TABLE.z);
  root.rotation.y = MAP_TABLE.yaw;
  const lift = new THREE.Group();
  root.add(lift);
  const stone = stoneMaterial('#cfc4b0');
  // le pied s'arrête sous le plateau incliné (dont le bord avant descend bien plus bas que le centre)
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.36, 0.6, 0.7, 8), stone);
  foot.position.y = 0.35;
  foot.castShadow = foot.receiveShadow = true;
  lift.add(foot);
  const D = WIDTH * mapAspect();
  const board = new THREE.Group();
  board.position.y = 1.0;
  board.rotation.x = TILT;
  lift.add(board);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(WIDTH + 0.14, 0.1, D + 0.14), stone);
  frame.position.y = -0.05;
  frame.castShadow = frame.receiveShadow = true;
  board.add(frame);
  const canvas = document.createElement('canvas');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  const map = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, D), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.25 }));
  map.rotation.x = -Math.PI / 2;
  map.position.y = 0.003;
  board.add(map);
  colliders.addCircle(MAP_TABLE.x, MAP_TABLE.z, 0.65);
  root.visible = false;
  return {
    group: root,
    center: new THREE.Vector3(MAP_TABLE.x, root.position.y + 1.1, MAP_TABLE.z),
    setRaise(k: number) {
      lift.position.y = -BURIED * (1 - THREE.MathUtils.clamp(k, 0, 1));
      root.visible = k > 0.001;
    },
    redraw(data: MapData, time: number) {
      drawMap(canvas, data, time, { width: 512, dpr: 1 });
      tex.needsUpdate = true;
    },
  };
}
