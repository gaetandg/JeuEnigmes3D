import * as THREE from 'three';
import { initialState, interact, simulate, solve } from '../core/light/index.ts';
import type { Cell, Color, LightPuzzle, LightState, SimResult } from '../core/light/index.ts';
import { heightAt } from '../world/terrain.ts';
import { TOWERS, towerCell } from '../world/layout.ts';
import { stoneMaterial } from '../world/props.ts';
import type { Colliders } from '../game/colliders.ts';
import { displayColor } from './panelView.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';

const WHITE_HOT = new THREE.Color('#ffffff');

interface Tower {
  k: number;
  head: THREE.Group;
  ring: THREE.MeshBasicMaterial;
  targetAngle: number;
}

/**
 * Énigme d'environnement : la même logique que les panneaux, à l'échelle du paysage.
 * Les miroirs sont des tours que l'on fait pivoter, les filtres de grands vitraux.
 */
export class WorldLightPuzzle implements PuzzleView {
  readonly group = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  readonly reach = 5;
  state: LightState;
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;

  get id(): string {
    return this.puzzle.id;
  }

  solution(): number[] | null {
    return solve(this.puzzle, { keep: 1 }).solutions[0] ?? null;
  }

  private towers: Tower[] = [];
  private beams: THREE.InstancedMesh;
  private halos: THREE.InstancedMesh;
  private sim: SimResult | null = null;
  private target: { index: number; mesh: THREE.Mesh; mat: THREE.MeshStandardMaterial; glow: THREE.PointLight; wanted: Color } | null = null;
  private lens: THREE.MeshBasicMaterial | null = null;
  private hovered: number | null = null;
  private solvedAt = -1;
  private time = 0;

  constructor(readonly puzzle: LightPuzzle, colliders: Colliders) {
    this.group.name = 'tours-miroirs';
    this.state = initialState(puzzle);
    puzzle.cells.forEach((cell, i) => this.build(cell, i, colliders));
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const n = puzzle.cells.length * 4;
    this.beams = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ toneMapped: false }), n);
    this.halos = new THREE.InstancedMesh(
      geo,
      new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.1, blending: THREE.AdditiveBlending, depthWrite: false }),
      n,
    );
    for (const im of [this.beams, this.halos]) {
      im.count = 0;
      im.frustumCulled = false;
      this.group.add(im);
    }
    this.halos.renderOrder = 2;
    this.setPowered(false);
  }

  private pos(i: number): THREE.Vector3 {
    const w = this.puzzle.width;
    const { x, z } = towerCell(i % w, Math.floor(i / w));
    return new THREE.Vector3(x, heightAt(x, z), z);
  }

  private build(def: Cell, i: number, colliders: Colliders): void {
    const p = this.pos(i);
    const Y = TOWERS.beamY;
    const k = this.puzzle.interactive.indexOf(i);
    const stone = stoneMaterial();
    const add = (o: THREE.Object3D) => {
      o.position.add(p);
      o.traverse((m) => {
        if (m instanceof THREE.Mesh) {
          m.castShadow = true;
          m.receiveShadow = true;
        }
      });
      this.group.add(o);
      return o;
    };
    switch (def.kind) {
      case 'source': {
        // grande lentille qui capte le soleil
        const g = new THREE.Group();
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.4, Y - 0.6, 8), stone);
        base.position.y = (Y - 0.6) / 2;
        g.add(base);
        const ring = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.18, 6, 24), new THREE.MeshStandardMaterial({ color: '#c9a45c', metalness: 0.8, roughness: 0.3 }));
        ring.position.y = Y;
        ring.rotation.y = Math.PI / 2;
        g.add(ring);
        this.lens = new THREE.MeshBasicMaterial({ color: '#555555', toneMapped: false });
        const lens = new THREE.Mesh(new THREE.CircleGeometry(0.9, 24), this.lens);
        lens.position.set(0.05, Y, 0);
        lens.rotation.y = Math.PI / 2;
        g.add(lens);
        g.rotation.y = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][def.dir]!;
        add(g);
        colliders.addCircle(p.x, p.z, 1.5);
        break;
      }
      case 'mirror':
      case 'splitter': {
        const glass = def.kind === 'splitter';
        const g = new THREE.Group();
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.7, Y - 1.4, 8), stone);
        pillar.position.y = (Y - 1.4) / 2;
        g.add(pillar);
        const ringMat = new THREE.MeshBasicMaterial({ color: '#c9a45c' });
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.75, 0.09, 6, 24), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = Y - 1.4;
        g.add(ring);
        const head = new THREE.Group();
        head.position.y = Y;
        const frame = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.8, 0.3), stoneMaterial('#d8cdbb'));
        head.add(frame);
        const pane = new THREE.Mesh(
          new THREE.BoxGeometry(3.0, 2.4, 0.34),
          glass
            ? new THREE.MeshStandardMaterial({ color: '#cfeeff', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.5 })
            : new THREE.MeshStandardMaterial({ color: '#f2f6fa', roughness: 0.05, metalness: 1 }),
        );
        head.add(pane);
        const angle = (o: number) => (o === 0 ? Math.PI / 4 : -Math.PI / 4);
        head.rotation.y = angle(def.fixed ? def.orient : this.state[k]!);
        g.add(head);
        add(g);
        colliders.addCircle(p.x, p.z, 0.9);
        if (!def.fixed) {
          const pick = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, Y + 1.6, 8), new THREE.MeshBasicMaterial({ visible: false }));
          pick.position.copy(p);
          pick.position.y += (Y + 1.6) / 2;
          pick.userData = { panel: this, k };
          this.group.add(pick);
          this.pickables.push(pick);
          this.towers.push({ k, head, ring: ringMat, targetAngle: head.rotation.y });
        }
        break;
      }
      case 'filter': {
        // arche avec un grand vitrail coloré
        const g = new THREE.Group();
        const col = displayColor(def.color);
        for (const s of [-1, 1]) {
          const post = new THREE.Mesh(new THREE.BoxGeometry(0.8, Y + 2, 0.8), stone);
          post.position.set(s * 2.2, (Y + 2) / 2, 0);
          g.add(post);
          colliders.addCircle(p.x + s * 2.2, p.z, 0.6);
        }
        const top = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.7, 1.0), stoneMaterial('#d8cdbb'));
        top.position.y = Y + 2.2;
        g.add(top);
        const glassMat = new THREE.MeshStandardMaterial({
          color: col, emissive: col.clone().multiplyScalar(0.35), transparent: true, opacity: 0.55, roughness: 0.1, side: THREE.DoubleSide,
        });
        const pane = new THREE.Mesh(new THREE.PlaneGeometry(3.6, Y + 1.6), glassMat);
        pane.position.y = (Y + 1.6) / 2 + 0.2;
        pane.castShadow = false;
        g.add(pane);
        add(g);
        pane.castShadow = false;
        break;
      }
      case 'target': {
        const g = new THREE.Group();
        const ped = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.4, Y - 1.2, 6), stone);
        ped.position.y = (Y - 1.2) / 2;
        g.add(ped);
        const mat = new THREE.MeshStandardMaterial({
          color: displayColor(def.color).lerp(WHITE_HOT, 0.3), emissive: '#000000', roughness: 0.2, flatShading: true,
        });
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(1.0, 0), mat);
        mesh.scale.y = 1.6;
        mesh.position.y = Y + 0.3;
        g.add(mesh);
        const glow = new THREE.PointLight(displayColor(def.color), 0, 14, 1.5);
        glow.position.y = Y + 0.3;
        g.add(glow);
        add(g);
        colliders.addCircle(p.x, p.z, 1.4);
        this.target = { index: i, mesh, mat, glow, wanted: def.color };
        break;
      }
      default:
        break;
    }
  }

  setPowered(on: boolean): void {
    this.powered = on;
    if (this.lens) this.lens.color.set(on ? '#fff6dc' : '#555555');
    this.refresh();
  }

  setHover(k: number | null): void {
    this.hovered = this.powered && !this.solved ? k : null;
  }

  setDetail(): void {
    /* toujours visible : c'est un élément du paysage */
  }

  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    const next = interact(this.puzzle, this.state, k, reverse);
    if (!next) return 'denied';
    this.applyState(next);
    return 'ok';
  }

  applyState(s: LightState, instant = false): void {
    this.state = s.slice();
    for (const t of this.towers) {
      t.targetAngle = this.state[t.k] === 0 ? Math.PI / 4 : -Math.PI / 4;
      if (instant) t.head.rotation.y = t.targetAngle;
    }
    this.refresh();
  }

  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
    this.refresh();
  }

  private refresh(): void {
    if (!this.powered) {
      this.beams.count = 0;
      this.halos.count = 0;
      this.sim = null;
      return;
    }
    const sim = simulate(this.puzzle, this.state);
    this.sim = sim;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const col = new THREE.Color();
    const Y = TOWERS.beamY;
    let n = 0;
    for (let i = 0; i < this.puzzle.cells.length; i++) {
      const a = this.pos(i);
      for (let d = 0; d < 4; d++) {
        const v = sim.halfEdges[i * 4 + d]!;
        if (!v) continue;
        const horizontal = d === 1 || d === 3;
        const half = (horizontal ? TOWERS.dx : TOWERS.dz) / 2;
        const dx = [0, 1, 0, -1][d]!;
        const dz = [-1, 0, 1, 0][d]!;
        // le rayon suit le sol entre deux cases : on prend l'altitude du milieu
        const mx = a.x + dx * half * 0.5;
        const mz = a.z + dz * half * 0.5;
        const y = Math.max(a.y, heightAt(a.x + dx * half, a.z + dz * half)) + Y;
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), horizontal ? 0 : Math.PI / 2);
        m.compose(new THREE.Vector3(mx, y, mz), q, new THREE.Vector3(half + 0.1, 0.14, 0.14));
        this.beams.setMatrixAt(n, m);
        this.beams.setColorAt(n, col.copy(displayColor(v)).lerp(WHITE_HOT, 0.25));
        m.compose(new THREE.Vector3(mx, y, mz), q, new THREE.Vector3(half, 0.45, 0.45));
        this.halos.setMatrixAt(n, m);
        this.halos.setColorAt(n, col.copy(displayColor(v)));
        n++;
      }
    }
    for (const im of [this.beams, this.halos]) {
      im.count = n;
      im.instanceMatrix.needsUpdate = true;
      if (im.instanceColor) im.instanceColor.needsUpdate = true;
    }
    if (sim.solved && !this.solved) {
      this.solved = true;
      this.solvedAt = this.time;
      this.onSolved?.();
    }
  }

  update(dt: number, time: number): void {
    this.time = time;
    for (const t of this.towers) {
      const d = t.targetAngle - t.head.rotation.y;
      t.head.rotation.y += Math.abs(d) < 0.001 ? d : d * Math.min(1, dt * 6);
      const hot = this.hovered === t.k;
      t.ring.color.set(hot ? '#fff0b8' : this.powered && !this.solved ? '#e0b45a' : '#9c8a6a');
    }
    if (this.target) {
      const got = this.sim?.received[this.target.index] ?? 0;
      const ok = got === this.target.wanted;
      const pulse = 0.5 + 0.5 * Math.sin(time * 2);
      this.target.mat.emissive.copy(displayColor(got || 0)).multiplyScalar(ok ? 1.2 : got ? 0.35 : 0);
      this.target.glow.intensity = ok ? 40 + 20 * pulse : got ? 8 : 0;
      this.target.mesh.rotation.y += dt * (ok ? 0.8 : 0.15);
    }
    void this.solvedAt;
  }
}
