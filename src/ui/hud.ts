/**
 * Interface minimale : écran titre, viseur, menu pause.
 * Le monde du jeu reste sans texte ; seuls les menus en contiennent.
 */
export interface HudCallbacks {
  onStart: () => void;
  onVolume: (v: number) => void;
  onSensitivity: (v: number) => void;
  onReset: () => void;
}

export class Hud {
  private root: HTMLElement;
  private title: HTMLElement;
  private crosshair: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;

  constructor(parent: HTMLElement, cb: HudCallbacks, settings: { volume: number; sensitivity: number }, hasSave: boolean) {
    this.root = parent;
    this.root.innerHTML = `
      <div class="crosshair" hidden></div>
      <div class="toast" hidden></div>
      <div class="overlay" data-screen="title">
        <div class="panel">
          <h1>Lueur</h1>
          <p class="subtitle">Une île. Des ruines. Un phare éteint.</p>
          <button class="primary" data-action="start">${hasSave ? 'Reprendre' : 'Commencer'}</button>
          <details>
            <summary>Réglages</summary>
            <label>Volume <input type="range" min="0" max="1" step="0.05" data-setting="volume" /></label>
            <label>Sensibilité de la souris <input type="range" min="0.0008" max="0.005" step="0.0001" data-setting="sensitivity" /></label>
            <button class="ghost" data-action="reset">Recommencer depuis le début</button>
          </details>
          <p class="help">Souris : regarder · ZQSD / WASD / flèches : marcher · Maj : courir<br/>
          Clic gauche : agir · Clic droit : agir en sens inverse · Échap : pause</p>
        </div>
      </div>`;
    this.title = this.root.querySelector('.overlay')!;
    this.crosshair = this.root.querySelector('.crosshair')!;
    this.toast = this.root.querySelector('.toast')!;
    const vol = this.root.querySelector<HTMLInputElement>('[data-setting="volume"]')!;
    const sens = this.root.querySelector<HTMLInputElement>('[data-setting="sensitivity"]')!;
    vol.value = String(settings.volume);
    sens.value = String(settings.sensitivity);
    vol.addEventListener('input', () => cb.onVolume(Number(vol.value)));
    sens.addEventListener('input', () => cb.onSensitivity(Number(sens.value)));
    this.root.querySelector('[data-action="start"]')!.addEventListener('click', () => cb.onStart());
    this.root.querySelector('[data-action="reset"]')!.addEventListener('click', () => {
      if (confirm('Effacer la progression et recommencer ?')) cb.onReset();
    });
  }

  showTitle(paused: boolean): void {
    this.title.hidden = false;
    this.crosshair.hidden = true;
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
    if (paused) btn.textContent = 'Reprendre';
  }

  hideTitle(): void {
    this.title.hidden = true;
    this.crosshair.hidden = false;
  }

  setCrosshairActive(active: boolean): void {
    this.crosshair.classList.toggle('active', active);
  }

  /** Écran de fin. */
  showEnding(stats: { solved: number; total: number; minutes: number }): void {
    const el = document.createElement('div');
    el.className = 'overlay ending';
    el.innerHTML = `
      <div class="panel">
        <h1>Lueur</h1>
        <p class="subtitle">Le phare brille à nouveau.</p>
        <p>${stats.solved} énigmes sur ${stats.total} · ${stats.minutes} min de jeu</p>
        <p class="help">Merci d'avoir joué.<br/>Un jeu imaginé avec gaetandg et entièrement conçu, codé et testé par Claude.</p>
        <button class="primary" data-action="continue">Continuer à explorer</button>
      </div>`;
    this.root.appendChild(el);
    document.exitPointerLock?.();
    el.querySelector('[data-action="continue"]')!.addEventListener('click', () => {
      el.remove();
      this.onContinue?.();
    });
  }

  onContinue: (() => void) | null = null;

  /** Message discret (uniquement pour les menus/erreurs, jamais pour les énigmes). */
  notify(msg: string): void {
    this.toast.textContent = msg;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), 3000);
  }
}
