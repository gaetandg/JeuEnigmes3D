import * as THREE from 'three';
import { parsePuzzle } from '../core/light/index.ts';
import { ZONE1, ZONE1_TOWERS } from '../puzzles/zone1.ts';
import { PLAZA, SECRETS, SECRET_PLAGE, SECRET_VOILE_CELL, ATELIER, CLOITRE, PHARE, CADRAN, FINAL_PANELS, SHADOW_PANELS, FOLD_PANELS, GATES, GRAND_PLI, LIGHTHOUSE, PANELS, START, TOWERS, standPoint, towerCell, SKY, SKY_PANELS, GRAND_PLATEAU, LIFT, SKY_LIFT, SKY_ARRIVAL, skyEdge, CAVE, CAVE_ARRIVAL, CAVE_LIFT, DEEP_LIFT, ROOT_PANELS, RACINE_MERE, reqIds, reqMet } from '../world/layout.ts';
import type { Req } from '../world/layout.ts';
import { PIT, buildCave } from '../world/cave.ts';
import type { Cave } from '../world/cave.ts';
import { ZONE6, ZONE6_MERE } from '../puzzles/zone6.ts';
import { parseRoots } from '../core/roots/index.ts';
import { RootView } from '../render/rootView.ts';
import { BASIN, buildSkyIsland } from '../world/sky.ts';
import type { SkyIsland } from '../world/sky.ts';
import { ZONE5, ZONE5_GRAND } from '../puzzles/zone5.ts';
import { parseTilt } from '../core/tilt/index.ts';
import { TiltView } from '../render/tiltView.ts';
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
import { ENDING, NOTES } from '../world/lore.ts';
import { LoreNotes, NOTE_REACH } from '../render/notes.ts';
import { SeaAnswer } from '../render/ending.ts';
import type { CheatAction, CheatList, Cinematic } from '../ui/hud.ts';
import type { MapData, MapMark, MapZone, MarkState } from '../ui/map.ts';

const REACH = 5;
/** une aide apparaît après ce temps passé près d'une énigme sans la résoudre (s) */
const HINT_DELAY = 180;

/** Qui alimente quoi : panneaux + énigmes d'environnement. */
const POWER: { id: string; requires: Req[] }[] = [...PANELS, TOWERS, ...FOLD_PANELS, GRAND_PLI, ...SHADOW_PANELS, CADRAN, ...FINAL_PANELS, ...SKY_PANELS, GRAND_PLATEAU, ...ROOT_PANELS, RACINE_MERE];
const SKY_IDS = [...SKY_PANELS.map((p) => p.id), GRAND_PLATEAU.id];
const ROOT_IDS = [...ROOT_PANELS.map((p) => p.id), RACINE_MERE.id];
/** de combien le phare s'enfonce dans la colline pendant la bascule (m) */
const SINK_DEPTH = 22;
/** lumière de la grotte : voûte violette, sol de terre, brume sombre */
const CAVE_SKY = new THREE.Color('#a497d6');
const CAVE_GROUND = new THREE.Color('#6a5040');
const CAVE_FOG = new THREE.Color('#141019');

/** Les énigmes qui donnent chacune un quart de lumière au phare. */
/** dernière énigme : elle rallume le phare */
const FINAL_ID = 'f6';
const BEACON_STEPS = ['tours', 'grand-pli', 'cadran', FINAL_ID];

/** Mode test : lieux où se téléporter d'un coup, sans rien changer à la progression. */
const PLACES: { id: string; label: string; x: number; z: number; yaw: number; needs?: 'sky' | 'deep' }[] = [
  { id: 'plage', label: 'La plage (départ)', x: START.x, z: START.z, yaw: START.yaw },
  { id: 'place', label: 'La place du jardin', x: PLAZA.x, z: PLAZA.z + 12, yaw: 0 },
  { id: 'tours', label: 'Le belvédère des Tours-Miroirs', x: 4, z: 1, yaw: 0 },
  { id: 'atelier', label: "L'Atelier de Papier", x: ATELIER.x, z: ATELIER.z + 10.5, yaw: 0 },
  { id: 'cloitre', label: 'Le Cloître des Ombres', x: CADRAN.x - 7, z: CADRAN.z + 10, yaw: -0.6 },
  { id: 'phare', label: 'Le pied du phare', x: LIFT.x + 5, z: LIFT.z + 7, yaw: 0.18 },
  { id: 'ciel', label: "L'Île du Ciel (une fois montée)", x: SKY_ARRIVAL.x, z: SKY_ARRIVAL.z, yaw: SKY_ARRIVAL.yaw, needs: 'sky' },
  { id: 'grotte', label: 'La grotte des Racines', x: CAVE_ARRIVAL.x, z: CAVE_ARRIVAL.z, yaw: CAVE_ARRIVAL.yaw, needs: 'deep' },
];

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
  const targets: { id: string; requires: Req[]; pos: { x: number; z: number } | undefined }[] = [
    ...POWER.map((p) => ({ id: p.id, requires: p.requires, pos: inPos.get(p.id) })),
    ...GATES.map((g) => ({ id: g.id, requires: g.requires, pos: { x: g.x, z: g.z } })),
  ];
  for (const t of targets) {
    const to = t.pos;
    // une condition « l'une ou l'autre » : un câble depuis chacune (la première allumée suffit)
    for (const r of reqIds(t.requires)) {
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
    this.skyDome = sky;
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
    this.lighthouse = lh.group;
    this.lighthouseY = lh.group.position.y;
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
    this.beaconY = this.beacon.position.y;
    this.scene.add(this.beacon);
    // la position du faisceau elle-même (pas une copie) : les éclats suivent le phare s'il s'enfonce
    this.shards = new Shards(this.beacon.position);
    this.scene.add(this.shards.group);
    // le récit : les billets du gardien, et la réponse de la mer à la fin
    this.notes = new LoreNotes(NOTES.filter((n) => n.zone !== 'ciel' && n.zone !== 'racines'), this.save.notes ?? []);
    this.skyNotes = new LoreNotes(NOTES.filter((n) => n.zone === 'ciel'), this.save.notes ?? []);
    this.scene.add(this.skyNotes.group);
    // la suite : l'Île du Ciel, qui dort sous la mer jusqu'à la transformation
    this.sky = buildSkyIsland(this.colliders);
    this.scene.add(this.sky.group);
    for (const spot of SKY_PANELS) {
      const def = ZONE5.find((d) => d.id === spot.id)!;
      this.addTiltView(new TiltView(parseTilt(def), { x: spot.x, z: spot.z, yaw: spot.yaw, cell: 0.24, kind: 'table' }));
      this.colliders.addCircle(spot.x, spot.z, 0.75);
    }
    {
      // au fond du bassin (l'île pose elle-même la barrière autour)
      const grand = new TiltView(parseTilt(ZONE5_GRAND), { x: GRAND_PLATEAU.x, z: GRAND_PLATEAU.z, yaw: GRAND_PLATEAU.yaw, cell: GRAND_PLATEAU.cell, kind: 'plaza', sink: BASIN.depth });
      this.addTiltView(grand);
    }
    this.setSkyRisen(!!this.save.sky);
    // la suite de la suite : la grotte des Racines, sous la mer, où l'on tombe après la bascule
    this.cave = buildCave(this.colliders);
    this.scene.add(this.cave.group);
    // une seule lampe chaude au-dessus de la fosse ; dehors, elle n'existe pas pour le rendu (sinon
    // chaque pixel de l'île la calculerait). On n'entre et ne sort de la grotte que pendant un fondu
    // au noir : le changement de nombre de lumières (recompilation des matériaux) ne se voit pas.
    this.caveLight = new THREE.PointLight('#ffc98a', 0, 75, 1.5);
    this.caveLight.visible = false;
    this.caveLight.position.set(CAVE.x, CAVE.y + 7, CAVE.z);
    this.scene.add(this.caveLight);
    for (const spot of ROOT_PANELS) {
      const { puzzle, start } = parseRoots(ZONE6.find((d) => d.id === spot.id)!);
      this.addRootView(new RootView(puzzle, { x: spot.x, z: spot.z, yaw: spot.yaw, cell: 0.2, kind: 'lectern' }, start));
      this.colliders.addCircle(spot.x, spot.z, 0.6);
    }
    {
      const { puzzle, start } = parseRoots(ZONE6_MERE);
      this.addRootView(new RootView(puzzle, { x: RACINE_MERE.x, z: RACINE_MERE.z, yaw: RACINE_MERE.yaw, cell: RACINE_MERE.cell, kind: 'pit', sink: PIT.depth }, start));
    }
    this.caveNotes = new LoreNotes(NOTES.filter((n) => n.zone === 'racines'), this.save.notes ?? []);
    this.scene.add(this.caveNotes.group);
    this.scene.add(this.notes.group);
    for (const n of NOTES) this.colliders.addCircle(n.x, n.z, 0.3);
    this.answer = new SeaAnswer();
    this.scene.add(this.answer.group);

    // rais de lumière jusqu'au phare (visibles une fois chaque zone finie)
    const crystal = towerCell(3, 0);
    this.addShaft(TOWERS.id, new THREE.Vector3(crystal.x, heightAt(crystal.x, crystal.z) + TOWERS.beamY + 0.3, crystal.z), '#ff8de6');
    this.addShaft(CADRAN.id, new THREE.Vector3(CADRAN.x, heightAt(CADRAN.x, CADRAN.z) + 4.5, CADRAN.z), '#8ad7ff');
    this.addShaft(GRAND_PLI.id, new THREE.Vector3(GRAND_PLI.x, heightAt(GRAND_PLI.x, GRAND_PLI.z) + 8.5, GRAND_PLI.z - 2), '#ffd98a');

    this.player = new Player(this.camera, this.colliders);
    this.player.onStep = () => this.audio.step();
    this.restore();
    this.applyDeep();
    this.snapCave = true;

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
    if (Math.hypot(x - CAVE.x, z - CAVE.z) < CAVE.r + 15) return 'racines';
    if (Math.hypot(x - SKY.x, z - SKY.z) < SKY.r + 10) return 'ciel';
    if (Math.hypot(x - ATELIER.x, z - ATELIER.z) < ATELIER.r + 15) return 'atelier';
    if (Math.abs(x - CLOITRE.x) < CLOITRE.half + 12 && Math.abs(z - CLOITRE.z) < CLOITRE.half + 12) return 'cloitre';
    if (Math.hypot(x - PHARE.x, z - PHARE.z) < PHARE.r + 12) return 'phare';
    return 'jardin';
  }

  private updateGuides(): void {
    const pos = this.player.position;
    const pts: THREE.Vector3[] = [];
    for (const p of this.panels.values()) {
      if (!p.powered || p.solved || SECRET_IDS.includes(p.id) || !p.group.visible) continue;
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
    applyDaylight(this.day, { scene: this.scene, lights: this.lights, renderer: this.renderer, sunGlow: SUN_GLOW, stars: this.stars, starBoost: this.starBoost });
    // sous terre : plus de soleil, une voûte violette, une brume sombre et proche, la lampe de la fosse
    const k = this.caveMix;
    const fog = this.scene.fog as THREE.Fog;
    fog.near = 90 + (14 - 90) * k;
    fog.far = this.fogFar + (80 - this.fogFar) * k;
    this.caveLight.intensity = 160 * k;
    this.caveLight.visible = k > 0;
    // sous terre, on ne dessine que la grotte : l'île est loin (au-delà de la vue courte), la mer, le
    // ciel et les étoiles sont au-dessus de la voûte, et le soleil ne projette plus d'ombres
    // (ces bascules n'ont lieu qu'au moment d'entrer ou de sortir, pendant un fondu au noir)
    const under = k > 0;
    const far = under ? 140 : 1500;
    if (this.camera.far !== far) {
      this.camera.far = far;
      this.camera.updateProjectionMatrix();
    }
    this.water.mesh.visible = !under;
    this.skyDome.visible = !under;
    this.lights.sun.castShadow = !under;
    if (under) this.stars.visible = false;
    this.scene.environmentIntensity = 0.6 * (1 - 0.75 * k);
    if (k <= 0) return;
    const L = this.lights;
    L.sun.intensity *= 1 - 0.95 * k;
    L.hemi.intensity += (1.0 - L.hemi.intensity) * k;
    L.hemi.color.lerp(CAVE_SKY, k);
    L.hemi.groundColor.lerp(CAVE_GROUND, k);
    fog.color.lerp(CAVE_FOG, k);
    if (this.scene.background instanceof THREE.Color) this.scene.background.lerp(CAVE_FOG, k);
    this.renderer.toneMappingExposure += (1.1 - this.renderer.toneMappingExposure) * k;
  }

  /** 0 : dehors ; 1 : dans la grotte (lumière, brume, son de la mer) */
  private caveMix = 0;
  private skyDome!: THREE.Object3D;
  /** passer d'un coup à l'ambiance du lieu (téléportation, chargement) */
  private snapCave = false;
  private fogFar = 420;
  private inCave(p: THREE.Vector3): boolean {
    return p.y < CAVE.y + 30 && Math.hypot(p.x - CAVE.x, p.z - CAVE.z) < CAVE.r + 20;
  }

  private updateCaveMix(dt: number): void {
    const target = this.inCave(this.camera.position) ? 1 : 0;
    const next = this.snapCave ? target : this.caveMix + Math.sign(target - this.caveMix) * Math.min(Math.abs(target - this.caveMix), dt * 1.5);
    this.snapCave = false;
    // l'intérieur de la grotte n'est dessiné que de près (il est sous la mer, loin à l'ouest)
    const near = this.camera.position.x < CAVE.x + 130;
    if (this.cave.interior.visible !== near) {
      this.cave.interior.visible = near;
      this.caveNotes.group.visible = near;
      for (const id of ROOT_IDS) this.panels.get(id)!.group.visible = near;
    }
    if (next !== this.caveMix) {
      this.caveMix = next;
      this.applyDay();
      this.audio.setUnderground(next);
    }
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
      // la mer répond, au loin, dans l'axe du dernier plan
      if (c.t >= 7 && !this.answer.answered && this.ended) this.answer.start(this.allSecrets());
      if (c.t >= 18 && !this.hudEndingShown) {
        this.hudEndingShown = true;
        this.playing = false;
        this.hud?.showEnding(this.stats());
      }
    }
  }

  private hudEndingShown = false;
  sky!: SkyIsland;
  skyNotes!: LoreNotes;
  /** éclat des étoiles (la vraie fin les rallume) */
  private starBoost = 1;
  /** séquence : l'Île du Ciel surgit de la mer */
  rise: { t: number } | null = null;
  /** séquence : le pont de lumière emporte le joueur (vers l'île, ou vers le phare) */
  lift: { t: number; up: boolean } | null = null;
  /** séquence : la vraie fin (le Grand Plateau résolu) */
  finale: { t: number } | null = null;
  /** séquence : l'île bascule, on glisse, on tombe ; le phare s'enfonce ; réveil dans la grotte */
  bascule: { t: number; lx: number; lz: number; last: THREE.Vector3; fall: THREE.CatmullRomCurve3 | null; switched: boolean; faded: boolean } | null = null;
  /** passage d'une pierre à l'autre (grotte ↔ pied du phare) */
  passage: { t: number; down: boolean; moved: boolean } | null = null;
  /** séquence : la Racine-mère reliée, la lumière remonte, le phare sort de la colline */
  rootsEnd: { t: number; switched: boolean; shown: boolean } | null = null;
  cave!: Cave;
  caveNotes!: LoreNotes;
  private caveLight!: THREE.PointLight;
  private lighthouse!: THREE.Group;
  private lighthouseY = 0;
  private beaconY = 0;
  /** 0 : le phare à sa place ; 1 : enfoncé dans la colline */
  private lhSink = 0;

  /** une séquence est en cours (le joueur ne marche pas, pas de menu pause) */
  get busy(): boolean {
    return !!(this.cinematic || this.rise || this.lift || this.finale || this.bascule || this.passage || this.rootsEnd);
  }

  /** La transformation : la terre tremble, l'île monte de la mer jusqu'au ciel, le pont s'allume. */
  startRise(): void {
    this.rise = { t: 0 };
    this.audio.finale();
  }

  private updateRise(dt: number): void {
    const r = this.rise!;
    r.t += dt;
    const k = THREE.MathUtils.smoothstep(r.t, 1.5, 11);
    this.sky.setRise(k);
    this.sky.setBridge(THREE.MathUtils.smoothstep(r.t, 11.2, 13.2));
    // la mer bouillonne au pied de l'île qui sort de l'eau
    if (k > 0.02 && k < 0.6 && Math.random() < 0.5) {
      const a = Math.random() * Math.PI * 2;
      this.sparks.burst(new THREE.Vector3(SKY.x + Math.cos(a) * SKY.r, 0.5, SKY.z + Math.sin(a) * SKY.r), new THREE.Color('#ffffff'), 18, 6);
    }
    const shake = k > 0.02 && k < 0.97 ? 0.35 : 0;
    const j = () => (Math.random() - 0.5) * shake;
    const target = r.t < 11
      ? new THREE.Vector3(SKY.x, 10 + k * (SKY.y - 25), SKY.z)
      : this.sky.bridgeCurve.getPoint(THREE.MathUtils.clamp((r.t - 11) / 3, 0, 1) * 0.5 + 0.25);
    this.cameraOverride = { pos: new THREE.Vector3(130 + j(), 34 + j(), 40 + j()), target };
    if (r.t >= 11.2 && r.t - dt < 11.2) this.audio.solved();
    if (r.t >= 14.5) {
      this.rise = null;
      this.cameraOverride = null;
      if (this.replaying) {
        this.endReplay();
        return;
      }
      this.save.sky = true;
      this.setSkyRisen(true);
      this.dayTarget = 5;
      // retour au pied du phare, face à la pierre d'envol
      this.player.place(LIFT.x, LIFT.z + 4, 0, -0.1);
      this.persist();
    }
  }

  /** Le pont de lumière : vers l'île (up) ou vers le phare. */
  private updateLift(dt: number): void {
    const l = this.lift!;
    l.t += dt;
    const u = THREE.MathUtils.smoothstep(l.t, 0, 6);
    const at = (v: number) => this.sky.bridgeCurve.getPoint(THREE.MathUtils.clamp(l.up ? v : 1 - v, 0, 1));
    this.cameraOverride = { pos: at(u).add(new THREE.Vector3(0, 1.6, 0)), target: at(Math.min(1, u + 0.06)).add(new THREE.Vector3(0, 1.4, 0)) };
    if (l.t >= 6.2) {
      this.lift = null;
      this.cameraOverride = null;
      if (l.up) this.player.place(SKY_ARRIVAL.x, SKY_ARRIVAL.z, SKY_ARRIVAL.yaw, 0);
      else this.player.place(LIFT.x, LIFT.z + 4, 0, -0.1);
    }
  }

  /** On entre dans le rai de lumière d'une pierre d'envol. */
  private checkLift(): void {
    if (!this.save.sky || this.busy) return;
    const p = this.player.position;
    const onSky = p.y > SKY.y - 20;
    const stone = onSky ? SKY_LIFT : LIFT;
    if (Math.hypot(p.x - stone.x, p.z - stone.z) < 1.3) {
      this.lift = { t: 0, up: !onSky };
      this.audio.solved();
    }
  }

  /** La vraie fin : la nuit retombe, les lanternes montent de la mer jusqu'aux étoiles. */
  private startFinale(): void {
    this.finale = { t: 0 };
    this.dayTarget = 4;
    this.answer.ascend();
    this.audio.finale();
    this.input?.release();
  }

  private updateFinale(dt: number): void {
    const f = this.finale!;
    f.t += dt;
    const k = THREE.MathUtils.smoothstep(f.t, 0, 16);
    this.starBoost = 1 + 2 * k;
    this.applyDay();
    this.cameraOverride = {
      pos: new THREE.Vector3(SKY_LIFT.x + 6, SKY.y + 9, SKY_LIFT.z + 16),
      target: new THREE.Vector3(40, 25 + k * 220, -10),
    };
    if (f.t >= 18 && !this.finaleShown) {
      this.finaleShown = true;
      this.playing = false;
      this.hud?.showFinale(ENDING.final, this.stats());
    }
  }
  private finaleShown = false;

  /** Après la carte de la vraie fin : retour sur l'île, l'aube revient. */
  private endFinale(): void {
    this.finale = null;
    this.cameraOverride = null;
    this.dayTarget = 5;
  }

  // ── la bascule : ce qu'on croyait la fin n'en était pas une ──

  private basculeWait = 0;

  /** Grand Plateau résolu, grotte pas encore ouverte : quand on est sur l'île, elle bascule. */
  private checkBascule(dt: number): void {
    if (!this.hud || this.save.deep || !this.isSolved(GRAND_PLATEAU.id) || this.busy || !this.playing || this.player.position.y < SKY.y - 20) {
      this.basculeWait = 0;
      return;
    }
    this.basculeWait += dt;
    if (this.basculeWait > 2) this.startBascule();
  }

  /** ce qui bascule avec l'île : ses énigmes et ses billets */
  private skyGroups(): THREE.Object3D[] {
    return [...SKY_IDS.map((id) => this.panels.get(id)!.group), this.skyNotes.group];
  }

  startBascule(): void {
    if (this.busy) return;
    const p = this.player.position;
    const onSky = p.y > SKY.y - 20;
    const lx = onSky ? p.x - SKY.x : -12;
    const lz = onSky ? p.z - SKY.z : 6;
    this.bascule = { t: 0, lx, lz, last: p.clone(), fall: null, switched: false, faded: false };
    this.audio.rumble();
    this.hud?.closeNote();
    this.noteAt = null;
    // les positions de référence des énigmes, avant qu'elles ne changent de repère
    for (const id of SKY_IDS) this.anchorsOf(this.panels.get(id)!);
    for (const g of this.skyGroups()) this.sky.pivot.attach(g);
  }

  private updateBascule(dt: number): void {
    const b = this.bascule!;
    b.t += dt;
    const t = b.t;
    const S = THREE.MathUtils.smoothstep;
    if (!b.switched) {
      // un frémissement, puis l'île entière penche vers l'ouest, comme un plateau
      this.sky.setTilt(0.05 * S(t, 0, 2.5) + 0.95 * S(t, 2.5, 7));
      this.sky.setBridge(1 - S(t, 1, 4));
      if (t >= 2.5 && t - dt < 2.5) this.audio.rumble();
    }
    if (t < 7.6) {
      // on glisse vers le bord, de plus en plus vite, en contournant le bassin, les arbres et les
      // rochers (avec assez de marge pour ne pas traverser un feuillage)
      const u = THREE.MathUtils.clamp((t - 3) / 4.6, 0, 1);
      const s = u * u;
      const edge = -skyEdge(Math.PI) + 0.6;
      const free = this.colliders.resolve(SKY.x + b.lx + (edge - b.lx) * s, SKY.z + b.lz * (1 - 0.5 * s) + 0.01, 2.2);
      const x = free.x - SKY.x;
      const z = free.z - SKY.z;
      const frame = this.sky.frame;
      frame.updateWorldMatrix(true, false);
      const g = heightAt(SKY.x + x, SKY.z + z);
      const shake = 0.05 + 0.1 * S(t, 2, 4);
      const j = () => (Math.random() - 0.5) * shake;
      const pos = frame.localToWorld(new THREE.Vector3(x + j(), g + 1.5 + j(), z + j()));
      const target = frame.localToWorld(new THREE.Vector3(x - 8, g + 1.2 - 1.5 * u, z * 0.9));
      b.last.copy(pos);
      this.cameraOverride = { pos, target };
      return;
    }
    const lhGround = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
    if (t < 13.1) {
      // on tombe du ciel, vers la mer ; au loin, le phare s'enfonce dans sa colline
      if (!b.fall) {
        const e = b.last.clone();
        b.fall = new THREE.CatmullRomCurve3([
          e,
          e.clone().add(new THREE.Vector3(-14, -7, 0)),
          new THREE.Vector3(170, 48, -55),
          new THREE.Vector3(85, 14, -82),
          new THREE.Vector3(48, 0.6, -94),
        ]);
      }
      const u = THREE.MathUtils.clamp((t - 7.6) / 5.5, 0, 1);
      const pos = b.fall.getPointAt(u ** 1.5);
      const sink = S(t, 8.6, 12.4);
      if (t >= 8.6 && t - dt < 8.6) {
        this.audio.rumble();
        this.beacon.visible = false;
      }
      this.setLighthouseSink(Math.max(this.lhSink, sink));
      if (sink > 0.02 && sink < 0.98 && Math.random() < 0.6) {
        const a = Math.random() * Math.PI * 2;
        this.sparks.burst(new THREE.Vector3(LIGHTHOUSE.x + Math.cos(a) * 7.5, lhGround + 0.6, LIGHTHOUSE.z + Math.sin(a) * 7.5), new THREE.Color('#d9c7a6'), 14, 3);
      }
      const lh = new THREE.Vector3(LIGHTHOUSE.x, lhGround + 16 - 12 * sink, LIGHTHOUSE.z);
      const ahead = b.fall.getPointAt(Math.min(1, u ** 1.5 + 0.05));
      this.cameraOverride = { pos, target: ahead.lerp(lh, S(t, 7.6, 9)) };
      if (t >= 12.5 && !b.faded) {
        b.faded = true;
        this.hud?.fade(1, 500);
      }
      return;
    }
    const A = CAVE_ARRIVAL;
    if (!b.switched) {
      b.switched = true;
      this.sky.setTilt(0);
      for (const g of this.skyGroups()) this.scene.attach(g);
      this.sky.setBridge(1);
      if (!this.replaying) {
        this.save.deep = true;
        this.applyDeep();
        this.player.place(A.x, A.z, A.yaw, 0);
        this.persist();
      }
      this.snapCave = true;
    }
    // réveil : allongé, on voit la voûte et les racines du phare ; puis on se relève
    if (t >= 13.4 && t - dt < 13.4) this.hud?.fade(0, 2600);
    const w = S(t, 13.8, 16.8);
    const fwd = new THREE.Vector3(-Math.sin(A.yaw), 0, -Math.cos(A.yaw));
    const pos = new THREE.Vector3(A.x, heightAt(A.x, A.z) + 0.35 + 1.25 * w, A.z);
    const target = pos.clone().addScaledVector(fwd, 0.4 + 4 * w).add(new THREE.Vector3(0, 5 * (1 - w) - 0.35 * w, 0));
    this.cameraOverride = { pos, target };
    if (t >= 17.2) {
      this.bascule = null;
      this.cameraOverride = null;
      if (this.replaying) {
        this.endReplay();
        return;
      }
      this.player.place(A.x, A.z, A.yaw, -0.08);
    }
  }

  /** hauteur actuelle du sommet du phare (tests) */
  lighthouseTop(): number {
    return this.lighthouse.position.y + 32;
  }

  /** La grotte ouverte (ou non) et le phare enfoncé tant que la Racine-mère n'est pas reliée. */
  private applyDeep(): void {
    const deep = !!this.save.deep;
    this.cave.setOpen(deep);
    const mere = this.isSolved(RACINE_MERE.id);
    this.setLighthouseSink(deep && !mere ? 1 : 0);
    this.cave.setGlow(mere ? 1 : 0);
  }

  /** Le phare s'enfonce dans la colline (1) ou se tient à sa place (0) ; son faisceau le suit. */
  private setLighthouseSink(k: number): void {
    this.lhSink = k;
    this.lighthouse.position.y = this.lighthouseY - SINK_DEPTH * k;
    this.beacon.position.y = this.beaconY - SINK_DEPTH * k;
    if (k > 0.05) this.beacon.visible = false;
    else if (this.ended && !this.bascule) this.beacon.visible = true;
    // les rais de lumière visent la lanterne : ils ne reviennent qu'avec le phare
    for (const s of this.shafts) s.mesh.visible = k < 0.01 && this.isSolved(s.id);
  }

  /** On marche sur une pierre de passage : fondu, et l'on se retrouve à l'autre. */
  private checkPassage(): void {
    if (!(this.save.deep || this.caveVisit) || this.busy) return;
    const p = this.player.position;
    const down = !this.inCave(p);
    const stone = down ? DEEP_LIFT : CAVE_LIFT;
    if (Math.hypot(p.x - stone.x, p.z - stone.z) < 1.3) {
      this.passage = { t: 0, down, moved: false };
      this.audio.power();
      this.hud?.fade(1, 700);
    }
  }

  private updatePassage(dt: number): void {
    const q = this.passage!;
    q.t += dt;
    if (!q.moved && q.t >= 0.8) {
      q.moved = true;
      if (q.down) this.player.place(CAVE_ARRIVAL.x, CAVE_ARRIVAL.z, CAVE_ARRIVAL.yaw, -0.08);
      // à côté de la pierre (pas devant), face au phare enfoncé
      else this.player.place(DEEP_LIFT.x + 4.5, DEEP_LIFT.z + 4.1, 0.33, 0.1);
      this.snapCave = true;
      this.hud?.fade(0, 900);
    }
    if (q.t >= 1.7) this.passage = null;
  }

  /** La Racine-mère est reliée : la lumière remonte les racines, le phare sort de la colline. */
  private startRoots(): void {
    this.rootsEnd = { t: 0, switched: false, shown: false };
    this.audio.finale();
    this.input?.release();
    this.hud?.closeNote();
    this.noteAt = null;
  }

  private updateRoots(dt: number): void {
    const r = this.rootsEnd!;
    r.t += dt;
    const t = r.t;
    const S = THREE.MathUtils.smoothstep;
    if (t < 5.2) {
      // la lumière part de la fosse et monte le long des racines jusqu'à la voûte
      this.cave.setGlow(S(t, 0.3, 4));
      const k = S(t, 0, 5.2);
      this.cameraOverride = {
        pos: new THREE.Vector3(CAVE.x + 15 - 3 * k, CAVE.y + 2.5 + 4 * k, CAVE.z + 9 - 2 * k),
        target: new THREE.Vector3(CAVE.x, CAVE.y - 1.5 + 16 * k, CAVE.z),
      };
      if (t >= 4.4 && t - dt < 4.4) this.hud?.fade(1, 700);
      return;
    }
    const ground = heightAt(LIGHTHOUSE.x, LIGHTHOUSE.z);
    if (!r.switched) {
      r.switched = true;
      this.snapCave = true;
      this.hud?.fade(0, 1400);
      this.setLighthouseSink(1);
    }
    // dehors, au lever du jour : le phare remonte de la colline
    const k = S(t, 6, 12.5);
    if (t >= 6 && t - dt < 6) this.audio.rumble();
    if (t >= 9 && t - dt < 9) this.audio.rumble();
    this.setLighthouseSink(1 - k);
    if (k > 0.02 && k < 0.98 && Math.random() < 0.6) {
      const a = Math.random() * Math.PI * 2;
      this.sparks.burst(new THREE.Vector3(LIGHTHOUSE.x + Math.cos(a) * 7.5, ground + 0.6, LIGHTHOUSE.z + Math.sin(a) * 7.5), new THREE.Color('#d9c7a6'), 14, 3);
    }
    if (t >= 12.6 && t - dt < 12.6) {
      this.audio.finale();
      this.sparks.burst(this.beacon.position.clone(), new THREE.Color('#ffe9b0'), 220, 4);
    }
    const a = 0.45 - 0.7 * S(t, 5.2, 17);
    const R = 40 + 8 * S(t, 11, 17);
    this.cameraOverride = {
      pos: new THREE.Vector3(LIGHTHOUSE.x + Math.sin(a) * R, ground + 5 + 9 * S(t, 10, 17), LIGHTHOUSE.z + Math.cos(a) * R),
      target: new THREE.Vector3(LIGHTHOUSE.x, ground + 8 + 14 * k, LIGHTHOUSE.z),
    };
    if (t >= 17.5 && !r.shown) {
      r.shown = true;
      this.playing = false;
      this.hud?.showFinale(ENDING.roots, this.stats(), 'Le phare est sorti de la colline.', 'Continuer');
    }
  }

  /** Après la carte : on se retrouve au pied du phare, face à lui. */
  private endRoots(): void {
    this.rootsEnd = null;
    this.cameraOverride = null;
    this.applyDeep();
    // face au phare, à l'écart de la pierre d'envol
    this.player.place(LIFT.x + 5, LIFT.z + 7, 0.18, 0.12);
    this.snapCave = true;
    this.persist();
  }

  notes!: LoreNotes;
  answer!: SeaAnswer;
  /** billet visé (lecture au clic) */
  hoveredNote: string | null = null;

  /** Les sept éclats sont-ils réunis ? (au chargement, avant que les éclats ne soient recomptés) */
  private allSecrets(): boolean {
    return SECRET_IDS.every((id) => this.isSolved(id));
  }

  /** Lit un billet du gardien : carte à l'écran, carnet et sauvegarde. */
  readNote(id: string): void {
    const i = NOTES.findIndex((n) => n.id === id);
    if (i < 0) return;
    const notes = (this.save.notes ??= []);
    const first = !notes.includes(id);
    if (first) notes.push(id);
    this.notes.markRead(id);
    this.skyNotes.markRead(id);
    this.caveNotes.markRead(id);
    this.audio.click();
    this.hud?.showNote(NOTES[i]!.text, `billet ${i + 1} sur ${NOTES.length}${first ? '' : ' · déjà lu'}`);
    this.noteAt = this.player.position.clone();
    this.refreshJournal();
    writeSave(this.save);
  }
  private noteAt: THREE.Vector3 | null = null;

  /** Données de la carte du gardien : chaque énigme principale et son état, éclats, billets, nous. */
  mapData(): MapData {
    const towers = towerCell(1.5, 1);
    const zones: [MapZone, { id: string; x: number; z: number }[], string | null][] = [
      ['jardin', [...PANELS, { id: TOWERS.id, ...towers }], TOWERS.id],
      ['atelier', [...FOLD_PANELS, GRAND_PLI], GRAND_PLI.id],
      ['cloitre', [...SHADOW_PANELS, CADRAN], CADRAN.id],
      ['phare', FINAL_PANELS, FINAL_ID],
      ['ciel', [...SKY_PANELS, GRAND_PLATEAU], GRAND_PLATEAU.id],
      ['racines', [...ROOT_PANELS, RACINE_MERE], RACINE_MERE.id],
    ];
    const marks: MapMark[] = zones.flatMap(([zone, spots, big]) => spots.map((p) => {
      const v = this.panels.get(p.id)!;
      const state: MarkState = this.isSolved(p.id) ? 'solved' : v.powered ? 'open' : 'locked';
      return { id: p.id, x: p.x, z: p.z, zone, state, big: p.id === big };
    }));
    const pos = this.player.position;
    return {
      marks,
      shards: SECRETS.filter((s) => this.isSolved(s.id)).map((s) => (s.kind === 'world-light' ? { x: SECRET_PLAGE.x0 + 8, z: SECRET_PLAGE.z0 + 6 } : { x: s.x, z: s.z })),
      shardsTotal: SECRETS.length,
      notes: new Set(this.save.notes ?? []).size,
      notesTotal: NOTES.length,
      player: { x: pos.x, y: pos.y, z: pos.z, yaw: this.player.yaw },
      sky: !!this.save.sky,
      deep: !!this.save.deep,
    };
  }

  private refreshMap(): void {
    this.hud?.setMap(this.mapData());
  }

  private refreshJournal(): void {
    const read = new Set(this.save.notes ?? []);
    this.hud?.setJournal(NOTES.map((n) => ({ zone: n.zone, text: read.has(n.id) ? n.text : null })));
  }

  /** Vise un billet (tests). */
  aimAtNote(id: string): void {
    const a = this.notes.anchor(id) ?? this.skyNotes.anchor(id) ?? this.caveNotes.anchor(id);
    if (!a) throw new Error(`billet ${id} introuvable`);
    a.y += 0.25;
    const d = a.sub(this.player.position);
    this.player.place(this.player.position.x, this.player.position.z, Math.atan2(-d.x, -d.z), Math.atan2(d.y, Math.hypot(d.x, d.z)));
  }

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
  stats(): { solved: number; total: number; minutes: number; shards: number; shardsTotal: number; notes: number; notesTotal: number; story: string } {
    const main = [...this.panels.keys()].filter((id) => !SECRET_IDS.includes(id));
    return {
      notes: new Set(this.save.notes ?? []).size,
      notesTotal: NOTES.length,
      story: this.allSecrets() ? `${ENDING.answer} ${ENDING.full}` : ENDING.answer,
      solved: main.filter((id) => this.isSolved(id)).length,
      total: main.length,
      minutes: Math.round((this.save.playTime ?? 0) / 60),
      shards: SECRET_IDS.filter((id) => this.isSolved(id)).length,
      shardsTotal: SECRET_IDS.length,
    };
  }

  private addTiltView(view: TiltView): void {
    view.onSolved = () => this.onPanelSolved(view);
    const big = view.place.kind === 'plaza';
    view.onRoll = (dur) => this.audio.roll(dur, big);
    view.onLand = (end) => (end === 'home' ? this.audio.home() : end === 'pit' ? this.audio.pit() : this.audio.bump(big));
    view.onFail = () => this.audio.denied();
    this.panels.set(view.id, view);
    this.scene.add(view.group);
  }

  private addRootView(view: RootView): void {
    view.onSolved = () => this.onPanelSolved(view);
    view.onCrystal = (n) => this.audio.crystal(((n - 1) % 7) + 1);
    this.panels.set(view.id, view);
    this.scene.add(view.group);
  }

  /** L'Île du Ciel à sa place (ou encore sous la mer) : île, pont de lumière, énigmes, billets. */
  private setSkyRisen(on: boolean): void {
    this.sky.setRise(on ? 1 : 0);
    this.sky.setBridge(on ? 1 : 0);
    this.skyNotes.group.visible = on;
    for (const id of SKY_IDS) this.panels.get(id)!.group.visible = on;
  }

  get skyRisen(): boolean {
    return !!this.save.sky;
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
        this.refreshMap();
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
      onCheat: (action, id) => this.cheat(action, id),
      onCinematic: (which) => this.replay(which),
      onTeleport: (place) => this.teleportTo(place),
    }, settings, this.save.solved.length > 0, touch, this.cheatList(), PLACES.map((p) => ({ id: p.id, label: p.label })));
    this.refreshJournal();
    this.refreshMap();
    if (touch) {
      touchInput = new TouchInput(this.opts.canvas, this.opts.ui, this.player);
      touchInput.onTap = (reverse) => this.click(reverse);
    }
    this.hud.onContinue = () => {
      // fin de la séquence : retour au joueur
      this.cinematic = null;
      this.cameraOverride = null;
      // … mais la lumière ne s'arrête pas là : l'Île du Ciel surgit de la mer
      if (this.replaying) this.endReplay();
      else if (this.ended && !this.save.sky && !this.rise) this.startRise();
      if (this.finale && this.finale.t >= 18 && !this.replaying) this.endFinale();
      if (this.rootsEnd?.shown) this.endRoots();
      if (touchInput) {
        touchInput.enabled = true;
        this.playing = true;
      } else this.input!.requestLock();
    };
    this.input.onLockChange = (locked) => {
      this.playing = locked;
      if (locked) this.hud!.hideTitle();
      // pendant une séquence (fin, île qui monte, pont de lumière, vraie fin), pas de menu pause
      else if (!this.busy) {
        this.refreshMap();
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
        this.refreshMap();
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
    this.fogFar = { haute: 420, moyenne: 340, basse: 260 }[q];
    this.applyDay();
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
      const on = reqMet(spot.requires, (r) => this.isSolved(r));
      if (on && !panel.powered) {
        panel.setPowered(true);
        if (!instant) this.audio.power();
      }
    }
    for (const g of GATES) {
      const gv = this.gates.get(g.id)!;
      if (!gv.opening && reqMet(g.requires, (r) => this.isSolved(r))) {
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
    // après la transformation, l'aube se lève sur l'Île du Ciel (la vraie fin ramène la nuit)
    this.dayTarget = this.finale ? 4 : this.save.sky ? 5 : steps;
    if (instant) {
      this.day = steps;
      this.applyDay();
    }
    const lamp = this.lighthouseLamp.material as THREE.MeshStandardMaterial;
    lamp.emissive.set('#ffe9b0').multiplyScalar((steps / 4) * (steps === 4 ? 2.5 : 1));
    if (this.isSolved(FINAL_ID) && !this.ended) {
      this.ended = true;
      this.beacon.visible = this.lhSink < 0.05;
      if (!instant) {
        this.audio.finale();
        if (this.hud) {
          // la caméra quitte le joueur et s'élève autour du phare pendant que la nuit tombe
          const p = this.player.position;
          this.cinematic = { t: 0, a0: Math.atan2(p.z - LIGHTHOUSE.z, p.x - LIGHTHOUSE.x) };
          this.input?.release();
          this.hud.closeNote(); // un billet ouvert ne doit pas masquer la séquence
          this.noteAt = null;
        }
      }
      // sans séquence (chargement, tests) : la mer a déjà répondu
      if (!this.cinematic) this.answer.start(this.allSecrets(), true);
    }
    for (const s of this.shafts) {
      if (this.isSolved(s.id) && !s.mesh.visible && this.lhSink < 0.01) {
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
    const big = (p instanceof FoldView && p.place.kind === 'easel') || (p instanceof ShadowView && p.place.voxel > 0.5) || (p instanceof RootView && p.place.kind === 'pit');
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
    // le Grand Plateau : la vraie fin
    if (id === GRAND_PLATEAU.id && !this.save.solved.includes(id) && this.hud) this.startFinale();
    // la Racine-mère : le phare remonte
    if (id === RACINE_MERE.id && !this.save.solved.includes(id) && this.hud) this.startRoots();
    if (this.save.solved.includes(id) === false && SECRET_IDS.includes(id)) {
      this.shards.add(this.sparkAt(panel).at);
      this.audio.finale();
      // le dernier éclat trouvé après la fin : les lanternes partent à leur tour
      if (this.answer.answered && SECRET_IDS.every((s) => s === id || this.isSolved(s))) this.answer.bringLanterns();
    }
    if (this.save.solved.includes(id) === false) {
      const s = this.sparkAt(panel);
      this.sparks.burst(s.at, new THREE.Color('#ffaa2e'), s.big ? 220 : 70, s.big ? 3 : 0.7);
      navigator.vibrate?.([30, 50, 70]);
    }
    if (!this.save.solved.includes(id)) this.save.solved.push(id);
    // sans la séquence (tests) : le phare remonte aussitôt
    if (id === RACINE_MERE.id && !this.rootsEnd) this.applyDeep();
    this.audio.solved();
    // l'ouverture des portes et l'allumage suivent le câble
    window.setTimeout(() => this.updatePower(false), 900);
    this.persist();
  }

  private persist(): void {
    if (this.rewinding) return;
    for (const [id, panel] of this.panels) this.save.states[id] = panel.state;
    this.save.player = { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw };
    writeSave(this.save);
  }

  private reset(): void {
    clearSave();
    window.location.reload();
  }

  private click(reverse: boolean): void {
    // un billet ouvert se range au clic suivant
    if (this.hud?.noteOpen) {
      this.hud.closeNote();
      this.noteAt = null;
      return;
    }
    if (this.hoveredNote) {
      this.readNote(this.hoveredNote);
      return;
    }
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
    const aim = pick.userData.aim as THREE.Vector3 | undefined;
    const target = aim ? pick.localToWorld(aim.clone()) : pick.getWorldPosition(new THREE.Vector3());
    const d = target.sub(this.player.position);
    const yaw = Math.atan2(-d.x, -d.z);
    const pitch = Math.atan2(d.y, Math.hypot(d.x, d.z));
    this.player.place(this.player.position.x, this.player.position.z, yaw, pitch);
  }

  /** portée de la plus grande énigme (calculée une fois) */
  private maxReach = 0;

  private updateHover(): void {
    this.raycaster.setFromCamera(new THREE.Vector2(0, 0), this.camera);
    // chaque énigme a sa portée (les grandes, Grand Pli et Cadran, se manipulent de loin)
    this.maxReach ||= Math.max(REACH, ...[...this.panels.values()].map((p) => p.reach));
    this.raycaster.far = this.maxReach;
    const candidates: THREE.Object3D[] = [];
    for (const p of this.panels.values()) {
      if (!p.powered || p.solved) continue;
      if (p instanceof LightPanel && p.group.position.distanceToSquared(this.camera.position) > 25) continue;
      candidates.push(...p.pickables);
    }
    // la première pièce touchée qui est à portée de son énigme
    const hit = candidates.length
      ? this.raycaster.intersectObjects(candidates, false).find((h) => h.distance <= (h.object.userData.panel as PuzzleView).reach)
      : undefined;
    // un billet du gardien, plus proche qu'une pièce d'énigme ?
    const notePicks = [...this.notes.pickables, ...(this.save.sky ? this.skyNotes.pickables : []), ...(this.save.deep ? this.caveNotes.pickables : [])];
    const noteHit = this.raycaster.intersectObjects(notePicks, false)[0];
    const note = noteHit && noteHit.distance <= NOTE_REACH && (!hit || noteHit.distance < hit.distance) ? (noteHit.object.userData.note as string) : null;
    if (note !== this.hoveredNote) {
      this.hoveredNote = note;
      for (const n of [this.notes, this.skyNotes, this.caveNotes]) n.setHover(note);
    }
    const next = hit && !note ? { panel: hit.object.userData.panel as PuzzleView, k: hit.object.userData.k as number } : null;
    if (this.hovered && (!next || next.panel !== this.hovered.panel || next.k !== this.hovered.k)) {
      this.hovered.panel.setHover(null);
    }
    this.hovered = next;
    if (next) next.panel.setHover(next.k);
    this.hud?.setCrosshairActive(!!next || !!note);
    // la carte d'un billet se range quand on s'éloigne
    if (this.noteAt && this.hud?.noteOpen && this.noteAt.distanceTo(this.player.position) > 3) {
      this.hud.closeNote();
      this.noteAt = null;
    }
    // l'aide désigne la pièce visée : montrer le bon bouton
    const help = next?.panel.activeHint();
    this.hud?.setMouseHint(help && help.k === next!.k ? (help.reverse ? 'right' : 'left') : null);
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
    if (!this.rise && !this.lift && !this.finale && !this.bascule && !this.passage && !this.rootsEnd) this.player.update(dt);
    if (this.cameraOverride) {
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.target);
    }
    this.lights.follow(this.cameraOverride ? this.cameraOverride.target : this.player.position);
    this.water.update(this.time);
    this.cables.update(dt);
    for (const p of this.panels.values()) {
      const lectern = p instanceof RootView && p.place.kind === 'lectern';
      const small = p instanceof LightPanel || (p instanceof FoldView && p.place.kind === 'desk') || (p instanceof ShadowView && p.place.voxel < 0.5) || lectern;
      if (!small) {
        p.update(dt, this.time);
        continue;
      }
      const d2 = p.group.position.distanceToSquared(this.camera.position);
      // pupitres des racines : beaucoup de tuiles, détail seulement de près
      if (lectern) {
        p.setDetail(d2 < 26 * 26);
        if (d2 < 26 * 26) p.update(dt, this.time);
        continue;
      }
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
    this.notes.update(this.time);
    this.skyNotes.update(this.time);
    this.caveNotes.update(this.time);
    this.sky.update(this.time);
    this.cave.update(this.time);
    if (this.rise) this.updateRise(dt);
    if (this.lift) this.updateLift(dt);
    if (this.finale) this.updateFinale(dt);
    if (this.bascule) this.updateBascule(dt);
    if (this.passage) this.updatePassage(dt);
    if (this.rootsEnd) this.updateRoots(dt);
    this.checkLift();
    this.checkPassage();
    this.checkBascule(dt);
    if (this.cameraOverride) {
      // la caméra des séquences a pu bouger pendant la mise à jour
      this.camera.position.copy(this.cameraOverride.pos);
      this.camera.lookAt(this.cameraOverride.target);
    }
    this.updateCaveMix(dt);
    this.answer.update(dt, this.time);
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
    // après la fin du phare, le guide revient pour les zones de la suite (ciel, racines)
    this.guides.update(this.time, this.guidesOn && (!this.ended || !!this.save.sky) && !this.busy);
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
    this.audio.setSeaProximity(this.caveMix > 0.5 ? 0.15 : 1 - Math.min(1, Math.max(0, (this.player.position.y - 2) / 6)));
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
    const rootSpot = ROOT_PANELS.find((p) => p.id === id);
    if (rootSpot) {
      const s = standPoint(rootSpot, 1.5);
      this.player.place(s.x, s.z, rootSpot.yaw, -0.6);
      return;
    }
    if (id === RACINE_MERE.id) {
      // au bord de la fosse, on regarde la Racine-mère en contrebas
      this.player.place(CAVE.x + 9.5, CAVE.z + 3, Math.PI / 2 - 0.305, -0.42);
      return;
    }
    const tiltSpot = SKY_PANELS.find((p) => p.id === id);
    if (tiltSpot) {
      const s = standPoint(tiltSpot, 1.5);
      this.player.place(s.x, s.z, tiltSpot.yaw, -0.6);
      return;
    }
    if (id === GRAND_PLATEAU.id) {
      this.player.place(GRAND_PLATEAU.x, GRAND_PLATEAU.z + 11, 0, -0.6);
      return;
    }
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

  /** mode test : la grotte visitée sans la bascule (ses pierres de passage marchent quand même) */
  private caveVisit = false;

  /** Mode test : aller à un lieu, sans rien résoudre ni changer (la grotte s'ouvre pour l'occasion). */
  teleportTo(id: string): void {
    const p = PLACES.find((q) => q.id === id);
    if (!p) return;
    if (p.needs === 'sky' && !this.save.sky) {
      this.hud?.notify("L'Île du Ciel n'est pas encore montée.");
      return;
    }
    // la grotte n'a pas d'autre accès que la bascule : on ouvre ses pierres de passage pour pouvoir
    // en ressortir, sans toucher au phare ni à la sauvegarde
    if (p.needs === 'deep' && !this.save.deep) {
      this.cave.setOpen(true);
      this.caveVisit = true;
    }
    this.player.place(p.x, p.z, p.yaw, 0);
    this.snapCave = true;
  }

  /** Énigmes du mode test, groupées par zone, dans l'ordre de progression. */
  private cheatList(): CheatList {
    const named: Record<string, string> = { tours: 'Tours-Miroirs', 'grand-pli': 'Grand Pli', cadran: 'Cadran', [FINAL_ID]: `${FINAL_ID} (finale)` };
    const item = (id: string) => ({ id, label: named[id] ?? id });
    return [
      { group: 'Zone 1 · Lumière', items: [...PANELS.map((p) => p.id), TOWERS.id].map(item) },
      { group: 'Zone 2 · Pliage', items: [...FOLD_PANELS.map((p) => p.id), GRAND_PLI.id].map(item) },
      { group: 'Zone 3 · Ombres', items: [...SHADOW_PANELS.map((p) => p.id), CADRAN.id].map(item) },
      { group: 'Zone 4 · Phare', items: FINAL_PANELS.map((p) => item(p.id)) },
      { group: 'Zone 5 · Ciel', items: SKY_IDS.map((id) => ({ id, label: id === GRAND_PLATEAU.id ? 'Grand Plateau (vraie fin ?)' : id })) },
      { group: 'Zone 6 · Racines', items: ROOT_IDS.map((id) => ({ id, label: id === RACINE_MERE.id ? 'Racine-mère (dernière)' : id })) },
      { group: 'Éclats (secrets)', items: SECRET_IDS.map((id) => ({ id, label: `Éclat : ${id.replace('eclat-', '')}` })) },
    ];
  }

  /**
   * Mode test : résout dans l'ordre de progression ce qui précède l'énigme choisie (« before »),
   * ou jusqu'à elle incluse (« upto »), ou tout (« all »), puis place le joueur devant.
   * Sans fanfare ni étincelles ; portes, câbles et lumière du jour suivent, et l'on sauvegarde.
   */
  cheat(action: CheatAction, id: string): void {
    // les énigmes du ciel : l'île monte d'abord (sans la séquence)
    // … et pour les Racines, la grotte est ouverte (sans la bascule)
    const deepTarget = action === 'all' || ROOT_IDS.includes(id);
    const skyTarget = deepTarget || SKY_IDS.includes(id);
    // revenir en arrière : si des énigmes au-delà du point choisi sont déjà résolues, on réécrit
    // la sauvegarde exactement à ce point et on recharge (le plus sûr pour tout remettre à zéro)
    if (action === 'before' || action === 'upto') {
      const order = POWER.map((p) => p.id);
      const at = order.indexOf(id);
      if (at >= 0) {
        const keep = order.slice(0, action === 'before' ? at : at + 1);
        const later = order.slice(keep.length);
        if (later.some((t) => this.isSolved(t))) {
          this.rewind(keep, skyTarget, deepTarget, id);
          return;
        }
      }
    }
    if (skyTarget && !this.save.sky) {
      this.save.sky = true;
      this.setSkyRisen(true);
      this.dayTarget = 5;
    }
    if (deepTarget && !this.save.deep) {
      this.save.deep = true;
      this.applyDeep();
    }
    if (action !== 'goto') {
      const order = POWER.map((p) => p.id);
      const at = order.indexOf(id);
      const until = action === 'all' ? order.length : at < 0 ? 0 : action === 'before' ? at : at + 1;
      const targets = new Set(order.slice(0, until));
      // un Éclat ne dépend de rien : « jusqu'ici » le résout seul (avec son éclat qui s'envole)
      if (at < 0 && action === 'upto' && SECRET_IDS.includes(id)) this.solvePanel(id);
      this.restoring = true;
      for (let progress = true; progress; ) {
        progress = false;
        for (const t of targets) {
          if (this.solvePanel(t)) {
            this.updatePower(true);
            progress = true;
          }
        }
      }
      this.restoring = false;
      this.updatePower(true);
      this.applyDeep();
      this.persist();
    }
    this.view(action === 'all' ? FINAL_ID : id);
    this.snapCave = true;
  }

  /**
   * Mode test, retour en arrière : la progression devient exactement `keep` (les Éclats trouvés
   * restent), les énigmes suivantes repartent de zéro, l'île du ciel redescend si l'on revient
   * avant la finale, et l'on se retrouve devant l'énigme choisie après rechargement.
   */
  private rewind(keep: string[], skyTarget: boolean, deepTarget: boolean, id: string): void {
    const kept = new Set(keep);
    const save = this.save;
    save.solved = save.solved.filter((s) => kept.has(s) || SECRET_IDS.includes(s));
    for (const k of keep) if (!save.solved.includes(k)) save.solved.push(k);
    for (const sid of Object.keys(save.states)) if (!kept.has(sid) && !SECRET_IDS.includes(sid)) delete save.states[sid];
    // les énigmes gardées : on enregistre leur état résolu
    for (const k of keep) {
      const sol = this.panels.get(k)?.solution();
      if (sol) save.states[k] = sol;
    }
    save.sky = skyTarget || (kept.has(FINAL_ID) && !!save.sky);
    save.deep = deepTarget || (kept.has(GRAND_PLATEAU.id) && !!save.deep);
    this.view(id);
    save.player = { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw };
    writeSave(save);
    this.rewinding = true;
    window.location.reload();
  }
  /** un retour en arrière recharge la page : plus de sauvegarde automatique d'ici là */
  private rewinding = false;

  /** Mode test : une séquence rejouée, et de quoi tout remettre comme avant. */
  replaying: { which: Cinematic; sky: boolean; x: number; z: number; yaw: number; beacon: boolean } | null = null;

  /** Rejoue une cinématique sans toucher à la progression. */
  replay(which: Cinematic): void {
    if (this.busy) return;
    const p = this.player.position;
    this.replaying = { which, sky: !!this.save.sky, x: p.x, z: p.z, yaw: this.player.yaw, beacon: this.beacon.visible };
    if (which === 'phare') {
      // le phare se rallume : faisceau, caméra qui s'élève, carte de fin
      this.beacon.visible = true;
      this.hudEndingShown = false;
      this.cinematic = { t: 0, a0: Math.atan2(p.z - LIGHTHOUSE.z, p.x - LIGHTHOUSE.x) };
      this.audio.finale();
      this.input?.release();
    } else if (which === 'ile') {
      // l'île repart sous la mer, puis remonte
      this.setSkyRisen(false);
      this.startRise();
    } else if (which === 'bascule') {
      this.setSkyRisen(true);
      this.startBascule();
    } else if (which === 'racines') {
      // la grotte éteinte et le phare enfoncé, puis tout se relie
      this.cave.setGlow(0);
      this.setLighthouseSink(1);
      this.startRoots();
    } else {
      // la vraie fin : il faut l'île à sa place pour la regarder
      this.setSkyRisen(true);
      this.finaleShown = false;
      this.startFinale();
    }
  }

  /** Fin d'une séquence rejouée : île, phare, joueur et heure du jour comme avant. */
  private endReplay(): void {
    const r = this.replaying!;
    this.replaying = null;
    this.cinematic = null;
    this.finale = null;
    this.rootsEnd = null;
    if (this.bascule) {
      this.bascule = null;
      this.sky.setTilt(0);
      for (const g of this.skyGroups()) if (g.parent !== this.scene) this.scene.attach(g);
    }
    this.hud?.fade(0, 300);
    this.cameraOverride = null;
    this.setSkyRisen(r.sky);
    this.beacon.visible = r.beacon;
    this.applyDeep();
    this.snapCave = true;
    if (!this.ended) this.answer.group.visible = false;
    this.player.place(r.x, r.z, r.yaw);
    this.starBoost = 1;
    this.updatePower(true);
  }

  /** Avance la simulation sans rendu (pour les tests). */
  advance(seconds: number): void {
    const steps = Math.ceil(seconds / 0.05);
    for (let i = 0; i < steps; i++) {
      this.time += 0.05;
      this.cables.update(0.05);
      for (const p of this.panels.values()) p.update(0.05, this.time);
      this.answer.update(0.05, this.time);
      this.sky.update(this.time);
      if (this.rise) this.updateRise(0.05);
      if (this.lift) this.updateLift(0.05);
      if (this.finale) this.updateFinale(0.05);
      if (this.bascule) this.updateBascule(0.05);
      if (this.passage) this.updatePassage(0.05);
      if (this.rootsEnd) this.updateRoots(0.05);
      this.checkLift();
      this.checkPassage();
      this.cave.update(this.time);
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
