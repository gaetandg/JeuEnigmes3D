import * as THREE from 'three';
import {
  applyFold, checkFold, initialFoldState, legalFolds, solveFold,
} from '../core/fold/index.ts';
import type { Fold, FoldCellDef, FoldPuzzle, FoldState, Mark } from '../core/fold/index.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';

/** Placement d'une feuille : sur un pupitre (panneau) ou à plat sur une estrade (paysage). */
export interface FoldPlacement {
  x: number;
  z: number;
  yaw: number;
  /** taille d'une case (m) */
  cell: number;
  /** pupitre incliné ou estrade */
  kind: 'desk' | 'easel';
}

const PAPER_FRONT = '#fbe9c6';
const PAPER_BACK = '#b9d2ea';
const DOT_COLORS: Record<string, string> = { R: '#e5483b', B: '#3b6fe5', G: '#3bb35a', Y: '#f2b51d' };

// ── textures des faces (mises en cache) ────────────────────────────────────
const texCache = new Map<string, THREE.Texture>();

function faceTexture(face: 'front' | 'back', mark: Mark, hole: boolean): THREE.Texture {
  const key = `${face}|${JSON.stringify(mark)}|${hole}`;
  const hit = texCache.get(key);
  if (hit) return hit;
  const S = 128;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const g = c.getContext('2d')!;
  g.fillStyle = face === 'front' ? PAPER_FRONT : PAPER_BACK;
  g.fillRect(0, 0, S, S);
  // fibres du papier
  g.globalAlpha = 0.08;
  for (let i = 0; i < 40; i++) {
    g.strokeStyle = i % 2 ? '#8a7a5a' : '#ffffff';
    g.beginPath();
    const y = (i * 37) % S;
    g.moveTo(0, y);
    g.lineTo(S, (y + 19) % S);
    g.stroke();
  }
  g.globalAlpha = 1;
  g.strokeStyle = face === 'front' ? '#d9ccb0' : '#aebfcc';
  g.lineWidth = 3;
  g.strokeRect(1.5, 1.5, S - 3, S - 3);
  if (hole) {
    g.globalCompositeOperation = 'destination-out';
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.3, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'source-over';
    g.strokeStyle = '#c9952e';
    g.lineWidth = 9;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.3 + 3, 0, Math.PI * 2);
    g.stroke();
  } else if (mark.kind === 'dot') {
    g.fillStyle = DOT_COLORS[mark.color]!;
    g.beginPath();
    g.arc(S / 2, S / 2, S * 0.22, 0, Math.PI * 2);
    g.fill();
  } else if (mark.kind === 'stain') {
    g.fillStyle = '#1d1a22';
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = S * (0.2 + 0.08 * Math.sin(i * 2.7) + 0.05 * Math.cos(i * 5.1));
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.fill();
    g.beginPath();
    g.arc(S * 0.78, S * 0.3, S * 0.05, 0, Math.PI * 2);
    g.fill();
  } else if (mark.kind === 'star') {
    g.fillStyle = '#f2b51d';
    g.strokeStyle = '#a8740b';
    g.lineWidth = 3;
    g.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
      const r = i % 2 === 0 ? S * 0.3 : S * 0.13;
      const x = S / 2 + Math.cos(a) * r;
      const y = S / 2 + Math.sin(a) * r;
      if (i === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  texCache.set(key, t);
  return t;
}

/** Case de papier : une face avant (groupe 0, vers le haut) et une face arrière (groupe 1). */
function sheetGeometry(size: number, thick: number): THREE.BufferGeometry {
  const h = size / 2;
  const y = thick / 2;
  const pos = [
    // avant (+y)
    -h, y, -h, -h, y, h, h, y, h, h, y, -h,
    // arrière (-y)
    -h, -y, -h, h, -y, -h, h, -y, h, -h, -y, h,
  ];
  const nor = [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0, 0, -1, 0];
  // la face arrière est vue « à l'envers » : on miroite ses coordonnées de texture
  const uv = [0, 1, 0, 0, 1, 0, 1, 1, 1, 1, 0, 1, 0, 0, 1, 0];
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 5, 6, 4, 6, 7]);
  g.addGroup(0, 6, 0);
  g.addGroup(6, 6, 1);
  return g;
}

interface Sheet {
  def: FoldCellDef;
  mesh: THREE.Mesh;
  mats: THREE.MeshStandardMaterial[];
  quat: THREE.Quaternion;
}

interface Anim {
  t: number;
  fold: Fold;
  moving: { s: Sheet; p0: THREE.Vector3; q0: THREE.Quaternion; p1: THREE.Vector3; q1: THREE.Quaternion }[];
  pivot: THREE.Vector3;
  axis: THREE.Vector3;
  sign: number;
}

const RESET_K = 1000;

/**
 * Feuille de papier pliable. Les « pièces » manipulables sont les lignes de pli
 * possibles (k = axe * 100 + position) et une pierre de remise à zéro (k = 1000).
 */
export class FoldView implements PuzzleView {
  readonly group = new THREE.Group();
  readonly board = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach: number;
  state: number[] = [];
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;

  private fs: FoldState;
  private sheets: Sheet[] = [];
  private cell: number;
  private thick: number;
  private lineGroup = new THREE.Group();
  private lineMat = new THREE.MeshBasicMaterial({ color: '#7a6a4f', toneMapped: false });
  private lineHot = new THREE.MeshBasicMaterial({ color: '#ffd36b', toneMapped: false });
  private tokens: THREE.Mesh[] = [];
  private tokenOn = new THREE.MeshStandardMaterial({ color: '#f5ecd6', roughness: 0.8 });
  private tokenOff = new THREE.MeshStandardMaterial({ color: '#5a5046', roughness: 0.9 });
  private resetMesh: THREE.Mesh;
  private resetMat = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.4, metalness: 0.6 });
  private frameGlow = new THREE.MeshBasicMaterial({ color: '#4a4236', toneMapped: false });
  private anim: Anim | null = null;
  private queue: Fold[] = [];
  private hovered: number | null = null;
  private failTimer = 0;
  private bad = new Set<number>();
  private time = 0;
  private solvedAt = -1;

  constructor(readonly puzzle: FoldPuzzle, readonly place: FoldPlacement) {
    this.cell = place.cell;
    this.thick = Math.max(0.006, place.cell * 0.025);
    this.reach = place.kind === 'easel' ? 12 : 3.4;
    this.fs = initialFoldState(puzzle);
    this.group.name = `pliage ${puzzle.id}`;
    this.group.position.set(place.x, heightAt(place.x, place.z), place.z);
    this.group.rotation.y = place.yaw;
    const W = puzzle.width * this.cell;
    const H = puzzle.height * this.cell;

    if (place.kind === 'desk') {
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.0, 0.5), stoneMaterial('#e8dcc6'));
      ped.position.y = 0.45;
      ped.castShadow = ped.receiveShadow = true;
      this.group.add(ped);
      this.board.position.set(0, 1.12, 0);
      this.board.rotation.x = 0.62;
    } else {
      // grand chevalet de bois incliné vers le joueur
      const tilt = 1.05;
      const wood = new THREE.MeshStandardMaterial({ color: '#7a5a40', roughness: 0.9, flatShading: true });
      const topY = 0.9 + H * Math.sin(tilt);
      for (const s of [-1, 1]) {
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.5, topY + 0.8, 0.5), wood);
        post.position.set(s * (W / 2 + 0.6), (topY + 0.8) / 2, -H * Math.cos(tilt) / 2 - 0.4);
        post.castShadow = true;
        this.group.add(post);
      }
      const sill = new THREE.Mesh(new THREE.BoxGeometry(W + 2, 0.9, 1.2), stoneMaterial('#e2d6c2'));
      sill.position.set(0, 0.45, H * Math.cos(tilt) / 2 + 0.2);
      sill.castShadow = sill.receiveShadow = true;
      this.group.add(sill);
      this.board.position.set(0, 0.9 + (H / 2) * Math.sin(tilt), 0);
      this.board.rotation.x = tilt;
    }
    this.group.add(this.board);

    // plateau de bois sombre + cadre
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W + this.cell * 0.3, 0.05, H + this.cell * 0.3),
      new THREE.MeshStandardMaterial({ color: '#a7845c', roughness: 0.85 }),
    );
    base.position.y = -0.026;
    base.receiveShadow = true;
    this.board.add(base);
    const fw = Math.max(0.05, this.cell * 0.08);
    for (const [sx, sz, lx, lz] of [
      [0, -(H / 2 + fw), W + fw * 4, fw],
      [0, H / 2 + fw, W + fw * 4, fw],
      [-(W / 2 + fw), 0, fw, H + fw * 2],
      [W / 2 + fw, 0, fw, H + fw * 2],
    ] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.06, lz), stoneMaterial('#efe7da'));
      f.position.set(sx, 0.0, sz);
      this.board.add(f);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(lx * 0.95, 0.01, lz * 0.35), this.frameGlow);
      gl.position.set(sx, 0.032, sz);
      this.board.add(gl);
    }

    // cases de papier
    const geo = sheetGeometry(this.cell * 0.97, this.thick);
    for (const def of puzzle.cells) {
      // le papier est légèrement lumineux : il reste lisible même à l'ombre
      const front = new THREE.MeshStandardMaterial({
        map: faceTexture('front', def.front, def.hole), roughness: 0.85, alphaTest: 0.5,
        emissive: '#ffffff', emissiveMap: faceTexture('front', def.front, def.hole), emissiveIntensity: 0.22,
      });
      const back = new THREE.MeshStandardMaterial({
        map: faceTexture('back', def.back, def.hole), roughness: 0.85, alphaTest: 0.5,
        emissive: '#ffffff', emissiveMap: faceTexture('back', def.back, def.hole), emissiveIntensity: 0.22,
      });
      const mesh = new THREE.Mesh(geo, [front, back]);
      mesh.castShadow = place.kind === 'easel';
      mesh.receiveShadow = true;
      this.board.add(mesh);
      this.sheets.push({ def, mesh, mats: [front, back], quat: new THREE.Quaternion() });
    }
    this.board.add(this.lineGroup);

    // réserve de plis : encoches sur le bord proche
    for (let i = 0; i < puzzle.maxFolds; i++) {
      const t = new THREE.Mesh(new THREE.BoxGeometry(this.cell * 0.32, 0.03, this.cell * 0.12), this.tokenOn);
      t.position.set(-W / 2 + this.cell * 0.25 + i * this.cell * 0.45, 0.04, H / 2 + fw);
      this.board.add(t);
      this.tokens.push(t);
    }
    // pierre de remise à zéro (coin proche droit)
    this.resetMesh = new THREE.Mesh(new THREE.CylinderGeometry(this.cell * 0.18, this.cell * 0.22, this.cell * 0.12, 16), this.resetMat);
    this.resetMesh.position.set(W / 2 + fw + this.cell * 0.05, 0.06, H / 2 + fw + this.cell * 0.05);
    this.board.add(this.resetMesh);
    const resetPick = new THREE.Mesh(new THREE.BoxGeometry(this.cell * 0.6, this.cell * 0.4, this.cell * 0.6), new THREE.MeshBasicMaterial({ visible: false }));
    resetPick.position.copy(this.resetMesh.position);
    resetPick.userData = { panel: this, k: RESET_K };
    this.board.add(resetPick);
    this.resetPick = resetPick;

    this.layout(true);
    this.setPowered(false);
  }

  private resetPick: THREE.Mesh;

  get id(): string {
    return this.puzzle.id;
  }

  // ── géométrie ─────────────────────────────────────────────────────────
  private cellCenter(x: number, y: number, layer: number): THREE.Vector3 {
    const { width: w, height: h } = this.puzzle;
    return new THREE.Vector3((x + 0.5 - w / 2) * this.cell, (layer + 0.5) * this.thick * 1.15 + 0.002, (y + 0.5 - h / 2) * this.cell);
  }

  /** Place les feuilles selon l'état logique (sans animation). */
  private layout(resetQuats: boolean): void {
    this.fs.poses.forEach((pose, i) => {
      const sh = this.sheets[i]!;
      if (resetQuats) sh.quat.identity();
      sh.mesh.position.copy(this.cellCenter(pose.x, pose.y, pose.layer));
      sh.mesh.quaternion.copy(sh.quat);
    });
    this.rebuildLines();
  }

  /** Lignes de pli cliquables pour l'état courant. */
  private rebuildLines(): void {
    for (const p of this.pickables) if (p !== this.resetPick) this.lineGroup.remove(p);
    this.lineGroup.clear();
    this.pickables.length = 0;
    this.pickables.push(this.resetPick);
    if (!this.powered || this.solved) return;
    const folds = legalFolds(this.fs, this.puzzle.maxFolds);
    const { width: w, height: h } = this.puzzle;
    const b = this.fs.bounds;
    const top = Math.max(...this.fs.poses.map((p) => p.layer)) + 1;
    const y = (top + 0.3) * this.thick * 1.15 + 0.004;
    const seen = new Set<number>();
    for (const f of folds) {
      const k = (f.axis === 'x' ? 0 : 100) + f.at;
      if (seen.has(k)) continue;
      seen.add(k);
      const len = (f.axis === 'x' ? b.y1 - b.y0 : b.x1 - b.x0) * this.cell;
      const th = Math.max(0.012, this.cell * 0.045);
      const line = new THREE.Mesh(
        f.axis === 'x' ? new THREE.BoxGeometry(th, th * 0.5, len) : new THREE.BoxGeometry(len, th * 0.5, th),
        this.hovered === k ? this.lineHot : this.lineMat,
      );
      if (f.axis === 'x') line.position.set((f.at - w / 2) * this.cell, y, ((b.y0 + b.y1) / 2 - h / 2) * this.cell);
      else line.position.set(((b.x0 + b.x1) / 2 - w / 2) * this.cell, y, (f.at - h / 2) * this.cell);
      this.lineGroup.add(line);
      // zone de clic plus large que le trait
      const pick = new THREE.Mesh(
        f.axis === 'x' ? new THREE.BoxGeometry(this.cell * 0.45, this.cell * 0.3, len) : new THREE.BoxGeometry(len, this.cell * 0.3, this.cell * 0.45),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      pick.position.copy(line.position);
      pick.userData = { panel: this, k };
      this.lineGroup.add(pick);
      this.pickables.push(pick);
    }
  }

  // ── interface PuzzleView ──────────────────────────────────────────────
  setPowered(on: boolean): void {
    this.powered = on;
    for (const sh of this.sheets) for (const m of sh.mats) m.color.set(on ? '#ffffff' : '#8a8478');
    this.rebuildLines();
    this.refreshTokens();
  }

  setDetail(visible: boolean): void {
    if (this.board.visible !== visible) this.board.visible = visible;
  }

  setHover(k: number | null): void {
    if (k === this.hovered) return;
    this.hovered = k;
    this.lineGroup.children.forEach((o) => {
      if (o instanceof THREE.Mesh && o.material !== this.lineHot && o.material !== this.lineMat) return;
    });
    this.rebuildLines();
    this.resetMat.emissive.set(k === RESET_K ? '#6b5320' : '#000000');
  }

  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    if (this.anim || this.failTimer > 0) return 'denied';
    if (k === RESET_K) {
      if (this.fs.folds.length === 0) return 'denied';
      this.applyState([], false);
      return 'ok';
    }
    const axis = k >= 100 ? 'y' : 'x';
    const at = k % 100;
    const options = legalFolds(this.fs, this.puzzle.maxFolds).filter((f) => f.axis === axis && f.at === at);
    if (!options.length) return 'denied';
    const f = options.length === 1 ? options[0]! : options.find((o) => o.side === (reverse ? 1 : -1))!;
    this.startFold(f);
    return 'ok';
  }

  /** État = suite de plis encodée [axe, position, côté, …]. */
  applyState(s: number[], instant = true): void {
    this.anim = null;
    this.queue = [];
    this.bad.clear();
    this.failTimer = 0;
    this.fs = initialFoldState(this.puzzle);
    for (const sh of this.sheets) sh.quat.identity();
    for (let i = 0; i + 2 < s.length; i += 3) {
      const f: Fold = { axis: s[i] === 1 ? 'y' : 'x', at: s[i + 1]!, side: s[i + 2]! < 0 ? -1 : 1 };
      if (instant) this.commitFold(f);
      else this.queue.push(f);
    }
    if (instant) this.layout(false);
    else this.layout(true);
    this.state = this.encode();
    this.refreshTokens();
    if (instant) this.evaluate(false);
  }

  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
    this.rebuildLines();
  }

  solution(): number[] | null {
    const r = solveFold(this.puzzle);
    return r.solution ? r.solution.flatMap((f) => [f.axis === 'y' ? 1 : 0, f.at, f.side]) : null;
  }

  // ── plis ──────────────────────────────────────────────────────────────
  private encode(): number[] {
    return this.fs.folds.flatMap((f) => [f.axis === 'y' ? 1 : 0, f.at, f.side]);
  }

  private foldRotation(f: Fold): { axis: THREE.Vector3; sign: number; pivot: THREE.Vector3 } {
    const { width: w, height: h } = this.puzzle;
    if (f.axis === 'x') {
      return { axis: new THREE.Vector3(0, 0, 1), sign: f.side === -1 ? -1 : 1, pivot: new THREE.Vector3((f.at - w / 2) * this.cell, 0, 0) };
    }
    return { axis: new THREE.Vector3(1, 0, 0), sign: f.side === -1 ? 1 : -1, pivot: new THREE.Vector3(0, 0, (f.at - h / 2) * this.cell) };
  }

  /** Applique un pli à l'état logique et aux orientations (sans animation). */
  private commitFold(f: Fold): void {
    const before = this.fs;
    this.fs = applyFold(before, f);
    const { axis, sign } = this.foldRotation(f);
    const rot = new THREE.Quaternion().setFromAxisAngle(axis, sign * Math.PI);
    before.poses.forEach((p, i) => {
      const q = this.fs.poses[i]!;
      if (q !== p) this.sheets[i]!.quat.premultiply(rot);
    });
  }

  private startFold(f: Fold): void {
    const before = this.fs;
    const quatsBefore = this.sheets.map((s) => s.quat.clone());
    this.commitFold(f);
    const { axis, sign, pivot } = this.foldRotation(f);
    const moving: Anim['moving'] = [];
    before.poses.forEach((p, i) => {
      const q = this.fs.poses[i]!;
      if (q === p) return;
      const sh = this.sheets[i]!;
      moving.push({
        s: sh,
        p0: this.cellCenter(p.x, p.y, p.layer),
        q0: quatsBefore[i]!,
        p1: this.cellCenter(q.x, q.y, q.layer),
        q1: sh.quat.clone(),
      });
    });
    this.anim = { t: 0, fold: f, moving, pivot, axis, sign };
    this.lineGroup.clear();
    this.pickables.length = 0;
    this.pickables.push(this.resetPick);
    this.state = this.encode();
    this.refreshTokens();
    this.onFoldSound?.();
  }

  /** son de papier (branché par le jeu) */
  onFoldSound: (() => void) | null = null;
  onFailSound: (() => void) | null = null;

  private refreshTokens(): void {
    const used = this.fs.folds.length;
    this.tokens.forEach((t, i) => (t.material = i < this.puzzle.maxFolds - used ? this.tokenOn : this.tokenOff));
  }

  /** Vérifie la feuille. `feedback` : montrer les erreurs quand la réserve est vide. */
  private evaluate(feedback: boolean): void {
    const chk = checkFold(this.puzzle, this.fs);
    if (chk.solved) {
      if (!this.solved) {
        this.solved = true;
        this.solvedAt = this.time;
        this.rebuildLines();
        this.onSolved?.();
      }
      return;
    }
    if (feedback && this.fs.folds.length >= this.puzzle.maxFolds) {
      this.bad = new Set([...chk.badDots, ...chk.badStains, ...chk.badStars]);
      this.failTimer = 1.6;
      this.onFailSound?.();
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(1, a.t + dt / 0.55);
      const e = a.t < 0.5 ? 2 * a.t * a.t : 1 - Math.pow(-2 * a.t + 2, 2) / 2;
      const ang = a.sign * Math.PI * e;
      const rot = new THREE.Quaternion().setFromAxisAngle(a.axis, ang);
      const lift = Math.sin(Math.PI * e) * this.cell * 0.05;
      for (const m of a.moving) {
        const rel = m.p0.clone().sub(a.pivot);
        rel.y = 0;
        rel.applyQuaternion(rot);
        const p = a.pivot.clone().add(rel);
        // hauteur : arc de rotation + passage progressif à la bonne couche
        p.y += m.p0.y + (m.p1.y - m.p0.y) * e + lift;
        m.s.mesh.position.copy(p);
        m.s.mesh.quaternion.copy(rot).multiply(m.q0);
      }
      if (a.t >= 1) {
        this.anim = null;
        this.layout(false);
        if (this.queue.length) this.startFold(this.queue.shift()!);
        else this.evaluate(true);
      }
    }
    // erreurs : les marques fautives clignotent, puis la feuille se déplie
    if (this.failTimer > 0) {
      this.failTimer -= dt;
      const on = Math.sin(time * 14) > 0;
      this.sheets.forEach((sh, i) => {
        const c = this.bad.has(i) && on ? '#ff9a8a' : '#ffffff';
        for (const m of sh.mats) m.color.set(c);
      });
      if (this.failTimer <= 0) {
        this.sheets.forEach((sh) => sh.mats.forEach((m) => m.color.set('#ffffff')));
        this.applyState([], true);
      }
    }
    if (this.solved) {
      const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
      const t = this.solvedAt < 0 ? 1 : Math.min(1, (time - this.solvedAt) / 0.6);
      this.frameGlow.color.set('#4a4236').lerp(new THREE.Color('#ffc23d').lerp(new THREE.Color('#ffffff'), flash), t);
    }
  }
}
