import * as THREE from 'three';

/** Avec quoi joue-t-on ? (la dernière commande utilisée) */
export type InputMode = 'mouse' | 'touch' | 'pad';

const GOLD = '#ffd36b';
const INK = '#f4efe3';
const SHADE = 'rgba(20, 24, 30, 0.72)';

/**
 * Dessin d'une action, sans un mot : la souris avec le bon bouton allumé, le doigt qui touche
 * (ou qui reste appuyé), ou la manette avec le bon bouton allumé. `reverse` : l'action inverse.
 */
function drawIcon(mode: InputMode, reverse: boolean): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  // un disque sombre derrière, pour se lire sur le papier clair comme sur la pierre
  g.fillStyle = SHADE;
  g.beginPath();
  g.arc(64, 64, 60, 0, Math.PI * 2);
  g.fill();
  g.lineWidth = 6;
  g.strokeStyle = INK;
  g.lineJoin = g.lineCap = 'round';
  if (mode === 'mouse') {
    // le corps de la souris, la séparation des boutons, et le bon bouton en or
    const x0 = 40;
    const x1 = 88;
    const y0 = 24;
    const y1 = 104;
    const mid = 58;
    g.fillStyle = GOLD;
    g.beginPath();
    if (reverse) {
      g.moveTo(64, y0);
      g.arcTo(x1, y0, x1, mid, 22);
      g.lineTo(x1, mid);
      g.lineTo(64, mid);
    } else {
      g.moveTo(64, y0);
      g.arcTo(x0, y0, x0, mid, 22);
      g.lineTo(x0, mid);
      g.lineTo(64, mid);
    }
    g.closePath();
    g.fill();
    g.beginPath();
    g.moveTo(x0 + 22, y0);
    g.arcTo(x1, y0, x1, y1, 22);
    g.arcTo(x1, y1, x0, y1, 22);
    g.arcTo(x0, y1, x0, y0, 22);
    g.arcTo(x0, y0, x1, y0, 22);
    g.closePath();
    g.stroke();
    g.beginPath();
    g.moveTo(x0, mid);
    g.lineTo(x1, mid);
    g.moveTo(64, y0);
    g.lineTo(64, mid);
    g.stroke();
  } else if (mode === 'touch') {
    // le doigt : un point ; toucher = une onde autour ; appui long = un arc qui se remplit
    g.fillStyle = GOLD;
    g.beginPath();
    g.arc(64, 64, 16, 0, Math.PI * 2);
    g.fill();
    if (reverse) {
      g.strokeStyle = GOLD;
      g.lineWidth = 8;
      g.beginPath();
      g.arc(64, 64, 36, -Math.PI / 2, Math.PI);
      g.stroke();
      g.strokeStyle = INK;
      g.lineWidth = 3;
      g.globalAlpha = 0.5;
      g.beginPath();
      g.arc(64, 64, 36, 0, Math.PI * 2);
      g.stroke();
    } else {
      for (const [r, a] of [[30, 0.9], [44, 0.45]] as const) {
        g.globalAlpha = a;
        g.beginPath();
        g.arc(64, 64, r, 0, Math.PI * 2);
        g.stroke();
      }
    }
  } else {
    // la manette : quatre boutons en losange ; celui du bas (agir) ou de droite (l'inverse)
    const spots: [number, number][] = [[64, 34], [34, 64], [94, 64], [64, 94]];
    const lit = reverse ? 2 : 3;
    spots.forEach(([x, y], i) => {
      g.beginPath();
      g.arc(x, y, 14, 0, Math.PI * 2);
      if (i === lit) {
        g.fillStyle = GOLD;
        g.fill();
      } else {
        g.globalAlpha = 0.6;
        g.stroke();
        g.globalAlpha = 1;
      }
    });
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

let mode: InputMode = 'mouse';
const textures = new Map<string, THREE.CanvasTexture>();
const tex = (m: InputMode, reverse: boolean) => {
  const key = `${m}|${reverse}`;
  let t = textures.get(key);
  if (!t) textures.set(key, (t = drawIcon(m, reverse)));
  return t;
};
const mats: Partial<Record<'main' | 'alt', THREE.SpriteMaterial>> = {};

/** Le matériau d'une icône d'action (partagé : il change tout seul avec la commande utilisée). */
export function actionIconMaterial(reverse: boolean): THREE.SpriteMaterial {
  const key = reverse ? 'alt' : 'main';
  return (mats[key] ??= new THREE.SpriteMaterial({ map: tex(mode, reverse), transparent: true, depthTest: false, depthWrite: false, toneMapped: false }));
}

/** La commande utilisée a changé : les icônes suivent. */
export function setInputMode(m: InputMode): void {
  if (m === mode) return;
  mode = m;
  if (mats.main) mats.main.map = tex(m, false);
  if (mats.alt) mats.alt.map = tex(m, true);
}

export function inputMode(): InputMode {
  return mode;
}
