import type { Player } from './player.ts';

/**
 * Contrôles tactiles (téléphone, tablette) :
 *  - moitié gauche : joystick virtuel pour marcher (pousser loin = courir) ;
 *  - moitié droite : glisser pour regarder, toucher bref pour agir sur ce qui est
 *    sous le viseur, appui long pour agir en sens inverse.
 */
export class TouchInput {
  private stick: { id: number; x0: number; y0: number } | null = null;
  private look: { id: number; x: number; y: number; t0: number; moved: number; long: boolean } | null = null;
  private longTimer = 0;
  private base: HTMLElement;
  private knob: HTMLElement;
  /** agir (inverse = appui long) */
  onTap: ((reverse: boolean) => void) | null = null;
  enabled = false;

  static supported(): boolean {
    return typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0) && matchMedia('(pointer: coarse)').matches;
  }

  constructor(el: HTMLElement, private ui: HTMLElement, private player: Player) {
    this.base = document.createElement('div');
    this.base.className = 'stick';
    this.knob = document.createElement('div');
    this.knob.className = 'knob';
    this.base.appendChild(this.knob);
    this.base.hidden = true;
    this.ui.appendChild(this.base);
    const opts = { passive: false } as AddEventListenerOptions;
    el.addEventListener('touchstart', (e) => this.start(e), opts);
    el.addEventListener('touchmove', (e) => this.move(e), opts);
    el.addEventListener('touchend', (e) => this.end(e), opts);
    el.addEventListener('touchcancel', (e) => this.end(e), opts);
  }

  private start(e: TouchEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (t.clientX < window.innerWidth * 0.42 && !this.stick) {
        this.stick = { id: t.identifier, x0: t.clientX, y0: t.clientY };
        this.base.hidden = false;
        this.base.style.left = `${t.clientX - 60}px`;
        this.base.style.top = `${t.clientY - 60}px`;
        this.knob.style.transform = 'translate(0px, 0px)';
      } else if (!this.look) {
        // horodatage de l'événement (et non de son traitement) : fiable même si une image est lente
        this.look = { id: t.identifier, x: t.clientX, y: t.clientY, t0: e.timeStamp, moved: 0, long: false };
        clearTimeout(this.longTimer);
        this.longTimer = window.setTimeout(() => {
          if (this.look && this.look.moved < 12) {
            this.look.long = true;
            this.onTap?.(true);
            navigator.vibrate?.(15);
          }
        }, 450);
      }
    }
  }

  private move(e: TouchEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.stick && t.identifier === this.stick.id) {
        const dx = t.clientX - this.stick.x0;
        const dy = t.clientY - this.stick.y0;
        const len = Math.hypot(dx, dy);
        const max = 55;
        const k = len > max ? max / len : 1;
        this.knob.style.transform = `translate(${dx * k}px, ${dy * k}px)`;
        this.player.move.forward = -(dy * k) / max;
        this.player.move.right = (dx * k) / max;
        this.player.move.run = len > max * 1.4;
      } else if (this.look && t.identifier === this.look.id) {
        const dx = t.clientX - this.look.x;
        const dy = t.clientY - this.look.y;
        this.look.moved += Math.abs(dx) + Math.abs(dy);
        this.look.x = t.clientX;
        this.look.y = t.clientY;
        // un doigt est moins précis qu'une souris : sensibilité adaptée
        this.player.look(dx * 1.6, dy * 1.6);
      }
    }
  }

  private end(e: TouchEvent): void {
    if (!this.enabled) return;
    e.preventDefault();
    for (const t of Array.from(e.changedTouches)) {
      if (this.stick && t.identifier === this.stick.id) {
        this.stick = null;
        this.base.hidden = true;
        this.player.move.forward = 0;
        this.player.move.right = 0;
        this.player.move.run = false;
      } else if (this.look && t.identifier === this.look.id) {
        clearTimeout(this.longTimer);
        // un toucher sans glissement est une action ; l'appui long a déjà agi (sens inverse)
        if (this.look.moved < 12 && !this.look.long) this.onTap?.(false);
        this.look = null;
      }
    }
  }
}
