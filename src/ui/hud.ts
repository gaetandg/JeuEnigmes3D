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
  /** mode test : aller devant une énigme, valider ce qui la précède (ou jusqu'à elle), tout valider */
  onCheat: (action: CheatAction, id: string) => void;
  /** mode test : rejouer une cinématique (sans toucher à la progression) */
  onCinematic: (which: Cinematic) => void;
  /** mode test : se téléporter à un lieu (sans toucher à la progression) */
  onTeleport: (place: string) => void;
  /** le joueur demande de l'aide (lanterne touchée) */
  onHelp: () => void;
}

export type Cinematic = 'phare' | 'ile' | 'vraie' | 'bascule' | 'racines' | 'appel' | 'ecluse';

export type CheatAction = 'goto' | 'before' | 'upto' | 'all';
/** Énigmes proposées au mode test, groupées par zone, dans l'ordre de progression. */
export type CheatList = { group: string; items: { id: string; label: string }[] }[];

export class Hud {
  private root: HTMLElement;
  private title: HTMLElement;
  private crosshair: HTMLElement;
  private toast: HTMLElement;
  private toastTimer = 0;
  private pauseBtn: HTMLButtonElement;
  private touch: boolean;

  constructor(parent: HTMLElement, cb: HudCallbacks, settings: Settings, hasSave: boolean, touch: boolean, cheats: CheatList = [], places: { id: string; label: string }[] = []) {
    const esc = (t: string) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
    const cheatOptions = cheats
      .map((g) => `<optgroup label="${esc(g.group)}">${g.items.map((i) => `<option value="${esc(i.id)}">${esc(i.label)}</option>`).join('')}</optgroup>`)
      .join('');
    this.root = parent;
    this.root.innerHTML = `
      <div class="crosshair" hidden></div>
      <div class="mouse-hint" hidden aria-live="polite">
        <svg class="mouse" viewBox="0 0 40 56" width="30" height="42" aria-hidden="true">
          <rect x="2" y="2" width="36" height="52" rx="18" class="body"/>
          <path d="M20 2 V22" class="seam"/>
          <path d="M2 22 H38" class="seam"/>
          <path d="M20 2 A18 18 0 0 0 2 20 V22 H20 Z" class="btn btn-left"/>
          <path d="M20 2 A18 18 0 0 1 38 20 V22 H20 Z" class="btn btn-right"/>
        </svg>
        <!-- au tactile : un doigt qui touche (onde), ou qui reste appuyé (arc qui se remplit) -->
        <svg class="touch-icon" viewBox="0 0 44 44" width="38" height="38" aria-hidden="true">
          <circle cx="22" cy="22" r="15" class="ripple"/>
          <path d="M22 4 A18 18 0 1 1 4 22" class="hold"/>
          <circle cx="22" cy="22" r="8" class="tip"/>
        </svg>
      </div>
      <!-- l'aide : une lanterne, quand on est depuis un moment devant une énigme ; touche H -->
      <button class="help-lamp" hidden aria-label="Aide (touche H)">
        <svg viewBox="0 0 40 52" width="30" height="39" aria-hidden="true">
          <path d="M14 8 H26 M20 3 V8" class="lamp-frame"/>
          <rect x="9" y="8" width="22" height="30" rx="7" class="lamp-glass"/>
          <path d="M20 16 C16 22 16 28 20 31 C24 28 24 22 20 16 Z" class="lamp-flame"/>
          <path d="M11 38 H29 L26 44 H14 Z" class="lamp-frame"/>
        </svg>
        <span class="lamp-key" aria-hidden="true">${touch ? '' : 'H'}</span>
      </button>
      <div class="toast" hidden></div>
      <div class="fade"></div>
      <div class="note-card" hidden>
        <p class="note-text"></p>
        <p class="note-meta"></p>
      </div>
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
            <label>Aide à la demande (lanterne, touche H) <input type="checkbox" data-setting="hints" /></label>
            <label>Guide lumineux vers les énigmes en attente <input type="checkbox" data-setting="guides" /></label>
            <label>Champ de vision <input type="range" min="55" max="100" step="1" data-setting="fov" /></label>
            <label>Inverser l'axe vertical <input type="checkbox" data-setting="invertY" /></label>
            <label>Balancement de la marche <input type="checkbox" data-setting="bob" /></label>
            <button class="ghost" data-action="reset">Recommencer depuis le début</button>
          </details>
          <details class="journal">
            <summary>Carnet du gardien <span class="journal-count"></span></summary>
            <ol class="journal-list"></ol>
          </details>
          <details class="cheat">
            <summary>Mode test (triche)</summary>
            <label>Énigme <select data-cheat="target">${cheatOptions}</select></label>
            <div class="cheat-actions">
              <button class="ghost" data-cheat="goto" title="Se téléporter devant l'énigme">Y aller</button>
              <button class="ghost" data-cheat="before" title="Résoudre tout ce qui vient avant, puis y aller">Valider ce qui précède</button>
              <button class="ghost" data-cheat="upto" title="Résoudre tout ce qui vient avant et celle-ci, puis y aller">Valider jusqu'ici</button>
              <button class="ghost" data-cheat="all" title="Résoudre toutes les énigmes principales">Tout résoudre</button>
            </div>
            <p class="cheat-note">Place la progression exactement à ce point (en avant comme en arrière), portes et câbles compris, et sauvegarde.</p>
            <label>Lieu <select data-cheat="place">${places.map((p) => `<option value="${esc(p.id)}">${esc(p.label)}</option>`).join('')}</select></label>
            <div class="cheat-actions">
              <button class="ghost" data-cheat="tp" title="Aller à ce lieu sans rien changer à la progression">Se téléporter</button>
            </div>
            <label>Cinématique
              <select data-cheat="cinematic">
                <option value="phare">Le phare se rallume (fin)</option>
                <option value="ile">L'île surgit de la mer</option>
                <option value="vraie">La vraie fin (les lanternes)</option>
                <option value="bascule">L'île bascule (la chute)</option>
                <option value="racines">Les racines reliées (le phare remonte)</option>
                <option value="appel">Le phare montre la mer (la Bulle)</option>
                <option value="ecluse">La Grande Écluse (la Bulle répond)</option>
              </select>
            </label>
            <div class="cheat-actions">
              <button class="ghost" data-cheat="watch">Voir la cinématique</button>
            </div>
          </details>
          <p class="help">${touch
            ? 'Pouce gauche : marcher · Glisser à droite : regarder<br/>Toucher : agir · Appui long : agir en sens inverse'
            : 'Souris : regarder · ZQSD / WASD / flèches : marcher · Maj : courir<br/>Clic gauche : agir · Clic droit : agir en sens inverse · H : aide · Échap : pause'}</p>
        </div>
      </div>`;
    this.title = this.root.querySelector('.overlay')!;
    const target = this.root.querySelector<HTMLSelectElement>('[data-cheat="target"]')!;
    const cine = this.root.querySelector<HTMLSelectElement>('[data-cheat="cinematic"]')!;
    this.root.querySelector('[data-cheat="watch"]')!.addEventListener('click', () => {
      cb.onStart(); // la souris se libère d'elle-même pendant la séquence
      cb.onCinematic(cine.value as Cinematic);
    });
    this.helpLamp = this.root.querySelector<HTMLButtonElement>('.help-lamp')!;
    this.helpLamp.addEventListener('click', () => cb.onHelp());
    const place = this.root.querySelector<HTMLSelectElement>('[data-cheat="place"]')!;
    this.root.querySelector('[data-cheat="tp"]')!.addEventListener('click', () => {
      cb.onTeleport(place.value);
      cb.onStart();
    });
    for (const action of ['goto', 'before', 'upto', 'all'] as const) {
      this.root.querySelector(`[data-cheat="${action}"]`)!.addEventListener('click', () => {
        cb.onCheat(action, target.value);
        cb.onStart(); // reprendre la partie tout de suite, devant l'énigme
      });
    }
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

  private helpLamp: HTMLButtonElement;
  private helpState: 'none' | 'ready' | 'offer' = 'none';

  /** La lanterne d'aide : absente, disponible, ou qui palpite (on bloque depuis longtemps). */
  setHelp(state: 'none' | 'ready' | 'offer'): void {
    const st = this.title.hidden ? state : 'none';
    if (st === this.helpState) return;
    this.helpState = st;
    this.helpLamp.hidden = st === 'none';
    this.helpLamp.classList.toggle('offer', st === 'offer');
  }

  showTitle(paused: boolean): void {
    this.title.hidden = false;
    this.crosshair.hidden = true;
    this.setMouseHint(null);
    this.pauseBtn.hidden = true;
    const btn = this.root.querySelector<HTMLButtonElement>('[data-action="start"]')!;
    if (paused) btn.textContent = 'Reprendre';
  }

  hideTitle(): void {
    this.title.hidden = true;
    this.crosshair.hidden = false;
    this.mouseHintShown = null; // recalculée à la prochaine image
    this.pauseBtn.hidden = !this.touch;
  }

  setCrosshairActive(active: boolean): void {
    this.crosshair.classList.toggle('active', active);
  }

  /**
   * Quand l'aide désigne la pièce visée : la souris avec le bon bouton allumé (ou, au tactile,
   * « toucher » / « appui long »). null : rien à montrer.
   */
  setMouseHint(button: 'left' | 'right' | null): void {
    const show = button !== null && this.title.hidden ? button : null;
    if (show === this.mouseHintShown) return;
    this.mouseHintShown = show;
    const el = this.root.querySelector<HTMLElement>('.mouse-hint')!;
    el.hidden = show === null;
    if (!show) return;
    el.classList.toggle('left', show === 'left');
    el.classList.toggle('right', show === 'right');
    el.classList.toggle('touch', this.touch);
    // pas de texte à l'écran : le dessin suffit (le nom reste pour les lecteurs d'écran)
    el.setAttribute('aria-label', this.touch ? (show === 'right' ? 'appui long' : 'toucher') : (show === 'right' ? 'clic droit' : 'clic gauche'));
  }
  private mouseHintShown: 'left' | 'right' | null = null;

  /** Écran de fin. */
  showEnding(stats: { solved: number; total: number; minutes: number; shards: number; shardsTotal: number; notes: number; notesTotal: number; story: string }): void {
    const el = document.createElement('div');
    el.className = 'overlay ending';
    el.innerHTML = `
      <div class="panel">
        <h1>Lueur</h1>
        <p class="subtitle">Le phare brille à nouveau.</p>
        <p class="story">${stats.story}</p>
        <p>${stats.solved} énigmes sur ${stats.total} · ${stats.minutes} min de jeu</p>
        <p>${stats.shards === stats.shardsTotal ? 'Les sept éclats sont réunis : toute la lumière de l\'île.' : `Éclats trouvés : ${stats.shards} / ${stats.shardsTotal} — l'île cache encore des secrets.`}</p>
        <p>Billets du gardien lus : ${stats.notes} / ${stats.notesTotal}</p>
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

  /** Fondu au noir (1 : noir complet ; 0 : rien), en `ms` millisecondes. */
  fade(to: number, ms = 600): void {
    const el = this.root.querySelector<HTMLElement>('.fade')!;
    el.style.transition = `opacity ${ms}ms linear`;
    el.style.opacity = String(to);
  }

  /** La vraie fin : la dernière lettre du gardien. */
  showFinale(letter: string, stats: { solved: number; total: number; minutes: number; shards: number; shardsTotal: number; notes: number; notesTotal: number }, subtitle = 'Les lanternes ont rejoint les étoiles.', button = 'Rester sur l\'île'): void {
    const el = document.createElement('div');
    el.className = 'overlay ending finale';
    el.innerHTML = `
      <div class="panel">
        <h1>Lueur</h1>
        <p class="subtitle"></p>
        <p class="story letter"></p>
        <p>${stats.solved} énigmes sur ${stats.total} · ${stats.minutes} min de jeu</p>
        <p>Éclats : ${stats.shards} / ${stats.shardsTotal} · Billets du gardien : ${stats.notes} / ${stats.notesTotal}</p>
        <button class="primary" data-action="continue"></button>
      </div>`;
    el.querySelector('.letter')!.textContent = letter;
    el.querySelector('.subtitle')!.textContent = subtitle;
    el.querySelector('[data-action="continue"]')!.textContent = button;
    this.root.appendChild(el);
    document.exitPointerLock?.();
    el.querySelector('[data-action="continue"]')!.addEventListener('click', () => {
      el.remove();
      this.onContinue?.();
    });
  }

  /** Un billet du gardien, lu à l'écran (se ferme au clic suivant ou en s'éloignant). */
  showNote(text: string, meta: string): void {
    const card = this.root.querySelector<HTMLElement>('.note-card')!;
    card.querySelector('.note-text')!.textContent = text;
    card.querySelector('.note-meta')!.textContent = meta;
    card.hidden = false;
  }

  closeNote(): void {
    this.root.querySelector<HTMLElement>('.note-card')!.hidden = true;
  }

  get noteOpen(): boolean {
    return !this.root.querySelector<HTMLElement>('.note-card')!.hidden;
  }

  /** Le carnet (menu pause) : les billets lus, dans l'ordre du récit ; les autres restent à trouver. */
  setJournal(entries: { zone: string; text: string | null }[]): void {
    const read = entries.filter((e) => e.text).length;
    this.root.querySelector('.journal-count')!.textContent = `(${read} / ${entries.length})`;
    const list = this.root.querySelector('.journal-list')!;
    list.innerHTML = '';
    for (const e of entries) {
      const li = document.createElement('li');
      if (e.text) li.textContent = e.text;
      else {
        li.className = 'missing';
        li.textContent = `… un billet reste à trouver ${e.zone}`;
      }
      list.appendChild(li);
    }
  }

  /** Message discret (uniquement pour les menus/erreurs, jamais pour les énigmes). */
  notify(msg: string): void {
    this.toast.textContent = msg;
    this.toast.hidden = false;
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => (this.toast.hidden = true), 3000);
  }
}
