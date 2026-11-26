import * as THREE from 'three';
import type { Game } from '../game/Game.ts';
import { PANELS } from '../world/layout.ts';

/** API exposée sur window.__game pour les tests de bout en bout (Playwright). */
export function exposeDebugApi(game: Game): void {
  const api = {
    ready: false,
    frames: () => game.frames,
    panels: () =>
      [...game.panels.values()].map((p) => ({ id: p.puzzle.id, powered: p.powered, solved: p.solved })),
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
        for (const spot of PANELS) {
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
  };
  (window as unknown as { __game: typeof api }).__game = api;
  api.ready = true;
}
