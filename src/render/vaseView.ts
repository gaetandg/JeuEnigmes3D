import * as THREE from 'three';
import { isSolved, pour, solveVases } from '../core/vases/index.ts';
import type { VasePuzzle } from '../core/vases/index.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';
import { pulse } from './hints.ts';
import { ringAround } from './goalRings.ts';

export interface VasePlacement {
  x: number;
  z: number;
  yaw: number;
  /** hauteur d'une graduation (m) */
  unit: number;
  /** « station » : une table de tubes ; « grand » : la Grande Écluse, au centre de la Bulle */
  kind: 'station' | 'grand';
}

interface Tube {
  water: THREE.Mesh;
  ring: THREE.Mesh | null;
  ringMat: THREE.MeshStandardMaterial | null;
  level: number;
  shown: number;
}

interface Pipe {
  wheel: THREE.Group;
  mat: THREE.MeshStandardMaterial;
  glow: number;
  /** les deux bouts du tuyau (au-dessus de chaque tube) */
  ends: [THREE.Vector3, THREE.Vector3];
}

const WATER = new THREE.Color('#3fa9f5');

/**
 * Les Vases : des tubes de verre, de l'eau, des anneaux d'or ; entre les tubes, des tuyaux à
 * vanne. Un clic sur une vanne verse dans le sens de la flèche (clic droit : dans l'autre sens,
 * sauf tuyau à sens unique), jusqu'à ce que la source soit vide ou la cible pleine. La pierre
 * ronde, devant, remet tout comme au départ.
 */
export class VaseView implements PuzzleView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach: number;
  state: number[];
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;
  /** l'eau coule (quantité versée) */
  onPour: ((amount: number) => void) | null = null;

  private tubes: Tube[] = [];
  /** le filet d'eau qui tombe du tuyau dans le tube qu'on remplit */
  private stream: THREE.Mesh;
  private streamTo = -1;
  private streamT = 0;
  private streamTop = new THREE.Vector3();
  private pipes: Pipe[] = [];
  private resetMat = new THREE.MeshStandardMaterial({ color: '#7a8a96', roughness: 0.6, emissive: '#000000' });
  private frameMat = new THREE.MeshStandardMaterial({ color: '#8fa3b0', roughness: 0.5, metalness: 0.3, emissive: '#000000' });
  private waterMat = new THREE.MeshStandardMaterial({ color: WATER, roughness: 0.15, metalness: 0.1, emissive: '#1b6fb0', emissiveIntensity: 0.55, transparent: true, opacity: 0.85 });
  private hovered: number | null = null;
  private hintK: number | null = null;
  private hintRev = false;
  private time = 0;
  private solvedAt = -1;
  private readonly unit: number;

  constructor(readonly puzzle: VasePuzzle, readonly place: VasePlacement) {
    const u = (this.unit = place.unit);
    const grand = place.kind === 'grand';
    this.reach = grand ? 26 : 4.5;
    this.state = puzzle.start.slice();
    this.group.name = `vases ${puzzle.id}`;
    this.group.position.set(place.x, heightAt(place.x, place.z), place.z);
    this.group.rotation.y = place.yaw;
    const n = puzzle.caps.length;
    const r = u * (grand ? 1.5 : 1.7);
    const gap = r * 2 + u * (grand ? 2.2 : 2.6);
    const xs = puzzle.caps.map((_, i) => (i - (n - 1) / 2) * gap);
    const baseH = grand ? 0.5 : 0.75;
    const maxCap = Math.max(...puzzle.caps);
    // le socle
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(gap * n + r, baseH, r * 2 + u * 3), stoneMaterial('#c9d3d8'));
    plinth.position.y = baseH / 2;
    plinth.castShadow = plinth.receiveShadow = true;
    this.group.add(plinth);
    const glass = new THREE.MeshStandardMaterial({ color: '#dff3ff', roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide });
    const tickMat = new THREE.MeshBasicMaterial({ color: '#2d4a5c' });
    const tickGeo = new THREE.BoxGeometry(r * 0.5, u * 0.06, u * 0.06);
    puzzle.caps.forEach((cap, i) => {
      const h = cap * u;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true), glass);
      tube.position.set(xs[i]!, baseH + h / 2, 0);
      tube.renderOrder = 2;
      this.group.add(tube);
      // fond et rebord
      const rim = new THREE.Mesh(new THREE.TorusGeometry(r, u * 0.08, 6, 20), this.frameMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(xs[i]!, baseH + h, 0);
      this.group.add(rim);
      // graduations (une par unité), sur la face avant
      for (let k = 1; k < cap; k++) {
        const t = new THREE.Mesh(tickGeo, tickMat);
        t.position.set(xs[i]! - r * 0.55, baseH + k * u, r * 0.86);
        this.group.add(t);
      }
      // l'eau : un cylindre dont on règle la hauteur
      const water = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.9, r * 0.9, 1, 20), this.waterMat);
      water.position.set(xs[i]!, baseH, 0);
      this.group.add(water);
      // l'anneau d'or : là où l'eau doit arriver
      const target = puzzle.targets[i];
      let ring: THREE.Mesh | null = null;
      let ringMat: THREE.MeshStandardMaterial | null = null;
      if (target !== null && target !== undefined) {
        ringMat = new THREE.MeshStandardMaterial({ color: '#e7b546', roughness: 0.3, metalness: 0.7, emissive: '#7a5410', emissiveIntensity: 0.6 });
        ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.12, u * 0.12, 8, 24), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(xs[i]!, baseH + target * u, 0);
        this.group.add(ring);
      }
      const lv = this.state[i]!;
      this.tubes.push({ water, ring, ringMat, level: lv, shown: lv });
    });
    // les tuyaux : un arc par tuyau, au-dessus des tubes, et sa vanne au sommet
    const pipeMat = new THREE.MeshStandardMaterial({ color: '#8fa3b0', roughness: 0.4, metalness: 0.5 });
    puzzle.pipes.forEach((p, k) => {
      const ya = baseH + puzzle.caps[p.a]! * u;
      const yb = baseH + puzzle.caps[p.b]! * u;
      const top = baseH + maxCap * u + u * (2 + k * 1.3);
      const za = -r * 0.2 - k * u * 0.5;
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(xs[p.a]!, ya, za),
        new THREE.Vector3(xs[p.a]!, top, za),
        new THREE.Vector3((xs[p.a]! + xs[p.b]!) / 2, top + u * 0.6, za),
        new THREE.Vector3(xs[p.b]!, top, za),
        new THREE.Vector3(xs[p.b]!, yb, za),
      ]);
      const pipe = new THREE.Mesh(new THREE.TubeGeometry(curve, 48, u * 0.16, 8), pipeMat);
      pipe.castShadow = true;
      this.group.add(pipe);
      // la vanne : une roue au sommet du tuyau, qu'on vise et qu'on tourne
      const wheel = new THREE.Group();
      const mid = curve.getPoint(0.5);
      wheel.position.copy(mid).add(new THREE.Vector3(0, 0, u * 0.35));
      const mat = new THREE.MeshStandardMaterial({ color: '#c98a3a', roughness: 0.4, metalness: 0.6, emissive: '#000000' });
      const ring = new THREE.Mesh(new THREE.TorusGeometry(u * 0.55, u * 0.1, 6, 16), mat);
      wheel.add(ring);
      for (let s = 0; s < 3; s++) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(u * 1.05, u * 0.09, u * 0.09), mat);
        spoke.rotation.z = (s * Math.PI) / 3;
        wheel.add(spoke);
      }
      // sens : une flèche sur le tuyau (deux pour un tuyau à double sens)
      const arrowGeo = new THREE.ConeGeometry(u * 0.28, u * 0.6, 8);
      const dir = Math.sign(xs[p.b]! - xs[p.a]!) || 1;
      for (const side of p.oneWay ? [1] : [1, -1]) {
        const ar = new THREE.Mesh(arrowGeo, p.oneWay ? new THREE.MeshStandardMaterial({ color: '#e7b546', metalness: 0.6, roughness: 0.3 }) : pipeMat);
        ar.rotation.z = -(dir * side * Math.PI) / 2;
        ar.position.copy(mid).add(new THREE.Vector3(dir * side * u * 1.4, u * 0.25, 0));
        this.group.add(ar);
      }
      const pick = new THREE.Mesh(new THREE.SphereGeometry(u * (grand ? 1.6 : 1.4), 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(wheel.position);
      pick.userData = { panel: this, k, aim: new THREE.Vector3() };
      this.group.add(pick);
      this.pickables.push(pick);
      this.group.add(wheel);
      this.pipes.push({ wheel, mat, glow: 0, ends: [new THREE.Vector3(xs[p.a]!, ya, za), new THREE.Vector3(xs[p.b]!, yb, za)] });
    });
    this.stream = new THREE.Mesh(new THREE.CylinderGeometry(u * 0.1, u * 0.14, 1, 8, 1, true), new THREE.MeshBasicMaterial({ color: '#9fe0ff', transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false }));
    this.stream.visible = false;
    this.group.add(this.stream);
    // la pierre de remise à zéro, devant le socle
    const reset = new THREE.Mesh(new THREE.CylinderGeometry(u * 1.2, u * 1.4, u * 0.9, 12), this.resetMat);
    reset.position.set(xs[n - 1]! + gap * 0.55, baseH + u * 0.45, r + u * 1.2);
    reset.userData = { panel: this, k: puzzle.pipes.length };
    this.group.add(reset);
    this.pickables.push(reset);
    this.refresh(true);
    this.setPowered(false);
  }

  get id(): string {
    return this.puzzle.id;
  }

  setPowered(on: boolean): void {
    this.powered = on;
    this.waterMat.emissiveIntensity = on ? 0.55 : 0.12;
  }

  setDetail(visible: boolean): void {
    void visible;
  }

  setHover(k: number | null): void {
    this.hovered = this.powered && !this.solved ? k : null;
  }

  /** Place l'eau (instant : sans animation) et allume les anneaux atteints. */
  private refresh(instant: boolean): void {
    this.tubes.forEach((t, i) => {
      t.level = this.state[i]!;
      if (instant) t.shown = t.level;
    });
  }

  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    this.hintK = null;
    if (k === this.puzzle.pipes.length) {
      if (this.state.every((v, i) => v === this.puzzle.start[i])) return 'denied';
      this.state = this.puzzle.start.slice();
      this.refresh(false);
      return 'ok';
    }
    const next = pour(this.puzzle, this.state, { pipe: k, reverse });
    if (!next) return 'denied';
    const amount = Math.abs(next[this.puzzle.pipes[k]!.a]! - this.state[this.puzzle.pipes[k]!.a]!);
    this.state = next;
    this.pipes[k]!.glow = 1;
    const pipe = this.puzzle.pipes[k]!;
    this.streamTo = reverse ? pipe.a : pipe.b;
    this.streamTop.copy(this.pipes[k]!.ends[reverse ? 0 : 1]);
    this.streamT = 0.9;
    this.onPour?.(amount);
    this.refresh(false);
    if (isSolved(this.puzzle, this.state)) {
      this.solved = true;
      this.solvedAt = this.time;
      this.onSolved?.();
    }
    return 'ok';
  }

  hint(): number | null {
    if (!this.powered || this.solved) return null;
    const r = solveVases(this.puzzle, this.state);
    if (r.path && r.path.length) {
      this.hintK = r.path[0]!.pipe;
      this.hintRev = r.path[0]!.reverse;
    } else {
      // impasse (un tuyau à sens unique a tout emporté) : la pierre de remise à zéro
      this.hintK = this.puzzle.pipes.length;
      this.hintRev = false;
    }
    return this.hintK;
  }

  activeHint(): { k: number; reverse: boolean } | null {
    return this.hintK !== null && this.powered && !this.solved ? { k: this.hintK, reverse: this.hintRev } : null;
  }

  goalPoints(): { pos: THREE.Vector3; r: number }[] {
    return this.tubes
      .filter((t, i) => t.ring && this.state[i] !== this.puzzle.targets[i])
      .map((t) => ringAround(t.ring!, 1.3));
  }

  /** État = eau de chaque tube ; un état abîmé (ou qui ne garde pas la même eau) repart du départ. */
  applyState(s: number[], instant = true): void {
    const total = this.puzzle.start.reduce((a, b) => a + b, 0);
    const ok = Array.isArray(s) && s.length === this.puzzle.caps.length && s.every((v, i) => Number.isInteger(v) && v >= 0 && v <= this.puzzle.caps[i]!) && s.reduce((a, b) => a + b, 0) === total;
    this.state = (ok ? s : this.puzzle.start).slice();
    this.refresh(instant);
    if (!this.solved && this.powered && isSolved(this.puzzle, this.state)) {
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
    const r = solveVases(this.puzzle, this.puzzle.start);
    if (!r.path) return null;
    let s = this.puzzle.start.slice();
    for (const m of r.path) s = pour(this.puzzle, s, m)!;
    return s;
  }

  update(dt: number, time: number): void {
    this.time = time;
    const u = this.unit;
    const baseH = this.place.kind === 'grand' ? 0.5 : 0.75;
    this.tubes.forEach((t, i) => {
      if (t.shown !== t.level) {
        const d = t.level - t.shown;
        t.shown += Math.sign(d) * Math.min(Math.abs(d), dt * 9);
      }
      const h = Math.max(0.001, t.shown * u);
      t.water.scale.y = h;
      t.water.position.y = baseH + h / 2;
      t.water.visible = t.shown > 0.01;
      if (t.ringMat) {
        const on = this.state[i] === this.puzzle.targets[i];
        const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
        t.ringMat.emissive.set(on ? '#ffcf5a' : '#7a5410');
        t.ringMat.emissiveIntensity = on ? 1.1 + flash : 0.6;
      }
    });
    // le filet d'eau : du bout du tuyau jusqu'à la surface de l'eau du tube qu'on remplit
    this.streamT = Math.max(0, this.streamT - dt);
    this.stream.visible = this.streamT > 0 && this.streamTo >= 0;
    if (this.stream.visible) {
      const t = this.tubes[this.streamTo]!;
      const bottom = baseH + t.shown * u;
      const h = Math.max(0.01, this.streamTop.y - bottom);
      this.stream.position.set(this.streamTop.x, bottom + h / 2, this.streamTop.z);
      this.stream.scale.set(1, h, 1);
      (this.stream.material as THREE.MeshBasicMaterial).opacity = 0.8 * Math.min(1, this.streamT / 0.25);
    }
    this.pipes.forEach((p, k) => {
      p.glow = Math.max(0, p.glow - dt * 1.5);
      p.wheel.rotation.z += dt * p.glow * 6;
      if (this.hovered === k) p.mat.emissive.set('#5a4620');
      else if (this.hintK === k && !this.solved) p.mat.emissive.set('#2a8fb0').multiplyScalar(0.7 * pulse(time));
      else p.mat.emissive.set('#1b6fb0').multiplyScalar(p.glow * 0.8);
    });
    if (this.hovered === this.puzzle.pipes.length) this.resetMat.emissive.set('#5a4620');
    else if (this.hintK === this.puzzle.pipes.length && !this.solved) this.resetMat.emissive.set('#2a8fb0').multiplyScalar(0.7 * pulse(time));
    else this.resetMat.emissive.set('#000000');
    if (this.solved) this.frameMat.emissive.set('#ffc23d').multiplyScalar(0.25);
  }
}
