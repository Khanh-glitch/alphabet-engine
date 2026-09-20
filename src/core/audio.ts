/**
 * Procedural audio.
 *
 * No sample assets: every sound is synthesised, which keeps the build small and
 * lets the cascade ladder rise in pitch with chain depth. Silently degrades when
 * Web Audio is unavailable (headless rendering, autoplay locks).
 */
type Ctx = AudioContext;

class Sfx {
  private ctx: Ctx | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private step = 0;
  settings = { master: 0.8, music: 0.5, sfx: 0.8 };

  private ensure(): Ctx | null {
    if (typeof window === 'undefined') return null;
    if (this.ctx) return this.ctx;
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.settings.master;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = this.settings.sfx;
      this.sfxGain.connect(this.master);
      this.musicGain = this.ctx.createGain();
      this.musicGain.gain.value = this.settings.music * 0.5;
      this.musicGain.connect(this.master);
      return this.ctx;
    } catch {
      return null;
    }
  }

  unlock(): void {
    const ctx = this.ensure();
    if (ctx && ctx.state === 'suspended') void ctx.resume();
  }

  applySettings(s: { master: number; music: number; sfx: number }): void {
    this.settings = { ...s };
    if (this.master) this.master.gain.value = s.master;
    if (this.sfxGain) this.sfxGain.gain.value = s.sfx;
    if (this.musicGain) this.musicGain.gain.value = s.music * 0.5;
  }

  private tone(
    freq: number,
    dur: number,
    type: OscillatorType,
    gain: number,
    slideTo?: number,
  ): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const osc = ctx.createOscillator();
    const env = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, ctx.currentTime);
    if (slideTo !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), ctx.currentTime + dur);
    env.gain.setValueAtTime(0, ctx.currentTime);
    env.gain.linearRampToValueAtTime(gain, ctx.currentTime + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, ctx.currentTime + dur);
    osc.connect(env).connect(this.sfxGain);
    osc.start();
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  private noise(dur: number, gain: number, freq: number, q = 1): void {
    const ctx = this.ensure();
    if (!ctx || !this.sfxGain) return;
    const frames = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, frames, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < frames; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / frames);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = freq;
    filter.Q.value = q;
    const env = ctx.createGain();
    env.gain.value = gain;
    src.connect(filter).connect(env).connect(this.sfxGain);
    src.start();
  }

  ui(): void {
    this.tone(520, 0.06, 'square', 0.06, 700);
  }

  draw(): void {
    this.tone(660, 0.05, 'triangle', 0.05, 880);
  }

  /** Letters locking into a word — the game's signature sound. */
  craft(chain: number): void {
    const base = 300 + Math.min(chain, 6) * 70;
    this.tone(base, 0.16, 'triangle', 0.12, base * 1.6);
    window.setTimeout(() => this.tone(base * 1.5, 0.22, 'sine', 0.11, base * 2.4), 90);
  }

  explosion(): void {
    this.noise(0.5, 0.3, 900, 0.7);
    this.tone(120, 0.4, 'sawtooth', 0.14, 40);
  }

  ignite(): void {
    this.noise(0.35, 0.16, 1600, 0.5);
  }

  kill(): void {
    this.noise(0.14, 0.12, 2400);
  }

  drop(): void {
    this.tone(880, 0.1, 'sine', 0.09, 1320);
  }

  coreHit(): void {
    this.tone(180, 0.3, 'sawtooth', 0.16, 70);
    this.noise(0.3, 0.18, 500);
  }

  wildcard(): void {
    this.tone(520, 0.12, 'square', 0.1, 1040);
    window.setTimeout(() => this.tone(780, 0.18, 'sine', 0.1, 1560), 100);
  }

  cleared(): void {
    const notes = [523, 659, 784, 1046];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 0.2, 'triangle', 0.1), i * 90));
  }

  failed(): void {
    const notes = [330, 262, 196];
    notes.forEach((n, i) => window.setTimeout(() => this.tone(n, 0.4, 'sawtooth', 0.12, n * 0.7), i * 160));
  }

  /** Slow industrial pulse. Deliberately sparse so SFX stay readable. */
  startMusic(): void {
    if (this.musicTimer !== null || typeof window === 'undefined') return;
    const ctx = this.ensure();
    if (!ctx || !this.musicGain) return;
    const bass = [55, 55, 73.4, 65.4];
    this.musicTimer = window.setInterval(() => {
      const c = this.ensure();
      if (!c || !this.musicGain) return;
      const note = bass[this.step % bass.length];
      this.step += 1;
      const osc = c.createOscillator();
      const env = c.createGain();
      osc.type = 'triangle';
      osc.frequency.value = note;
      env.gain.setValueAtTime(0, c.currentTime);
      env.gain.linearRampToValueAtTime(0.14, c.currentTime + 0.4);
      env.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 1.9);
      osc.connect(env).connect(this.musicGain);
      osc.start();
      osc.stop(c.currentTime + 2);
      if (this.step % 4 === 0) {
        const hat = c.createOscillator();
        const henv = c.createGain();
        hat.type = 'square';
        hat.frequency.value = 3200;
        henv.gain.setValueAtTime(0.02, c.currentTime + 1);
        henv.gain.exponentialRampToValueAtTime(0.0005, c.currentTime + 1.06);
        hat.connect(henv).connect(this.musicGain);
        hat.start(c.currentTime + 1);
        hat.stop(c.currentTime + 1.07);
      }
    }, 950);
  }

  stopMusic(): void {
    if (this.musicTimer !== null) {
      window.clearInterval(this.musicTimer);
      this.musicTimer = null;
    }
  }
}

export const sfx = new Sfx();
