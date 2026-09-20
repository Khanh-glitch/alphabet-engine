/**
 * Immediate-mode UI kit.
 *
 * Screens declare their interactive rects every frame; the kit owns hover,
 * press, focus and tooltip state. Keyboard focus order is the declaration
 * order, which gives us gamepad/keyboard navigation for free.
 */
import { C, F, MOTION, R, T, W } from './theme';
import { chip, label, plate, rgba, rr, type Ctx, type Rect } from './draw';

export interface Hit {
  hover: boolean;
  pressed: boolean;
  focused: boolean;
}

export interface ButtonOpts {
  label?: string;
  sub?: string;
  tone?: string;
  variant?: 'solid' | 'ghost' | 'tile' | 'bare';
  disabled?: boolean;
  selected?: boolean;
  height?: number;
  tooltip?: string;
  fontSize?: number;
  align?: 'center' | 'left';
  icon?: string;
}

export class Ui {
  hover: string | null = null;
  pressed: string | null = null;
  focus: string | null = null;
  private rects = new Map<string, Rect>();
  private order: string[] = [];
  private tooltipText: string | null = null;
  private tooltipAt: [number, number] = [0, 0];
  /** Id activated by keyboard this frame (consumed by the screen host). */
  private keyboardActivation: string | null = null;

  begin(): void {
    this.rects.clear();
    this.order.length = 0;
    this.tooltipText = null;
  }

  move(x: number, y: number): void {
    this.hover = this.pick(x, y);
  }

  down(x: number, y: number): string | null {
    const id = this.pick(x, y);
    this.pressed = id;
    if (id) this.focus = id;
    return id;
  }

  up(x: number, y: number): string | null {
    const id = this.pick(x, y);
    const clicked = id && id === this.pressed ? id : null;
    this.pressed = null;
    return clicked;
  }

  clearPress(): void {
    this.pressed = null;
  }

  private pick(x: number, y: number): string | null {
    for (let i = this.order.length - 1; i >= 0; i--) {
      const id = this.order[i];
      const r = this.rects.get(id);
      if (r && x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    }
    return null;
  }

  /** Keyboard navigation: Tab / arrows move focus, Enter activates. */
  key(e: KeyboardEvent): string | null {
    if (this.order.length === 0) return null;
    const idx = this.focus ? this.order.indexOf(this.focus) : -1;
    const step = e.key === 'Tab' && e.shiftKey ? -1 : 1;
    if (e.key === 'Tab' || e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      const next = idx < 0 ? 0 : (idx + step + this.order.length) % this.order.length;
      this.focus = this.order[next];
      return null;
    }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      const next = idx <= 0 ? this.order.length - 1 : idx - 1;
      this.focus = this.order[next];
      return null;
    }
    if ((e.key === 'Enter' || e.key === ' ') && this.focus) {
      const id = this.focus;
      this.keyboardActivation = id;
      return id;
    }
    return null;
  }

  takeActivation(): string | null {
    const id = this.keyboardActivation;
    this.keyboardActivation = null;
    return id;
  }

  /** Register a rect without drawing — for regions the screen paints itself. */
  hit(id: string, rect: Rect, opts: { disabled?: boolean; tooltip?: string } = {}): Hit {
    if (opts.disabled) return { hover: false, pressed: false, focused: false };
    this.rects.set(id, rect);
    this.order.push(id);
    const hover = this.hover === id;
    if (hover && opts.tooltip) {
      this.tooltipText = opts.tooltip;
      this.tooltipAt = [rect.x + rect.w / 2, rect.y];
    }
    return { hover, pressed: this.pressed === id, focused: this.focus === id };
  }

  button(g: Ctx, id: string, rect: Rect, opts: ButtonOpts = {}): Hit {
    const h = this.hit(id, rect, { disabled: opts.disabled, tooltip: opts.tooltip });
    const tone = opts.tone ?? C.cyan;
    const active = h.hover || h.focused;
    const r = rect;
    const pressed = h.pressed && active;
    const variant = opts.variant ?? 'solid';
    g.save();
    if (opts.disabled) g.globalAlpha = 0.42;

    const lift = pressed ? 2 : 0;
    if (variant === 'solid' || variant === 'tile') {
      // extruded base
      g.fillStyle = rgba('#000000', 0.45);
      rr(g, r.x, r.y + 4, r.w, r.h, opts.variant === 'tile' ? R.md : R.md);
      g.fill();
      const top = opts.variant === 'tile' ? C.panelHi : mixTone(tone, active);
      const grad = g.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
      grad.addColorStop(0, active ? mixTone(tone, true) : top);
      grad.addColorStop(1, mixTone(tone, false));
      g.fillStyle = grad;
      rr(g, r.x, r.y + lift, r.w, r.h - lift, R.md);
      g.fill();
      g.strokeStyle = rgba(active ? tone : '#ffffff', active ? 0.7 : 0.12);
      g.lineWidth = W.thin;
      rr(g, r.x + 1, r.y + 1 + lift, r.w - 2, r.h - 2 - lift, R.md);
      g.stroke();
      if (opts.selected) {
        g.strokeStyle = rgba(C.gold, 0.95);
        g.lineWidth = W.bold;
        rr(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, R.md + 2);
        g.stroke();
      }
    } else if (variant === 'ghost') {
      g.fillStyle = active ? rgba(tone, 0.16) : rgba('#ffffff', 0.03);
      rr(g, r.x, r.y, r.w, r.h, R.md);
      g.fill();
      g.strokeStyle = rgba(active ? tone : C.lineHi, active ? 0.75 : 0.5);
      g.lineWidth = W.thin;
      rr(g, r.x + 1, r.y + 1, r.w - 2, r.h - 2, R.md);
      g.stroke();
      if (h.focused) {
        g.strokeStyle = rgba('#ffffff', 0.7);
        g.lineWidth = W.hair;
        rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, R.md + 3);
        g.stroke();
      }
    }

    if (opts.label) {
      const size = opts.fontSize ?? T.small;
      const cx = opts.align === 'left' ? r.x + 18 : r.x + r.w / 2;
      g.textAlign = opts.align === 'left' ? 'left' : 'center';
      g.textBaseline = 'middle';
      const cy = r.y + r.h / 2 + lift + (opts.sub ? -8 : 0);
      if (opts.icon) {
        g.font = `800 ${size * 1.15}px ${F.ui}`;
        g.fillStyle = rgba('#ffffff', 0.9);
        g.fillText(opts.icon, cx, cy + 1);
        g.font = `700 ${size}px ${F.ui}`;
        g.fillStyle = C.ink;
        g.fillText(opts.label, cx + size * 1.9, cy + 1);
      } else {
        g.font = `700 ${size}px ${F.ui}`;
        g.fillStyle = variant === 'solid' ? '#0b1020' : C.ink;
        g.fillText(opts.label, cx, cy + 1);
      }
      if (opts.sub) {
        g.font = `600 ${T.micro}px ${F.ui}`;
        g.fillStyle = variant === 'solid' ? rgba('#0b1020', 0.66) : C.dim;
        g.fillText(opts.sub, cx, cy + size * 0.95);
      }
    }
    g.restore();
    return h;
  }

  /** Draws the pending tooltip; call last so it sits above everything. */
  drawTooltip(g: Ctx): void {
    if (!this.tooltipText) return;
    const text = this.tooltipText;
    g.save();
    g.font = `600 ${T.micro}px ${F.ui}`;
    const w = g.measureText(text).width + 22;
    const h = 30;
    let x = this.tooltipAt[0] - w / 2;
    let y = this.tooltipAt[1] - h - 10;
    x = Math.max(8, Math.min(1440 - w - 8, x));
    if (y < 8) y = this.tooltipAt[1] + 12;
    plate(g, x, y, w, h, { radius: R.sm, fill: C.bed0, edge: C.lineHi });
    label(g, text, x + w / 2, y + h / 2, {
      size: T.micro,
      color: C.ink,
      align: 'center',
      baseline: 'middle',
    });
    g.restore();
  }
}

const mixTone = (tone: string, active: boolean): string => {
  // Buttons keep the same material; accent only appears on interaction.
  const base = active ? tone : tone;
  return active ? shade(base, 0.12) : shade(base, -0.28);
};

const shade = (hex: string, amount: number): string => {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255;
  const g2 = (n >> 8) & 255;
  const b = n & 255;
  const f = (v: number): number =>
    Math.round(amount >= 0 ? v + (255 - v) * amount : v * (1 + amount));
  return `rgb(${f(r)},${f(g2)},${f(b)})`;
};

/** Section heading used by every menu screen: a rule, a caps label, optional hint. */
export function sectionHead(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  width: number,
  hint?: string,
): void {
  label(g, text, x, y, { size: T.tiny, color: C.dim, weight: 800, tracking: 2.4 });
  g.strokeStyle = rgba(C.lineHi, 0.5);
  g.lineWidth = W.hair;
  g.beginPath();
  g.moveTo(x, y + 10);
  g.lineTo(x + width, y + 10);
  g.stroke();
  if (hint) {
    label(g, hint, x, y + 30, { size: T.small, color: C.faint, weight: 500 });
  }
}

export { chip, label, plate, rgba, rr };
export const UI_ANIM = MOTION;
