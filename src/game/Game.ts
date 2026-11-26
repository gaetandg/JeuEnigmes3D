import * as THREE from 'three';
import { parsePuzzle } from '../core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../puzzles/zone1.ts';
import { CADRAN, FINAL_PANELS, SHADOW_PANELS, FOLD_PANELS, GATES, GRAND_PLI, LIGHTHOUSE, PANELS, START, TOWERS, standPoint, towerCell } from '../world/layout.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../puzzles/zone2.ts';
import { parseFold } from '../core/fold/index.ts';
import { FoldView } from '../render/foldView.ts';
import { buildAtelier } from '../world/atelier.ts';
import { buildCloitre } from '../world/cloitre.ts';
import { ZONE3, ZONE3_CADRAN } from '../puzzles/zone3.ts';
import { parseShadow, startState } from '../core/shadow/index.ts';
import { ShadowView } from '../render/shadowView.ts';
import { ZONE4_FOLD, ZONE4_LIGHT } from '../puzzles/zone4.ts';
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

/** Qui alimente quoi : panneaux + énigmes d'environnement. */
const POWER: { id: string; requires: string[] }[] = [...PANELS, TOWERS, ...FOLD_PANELS, GRAND_PLI, ...SHADOW_PANELS, CADRAN, ...FINAL_PANELS];

/** Les énigmes qui donnent chacune un quart de lumière au phare. */
const BEACON_STEPS = ['tours', 'grand-pli', 'cadran', 'f5'];

/** Liens dessinés au sol (câbles lumineux). */
function cableLinks(): { from: string; ax: number; az: number; bx: number; bz: number }[] {
  const towerSrc = towerCell(0, 2);
  const towerCrystal = towerCell(3, 0);
  const outPos = new Map<string, { x: number; z: number }>([
    ...PANELS.map((p) => [p.id, p] as const),
    ...FOLD_PANELS.map((p) => [p.id, p] as const),
    ...SHADOW_PANELS.map((p) => [p.id, p] as const),
    ...FINAL_PANELS.map((p) => [p.id, p] as const),
    [TOWERS.id, towerCrystal],
    [GRAND_PLI.id, GRAND_PLI],
    [CADRAN.id, CADRAN],
  ]);
  const inPos = new Map<string, { x: number; z: number }>([
    ...outPos,
    [TOWERS.id, { x: towerSrc.x + 1.5, z: towerSrc.z }],
  ]);
  const links: { from: string; ax: number; az: number; bx: number; bz: number }[] = [];
  const targets: { id: string; requires: string[]; pos: { x: number; z: number } | undefined }[] = [
    ...POWER.map((p) => ({ id: p.id, requires: p.requires, pos: inPos.get(p.id) })),
    ...GATES.map((g) => ({ id: g.id, requires: g.requires, pos: { x: g.x, z: g.z } })),
  ];
  for (const t of targets) {
    const to = t.pos;
    for (const r of t.requires) {
      const from = outPos.get(r);
      if (from && to) links.push({ from: r, ax: from.x, az: from.z, bx: to.x, bz: to.z });
    }
  }
  return links;
}

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
  readonly cables = new Cables(cableLinks());
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
  /** rais de lumière vers le phare, un par zone terminée */
  private shafts: { id: string; mesh: THREE.Mesh; on: number }[] = [];
  private atelierUpdate: (t: number) => void = () => undefined;
  private beacon: THREE.Group;
  /** la partie est terminée (phare rallumé) */
  ended = false;
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

    // zone 2 : l'Atelier de Papier
    const atelier = buildAtelier(this.colliders);
    this.atelierUpdate = atelier.update;
    this.scene.add(atelier.group);
    for (const spot of FOLD_PANELS) {
      const def = ZONE2.find((d) => d.id === spot.id)!;
      const view = new FoldView(parseFold(def), { x: spot.x, z: spot.z, yaw: spot.yaw, cell: 0.36, kind: 'desk' });
      this.addFoldView(view);
      this.colliders.addCircle(spot.x, spot.z, 0.45);
    }
    const grand = new FoldView(parseFold(ZONE2_GRAND_PLI), { x: GRAND_PLI.x, z: GRAND_PLI.z, yaw: GRAND_PLI.yaw, cell: GRAND_PLI.cell, kind: 'easel' });
    this.addFoldView(grand);
    {
      // le chevalet ne se traverse pas
      const hw = (grand.puzzle.width * GRAND_PLI.cell) / 2 + 1;
      const depth = (grand.puzzle.height * GRAND_PLI.cell * Math.cos(1.05)) / 2 + 0.8;
      const { x, z } = GRAND_PLI;
      for (const [ax, az, bx, bz] of [[x - hw, z - depth, x + hw, z - depth], [x + hw, z - depth, x + hw, z + depth], [x + hw, z + depth, x - hw, z + depth], [x - hw, z + depth, x - hw, z - depth]] as const) {
        this.colliders.addSegment({ ax, az, bx, bz, r: 0.3 });
      }
    }

    // zone 3 : le Cloître des Ombres
    this.scene.add(buildCloitre(this.colliders));
    for (const spot of SHADOW_PANELS) {
      const def = ZONE3.find((d) => d.id === spot.id)!;
      const view = new ShadowView(parseShadow(def), { x: spot.x, z: spot.z, yaw: spot.yaw, voxel: 0.2, stageY: 0.8 }, startState(def));
      this.addShadowView(view);
      this.colliders.addCircle(spot.x, spot.z, 0.75);
    }
    {
      const cad = new ShadowView(parseShadow(ZONE3_CADRAN), { x: CADRAN.x, z: CADRAN.z, yaw: CADRAN.yaw, voxel: CADRAN.voxel, stageY: 0.5 }, startState(ZONE3_CADRAN));
      this.addShadowView(cad);
      const hw = (cad.puzzle.width * CADRAN.voxel) / 2 + 1;
      const hd = (cad.puzzle.depth * CADRAN.voxel) / 2 + 1;
      const { x, z } = CADRAN;
      for (const [ax, az, bx, bz] of [[x - hw, z - hd, x + hw, z - hd], [x + hw, z - hd, x + hw, z + hd], [x + hw, z + hd, x - hw, z + hd], [x - hw, z + hd, x - hw, z - hd]] as const) {
        this.colliders.addSegment({ ax, az, bx, bz, r: 0.3 });
      }
    }

    // zone 4 : le pied du phare
    for (const spot of FINAL_PANELS) {
      if (spot.kind === 'light') {
        const def = ZONE4_LIGHT.find((d) => d.id === spot.id)!;
        const panel = new LightPanel(parsePuzzle(def), spot);
        panel.onSolved = () => this.onPanelSolved(panel);
        this.panels.set(spot.id, panel);
        this.scene.add(panel.group);
      } else {
        const def = ZONE4_FOLD.find((d) => d.id === spot.id)!;
        this.addFoldView(new FoldView(parseFold(def), { x: spot.x, z: spot.z, yaw: spot.yaw, cell: 0.34, kind: 'desk' }));
      }
      this.colliders.addCircle(spot.x, spot.z, 0.45);
    }
    // faisceau tournant du phare (fin du jeu)
    this.beacon = new THREE.Group();
    this.beacon.position.set(LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 28.6, LIGHTHOUSE.z);
    for (const s of [1, -1]) {
      const cone = new THREE.Mesh(
        new THREE.ConeGeometry(9, 140, 24, 1, true),
        new THREE.MeshBasicMaterial({ color: '#fff4c8', transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false }),
      );
      cone.rotation.z = (s * Math.PI) / 2;
      cone.position.x = s * 70;
      cone.rotation.y = 0;
      this.beacon.add(cone);
    }
    this.beacon.visible = false;
    this.scene.add(this.beacon);

    // rais de lumière jusqu'au phare (visibles une fois chaque zone finie)
    const crystal = towerCell(3, 0);
    this.addShaft(TOWERS.id, new THREE.Vector3(crystal.x, heightAt(crystal.x, crystal.z) + TOWERS.beamY + 0.3, crystal.z), '#ff8de6');
    this.addShaft(CADRAN.id, new THREE.Vector3(CADRAN.x, heightAt(CADRAN.x, CADRAN.z) + 4.5, CADRAN.z), '#8ad7ff');
    this.addShaft(GRAND_PLI.id, new THREE.Vector3(GRAND_PLI.x, heightAt(GRAND_PLI.x, GRAND_PLI.z) + 8.5, GRAND_PLI.z - 2), '#ffd98a');

    this.player = new Player(this.camera, this.colliders);
    this.restore();

    window.addEventListener('resize', () => this.resize());

    if (!opts.test) this.setupInput();
    // en test (rendu logiciel lent) : ombres plus légères
    if (opts.test) this.lights.sun.shadow.mapSize.set(1024, 1024);
  }

  private addShaft(id: string, a: THREE.Vector3, color: string): void {
    const b = new THREE.Vector3(LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 28.6, LIGHTHOUSE.z);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, a.distanceTo(b), 8, 1, true),
      new THREE.MeshBasicMaterial({ color, toneMapped: false, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    mesh.visible = false;
    this.scene.add(mesh);
    this.shafts.push({ id, mesh, on: 0 });
  }

  /** Bilan affiché à la fin. */
  stats(): { solved: number; total: number; minutes: number } {
    return { solved: this.save.solved.length, total: this.panels.size, minutes: Math.round((this.save.playTime ?? 0) / 60) };
  }

  private addShadowView(view: ShadowView): void {
    view.onSolved = () => this.onPanelSolved(view);
    view.onTurn = () => this.audio.click();
    this.panels.set(view.id, view);
    this.scene.add(view.group);
  }

  private addFoldView(view: FoldView): void {
    view.onSolved = () => this.onPanelSolved(view);
    view.onFoldSound = () => this.audio.fold();
    view.onFailSound = () => this.audio.denied();
    this.panels.set(view.id, view);
    this.scene.add(view.group);
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
    // chaque zone terminée donne un quart de lumière au phare ; le dernier panneau l'allume
    const steps = BEACON_STEPS.filter((id) => this.isSolved(id)).length;
    const lamp = this.lighthouseLamp.material as THREE.MeshStandardMaterial;
    lamp.emissive.set('#ffe9b0').multiplyScalar((steps / 4) * (steps === 4 ? 2.5 : 1));
    if (this.isSolved('f5') && !this.ended) {
      this.ended = true;
      this.beacon.visible = true;
      if (!instant) {
        this.audio.finale();
        window.setTimeout(() => this.hud?.showEnding(this.stats()), 4500);
      }
    }
    for (const s of this.shafts) {
      if (this.isSolved(s.id) && !s.mesh.visible) {
        s.mesh.visible = true;
        s.on = instant ? 1 : 0;
      }
    }
  }

  private onPanelSolved(panel: PuzzleView): void {
    const id = panel.id;
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
    this.interactPanel(this.hovered.panel.id, this.hovered.k, reverse);
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
      const small = p instanceof LightPanel || (p instanceof FoldView && p.place.kind === 'desk') || (p instanceof ShadowView && p.place.voxel < 0.5);
      if (!small) {
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
    if (this.beacon.visible) this.beacon.rotation.y += dt * 0.35;
    if (this.input?.locked) this.save.playTime = (this.save.playTime ?? 0) + dt;
    this.atelierUpdate(this.time);
    for (const s of this.shafts) {
      if (!s.mesh.visible) continue;
      s.on = Math.min(1, s.on + dt * 0.4);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * s.on * (0.85 + 0.15 * Math.sin(this.time * 3));
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
    if (id === GRAND_PLI.id) {
      this.player.place(GRAND_PLI.x, GRAND_PLI.z + 10.5, 0, 0.12);
      return;
    }
    if (id === CADRAN.id) {
      this.player.place(CADRAN.x - 7, CADRAN.z + 10, -0.6, -0.1);
      return;
    }
    const fin = FINAL_PANELS.find((p) => p.id === id);
    if (fin) {
      const s = standPoint(fin, fin.kind === 'fold' ? 1.55 : 1.55);
      this.player.place(s.x, s.z, fin.yaw, -0.5);
      return;
    }
    const shadow = SHADOW_PANELS.find((p) => p.id === id);
    if (shadow) {
      // de trois quarts : on voit l'objet et les deux murs
      const yaw = shadow.yaw - 0.4;
      this.player.place(shadow.x + Math.sin(yaw) * 2.3, shadow.z + Math.cos(yaw) * 2.3, yaw, -0.22);
      return;
    }
    const fold = FOLD_PANELS.find((p) => p.id === id);
    if (fold) {
      const s = standPoint(fold, 1.55);
      this.player.place(s.x, s.z, fold.yaw, -0.55);
      return;
    }
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
    const sol = panel.solution();
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
      for (const p of this.panels.values()) p.update(0.05, this.time);
      for (const g of this.gates.values()) {
        if (g.opening && g.open < 1) {
          g.open = Math.min(1, g.open + 0.05 / 2.5);
          g.setOpen(g.open);
        }
      }
    }
  }

  hoveredPiece(): { id: string; k: number } | null {
    return this.hovered ? { id: this.hovered.panel.id, k: this.hovered.k } : null;
  }

  forceUpdatePower(): void {
    this.updatePower(false);
  }

  groundAt(x: number, z: number): number {
    return heightAt(x, z);
  }
}
