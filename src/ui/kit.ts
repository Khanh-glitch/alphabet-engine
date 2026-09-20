/** Immediate-mode widget kit. Screens draw, the kit remembers what is under the cursor. */
import { C, F, R, T } from '../theme';
import {
  alpha,
  bar as drawBar,
  circle,
  icon,
  mix,
  panel,
  rr,
  shade,
  slab,
  text,
  textWidth,
  ellipsize,
  type Ctx,
  type IconName,
} from '../core/draw';
import { clamp, damp } from '../core/rng';

export type Tone = 'primary' | 'secondary' | 'ghost' | 'danger' | 'cyan' | 'violet' | 'lime';

export interface TipLine {
  text: string;
  color?: string;
}

export interface Tip {
  title?: string;
  lines: TipLine[];
  width?: number;
}

export interface Hot {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  cursor?: 'pointer' | 'default' | 'text';
  tip?: Tip;
  disabled?: boolean;
}

interface Drag {
  id: string;
  x: number;
  y: number;
}

export class Kit {
  hotspots: Hot[] = [];
  hover: string | null = null;
  press: string | null = null;
  drag: Drag | null = null;
  mx = 0;
  my = 0;
  private anim = new Map<string, number>();
  private pressT = new Map<string, number>();
  time = 0;

  begin(dt: number): void {
    this.hotspots.length = 0;
    this.time += dt;
    for (const [k, v] of this.anim) {
      const target = k === this.hover ? 1 : 0;
      const nv = damp(v, target, 14, dt);
      if (Math.abs(nv - target) < 0.002 && target === 0) this.anim.delete(k);
      else this.anim.set(k, nv);
    }
    for (const [k, v] of this.pressT) {
      const nv = Math.max(0, v - dt * 4);
      if (nv <= 0) this.pressT.delete(k);
      else this.pressT.set(k, nv);
    }
  }

  hot(o: Hot): void {
    this.hotspots.push(o);
  }

  hoverAmt(id: string): number {
    if (this.anim.has(id)) return this.anim.get(id) ?? 0;
    if (this.hover === id) {
      this.anim.set(id, 0.001);
      return 0.001;
    }
    return 0;
  }

  pressAmt(id: string): number {
    return this.pressT.get(id) ?? 0;
  }

  isHover(id: string): boolean {
    return this.hover === id;
  }

  isDown(id: string): boolean {
    return this.press === id;
  }

  /** Pointer position in logical space. */
  at(x: number, y: number): Hot | null {
    for (let i = this.hotspots.length - 1; i >= 0; i--) {
      const h = this.hotspots[i];
      if (x >= h.x && x <= h.x + h.w && y >= h.y && y <= h.y + h.h) return h;
    }
    return null;
  }

  move(x: number, y: number): void {
    this.mx = x;
    this.my = y;
    const h = this.at(x, y);
    this.hover = h && !h.disabled ? h.id : null;
    document.body.style.cursor = h?.cursor === 'text' ? 'text' : this.hover ? 'pointer' : 'default';
  }

  down(x: number, y: number): string | null {
    const h = this.at(x, y);
    if (!h || h.disabled) return null;
    this.press = h.id;
    this.pressT.set(h.id, 1);
    return h.id;
  }

  up(x: number, y: number): string | null {
    const id = this.press;
    this.press = null;
    if (!id) return null;
    const h = this.at(x, y);
    return h && h.id === id && !h.disabled ? id : null;
  }

  clearPress(): void {
    this.press = null;
    this.drag = null;
  }
}

// ---- widgets --------------------------------------------------------------
export interface BtnOpts {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  label: string;
  sub?: string;
  icon?: IconName;
  tone?: Tone;
  size?: number;
  disabled?: boolean;
  tip?: Tip;
  radius?: number;
  glow?: boolean;
  align?: 'center' | 'left';
  ghostLock?: boolean;
}

const TONES: Record<Tone, { fill: string; fill2: string; ink: string; edge: string; glow: string }> = {
  primary: { fill: C.gold, fill2: shade(C.gold, -0.18), ink: '#1b1405', edge: shade(C.gold, 0.18), glow: C.gold },
  secondary: { fill: C.panelHi, fill2: C.panel, ink: C.ink, edge: C.lineHi, glow: C.lineHi },
  ghost: { fill: 'rgba(255,255,255,0.03)', fill2: 'rgba(255,255,255,0.01)', ink: C.dim, edge: C.line, glow: C.lineHi },
  danger: { fill: C.blood, fill2: shade(C.blood, -0.2), ink: '#1a0505', edge: shade(C.blood, 0.2), glow: C.blood },
  cyan: { fill: C.cyan, fill2: shade(C.cyan, -0.22), ink: '#04222a', edge: shade(C.cyan, 0.2), glow: C.cyan },
  violet: { fill: C.violet, fill2: shade(C.violet, -0.22), ink: '#150a2a', edge: shade(C.violet, 0.2), glow: C.violet },
  lime: { fill: C.lime, fill2: shade(C.lime, -0.22), ink: '#0a1f12', edge: shade(C.lime, 0.2), glow: C.lime },
};

export function button(g: Ctx, kit: Kit, o: BtnOpts): void {
  const tone = TONES[o.tone ?? 'secondary'];
  const r = o.radius ?? R.md;
  const hv = kit.hoverAmt(o.id);
  const pa = kit.pressAmt(o.id);
  const disabled = !!o.disabled;
  const lift = disabled ? 0 : hv * 1.6 - pa * 2.4;
  const size = o.size ?? T.small;

  kit.hot({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, disabled, tip: o.tip });

  g.save();
  g.globalAlpha = disabled ? 0.45 : 1;
  g.translate(0, lift);
  if (hv > 0.02 && !disabled) {
    g.shadowBlur = 18 * hv + (o.glow ? 12 : 0);
    g.shadowColor = alpha(tone.glow, 0.5 * hv + (o.glow ? 0.2 : 0));
  }
  const grad = g.createLinearGradient(0, o.y, 0, o.y + o.h);
  grad.addColorStop(0, mix(tone.fill, '#ffffff', 0.06 * hv + (pa > 0 ? -0.05 : 0)));
  grad.addColorStop(1, tone.fill2);
  rr(g, o.x, o.y, o.w, o.h, r);
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  rr(g, o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, r - 0.5);
  g.strokeStyle = alpha(tone.edge, 0.5 + 0.4 * hv);
  g.lineWidth = 1;
  g.stroke();
  // glossy top
  g.save();
  rr(g, o.x + 1, o.y + 1, o.w - 2, o.h * 0.5, r - 1);
  g.clip();
  const gl = g.createLinearGradient(0, o.y, 0, o.y + o.h * 0.5);
  gl.addColorStop(0, 'rgba(255,255,255,0.16)');
  gl.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gl;
  g.fillRect(o.x, o.y, o.w, o.h / 2);
  g.restore();

  const hasIcon = !!o.icon;
  const iconSize = size + 5;
  const tw = textWidth(g, o.label, { size, weight: 700, font: F.ui, track: 0.4 });
  const subSize = Math.max(9, size - 3);
  const subW = o.sub ? textWidth(g, o.sub, { size: subSize, weight: 500, font: F.num, track: 0.6 }) : 0;
  const contentW = (hasIcon ? iconSize + 9 : 0) + Math.max(tw, subW);
  const startX =
    (o.align ?? 'center') === 'center' ? o.x + (o.w - contentW) / 2 : o.x + 16;
  let cx = startX;
  if (hasIcon) {
    icon(g, o.icon!, cx + iconSize / 2, o.y + o.h / 2, iconSize, tone.ink, true);
    cx += iconSize + 9;
  }
  const ty = o.sub ? o.y + o.h / 2 - 7 : o.y + o.h / 2;
  text(g, o.label, cx, ty, {
    size,
    weight: 700,
    color: tone.ink,
    font: F.ui,
    baseline: 'middle',
    track: 0.4,
    max: o.w - (cx - o.x) - 12,
  });
  if (o.sub) {
    text(g, o.sub, cx, o.y + o.h / 2 + 9, {
      size: subSize,
      weight: 700,
      color: alpha(tone.ink, 0.68),
      font: F.num,
      baseline: 'middle',
      track: 0.6,
      max: o.w - (cx - o.x) - 12,
    });
  }
  g.restore();
}

export function iconButton(
  g: Ctx,
  kit: Kit,
  o: { id: string; x: number; y: number; s: number; icon: IconName; tip?: Tip; tone?: Tone; active?: boolean; disabled?: boolean },
): void {
  button(g, kit, {
    id: o.id,
    x: o.x,
    y: o.y,
    w: o.s,
    h: o.s,
    label: '',
    tone: o.active ? (o.tone ?? 'cyan') : 'ghost',
    radius: R.sm,
    disabled: o.disabled,
    tip: o.tip,
  });
  const tone = TONES[o.tone ?? 'secondary'];
  icon(
    g,
    o.icon,
    o.x + o.s / 2,
    o.y + o.s / 2,
    o.s * 0.5,
    o.active ? tone.ink : kit.isHover(o.id) ? C.ink : C.dim,
    true,
  );
}

export interface CardOpts {
  id?: string;
  x: number;
  y: number;
  w: number;
  h: number;
  title?: string;
  accent?: string;
  selected?: boolean;
  disabled?: boolean;
  tip?: Tip;
  radius?: number;
  fill?: string;
  glow?: boolean;
  onClickable?: boolean;
}

export function card(g: Ctx, kit: Kit, o: CardOpts): void {
  const hv = o.id ? kit.hoverAmt(o.id) : 0;
  const acc = o.accent ?? C.line;
  if (o.id) {
    kit.hot({ id: o.id, x: o.x, y: o.y, w: o.w, h: o.h, disabled: o.disabled, tip: o.tip });
  }
  g.save();
  const lift = o.disabled ? 0 : hv * 2;
  g.translate(0, -lift);
  if (hv > 0.02 || o.glow) {
    g.shadowBlur = 22 * hv + (o.glow ? 16 : 0);
    g.shadowColor = alpha(acc, 0.4 * hv + (o.glow ? 0.3 : 0));
  }
  const r = o.radius ?? R.lg;
  const grad = g.createLinearGradient(0, o.y, 0, o.y + o.h);
  grad.addColorStop(0, mix(o.fill ?? C.panelHi, '#ffffff', 0.03 + hv * 0.05));
  grad.addColorStop(1, o.fill ?? C.panel);
  rr(g, o.x, o.y, o.w, o.h, r);
  g.fillStyle = grad;
  g.fill();
  g.shadowBlur = 0;
  if (o.selected) {
    rr(g, o.x - 2, o.y - 2, o.w + 4, o.h + 4, r + 2);
    g.strokeStyle = alpha(acc, 0.75);
    g.lineWidth = 2;
    g.stroke();
  }
  rr(g, o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, r - 0.5);
  g.strokeStyle = alpha(o.disabled ? C.line : mix(C.line, acc, hv * 0.7), o.disabled ? 0.5 : 0.75 + hv * 0.25);
  g.lineWidth = 1;
  g.stroke();
  g.save();
  rr(g, o.x + 1, o.y + 1, o.w - 2, 3, 2);
  g.fillStyle = alpha(acc, 0.75);
  g.fill();
  g.restore();
  g.restore();
}

export function chip(
  g: Ctx,
  o: { x: number; y: number; label: string; color?: string; icon?: IconName; size?: number; w?: number; align?: 'left' | 'right' },
): number {
  const size = o.size ?? T.tiny;
  const color = o.color ?? C.dim;
  const pad = 7;
  const iconS = o.icon ? size + 2 : 0;
  const tw = textWidth(g, o.label, { size, weight: 700, font: F.num, track: 0.6 });
  const w = o.w ?? tw + pad * 2 + (iconS ? iconS + 5 : 0);
  const x = o.align === 'right' ? o.x - w : o.x;
  rr(g, x, o.y, w, size + 9, R.sm);
  g.fillStyle = alpha(color, 0.14);
  g.fill();
  rr(g, x + 0.5, o.y + 0.5, w - 1, size + 8, R.sm - 0.5);
  g.strokeStyle = alpha(color, 0.4);
  g.lineWidth = 1;
  g.stroke();
  let cx = x + pad;
  if (o.icon) {
    icon(g, o.icon, cx + iconS / 2, o.y + (size + 9) / 2, iconS, color, true);
    cx += iconS + 5;
  }
  text(g, o.label, cx, o.y + (size + 9) / 2, {
    size,
    weight: 700,
    color,
    font: F.num,
    baseline: 'middle',
    track: 0.6,
  });
  return w;
}

export function meter(
  g: Ctx,
  o: { x: number; y: number; w: number; h: number; pct: number; color: string; label?: string; sub?: string; ghost?: number },
): void {
  drawBar(g, o.x, o.y, o.w, o.h, clamp(o.pct, 0, 1), o.color, { r: o.h / 2, ghost: o.ghost });
  rr(g, o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, o.h / 2);
  g.strokeStyle = 'rgba(0,0,0,0.5)';
  g.lineWidth = 1;
  g.stroke();
  if (o.label) {
    text(g, o.label, o.x, o.y + o.h + 14, { size: T.tiny, weight: 700, color: C.dim, font: F.num, track: 0.8 });
  }
  if (o.sub) {
    text(g, o.sub, o.x + o.w, o.y + o.h + 14, {
      size: T.tiny,
      weight: 700,
      color: C.ink,
      font: F.num,
      align: 'right',
      track: 0.4,
    });
  }
}

export function heading(
  g: Ctx,
  str: string,
  x: number,
  y: number,
  o: { size?: number; color?: string; align?: CanvasTextAlign; sub?: string; icon?: IconName; track?: number } = {},
): void {
  const size = o.size ?? T.head;
  const color = o.color ?? C.ink;
  let cx = x;
  if (o.icon) {
    icon(g, o.icon, x + 9, y, 18, color, true);
    cx = x + 26;
  }
  text(g, str.toUpperCase(), cx, y, {
    size,
    weight: 700,
    color,
    font: F.ui,
    track: o.track ?? 2.4,
    baseline: 'middle',
    align: o.align ?? 'left',
  });
  if (o.sub) {
    text(g, o.sub, x, y + size * 0.9, {
      size: T.small,
      weight: 500,
      color: C.dim,
      font: F.ui,
      baseline: 'middle',
      align: o.align ?? 'left',
    });
  }
}

export function kv(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  label: string,
  value: string,
  color = C.ink,
): void {
  text(g, label.toUpperCase(), x, y, { size: T.tiny, weight: 700, color: C.faint, font: F.num, track: 1.2 });
  text(g, value, x + w, y, {
    size: T.small,
    weight: 700,
    color,
    font: F.num,
    align: 'right',
    track: 0.4,
  });
}

export function divider(g: Ctx, x: number, y: number, w: number, color = C.line): void {
  g.fillStyle = color;
  g.fillRect(x, y, w, 1);
  g.fillStyle = alpha('#ffffff', 0.03);
  g.fillRect(x, y + 1, w, 1);
}

/** Word the player is spelling, rendered as letter tiles on a bench. */
export function spellBench(
  g: Ctx,
  o: {
    x: number;
    y: number;
    w: number;
    letters: { ch: string; color: string; value: number }[];
    placeholder?: string;
    tileSize?: number;
    valid?: boolean;
    error?: string;
  },
): void {
  const size = o.tileSize ?? 54;
  const gap = 6;
  const total = o.letters.length * (size + gap) - gap;
  let sx = o.x + Math.max(0, (o.w - total) / 2);
  const cy = o.y + size / 2;
  if (!o.letters.length) {
    text(g, o.placeholder ?? 'Select letters to forge a word', o.x + o.w / 2, cy, {
      size: T.small,
      weight: 500,
      color: C.faint,
      font: F.ui,
      align: 'center',
      baseline: 'middle',
      track: 0.6,
    });
    return;
  }
  for (const l of o.letters) {
    slab(g, l.ch.toUpperCase(), sx + size / 2, cy, size, {
      fill: l.color,
      ink: '#0d0f18',
    });
    text(g, `${l.value}`, sx + size - 6, o.y + size - 4, {
      size: T.micro,
      weight: 700,
      color: alpha('#ffffff', 0.6),
      font: F.num,
      align: 'right',
    });
    sx += size + gap;
  }
}

export function drawTip(g: Ctx, tip: Tip, x: number, y: number, screenW: number, screenH: number): void {
  const w = tip.width ?? 260;
  g.save();
  g.font = `500 ${T.small}px ${F.ui}`;
  const lines: { text: string; color: string }[] = [];
  for (const l of tip.lines) {
    const words = l.text.split(' ');
    let cur = '';
    for (const word of words) {
      const test = cur ? `${cur} ${word}` : word;
      if (textWidth(g, test, { size: T.small, weight: 500, font: F.ui }) > w - 24 && cur) {
        lines.push({ text: cur, color: l.color ?? C.dim });
        cur = word;
      } else cur = test;
    }
    if (cur) lines.push({ text: cur, color: l.color ?? C.dim });
  }
  const titleH = tip.title ? 26 : 0;
  const h = titleH + lines.length * 18 + 16;
  let px = x + 16;
  let py = y + 14;
  if (px + w > screenW - 12) px = x - w - 16;
  if (py + h > screenH - 12) py = Math.max(12, screenH - h - 12);

  panel(g, px, py, w, h, {
    fill: 'rgba(9,11,20,0.97)',
    stroke: alpha(C.gold, 0.5),
    r: R.md,
    shadow: 24,
    shadowColor: 'rgba(0,0,0,0.7)',
  });
  let ty = py + 14;
  if (tip.title) {
    text(g, tip.title.toUpperCase(), px + 12, ty + 8, {
      size: T.tiny,
      weight: 700,
      color: C.gold,
      font: F.ui,
      track: 1.4,
      baseline: 'middle',
    });
    ty += titleH;
  } else ty += 4;
  for (const l of lines) {
    text(g, l.text, px + 12, ty + 8, {
      size: T.small,
      weight: 500,
      color: l.color,
      font: F.ui,
      baseline: 'middle',
      max: w - 24,
    });
    ty += 18;
  }
  g.restore();
}

export function tipsFor(g: Ctx, kit: Kit, screenW: number, screenH: number): void {
  const h = kit.at(kit.mx, kit.my);
  if (!h || !h.tip) return;
  drawTip(g, h.tip, kit.mx, kit.my, screenW, screenH);
}

/** A circular badge, used for core counts and costs. */
export function badge(
  g: Ctx,
  o: { x: number; y: number; r: number; color: string; icon?: IconName; label?: string; ink?: string },
): void {
  circle(g, o.x, o.y, o.r);
  g.fillStyle = alpha(o.color, 0.16);
  g.fill();
  circle(g, o.x, o.y, o.r);
  g.strokeStyle = alpha(o.color, 0.7);
  g.lineWidth = 1.4;
  g.stroke();
  if (o.icon) {
    icon(g, o.icon, o.x, o.y, o.r * 1.15, o.color, true);
  } else if (o.label) {
    text(g, o.label, o.x, o.y + 0.5, {
      size: o.r * 1.15,
      weight: 700,
      color: o.ink ?? o.color,
      font: F.num,
      align: 'center',
      baseline: 'middle',
    });
  }
}

export function ellipsis(g: Ctx, str: string, max: number, size = T.small): string {
  return ellipsize(g, str, max, { size, weight: 500, font: F.ui });
}
