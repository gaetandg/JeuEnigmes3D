import * as THREE from 'three';
import { generateEcho } from '../core/echo/generate.ts';
import type { EchoDef, Tier } from '../core/echo/generate.ts';
import { parsePuzzle } from '../core/light/index.ts';
import { parseFold } from '../core/fold/index.ts';
import { parseShadow, startState } from '../core/shadow/index.ts';
import { parseTilt } from '../core/tilt/index.ts';
import { parseRoots } from '../core/roots/index.ts';
import { parseVases } from '../core/vases/index.ts';
import { LightPanel } from '../render/panelView.ts';
import { FoldView } from '../render/foldView.ts';
import { ShadowView } from '../render/shadowView.ts';
import { TiltView } from '../render/tiltView.ts';
import { RootView } from '../render/rootView.ts';
import { VaseView } from '../render/vaseView.ts';
import type { PuzzleView } from '../render/puzzleView.ts';
import { buildEchoCave } from '../world/echo.ts';
import type { EchoWorld } from '../world/echo.ts';
import { ECHO, ECHO_MODULES, echoStones } from '../world/layout.ts';
import type { EchoLang } from '../world/layout.ts';
import type { Colliders } from './colliders.ts';

/** Ce que la grotte demande au jeu. */
export interface EchoHost {
  /** inscrit une énigme (survol, clic, aide, sons) */
  addView(view: PuzzleView): void;
  /** la retire (et libère sa mémoire) */
  removeView(id: string): void;
  isSolved(id: string): boolean;
  /** une énigme de la grotte résolue : la fête habituelle (étincelles, son) */
  celebrate(view: PuzzleView): void;
  /** une nouvelle énigme se forme */
  chime(): void;
  /** sauvegarder (une taille choisie, un compte qui monte) */
  persist(): void;
}

/** Ce que la grotte garde en mémoire : combien d'énigmes résolues par langage, et la taille choisie. */
export interface EchoSave {
  counts: Partial<Record<EchoLang, number>>;
  tiers: Partial<Record<EchoLang, number>>;
  /** on y est déjà entré (la carte du gardien montre l'entrée) */
  visited?: boolean;
}

/** id de l'énigme d'une alcôve */
export const echoId = (kind: EchoLang): string => `echo-${kind}`;
export const isEchoId = (id: string): boolean => id.startsWith('echo-');

/** temps de rester sur une pierre de taille avant qu'elle ne compte (on ne change pas par mégarde) */
const DWELL = 0.5;
/** après une énigme résolue, une nouvelle se forme au bout de… */
const NEXT_AFTER = 2.4;

/**
 * La Grotte des Échos : six alcôves, une par langage, chacune avec une énigme tirée au hasard.
 * Une alcôve s'allume quand on a maîtrisé son langage (sa grande énigme est résolue). Résoudre
 * fait pousser un cristal aux parois, puis une nouvelle énigme se forme. Trois pierres à côté
 * choisissent la taille (petite, moyenne, grande) : on s'y tient un instant.
 */
export class EchoCave {
  readonly world: EchoWorld;
  private views = new Map<EchoLang, PuzzleView>();
  private unlocked = new Set<EchoLang>();
  private worker: Worker | null = null;
  private nextReq = 1;
  private waiting = new Map<number, EchoLang>();
  /** alcôves dont l'énigme est résolue et qui attendent la suivante (instant prévu) */
  private renew = new Map<EchoLang, number>();
  private dwell: { kind: EchoLang; tier: number; t: number } | null = null;
  private time = 0;

  constructor(private readonly host: EchoHost, readonly save: EchoSave, colliders: Colliders) {
    this.world = buildEchoCave(colliders);
    for (const m of ECHO_MODULES) this.world.setTier(m.kind, this.tierOf(m.kind));
    this.world.setCrystals(this.countsAll());
    try {
      this.worker = new Worker(new URL('../core/echo/worker.ts', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e: MessageEvent<{ req: number; result: EchoDef | null }>) => this.receive(e.data.req, e.data.result);
    } catch {
      this.worker = null; // sans Worker : on tire sur place
    }
  }

  tierOf(kind: EchoLang): Tier {
    const t = this.save.tiers[kind] ?? 0;
    return (t === 1 || t === 2 ? t : 0) as Tier;
  }

  private countsAll(): Record<EchoLang, number> {
    const out = {} as Record<EchoLang, number>;
    for (const m of ECHO_MODULES) out[m.kind] = this.save.counts[m.kind] ?? 0;
    return out;
  }

  /** Total des énigmes résolues dans la grotte. */
  get total(): number {
    return Object.values(this.save.counts).reduce((a, b) => a + (b ?? 0), 0);
  }

  /** L'énigme en cours d'une alcôve (tests). */
  view(kind: EchoLang): PuzzleView | null {
    return this.views.get(kind) ?? null;
  }

  /** Les alcôves s'allument à mesure qu'on maîtrise les langages. */
  refreshUnlocks(): void {
    for (const m of ECHO_MODULES) {
      const on = this.host.isSolved(m.unlock);
      if (on === this.unlocked.has(m.kind)) continue;
      this.world.setUnlocked(m.kind, on);
      if (on) {
        this.unlocked.add(m.kind);
        this.request(m.kind);
      } else {
        this.unlocked.delete(m.kind);
        this.drop(m.kind);
      }
    }
  }

  /** Demande une nouvelle énigme pour une alcôve. */
  private request(kind: EchoLang): void {
    const tier = this.tierOf(kind);
    const seed = (Math.random() * 2 ** 31) >>> 0;
    const req = this.nextReq++;
    this.waiting.set(req, kind);
    if (this.worker) this.worker.postMessage({ req, kind, tier, seed });
    else queueMicrotask(() => this.receive(req, generateEcho(kind, tier, seed)));
  }

  private receive(req: number, result: EchoDef | null): void {
    const kind = this.waiting.get(req);
    this.waiting.delete(req);
    // une réponse périmée (la taille a changé, ou l'alcôve s'est éteinte entre-temps)
    if (!kind || !this.unlocked.has(kind) || [...this.waiting.values()].includes(kind)) return;
    if (!result) {
      this.request(kind);
      return;
    }
    this.drop(kind);
    const view = this.build(result);
    if (!view) return;
    this.views.set(kind, view);
    this.host.addView(view);
    view.setPowered(true);
    this.host.chime();
  }

  private drop(kind: EchoLang): void {
    const v = this.views.get(kind);
    if (!v) return;
    this.views.delete(kind);
    this.host.removeView(v.id);
  }

  /** Le bon pupitre pour l'énigme tirée, dans son alcôve (face au centre). */
  private build(e: EchoDef): PuzzleView | null {
    const m = ECHO_MODULES.find((x) => x.kind === e.kind)!;
    const at = { x: m.x, z: m.z, yaw: m.yaw };
    try {
      switch (e.kind) {
        case 'lumiere':
          return new LightPanel(parsePuzzle(e.def), { id: e.def.id, ...at, requires: [] });
        case 'pliage':
          return new FoldView(parseFold(e.def), { ...at, cell: 0.34, kind: 'desk' });
        case 'ombres':
          return new ShadowView(parseShadow(e.def), { ...at, voxel: 0.2, stageY: 0.8 }, startState(e.def));
        case 'inclinaison':
          return new TiltView(parseTilt(e.def), { ...at, cell: 0.24, kind: 'table' });
        case 'racines': {
          const { puzzle, start } = parseRoots(e.def);
          return new RootView(puzzle, { ...at, cell: 0.2, kind: 'lectern' }, start);
        }
        case 'vases':
          return new VaseView(parseVases(e.def), { ...at, unit: 0.11, kind: 'station' });
      }
    } catch {
      return null;
    }
  }

  /** Une énigme de la grotte est résolue : un cristal de plus, puis une nouvelle énigme. */
  onSolved(view: PuzzleView): void {
    const m = ECHO_MODULES.find((x) => echoId(x.kind) === view.id);
    if (!m) return;
    this.save.counts[m.kind] = (this.save.counts[m.kind] ?? 0) + 1;
    this.world.setCrystals(this.countsAll());
    this.world.pulse(m.kind, this.time);
    this.host.celebrate(view);
    this.renew.set(m.kind, this.time + NEXT_AFTER);
  }

  /** Choisir une taille : la nouvelle énigme se forme aussitôt. */
  setTier(kind: EchoLang, tier: Tier): void {
    if (this.tierOf(kind) === tier && this.views.has(kind)) return;
    this.save.tiers[kind] = tier;
    this.world.setTier(kind, tier);
    this.host.persist();
    if (this.unlocked.has(kind)) {
      this.renew.delete(kind);
      this.request(kind);
    }
  }

  /** Les pierres de taille (on s'y tient un instant), et les énigmes qui se renouvellent. */
  update(dt: number, time: number, player: THREE.Vector3): void {
    this.time = time;
    this.world.update(time);
    for (const [kind, at] of this.renew) {
      if (time < at) continue;
      this.renew.delete(kind);
      if (this.unlocked.has(kind)) this.request(kind);
    }
    if (Math.hypot(player.x - ECHO.x, player.z - ECHO.z) > ECHO.r) {
      this.dwell = null;
      return;
    }
    let on: { kind: EchoLang; tier: number } | null = null;
    for (const m of ECHO_MODULES) {
      if (!this.unlocked.has(m.kind)) continue;
      echoStones(m).forEach((s, tier) => {
        if (Math.hypot(player.x - s.x, player.z - s.z) < s.r + 0.15) on = { kind: m.kind, tier };
      });
    }
    if (!on) {
      this.dwell = null;
      return;
    }
    const cur = on as { kind: EchoLang; tier: number };
    if (!this.dwell || this.dwell.kind !== cur.kind || this.dwell.tier !== cur.tier) this.dwell = { ...cur, t: 0 };
    this.dwell.t += dt;
    if (this.dwell.t >= DWELL && this.dwell.t - dt < DWELL) this.setTier(cur.kind, cur.tier as Tier);
  }
}
