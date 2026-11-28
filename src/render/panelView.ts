import * as THREE from 'three';
import { ringAround } from './goalRings.ts';
import {
  BLUE, GREEN, RED,
  initialState, interact, isValidState, leverHintMove, objectLevers, piecesUsed, simulate, solve,
} from '../core/light/index.ts';
import type { Cell, Color, LightPuzzle, LightState, SimResult } from '../core/light/index.ts';
import { heightAt } from '../world/terrain.ts';
import type { PanelSpot } from '../world/layout.ts';
import { stoneMaterial } from '../world/props.ts';
import type { InteractResult, PuzzleView } from './puzzleView.ts';
import { objectEuler } from './shadowMath.ts';
import { pulse as hintPulse } from './hints.ts';
import { mergeMeshes, mergeStatic } from './merge.ts';

/** Teintes des manivelles (les mêmes métaux qu'au cloître des ombres). */
const CRANK_METALS = ['#e4e4ee', '#cf8a4a', '#86a37a', '#b9a0d8'];

/** Couleur d'affichage d'une couleur logique. */
export function displayColor(c: Color): THREE.Color {
  switch (c) {
    case RED: return new THREE.Color('#ff3b30');
    case GREEN: return new THREE.Color('#35e06a');
    case BLUE: return new THREE.Color('#3a7bff');
    case RED | GREEN: return new THREE.Color('#ffd21f');
    case RED | BLUE: return new THREE.Color('#ff3bd4');
    case GREEN | BLUE: return new THREE.Color('#2fe6ff');
    case RED | GREEN | BLUE: return new THREE.Color('#ffffff');
    default: return new THREE.Color('#000000');
  }
}

const BOARD_SIZE = 1.45;
const WHITE_HOT = new THREE.Color('#ffffff');
const SYMBOL_MAT = new THREE.MeshBasicMaterial({ color: '#f4efe3' });
const TILT = 0.62;
const BOARD_HEIGHT = 1.0;

// matériaux partagés
const MAT = {
  board: new THREE.MeshStandardMaterial({ color: '#27303b', roughness: 0.75, metalness: 0.1 }),
  boardOff: new THREE.MeshStandardMaterial({ color: '#3a3f46', roughness: 0.9 }),
  frame: stoneMaterial('#efe7da'),
  wall: stoneMaterial('#d9cfbf'),
  brass: new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.35, metalness: 0.8 }),
  darkBase: new THREE.MeshStandardMaterial({ color: '#4a4f57', roughness: 0.6, metalness: 0.3 }),
  mirror: new THREE.MeshStandardMaterial({ color: '#f2f6fa', roughness: 0.06, metalness: 1 }),
  glass: new THREE.MeshStandardMaterial({ color: '#cfeeff', roughness: 0.05, metalness: 0.5, transparent: true, opacity: 0.45 }),
  bronze: new THREE.MeshStandardMaterial({ color: '#6f5a45', roughness: 0.5, metalness: 0.6, flatShading: true }),
  obsidian: new THREE.MeshStandardMaterial({ color: '#15151c', roughness: 0.15, metalness: 0.4, flatShading: true }),
  socket: new THREE.MeshStandardMaterial({ color: '#1b2128', roughness: 0.9 }),
  pick: new THREE.MeshBasicMaterial({ visible: false }),
  hover: new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffe7a3').multiplyScalar(1.6), toneMapped: false }),
  frameGlow: new THREE.MeshBasicMaterial({ color: '#4a4236', toneMapped: false }),
};

let glowTexture: THREE.Texture | null = null;
function getGlowTexture(): THREE.Texture {
  if (glowTexture) return glowTexture;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.25, 'rgba(255,255,255,0.45)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 64, 64);
  glowTexture = new THREE.CanvasTexture(c);
  glowTexture.colorSpace = THREE.SRGBColorSpace;
  return glowTexture;
}

function gridTexture(w: number, h: number): THREE.Texture {
  const px = 64;
  const c = document.createElement('canvas');
  c.width = w * px;
  c.height = h * px;
  const g = c.getContext('2d')!;
  g.fillStyle = '#27303b';
  g.fillRect(0, 0, c.width, c.height);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      g.fillStyle = (x + y) % 2 === 0 ? '#2b3541' : '#28313c';
      g.fillRect(x * px + 3, y * px + 3, px - 6, px - 6);
    }
  }
  g.strokeStyle = '#3e4a58';
  g.lineWidth = 2;
  for (let x = 0; x <= w; x++) {
    g.beginPath();
    g.moveTo(x * px, 0);
    g.lineTo(x * px, c.height);
    g.stroke();
  }
  for (let y = 0; y <= h; y++) {
    g.beginPath();
    g.moveTo(0, y * px);
    g.lineTo(c.width, y * px);
    g.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

interface Crystal {
  index: number;
  mesh: THREE.Mesh;
  mat: THREE.MeshStandardMaterial;
  glow: THREE.Sprite;
  wanted: Color; // 0 = cristal noir
}

interface Piece {
  k: number;
  cellIndex: number;
  cell: Cell;
  /** objet qui tourne (miroir, lame) */
  plate: THREE.Object3D | null;
  targetAngle: number;
  pick: THREE.Mesh;
}

export class LightPanel implements PuzzleView {
  readonly reach = 3.4;
  readonly group = new THREE.Group();
  readonly board = new THREE.Group();
  readonly pickables: THREE.Mesh[] = [];
  state: LightState;
  solved = false;
  powered = false;
  onSolved: (() => void) | null = null;
  /** un cristal vient de s'allumer (son) */
  onCrystal: ((color: number) => void) | null = null;
  private litCrystals = new Set<number>();
  private crystalsReady = false;

  get id(): string {
    return this.puzzle.id;
  }

  solution(): number[] | null {
    return solve(this.puzzle, { keep: 1 }).solutions[0] ?? null;
  }

  private cell: number;
  private pieces: Piece[] = [];
  /** objets en cubes (zone finale) : rotation affichée animée */
  private objs: { k: number; pivot: THREE.Group; axis: 'x' | 'y'; current: number; target: number; base: THREE.MeshStandardMaterial; paint: THREE.MeshStandardMaterial }[] = [];
  /** manivelles couplées (zone finale) : roues posées sur le rebord proche */
  private cranks: { wheel: THREE.Group; mat: THREE.MeshStandardMaterial; current: number; target: number }[] = [];
  private crystals: Crystal[] = [];
  private beams: THREE.InstancedMesh;
  private halos: THREE.InstancedMesh;
  private hover: THREE.Mesh;
  private hintRing: THREE.Mesh;
  private hintMat = new THREE.MeshBasicMaterial({ color: '#9fe8ff', toneMapped: false, transparent: true });
  private hintK: number | null = null;
  private hoverK: number | null = null;
  private tokens: THREE.Mesh[] = [];
  private boardMesh: THREE.Mesh;
  private boardMat: THREE.MeshStandardMaterial;
  private frameGlowMat: THREE.MeshBasicMaterial;
  private sim: SimResult | null = null;
  private solvedAt = -1;
  private time = 0;
  private sourceLenses: { mat: THREE.MeshBasicMaterial; color: THREE.Color }[] = [];
  /** petits symboles des couleurs primaires (option daltonisme) */
  private symbols = new THREE.Group();

  constructor(readonly puzzle: LightPuzzle, readonly spot: PanelSpot) {
    const { width: w, height: h } = puzzle;
    this.cell = BOARD_SIZE / Math.max(w, h, 4);
    const c = this.cell;
    this.state = initialState(puzzle);
    this.group.name = `panneau ${puzzle.id}`;
    this.group.position.set(spot.x, heightAt(spot.x, spot.z), spot.z);
    this.group.rotation.y = spot.yaw;

    // pied
    const pedestal = new THREE.Mesh(new THREE.BoxGeometry(0.5, BOARD_HEIGHT, 0.5), MAT.frame);
    pedestal.position.y = BOARD_HEIGHT / 2 - 0.05;
    pedestal.castShadow = pedestal.receiveShadow = true;
    this.group.add(pedestal);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.18, 0.9), MAT.wall);
    foot.position.y = 0.04;
    foot.receiveShadow = true;
    this.group.add(foot);

    this.board.position.set(0, BOARD_HEIGHT + 0.12, 0);
    this.board.rotation.x = TILT;
    this.group.add(this.board);

    const bw = w * c;
    const bh = h * c;
    this.boardMat = new THREE.MeshStandardMaterial({ map: gridTexture(w, h), roughness: 0.8, metalness: 0.05 });
    const boardGeo = new THREE.BoxGeometry(bw, 0.06, bh);
    this.boardMesh = new THREE.Mesh(boardGeo, [MAT.board, MAT.board, this.boardMat, MAT.board, MAT.board, MAT.board]);
    this.boardMesh.receiveShadow = true;
    this.board.add(this.boardMesh);
    // cadre de pierre + liseré lumineux
    const fw = 0.07;
    this.frameGlowMat = MAT.frameGlow.clone();
    for (const [sx, sz, lx, lz] of [
      [0, -(bh / 2 + fw / 2), bw + fw * 2, fw],
      [0, bh / 2 + fw / 2, bw + fw * 2, fw],
      [-(bw / 2 + fw / 2), 0, fw, bh],
      [bw / 2 + fw / 2, 0, fw, bh],
    ] as const) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(lx, 0.12, lz), MAT.frame);
      f.position.set(sx, 0.02, sz);
      f.castShadow = true;
      f.userData = { static: true, keep: true };
      this.board.add(f);
      const gl = new THREE.Mesh(new THREE.BoxGeometry(lx * 0.98, 0.012, lz * 0.3), this.frameGlowMat);
      gl.position.set(sx, 0.085, sz);
      gl.userData = { static: true, keep: true };
      this.board.add(gl);
    }

    // pièces
    puzzle.cells.forEach((cellDef, i) => this.buildCell(cellDef, i));

    // symboles : ▲ rouge, ■ vert, ● bleu, posés près de chaque élément coloré
    this.symbols.visible = false;
    this.board.add(this.symbols);
    puzzle.cells.forEach((cellDef, i) => {
      const col = cellDef.kind === 'target' || cellDef.kind === 'source' || cellDef.kind === 'filter' ? cellDef.color : 0;
      if (!col) return;
      const p = this.cellPos(i);
      const prims = [RED, GREEN, BLUE].filter((b) => col & b);
      prims.forEach((b, n) => {
        const segs = b === RED ? 3 : b === GREEN ? 4 : 16;
        const m = new THREE.Mesh(new THREE.CircleGeometry(c * 0.11, segs, b === GREEN ? Math.PI / 4 : Math.PI / 2), SYMBOL_MAT);
        m.rotation.x = -Math.PI / 2;
        m.position.set(p.x - c * 0.3 + n * c * 0.22, 0.032, p.z + c * 0.36);
        this.symbols.add(m);
      });
    });

    // rayons
    const beamGeo = new THREE.BoxGeometry(1, 1, 1);
    const beamMat = new THREE.MeshBasicMaterial({ toneMapped: false });
    this.beams = new THREE.InstancedMesh(beamGeo, beamMat, w * h * 4);
    this.beams.count = 0;
    this.beams.frustumCulled = false;
    this.board.add(this.beams);
    // halo : version large, additive et transparente des rayons
    const haloMat = new THREE.MeshBasicMaterial({
      toneMapped: false, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.halos = new THREE.InstancedMesh(beamGeo, haloMat, w * h * 4);
    this.halos.count = 0;
    this.halos.frustumCulled = false;
    this.halos.renderOrder = 2;
    this.board.add(this.halos);

    // survol
    this.hintRing = new THREE.Mesh(new THREE.TorusGeometry(c * 0.48, c * 0.05, 4, 32), this.hintMat);
    this.hintRing.rotation.x = Math.PI / 2;
    this.hintRing.visible = false;
    this.board.add(this.hintRing);
    this.hover = new THREE.Mesh(new THREE.TorusGeometry(c * 0.44, c * 0.035, 4, 24), MAT.hover);
    this.hover.rotation.x = Math.PI / 2;
    this.hover.visible = false;
    this.board.add(this.hover);

    // objets en cubes (zone finale)
    puzzle.objects.forEach((o, j) => {
      const k = puzzle.interactive.length + j;
      const center = this.cellPos((o.ay + 1) * w + o.ax + 1);
      const baseMat = new THREE.MeshStandardMaterial({ color: '#c9a45c', roughness: 0.35, metalness: 0.7, emissive: '#000000' });
      if (o.axis === 'y') {
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(c * 1.5, c * 1.52, c * 0.05, 32), baseMat);
        disc.position.copy(center);
        disc.position.y = c * 0.02;
        disc.userData.static = true;
        this.board.add(disc);
      } else {
        for (const s of [-1, 1]) {
          const arc = new THREE.Mesh(new THREE.TorusGeometry(c * 1.5, c * 0.05, 6, 24, Math.PI), baseMat);
          arc.rotation.y = Math.PI / 2;
          arc.position.set(center.x + s * c * 1.55, c * 1.5, center.z);
          arc.rotation.z = Math.PI;
          arc.userData.static = true;
          this.board.add(arc);
        }
      }
      const pivot = new THREE.Group();
      pivot.position.set(center.x, c * 1.5 + 0.004, center.z);
      const mat = new THREE.MeshStandardMaterial({ color: ['#c96f5a', '#7fa36a', '#6b86b5'][j % 3]!, roughness: 0.6, flatShading: true, emissive: '#000000' });
      const cube = new THREE.BoxGeometry(c * 0.94, c * 0.94, c * 0.94);
      const cubes = o.shape.map(([x, y, z]) => {
        const m = new THREE.Mesh(cube, mat);
        m.position.set((x - 1) * c, (y - 1) * c, (z - 1) * c);
        pivot.add(m);
        return m;
      });
      const body = mergeMeshes(cubes, pivot, mat);
      body.castShadow = true;
      this.board.add(pivot);
      // avec des manivelles, on agit sur les roues, pas sur les objets ; sinon on vise l'objet par
      // ses cubes visibles (une grande boîte invisible masquait les pièces voisines, comme une lame)
      if (!puzzle.cranks) {
        body.userData = { panel: this, k, aim: cubes[0]!.position.clone() };
        this.pickables.push(body);
      }
      const t = this.state[k]!;
      pivot.rotation.copy(objectEuler(o.axis, t));
      this.objs.push({ k, pivot, axis: o.axis, current: t, target: t, base: baseMat, paint: mat });
    });

    if (puzzle.cranks) this.buildCranks(puzzle.cranks, bw, bh, fw);

    // fusion des éléments fixes (un appel de dessin par matériau)
    mergeStatic(this.board);

    // réserve de miroirs (jetons sur le bord proche)
    for (let t = 0; t < puzzle.inventory; t++) {
      const tok = new THREE.Mesh(new THREE.BoxGeometry(c * 0.6, 0.02, c * 0.16), MAT.mirror);
      tok.position.set(-bw / 2 + c * 0.4 + t * c * 0.75, 0.09, bh / 2 + fw / 2);
      this.board.add(tok);
      this.tokens.push(tok);
    }

    this.setPowered(false);
  }

  /**
   * Manivelles couplées : des roues à plat sur un rebord, au bord proche du panneau. Chaque roue a
   * son métal ; des pastilles du même métal sont incrustées dans les supports qu'elle entraîne.
   */
  private buildCranks(cranks: number[][], bw: number, bh: number, fw: number): void {
    const c = this.cell;
    const R = c * 0.42;
    const z = bh / 2 + fw + R * 1.35;
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(bw + fw * 2, 0.08, R * 2.7), MAT.frame);
    ledge.position.set(0, -0.01, z);
    ledge.castShadow = true;
    ledge.userData = { static: true, keep: true };
    this.board.add(ledge);
    const inlays = new Map<number, number>(); // objet → pastilles déjà posées
    const n = this.puzzle.interactive.length;
    cranks.forEach((objs, ci) => {
      const mat = new THREE.MeshStandardMaterial({ color: CRANK_METALS[ci % CRANK_METALS.length]!, roughness: 0.3, metalness: 0.75, emissive: '#000000' });
      const x = ((ci + 0.5) / cranks.length - 0.5) * bw;
      const wheel = new THREE.Group();
      wheel.position.set(x, 0.05, z);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.13, 6, 20), mat);
      rim.rotation.x = Math.PI / 2;
      wheel.add(rim);
      for (const a of [0, Math.PI / 2]) {
        const spoke = new THREE.Mesh(new THREE.BoxGeometry(R * 2, R * 0.12, R * 0.15), mat);
        spoke.rotation.y = a;
        wheel.add(spoke);
      }
      const knob = new THREE.Mesh(new THREE.CylinderGeometry(R * 0.16, R * 0.16, R * 0.7, 8), mat);
      knob.position.set(R, R * 0.35, 0);
      wheel.add(knob);
      this.board.add(wheel);
      const pick = new THREE.Mesh(new THREE.BoxGeometry(R * 2.5, R * 1.6, R * 2.5), MAT.pick);
      pick.position.copy(wheel.position);
      pick.userData = { panel: this, k: n + ci };
      this.board.add(pick);
      this.pickables.push(pick);
      this.cranks.push({ wheel, mat, current: 0, target: 0 });
      for (const j of objs) {
        const o = this.puzzle.objects[j]!;
        const m = inlays.get(j) ?? 0;
        inlays.set(j, m + 1);
        const center = this.cellPos((o.ay + 1) * this.puzzle.width + o.ax + 1);
        const inlay = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.17, c * 0.17, c * 0.03, 12), mat);
        if (o.axis === 'y') {
          const a = Math.PI / 2 + (m - 0.5) * 0.5; // sur le bord proche du plateau
          inlay.position.set(center.x + Math.cos(a) * c * 1.3, c * 0.05, center.z + Math.sin(a) * c * 1.3);
        } else {
          inlay.position.set(center.x + c * 1.55, c * 0.03, center.z + c * 0.9 + m * c * 0.4);
        }
        inlay.userData.static = true;
        this.board.add(inlay);
      }
    });
  }

  /** Objets entraînés par un levier (aucun pour une case). */
  private leverObjects(k: number | null): number[] {
    const n = this.puzzle.interactive.length;
    if (k === null || k < n) return [];
    return objectLevers(this.puzzle)[k - n] ?? [];
  }

  private cellPos(i: number): THREE.Vector3 {
    const { width: w, height: h } = this.puzzle;
    const x = i % w;
    const y = Math.floor(i / w);
    return new THREE.Vector3((x + 0.5 - w / 2) * this.cell, 0.03, (y + 0.5 - h / 2) * this.cell);
  }

  private buildCell(def: Cell, i: number): void {
    const c = this.cell;
    const p = this.cellPos(i);
    const k = this.puzzle.interactive.indexOf(i);
    const add = (o: THREE.Object3D, dynamic = false) => {
      o.position.add(p);
      o.traverse((m) => {
        if (m instanceof THREE.Mesh) {
          m.castShadow = def.kind === 'wall' || def.kind === 'source';
          m.userData.static = !dynamic;
        }
      });
      this.board.add(o);
      return o;
    };
    const plateFor = (glass: boolean) => {
      const plate = new THREE.Mesh(new THREE.BoxGeometry(c * 0.92, c * 0.42, c * 0.07), glass ? MAT.glass : MAT.mirror);
      plate.position.y = c * 0.25;
      const holder = new THREE.Group();
      holder.add(plate);
      return holder;
    };
    const angleFor = (o: number) => (o === 0 ? Math.PI / 4 : -Math.PI / 4);

    switch (def.kind) {
      case 'wall': {
        const b = new THREE.Mesh(new THREE.BoxGeometry(c * 0.86, c * 0.5, c * 0.86), MAT.wall);
        b.position.y = c * 0.25;
        add(b);
        break;
      }
      case 'source': {
        const g = new THREE.Group();
        const body = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.3, c * 0.36, c * 0.5, 8), MAT.bronze);
        body.position.y = c * 0.25;
        g.add(body);
        const col = displayColor(def.color);
        const lensMat = new THREE.MeshBasicMaterial({ color: col.clone(), toneMapped: false });
        const lens = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.14, c * 0.14, c * 0.12, 12), lensMat);
        lens.rotation.z = Math.PI / 2;
        lens.position.set(c * 0.33, c * 0.28, 0);
        const holder = new THREE.Group();
        holder.add(lens);
        // direction : 0 = nord (-z), 1 = est (+x), 2 = sud (+z), 3 = ouest (-x)
        holder.rotation.y = [Math.PI / 2, 0, -Math.PI / 2, Math.PI][def.dir]!;
        g.add(holder);
        const cap = new THREE.Mesh(new THREE.ConeGeometry(c * 0.32, c * 0.2, 8), MAT.bronze);
        cap.position.y = c * 0.6;
        g.add(cap);
        this.sourceLenses.push({ mat: lensMat, color: col });
        add(g);
        break;
      }
      case 'mirror':
      case 'splitter': {
        const glass = def.kind === 'splitter';
        const base = new THREE.Mesh(
          def.fixed ? new THREE.BoxGeometry(c * 0.7, c * 0.06, c * 0.7) : new THREE.CylinderGeometry(c * 0.4, c * 0.42, c * 0.06, 20),
          def.fixed ? MAT.darkBase : MAT.brass,
        );
        base.position.y = c * 0.03;
        add(base);
        const holder = plateFor(glass);
        holder.rotation.y = angleFor(def.fixed ? def.orient : this.state[k]!);
        add(holder, true);
        if (!def.fixed) this.addPiece(k, i, def, holder);
        break;
      }
      case 'socket': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(c * 0.34, c * 0.04, 6, 24), MAT.brass);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = c * 0.03;
        add(ring);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.3, c * 0.3, c * 0.02, 20), MAT.socket);
        disc.position.y = c * 0.02;
        add(disc);
        const holder = plateFor(false);
        holder.visible = false;
        add(holder, true);
        this.addPiece(k, i, def, holder);
        break;
      }
      case 'target':
      case 'dark': {
        const wanted = def.kind === 'target' ? def.color : 0;
        const ringMat = new THREE.MeshBasicMaterial({
          color: def.kind === 'target' ? displayColor(wanted).multiplyScalar(0.55) : new THREE.Color('#2a1f3a'),
        });
        const ring = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.36, c * 0.4, c * 0.05, 6), ringMat);
        ring.position.y = c * 0.025;
        add(ring);
        const mat = def.kind === 'target'
          ? new THREE.MeshStandardMaterial({
              color: displayColor(wanted).lerp(new THREE.Color('#ffffff'), 0.35),
              roughness: 0.2, metalness: 0.1, flatShading: true, emissive: '#000000',
            })
          : MAT.obsidian.clone();
        const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(c * 0.24, 0), mat);
        mesh.scale.y = 1.45;
        mesh.position.y = c * 0.4;
        add(mesh, true);
        const glow = new THREE.Sprite(new THREE.SpriteMaterial({
          map: getGlowTexture(), color: displayColor(wanted || RED), blending: THREE.AdditiveBlending,
          depthWrite: false, transparent: true, opacity: 0, toneMapped: false,
        }));
        glow.scale.setScalar(c * 1.8);
        glow.position.y = c * 0.4;
        add(glow);
        this.crystals.push({ index: i, mesh, mat, glow, wanted });
        break;
      }
      case 'filter': {
        const col = displayColor(def.color);
        const mat = new THREE.MeshStandardMaterial({
          color: col, transparent: true, opacity: 0.55, roughness: 0.1, metalness: 0.2,
          emissive: col.clone().multiplyScalar(0.25),
        });
        const cube = new THREE.Mesh(new THREE.BoxGeometry(c * 0.6, c * 0.5, c * 0.6), mat);
        cube.position.y = c * 0.27;
        add(cube);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(new THREE.BoxGeometry(c * 0.62, c * 0.52, c * 0.62)),
          new THREE.LineBasicMaterial({ color: '#4a4f57' }),
        );
        edges.position.y = c * 0.27;
        add(edges);
        break;
      }
      case 'prism': {
        const mat = new THREE.MeshPhysicalMaterial({
          color: '#ffffff', transparent: true, opacity: 0.7, roughness: 0.05, metalness: 0.1,
          iridescence: 1, iridescenceIOR: 1.6, flatShading: true,
        });
        const prism = new THREE.Mesh(new THREE.CylinderGeometry(c * 0.36, c * 0.36, c * 0.5, 3), mat);
        prism.position.y = c * 0.27;
        add(prism);
        break;
      }
      case 'empty':
        break;
    }
  }

  private addPiece(k: number, cellIndex: number, cell: Cell, plate: THREE.Object3D): void {
    const c = this.cell;
    const pick = new THREE.Mesh(new THREE.BoxGeometry(c, c * 0.7, c), MAT.pick);
    pick.position.copy(this.cellPos(cellIndex));
    pick.position.y = c * 0.3;
    pick.userData = { panel: this, k };
    this.board.add(pick);
    this.pickables.push(pick);
    this.pieces.push({ k, cellIndex, cell, plate, targetAngle: plate.rotation.y, pick });
  }

  setSymbols(on: boolean): void {
    this.symbolsOn = on;
    this.symbols.visible = on && this.detailShown;
  }

  /** Masque les pièces des panneaux éloignés (performances). */
  /** Niveau de détail : 0 = plateau masqué (très loin), 1 = plateau, cadre et rayons, 2 = tout. */
  setLevel(level: 0 | 1 | 2): void {
    this.board.visible = level > 0;
    if (level > 0) this.setDetail(level === 2);
  }

  /** Masque les pièces au loin ; le plateau, le cadre et les rayons restent. */
  setDetail(visible: boolean): void {
    if (this.detailShown === visible) return;
    this.detailShown = visible;
    for (const o of this.board.children) {
      if (o === this.boardMesh || o === this.beams || o === this.halos || o.userData.keep) continue;
      o.visible = visible;
    }
    if (visible) {
      // restaurer les visibilités qui dépendent de l'état
      this.hover.visible = false;
      this.hintRing.visible = this.hintK !== null;
      this.symbols.visible = this.symbolsOn;
      this.applyState(this.state, true);
    }
  }
  private detailShown = true;
  private symbolsOn = false;

  setPowered(on: boolean): void {
    this.powered = on;
    this.boardMesh.material = on
      ? [MAT.board, MAT.board, this.boardMat, MAT.board, MAT.board, MAT.board]
      : [MAT.boardOff, MAT.boardOff, MAT.boardOff, MAT.boardOff, MAT.boardOff, MAT.boardOff];
    this.refresh();
  }

  setHover(k: number | null): void {
    this.hoverK = k;
    const on = this.powered && !this.solved;
    const driven = this.leverObjects(k);
    this.objs.forEach((o, j) => {
      o.base.emissive.set(on && driven.includes(j) ? '#6b5320' : '#000000');
      // l'objet lui-même s'éclaire : on voit d'un coup d'œil ce que la roue entraîne
      o.paint.emissive.set(on && driven.includes(j) ? '#4a3a18' : '#000000');
    });
    const n = this.puzzle.interactive.length;
    this.cranks.forEach((cr, ci) => cr.mat.emissive.set(on && k === n + ci ? '#6b5320' : '#000000'));
    if (k === null || !this.powered || this.solved) {
      this.hover.visible = false;
      return;
    }
    const piece = this.pieces.find((p) => p.k === k);
    if (!piece) {
      this.hover.visible = false;
      return;
    }
    if (!piece) return;
    this.hover.visible = true;
    this.hover.position.copy(this.cellPos(piece.cellIndex));
    this.hover.position.y = this.cell * 0.08;
  }

  goalPoints(): { pos: THREE.Vector3; r: number }[] {
    if (!this.sim) return [];
    const bad = new Set(this.sim.crystals.filter((c) => !c.ok).map((c) => c.index));
    return this.crystals.filter((c) => bad.has(c.index)).map((c) => ringAround(c.mesh, 1.6));
  }

  hint(): number | null {
    if (!this.powered || this.solved) return null;
    const move = leverHintMove(this.puzzle, this.state, solve(this.puzzle, { keep: 300 }).solutions);
    const k = move?.k ?? null;
    this.hintK = k;
    this.hintRev = move?.reverse ?? false;
    const piece = k === null ? undefined : this.pieces.find((p) => p.k === k);
    this.hintRing.visible = !!piece;
    if (piece) {
      this.hintRing.position.copy(this.cellPos(piece.cellIndex));
      this.hintRing.position.y = this.cell * 0.1;
    }
    return k;
  }

  private hintRev = false;

  activeHint(): { k: number; reverse: boolean } | null {
    return this.hintK !== null && this.powered && !this.solved ? { k: this.hintK, reverse: this.hintRev } : null;
  }

  /** Action du joueur. */
  interact(k: number, reverse = false): InteractResult {
    if (!this.powered || this.solved) return 'locked';
    this.hintK = null;
    this.hintRing.visible = false;
    this.setHover(this.hoverK); // efface la lueur d'aide des supports et des roues
    const next = interact(this.puzzle, this.state, k, reverse);
    if (!next) return 'denied';
    const crank = this.cranks[k - this.puzzle.interactive.length];
    if (crank) crank.target += reverse ? -1 : 1;
    this.applyState(next);
    return 'ok';
  }

  applyState(s: LightState, instant = false): void {
    this.state = isValidState(this.puzzle, s) ? s.slice() : initialState(this.puzzle);
    for (const piece of this.pieces) {
      const v = this.state[piece.k]!;
      if (piece.cell.kind === 'socket') {
        piece.plate!.visible = v >= 0;
      }
      if (v >= 0) piece.targetAngle = v === 0 ? Math.PI / 4 : -Math.PI / 4;
      if (instant && piece.plate) piece.plate.rotation.y = piece.targetAngle;
    }
    for (const o of this.objs) {
      const v = this.state[o.k]!;
      // tourner par le plus court chemin (cible continue, sans à-coup de 3 → 0)
      let d = (v - (((o.target % 4) + 4) % 4) + 4) % 4;
      if (d === 3) d = -1;
      o.target += d;
      if (instant) o.current = o.target;
      o.pivot.rotation.copy(objectEuler(o.axis, o.current));
    }
    const used = piecesUsed(this.puzzle, this.state);
    this.tokens.forEach((t, i) => (t.visible = i < this.puzzle.inventory - used));
    this.refresh();
  }

  /** Marque comme résolu sans animation (chargement d'une sauvegarde). */
  markSolved(): void {
    this.solved = true;
    this.solvedAt = -100;
    this.refresh();
  }

  private refresh(): void {
    const c = this.cell;
    for (const l of this.sourceLenses) {
      l.mat.color.copy(l.color).multiplyScalar(this.powered ? 1 : 0.15);
    }
    if (!this.powered) {
      this.beams.count = 0;
      this.halos.count = 0;
      this.sim = null;
      for (const cr of this.crystals) {
        cr.mat.emissive.setRGB(0, 0, 0);
        (cr.glow.material as THREE.SpriteMaterial).opacity = 0;
      }
      return;
    }
    const sim = simulate(this.puzzle, this.state);
    this.sim = sim;
    // rayons
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const yAxis = new THREE.Vector3(0, 1, 0);
    const th = Math.max(0.012, c * 0.055);
    let n = 0;
    const col = new THREE.Color();
    for (let i = 0; i < this.puzzle.cells.length; i++) {
      const center = this.cellPos(i);
      for (let d = 0; d < 4; d++) {
        const v = sim.halfEdges[i * 4 + d]!;
        if (!v) continue;
        const dx = [0, 1, 0, -1][d]!;
        const dz = [-1, 0, 1, 0][d]!;
        const len = c / 2 + th / 2;
        const pos = new THREE.Vector3(center.x + (dx * c) / 4, c * 0.25, center.z + (dz * c) / 4);
        q.setFromAxisAngle(yAxis, dx !== 0 ? 0 : Math.PI / 2);
        m.compose(pos, q, new THREE.Vector3(len, th, th));
        this.beams.setMatrixAt(n, m);
        // cœur presque blanc teinté, halo de la couleur pure
        this.beams.setColorAt(n, col.copy(displayColor(v)).lerp(WHITE_HOT, 0.45));
        m.compose(pos, q, new THREE.Vector3(c / 2, th * 4, th * 4));
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

    // cristaux qui viennent de s'allumer (pas au premier affichage)
    const lit = new Set(sim.crystals.filter((cr) => cr.ok && cr.wanted).map((cr) => cr.index));
    if (this.crystalsReady) for (const cr of sim.crystals) if (cr.wanted && cr.ok && !this.litCrystals.has(cr.index)) this.onCrystal?.(cr.wanted);
    this.litCrystals = lit;
    this.crystalsReady = true;
    if (sim.solved && !this.solved) {
      this.solved = true;
      this.solvedAt = this.time;
      this.hover.visible = false;
      this.onSolved?.();
    }
  }

  /** Animation (appelée à chaque image). */
  update(dt: number, time: number): void {
    this.time = time;
    if (this.hintK !== null && !this.solved) {
      const p = hintPulse(time);
      this.hintMat.opacity = 0.35 + 0.65 * p;
      this.hintRing.scale.setScalar(1 + 0.12 * p);
      if (this.hintK !== this.hoverK) {
        const driven = this.leverObjects(this.hintK);
        this.objs.forEach((o, j) => {
          if (!driven.includes(j)) return;
          o.base.emissive.set('#2a8fb0').multiplyScalar(p);
          o.paint.emissive.set('#2a8fb0').multiplyScalar(0.35 * p);
        });
        this.cranks[this.hintK - this.puzzle.interactive.length]?.mat.emissive.set('#2a8fb0').multiplyScalar(p);
      }
    } else if (this.hintRing.visible) this.hintRing.visible = false;
    for (const cr of this.cranks) {
      if (cr.current === cr.target) continue;
      const d = cr.target - cr.current;
      cr.current += Math.sign(d) * Math.min(Math.abs(d), dt * 5);
      cr.wheel.rotation.y = -cr.current * (Math.PI / 2);
    }
    for (const o of this.objs) {
      if (o.current === o.target) continue;
      const d = o.target - o.current;
      o.current += Math.sign(d) * Math.min(Math.abs(d), dt * 5);
      o.pivot.rotation.copy(objectEuler(o.axis, o.current));
    }
    for (const p of this.pieces) {
      if (!p.plate) continue;
      const d = p.targetAngle - p.plate.rotation.y;
      p.plate.rotation.y += Math.abs(d) < 0.001 ? d : d * Math.min(1, dt * 18);
    }
    if (!this.sim) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 5);
    for (const cr of this.crystals) {
      const got = this.sim.received[cr.index]!;
      const gm = cr.glow.material as THREE.SpriteMaterial;
      if (cr.wanted === 0) {
        // cristal noir : menaçant s'il est touché
        if (got) {
          cr.mat.emissive.copy(displayColor(got)).multiplyScalar(0.25 + 0.35 * pulse);
          gm.color.set('#8a3cff');
          gm.opacity = 0.35 + 0.3 * pulse;
        } else {
          cr.mat.emissive.setRGB(0, 0, 0);
          gm.opacity = 0;
        }
      } else if (got === cr.wanted) {
        cr.mat.emissive.copy(displayColor(cr.wanted)).multiplyScalar(1.1);
        gm.color.copy(displayColor(cr.wanted));
        gm.opacity = 0.9;
      } else if (got) {
        cr.mat.emissive.copy(displayColor(got)).multiplyScalar(0.35);
        gm.color.copy(displayColor(got));
        gm.opacity = 0.25;
      } else {
        cr.mat.emissive.setRGB(0, 0, 0);
        gm.opacity = 0;
      }
      cr.mesh.rotation.y += dt * (got === cr.wanted && cr.wanted ? 1.5 : 0.2);
    }
    // liseré du cadre quand résolu
    if (this.solved) {
      const t = Math.min(1, (time - this.solvedAt) / 0.6);
      const flash = this.solvedAt < 0 ? 0 : Math.max(0, 1 - (time - this.solvedAt) / 1.5);
      this.frameGlowMat.color.set('#4a4236').lerp(new THREE.Color('#ffc23d').lerp(new THREE.Color('#ffffff'), flash), t);
    }
  }
}
