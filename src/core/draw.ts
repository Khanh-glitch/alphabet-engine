/** Canvas drawing primitives. Everything is written against a 1440x810 logical space. */
import { C, F } from '../theme';

export type Ctx = CanvasRenderingContext2D;

// ---- colour --------------------------------------------------------------
const hexCache = new Map<string, [number, number, number]>();

function rgb(hex: string): [number, number, number] {
  let v = hexCache.get(hex);
  if (!v) {
    let h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    const n = parseInt(h, 16);
    v = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    hexCache.set(hex, v);
  }
  return v;
}

export function alpha(hex: string, a: number): string {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

/** Mix two hex colours, t=0 -> a, t=1 -> b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return `rgb(${Math.round(r1 + (r2 - r1) * t)},${Math.round(g1 + (g2 - g1) * t)},${Math.round(
    b1 + (b2 - b1) * t,
  )})`;
}

export function shade(hex: string, amt: number): string {
  const [r, g, b] = rgb(hex);
  const f = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt * 255)));
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}

// ---- shapes --------------------------------------------------------------
export function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function circle(ctx: Ctx, x: number, y: number, r: number, fill?: string): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
}

export function poly(ctx: Ctx, pts: number[][], close = true): void {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  if (close) ctx.closePath();
}

/** Regular polygon (n sides) inscribed in a circle. */
export function ngon(ctx: Ctx, x: number, y: number, r: number, n: number, rot = -Math.PI / 2): void {
  ctx.beginPath();
  for (let i = 0; i < n; i++) {
    const a = rot + (i / n) * Math.PI * 2;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
  }
  ctx.closePath();
}

export type PanelOpts = {
  fill?: string | CanvasGradient;
  stroke?: string;
  lw?: number;
  r?: number;
  shadow?: number;
  shadowColor?: string;
  top?: string;
  dash?: number[];
  glow?: string;
};

export function panel(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  o: PanelOpts = {},
): void {
  ctx.save();
  if (o.shadow) {
    ctx.shadowBlur = o.shadow;
    ctx.shadowColor = o.shadowColor ?? 'rgba(0,0,0,0.6)';
  }
  rr(ctx, x, y, w, h, o.r ?? 12);
  if (o.fill) {
    ctx.fillStyle = o.fill;
    ctx.fill();
  }
  ctx.shadowBlur = 0;
  if (o.dash) ctx.setLineDash(o.dash);
  if (o.stroke) {
    if (o.glow) {
      ctx.shadowBlur = 14;
      ctx.shadowColor = o.glow;
    }
    ctx.strokeStyle = o.stroke;
    ctx.lineWidth = o.lw ?? 1;
    ctx.stroke();
    ctx.shadowBlur = 0;
  }
  ctx.setLineDash([]);
  if (o.top) {
    ctx.save();
    rr(ctx, x + 0.5, y + 0.5, w - 1, h - 1, (o.r ?? 12) - 0.5);
    ctx.clip();
    const g = ctx.createLinearGradient(0, y, 0, y + Math.min(h, 26));
    g.addColorStop(0, o.top);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x, y, w, Math.min(h, 26));
    ctx.restore();
  }
  ctx.restore();
}

// ---- text ----------------------------------------------------------------
export type TextOpts = {
  font?: string;
  size?: number;
  weight?: number;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  track?: number;
  alpha?: number;
  glow?: string;
  glowSize?: number;
  shadow?: boolean;
  max?: number;
};

export function fontOf(o: TextOpts): string {
  const weight = o.weight ?? 500;
  const fam = o.font ?? F.ui;
  return `${weight} ${o.size ?? 14}px ${fam}`;
}

export function text(ctx: Ctx, str: string, x: number, y: number, o: TextOpts = {}): number {
  ctx.save();
  ctx.font = fontOf(o);
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = o.track ? `${o.track}px` : '0px';
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'alphabetic';
  if (o.alpha !== undefined) ctx.globalAlpha = o.alpha;
  if (o.shadow) {
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.75)';
  }
  if (o.glow) {
    ctx.shadowBlur = o.glowSize ?? 12;
    ctx.shadowColor = o.glow;
  }
  ctx.fillStyle = o.color ?? C.ink;
  const w = ctx.measureText(str).width;
  if (o.max && w > o.max) {
    ctx.restore();
    return text(ctx, ellipsize(ctx, str, o.max, o), x, y, { ...o, max: undefined });
  }
  ctx.fillText(str, x, y);
  ctx.restore();
  return w;
}

export function ellipsize(ctx: Ctx, str: string, max: number, o: TextOpts): string {
  ctx.save();
  ctx.font = fontOf(o);
  if (ctx.measureText(str).width <= max) {
    ctx.restore();
    return str;
  }
  let out = str;
  while (out.length > 1 && ctx.measureText(out + '…').width > max) out = out.slice(0, -1);
  ctx.restore();
  return out + '…';
}

export function textWidth(ctx: Ctx, str: string, o: TextOpts = {}): number {
  ctx.save();
  ctx.font = fontOf(o);
  (ctx as Ctx & { letterSpacing: string }).letterSpacing = o.track ? `${o.track}px` : '0px';
  const w = ctx.measureText(str).width;
  ctx.restore();
  return w + (o.track ? o.track : 0);
}

/** Text with a vertical gradient fill. */
export function gradText(
  ctx: Ctx,
  str: string,
  x: number,
  y: number,
  top: string,
  bottom: string,
  o: TextOpts = {},
): number {
  ctx.save();
  ctx.font = fontOf(o);
  ctx.textAlign = o.align ?? 'left';
  ctx.textBaseline = o.baseline ?? 'middle';
  const w = ctx.measureText(str).width;
  const size = o.size ?? 14;
  const g = ctx.createLinearGradient(0, y - size * 0.6, 0, y + size * 0.6);
  g.addColorStop(0, top);
  g.addColorStop(1, bottom);
  if (o.glow) {
    ctx.shadowBlur = o.glowSize ?? 18;
    ctx.shadowColor = o.glow;
  }
  ctx.fillStyle = g;
  ctx.fillText(str, x, y);
  ctx.restore();
  return w;
}

// ---- widgets -------------------------------------------------------------
export function bar(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  color: string,
  o: { bg?: string; r?: number; ghost?: number; flip?: boolean } = {},
): void {
  const r = o.r ?? h / 2;
  ctx.save();
  rr(ctx, x, y, w, h, r);
  ctx.fillStyle = o.bg ?? 'rgba(255,255,255,0.07)';
  ctx.fill();
  if (o.ghost !== undefined && o.ghost > pct) {
    const gw = w * Math.min(1, o.ghost);
    rr(ctx, x, y, gw, h, r);
    ctx.fillStyle = alpha('#ffffff', 0.2);
    ctx.fill();
  }
  const p = Math.max(0, Math.min(1, pct));
  if (p > 0.001) {
    const fw = Math.max(h, w * p);
    rr(ctx, o.flip ? x + w - fw : x, y, fw, h, r);
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, shade(color, 0.16));
    g.addColorStop(1, color);
    ctx.fillStyle = g;
    ctx.fill();
    ctx.save();
    ctx.clip();
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = shade(color, 0.4);
    ctx.fillRect(x, y, w, Math.max(1, h * 0.32));
    ctx.restore();
  }
  ctx.restore();
}

export function glowDot(ctx: Ctx, x: number, y: number, r: number, color: string, puls = 1): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
  g.addColorStop(0, alpha(color, 0.85 * puls));
  g.addColorStop(0.35, alpha(color, 0.3 * puls));
  g.addColorStop(1, alpha(color, 0));
  circle(ctx, x, y, r * 3);
  ctx.fillStyle = g;
  ctx.fill();
  circle(ctx, x, y, r);
  ctx.fillStyle = color;
  ctx.fill();
}

// ---- icon set (drawn, never bundled) -------------------------------------
export type IconName =
  | 'heart'
  | 'bolt'
  | 'coin'
  | 'skull'
  | 'lock'
  | 'wave'
  | 'shield'
  | 'star'
  | 'gear'
  | 'chevron'
  | 'pause'
  | 'play'
  | 'sound'
  | 'mute'
  | 'plus'
  | 'close'
  | 'check'
  | 'arrow'
  | 'flask'
  | 'anvil'
  | 'map'
  | 'sword';

export function icon(
  ctx: Ctx,
  name: IconName,
  x: number,
  y: number,
  s: number,
  color: string,
  filled = true,
): void {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1.4, s * 0.11);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const h = s / 2;
  const P = (fn: () => void) => {
    ctx.beginPath();
    fn();
  };
  switch (name) {
    case 'heart':
      P(() => {
        ctx.moveTo(0, h * 0.92);
        ctx.bezierCurveTo(-h * 1.5, -h * 0.35, -h * 0.55, -h * 1.35, 0, -h * 0.4);
        ctx.bezierCurveTo(h * 0.55, -h * 1.35, h * 1.5, -h * 0.35, 0, h * 0.92);
      });
      filled ? ctx.fill() : ctx.stroke();
      break;
    case 'bolt':
      P(() => {
        ctx.moveTo(h * 0.28, -h);
        ctx.lineTo(-h * 0.62, h * 0.14);
        ctx.lineTo(-h * 0.02, h * 0.14);
        ctx.lineTo(-h * 0.28, h);
        ctx.lineTo(h * 0.62, -h * 0.16);
        ctx.lineTo(h * 0.02, -h * 0.16);
      });
      ctx.closePath();
      filled ? ctx.fill() : ctx.stroke();
      break;
    case 'coin':
      P(() => ctx.arc(0, 0, h * 0.9, 0, Math.PI * 2));
      ctx.stroke();
      P(() => ctx.arc(0, 0, h * 0.44, 0, Math.PI * 2));
      ctx.fill();
      break;
    case 'skull':
      P(() => {
        ctx.arc(0, -h * 0.16, h * 0.72, Math.PI, 0);
        ctx.lineTo(h * 0.72, h * 0.3);
        ctx.lineTo(h * 0.3, h * 0.3);
        ctx.lineTo(h * 0.3, h * 0.85);
        ctx.lineTo(-h * 0.3, h * 0.85);
        ctx.lineTo(-h * 0.3, h * 0.3);
        ctx.lineTo(-h * 0.72, h * 0.3);
      });
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      P(() => ctx.arc(-h * 0.32, -h * 0.2, h * 0.2, 0, Math.PI * 2));
      ctx.fill();
      P(() => ctx.arc(h * 0.32, -h * 0.2, h * 0.2, 0, Math.PI * 2));
      ctx.fill();
      break;
    case 'lock':
      P(() => rr(ctx, -h * 0.7, -h * 0.05, h * 1.4, h * 0.95, h * 0.18));
      ctx.fill();
      P(() => ctx.arc(0, -h * 0.2, h * 0.42, Math.PI, 0));
      ctx.stroke();
      break;
    case 'shield':
      P(() => {
        ctx.moveTo(0, -h);
        ctx.lineTo(h * 0.82, -h * 0.55);
        ctx.lineTo(h * 0.82, h * 0.15);
        ctx.bezierCurveTo(h * 0.82, h * 0.75, h * 0.3, h, 0, h);
        ctx.bezierCurveTo(-h * 0.3, h, -h * 0.82, h * 0.75, -h * 0.82, h * 0.15);
        ctx.lineTo(-h * 0.82, -h * 0.55);
      });
      ctx.closePath();
      filled ? ctx.fill() : ctx.stroke();
      break;
    case 'star':
      P(() => {
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i / 10) * Math.PI * 2;
          const rad = i % 2 === 0 ? h : h * 0.45;
          const px = Math.cos(a) * rad;
          const py = Math.sin(a) * rad;
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
      });
      ctx.closePath();
      filled ? ctx.fill() : ctx.stroke();
      break;
    case 'gear':
      P(() => ctx.arc(0, 0, h * 0.42, 0, Math.PI * 2));
      ctx.stroke();
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        ctx.save();
        ctx.rotate(a);
        P(() => rr(ctx, -h * 0.14, -h * 0.98, h * 0.28, h * 0.36, h * 0.08));
        ctx.fill();
        ctx.restore();
      }
      break;
    case 'wave':
      ctx.lineWidth = Math.max(1.5, s * 0.13);
      for (let k = -1; k <= 1; k++) {
        P(() => {
          ctx.moveTo(-h, k * h * 0.5);
          ctx.bezierCurveTo(-h * 0.4, k * h * 0.5 - h * 0.5, h * 0.4, k * h * 0.5 + h * 0.5, h, k * h * 0.5);
        });
        ctx.stroke();
      }
      break;
    case 'chevron':
      P(() => {
        ctx.moveTo(-h * 0.4, -h * 0.7);
        ctx.lineTo(h * 0.45, 0);
        ctx.lineTo(-h * 0.4, h * 0.7);
      });
      ctx.stroke();
      break;
    case 'pause':
      P(() => rr(ctx, -h * 0.62, -h * 0.8, h * 0.44, h * 1.6, h * 0.14));
      ctx.fill();
      P(() => rr(ctx, h * 0.18, -h * 0.8, h * 0.44, h * 1.6, h * 0.14));
      ctx.fill();
      break;
    case 'play':
      P(() => {
        ctx.moveTo(-h * 0.55, -h * 0.85);
        ctx.lineTo(h * 0.75, 0);
        ctx.lineTo(-h * 0.55, h * 0.85);
      });
      ctx.closePath();
      ctx.fill();
      break;
    case 'sound':
      P(() => {
        ctx.moveTo(-h * 0.85, -h * 0.3);
        ctx.lineTo(-h * 0.35, -h * 0.3);
        ctx.lineTo(h * 0.15, -h * 0.85);
        ctx.lineTo(h * 0.15, h * 0.85);
        ctx.lineTo(-h * 0.35, h * 0.3);
        ctx.lineTo(-h * 0.85, h * 0.3);
      });
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1.2, s * 0.09);
      P(() => ctx.arc(h * 0.15, 0, h * 0.55, -Math.PI / 3, Math.PI / 3));
      ctx.stroke();
      P(() => ctx.arc(h * 0.15, 0, h * 0.92, -Math.PI / 3, Math.PI / 3));
      ctx.stroke();
      break;
    case 'mute':
      P(() => {
        ctx.moveTo(-h * 0.85, -h * 0.3);
        ctx.lineTo(-h * 0.35, -h * 0.3);
        ctx.lineTo(h * 0.15, -h * 0.85);
        ctx.lineTo(h * 0.15, h * 0.85);
        ctx.lineTo(-h * 0.35, h * 0.3);
        ctx.lineTo(-h * 0.85, h * 0.3);
      });
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = Math.max(1.4, s * 0.11);
      P(() => {
        ctx.moveTo(h * 0.42, -h * 0.42);
        ctx.lineTo(h * 0.92, h * 0.42);
        ctx.moveTo(h * 0.92, -h * 0.42);
        ctx.lineTo(h * 0.42, h * 0.42);
      });
      ctx.stroke();
      break;
    case 'plus':
      ctx.lineWidth = Math.max(1.8, s * 0.16);
      P(() => {
        ctx.moveTo(0, -h * 0.75);
        ctx.lineTo(0, h * 0.75);
        ctx.moveTo(-h * 0.75, 0);
        ctx.lineTo(h * 0.75, 0);
      });
      ctx.stroke();
      break;
    case 'close':
      ctx.lineWidth = Math.max(1.8, s * 0.14);
      P(() => {
        ctx.moveTo(-h * 0.65, -h * 0.65);
        ctx.lineTo(h * 0.65, h * 0.65);
        ctx.moveTo(h * 0.65, -h * 0.65);
        ctx.lineTo(-h * 0.65, h * 0.65);
      });
      ctx.stroke();
      break;
    case 'check':
      ctx.lineWidth = Math.max(2, s * 0.17);
      P(() => {
        ctx.moveTo(-h * 0.7, h * 0.05);
        ctx.lineTo(-h * 0.15, h * 0.6);
        ctx.lineTo(h * 0.75, -h * 0.6);
      });
      ctx.stroke();
      break;
    case 'arrow':
      ctx.lineWidth = Math.max(1.8, s * 0.15);
      P(() => {
        ctx.moveTo(-h * 0.8, 0);
        ctx.lineTo(h * 0.75, 0);
        ctx.moveTo(h * 0.2, -h * 0.55);
        ctx.lineTo(h * 0.78, 0);
        ctx.lineTo(h * 0.2, h * 0.55);
      });
      ctx.stroke();
      break;
    case 'sword':
      P(() => {
        ctx.moveTo(0, -h);
        ctx.lineTo(h * 0.26, -h * 0.5);
        ctx.lineTo(h * 0.26, h * 0.3);
        ctx.lineTo(-h * 0.26, h * 0.3);
        ctx.lineTo(-h * 0.26, -h * 0.5);
      });
      ctx.closePath();
      ctx.fill();
      P(() => rr(ctx, -h * 0.72, h * 0.3, h * 1.44, h * 0.24, h * 0.1));
      ctx.fill();
      P(() => rr(ctx, -h * 0.14, h * 0.55, h * 0.28, h * 0.45, h * 0.08));
      ctx.fill();
      break;
    case 'flask':
      P(() => {
        ctx.moveTo(-h * 0.3, -h);
        ctx.lineTo(h * 0.3, -h);
        ctx.lineTo(h * 0.3, -h * 0.35);
        ctx.lineTo(h * 0.9, h * 0.75);
        ctx.lineTo(-h * 0.9, h * 0.75);
        ctx.lineTo(-h * 0.3, -h * 0.35);
      });
      ctx.closePath();
      ctx.fill();
      break;
    case 'anvil':
      P(() => {
        ctx.moveTo(-h * 0.95, -h * 0.5);
        ctx.lineTo(h * 0.95, -h * 0.5);
        ctx.lineTo(h * 0.42, h * 0.1);
        ctx.lineTo(h * 0.3, h * 0.5);
        ctx.lineTo(-h * 0.3, h * 0.5);
        ctx.lineTo(-h * 0.42, h * 0.1);
      });
      ctx.closePath();
      ctx.fill();
      P(() => rr(ctx, -h * 0.55, h * 0.55, h * 1.1, h * 0.4, h * 0.1));
      ctx.fill();
      break;
    case 'map':
      P(() => {
        ctx.moveTo(-h, -h * 0.7);
        ctx.lineTo(-h * 0.35, -h);
        ctx.lineTo(h * 0.35, -h * 0.7);
        ctx.lineTo(h, -h);
        ctx.lineTo(h, h * 0.7);
        ctx.lineTo(h * 0.35, h);
        ctx.lineTo(-h * 0.35, h * 0.7);
        ctx.lineTo(-h, h);
      });
      ctx.closePath();
      ctx.fill();
      break;
  }
  ctx.restore();
}

/** Soft radial vignette / atmosphere blob. */
export function blob(
  ctx: Ctx,
  x: number,
  y: number,
  r: number,
  color: string,
  strength = 0.5,
): void {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(color, strength));
  g.addColorStop(1, alpha(color, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

/** Draw a letter on a slab tile - the signature visual of the game. */
export function slab(
  ctx: Ctx,
  ch: string,
  x: number,
  y: number,
  size: number,
  o: { fill?: string; ink?: string; r?: number; tilt?: number; lift?: boolean } = {},
): void {
  const r = o.r ?? size * 0.16;
  ctx.save();
  ctx.translate(x, y);
  if (o.tilt) ctx.rotate(o.tilt);
  const half = size / 2;
  if (o.lift !== false) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.55)';
    ctx.shadowBlur = size * 0.18;
    ctx.shadowOffsetY = size * 0.07;
    rr(ctx, -half, -half, size, size, r);
    ctx.fillStyle = o.fill ?? C.panelHi;
    ctx.fill();
    ctx.restore();
  }
  const base = o.fill ?? C.panelHi;
  const g = ctx.createLinearGradient(0, -half, 0, half);
  g.addColorStop(0, shade(base, 0.1));
  g.addColorStop(0.52, base);
  g.addColorStop(1, shade(base, -0.09));
  rr(ctx, -half, -half, size, size, r);
  ctx.fillStyle = g;
  ctx.fill();
  ctx.save();
  rr(ctx, -half, -half, size, size, r);
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.1)';
  ctx.fillRect(-half, -half, size, size * 0.16);
  ctx.restore();
  rr(ctx, -half + 0.5, -half + 0.5, size - 1, size - 1, r - 0.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.12)';
  ctx.lineWidth = 1;
  ctx.stroke();
  text(ctx, ch, 0, size * 0.04, {
    font: F.slab,
    weight: 800,
    size: size * 0.62,
    color: o.ink ?? C.ink,
    align: 'center',
    baseline: 'middle',
  });
  ctx.restore();
}

export function roundRectClip(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  rr(ctx, x, y, w, h, r);
  ctx.clip();
}

/** Greedy word wrap using the current font options. */
export function wrapLines(ctx: Ctx, str: string, maxW: number, o: TextOpts = {}): string[] {
  ctx.save();
  ctx.font = fontOf(o);
  const words = str.split(' ');
  const out: string[] = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? `${cur} ${w}` : w;
    if (ctx.measureText(test).width > maxW && cur) {
      out.push(cur);
      cur = w;
    } else cur = test;
  }
  if (cur) out.push(cur);
  ctx.restore();
  return out;
}
