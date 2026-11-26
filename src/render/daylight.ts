import * as THREE from 'three';
import { HORIZON, SUN_DIR, ZENITH } from './environment.ts';
import type { Lights } from './environment.ts';

/**
 * L'heure avance avec la progression : chaque zone terminée rapproche le soleil de
 * l'horizon. On part d'un après-midi clair et on finit au crépuscule, quand le phare s'allume.
 * t va de 0 (départ) à 4 (phare rallumé) ; les valeurs intermédiaires sont interpolées.
 */
interface Key {
  /** hauteur du soleil (degrés) */
  elev: number;
  sun: string;
  sunI: number;
  hemiSky: string;
  hemiGround: string;
  hemiI: number;
  zenith: string;
  horizon: string;
  glow: string;
  exposure: number;
}

const KEYS: Key[] = [
  { elev: 30, sun: '#fff0d4', sunI: 2.1, hemiSky: '#cfe8ff', hemiGround: '#b89f74', hemiI: 0.95, zenith: '#5c9fd6', horizon: '#f6d7b0', glow: '#fff2d0', exposure: 0.9 },
  { elev: 22, sun: '#ffe7c2', sunI: 2.0, hemiSky: '#cbe2fb', hemiGround: '#b4996e', hemiI: 0.9, zenith: '#5895d0', horizon: '#f7cfa2', glow: '#ffe8c0', exposure: 0.9 },
  { elev: 13, sun: '#ffd398', sunI: 1.85, hemiSky: '#c4d5f2', hemiGround: '#a88a64', hemiI: 0.8, zenith: '#5181c2', horizon: '#f8bb8a', glow: '#ffd59a', exposure: 0.92 },
  { elev: 5, sun: '#ffac6c', sunI: 1.5, hemiSky: '#b6bfe2', hemiGround: '#8c6e5a', hemiI: 0.68, zenith: '#475fa6', horizon: '#f5956a', glow: '#ffae70', exposure: 0.95 },
  { elev: -3, sun: '#ff9070', sunI: 0.55, hemiSky: '#8f9bd2', hemiGround: '#4e4258', hemiI: 0.5, zenith: '#232c5c', horizon: '#d9786a', glow: '#ff8a66', exposure: 1.05 },
];

const AZIMUTH = new THREE.Vector2(SUN_DIR.x, SUN_DIR.z).normalize();
const c1 = new THREE.Color();
const c2 = new THREE.Color();

function mix(a: string, b: string, t: number, out: THREE.Color): THREE.Color {
  return out.set(a).lerp(c2.set(b), t);
}

export interface DaylightRefs {
  scene: THREE.Scene;
  lights: Lights;
  renderer: THREE.WebGLRenderer;
  /** couleur du halo du soleil dans le ciel (uniforme partagé) */
  sunGlow: THREE.Color;
  stars: THREE.Points;
}

export function applyDaylight(t: number, r: DaylightRefs): void {
  const i = Math.max(0, Math.min(KEYS.length - 2, Math.floor(t)));
  const f = Math.max(0, Math.min(1, t - i));
  const a = KEYS[i]!;
  const b = KEYS[i + 1]!;
  const lerp = (x: number, y: number) => x + (y - x) * f;
  // direction du soleil (le ciel peut le montrer sous l'horizon, la lumière non)
  const elev = THREE.MathUtils.degToRad(lerp(a.elev, b.elev));
  SUN_DIR.set(AZIMUTH.x * Math.cos(elev), Math.sin(elev), AZIMUTH.y * Math.cos(elev));
  const lightElev = Math.max(elev, THREE.MathUtils.degToRad(4));
  r.lights.sunDir.set(AZIMUTH.x * Math.cos(lightElev), Math.sin(lightElev), AZIMUTH.y * Math.cos(lightElev));
  r.lights.sun.color.copy(mix(a.sun, b.sun, f, c1));
  r.lights.sun.intensity = lerp(a.sunI, b.sunI);
  r.lights.hemi.color.copy(mix(a.hemiSky, b.hemiSky, f, c1));
  r.lights.hemi.groundColor.copy(mix(a.hemiGround, b.hemiGround, f, c1));
  r.lights.hemi.intensity = lerp(a.hemiI, b.hemiI);
  ZENITH.copy(mix(a.zenith, b.zenith, f, c1));
  HORIZON.copy(mix(a.horizon, b.horizon, f, c1));
  r.sunGlow.copy(mix(a.glow, b.glow, f, c1));
  (r.scene.fog as THREE.Fog).color.copy(HORIZON);
  if (r.scene.background instanceof THREE.Color) r.scene.background.copy(HORIZON);
  r.renderer.toneMappingExposure = lerp(a.exposure, b.exposure);
  // étoiles au crépuscule
  const m = r.stars.material as THREE.PointsMaterial;
  m.opacity = THREE.MathUtils.smoothstep(t, 3.2, 4) * 0.9;
  r.stars.visible = m.opacity > 0.01;
}

/** Quelques centaines d'étoiles sur la voûte (visibles au crépuscule). */
export function buildStars(): THREE.Points {
  const n = 500;
  const pos = new Float32Array(n * 3);
  let seed = 9;
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  for (let i = 0; i < n; i++) {
    const u = rnd() * Math.PI * 2;
    const v = 0.08 + rnd() * 0.9; // au-dessus de l'horizon
    const r = 850;
    pos[i * 3] = Math.cos(u) * Math.cos(v * Math.PI / 2) * r;
    pos[i * 3 + 1] = Math.sin(v * Math.PI / 2) * r;
    pos[i * 3 + 2] = Math.sin(u) * Math.cos(v * Math.PI / 2) * r;
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(g, new THREE.PointsMaterial({
    color: '#fff6e8', size: 2.2, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false,
  }));
  stars.frustumCulled = false;
  stars.visible = false;
  return stars;
}
