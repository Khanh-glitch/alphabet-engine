/**
 * Application shell: canvas sizing, input routing, screen transitions and the
 * shared overlay stack (pause / settings). Screens own their own drawing; the
 * shell owns nothing about the game.
 */
import { VIEW, C } from '../core/theme';
import { Ui } from '../core/ui';
import { alpha, rgba, type Ctx } from '../core/draw';
import { clamp } from '../core/rng';
import { sfx } from '../core/audio';
import { store, type Settings } from '../core/save';
import type { Run } from '../run/run';
import type { Battle } from '../battle/battle';

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

export interface DebugHooks {
  /** Present only when `?debug=1`; used by the balance/screenshot harness. */
  screen: () => string;
  run: () => Run | null;
}

export class App {
  g: Ctx;
  canvas: HTMLCanvasElement;
  ui = new Ui();
  scale = 1;
  ox = 0;
  oy = 0;
  dpr = 1;
  screens = new Map<string, Screen>();
  screen!: Screen;
  fade = 1;
  time = 0;
  run: Run | null = null;
  /** Live encounter, owned by the battle screen's lifecycle. */
  battle: Battle | null = null;
  overlay: Screen | null = null;
  toasts: Toast[] = [];
  /** Set while a screen-entrance flourish is playing. */
  entered = 0;
  /** Last known pointer position in logical units (used by drag widgets). */
  pointer: [number, number] = [0, 0];
  debug = false;
  /** Speed multiplier, owned here so pause/settings can read it. */
  speed = 1;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('canvas 2d unavailable');
    this.g = ctx;
    this.resize();
    window.addEventListener('resize', () => this.resize());
    this.bindInput();
    this.speed = store.settings.speed;
  }

  get settings(): Settings {
    return store.settings;
  }

  register(...screens: Screen[]): void {
    for (const s of screens) this.screens.set(s.id, s);
  }

  goto(id: string, opts: { keepOverlay?: boolean } = {}): void {
    const next = this.screens.get(id);
    if (!next || next === this.screen) return;
    this.screen?.exit?.(this);
    this.screen = next;
    this.fade = 1;
    this.entered = 0;
    this.ui.hover = null;
    this.ui.focus = null;
    this.ui.clearPress();
    if (!opts.keepOverlay) this.overlay = null;
    next.enter?.(this);
  }

  setOverlay(screen: Screen | null): void {
    if (this.overlay === screen) return;
    this.overlay?.exit?.(this);
    this.overlay = screen;
    this.ui.clearPress();
    screen?.enter?.(this);
  }

  get active(): Screen {
    return this.overlay ?? this.screen;
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
    const s = Math.min(w / VIEW.w, h / VIEW.h);
    this.scale = s;
    this.ox = (w - VIEW.w * s) / 2;
    this.oy = (h - VIEW.h * s) / 2;
  }

  logicalPointer(): [number, number] {
    return this.pointer;
  }

  toLogical(clientX: number, clientY: number): [number, number] {
    const r = this.canvas.getBoundingClientRect();
    const x = ((clientX - r.left) * (this.canvas.width / r.width)) / this.dpr;
    const y = ((clientY - r.top) * (this.canvas.height / r.height)) / this.dpr;
    const s = Math.min(window.innerWidth / VIEW.w, window.innerHeight / VIEW.h);
    const ox = (window.innerWidth - VIEW.w * s) / 2;
    const oy = (window.innerHeight - VIEW.h * s) / 2;
    return [(x - ox) / s, (y - oy) / s];
  }

  private bindInput(): void {
    const c = this.canvas;
    c.addEventListener('pointermove', (e) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      this.pointer = [x, y];
      this.ui.move(x, y);
    });
    c.addEventListener('pointerdown', (e) => {
      sfx.unlock();
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      this.ui.move(x, y);
      this.ui.down(x, y);
    });
    c.addEventListener('pointerup', (e) => {
      const [x, y] = this.toLogical(e.clientX, e.clientY);
      const id = this.ui.up(x, y);
      if (id) {
        sfx.unlock();
        this.active.click?.(id, this);
      }
    });
    c.addEventListener('pointerleave', () => {
      this.ui.hover = null;
      this.ui.clearPress();
    });
    c.addEventListener(
      'wheel',
      (e) => {
        e.preventDefault();
        const [x, y] = this.toLogical(e.clientX, e.clientY);
        this.ui.move(x, y);
        this.active.wheel?.(e.deltaY, x, y, this);
      },
      { passive: false },
    );
    c.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('keydown', (e) => {
      sfx.unlock();
      if (e.key === 'Escape' && this.overlay) {
        this.setOverlay(null);
        e.preventDefault();
        return;
      }
      const nav = this.ui.key(e);
      if (nav) {
        this.active.click?.(nav, this);
        e.preventDefault();
        return;
      }
      const handled = this.active.key?.(e, this);
      if (handled) e.preventDefault();
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.screen.id === 'battle' && !this.overlay) {
        // Auto-pause so a hidden tab never eats an encounter.
        this.screen.key?.(new KeyboardEvent('keydown', { key: 'p' }), this);
      }
    });
  }

  update(dt: number): void {
    this.time += dt;
    this.fade = Math.max(0, this.fade - dt * 3.2);
    this.entered += dt;
    for (const t of this.toasts) t.t += dt;
    this.toasts = this.toasts.filter((t) => t.t < 2.6);
    this.screen.update?.(dt, this);
    this.overlay?.update?.(dt, this);
  }

  draw(): void {
    const g = this.g;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = C.void;
    g.fillRect(0, 0, this.canvas.width, this.canvas.height);
    const s = this.scale * this.dpr;
    g.setTransform(s, 0, 0, s, this.ox * this.dpr, this.oy * this.dpr);
    g.beginPath();
    g.rect(0, 0, VIEW.w, VIEW.h);
    g.clip();

    this.ui.begin();
    this.screen.draw(g, this);
    if (this.overlay) {
      // Dim the world behind an overlay without hiding it: context stays visible.
      g.fillStyle = rgba('#05070e', 0.72);
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      this.overlay.draw(g, this);
    }
    this.ui.drawTooltip(g);

    this.drawToasts(g);

    if (this.fade > 0.001) {
      g.fillStyle = alpha(C.void, this.fade * 0.9);
      g.fillRect(0, 0, VIEW.w, VIEW.h);
    }
  }

  private drawToasts(g: Ctx): void {
    let ty = VIEW.h - 96;
    for (const t of this.toasts.slice().reverse()) {
      const a = t.t < 0.2 ? t.t / 0.2 : t.t > 2.2 ? Math.max(0, (2.6 - t.t) / 0.4) : 1;
      g.save();
      g.globalAlpha = a;
      g.font = '600 13px Archivo, sans-serif';
      const w = g.measureText(t.text).width + 34;
      const x = VIEW.w / 2 - w / 2;
      g.fillStyle = rgba('#0b1020', 0.94);
      g.beginPath();
      g.roundRect(x, ty - 16, w, 32, 8);
      g.fill();
      g.strokeStyle = rgba(t.color, 0.6);
      g.lineWidth = 1.5;
      g.stroke();
      g.fillStyle = t.color;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(t.text, VIEW.w / 2, ty);
      g.restore();
      ty -= 40;
    }
  }
}
