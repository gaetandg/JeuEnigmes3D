import * as THREE from 'three';
import type { Game } from '../game/Game.ts';
import { CADRAN, FINAL_PANELS, FOLD_PANELS, GRAND_PLI, PANELS, SHADOW_PANELS, TOWERS } from '../world/layout.ts';

/** API exposée sur window.__game pour les tests de bout en bout (Playwright). */
export function exposeDebugApi(game: Game): void {
  const api = {
    ready: false,
    frames: () => game.frames,
    panels: () =>
      [...game.panels.values()].map((p) => ({ id: p.id, powered: p.powered, solved: p.solved })),
    view: (id: string) => game.view(id),
    teleport: (x: number, z: number, yaw: number, pitch = 0) => game.player.place(x, z, yaw, pitch),
    /** Résout un panneau puis applique immédiatement les conséquences (alimentation, portes). */
    solve: (id: string) => {
      const ok = game.solvePanel(id);
      game.forceUpdatePower();
      return ok;
    },
    /** Résout tous les panneaux dans l'ordre où ils s'allument. */
    solveAll: () => {
      let progress = true;
      while (progress) {
        progress = false;
        for (const spot of [...PANELS, TOWERS, ...FOLD_PANELS, GRAND_PLI, ...SHADOW_PANELS, CADRAN, ...FINAL_PANELS]) {
          if (game.solvePanel(spot.id)) {
            game.forceUpdatePower();
            progress = true;
          }
        }
      }
      return game.save.solved.slice();
    },
    interact: (id: string, k: number, reverse = false) => game.interactPanel(id, k, reverse),
    aim: (id: string, k: number) => game.aimAt(id, k),
    state: (id: string) => game.panels.get(id)?.state.slice(),
    gateOpen: (id: string) => game.gates.get(id)?.open ?? -1,
    advance: (s: number) => game.advance(s),
    player: () => ({ x: game.player.position.x, y: game.player.position.y, z: game.player.position.z }),
    move: (forward: number, right: number, seconds: number) => {
      game.player.move.forward = forward;
      game.player.move.right = right;
      const steps = Math.ceil(seconds / 0.02);
      for (let i = 0; i < steps; i++) game.player.update(0.02);
      game.player.move.forward = 0;
      game.player.move.right = 0;
    },
    info: () => game.renderer.info.render,
    camera: (px: number, py: number, pz: number, tx: number, ty: number, tz: number) => {
      game.cameraOverride = { pos: new THREE.Vector3(px, py, pz), target: new THREE.Vector3(tx, ty, tz) };
    },
    freeCamera: () => (game.cameraOverride = null),
    hovered: () => game.hoveredPiece(),
    drawCalls: () => game.lastDrawCalls,
    ended: () => game.ended,
    hint: (id: string) => game.showHint(id),
    /** aide graduée : demander (comme la touche H), et le temps passé devant une énigme */
    requestHelp: () => game.requestHelp(),
    goalRings: () => game.goalRings.active,
    help: (id: string, addStuck = 0) => game.debugHelp(id, addStuck),
    /** l'aide affichée : pièce désignée et sens du geste (clic droit si reverse) */
    hintMove: (id: string) => game.panels.get(id)?.activeHint() ?? null,
    /** pochoir raté : nombre de cases marquées en rouge */
    lightErrors: (id: string) => {
      const p = game.panels.get(id) as unknown as { lightErrorCount?: number } | undefined;
      return p?.lightErrorCount ?? 0;
    },
    /** billets du gardien : lus, survolé, lire, viser */
    notes: () => (game.save.notes ?? []).slice(),
    hoveredNote: () => game.hoveredNote,
    readNote: (id: string) => game.readNote(id),
    aimNote: (id: string) => game.aimAtNote(id),
    /** la fin : la mer a répondu ? les lanternes rentrent ? */
    /** la suite : l'Île du Ciel */
    startRise: () => game.startRise(),
    skyRisen: () => game.skyRisen,
    sequences: () => ({
      rise: !!game.rise, lift: game.lift ? (game.lift.up ? 'montée' : 'descente') : null, finale: !!game.finale,
      bascule: !!game.bascule, passage: !!game.passage, roots: !!game.rootsEnd,
    }),
    /** la suite de la suite : la bascule et la grotte des Racines */
    startBascule: () => game.startBascule(),
    deep: () => !!game.save.deep,
    cheat: (action: 'goto' | 'before' | 'upto' | 'all', id: string) => game.cheat(action, id),
    lighthouseY: () => game.lighthouseTop(),
    /** la carte du gardien : états des lanternes */
    map: () => game.mapData(),
    /** la table d'orientation : 0 enfouie, 1 sortie */
    mapTable: () => game.mapRaise,
    /** la Bulle : plongée faite, séquences */
    bubble: () => ({ visited: !!game.save.bubble, dive: !!game.dive, appel: !!game.appel, ecluse: !!game.ecluse }),
    answered: () => game.answer.answered,
    homecoming: () => game.answer.homecoming,
    guides: () => game.guides.mesh.count,
    shards: () => game.stats().shards,
    memory: () => ({ ...game.renderer.info.memory }),
    /** diagnostic : masquer / montrer un groupe de premier niveau (par son nom) */
    showGroup: (name: string, on: boolean) => {
      for (const top of game.scene.children) if ((top.name || top.type) === name) top.visible = on;
    },
    /** diagnostic : nombre de maillages visibles par groupe de premier niveau de la scène */
    sceneStats: () => {
      const out: Record<string, number> = {};
      for (const top of game.scene.children) {
        if (!top.visible) continue;
        let n = 0;
        top.traverseVisible((o) => {
          if ((o as THREE.Mesh).isMesh || (o as THREE.Points).isPoints || (o as THREE.Sprite).isSprite) n++;
        });
        const key = top.name || top.type;
        out[key] = (out[key] ?? 0) + n;
      }
      return out;
    },
    hover: (id: string, k: number | null) => game.panels.get(id)?.setHover(k),
  };
  (window as unknown as { __game: typeof api }).__game = api;
  api.ready = true;
}
