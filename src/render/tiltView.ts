import * as THREE from 'three';
import { cellAt, isSolved, solveTilt, startTilt, tilt } from '../core/tilt/index.ts';
import type { BallMove, TiltColor, TiltDir, TiltPuzzle, TiltState } from '../core/tilt/index.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';
import { pulse } from './hints.ts';
import { mergeMeshes } from './merge.ts';

export interface TiltPlacement {
  x: number;
  z: number;
  yaw: number;
  /** taille d'une case (m) */
  cell: number;
  /** « table » : un plateau sur un socle ; « plaza » : le Grand Plateau, au fond d'un bassin */
  kind: 'table' | 'plaza';
  /** décalage vertical du plateau (le Grand Plateau est en contrebas) */
  sink?: number;
}

const BALL_COLORS: Record<TiltColor, string> = { R: '#e2473a', G: '#3fbf5a', B: '#3a78e2', Y: '#f2c230' };
/** touche de la pierre de remise à zéro */
export const TILT_RESET = 4;
const DIRS: { dx: number; dz: number }[] = [{ dx: 0, dz: -1 }, { dx: 1, dz: 0 }, { dx: 0, dz: 1 }, { dx: -1, dz: 0 }];

/** Le plateau vu de dessus : sol quadrillé, creux colorés, puits noirs. */
function boardTexture(p: TiltPuzzle): THREE.Texture {
  const px = 64;
  const c = document.createElement('canvas');
  c.width = p.width * px;
  c.height = p.height * px;
  const g = c.getContext('2d')!;
  g.fillStyle = '#e9e1cf';
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < p.height; y++)
    for (let x = 0; x < p.width; x++) {
      const cell = cellAt(p, x, y)!;
      g.fillStyle = (x + y) % 2 ? '#e3d9c4' : '#ece4d2';
      g.fillRect(x * px + 2, y * px + 2, px - 4, px - 4);
      const cx = x * px + px / 2;
      const cy = y * px + px / 2;
      if (cell.kind === 'hole') {
        g.fillStyle = '#2b2620';
        g.beginPath();
        g.arc(cx, cy, px * 0.36, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = BALL_COLORS[cell.color];
        g.lineWidth = 7;
        g.beginPath();
        g.arc(cx, cy, px * 0.36, 0, Math.PI * 2);
        g.stroke();
      } else if (cell.kind === 'pit') {
        const grd = g.createRadialGradient(cx, cy, 2, cx, cy, px * 0.42);
        grd.addColorStop(0, '#000000');
        grd.addColorStop(0.75, '#14101c');
        grd.addColorStop(1, 'rgba(20,16,28,0)');
        g.fillStyle = grd;
        g.beginPath();
        g.arc(cx, cy, px * 0.44, 0, Math.PI * 2);
        g.fill();
      }
    }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Anim {
  t: number;
  dur: number;
  dir: TiltDir;
  moves: BallMove[];
  next: TiltState;
  /** billes déjà arrivées (pour ne jouer leur son qu'une fois) */
  landed: Set<number>;
}

/**
 * Plateau d'inclinaison (Île du Ciel). Quatre flèches de pierre sur les côtés penchent le plateau ;
 * les billes roulent ensemble jusqu'à buter, se logent dans les creux de leur couleur ou tombent
 * dans un puits (on recommence). Une pierre ronde remet le plateau à son départ.
 */
export class TiltView implements PuzzleView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach: number;
  state: number[] = [];
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;
  /** les billes roulent (son) */
  /** le geste part : durée du roulement (s) */
  onRoll: ((dur: number) => void) | null = null;
  /** une bille s'arrête : contre un mur ou une bille, dans son creux, ou dans un puits */
  onLand: ((end: 'stop' | 'home' | 'pit') => void) | null = null;
  /** une bille est tombée dans un puits (son) */
  onFail: (() => void) | null = null;

  private s: TiltState;
  private board = new THREE.Group();
  private detail = new THREE.Group();
  private balls: THREE.Mesh[] = [];
  private ballMats: THREE.MeshStandardMaterial[] = [];
  private handles: { mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial }[] = [];
  private resetMat: THREE.MeshStandardMaterial;
  private frameMat: THREE.MeshStandardMaterial;
  private anim: Anim | null = null;
  private failTimer = 0;
  private hovered: number | null = null;
  private hintK: number | null = null;
  private time = 0;
  private solvedAt = -1;
  private c: number;
  private topY: number;
  /** demi-étendue du plateau (flèches comprises), en largeur et en profondeur */
  private half = { w: 0, d: 0 };

  constructor(readonly puzzle: TiltPuzzle, readonly place: TiltPlacement) {
    const c = (this.c = place.cell);
    const plaza = place.kind === 'plaza';
    this.reach = plaza ? 30 : 3.6;
    this.s = startTilt(puzzle);
    this.state = this.encode();
    const W = puzzle.width * c;
    const D = puzzle.height * c;
    this.half = { w: W / 2 + c * 1.5, d: D / 2 + c * 1.5 };
    this.group.name = `inclinaison ${puzzle.id}`;
    this.group.position.set(place.x, heightAt(place.x, place.z), place.z);
    this.group.rotation.y = place.yaw;
    this.topY = plaza ? 0.35 - (place.sink ?? 0) : 0.95;
    // socle (table) ou dallage (Grand Plateau)
    const stone = stoneMaterial('#d8cfbd');
    if (plaza) {
      const dais = new THREE.Mesh(new THREE.CylinderGeometry(W * 0.78, W * 0.82, 0.3, 24), stone);
      dais.position.y = this.topY - 0.25;
      dais.receiveShadow = true;
      this.group.add(dais);
    } else {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, this.topY - 0.06, 8), stone);
      leg.position.y = (this.topY - 0.06) / 2;
      leg.castShadow = leg.receiveShadow = true;
      this.group.add(leg);
    }
    this.board.position.y = this.topY;
    this.group.add(this.board);
    // cadre et plateau
    this.frameMat = new THREE.MeshStandardMaterial({ color: '#8b6f4e', roughness: 0.6, metalness: 0.2, emissive: '#000000' });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + c * 0.5, c * 0.25, D + c * 0.5), this.frameMat);
    frame.position.y = -c * 0.13;
    frame.castShadow = frame.receiveShadow = true;
    this.board.add(frame);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(W, D), new THREE.MeshStandardMaterial({ map: boardTexture(puzzle), roughness: 0.8 }));
    top.rotation.x = -Math.PI / 2;
    top.position.y = 0.002;
    top.receiveShadow = true;
    this.board.add(top);
    // murs (un seul maillage)
    const walls: THREE.Mesh[] = [];
    const wallGeo = new THREE.BoxGeometry(c * 0.96, c * 0.5, c * 0.96);
    puzzle.cells.forEach((cell, i) => {
      if (cell.kind !== 'wall') return;
      const m = new THREE.Mesh(wallGeo, stone);
      m.position.copy(this.cellPos(i % puzzle.width, Math.floor(i / puzzle.width), c * 0.25));
      walls.push(m);
      this.board.add(m);
    });
    if (walls.length) mergeMeshes(walls, this.board, stone).castShadow = true;
    // billes
    this.board.add(this.detail);
    const ballGeo = new THREE.SphereGeometry(c * 0.36, 18, 12);
    puzzle.balls.forEach((b) => {
      const mat = new THREE.MeshStandardMaterial({ color: BALL_COLORS[b.color], roughness: 0.3, metalness: 0.15, emissive: BALL_COLORS[b.color], emissiveIntensity: 0.12 });
      const m = new THREE.Mesh(ballGeo, mat);
      m.castShadow = true;
      this.detail.add(m);
      this.balls.push(m);
      this.ballMats.push(mat);
    });
    // flèches de pierre : nord (loin), est, sud (vers le joueur), ouest
    const arrow = new THREE.ConeGeometry(c * (plaza ? 0.5 : 0.42), c * (plaza ? 0.9 : 0.7), 3);
    arrow.rotateX(Math.PI / 2); // pointe vers -z... puis on l'oriente
    DIRS.forEach((d, k) => {
      const mat = new THREE.MeshStandardMaterial({ color: '#b9a586', roughness: 0.5, emissive: '#000000' });
      const m = new THREE.Mesh(arrow, mat);
      const out = (k % 2 === 0 ? D : W) / 2 + c * (plaza ? 0.9 : 0.6);
      m.position.set(d.dx * out, c * 0.15, d.dz * out);
      m.rotation.y = Math.atan2(-d.dx, -d.dz) + Math.PI;
      m.castShadow = true;
      this.board.add(m);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(c * 1.4, c * 1.2, c * 1.4), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(m.position);
      pick.userData = { panel: this, k };
      this.board.add(pick);
      this.pickables.push(pick);
      this.handles.push({ mesh: m, mat });
    });
    // pierre de remise à zéro, au coin proche droit
    this.resetMat = new THREE.MeshStandardMaterial({ color: '#7a6a4f', roughness: 0.6, emissive: '#000000' });
    const reset = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.35, c * 0.4, c * 0.3, 10), this.resetMat);
    reset.position.set(W / 2 + c * 0.6, c * 0.1, D / 2 + c * 0.6);
    this.board.add(reset);
    const rp = new THREE.Mesh(new THREE.BoxGeometry(c, c, c), new THREE.MeshBasicMaterial({ visible: false }));
    rp.position.copy(reset.position);
    rp.userData = { panel: this, k: TILT_RESET };
    this.board.add(rp);
    this.pickables.push(rp);
    this.placeBalls(this.s);
    this.setPowered(false);
  }

  get id(): string {
    return this.puzzle.id;
  }

  /** centre d'une case (repère du plateau) ; la rangée 0 est au fond, loin du joueur */
  private cellPos(x: number, y: number, h: number): THREE.Vector3 {
    const { width: w, height: hh } = this.puzzle;
    return new THREE.Vector3((x + 0.5 - w / 2) * this.c, h, (y + 0.5 - hh / 2) * this.c);
  }

  /**
   * Hauteur du centre d'une bille. Logée, elle s'enfonce et affleure le plateau (une perle sertie,
   * aplatie) : une autre bille peut rouler par-dessus et s'y poser sans la traverser.
   */
  private ballY(home: boolean): number {
    return home ? this.c * 0.03 : this.c * 0.36;
  }

  private static readonly FLUSH = 0.16;

  private placeBalls(s: TiltState): void {
    s.balls.forEach((b, i) => {
      const m = this.balls[i]!;
      m.visible = b.x >= 0;
      // posée sur un creux déjà plein : juste au-dessus de la perle sertie
      const onFilled = !b.home && s.balls.some((o) => o.home && o.x === b.x && o.y === b.y);
      if (b.x >= 0) m.position.copy(this.cellPos(b.x, b.y, this.ballY(b.home) + (onFilled ? this.c * 0.07 : 0)));
      if (b.home) m.scale.set(1, TiltView.FLUSH, 1);
      else m.scale.setScalar(1);
      this.ballMats[i]!.emissiveIntensity = b.home ? 0.6 : 0.12;
    });
  }

  private encode(): number[] {
    return this.s.balls.flatMap((b) => [b.x, b.y, b.home ? 1 : 0]);
  }

  setPowered(on: boolean): void {
    this.powered = on;
    for (const h of this.handles) h.mat.color.set(on ? '#d9c7a4' : '#6f6656');
    this.ballMats.forEach((m, i) => m.color.set(on ? BALL_COLORS[this.puzzle.balls[i]!.color] : '#6f6a62'));
  }

  setDetail(visible: boolean): void {
    if (this.detail.visible !== visible) this.detail.visible = visible;
  }

  setHover(k: number | null): void {
    this.hovered = this.powered && !this.solved ? k : null;
  }

  hint(): number | null {
    if (!this.powered || this.solved || this.anim || this.failTimer > 0) return null;
    const r = solveTilt(this.puzzle, this.s);
    this.hintK = r.path && r.path.length ? r.path[0]! : TILT_RESET;
    return this.hintK;
  }

  activeHint(): { k: number; reverse: boolean } | null {
    return this.hintK !== null && this.powered && !this.solved ? { k: this.hintK, reverse: false } : null;
  }

  interact(k: number): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    if (this.anim || this.failTimer > 0) return 'denied';
    this.hintK = null;
    if (k === TILT_RESET) {
      if (this.s.balls.every((b, i) => !b.home && b.x === this.puzzle.balls[i]!.x && b.y === this.puzzle.balls[i]!.y)) return 'denied';
      this.applyState([], true);
      return 'ok';
    }
    if (k < 0 || k > 3) return 'locked';
    const r = tilt(this.puzzle, this.s, k as TiltDir);
    const longest = Math.max(0, ...r.moves.map((m) => m.path.length - 1));
    if (longest === 0) return 'denied'; // rien ne bouge
    this.anim = { t: 0, dur: 0.2 + longest * 0.09, dir: k as TiltDir, moves: r.moves, next: r.state, landed: new Set() };
    this.onRoll?.(this.anim.dur);
    return 'ok';
  }

  /** État = [x, y, logée] par bille ; un état abîmé repart du départ. */
  applyState(st: number[], instant = true): void {
    void instant;
    this.anim = null;
    this.failTimer = 0;
    const n = this.puzzle.balls.length;
    let s = startTilt(this.puzzle);
    if (Array.isArray(st) && st.length === n * 3 && st.every((v) => Number.isInteger(v))) {
      const balls = this.puzzle.balls.map((_, i) => ({ x: st[i * 3]!, y: st[i * 3 + 1]!, home: st[i * 3 + 2] === 1 }));
      const ok = balls.every((b, i) => {
        const cell = cellAt(this.puzzle, b.x, b.y);
        if (!cell || cell.kind === 'wall' || cell.kind === 'pit') return false;
        return !b.home || (cell.kind === 'hole' && cell.color === this.puzzle.balls[i]!.color);
      });
      if (ok) s = { balls, lost: false };
    }
    this.s = s;
    this.state = this.encode();
    this.board.rotation.set(0, 0, 0);
    this.board.position.y = this.topY;
    this.placeBalls(s);
    if (!this.solved && isSolved(s)) {
      this.solved = true;
      this.solvedAt = this.time;
      this.onSolved?.();
    }
  }

  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
  }

  solution(): number[] | null {
    const r = solveTilt(this.puzzle);
    if (!r.path) return null;
    let s = startTilt(this.puzzle);
    for (const d of r.path) s = tilt(this.puzzle, s, d).state;
    return s.balls.flatMap((b) => [b.x, b.y, b.home ? 1 : 0]);
  }

  update(dt: number, time: number): void {
    this.time = time;
    if (this.anim) {
      const a = this.anim;
      a.t = Math.min(a.dur, a.t + dt);
      const k = a.t / a.dur;
      // le plateau penche vers le côté choisi, puis revient ; il se soulève d'autant que son bord
      // descend (sinon, au fond de son bassin, le Grand Plateau s'enfonçait dans le dallage)
      const lean = Math.sin(Math.PI * Math.min(1, k * 1.2)) * (this.place.kind === 'plaza' ? 0.05 : 0.09);
      const d = DIRS[a.dir]!;
      this.board.rotation.set(d.dz * lean, 0, -d.dx * lean);
      this.board.position.y = this.topY + Math.sin(Math.abs(lean)) * (d.dz !== 0 ? this.half.d : this.half.w);
      a.moves.forEach((m, i) => {
        const ball = this.balls[i]!;
        const steps = m.path.length - 1;
        if (steps === 0) return;
        // toutes les billes roulent à la même vitesse
        const u = Math.min(steps, (a.t / (a.dur - 0.15)) * Math.max(...a.moves.map((mm) => mm.path.length - 1)));
        const j = Math.min(steps - 1, Math.floor(u));
        const f = Math.min(1, u - j);
        const p0 = m.path[j]!;
        const p1 = m.path[j + 1]!;
        const done = u >= steps;
        const h = done && m.end === 'home' ? this.ballY(true) : done && m.end === 'pit' ? -this.c * 0.4 : this.ballY(false);
        ball.position.copy(this.cellPos(p0.x + (p1.x - p0.x) * f, p0.y + (p1.y - p0.y) * f, h));
        if (done && !a.landed.has(i)) {
          a.landed.add(i);
          this.onLand?.(m.end);
        }
        if (done && m.end === 'pit') ball.scale.setScalar(0.5);
        if (done && m.end === 'home') ball.scale.set(1, TiltView.FLUSH, 1);
      });
      if (a.t >= a.dur) {
        this.anim = null;
        this.board.rotation.set(0, 0, 0);
        this.board.position.y = this.topY;
        this.s = a.next;
        this.state = this.encode();
        if (this.s.lost) {
          // une bille est tombée : le plateau rougit, puis tout revient au départ
          this.failTimer = 1.1;
          this.onFail?.();
        } else {
          this.placeBalls(this.s);
          if (isSolved(this.s)) {
            this.solved = true;
            this.solvedAt = time;
            this.onSolved?.();
          }
        }
      }
    }
    if (this.failTimer > 0) {
      this.failTimer -= dt;
      this.frameMat.emissive.set(Math.sin(time * 14) > 0 ? '#7a1a12' : '#000000');
      if (this.failTimer <= 0) {
        this.frameMat.emissive.set('#000000');
        this.applyState([], true);
      }
    }
    // survol et aide
    this.handles.forEach((h, k) => {
      if (this.hovered === k) h.mat.emissive.set('#6b5320');
      else if (this.hintK === k && !this.solved) h.mat.emissive.set('#2a8fb0').multiplyScalar(pulse(time));
      else h.mat.emissive.set('#000000');
    });
    if (this.hovered === TILT_RESET) this.resetMat.emissive.set('#6b5320');
    else if (this.hintK === TILT_RESET && !this.solved) this.resetMat.emissive.set('#2a8fb0').multiplyScalar(pulse(time));
    else this.resetMat.emissive.set('#000000');
    if (this.solved) {
      const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
      this.frameMat.emissive.set('#ffc23d').multiplyScalar(0.25 + 0.6 * flash);
    }
  }
}
