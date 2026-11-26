import * as THREE from 'three';
import { parsePuzzle, solve } from '../core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../puzzles/zone1.ts';
import { GATES, LIGHTHOUSE, PANELS, START, TOWERS, standPoint, towerCell } from '../world/layout.ts';
import { buildTerrain, heightAt } from '../world/terrain.ts';
import { buildGates, buildLighthouse, buildPlaza, buildVegetation, buildWalls } from '../world/props.ts';
import type { GateView } from '../world/props.ts';
import { HORIZON, buildLights, buildSky, buildWater } from '../render/environment.ts';
import type { Lights } from '../render/environment.ts';
import { LightPanel } from '../render/panelView.ts';
import { WorldLightPuzzle } from '../render/worldPuzzle.ts';
import type { PuzzleView } from '../render/puzzleView.ts';
import { Cables } from '../render/cables.ts';
import { Colliders } from './colliders.ts';
import { DesktopInput, Player } from './player.ts';
import { Audio } from './audio.ts';
import { clearSave, loadSave, writeSave } from './progress.ts';
import type { SaveData } from './progress.ts';
import { Hud } from '../ui/hud.ts';

const REACH = 5;

/** Qui alimente quoi : panneaux + énigme d'environnement. */
const POWER: { id: string; requires: string[] }[] = [...PANELS, TOWERS];

export interface GameOptions {
  canvas: HTMLCanvasElement;
  ui: HTMLElement;
  /** mode test : pas d'écran titre, pas de verrouillage du pointeur */
  test: boolean;
}

export class Game {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera: THREE.PerspectiveCamera;
  readonly colliders = new Colliders();
  readonly player: Player;
  readonly panels = new Map<string, PuzzleView>();
  readonly gates = new Map<string, GateView & { open: number; opening: boolean }>();
  readonly audio = new Audio();
  readonly cables = new Cables();
  readonly save: SaveData;
  private lights: Lights;
  private water: ReturnType<typeof buildWater>;
  private input: DesktopInput | null = null;
  private hud: Hud | null = null;
  private raycaster = new THREE.Raycaster();
  private hovered: { panel: PuzzleView; k: number } | null = null;
  private timer = new THREE.Timer();
  private time = 0;
  private saveTimer = 0;
  private plazaCrystal: THREE.Mesh;
  readonly lighthouseLamp: THREE.Mesh;
  private shaft: THREE.Mesh;
  private shaftOn = 0;
  frames = 0;
  lastDrawCalls = 0;
  running = false;
  /** caméra imposée (vues d'ensemble des tests) */
  cameraOverride: { pos: THREE.Vector3; target: THREE.Vector3 } | null = null;

  constructor(private opts: GameOptions) {
    const { canvas } = opts;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    // tone mapping « neutre » : garde la saturation des rayons colorés
    this.renderer.toneMapping = THREE.NeutralToneMapping;
    this.renderer.toneMappingExposure = 0.9;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.info.autoReset = false;

    this.camera = new THREE.PerspectiveCamera(70, window.innerWidth / window.innerHeight, 0.05, 1500);
    this.scene.fog = new THREE.Fog(HORIZON, 90, 420);
    this.scene.background = HORIZON.clone();

    // ciel + reflets d'environnement
    const sky = buildSky();
    this.scene.add(sky);
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const envScene = new THREE.Scene();
    envScene.add(buildSky());
    this.scene.environment = pmrem.fromScene(envScene, 0.02).texture;
    this.scene.environmentIntensity = 0.6;

    this.lights = buildLights(this.scene);
    this.water = buildWater();
    this.scene.add(this.water.mesh);
    this.scene.add(buildTerrain());
    this.scene.add(buildVegetation(this.colliders));
    this.scene.add(buildWalls(this.colliders));
    const plaza = buildPlaza(this.colliders);
    this.plazaCrystal = plaza.crystal;
    this.scene.add(plaza.group);
    const lh = buildLighthouse(this.colliders);
    this.lighthouseLamp = lh.lamp;
    this.scene.add(lh.group);
    this.scene.add(this.cables.group);

    this.save = loadSave();
    for (const gv of buildGates(this.colliders, (id) => (this.gates.get(id)?.open ?? 0) > 0.6)) {
      this.gates.set(gv.id, { ...gv, open: 0, opening: false });
      this.scene.add(gv.group);
    }

    // panneaux
    for (const spot of PANELS) {
      const def = ZONE1.find((d) => d.id === spot.id);
      if (!def) throw new Error(`énigme ${spot.id} introuvable`);
      const panel = new LightPanel(parsePuzzle(def), spot);
      panel.onSolved = () => this.onPanelSolved(panel);
      this.panels.set(spot.id, panel);
      this.colliders.addCircle(spot.x, spot.z, 0.45);
      this.scene.add(panel.group);
    }
    const towers = new WorldLightPuzzle(parsePuzzle(ZONE1_TOWERS), this.colliders);
    towers.onSolved = () => this.onPanelSolved(towers);
    this.panels.set(TOWERS.id, towers);
    this.scene.add(towers.group);

    // rai de lumière du cristal des tours jusqu'au phare (visible une fois la zone finie)
    const from = towerCell(3, 0);
    const a = new THREE.Vector3(from.x, heightAt(from.x, from.z) + TOWERS.beamY + 0.3, from.z);
    const b = new THREE.Vector3(LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 28.6, LIGHTHOUSE.z);
    const len = a.distanceTo(b);
    this.shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, len, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: '#ff8de6', toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    this.shaft.position.copy(a).add(b).multiplyScalar(0.5);
    this.shaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.shaft.visible = false;
    this.scene.add(this.shaft);

    this.player = new Player(this.camera, this.colliders);
    this.restore();

    window.addEventListener('resize', () => this.resize());

    if (!opts.test) this.setupInput();
  }

  private setupInput(): void {
    const settings = this.save.settings ?? { volume: 0.7, sensitivity: 0.0022 };
    this.audio.setVolume(settings.volume);
    this.player.sensitivity = settings.sensitivity;
    this.input = new DesktopInput(this.opts.canvas, this.player);
    this.hud = new Hud(this.opts.ui, {
      onStart: () => {
        this.audio.start();
        this.input!.requestLock();
      },
      onVolume: (v) => {
        this.audio.setVolume(v);
        this.save.settings = { ...(this.save.settings ?? settings), volume: v };
        writeSave(this.save);
      },
      onSensitivity: (v) => {
        this.player.sensitivity = v;
        this.save.settings = { ...(this.save.settings ?? settings), sensitivity: v };
        writeSave(this.save);
      },
      onReset: () => this.reset(),
    }, settings, this.save.solved.length > 0);
    this.input.onLockChange = (locked) => {
      if (locked) this.hud!.hideTitle();
      else {
        this.hud!.showTitle(true);
        this.persist();
      }
    };
    this.input.onClick = (button) => this.click(button === 2);
  }

  /** Applique la sauvegarde (ou l'état de départ). */
  private restore(): void {
    const solved = new Set(this.save.solved);
    for (const [id, panel] of this.panels) {
      const st = this.save.states[id];
      if (st && st.length === panel.state.length) panel.applyState(st, true);
      if (solved.has(id)) panel.markSolved();
    }
    this.updatePower(true);
    const p = this.save.player;
    if (p) this.player.place(p.x, p.z, p.yaw);
    else this.player.place(START.x, START.z, START.yaw);
  }

  isSolved(id: string): boolean {
    return this.save.solved.includes(id);
  }

  /** Allume les panneaux et ouvre les portes dont les conditions sont remplies. */
  private updatePower(instant: boolean): void {
    for (const spot of POWER) {
      const panel = this.panels.get(spot.id)!;
      const on = spot.requires.every((r) => this.isSolved(r));
      if (on && !panel.powered) {
        panel.setPowered(true);
        if (!instant) this.audio.power();
      }
    }
    for (const g of GATES) {
      const gv = this.gates.get(g.id)!;
      if (!gv.opening && g.requires.every((r) => this.isSolved(r))) {
        gv.opening = true;
        if (instant) {
          gv.open = 1;
          gv.setOpen(1);
        } else this.audio.rumble();
      }
    }
    for (const id of this.save.solved) this.cables.light(id, instant);
    const allees = ['a5', 'b5', 'c4', 'd5', 'tours'].filter((id) => this.isSolved(id)).length;
    const m = this.plazaCrystal.material as THREE.MeshStandardMaterial;
    m.emissive.set('#ffd98a').multiplyScalar(allees * 0.25);
    // zone 1 terminée : le phare reçoit un premier tiers de lumière
    const zones = this.isSolved('tours') ? 1 : 0;
    const lamp = this.lighthouseLamp.material as THREE.MeshStandardMaterial;
    lamp.emissive.set('#ffe9b0').multiplyScalar(zones / 3);
    if (zones && !this.shaft.visible) {
      this.shaft.visible = true;
      this.shaftOn = instant ? 1 : 0;
    }
  }

  private onPanelSolved(panel: PuzzleView): void {
    const id = panel.puzzle.id;
    if (!this.save.solved.includes(id)) this.save.solved.push(id);
    this.audio.solved();
    // l'ouverture des portes et l'allumage suivent le câble
    window.setTimeout(() => this.updatePower(false), 900);
    this.persist();
  }

  private persist(): void {
    for (const [id, panel] of this.panels) this.save.states[id] = panel.state;
    this.save.player = { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw };
    writeSave(this.save);
  }

  private reset(): void {
    clearSave();
    window.location.reload();
  }

  private click(reverse: boolean): void {
    if (!this.hovered) return;
    this.interactPanel(this.hovered.panel.puzzle.id, this.hovered.k, reverse);
  }

  /** Action sur une pièce (clic du joueur ou test automatisé). */
  interactPanel(id: string, k: number, reverse = false): string {
    const panel = this.panels.get(id);
    if (!panel) return 'locked';
    const r = panel.interact(k, reverse);
    if (r === 'ok') {
      this.audio.click();
      this.save.states[id] = panel.state;
      writeSave(this.save);
    } else if (r === 'denied') this.audio.denied();
    return r;
  }

  /** Oriente le regard du joueur vers une pièce d'un panneau (tests). */
  aimAt(id: string, k: number): void {
    const panel = this.panels.get(id);
    const pick = panel?.pickables.find((p) => p.userData.k === k);
    if (!pick) throw new Error(`pièce ${id}/${k} introuvable`);
    panel!.group.updateMatrixWorld(true);
    const target = pick.getWorldPosition(new THREE.Vector3());
    const d = target.sub(this.player.position);
    const yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.player.place(this.player.position.x, this.player.position.z, yaw, pitch);
  }

  private updateHover(): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    this.raycaster.far = REACH;
    const candidates: THREE.Object3D[] = [];
    for (const p of this.panels.values()) {
      if (!p.powered || p.solved) continue;
      if (p instanceof LightPanel && p.group.position.distanceToSquared(this.camera.position) > 25) continue;
      candidates.push(...p.pickables);
    }
    let hit = candidates.length ? this.raycaster.intersectObjects(candidates, false)[0] : undefined;
    if (hit && hit.distance > (hit.object.userData.panel as PuzzleView).reach) hit = undefined;
    const next = hit ? { panel: hit.object.userData.panel as PuzzleView, k: hit.object.userData.k as number } : null;
    if (this.hovered && (!next || next.panel !== this.hovered.panel || next.k !== this.hovered.k)) {
      this.hovered.panel.setHover(null);
    }
    this.hovered = next;
    if (next) next.panel.setHover(next.k);
    this.hud?.setCrosshairActive(!!next);
  }

  private resize(): void {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  }

  start(): void {
    this.running = true;
    this.renderer.setAnimationLoop(() => this.frame());
  }

  private frame(): void {
    this.timer.update();
    const dt = Math.min(0.05, this.timer.getDelta());
    this.time += dt;
    this.player.update(dt);
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.target);
    }
    this.lights.follow(this.cameraOverride ? this.cameraOverride.target : this.player.position);
    this.water.update(this.time);
    this.cables.update(dt);
    for (const p of this.panels.values()) {
      if (!(p instanceof LightPanel)) {
        p.update(dt, this.time);
        continue;
      }
      const d2 = p.group.position.distanceToSquared(this.camera.position);
      p.setDetail(d2 < 55 * 55);
      if (d2 < 55 * 55) p.update(dt, this.time);
    }
    for (const g of this.gates.values()) {
      if (g.opening && g.open < 1) {
        g.open = Math.min(1, g.open + dt / 2.5);
        g.setOpen(g.open);
      }
    }
    this.plazaCrystal.rotation.y += dt * 0.2;
    if (this.shaft.visible) {
      this.shaftOn = Math.min(1, this.shaftOn + dt * 0.4);
      (this.shaft.material as THREE.MeshBasicMaterial).opacity = 0.55 * this.shaftOn * (0.85 + 0.15 * Math.sin(this.time * 3));
    }
    this.updateHover();
    this.audio.setSeaProximity(1 - Math.min(1, Math.max(0, (this.player.position.y - 2) / 6)));
    this.saveTimer += dt;
    if (this.saveTimer > 5 && this.input?.locked) {
      this.saveTimer = 0;
      this.persist();
    }
    this.renderer.info.reset();
    this.renderer.render(this.scene, this.camera);
    this.lastDrawCalls = this.renderer.info.render.calls;
    this.frames++;
  }

  // ── outils pour les tests automatisés ───────────────────────────────────

  /** Place le joueur devant un panneau. */
  view(id: string): void {
    if (id === TOWERS.id) {
      // belvédère : devant la dernière allée, regard vers les tours
      this.player.place(4, 1, 0, 0.02);
      return;
    }
    const spot = PANELS.find((p) => p.id === id);
    if (!spot) throw new Error(`panneau ${id} inconnu`);
    const s = standPoint(spot, 1.55);
    this.player.place(s.x, s.z, spot.yaw, -0.5);
  }

  /** Résout un panneau avec la solution du solveur (s'il est alimenté). */
  solvePanel(id: string): boolean {
    const panel = this.panels.get(id);
    if (!panel || !panel.powered || panel.solved) return false;
    const sol = solve(panel.puzzle, { keep: 1 }).solutions[0];
    if (!sol) return false;
    panel.applyState(sol);
    return panel.solved;
  }

  /** Avance la simulation sans rendu (pour les tests). */
  advance(seconds: number): void {
    const steps = Math.ceil(seconds / 0.05);
    for (let i = 0; i < steps; i++) {
      this.time += 0.05;
      this.cables.update(0.05);
      for (const g of this.gates.values()) {
        if (g.opening && g.open < 1) {
          g.open = Math.min(1, g.open + 0.05 / 2.5);
          g.setOpen(g.open);
        }
      }
    }
  }

  hoveredPiece(): { id: string; k: number } | null {
    return this.hovered ? { id: this.hovered.panel.puzzle.id, k: this.hovered.k } : null;
  }

  forceUpdatePower(): void {
    this.updatePower(false);
  }

  groundAt(x: number, z: number): number {
    return heightAt(x, z);
  }
}
