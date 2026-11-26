import type { Player } from './player.ts';

/**
 * Manette (API Gamepad, disposition standard) :
 * stick gauche = marcher (enfoncé à fond = courir), stick droit = regarder,
 * A = agir, B ou X = agir en sens inverse, Start = pause.
 */
export class GamepadInput {
  private prev: boolean[] = [];
  onAct: ((reverse: boolean) => void) | null = null;
  onStart: (() => void) | null = null;
  active = false;

  constructor(private player: Player) {}

  poll(dt: number, playing: boolean): void {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = Array.from(pads).find((p) => p && p.connected);
    if (!pad) {
      if (this.active) {
        this.player.move.forward = 0;
        this.player.move.right = 0;
      }
      this.active = false;
      return;
    }
    const dz = (v: number) => (Math.abs(v) < 0.15 ? 0 : v);
    const pressed = pad.buttons.map((b) => b.pressed);
    const edge = (i: number) => !!pressed[i] && !this.prev[i];
    if (edge(9) || (!playing && edge(0))) this.onStart?.();
    if (playing) {
      const lx = dz(pad.axes[0] ?? 0);
      const ly = dz(pad.axes[1] ?? 0);
      const rx = dz(pad.axes[2] ?? 0);
      const ry = dz(pad.axes[3] ?? 0);
      if (lx || ly || this.active) {
        this.player.move.right = lx;
        this.player.move.forward = -ly;
        this.player.move.run = Math.hypot(lx, ly) > 0.95 || !!pressed[10];
      }
      // le stick droit tourne le regard à vitesse constante (indépendante de la souris)
      if (rx || ry) this.player.lookRadians(-rx * 2.4 * dt, -ry * 1.8 * dt);
      if (edge(0)) this.onAct?.(false);
      if (edge(1) || edge(2)) this.onAct?.(true);
      this.active = true;
    }
    this.prev = pressed;
  }
}
