/**
 * Effects layer.
 *
 * Reads battle events and turns them into readable motion. Ordering rule from
 * the brief: essential information (letters, recipes, threats) is never buried
 * under particles, so effects stay additive and short-lived.
 */
import { C, FIELD, laneY } from '../core/theme';
import { clamp } from '../core/rng';
import { glow, rgba, type Ctx } from '../core/draw';
import type { BattleEvent } from '../battle/types';
import type { Letter } from '../alphabet/types';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  size: number;
  color: string;
  kind: 'spark' | 'debris' | 'wind' | 'smoke';
  spin: number;
  rot: number;
}

interface Ring {
  x: number;
  y: number;
  r0: number;
  r1: number;
  life: number;
  max: number;
  color: string;
  width: number;
}

interface FloatingText {
  x: number;
  y: number;
  text: string;
  color: string;
  life: number;
  max: number;
  size: number;
}

interface FlyingLetter {
  letter: Letter;
  x: number;
  y: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  life: number;
  max: number;
  color: string;
}

export interface FxOptions {
  shake: number;
  reducedFlashes: boolean;
}

export class FxLayer {
  particles: Particle[] = [];
  rings: Ring[] = [];
  texts: FloatingText[] = [];
  letters: FlyingLetter[] = [];
  /** Screen shake magnitude in logical pixels. */
  shake = 0;
  /** Full-screen flash alpha, already scaled by the player's settings. */
  flash = 0;
  private shakeSeed = 0;

  clear(): void {
    this.particles.length = 0;
    this.rings.length = 0;
    this.texts.length = 0;
    this.letters.length = 0;
    this.shake = 0;
    this.flash = 0;
  }

  /** Where a letter flies when it is recovered — the tray area. */
  trayTarget: (index: number) => { x: number; y: number } = () => ({ x: 700, y: 762 });

  absorb(events: readonly BattleEvent[], opts: FxOptions): void {
    for (const ev of events) {
      switch (ev.kind) {
        case 'explosion':
          this.rings.push({
            x: ev.x,
            y: laneY(2),
            r0: 12,
            r1: ev.radius,
            life: 0.42,
            max: 0.42,
            color: ev.color,
            width: 8,
          });
          this.burst(ev.x, laneY(2), 26, ev.color, 260);
          this.smoke(ev.x, laneY(2), 14);
          this.shakeNow(7 * opts.shake);
          if (!opts.reducedFlashes) this.flash = Math.max(this.flash, 0.16);
          break;
        case 'ignite':
          this.rings.push({
            x: ev.x,
            y: laneY(3),
            r0: 8,
            r1: ev.radius,
            life: 0.5,
            max: 0.5,
            color: '#f0952e',
            width: 5,
          });
          this.burst(ev.x, laneY(3), 16, '#f2734a', 180, 'spark');
          break;
        case 'push':
          this.burst(ev.x, laneY(2), 10, '#4fd8e4', 200, 'wind');
          break;
        case 'kill': {
          // Kills are the moment letters are born, so they get a visible pop.
          const ky = laneY(clamp(ev.lane, 0, 4));
          this.burst(ev.x, ky - 10, 18, '#fff3c4', 250, 'spark');
          this.burst(ev.x, ky - 6, 10, '#c3cee6', 170, 'debris');
          this.rings.push({
            x: ev.x,
            y: ky - 10,
            r0: 4,
            r1: 34,
            life: 0.24,
            max: 0.24,
            color: '#ffe9a8',
            width: 4,
          });
          break;
        }
        case 'coreHit':
          this.shakeNow(9 * opts.shake);
          if (!opts.reducedFlashes) this.flash = Math.max(this.flash, 0.3);
          this.texts.push({
            x: FIELD.coreX,
            y: 240,
            text: `-${ev.amount}`,
            color: C.bad,
            life: 0.9,
            max: 0.9,
            size: 30,
          });
          break;
        case 'letterReturn': {
          const to = this.trayTarget(0);
          this.letters.push({
            letter: ev.letter,
            x: ev.x,
            y: ev.y,
            fromX: ev.x,
            fromY: ev.y,
            toX: to.x,
            toY: to.y,
            life: 0.55,
            max: 0.55,
            color: C.gold,
          });
          break;
        }
        case 'chain':
          this.texts.push({
            x: FIELD.w / 2,
            y: FIELD.floorBack + 62,
            text: `×${ev.depth}`,
            color: ev.depth >= 4 ? C.rose : ev.depth >= 3 ? C.violet : C.cyan,
            life: 1.0,
            max: 1.0,
            size: 24 + Math.min(ev.depth, 6) * 6,
          });
          this.shakeNow(Math.min(3 + ev.depth, 9) * opts.shake * 0.6);
          break;
        case 'wildcard':
          this.rings.push({
            x: FIELD.coreX + 40,
            y: 300,
            r0: 6,
            r1: 90,
            life: 0.4,
            max: 0.4,
            color: C.violet,
            width: 4,
          });
          break;
        case 'failed':
          this.shakeNow(12 * opts.shake);
          break;
        default:
          break;
      }
    }
  }

  private shakeNow(amount: number): void {
    this.shake = Math.max(this.shake, clamp(amount, 0, 12));
  }

  private burst(
    x: number,
    y: number,
    count: number,
    color: string,
    speed: number,
    kind: Particle['kind'] = 'spark',
  ): void {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = speed * (0.35 + Math.random() * 0.65);
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s * 0.6,
        life: 0.35 + Math.random() * 0.45,
        max: 0.8,
        size: 2 + Math.random() * 4,
        color,
        kind,
        spin: (Math.random() - 0.5) * 12,
        rot: Math.random() * Math.PI,
      });
    }
  }

  private smoke(x: number, y: number, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        x: x + (Math.random() - 0.5) * 40,
        y: y + (Math.random() - 0.5) * 20,
        vx: (Math.random() - 0.5) * 30,
        vy: -20 - Math.random() * 40,
        life: 0.7 + Math.random() * 0.6,
        max: 1.3,
        size: 10 + Math.random() * 16,
        color: '#3a3f52',
        kind: 'smoke',
        spin: 0,
        rot: 0,
      });
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.spin * dt;
      const drag = p.kind === 'smoke' ? 0.9 : 2.6;
      p.vx -= p.vx * drag * dt;
      p.vy -= p.vy * drag * dt;
      if (p.kind === 'debris') p.vy += 220 * dt;
      if (p.kind === 'smoke') p.vy -= 12 * dt;
    }
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      if (r.life <= 0) this.rings.splice(i, 1);
    }
    for (let i = this.texts.length - 1; i >= 0; i--) {
      const t = this.texts[i];
      t.life -= dt;
      t.y -= dt * 34;
      if (t.life <= 0) this.texts.splice(i, 1);
    }
    for (let i = this.letters.length - 1; i >= 0; i--) {
      const l = this.letters[i];
      l.life -= dt;
      if (l.life <= 0) this.letters.splice(i, 1);
    }
    this.shake = Math.max(0, this.shake - dt * 26);
    this.flash = Math.max(0, this.flash - dt * 2.2);
    this.shakeSeed += dt * 60;
  }

  /** Camera offset applied to the world layer only. */
  offset(): { x: number; y: number } {
    if (this.shake <= 0.01) return { x: 0, y: 0 };
    const s = this.shake;
    return {
      x: Math.sin(this.shakeSeed * 1.7) * s,
      y: Math.cos(this.shakeSeed * 2.3) * s * 0.6,
    };
  }

  drawWorld(g: Ctx): void {
    for (const p of this.particles) {
      const a = clamp(p.life / p.max, 0, 1);
      if (p.kind === 'smoke') {
        g.fillStyle = rgba(p.color, a * 0.28);
        g.beginPath();
        g.arc(p.x, p.y, p.size * (1.4 - a * 0.4), 0, Math.PI * 2);
        g.fill();
        continue;
      }
      if (p.kind === 'wind') {
        g.strokeStyle = rgba(p.color, a * 0.8);
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(p.x, p.y);
        g.lineTo(p.x - 26, p.y);
        g.stroke();
        continue;
      }
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.rot);
      g.fillStyle = rgba(p.color, a);
      g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * (p.kind === 'debris' ? 0.6 : 1));
      g.restore();
    }
    for (const r of this.rings) {
      const t = 1 - r.life / r.max;
      const radius = r.r0 + (r.r1 - r.r0) * (1 - Math.pow(1 - t, 2));
      const a = clamp(1 - t, 0, 1);
      g.strokeStyle = rgba(r.color, a * 0.85);
      g.lineWidth = r.width * (1 - t * 0.6);
      g.beginPath();
      g.arc(r.x, r.y, radius, 0, Math.PI * 2);
      g.stroke();
      glow(g, r.x, r.y, radius * 0.7, r.color, a * 0.16);
    }
    for (const l of this.letters) {
      const t = 1 - l.life / l.max;
      const ease = 1 - Math.pow(1 - t, 3);
      const x = l.fromX + (l.toX - l.fromX) * ease;
      const y = l.fromY + (l.toY - l.fromY) * ease - Math.sin(ease * Math.PI) * 60;
      g.save();
      g.globalAlpha = clamp(1 - t * 0.4, 0, 1);
      glow(g, x, y, 22, l.color, 0.5);
      g.fillStyle = '#f4ecd8';
      g.beginPath();
      g.roundRect(x - 13, y - 13, 26, 26, 6);
      g.fill();
      g.fillStyle = '#1b1a17';
      g.font = '800 17px Archivo, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(l.letter, x, y + 1);
      g.restore();
    }
  }

  drawOverlay(g: Ctx): void {
    for (const t of this.texts) {
      const a = clamp(t.life / t.max, 0, 1);
      g.save();
      g.globalAlpha = a;
      g.font = `800 ${t.size}px Archivo, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.lineWidth = 4;
      g.strokeStyle = rgba('#05070e', 0.8);
      g.strokeText(t.text, t.x, t.y);
      g.fillStyle = t.color;
      g.fillText(t.text, t.x, t.y);
      g.restore();
    }
  }
}
