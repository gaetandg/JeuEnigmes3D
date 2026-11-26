/**
 * Sons générés en Web Audio (aucun fichier) : vent, vagues, clics, carillons.
 * Le contexte audio ne démarre qu'après un geste du joueur (règle des navigateurs).
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private reverb: ConvolverNode | null = null;
  private waves: GainNode | null = null;
  private wind: GainNode | null = null;
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
    this.reverb.connect(wet).connect(this.master);
    this.ambient();
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

  /** Le phare se rallume : longue montée d'accords. */
  finale(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const t = ctx.currentTime;
    const chords = [[261.63, 329.63, 392], [293.66, 369.99, 440], [329.63, 415.3, 493.88], [392, 493.88, 587.33, 783.99]];
    chords.forEach((ch, i) => ch.forEach((f) => this.tone(f, t + i * 0.9, 3.2, 0.06, 'sine')));
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
