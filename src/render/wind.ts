import type * as THREE from 'three';

/** Horloge partagée du vent (mise à jour par le jeu). */
export const WIND = { uWindTime: { value: 0 } };

/**
 * Fait onduler un matériau au vent : les sommets se balancent d'autant plus qu'ils sont
 * hauts dans leur forme. Fonctionne avec les maillages instanciés (arbres, herbes).
 * `amp` : amplitude (m) ; `base` : décalage de hauteur locale à partir duquel ça bouge.
 */
export function addWind(mat: THREE.Material, amp: number, base: number): void {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = WIND.uWindTime;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uWindTime;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 mvPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
        #endif
        float windH = max(0.0, transformed.y + ${base.toFixed(2)});
        float windPh = mvPosition.x * 0.21 + mvPosition.z * 0.17;
        float gust = 0.6 + 0.4 * sin(uWindTime * 0.23 + windPh * 0.1);
        mvPosition.x += sin(uWindTime * 1.3 + windPh) * ${amp.toFixed(3)} * windH * gust;
        mvPosition.z += cos(uWindTime * 1.05 + windPh * 1.3) * ${(amp * 0.6).toFixed(3)} * windH * gust;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      );
  };
  mat.customProgramCacheKey = () => `wind-${amp}-${base}`;
}
