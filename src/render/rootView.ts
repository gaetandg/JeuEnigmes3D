import * as THREE from 'three';
import { checkRoots, isHole, rotateMask, solveRoots } from '../core/roots/index.ts';
import type { RootPuzzle } from '../core/roots/index.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';
import { pulse } from './hints.ts';
import { ringAround } from './goalRings.ts';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export interface RootPlacement {
  x: number;
  z: number;
  yaw: number;
  /** taille d'une tuile (m) */
  cell: number;
  /** « lectern » : un pupitre incliné ; « pit » : la Racine-mère, au fond de sa fosse */
  kind: 'lectern' | 'pit';
  sink?: number;
}

const TILT = 0.62;
const DIRS = [{ x: 0, z: -1 }, { x: 1, z: 0 }, { x: 0, z: 1 }, { x: -1, z: 0 }];

interface Tile {
  group: THREE.Group;
  base: THREE.MeshStandardMaterial;
  segs: THREE.Mesh[];
  /** le cristal (montre toujours la couleur qu'il attend ; brille quand il la reçoit) */
  crystal: THREE.Mesh | null;
  caps: THREE.Mesh[];
  target: number;
  current: number;
}

/**
 * Pupitre des Racines : chaque tuile porte ses segments de racine ; un clic la tourne d'un quart
 * de tour (clic droit : dans l'autre sens). Les racines reliées à la graine s'allument en or ;
 * une racine éclairée qui s'ouvre dans le vide montre un point rouge à son bout.
 */
export class RootView implements PuzzleView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach: number;
  state: number[];
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;
  onTurn: (() => void) | null = null;
  /** un cristal de plus reçoit la lumière (n : combien sont allumés) */
  onCrystal: ((n: number) => void) | null = null;
  private litCrystals = new Set<number>();
  /** pas de tintement pendant un chargement ou une résolution automatique */
  private quiet = false;

  private board = new THREE.Group();
  private tiles: Tile[] = [];
  private litMat = new THREE.MeshStandardMaterial({ color: '#e8c06a', roughness: 0.4, emissive: '#ffb53d', emissiveIntensity: 0.9 });
  private darkMat = new THREE.MeshStandardMaterial({ color: '#3a2c22', roughness: 1 });
  /** la lumière bleue (deuxième graine) */
  private blueMat = new THREE.MeshStandardMaterial({ color: '#8fd3ff', roughness: 0.4, emissive: '#2f9dff', emissiveIntensity: 1.0 });
  /** cristaux : éteints (la couleur attendue, en sourdine) ou allumés, par couleur */
  private crystalMats = [
    { off: new THREE.MeshStandardMaterial({ color: '#9a7426', roughness: 0.5, emissive: '#4a3205', flatShading: true }), on: new THREE.MeshStandardMaterial({ color: '#ffe08a', emissive: '#ffb53d', emissiveIntensity: 1.3, flatShading: true }) },
    { off: new THREE.MeshStandardMaterial({ color: '#1f4a6b', roughness: 0.5, emissive: '#0b2a45', flatShading: true }), on: new THREE.MeshStandardMaterial({ color: '#bfe8ff', emissive: '#2f9dff', emissiveIntensity: 1.3, flatShading: true }) },
  ];
  private leakMat = new THREE.MeshBasicMaterial({ color: '#ff4a3a', toneMapped: false });
  private frameMat: THREE.MeshStandardMaterial;
  private hovered: number | null = null;
  private hintK: number | null = null;
  private hintRev = false;
  private time = 0;
  private solvedAt = -1;

  constructor(readonly puzzle: RootPuzzle, readonly place: RootPlacement, private readonly start: number[]) {
    const c = place.cell;
    const pit = place.kind === 'pit';
    this.reach = pit ? 22 : 3.4;
    this.state = start.slice();
    const W = puzzle.width * c;
    const D = puzzle.height * c;
    this.group.name = `racines ${puzzle.id}`;
    this.group.position.set(place.x, heightAt(place.x, place.z), place.z);
    this.group.rotation.y = place.yaw;
    if (pit) {
      this.board.position.y = 0.05 - (place.sink ?? 0);
    } else {
      // le pied s'arrête sous le plateau (incliné, son bord avant descend plus bas que son centre)
      const ped = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.8, 0.4), stoneMaterial('#9a8c8a'));
      ped.position.y = 0.4;
      ped.castShadow = true;
      this.group.add(ped);
      this.board.position.y = 1.05;
      this.board.rotation.x = TILT;
    }
    this.group.add(this.board);
    this.frameMat = new THREE.MeshStandardMaterial({ color: '#7d6f74', roughness: 0.7, emissive: '#000000' });
    const frame = new THREE.Mesh(new THREE.BoxGeometry(W + c * 0.4, c * 0.2, D + c * 0.4), this.frameMat);
    frame.position.y = -c * 0.1;
    frame.receiveShadow = true;
    this.board.add(frame);
    const segGeo = new THREE.BoxGeometry(c * 0.16, c * 0.12, c * 0.5);
    segGeo.translate(0, 0, -c * 0.25); // du centre vers le bord nord
    const knotGeo = new THREE.CylinderGeometry(c * 0.13, c * 0.13, c * 0.14, 8);
    const capGeo = new THREE.SphereGeometry(c * 0.09, 8, 6);
    const tileGeo = new THREE.BoxGeometry(c * 0.94, c * 0.08, c * 0.94);
    const crystalGeo = new THREE.OctahedronGeometry(c * 0.2, 0).scale(1, 1.5, 1);
    puzzle.tiles.forEach((t, i) => {
      const x = i % puzzle.width;
      const y = Math.floor(i / puzzle.width);
      const tg = new THREE.Group();
      tg.position.set((x + 0.5 - puzzle.width / 2) * c, c * 0.04, (y + 0.5 - puzzle.height / 2) * c);
      const hole = isHole(t);
      const base = new THREE.MeshStandardMaterial({ color: hole ? '#1c1720' : t.fixed || t.seed ? '#8f8580' : '#b4a89c', roughness: 0.85, emissive: '#000000' });
      const tile = new THREE.Mesh(tileGeo, base);
      tile.receiveShadow = true;
      tile.position.copy(tg.position);
      // un trou : la case est creusée, sombre, sans racine
      if (hole) tile.position.y -= c * 0.06;
      this.board.add(tile);
      if (hole) {
        this.tiles.push({ group: tg, base, segs: [], crystal: null, caps: [], target: 0, current: 0 });
        this.board.add(tg);
        return;
      }
      if (!t.seed && !t.fixed) {
        tile.userData = { panel: this, k: i };
        this.pickables.push(tile);
      }
      // la forme de la racine (segments de la forme de base, nœud, cristal) en un seul maillage :
      // la tuile entière tourne, et l'on ne change que son matériau (allumée ou non)
      const parts: THREE.BufferGeometry[] = [];
      for (let d = 0; d < 4; d++) {
        if (!(t.mask & (1 << d))) continue;
        parts.push(segGeo.clone().rotateY(-d * (Math.PI / 2)).translate(0, c * 0.08, 0));
      }
      parts.push(knotGeo.clone().translate(0, c * 0.08, 0));
      const shape = new THREE.Mesh(mergeGeometries(parts.map((q) => (q.index ? q.toNonIndexed() : q)), false)!, this.darkMat);
      tg.add(shape);
      const segs = [shape];
      let crystal: THREE.Mesh | null = null;
      if (t.crystal) {
        crystal = new THREE.Mesh(crystalGeo, this.crystalMats[t.color ?? 0]!.off);
        crystal.position.y = c * 0.28;
        tg.add(crystal);
      }
      if (t.seed) {
        const blue = (t.color ?? 0) === 1;
        const seed = new THREE.Mesh(new THREE.SphereGeometry(c * 0.24, 14, 10), new THREE.MeshStandardMaterial({
          color: blue ? '#d6f0ff' : '#fff1c4', emissive: blue ? '#3aa8ff' : '#ffcf5a', emissiveIntensity: 1.4, toneMapped: false,
        }));
        seed.position.y = c * 0.2;
        tg.add(seed);
      }
      // bouts de racine : rouges s'ils fuient dans le vide
      const caps: THREE.Mesh[] = [];
      for (let d = 0; d < 4; d++) {
        const cap = new THREE.Mesh(capGeo, this.leakMat);
        cap.position.set(DIRS[d]!.x * c * 0.47, c * 0.12, DIRS[d]!.z * c * 0.47);
        cap.visible = false;
        this.board.add(cap);
        cap.position.add(tg.position);
        caps.push(cap);
      }
      this.board.add(tg);
      const turns = this.state[i] ?? 0;
      tg.rotation.y = -turns * (Math.PI / 2);
      this.tiles.push({ group: tg, base, segs, crystal, caps, target: turns, current: turns });
    });
    this.refresh();
    this.setPowered(false);
  }

  get id(): string {
    return this.puzzle.id;
  }

  setPowered(on: boolean): void {
    this.powered = on;
    this.quiet = true;
    this.refresh();
    this.quiet = false;
  }

  setDetail(visible: boolean): void {
    if (this.board.visible !== visible) this.board.visible = visible;
  }

  setHover(k: number | null): void {
    this.hovered = this.powered && !this.solved ? k : null;
  }

  /** Allume les racines reliées à la graine, montre les fuites. */
  private refresh(): void {
    const chk = checkRoots(this.puzzle, this.state);
    const { width: w, height: h } = this.puzzle;
    // les cristaux qui viennent de s'allumer tintent, de plus en plus haut
    this.puzzle.tiles.forEach((t, i) => {
      if (!t.crystal) return;
      const lit = this.powered && chk.color[i] === (t.color ?? 0);
      if (lit && !this.litCrystals.has(i)) {
        this.litCrystals.add(i);
        if (!this.quiet) this.onCrystal?.(this.litCrystals.size);
      } else if (!lit) this.litCrystals.delete(i);
    });
    // raccords interdits entre l'or et le bleu : un point rouge des deux côtés
    const clash = new Set(chk.conflicts.map((q) => q.i * 4 + q.d));
    this.tiles.forEach((t, i) => {
      if (isHole(this.puzzle.tiles[i]!)) return;
      const lit = this.powered && chk.lit[i]!;
      const mat = !lit ? this.darkMat : chk.color[i] === 1 ? this.blueMat : this.litMat;
      for (const s of t.segs) s.material = mat;
      if (t.crystal) {
        const want = this.puzzle.tiles[i]!.color ?? 0;
        t.crystal.material = this.crystalMats[want]![lit && chk.color[i] === want ? 'on' : 'off'];
      }
      const m = rotateMask(this.puzzle.tiles[i]!.mask, this.state[i] ?? 0);
      const x = i % w;
      const y = Math.floor(i / w);
      for (let d = 0; d < 4; d++) {
        let leak = false;
        if (lit && m & (1 << d)) {
          const nx = x + DIRS[d]!.x;
          const ny = y + DIRS[d]!.z;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) leak = true;
          else {
            const nm = rotateMask(this.puzzle.tiles[ny * w + nx]!.mask, this.state[ny * w + nx] ?? 0);
            leak = !(nm & (1 << ((d + 2) % 4)));
          }
        }
        t.caps[d]!.visible = (leak || (this.powered && clash.has(i * 4 + d))) && !this.solved;
      }
    });
    if (!this.solved && this.powered && chk.solved) {
      this.solved = true;
      this.solvedAt = this.time;
      this.onSolved?.();
    }
  }

  goalPoints(): { pos: THREE.Vector3; r: number }[] {
    const chk = checkRoots(this.puzzle, this.state);
    const out: { pos: THREE.Vector3; r: number }[] = [];
    this.tiles.forEach((t, i) => {
      const want = this.puzzle.tiles[i]!.color ?? 0;
      if (t.crystal && chk.color[i] !== want) out.push(ringAround(t.crystal, 1.6));
      for (const cap of t.caps) if (cap.visible) out.push(ringAround(cap, 2.2));
    });
    return out;
  }

  hint(): number | null {
    if (!this.powered || this.solved) return null;
    const sol = solveRoots(this.puzzle, 1).solution;
    if (!sol) return null;
    const i = this.puzzle.tiles.findIndex((t, j) => rotateMask(t.mask, this.state[j] ?? 0) !== rotateMask(t.mask, sol[j]!));
    if (i < 0) return null;
    // le plus court : un quart de tour dans un sens ou dans l'autre
    const t = this.puzzle.tiles[i]!;
    const back = rotateMask(t.mask, (this.state[i] ?? 0) + 3) === rotateMask(t.mask, sol[i]!);
    this.hintK = i;
    this.hintRev = back;
    return i;
  }

  activeHint(): { k: number; reverse: boolean } | null {
    return this.hintK !== null && this.powered && !this.solved ? { k: this.hintK, reverse: this.hintRev } : null;
  }

  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    const t = this.puzzle.tiles[k];
    if (!t || t.seed || t.fixed) return 'denied';
    this.hintK = null;
    const tile = this.tiles[k]!;
    tile.target += reverse ? -1 : 1;
    this.state[k] = ((tile.target % 4) + 4) % 4;
    this.onTurn?.();
    this.refresh();
    return 'ok';
  }

  /** État = quarts de tour de chaque tuile ; un état abîmé repart du départ. */
  applyState(s: number[], instant = true): void {
    void instant;
    const ok = Array.isArray(s) && s.length === this.puzzle.tiles.length && s.every((v) => Number.isInteger(v) && v >= 0 && v <= 3);
    this.state = (ok ? s : this.start).slice();
    this.tiles.forEach((t, i) => {
      t.target = t.current = this.state[i]!;
      t.group.rotation.y = -t.current * (Math.PI / 2);
    });
    this.quiet = true;
    this.refresh();
    this.quiet = false;
  }

  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
    this.quiet = true;
    this.refresh();
    this.quiet = false;
  }

  solution(): number[] | null {
    return solveRoots(this.puzzle, 1).solution;
  }

  update(dt: number, time: number): void {
    this.time = time;
    this.tiles.forEach((t, i) => {
      if (t.current !== t.target) {
        const d = t.target - t.current;
        t.current += Math.sign(d) * Math.min(Math.abs(d), dt * 7);
        if (Math.abs(t.target - t.current) < 1e-3) t.current = t.target;
        t.group.rotation.y = -t.current * (Math.PI / 2);
      }
      if (this.hovered === i) t.base.emissive.set('#5a4620');
      else if (this.hintK === i && !this.solved) t.base.emissive.set('#2a8fb0').multiplyScalar(0.6 * pulse(time));
      else t.base.emissive.set('#000000');
    });
    // allumé : un liseré chaud autour du pupitre
    if (!this.solved) this.frameMat.emissive.set(this.powered ? '#4a3210' : '#000000');
    else {
      const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
      this.frameMat.emissive.set('#ffc23d').multiplyScalar(0.25 + 0.6 * flash);
    }
  }
}
