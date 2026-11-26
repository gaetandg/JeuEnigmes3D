import * as THREE from 'three';

const canvas = document.querySelector<HTMLCanvasElement>('#scene')!;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#f4d6a0');
const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 100);
camera.position.set(0, 1.5, 4);

const crystal = new THREE.Mesh(
  new THREE.OctahedronGeometry(1),
  new THREE.MeshStandardMaterial({ color: '#ff4f9a', flatShading: true }),
);
scene.add(crystal);
scene.add(new THREE.HemisphereLight('#fff6e0', '#5a6b7a', 1.5));
const sun = new THREE.DirectionalLight('#ffffff', 2);
sun.position.set(3, 5, 2);
scene.add(sun);

renderer.setAnimationLoop((t) => {
  crystal.rotation.y = t / 1000;
  renderer.render(scene, camera);
});
(window as unknown as { __ready: boolean }).__ready = true;
