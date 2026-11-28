/**
 * Sons générés en Web Audio (aucun fichier) : vent, vagues, clics, carillons.
 * Le contexte audio ne démarre qu'après un geste du joueur (règle des navigateurs).
 */
/** Zones de l'île : chacune a sa tonalité. */
export type Zone = 'jardin' | 'atelier' | 'cloitre' | 'phare' | 'ciel' | 'racines' | 'bulle';

const ZONE_SCALES: Record<Zone, { root: number; steps: number[] }> = {
  jardin: { root: 261.63, steps: [0, 2, 4, 7, 9] }, // do, pentatonique majeure : lumineux
  atelier: { root: 293.66, steps: [0, 2, 3, 7, 9] }, // ré, couleur dorienne : feutré
  cloitre: { root: 220.0, steps: [0, 3, 5, 7, 10] }, // la, pentatonique mineure : grave
  phare: { root: 349.23, steps: [0, 2, 4, 6, 9] }, // fa, lydien : ouvert
  ciel: { root: 392.0, steps: [0, 4, 7, 11, 14] }, // sol, accord majeur septième : suspendu
  racines: { root: 146.83, steps: [0, 1, 5, 7, 8] }, // ré grave, phrygien : souterrain
  bulle: { root: 329.63, steps: [0, 2, 4, 6, 8] }, // mi, gamme par tons : en suspension, sous l'eau
};

export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private waves: GainNode | null = null;
  private wind: GainNode | null = null;
  private music: GainNode | null = null;
  /** part réverbérée (l'écho grandit sous terre) */
  private wet: GainNode | null = null;
  /** bourdon grave de la grotte */
  private drone: GainNode | null = null;
  /** 0 : dehors ; 1 : sous terre */
  private under = 0;
  /** sous terre : la grotte (gouttes) ou le fond de l'océan (bulles) */
  private underSea = false;
  private nextBar = 0;
  private zone: Zone = 'jardin';
  musicVolume = 0.5;
  volume = 0.7;

  start(): void {
    if (this.ctx) {
      void this.ctx.resume();
      return;
    }
    try {
      this.ctx = new AudioContext();
    } catch {
      return;
    }
    const ctx = this.ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.volume;
    this.master.connect(ctx.destination);
    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.impulse(2.8);
    const wet = ctx.createGain();
    wet.gain.value = 0.35;
    this.wet = wet;
    this.reverb.connect(wet).connect(this.master);
    this.ambient();
    this.startMusic();
    this.setUnderground(this.under);
  }

  /**
   * Sous terre (0..1) : plus de vent, un écho plus long, un bourdon grave, des gouttes d'eau
   * qui tombent de la voûte, et les pas qui résonnent.
   */
  setUnderground(k: number, sea = false): void {
    this.under = k;
    this.underSea = sea;
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.wind?.gain.setTargetAtTime(0.22 * (1 - k), t, 0.3);
    this.wet?.gain.setTargetAtTime(0.35 + 0.45 * k, t, 0.3);
    // sous l'eau, le bourdon est plus feutré (et les bulles remplacent les gouttes)
    this.drone?.gain.setTargetAtTime((sea ? 0.05 : 0.07) * k, t, 0.6);
  }

  /** Une bulle remonte : un petit « bloup » qui glisse vers l'aigu. */
  private bubble(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.reverb) return;
    const o = ctx.createOscillator();
    const f0 = 260 + Math.random() * 300;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f0 * 2.4, at + 0.09);
    const g = ctx.createGain();
    const peak = 0.025 + Math.random() * 0.035;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g).connect(pan);
    pan.connect(this.master);
    pan.connect(this.reverb);
    o.start(at);
    o.stop(at + 0.16);
  }

  /** Une goutte tombe de la voûte : un « plic » qui glisse vers le grave, quelque part autour. */
  private drip(at: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master || !this.reverb) return;
    const o = ctx.createOscillator();
    const f0 = 900 + Math.random() * 900;
    o.frequency.setValueAtTime(f0, at);
    o.frequency.exponentialRampToValueAtTime(f0 * 0.45, at + 0.07);
    const g = ctx.createGain();
    const peak = 0.03 + Math.random() * 0.05;
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(peak, at + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 0.12);
    const pan = ctx.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    o.connect(g).connect(pan);
    pan.connect(this.master);
    pan.connect(this.reverb);
    o.start(at);
    o.stop(at + 0.15);
  }

  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.music) this.music.gain.value = v * 0.6;
  }

  setZone(z: Zone): void {
    this.zone = z;
  }

  /**
   * Musique générée : une nappe d'accords lente (une mesure toutes les 8 s) et quelques
   * notes de carillon au hasard, dans la gamme de la zone où se trouve le joueur.
   */
  private startMusic(): void {
    const ctx = this.ctx!;
    this.music = ctx.createGain();
    this.music.gain.value = this.musicVolume * 0.6;
    this.music.connect(this.master!);
    this.music.connect(this.reverb!);
    this.nextBar = ctx.currentTime + 1;
    window.setInterval(() => this.scheduleMusic(), 500);
  }

  private note(root: number, steps: number[], degree: number): number {
    const oct = Math.floor(degree / steps.length);
    const st = steps[((degree % steps.length) + steps.length) % steps.length]! + 12 * oct;
    return root * Math.pow(2, st / 12);
  }

  private scheduleMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.music) return;
    // onglet en arrière-plan : le minuteur ralentit mais l'horloge audio continue ; on ne
    // rattrape pas les mesures manquées (elles partiraient toutes en même temps)
    if (this.nextBar < ctx.currentTime) this.nextBar = ctx.currentTime + 0.1;
    // sous terre : des gouttes, parfois deux à la suite ; sous l'eau, des chapelets de bulles
    if (this.under > 0.5 && this.underSea && Math.random() < 0.28) {
      const at = ctx.currentTime + Math.random() * 0.5;
      const n = 1 + Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) this.bubble(at + i * (0.06 + Math.random() * 0.08));
    } else if (this.under > 0.5 && !this.underSea && Math.random() < 0.22) {
      const at = ctx.currentTime + Math.random() * 0.5;
      this.drip(at);
      if (Math.random() < 0.3) this.drip(at + 0.25 + Math.random() * 0.3);
    }
    while (this.nextBar < ctx.currentTime + 2) {
      const { root, steps } = ZONE_SCALES[this.zone];
      const t = this.nextBar;
      // nappe : trois notes, attaque et extinction très lentes
      const base = Math.floor(Math.random() * 3);
      for (const d of [base, base + 2, base + 4]) this.pad(this.note(root / 2, steps, d), t, 9);
      // carillon : quelques notes aiguës, parfois aucune
      const n = Math.floor(Math.random() * 4);
      for (let i = 0; i < n; i++) {
        const when = t + 1 + Math.random() * 6;
        this.chime(this.note(root * 2, steps, Math.floor(Math.random() * 7)), when);
      }
      this.nextBar += 8;
    }
  }

  private pad(freq: number, at: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 900;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.035, at + 3);
    g.gain.linearRampToValueAtTime(0, at + dur);
    o.connect(f).connect(g).connect(this.music!);
    o.start(at);
    o.stop(at + dur + 0.1);
  }

  private chime(freq: number, at: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(0.04, at + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, at + 3.5);
    o.connect(g).connect(this.music!);
    o.start(at);
    o.stop(at + 3.6);
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }

  /** Proximité de la mer (0..1) : module le bruit des vagues. */
  setSeaProximity(p: number): void {
    if (this.waves && this.ctx) this.waves.gain.setTargetAtTime(0.05 + 0.35 * p, this.ctx.currentTime, 0.5);
  }

  private impulse(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
    }
    return buf;
  }

  private noiseBuffer(seconds: number, brown = false): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      } else d[i] = w;
    }
    return buf;
  }

  private ambient(): void {
    const ctx = this.ctx!;
    // vent : bruit brun filtré, filtre modulé lentement
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(8, true);
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 500;
    wf.Q.value = 0.6;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 250;
    lfo.connect(lfoGain).connect(wf.frequency);
    this.wind = ctx.createGain();
    this.wind.gain.value = 0.22;
    wind.connect(wf).connect(this.wind).connect(this.master!);
    wind.start();
    lfo.start();
    // vagues : bruit filtré avec une enveloppe lente
    const sea = ctx.createBufferSource();
    sea.buffer = this.noiseBuffer(8);
    sea.loop = true;
    const sf = ctx.createBiquadFilter();
    sf.type = 'lowpass';
    sf.frequency.value = 700;
    const swell = ctx.createGain();
    swell.gain.value = 0.5;
    const swellLfo = ctx.createOscillator();
    swellLfo.frequency.value = 0.12;
    const swellDepth = ctx.createGain();
    swellDepth.gain.value = 0.45;
    swellLfo.connect(swellDepth).connect(swell.gain);
    this.waves = ctx.createGain();
    this.waves.gain.value = 0.25;
    sea.connect(sf).connect(swell).connect(this.waves).connect(this.master!);
    sea.start();
    swellLfo.start();
    // bourdon de la grotte : deux graves (ré, la) qui battent lentement, muets dehors
    this.drone = ctx.createGain();
    this.drone.gain.value = 0;
    const df = ctx.createBiquadFilter();
    df.type = 'lowpass';
    df.frequency.value = 260;
    this.drone.connect(df).connect(this.master!);
    for (const f of [73.42, 110.3, 146.2]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(this.drone);
      o.start();
    }
  }

  private tone(freq: number, at: number, dur: number, gain: number, type: OscillatorType = 'sine', reverb = true): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, at);
    g.gain.linearRampToValueAtTime(gain, at + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(g).connect(this.master);
    if (reverb && this.reverb) g.connect(this.reverb);
    o.start(at);
    o.stop(at + dur + 0.05);
  }

  /** Miroir qui pivote : petit « toc » de pierre et de métal. */
  click(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(880 + Math.random() * 60, t, 0.08, 0.12, 'triangle', false);
    this.tone(220, t, 0.12, 0.15, 'sine', false);
  }

  /** Action impossible. */
  denied(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(110, t, 0.25, 0.2, 'square', false);
  }

  /** Énigme résolue : arpège pentatonique. */
  solved(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5];
    notes.forEach((f, i) => {
      this.tone(f, t + i * 0.09, 1.6, 0.11, 'sine');
      this.tone(f * 2, t + i * 0.09, 0.6, 0.03, 'triangle');
    });
  }

  /** Une porte de pierre s'ouvre. */
  rumble(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(2.5, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 180;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.9, t + 0.3);
    g.gain.linearRampToValueAtTime(0, t + 2.4);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  /** Une feuille de papier se plie : froissement bref. */
  fold(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.5);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.value = 2400;
    f.Q.value = 0.8;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.25, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  /** Un pas dans l'herbe ou sur la pierre : bruit bref et feutré. */
  step(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(0.12);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 500 + Math.random() * 250;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0.0, t);
    g.gain.linearRampToValueAtTime(0.09, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.11);
    src.connect(f).connect(g).connect(this.master);
    // sous terre, les pas résonnent
    if (this.under > 0.5 && this.reverb) g.connect(this.reverb);
    src.start();
  }

  /** Les billes roulent sur la pierre : un grondement doux qui vibre, de la durée du geste. */
  roll(dur: number, big = false): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.15, true);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = big ? 240 : 480;
    // le roulement : une vibration rapide sur le volume
    const trem = ctx.createGain();
    trem.gain.value = 0.7;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = big ? 11 : 19;
    const depth = ctx.createGain();
    depth.gain.value = 0.3;
    lfo.connect(depth).connect(trem.gain);
    const g = ctx.createGain();
    const t = ctx.currentTime;
    const peak = big ? 0.5 : 0.32;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(peak, t + 0.06);
    g.gain.setValueAtTime(peak, t + Math.max(0.07, dur - 0.08));
    g.gain.linearRampToValueAtTime(0, t + dur + 0.1);
    src.connect(f).connect(trem).connect(g).connect(this.master);
    src.start(t);
    lfo.start(t);
    src.stop(t + dur + 0.15);
    lfo.stop(t + dur + 0.15);
  }

  /** L'eau coule d'un tube à l'autre : un glouglou doux, plus long quand on verse beaucoup. */
  pour(amount: number): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const dur = 0.35 + Math.min(1.2, amount * 0.09);
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur + 0.1);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 6;
    // le glouglou : la fréquence sautille, et monte à mesure que le tube se remplit
    for (let k = 0; k < Math.ceil(dur / 0.07); k++) f.frequency.setValueAtTime(380 + k * 22 + Math.random() * 160, t + k * 0.07);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.35, t + 0.05);
    g.gain.setValueAtTime(0.35, t + dur - 0.1);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.master);
    if (this.reverb) g.connect(this.reverb);
    src.start(t);
    src.stop(t + dur + 0.1);
  }

  /** Une bille bute (mur, bord, autre bille) : petit choc sourd. */
  bump(big = false): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(big ? 95 : 150, t, 0.12, 0.09, 'triangle', false);
    this.tone(big ? 190 : 300, t, 0.05, 0.03, 'sine', false);
  }

  /** Une bille se loge dans son creux : un « toc » de bois et une note claire. */
  home(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(220, t, 0.1, 0.08, 'triangle', false);
    this.tone(880, t + 0.03, 0.9, 0.05, 'sine');
    this.tone(1318.5, t + 0.03, 0.6, 0.02, 'sine');
  }

  /** Une bille tombe dans un puits : elle s'éloigne vers le grave. */
  pit(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const o = ctx.createOscillator();
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(520, t);
    o.frequency.exponentialRampToValueAtTime(60, t + 0.6);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.65);
    o.connect(g).connect(this.master);
    if (this.reverb) g.connect(this.reverb);
    o.start(t);
    o.stop(t + 0.7);
  }

  /** Le phare se rallume : longue montée d'accords. */
  finale(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const chords = [[261.63, 329.63, 392], [293.66, 369.99, 440], [329.63, 415.3, 493.88], [392, 493.88, 587.33, 783.99]];
    chords.forEach((ch, i) => ch.forEach((f) => this.tone(f, t + i * 0.9, 3.2, 0.06, 'sine')));
  }

  /** Un cristal s'allume : une note de carillon propre à sa couleur. */
  crystal(color: number): void {
    const ctx = this.ctx;
    if (!ctx) return;
    // rouge, vert, bleu, jaune, magenta, cyan, blanc : une gamme qui sonne ensemble
    const notes: Record<number, number> = { 1: 659.25, 2: 783.99, 4: 987.77, 3: 880, 5: 1046.5, 6: 1174.66, 7: 1318.5 };
    const f = notes[color] ?? 880;
    const t = ctx.currentTime;
    this.tone(f, t, 1.8, 0.07, 'sine');
    this.tone(f * 2, t, 0.7, 0.02, 'sine');
  }

  /** La lumière court dans un câble : glissando doux et montant. */
  cable(): void {
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const t = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(320, t);
    o.frequency.exponentialRampToValueAtTime(960, t + 1.2);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.035, t + 0.15);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(g).connect(this.master);
    if (this.reverb) g.connect(this.reverb);
    o.start(t);
    o.stop(t + 1.5);
  }

  /** Un panneau s'allume. */
  power(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    this.tone(392, t, 0.9, 0.06, 'sine');
    this.tone(587.33, t + 0.12, 0.9, 0.05, 'sine');
  }
}
