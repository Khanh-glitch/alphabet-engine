/** Procedural sound effects - no audio files, everything is synthesised. */
import type { Trait } from '../game/types';

class Sfx {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  muted = false;

  constructor() {
    const saved = safeGet('ae.muted');
    this.muted = saved === '1';
  }

  /** Must be called from a user gesture to satisfy autoplay policies. */
  unlock(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') void this.ctx.resume();
      return;
    }
    type WinAudio = Window & { webkitAudioContext?: typeof AudioContext };
    const Ctor = window.AudioContext ?? (window as WinAudio).webkitAudioContext;
    if (!Ctor) return;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.5;
    this.master.connect(this.ctx.destination);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    safeSet('ae.muted', m ? '1' : '0');
    if (this.master && this.ctx) {
      this.master.gain.cancelScheduledValues(this.ctx.currentTime);
      this.master.gain.setTargetAtTime(m ? 0 : 0.5, this.ctx.currentTime, 0.03);
    }
  }

  private tone(o: {
    freq: number;
    to?: number;
    dur?: number;
    type?: OscillatorType;
    gain?: number;
    delay?: number;
    attack?: number;
    detune?: number;
    lp?: number;
  }): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur ?? 0.12;
    const osc = this.ctx.createOscillator();
    osc.type = o.type ?? 'triangle';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t0 + dur);
    if (o.detune) osc.detune.value = o.detune;
    const g = this.ctx.createGain();
    const peak = Math.max(0.0001, o.gain ?? 0.2);
    const atk = o.attack ?? 0.005;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    let node: AudioNode = g;
    if (o.lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      g.connect(f);
      node = f;
    }
    osc.connect(g);
    node.connect(this.master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  private noise(o: { dur?: number; gain?: number; lp?: number; hp?: number; delay?: number }): void {
    if (!this.ctx || !this.master || this.muted) return;
    const t0 = this.ctx.currentTime + (o.delay ?? 0);
    const dur = o.dur ?? 0.2;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < n; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const g = this.ctx.createGain();
    g.gain.value = o.gain ?? 0.2;
    let node: AudioNode = g;
    if (o.lp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = o.lp;
      g.connect(f);
      node = f;
    }
    if (o.hp) {
      const f = this.ctx.createBiquadFilter();
      f.type = 'highpass';
      f.frequency.value = o.hp;
      node.connect(f);
      node = f;
    }
    src.connect(g);
    node.connect(this.master);
    src.start(t0);
  }

  // ---- cues --------------------------------------------------------------
  ui(): void {
    this.tone({ freq: 520, to: 700, dur: 0.06, gain: 0.09, type: 'square', lp: 2400 });
  }
  uiBack(): void {
    this.tone({ freq: 420, to: 300, dur: 0.07, gain: 0.08, type: 'square', lp: 2000 });
  }
  place(i: number): void {
    this.tone({ freq: 300 + i * 46, to: 380 + i * 46, dur: 0.07, gain: 0.16, type: 'triangle' });
    this.noise({ dur: 0.05, gain: 0.05, hp: 2200 });
  }
  lift(): void {
    this.tone({ freq: 240, to: 330, dur: 0.05, gain: 0.08, type: 'sine' });
  }
  forge(name: string): void {
    const base = 200 + Math.min(9, name.length) * 22;
    this.tone({ freq: base, to: base * 1.5, dur: 0.16, gain: 0.16, type: 'sawtooth', lp: 1800 });
    this.tone({ freq: base * 2, to: base * 3, dur: 0.22, gain: 0.08, type: 'sine', delay: 0.03 });
    this.noise({ dur: 0.18, gain: 0.07, lp: 3000 });
  }
  reject(): void {
    this.tone({ freq: 150, to: 90, dur: 0.14, gain: 0.12, type: 'square', lp: 900 });
  }
  hit(trait: Trait): void {
    switch (trait) {
      case 'BLAST':
        this.noise({ dur: 0.26, gain: 0.22, lp: 1400 });
        this.tone({ freq: 120, to: 46, dur: 0.28, gain: 0.2, type: 'sawtooth', lp: 700 });
        break;
      case 'CHILL':
        this.tone({ freq: 1400, to: 900, dur: 0.14, gain: 0.07, type: 'sine' });
        this.noise({ dur: 0.16, gain: 0.08, hp: 3200 });
        break;
      case 'CHAIN':
        this.tone({ freq: 900, to: 1500, dur: 0.1, gain: 0.08, type: 'square', lp: 3200 });
        break;
      case 'PIERCE':
        this.tone({ freq: 1800, to: 700, dur: 0.09, gain: 0.08, type: 'sawtooth', lp: 4200 });
        break;
      case 'HEAVY':
        this.tone({ freq: 160, to: 60, dur: 0.2, gain: 0.2, type: 'triangle', lp: 800 });
        break;
      case 'SPLIT':
        this.tone({ freq: 700, to: 1100, dur: 0.08, gain: 0.08, type: 'triangle' });
        this.tone({ freq: 950, to: 600, dur: 0.1, gain: 0.06, type: 'triangle', delay: 0.05 });
        break;
      default:
        this.tone({ freq: 420, to: 240, dur: 0.08, gain: 0.1, type: 'triangle' });
        this.noise({ dur: 0.09, gain: 0.09, lp: 2600 });
    }
  }
  kill(): void {
    this.tone({ freq: 260, to: 70, dur: 0.3, gain: 0.16, type: 'sawtooth', lp: 900 });
    this.noise({ dur: 0.24, gain: 0.12, lp: 1800 });
  }
  spawn(): void {
    this.tone({ freq: 90, to: 200, dur: 0.3, gain: 0.13, type: 'sawtooth', lp: 700 });
  }
  coin(): void {
    this.tone({ freq: 1180, dur: 0.06, gain: 0.1, type: 'square', lp: 4000 });
    this.tone({ freq: 1560, dur: 0.1, gain: 0.08, type: 'square', lp: 4000, delay: 0.05 });
  }
  cascade(link: number, letters: number, mult: number): void {
    const base = 420 * Math.pow(1.1225, Math.min(18, link));
    this.tone({ freq: base, to: base * 1.28, dur: 0.22, gain: 0.15, type: 'triangle' });
    this.tone({
      freq: base * 1.5,
      to: base * 1.5,
      dur: 0.3,
      gain: 0.1,
      type: 'sine',
      delay: 0.06,
    });
    if (mult >= 3) {
      this.tone({ freq: base * 2, dur: 0.4, gain: 0.08, type: 'sine', delay: 0.12 });
    }
    if (letters >= 6) this.noise({ dur: 0.4, gain: 0.08, hp: 1800 });
  }
  tick(): void {
    this.tone({ freq: 900, dur: 0.03, gain: 0.05, type: 'square', lp: 3600 });
  }
  damage(): void {
    this.tone({ freq: 220, to: 120, dur: 0.2, gain: 0.18, type: 'square', lp: 1000 });
  }
  win(): void {
    [0, 4, 7, 12].forEach((semi, i) =>
      this.tone({
        freq: 440 * Math.pow(2, semi / 12),
        dur: 0.5,
        gain: 0.13,
        type: 'triangle',
        delay: i * 0.09,
      }),
    );
  }
  lose(): void {
    [0, -3, -7, -12].forEach((semi, i) =>
      this.tone({
        freq: 330 * Math.pow(2, semi / 12),
        dur: 0.7,
        gain: 0.14,
        type: 'sawtooth',
        lp: 1200,
        delay: i * 0.16,
      }),
    );
  }
  forgeHammer(): void {
    this.noise({ dur: 0.3, gain: 0.2, lp: 2600 });
    this.tone({ freq: 180, to: 70, dur: 0.3, gain: 0.2, type: 'triangle', lp: 900 });
  }
  levelUp(): void {
    [0, 7, 12].forEach((s, i) =>
      this.tone({ freq: 520 * Math.pow(2, s / 12), dur: 0.3, gain: 0.12, delay: i * 0.08 }),
    );
  }
}

function safeGet(k: string): string | null {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
}
function safeSet(k: string, v: string): void {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* ignore */
  }
}

export const sfx = new Sfx();
