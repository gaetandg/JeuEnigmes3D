import { distToPath, heightAt } from '../world/terrain.ts';
import { CAVE, LIFT, LIGHTHOUSE, SKY, caveEdge, skyEdge } from '../world/layout.ts';

/**
 * La carte du gardien (menu pause) : l'île dessinée à l'encre sur un vieux papier, d'après son
 * vrai relief. Chaque énigme y est une lanterne : allumée (résolue), qui palpite (disponible) ou
 * éteinte (pas encore accessible). L'Île du Ciel et la grotte des Racines n'apparaissent, en
 * médaillon, qu'une fois découvertes. Les éclats trouvés sont des étoiles ; une flèche, c'est nous.
 */
export type MapZone = 'jardin' | 'atelier' | 'cloitre' | 'phare' | 'ciel' | 'racines';
export type MarkState = 'solved' | 'open' | 'locked';

export interface MapMark {
  id: string;
  x: number;
  z: number;
  zone: MapZone;
  state: MarkState;
  /** grande énigme de zone (lanterne plus grosse) */
  big?: boolean;
}

export interface MapData {
  marks: MapMark[];
  /** éclats trouvés */
  shards: { x: number; z: number }[];
  shardsTotal: number;
  notes: number;
  notesTotal: number;
  player: { x: number; y: number; z: number; yaw: number };
  sky: boolean;
  deep: boolean;
}

export const ZONE_NAMES: Record<MapZone, string> = {
  jardin: 'Jardin', atelier: 'Atelier', cloitre: 'Cloître', phare: 'Phare', ciel: 'Ciel', racines: 'Racines',
};

const INK = '#5b4a38';
const PAPER = '#efe3c8';

interface Frame {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

let island: { frame: Frame; image: HTMLCanvasElement } | null = null;

/** Le relief de l'île principale, une fois pour toutes (petite image adoucie à l'agrandissement). */
function islandImage(): { frame: Frame; image: HTMLCanvasElement } {
  if (island) return island;
  // emprise des terres
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9;
  for (let x = -160; x <= 160; x += 4) {
    for (let z = -160; z <= 160; z += 4) {
      if (heightAt(x, z) <= 0) continue;
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      z0 = Math.min(z0, z);
      z1 = Math.max(z1, z);
    }
  }
  const pad = 14;
  const frame = { x0: x0 - pad, x1: x1 + pad, z0: z0 - pad, z1: z1 + pad };
  const step = 1.0;
  const w = Math.ceil((frame.x1 - frame.x0) / step);
  const h = Math.ceil((frame.z1 - frame.z0) / step);
  const hs = new Float32Array(w * h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) hs[j * w + i] = heightAt(frame.x0 + i * step, frame.z0 + j * step);
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d')!;
  const img = g.createImageData(w, h);
  const mix = (a: number[], b: number[], k: number) => a.map((v, i) => v + (b[i]! - v) * k);
  const paper = [239, 227, 200];
  const hill = [214, 196, 158];
  const sea = [205, 214, 204];
  const shallow = [186, 200, 190];
  const path = [201, 178, 138];
  const ink = [91, 74, 56];
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const k = j * w + i;
      const v = hs[k]!;
      let col: number[];
      if (v <= 0) col = v > -2.5 ? shallow : mix(sea, shallow, Math.max(0, 1 + v / 12) * 0.4);
      else {
        // rivage : un trait d'encre là où la terre touche l'eau
        const coast = [k - 1, k + 1, k - w, k + w].some((n) => n >= 0 && n < hs.length && hs[n]! <= 0);
        if (coast) col = ink;
        else {
          col = mix(paper, hill, Math.min(1, v / 26));
          if (distToPath(frame.x0 + i * step, frame.z0 + j * step) < 1.4) col = path;
          // courbes de niveau, discrètes
          if (Math.floor(v / 6) !== Math.floor((hs[k + 1] ?? v) / 6)) col = mix(col, ink, 0.25);
        }
      }
      img.data.set([col[0]!, col[1]!, col[2]!, 255], k * 4);
    }
  }
  g.putImageData(img, 0, 0);
  island = { frame, image: c };
  return island;
}

/** Prépare le relief de la carte à l'avance (≈ 0,4 s de calcul), quand le jeu ne fait rien. */
export function prepareMap(): void {
  const idle = (window as unknown as { requestIdleCallback?: (f: () => void, o?: { timeout: number }) => void }).requestIdleCallback;
  if (idle) idle(() => islandImage(), { timeout: 8000 });
  else window.setTimeout(() => islandImage(), 4000);
}

/** Une lanterne : allumée, à faire (elle palpite) ou éteinte. */
function lantern(g: CanvasRenderingContext2D, x: number, y: number, state: MarkState, big: boolean, t: number, s: number): void {
  const r = (big ? 6.5 : 4.2) * s;
  g.save();
  if (state === 'solved') {
    g.shadowColor = '#ffc860';
    g.shadowBlur = 8 * s;
    g.fillStyle = '#eaa83a';
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.strokeStyle = INK;
    g.lineWidth = 1 * s;
    g.stroke();
  } else if (state === 'open') {
    const p = 0.5 + 0.5 * Math.sin(t * 3.2);
    g.strokeStyle = `rgba(214, 92, 40, ${0.55 + 0.45 * p})`;
    g.lineWidth = 2 * s;
    g.beginPath();
    g.arc(x, y, r + p * 2.2 * s, 0, Math.PI * 2);
    g.stroke();
    g.fillStyle = '#fff7e6';
    g.beginPath();
    g.arc(x, y, r * 0.55, 0, Math.PI * 2);
    g.fill();
  } else {
    g.fillStyle = 'rgba(120, 106, 88, 0.55)';
    g.beginPath();
    g.arc(x, y, r * 0.5, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

function star(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.fillStyle = '#a77fd6';
  g.strokeStyle = INK;
  g.lineWidth = 0.8;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.38 : r;
    g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  g.closePath();
  g.fill();
  g.stroke();
  g.restore();
}

/** Nous : une flèche dans la direction du regard. */
function arrow(g: CanvasRenderingContext2D, x: number, y: number, yaw: number, s: number): void {
  const fx = -Math.sin(yaw);
  const fz = -Math.cos(yaw);
  g.save();
  g.translate(x, y);
  g.rotate(Math.atan2(fz, fx));
  g.fillStyle = '#2b6c93';
  g.strokeStyle = '#fff';
  g.lineWidth = 1.2 * s;
  g.beginPath();
  g.moveTo(8 * s, 0);
  g.lineTo(-5 * s, 5 * s);
  g.lineTo(-2 * s, 0);
  g.lineTo(-5 * s, -5 * s);
  g.closePath();
  g.stroke();
  g.fill();
  g.restore();
}

function compass(g: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  g.save();
  g.strokeStyle = INK;
  g.fillStyle = INK;
  g.lineWidth = 1;
  g.globalAlpha = 0.75;
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2 - Math.PI / 2;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * r, y + Math.sin(a) * r);
    g.lineTo(x + Math.cos(a + Math.PI / 4) * r * 0.22, y + Math.sin(a + Math.PI / 4) * r * 0.22);
    g.lineTo(x, y);
    g.closePath();
    if (i === 0) g.fill();
    else g.stroke();
  }
  g.font = `italic ${Math.round(r * 0.55)}px Georgia, serif`;
  g.textAlign = 'center';
  g.fillText('N', x, y - r * 1.15);
  g.restore();
}

/** Médaillon (île du ciel, grotte) : un cercle de papier, la forme du lieu, ses lanternes. */
function medallion(g: CanvasRenderingContext2D, cx: number, cy: number, R: number, edge: (a: number) => number, maxR: number, dark: boolean): (x: number, z: number) => [number, number] {
  g.save();
  g.fillStyle = dark ? '#d9c8a6' : '#f6efdf';
  g.strokeStyle = INK;
  g.lineWidth = 1.2;
  g.beginPath();
  g.arc(cx, cy, R, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  const k = (R * 0.86) / maxR;
  g.fillStyle = dark ? '#b49d7c' : PAPER;
  g.beginPath();
  for (let i = 0; i <= 72; i++) {
    const a = (i / 72) * Math.PI * 2;
    const r = edge(a) * k;
    g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
  }
  g.closePath();
  g.fill();
  g.lineWidth = 1.4;
  g.stroke();
  g.restore();
  return (x: number, z: number) => [cx + x * k, cy + z * k];
}

/** Dessine la carte. `t` : temps (s), pour faire palpiter les lanternes à faire. */
export function drawMap(canvas: HTMLCanvasElement, data: MapData, t: number): void {
  const { frame, image } = islandImage();
  const cssW = canvas.clientWidth || 380;
  const aspect = (frame.z1 - frame.z0) / (frame.x1 - frame.x0);
  const cssH = Math.round(cssW * aspect);
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (canvas.width !== Math.round(cssW * dpr)) {
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    canvas.style.height = `${cssH}px`;
  }
  const g = canvas.getContext('2d')!;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.imageSmoothingEnabled = true;
  g.drawImage(image, 0, 0, cssW, cssH);
  // bord du papier
  g.strokeStyle = INK;
  g.lineWidth = 1.5;
  g.strokeRect(1, 1, cssW - 2, cssH - 2);
  const s = cssW / 380;
  const main = (x: number, z: number): [number, number] => [((x - frame.x0) / (frame.x1 - frame.x0)) * cssW, ((z - frame.z0) / (frame.z1 - frame.z0)) * cssH];

  // le phare
  const [lx, ly] = main(LIGHTHOUSE.x, LIGHTHOUSE.z);
  g.save();
  g.fillStyle = INK;
  g.beginPath();
  g.moveTo(lx - 3 * s, ly + 5 * s);
  g.lineTo(lx + 3 * s, ly + 5 * s);
  g.lineTo(lx + 1.6 * s, ly - 6 * s);
  g.lineTo(lx - 1.6 * s, ly - 6 * s);
  g.closePath();
  g.fill();
  g.restore();
  compass(g, cssW - 28 * s, cssH - 30 * s, 13 * s);

  // médaillons des lieux découverts, reliés à l'île par un pointillé
  const R = 50 * s;
  let skyAt: ((x: number, z: number) => [number, number]) | null = null;
  let caveAt: ((x: number, z: number) => [number, number]) | null = null;
  const dashed = (ax: number, ay: number, bx: number, by: number) => {
    g.save();
    g.setLineDash([3 * s, 4 * s]);
    g.strokeStyle = INK;
    g.globalAlpha = 0.6;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(ax, ay);
    g.lineTo(bx, by);
    g.stroke();
    g.restore();
  };
  if (data.sky) {
    const cx = cssW - R - 8 * s;
    const cy = R + 8 * s;
    const [ax, ay] = main(LIFT.x, LIFT.z);
    dashed(ax, ay, cx - R * 0.7, cy + R * 0.7);
    const at = medallion(g, cx, cy, R, skyEdge, SKY.r + 6, false);
    skyAt = (x, z) => at(x - SKY.x, z - SKY.z);
  }
  if (data.deep) {
    const cx = R + 8 * s;
    const cy = cssH - R - 8 * s;
    dashed(lx, ly, cx + R * 0.7, cy - R * 0.7);
    const at = medallion(g, cx, cy, R, caveEdge, CAVE.r + 6, true);
    caveAt = (x, z) => at(x - CAVE.x, z - CAVE.z);
  }
  const where = (zone: MapZone | null, x: number, z: number): [number, number] | null => {
    if (zone === 'ciel') return skyAt ? skyAt(x, z) : null;
    if (zone === 'racines') return caveAt ? caveAt(x, z) : null;
    return main(x, z);
  };

  // les lanternes : d'abord les éteintes, puis les autres par-dessus
  const order: MarkState[] = ['locked', 'solved', 'open'];
  for (const st of order) {
    for (const m of data.marks) {
      if (m.state !== st) continue;
      const p = where(m.zone, m.x, m.z);
      if (p) lantern(g, p[0], p[1], m.state, !!m.big, t, s * (m.zone === 'ciel' || m.zone === 'racines' ? 0.8 : 1));
    }
  }
  for (const sh of data.shards) {
    const p = main(sh.x, sh.z);
    star(g, p[0], p[1], 5 * s);
  }
  // nous
  const pl = data.player;
  const zone: MapZone | null = Math.hypot(pl.x - SKY.x, pl.z - SKY.z) < SKY.r + 15 ? 'ciel' : Math.hypot(pl.x - CAVE.x, pl.z - CAVE.z) < CAVE.r + 15 ? 'racines' : null;
  const pp = where(zone, pl.x, pl.z);
  if (pp) arrow(g, pp[0], pp[1], pl.yaw, s);
}
