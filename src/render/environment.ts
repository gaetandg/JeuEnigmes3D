import * as THREE from 'three';

export const SUN_DIR = new THREE.Vector3(-0.62, 0.5, 0.6).normalize();
export const HORIZON = new THREE.Color('#f6d7b0');
export const ZENITH = new THREE.Color('#5c9fd6');

/** Ciel en dégradé avec un soleil diffus. */
export function buildSky(): THREE.Mesh {
  const geo = new THREE.SphereGeometry(900, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uZenith: { value: ZENITH },
      uHorizon: { value: HORIZON },
      uGround: { value: new THREE.Color('#8fc7cf') },
      uSunDir: { value: SUN_DIR },
      uSunColor: { value: new THREE.Color('#fff2d0') },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        gl_Position = p.xyww;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uZenith, uHorizon, uGround, uSunDir, uSunColor;
      varying vec3 vDir;
      void main() {
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = h > 0.0
          ? mix(uHorizon, uZenith, pow(smoothstep(0.0, 0.65, h), 0.8))
          : mix(uHorizon, uGround, smoothstep(0.0, -0.2, h));
        float s = max(dot(d, uSunDir), 0.0);
        col += uSunColor * (pow(s, 900.0) * 1.2 + pow(s, 12.0) * 0.18);
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }
    `,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.name = 'ciel';
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  return sky;
}

/** Mer low-poly animée. */
export function buildWater(): { mesh: THREE.Mesh; update: (t: number) => void } {
  const geo = new THREE.PlaneGeometry(1400, 1400, 140, 140).toNonIndexed();
  geo.rotateX(-Math.PI / 2);
  const uniforms = { uTime: { value: 0 } };
  const mat = new THREE.MeshStandardMaterial({
    color: '#3db5c2',
    roughness: 0.55,
    metalness: 0.0,
    transparent: true,
    opacity: 0.9,
    flatShading: true,
  });
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = uniforms.uTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace(
        '#include <begin_vertex>',
        `#include <begin_vertex>
         vec4 wp = modelMatrix * vec4(position, 1.0);
         transformed.y += sin(wp.x * 0.11 + uTime * 0.9) * 0.18 + cos(wp.z * 0.13 + uTime * 0.7) * 0.18;`,
      );
  };
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0;
  mesh.receiveShadow = false;
  mesh.name = 'mer';
  return { mesh, update: (t) => (uniforms.uTime.value = t) };
}

export interface Lights {
  sun: THREE.DirectionalLight;
  hemi: THREE.HemisphereLight;
  /** Fait suivre la zone d'ombre au joueur. */
  follow: (target: THREE.Vector3) => void;
}

export function buildLights(scene: THREE.Scene): Lights {
  const hemi = new THREE.HemisphereLight('#cfe8ff', '#b89f74', 0.95);
  scene.add(hemi);
  const sun = new THREE.DirectionalLight('#fff0d4', 2.1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const cam = sun.shadow.camera;
  cam.left = -40;
  cam.right = 40;
  cam.top = 40;
  cam.bottom = -40;
  cam.near = 1;
  cam.far = 200;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.04;
  scene.add(sun);
  scene.add(sun.target);
  const follow = (t: THREE.Vector3) => {
    // aligner sur une grille pour éviter le scintillement des ombres
    const snap = 2;
    const x = Math.round(t.x / snap) * snap;
    const z = Math.round(t.z / snap) * snap;
    sun.target.position.set(x, t.y, z);
    sun.position.set(x + SUN_DIR.x * 100, t.y + SUN_DIR.y * 100, z + SUN_DIR.z * 100);
  };
  return { sun, hemi, follow };
}
