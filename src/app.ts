/** Application shell: canvas, input, routing, transitions. */
import { SIZE, C } from './theme';
import { Kit } from './ui/kit';
import { sfx } from './core/audio';
import { alpha, blob, type Ctx } from './core/draw';
import type { Battle } from './game/battle';
import type { RunState } from './game/run';
import { clamp } from './core/rng';

export interface Screen {
  readonly id: string;
  enter?(app: App): void;
  exit?(app: App): void;
  update?(dt: number, app: App): void;
  draw(g: Ctx, app: App): void;
  click?(id: string, app: App): void;
  key?(e: KeyboardEvent, app: App): boolean | void;
  wheel?(dy: number, x: number, y: number, app: App): void;
}

export interface Toast {
  text: string;
  color: string;
  t: number;
}

export class App {
  g: Ctx;
  canvas: HTMLCanvasElement;
  kit = new Kit();
  scale = 1;
  ox = 0;
  oy = 0;
  dpr = 1;
  run: RunState | null = null;
  battle: Battle | null = null;
  screens = new Map<string, Screen>();
  screen!: Screen;
  prev = 'title';
  fade = 1;
  toasts: Toast[] = [];
  time = 0;
  paused = false;
  showHelp = false;
  /** Set while the intro flourish is playing on a freshly entered screen. */
  entered = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.g = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
  }

  register(...screens: Screen[]): void {
    for (const s of screens) this.screens.set(s.id, s);
  }

  goto(id: string): void {
    const next = this.screens.get(id);
    if (!next || next === this.screen) return;
    this.screen?.exit?.(this);
    if (this.screen && this.screen.id !== id) this.prev = this.screen.id;
    this.screen = next;
    this.fade = 1;
    this.entered = 0;
    this.kit.hover = null;
    this.kit.clearPress();
    next.enter?.(this);
  }

  toast(text: string, color: string = C.ink): void {
    this.toasts.push({ text, color, t: 0 });
    if (this.toasts.length > 3) this.toasts.shift();
  }

  resize(): void {
    this.dpr = clamp(window.devicePixelRatio || 1, 1, 2.5);
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.canvas.width = Math.floor(w * this.dpr);
    this.canvas.height = Math.floor(h * this.dpr);
    this.canvas.style.width = `${w}px`;
    this.canvas.style.height = `${h}px`;
    const s = Math.min(w / SIZE.w, h / SIZE.h);
    this.scale = s;
    this.ox = (w - SIZE.w * s) / 2;
    this.oy = (h - SIZE.h * s) / 2;
  }

  toLogical(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) * (this.canvas.width / r.width)) / this.dpr;
    const y = ((clientY - r.top) * (this.canvas.height / r.height)) / this.dpr;
    const s = Math.min(window.innerWidth / SIZE.w, window.innerHeight / SIZE.h);
    const ox = (window.innerWidth - SIZE.w * s) / 2;
    const oy = (window.innerHeight - SIZE.h * s) / 2;
    return [(x - ox) / s, (y - oy) / s];
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      this.kit.move(x, y);
    });
    c.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      this.kit.move(x, y);
      const id = this.kit.down(x, y);
      if (id) sfx.ui();
    });
    c.addEventListener('pointerup', (e) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      const id = this.kit.up(x, y);
      if (id) {
        sfx.unlock();
        this.screen.click?.(id, this);
      }
    });
    c.addEventListener('pointerleave', () => {
      this.kit.hover = null;
      this.kit.clearPress();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const [x, y] = this.toLogical(e.clientX, e.clientY);
        this.kit.move(x, y);
        this.screen.wheel?.(e.deltaY, x, y, this);
      },
      { passive: false },
    );
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      sfx.unlock();
      const handled = this.screen.key?.(e, this);
      if (handled) e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.paused = true;
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.fade = Math.max(0, this.fade - dt * 3.2);
    this.entered += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.6);
    this.screen.update?.(dt, this);
  }

  draw(): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.void;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale * this.dpr;
    g.setTransform(s, 0, 0, s, this.ox * this.dpr, this.oy * this.dpr);
    g.beginPath();
    g.rect(0, 0, SIZE.w, SIZE.h);
    g.clip();

    this.kit.begin(1 / 60);
    this.screen.draw(g, this);

    // toasts
    let ty = SIZE.h - 34;
    for (const t of this.toasts.slice().reverse()) {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.2 ? Math.max(0, (2.6 - t.t) / 0.4) : 1;
      g.save();
      g.globalAlpha = a;
      const w = 260;
      const x = SIZE.w / 2 - w / 2;
      g.fillStyle = alpha('#05060c', 0.92);
      g.strokeStyle = alpha(t.color, 0.5);
      g.lineWidth = 1;
      g.beginPath();
      g.roundRect(x, ty - 14, w, 30, 8);
      g.fill();
      g.stroke();
      g.fillStyle = t.color;
      g.font = '700 13px Grotesk, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t.text, SIZE.w / 2, ty + 1);
      g.restore();
      ty -= 38;
    }

    if (this.fade > 0.001) {
      g.save();
      g.globalAlpha = this.fade * 0.85;
      blob(g, SIZE.w / 2, SIZE.h / 2, 700, C.void, 1);
      g.fillStyle = alpha(C.void, 1);
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      g.restore();
    }

    // frame vignette so the letterboxed edge reads as deliberate
    const vg = g.createRadialGradient(SIZE.w / 2, SIZE.h / 2, SIZE.h * 0.35, SIZE.w / 2, SIZE.h / 2, SIZE.h * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(0,0,0,0.55)');
    g.fillStyle = vg;
    g.fillRect(0, 0, SIZE.w, SIZE.h);
  }
}
