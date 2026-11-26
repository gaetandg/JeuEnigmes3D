/**
 * Interface minimale : écran titre, viseur, menu pause.
 * Le monde du jeu reste sans texte ; seuls les menus en contiennent.
 */
import type { Quality, Settings } from '../game/progress.ts';

export interface HudCallbacks {
  onStart: () => void;
  onVolume: (v: number) => void;
  onSensitivity: (v: number) => void;
  onQuality: (q: Quality) => void;
  onSymbols: (on: boolean) => void;
  onHints: (on: boolean) => void;
  onMusic: (v: number) => void;
  onComfort: (patch: Partial<Settings>) => void;
  onPause: () => void;
  onReset: () => void;
}

export class Hud {
  private root: HTMLElement;
  private title: HTMLElement;
  private crosshair: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private pauseBtn: HTMLButtonElement;
  private touch: boolean;

  constructor(parent: HTMLElement, cb: HudCallbacks, settings: Settings, hasSave: boolean, touch: boolean) {
    this.root = parent;
    this.root.innerHTML = `
      <div class="crosshair" hidden></div>
      <div class="toast" hidden></div>
      <button class="pause" data-action="pause" hidden aria-label="Pause">❚❚</button>
      <div class="overlay" data-screen="title">
        <div class="panel">
          <h1>Lueur</h1>
          <p class="subtitle">Une île. Des ruines. Un phare éteint.</p>
          <button class="primary" data-action="start">${hasSave ? 'Reprendre' : 'Commencer'}</button>
          <details>
            <summary>Réglages</summary>
            <label>Volume <input type="range" min="0" max="1" step="0.05" data-setting="volume" /></label>
            <label>Musique <input type="range" min="0" max="1" step="0.05" data-setting="music" /></label>
            <label>Sensibilité <input type="range" min="0.0008" max="0.005" step="0.0001" data-setting="sensitivity" /></label>
            <label>Qualité graphique
              <select data-setting="quality">
                <option value="haute">Haute</option>
                <option value="moyenne">Moyenne</option>
                <option value="basse">Basse</option>
              </select>
            </label>
            <label>Symboles des couleurs (daltonisme) <input type="checkbox" data-setting="symbols" /></label>
            <label>Aides discrètes si l'on bloque longtemps <input type="checkbox" data-setting="hints" /></label>
            <label>Guide lumineux vers les énigmes en attente <input type="checkbox" data-setting="guides" /></label>
            <label>Champ de vision <input type="range" min="55" max="100" step="1" data-setting="fov" /></label>
            <label>Inverser l'axe vertical <input type="checkbox" data-setting="invertY" /></label>
            <label>Balancement de la marche <input type="checkbox" data-setting="bob" /></label>
            <button class="ghost" data-action="reset">Recommencer depuis le début</button>
          </details>
          <p class="help">${touch
            ? 'Pouce gauche : marcher · Glisser à droite : regarder<br/>Toucher : agir · Appui long : agir en sens inverse'
            : 'Souris : regarder · ZQSD / WASD / flèches : marcher · Maj : courir<br/>Clic gauche : agir · Clic droit : agir en sens inverse · Échap : pause'}</p>
        </div>
      </div>`;
    this.title = this.root.querySelector('.overlay')!;
    this.crosshair = this.root.querySelector('.crosshair')!;
    this.toast = this.root.querySelector('.toast')!;
    const vol = this.root.querySelector<HTMLInputElement>('[data-setting="volume"]')!;
    const sens = this.root.querySelector<HTMLInputElement>('[data-setting="sensitivity"]')!;
    const quality = this.root.querySelector<HTMLSelectElement>('[data-setting="quality"]')!;
    const symbols = this.root.querySelector<HTMLInputElement>('[data-setting="symbols"]')!;
    vol.value = String(settings.volume);
    sens.value = String(settings.sensitivity);
    quality.value = settings.quality ?? 'haute';
    symbols.checked = !!settings.symbols;
    quality.addEventListener('change', () => cb.onQuality(quality.value as Quality));
    symbols.addEventListener('change', () => cb.onSymbols(symbols.checked));
    const music = this.root.querySelector<HTMLInputElement>('[data-setting="music"]')!;
    music.value = String(settings.music ?? 0.5);
    music.addEventListener('input', () => cb.onMusic(Number(music.value)));
    const q = (k: string) => this.root.querySelector<HTMLInputElement>(`[data-setting="${k}"]`)!;
    const guides = q('guides');
    guides.checked = settings.guides !== false;
    guides.addEventListener('change', () => cb.onComfort({ guides: guides.checked }));
    const fov = q('fov');
    fov.value = String(settings.fov ?? 70);
    fov.addEventListener('input', () => cb.onComfort({ fov: Number(fov.value) }));
    const inv = q('invertY');
    inv.checked = !!settings.invertY;
    inv.addEventListener('change', () => cb.onComfort({ invertY: inv.checked }));
    const bob = q('bob');
    bob.checked = settings.bob !== false;
    bob.addEventListener('change', () => cb.onComfort({ bob: bob.checked }));
    const hints = this.root.querySelector<HTMLInputElement>('[data-setting="hints"]')!;
    hints.checked = settings.hints !== false;
    hints.addEventListener('change', () => cb.onHints(hints.checked));
    this.pauseBtn = this.root.querySelector<HTMLButtonElement>('[data-action="pause"]')!;
    this.pauseBtn.addEventListener('click', () => cb.onPause());
    this.touch = touch;
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
    this.pauseBtn.hidden = true;
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
    if (paused) btn.textContent = 'Reprendre';
  }

  hideTitle(): void {
    this.title.hidden = true;
    this.crosshair.hidden = false;
    this.pauseBtn.hidden = !this.touch;
  }

  setCrosshairActive(active: boolean): void {
    this.crosshair.classList.toggle('active', active);
  }

  /** Écran de fin. */
  showEnding(stats: { solved: number; total: number; minutes: number; shards: number; shardsTotal: number }): void {
    const el = document.createElement('div');
    el.className = 'overlay ending';
    el.innerHTML = `
      <div class="panel">
        <h1>Lueur</h1>
        <p class="subtitle">Le phare brille à nouveau.</p>
        <p>${stats.solved} énigmes sur ${stats.total} · ${stats.minutes} min de jeu</p>
        <p>${stats.shards === stats.shardsTotal ? 'Les sept éclats sont réunis : toute la lumière de l\'île.' : `Éclats trouvés : ${stats.shards} / ${stats.shardsTotal} — l'île cache encore des secrets.`}</p>
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
