import * as THREE from 'three';
import { N, checkShadow, shadowOn, solveShadow } from '../core/shadow/index.ts';
import type { ShadowPuzzle, Wall } from '../core/shadow/index.ts';
import { heightAt } from '../world/terrain.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';
import { objectEuler } from './shadowMath.ts';
import { nearestDiff, pulse } from './hints.ts';

export interface ShadowPlacement {
  x: number;
  z: number;
  yaw: number;
  /** taille d'un cube (m) */
  voxel: number;
  /** hauteur de la scène au-dessus du sol */
  stageY: number;
}

const OBJECT_COLORS = ['#c96f5a', '#7fa36a', '#6b86b5', '#d9a440'];
const SHADOW_OK = new THREE.Color('#5a3d14');
const SHADOW_BAD = new THREE.Color('#2b2a36');
const SHADOW_DONE = new THREE.Color('#d39a2a');

interface Obj {
  pivot: THREE.Group;
  turns: number;
  target: number;
  current: number;
  axis: 'x' | 'y';
  base: THREE.Mesh[];
}

/**
 * Théâtre d'ombres : une scène avec des objets en cubes, des lampes et des murs.
 * Les ombres affichées sont calculées par le moteur (projection orthogonale exacte).
 */
export class ShadowView implements PuzzleView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach: number;
  state: number[];
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;
  onTurn: (() => void) | null = null;

  private v: number;
  /** agrandissement des ombres (lampe proche) */
  private S: number;
  /** écart entre la scène et les murs */
  private gap: number;
  private objs: Obj[] = [];
  private shadows = new Map<Wall, THREE.InstancedMesh>();
  private wallGlow = new Map<Wall, THREE.MeshStandardMaterial>();
  private lamps: { mat: THREE.MeshBasicMaterial; cone: THREE.MeshBasicMaterial }[] = [];
  private hovered: number | null = null;
  private hintK: number | null = null;
  private time = 0;
  private solvedAt = -1;
  private stage: THREE.Group;

  constructor(readonly puzzle: ShadowPuzzle, readonly place: ShadowPlacement, start: number[]) {
    this.v = place.voxel;
    this.S = place.voxel > 0.5 ? 1.35 : 1.8;
    this.gap = place.voxel * (place.voxel > 0.5 ? 1.2 : 2.2);
    this.reach = place.voxel > 0.5 ? 12 : 3.6;
    this.state = start.slice();
    const v = this.v;
    const W = puzzle.width * v;
    const D = puzzle.depth * v;
    const H = puzzle.height * v;
    this.group.name = `ombres ${puzzle.id}`;
    this.group.position.set(place.x, heightAt(place.x, place.z), place.z);
    this.group.rotation.y = place.yaw;

    // socle
    const plinth = new THREE.Mesh(new THREE.BoxGeometry(W + v * 1.2, place.stageY, D + v * 1.2), stoneMaterial('#e6dccb'));
    plinth.position.y = place.stageY / 2 - 0.02;
    plinth.castShadow = plinth.receiveShadow = true;
    this.group.add(plinth);
    this.stage = new THREE.Group();
    this.stage.position.y = place.stageY;
    this.group.add(this.stage);
    const top = new THREE.Mesh(new THREE.BoxGeometry(W, v * 0.08, D), new THREE.MeshStandardMaterial({ color: '#5b4a3c', roughness: 0.8 }));
    top.position.y = -v * 0.04;
    top.receiveShadow = true;
    this.stage.add(top);

    // murs avec silhouettes gravées
    for (const wall of puzzle.walls) this.buildWall(wall, W, D, H);

    // objets
    puzzle.objects.forEach((o, i) => {
      const pivot = new THREE.Group();
      const cx = (o.ox + N / 2) * v - W / 2;
      const cz = (o.oz + N / 2) * v - D / 2;
      pivot.position.set(cx, (N / 2) * v + v * 0.02, cz);
      const col = new THREE.Color(OBJECT_COLORS[i % OBJECT_COLORS.length]!);
      const mat = new THREE.MeshStandardMaterial({ color: col, roughness: 0.6, flatShading: true });
      const cube = new THREE.BoxGeometry(v * 0.96, v * 0.96, v * 0.96);
      for (const [x, y, z] of o.shape) {
        const m = new THREE.Mesh(cube, mat);
        m.position.set((x - 1) * v, (y - 1) * v, (z - 1) * v);
        m.castShadow = place.voxel > 0.5;
        pivot.add(m);
      }
      this.stage.add(pivot);
      // support : plateau tournant (axe vertical) ou berceau (axe est-ouest)
      const base: THREE.Mesh[] = [];
      const brass = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.35, metalness: 0.7 });
      if (o.axis === 'y') {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(v * 1.55, v * 1.6, v * 0.06, 32), brass);
        disc.position.set(cx, 0.0, cz);
        this.stage.add(disc);
        base.push(disc);
      } else {
        for (const s of [-1, 1]) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(v * 1.55, v * 0.06, 6, 24, Math.PI), brass);
          arc.rotation.y = Math.PI / 2;
          arc.rotation.z = Math.PI;
          arc.position.set(cx + s * v * 1.6, v * 1.52, cz);
          this.stage.add(arc);
          base.push(arc);
        }
      }
      const pick = new THREE.Mesh(new THREE.BoxGeometry(v * 3.1, v * 3.1, v * 3.1), new THREE.MeshBasicMaterial({ visible: false }));
      pick.position.copy(pivot.position);
      pick.userData = { panel: this, k: i };
      this.stage.add(pick);
      this.pickables.push(pick);
      this.objs.push({ pivot, turns: this.state[i]!, target: this.state[i]!, current: this.state[i]!, axis: o.axis, base });
      this.applyRotation(i, this.state[i]!);
    });

    // lampes
    // lampes hautes, sur le côté gauche : elles ne masquent pas la vue
    if (puzzle.walls.includes('back')) this.buildLamp(new THREE.Vector3(-W / 2 - v * 0.8, H + v * 3.2, D / 2 + v * 1.2), new THREE.Vector3(0, H / 2, -D / 2));
    if (puzzle.walls.includes('right')) this.buildLamp(new THREE.Vector3(-W / 2 - v * 1.6, H + v * 3.2, -D / 4), new THREE.Vector3(W / 2, H / 2, 0));

    this.refreshShadows();
    this.setPowered(false);
  }

  get id(): string {
    return this.puzzle.id;
  }

  private buildWall(wall: Wall, W: number, D: number, H: number): void {
    const v = this.v;
    const cols = wall === 'back' ? this.puzzle.width : this.puzzle.depth;
    const target = this.puzzle.targets[wall]!;
    // texture : enduit, grille fine, silhouette gravée en or
    const px = 48;
    const c = document.createElement('canvas');
    c.width = cols * px;
    c.height = this.puzzle.height * px;
    const g = c.getContext('2d')!;
    g.fillStyle = '#efe6d6';
    g.fillRect(0, 0, c.width, c.height);
    g.strokeStyle = 'rgba(120,100,70,0.18)';
    for (let u = 0; u <= cols; u++) {
      g.beginPath();
      g.moveTo(u * px, 0);
      g.lineTo(u * px, c.height);
      g.stroke();
    }
    for (let r = 0; r <= this.puzzle.height; r++) {
      g.beginPath();
      g.moveTo(0, r * px);
      g.lineTo(c.width, r * px);
      g.stroke();
    }
    for (const key of target) {
      const [u, vv] = key.split(',').map(Number) as [number, number];
      // u : de gauche à droite vu par le joueur ; v : du bas vers le haut
      const col = wall === 'back' ? u : u;
      const x0 = col * px;
      const y0 = (this.puzzle.height - 1 - vv) * px;
      g.fillStyle = 'rgba(214,164,64,0.28)';
      g.fillRect(x0, y0, px, px);
      g.strokeStyle = '#c08a24';
      g.lineWidth = 4;
      const has = (du: number, dv: number) => target.has(`${u + du},${vv + dv}`);
      g.beginPath();
      if (!has(0, 1)) { g.moveTo(x0, y0); g.lineTo(x0 + px, y0); }
      if (!has(0, -1)) { g.moveTo(x0, y0 + px); g.lineTo(x0 + px, y0 + px); }
      if (!has(-1, 0)) { g.moveTo(x0, y0); g.lineTo(x0, y0 + px); }
      if (!has(1, 0)) { g.moveTo(x0 + px, y0); g.lineTo(x0 + px, y0 + px); }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.95, emissive: '#000000' });
    this.wallGlow.set(wall, mat);
    const width = cols * v * this.S;
    const wallH = H * this.S;
    const plane = new THREE.Mesh(new THREE.BoxGeometry(width + v * 0.3, wallH + v * 0.3, v * 0.15), [
      stoneMaterial('#e6dccb'), stoneMaterial('#e6dccb'), stoneMaterial('#e6dccb'), stoneMaterial('#e6dccb'), mat, stoneMaterial('#e6dccb'),
    ]);
    // le mur du fond regarde vers +z ; le mur de droite regarde vers -x
    if (wall === 'back') {
      plane.position.set(0, wallH / 2, -D / 2 - this.gap);
    } else {
      plane.position.set(W / 2 + this.gap, wallH / 2, 0);
      plane.rotation.y = -Math.PI / 2;
    }
    plane.castShadow = plane.receiveShadow = this.v > 0.5;
    this.stage.add(plane);
    // ombres : carrés sombres juste devant le mur
    const q = new THREE.PlaneGeometry(v * this.S * 0.98, v * this.S * 0.98);
    const sm = new THREE.InstancedMesh(q, new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.82, depthWrite: false }), cols * this.puzzle.height);
    sm.position.copy(plane.position);
    sm.rotation.copy(plane.rotation);
    sm.position.add(wall === 'back' ? new THREE.Vector3(0, 0, v * 0.08 + 0.003) : new THREE.Vector3(-v * 0.08 - 0.003, 0, 0));
    sm.count = 0;
    sm.renderOrder = 1;
    this.stage.add(sm);
    this.shadows.set(wall, sm);
  }

  private buildLamp(pos: THREE.Vector3, aim: THREE.Vector3): void {
    const v = this.v;
    const g = new THREE.Group();
    g.position.copy(pos);
    const brass = new THREE.MeshStandardMaterial({ color: '#8a6a45', roughness: 0.4, metalness: 0.7 });
    const body = new THREE.Mesh(new THREE.CylinderGeometry(v * 0.35, v * 0.5, v * 0.7, 10), brass);
    g.add(body);
    const lensMat = new THREE.MeshBasicMaterial({ color: '#555555', toneMapped: false });
    const lens = new THREE.Mesh(new THREE.CircleGeometry(v * 0.45, 16), lensMat);
    lens.position.y = -v * 0.36;
    lens.rotation.x = Math.PI / 2;
    g.add(lens);
    // faisceau visible
    const dist = pos.distanceTo(aim);
    const coneMat = new THREE.MeshBasicMaterial({
      color: '#fff1c9', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide,
    });
    const cone = new THREE.Mesh(new THREE.ConeGeometry(v * 2.4, dist, 20, 1, true), coneMat);
    cone.position.y = -dist / 2 - v * 0.36;
    g.add(cone);
    g.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), aim.clone().sub(pos).normalize());
    this.stage.add(g);
    this.lamps.push({ mat: lensMat, cone: coneMat });
  }

  private applyRotation(i: number, turns: number): void {
    const o = this.objs[i]!;
    o.pivot.rotation.copy(objectEuler(o.axis, turns));
  }

  private refreshShadows(): void {
    const v = this.v;
    const m = new THREE.Matrix4();
    for (const wall of this.puzzle.walls) {
      const sm = this.shadows.get(wall)!;
      const cols = wall === 'back' ? this.puzzle.width : this.puzzle.depth;
      if (!this.powered) {
        sm.count = 0;
        continue;
      }
      const set = shadowOn(this.puzzle, this.state, wall);
      let n = 0;
      for (const key of set) {
        const [u, vv] = key.split(',').map(Number) as [number, number];
        // mur de droite : u = profondeur (0 au fond) ; vu de face il va de gauche (fond) à droite (joueur)
        const x = ((u + 0.5) - cols / 2) * v * this.S;
        const y = ((vv + 0.5) - this.puzzle.height / 2) * v * this.S;
        m.makeTranslation(x, y, 0);
        sm.setMatrixAt(n, m);
        // ombre dans la silhouette : ambre sombre ; en dehors : gris froid
        const inside = this.puzzle.targets[wall]!.has(key);
        sm.setColorAt(n, inside ? (this.solved ? SHADOW_DONE : SHADOW_OK) : SHADOW_BAD);
        n++;
      }
      sm.count = n;
      sm.instanceMatrix.needsUpdate = true;
      if (sm.instanceColor) sm.instanceColor.needsUpdate = true;
    }
  }

  setPowered(on: boolean): void {
    this.powered = on;
    for (const l of this.lamps) {
      l.mat.color.set(on ? '#fff3cf' : '#555555');
      l.cone.opacity = on ? 0.035 : 0;
    }
    this.refreshShadows();
  }

  setDetail(visible: boolean): void {
    if (this.stage.visible !== visible) this.stage.visible = visible;
  }

  setHover(k: number | null): void {
    this.hovered = this.powered && !this.solved ? k : null;
  }

  hint(): number | null {
    if (!this.powered || this.solved) return null;
    const turns = (a: number, b: number) => Math.min((a - b + 4) % 4, (b - a + 4) % 4);
    this.hintK = nearestDiff(this.state, solveShadow(this.puzzle).solutions, turns);
    return this.hintK;
  }

  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    this.hintK = null;
    const o = this.objs[k];
    if (!o) return 'locked';
    if (o.current !== o.target) return 'denied';
    o.target += reverse ? -1 : 1;
    this.state[k] = ((o.target % 4) + 4) % 4;
    this.onTurn?.();
    return 'ok';
  }

  applyState(s: number[], instant = true): void {
    this.state = s.map((t) => ((t % 4) + 4) % 4);
    this.objs.forEach((o, i) => {
      o.target = this.state[i]!;
      if (instant) {
        o.current = o.target;
        this.applyRotation(i, o.current);
      }
    });
    if (instant) this.evaluate();
  }

  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
    this.refreshShadows();
  }

  solution(): number[] | null {
    return solveShadow(this.puzzle).solutions[0] ?? null;
  }

  private evaluate(): void {
    this.refreshShadows();
    if (!this.solved && checkShadow(this.puzzle, this.state).solved) {
      this.solved = true;
      this.solvedAt = this.time;
      this.refreshShadows();
      this.onSolved?.();
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    let moving = false;
    this.objs.forEach((o, i) => {
      if (o.current === o.target) return;
      moving = true;
      const d = o.target - o.current;
      const step = Math.sign(d) * Math.min(Math.abs(d), dt * 5);
      o.current += step;
      if (Math.abs(o.target - o.current) < 1e-3) {
        o.current = o.target;
        // normaliser pour éviter de dériver
        o.target = o.current = ((Math.round(o.current) % 4) + 4) % 4;
      }
      this.applyRotation(i, o.current);
      if (o.current === o.target) this.evaluate();
    });
    void moving;
    // survol : le support s'éclaire
    this.objs.forEach((o, i) => {
      for (const b of o.base) {
        const m = (b.material as THREE.MeshStandardMaterial).emissive;
        if (this.hovered === i) m.set('#6b5320');
        else if (this.hintK === i && !this.solved) m.set('#2a8fb0').multiplyScalar(pulse(time));
        else m.set('#000000');
      }
    });
    if (this.solved) {
      const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
      for (const m of this.wallGlow.values()) m.emissive.set('#ffcf70').multiplyScalar(0.18 + 0.5 * flash);
    }
  }
}
