import * as THREE from 'three';
import { parsePuzzle } from '../core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../puzzles/zone1.ts';
import { SECRETS, SECRET_PLAGE, SECRET_VOILE_CELL, ATELIER, CLOITRE, PHARE, CADRAN, FINAL_PANELS, SHADOW_PANELS, FOLD_PANELS, GATES, GRAND_PLI, LIGHTHOUSE, PANELS, START, TOWERS, standPoint, towerCell } from '../world/layout.ts';
import { ZONE2, ZONE2_GRAND_PLI } from '../puzzles/zone2.ts';
import { parseFold } from '../core/fold/index.ts';
import { FoldView } from '../render/foldView.ts';
import { buildAtelier } from '../world/atelier.ts';
import { buildCloitre } from '../world/cloitre.ts';
import { buildGardenDecor } from '../world/decor.ts';
import { buildLife } from '../world/life.ts';
import { WIND } from '../render/wind.ts';
import { addPuzzleColliders } from '../world/puzzleColliders.ts';
import { ZONE3, ZONE3_CADRAN } from '../puzzles/zone3.ts';
import { parseShadow, startState } from '../core/shadow/index.ts';
import { ShadowView } from '../render/shadowView.ts';
import { ZONE4_FOLD, ZONE4_LIGHT } from '../puzzles/zone4.ts';
import { buildTerrain, heightAt } from '../world/terrain.ts';
import { buildGates, buildLighthouse, buildPlaza, buildVegetation, buildWalls } from '../world/props.ts';
import type { GateView } from '../world/props.ts';
import { HORIZON, SUN_GLOW, buildLights, buildSky, buildWater } from '../render/environment.ts';
import { applyDaylight, buildStars } from '../render/daylight.ts';
import { Sparks } from '../render/sparks.ts';
import { GuideBeams } from '../render/guides.ts';
import { GamepadInput } from './gamepad.ts';
import { Shards } from '../render/shards.ts';
import { SECRET_FOLD, SECRET_IDS, SECRET_LIGHT, SECRET_SHADOW } from '../puzzles/secrets.ts';
import type { Lights } from '../render/environment.ts';
import { LightPanel } from '../render/panelView.ts';
import { WorldLightPuzzle } from '../render/worldPuzzle.ts';
import type { PuzzleView } from '../render/puzzleView.ts';
import { Cables } from '../render/cables.ts';
import { Colliders } from './colliders.ts';
import { DesktopInput, Player } from './player.ts';
import { TouchInput } from './touch.ts';
import { Audio } from './audio.ts';
import type { Zone } from './audio.ts';
import { clearSave, loadSave, writeSave } from './progress.ts';
import type { Quality, SaveData, Settings } from './progress.ts';
import { Hud } from '../ui/hud.ts';

const REACH = 5;
/** une aide apparaît après ce temps passé près d'une énigme sans la résoudre (s) */
const HINT_DELAY = 180;

/** Qui alimente quoi : panneaux + énigmes d'environnement. */
const POWER: { id: string; requires: string[] }[] = [...PANELS, TOWERS, ...FOLD_PANELS, GRAND_PLI, ...SHADOW_PANELS, CADRAN, ...FINAL_PANELS];

/** Les énigmes qui donnent chacune un quart de lumière au phare. */
/** dernière énigme : elle rallume le phare */
const FINAL_ID = 'f6';
const BEACON_STEPS = ['tours', 'grand-pli', 'cadran', FINAL_ID];

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
  /** le joueur est en jeu (menus fermés) — vrai aussi sur mobile, sans verrouillage du pointeur */
  private playing = false;
  /** aides discrètes : temps passé (s) près de chaque énigme non résolue */
  private stuck = new Map<string, number>();
  private stuckClock = 0;
  hintsOn = true;
  private anchors = new Map<string, THREE.Vector3[]>();
  private plazaCrystal: THREE.Mesh;
  readonly lighthouseLamp: THREE.Mesh;
  /** rais de lumière vers le phare, un par zone terminée */
  private shafts: { id: string; mesh: THREE.Mesh; on: number }[] = [];
  private atelierUpdate: (t: number) => void = () => undefined;
  private decorUpdate: (t: number) => void = () => undefined;
  private lifeUpdate: (t: number, dt: number) => void = () => undefined;
  /** heure du jour : 0 (après-midi) → 4 (crépuscule), suit la progression */
  private day = 0;
  private dayTarget = 0;
  private stars: THREE.Points;
  readonly sparks = new Sparks();
  readonly guides = new GuideBeams();
  guidesOn = true;
  private gamepad: GamepadInput | null = null;
  private shards!: Shards;
  private glintClock = 0;
  private refreshEnv: () => void;
  /** séquence de fin (caméra qui s'élève au-dessus de l'île) */
  private cinematic: { t: number; a0: number } | null = null;
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
    let envRT = pmrem.fromScene(envScene, 0.02);
    this.scene.environment = envRT.texture;
    this.refreshEnv = () => {
      // libérer l'ancienne cible de rendu (sinon chaque crépuscule en laisse une)
      const next = pmrem.fromScene(envScene, 0.02);
      this.scene.environment = next.texture;
      envRT.dispose();
      envRT = next;
    };
    this.stars = buildStars();
    this.scene.add(this.stars);
    this.scene.add(this.sparks.points);
    this.scene.add(this.guides.mesh);
    this.scene.environmentIntensity = 0.6;

    this.lights = buildLights(this.scene);
    const terrain = buildTerrain();
    this.water = buildWater(terrain.shore);
    this.scene.add(this.water.mesh);
    this.scene.add(terrain.mesh);
    this.scene.add(buildVegetation(this.colliders));
    const decor = buildGardenDecor(this.colliders);
    this.decorUpdate = decor.update;
    this.scene.add(decor.group);
    const life = buildLife(decor.beds);
    this.lifeUpdate = life.update;
    this.scene.add(life.group);
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
      panel.onCrystal = (c) => this.audio.crystal(c);
      this.panels.set(spot.id, panel);
      this.scene.add(panel.group);
    }
    addPuzzleColliders(this.colliders);
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
    }
    const grand = new FoldView(parseFold(ZONE2_GRAND_PLI), { x: GRAND_PLI.x, z: GRAND_PLI.z, yaw: GRAND_PLI.yaw, cell: GRAND_PLI.cell, kind: 'easel' });
    this.addFoldView(grand);

    // zone 3 : le Cloître des Ombres
    this.scene.add(buildCloitre(this.colliders));
    for (const spot of SHADOW_PANELS) {
      const def = ZONE3.find((d) => d.id === spot.id)!;
      const view = new ShadowView(parseShadow(def), { x: spot.x, z: spot.z, yaw: spot.yaw, voxel: 0.2, stageY: 0.8 }, startState(def));
      this.addShadowView(view);
    }
    {
      const cad = new ShadowView(parseShadow(ZONE3_CADRAN), { x: CADRAN.x, z: CADRAN.z, yaw: CADRAN.yaw, voxel: CADRAN.voxel, stageY: 0.5 }, startState(ZONE3_CADRAN));
      this.addShadowView(cad);
    }

    // zone 4 : le pied du phare
    for (const spot of FINAL_PANELS) {
      if (spot.kind === 'light') {
        const def = ZONE4_LIGHT.find((d) => d.id === spot.id)!;
        const panel = new LightPanel(parsePuzzle(def), spot);
        panel.onSolved = () => this.onPanelSolved(panel);
        panel.onCrystal = (c) => this.audio.crystal(c);
        this.panels.set(spot.id, panel);
        this.scene.add(panel.group);
      } else {
        const def = ZONE4_FOLD.find((d) => d.id === spot.id)!;
        this.addFoldView(new FoldView(parseFold(def), { x: spot.x, z: spot.z, yaw: spot.yaw, cell: 0.34, kind: 'desk' }));
      }
    }
    // les Éclats : énigmes secrètes, allumées dès le départ, sans câble ni guide
    for (const s of SECRETS) {
      let view: PuzzleView;
      if (s.kind === 'world-light') {
        view = new WorldLightPuzzle(parsePuzzle(SECRET_LIGHT.find((d) => d.id === s.id)!), this.colliders, SECRET_PLAGE);
      } else if (s.kind === 'light') {
        const panel = new LightPanel(parsePuzzle(SECRET_LIGHT.find((d) => d.id === s.id)!), s);
        panel.onCrystal = (c) => this.audio.crystal(c);
        view = panel;
      } else if (s.kind === 'shadow') {
        const def = SECRET_SHADOW.find((d) => d.id === s.id)!;
        const sv = new ShadowView(parseShadow(def), { x: s.x, z: s.z, yaw: s.yaw, voxel: 0.2, stageY: 0.8 }, startState(def));
        sv.onTurn = () => this.audio.click();
        view = sv;
      } else {
        const def = SECRET_FOLD.find((d) => d.id === s.id)!;
        const fv = new FoldView(parseFold(def), s.kind === 'fold-easel'
          ? { x: s.x, z: s.z, yaw: s.yaw, cell: SECRET_VOILE_CELL, kind: 'easel' }
          : { x: s.x, z: s.z, yaw: s.yaw, cell: 0.34, kind: 'desk' });
        fv.onFoldSound = () => this.audio.fold();
        fv.onFailSound = () => this.audio.denied();
        view = fv;
      }
      view.onSolved = () => this.onPanelSolved(view);
      view.setPowered(true);
      this.panels.set(view.id, view);
      this.scene.add(view.group);
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
    this.shards = new Shards(this.beacon.position.clone());
    this.scene.add(this.shards.group);

    // rais de lumière jusqu'au phare (visibles une fois chaque zone finie)
    const crystal = towerCell(3, 0);
    this.addShaft(TOWERS.id, new THREE.Vector3(crystal.x, heightAt(crystal.x, crystal.z) + TOWERS.beamY + 0.3, crystal.z), '#ff8de6');
    this.addShaft(CADRAN.id, new THREE.Vector3(CADRAN.x, heightAt(CADRAN.x, CADRAN.z) + 4.5, CADRAN.z), '#8ad7ff');
    this.addShaft(GRAND_PLI.id, new THREE.Vector3(GRAND_PLI.x, heightAt(GRAND_PLI.x, GRAND_PLI.z) + 8.5, GRAND_PLI.z - 2), '#ffd98a');

    this.player = new Player(this.camera, this.colliders);
    this.player.onStep = () => this.audio.step();
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

  /** Positions de référence d'une énigme (pour savoir si le joueur est devant). */
  private anchorsOf(p: PuzzleView): THREE.Vector3[] {
    let a = this.anchors.get(p.id);
    if (!a) {
      p.group.updateMatrixWorld(true);
      a = p instanceof WorldLightPuzzle ? p.pickables.map((m) => m.getWorldPosition(new THREE.Vector3())) : [p.group.position.clone()];
      this.anchors.set(p.id, a);
    }
    return a;
  }

  /** Aides discrètes : après HINT_DELAY secondes près d'une énigme non résolue, une pièce luit. */
  /** Zone où se trouve le joueur (pour la musique). */
  private zoneAt(x: number, z: number): Zone {
    if (Math.hypot(x - ATELIER.x, z - ATELIER.z) < ATELIER.r + 15) return 'atelier';
    if (Math.abs(x - CLOITRE.x) < CLOITRE.half + 12 && Math.abs(z - CLOITRE.z) < CLOITRE.half + 12) return 'cloitre';
    if (Math.hypot(x - PHARE.x, z - PHARE.z) < PHARE.r + 12) return 'phare';
    return 'jardin';
  }

  private updateGuides(): void {
    const pos = this.player.position;
    const pts: THREE.Vector3[] = [];
    for (const p of this.panels.values()) {
      if (!p.powered || p.solved || SECRET_IDS.includes(p.id)) continue;
      const a = this.anchorsOf(p)[0]!;
      if (Math.hypot(a.x - pos.x, a.z - pos.z) < 9) continue;
      pts.push(new THREE.Vector3(a.x, heightAt(a.x, a.z) + 2.2, a.z));
    }
    this.guides.set(pts);
  }

  private updateStuck(dt: number): void {
    const pos = this.player.position;
    this.audio.setZone(this.zoneAt(pos.x, pos.z));
    this.updateGuides();
    if (!this.hintsOn || !this.playing) return;
    for (const p of this.panels.values()) {
      if (!p.powered || p.solved) continue;
      const near = this.anchorsOf(p).some((a) => Math.hypot(a.x - pos.x, a.z - pos.z) < p.reach + 2.5);
      if (!near) continue;
      const t = (this.stuck.get(p.id) ?? 0) + dt;
      if (t >= HINT_DELAY) {
        p.hint();
        this.stuck.set(p.id, HINT_DELAY - 120); // l'aide suivante, deux minutes plus tard
      } else this.stuck.set(p.id, t);
    }
  }

  private applyDay(): void {
    applyDaylight(this.day, { scene: this.scene, lights: this.lights, renderer: this.renderer, sunGlow: SUN_GLOW, stars: this.stars });
  }

  /** Fait avancer l'heure et la séquence de fin. */
  private updateDay(dt: number): void {
    if (Math.abs(this.day - this.dayTarget) > 1e-3) {
      // une étape prend une dizaine de secondes : on voit le soleil descendre
      this.day += Math.sign(this.dayTarget - this.day) * Math.min(Math.abs(this.dayTarget - this.day), dt * 0.1);
      this.applyDay();
      if (Math.abs(this.day - this.dayTarget) <= 1e-3) this.refreshEnv();
    }
    if (this.cinematic) {
      const c = this.cinematic;
      c.t += dt;
      const k = Math.min(1, c.t / 14);
      const e = k * k * (3 - 2 * k);
      const a = c.a0 + e * Math.PI * 0.9;
      const R = 30 + e * 70;
      const h = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 8 + e * 55;
      this.cameraOverride = {
        pos: new THREE.Vector3(LIGHTHOUSE.x + Math.cos(a) * R, h, LIGHTHOUSE.z + Math.sin(a) * R),
        target: new THREE.Vector3(LIGHTHOUSE.x, heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z) + 22 - e * 18, LIGHTHOUSE.z + e * 40),
      };
      if (c.t >= 14 && !this.hudEndingShown) {
        this.hudEndingShown = true;
        this.playing = false;
        this.hud?.showEnding(this.stats());
      }
    }
  }

  private hudEndingShown = false;

  /** Un scintillement furtif près des secrets non trouvés, quand on passe à proximité. */
  private glintSecrets(): void {
    const pos = this.player.position;
    for (const s of SECRETS) {
      const v = this.panels.get(s.id);
      if (!v || v.solved) continue;
      const a = this.sparkAt(v).at;
      const d = Math.hypot(a.x - pos.x, a.z - pos.z);
      if (d < 35 && d > 6) this.sparks.burst(a, new THREE.Color('#ffffff'), 10, 0.5);
    }
  }

  /** Bilan affiché à la fin. */
  stats(): { solved: number; total: number; minutes: number; shards: number; shardsTotal: number } {
    const main = [...this.panels.keys()].filter((id) => !SECRET_IDS.includes(id));
    return {
      solved: main.filter((id) => this.isSolved(id)).length,
      total: main.length,
      minutes: Math.round((this.save.playTime ?? 0) / 60),
      shards: SECRET_IDS.filter((id) => this.isSolved(id)).length,
      shardsTotal: SECRET_IDS.length,
    };
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
    const touch = TouchInput.supported();
    const settings: Settings = {
      volume: 0.7, sensitivity: 0.0022, quality: touch ? 'basse' : 'haute', symbols: false, hints: true, ...this.save.settings,
    };
    const saveSettings = (patch: Partial<Settings>) => {
      this.save.settings = { ...settings, ...this.save.settings, ...patch };
      writeSave(this.save);
    };
    this.audio.setVolume(settings.volume);
    this.audio.setMusicVolume(settings.music ?? 0.5);
    this.player.sensitivity = settings.sensitivity;
    this.applyQuality(settings.quality ?? 'haute');
    this.setSymbols(!!settings.symbols);
    this.hintsOn = settings.hints !== false;
    this.applyComfort(settings);
    this.input = new DesktopInput(this.opts.canvas, this.player);
    // le joystick est ajouté à l'interface APRÈS sa construction (qui remplace son contenu)
    let touchInput: TouchInput | null = null;
    this.hud = new Hud(this.opts.ui, {
      onStart: () => {
        this.audio.start();
        if (touchInput) {
          touchInput.enabled = true;
          this.playing = true;
          this.hud!.hideTitle();
          document.documentElement.requestFullscreen?.().catch(() => undefined);
        } else this.input!.requestLock();
      },
      onPause: () => {
        if (touchInput) touchInput.enabled = false;
        this.playing = false;
        this.hud!.showTitle(true);
        this.persist();
      },
      onVolume: (v) => {
        this.audio.setVolume(v);
        saveSettings({ volume: v });
      },
      onSensitivity: (v) => {
        this.player.sensitivity = v;
        saveSettings({ sensitivity: v });
      },
      onQuality: (q) => {
        this.applyQuality(q);
        saveSettings({ quality: q });
      },
      onSymbols: (on) => {
        this.setSymbols(on);
        saveSettings({ symbols: on });
      },
      onComfort: (patch) => {
        this.applyComfort(patch);
        saveSettings(patch);
      },
      onMusic: (v) => {
        this.audio.setMusicVolume(v);
        saveSettings({ music: v });
      },
      onHints: (on) => {
        this.hintsOn = on;
        saveSettings({ hints: on });
      },
      onReset: () => this.reset(),
    }, settings, this.save.solved.length > 0, touch);
    if (touch) {
      touchInput = new TouchInput(this.opts.canvas, this.opts.ui, this.player);
      touchInput.onTap = (reverse) => this.click(reverse);
    }
    this.hud.onContinue = () => {
      // fin de la séquence : retour au joueur
      this.cinematic = null;
      this.cameraOverride = null;
      if (touchInput) {
        touchInput.enabled = true;
        this.playing = true;
      } else this.input!.requestLock();
    };
    this.input.onLockChange = (locked) => {
      this.playing = locked;
      if (locked) this.hud!.hideTitle();
      else if (!this.cinematic) {
        this.hud!.showTitle(true);
        this.persist();
      }
    };
    this.input.onClick = (button) => this.click(button === 2);
    // manette : démarre sans verrouillage de la souris
    this.gamepad = new GamepadInput(this.player);
    this.gamepad.onAct = (reverse) => this.click(reverse);
    this.gamepad.onStart = () => {
      if (this.playing) {
        this.playing = false;
        this.hud!.showTitle(true);
        this.persist();
      } else {
        this.audio.start();
        this.playing = true;
        this.hud!.hideTitle();
      }
    };
  }

  /** Réglages de confort (champ de vision, axe vertical, balancement, guide lumineux). */
  applyComfort(s: Partial<Settings>): void {
    if (s.fov !== undefined) {
      this.camera.fov = s.fov;
      this.camera.updateProjectionMatrix();
    }
    if (s.invertY !== undefined) this.player.invertY = s.invertY;
    if (s.bob !== undefined) this.player.bobOn = s.bob;
    if (s.guides !== undefined) this.guidesOn = s.guides;
  }

  /** Qualité graphique : finesse de l'image, des ombres et distance de vue. */
  applyQuality(q: Quality): void {
    const ratio = { haute: 1.75, moyenne: 1.25, basse: 0.85 }[q];
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, ratio));
    const size = { haute: 2048, moyenne: 1024, basse: 512 }[q];
    const shadow = this.lights.sun.shadow;
    if (shadow.mapSize.x !== size) {
      shadow.mapSize.set(size, size);
      shadow.map?.dispose();
      shadow.map = null;
    }
    const fog = this.scene.fog as THREE.Fog;
    fog.far = { haute: 420, moyenne: 340, basse: 260 }[q];
    this.resize();
  }

  /** Symboles des couleurs sur les panneaux de lumière (daltonisme). */
  setSymbols(on: boolean): void {
    for (const p of this.panels.values()) if (p instanceof LightPanel) p.setSymbols(on);
  }

  /** Applique la sauvegarde (ou l'état de départ). */
  private restore(): void {
    const solved = new Set(this.save.solved);
    this.restoring = true;
    for (const [id, panel] of this.panels) {
      const st = this.save.states[id];
      if (Array.isArray(st)) panel.applyState(st, true); // chaque vue valide son état (les plis ont une longueur variable)
      if (solved.has(id)) panel.markSolved();
    }
    this.restoring = false;
    this.updatePower(true);
    for (const id of SECRET_IDS) if (this.isSolved(id)) this.shards.add(null);
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
    let newCable = false;
    for (const id of this.save.solved) newCable = this.cables.light(id, instant) || newCable;
    if (newCable && !instant) this.audio.cable();
    const allees = ['a5', 'b6', 'c5', 'd6', 'tours'].filter((id) => this.isSolved(id)).length;
    const m = this.plazaCrystal.material as THREE.MeshStandardMaterial;
    m.emissive.set('#ffd98a').multiplyScalar(allees * 0.25);
    // chaque zone terminée donne un quart de lumière au phare ; le dernier panneau l'allume
    const steps = BEACON_STEPS.filter((id) => this.isSolved(id)).length;
    this.dayTarget = steps;
    if (instant) {
      this.day = steps;
      this.applyDay();
    }
    const lamp = this.lighthouseLamp.material as THREE.MeshStandardMaterial;
    lamp.emissive.set('#ffe9b0').multiplyScalar((steps / 4) * (steps === 4 ? 2.5 : 1));
    if (this.isSolved(FINAL_ID) && !this.ended) {
      this.ended = true;
      this.beacon.visible = true;
      if (!instant) {
        this.audio.finale();
        if (this.hud) {
          // la caméra quitte le joueur et s'élève autour du phare pendant que la nuit tombe
          const p = this.player.position;
          this.cinematic = { t: 0, a0: Math.atan2(p.z - LIGHTHOUSE.z, p.x - LIGHTHOUSE.x) };
          this.input?.release();
        }
      }
    }
    for (const s of this.shafts) {
      if (this.isSolved(s.id) && !s.mesh.visible) {
        s.mesh.visible = true;
        s.on = instant ? 1 : 0;
      }
    }
  }

  /** Où faire jaillir les étincelles d'une énigme résolue. */
  private sparkAt(p: PuzzleView): { at: THREE.Vector3; big: boolean } {
    if (p instanceof WorldLightPuzzle) {
      const c = towerCell(3, 0);
      return { at: new THREE.Vector3(c.x, heightAt(c.x, c.z) + TOWERS.beamY + 1, c.z), big: true };
    }
    const big = (p instanceof FoldView && p.place.kind === 'easel') || (p instanceof ShadowView && p.place.voxel > 0.5);
    return { at: p.group.position.clone().add(new THREE.Vector3(0, big ? 5 : 1.4, 0)), big };
  }

  private restoring = false;

  private onPanelSolved(panel: PuzzleView): void {
    const id = panel.id;
    // pendant le chargement, une feuille déjà résolue se signale : on la note sans fête ni
    // sauvegarde (sauvegarder ici écraserait les états des panneaux pas encore restaurés)
    if (this.restoring) {
      if (!this.save.solved.includes(id)) this.save.solved.push(id);
      return;
    }
    if (this.save.solved.includes(id) === false && SECRET_IDS.includes(id)) {
      this.shards.add(this.sparkAt(panel).at);
      this.audio.finale();
    }
    if (this.save.solved.includes(id) === false) {
      const s = this.sparkAt(panel);
      this.sparks.burst(s.at, new THREE.Color('#ffaa2e'), s.big ? 220 : 70, s.big ? 3 : 0.7);
      navigator.vibrate?.([30, 50, 70]);
    }
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
      navigator.vibrate?.(8);
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
      if (p instanceof LightPanel) p.setLevel(d2 < 32 * 32 ? 2 : d2 < 70 * 70 ? 1 : 0);
      else p.setDetail(d2 < 55 * 55);
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
    this.shards.update(dt);
    if (this.shards.complete) {
      const hue = (this.time * 0.05) % 1;
      for (const c of this.beacon.children) ((c as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHSL(hue, 0.7, 0.75);
      (this.plazaCrystal.material as THREE.MeshStandardMaterial).emissive.setHSL((hue + 0.5) % 1, 0.8, 0.5);
    }
    this.glintClock += dt;
    if (this.glintClock > 3.5) {
      this.glintClock = 0;
      this.glintSecrets();
    }
    this.sparks.update(dt);
    this.updateDay(dt);
    this.guides.update(this.time, this.guidesOn && !this.ended);
    this.gamepad?.poll(dt, this.playing);
    if (this.playing) this.save.playTime = (this.save.playTime ?? 0) + dt;
    this.atelierUpdate(this.time);
    this.decorUpdate(this.time);
    this.lifeUpdate(this.time, dt);
    WIND.uWindTime.value = this.time;
    for (const s of this.shafts) {
      if (!s.mesh.visible) continue;
      s.on = Math.min(1, s.on + dt * 0.4);
      (s.mesh.material as THREE.MeshBasicMaterial).opacity = 0.55 * s.on * (0.85 + 0.15 * Math.sin(this.time * 3));
    }
    this.updateHover();
    this.audio.setSeaProximity(1 - Math.min(1, Math.max(0, (this.player.position.y - 2) / 6)));
    this.stuckClock += dt;
    if (this.stuckClock >= 1) {
      this.updateStuck(this.stuckClock);
      this.stuckClock = 0;
    }
    this.saveTimer += dt;
    if (this.saveTimer > 5 && this.playing) {
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
    const sec = SECRETS.find((p) => p.id === id);
    if (sec) {
      if (sec.kind === 'world-light') this.player.place(SECRET_PLAGE.x0 + 8, SECRET_PLAGE.z0 + 13, 0, -0.35);
      else if (sec.kind === 'fold-easel') {
        const d = 6.5;
        this.player.place(sec.x + Math.sin(sec.yaw) * d, sec.z + Math.cos(sec.yaw) * d, sec.yaw, 0.05);
      } else if (sec.kind === 'shadow') {
        const yaw = sec.yaw - 0.4;
        this.player.place(sec.x + Math.sin(yaw) * 2.3, sec.z + Math.cos(yaw) * 2.3, yaw, -0.22);
      } else {
        const st = standPoint(sec, 1.55);
        this.player.place(st.x, st.z, sec.yaw, -0.5);
      }
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
      this.updateDay(0.05);
      this.sparks.update(0.05);
      this.shards.update(0.05);
      for (const g of this.gates.values()) {
        if (g.opening && g.open < 1) {
          g.open = Math.min(1, g.open + 0.05 / 2.5);
          g.setOpen(g.open);
        }
      }
    }
    this.updateGuides();
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
