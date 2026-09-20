/**
 * Canvas drawing toolkit.
 *
 * Everything visual is procedural: no bitmap assets, no external art. Shapes are
 * built from a small vocabulary (plates, tiles, slots, gauges) so the game keeps
 * one coherent identity and can be re-skinned later without touching gameplay.
 */
import { C, DEPTH, F, R, T, W } from './theme';

export type Ctx = CanvasRenderingContext2D;

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** `rgba` alias used by screens for quick alpha fills. */
export const alpha = (hex: string, a: number): string => rgba(hex, a);

export const rgba = (hex: string, a: number): string => {
  const h = hex.replace('#', '');
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
};

export const mix = (a: string, b: string, t: number): string => {
  const pa = parseInt(a.replace('#', ''), 16);
  const pb = parseInt(b.replace('#', ''), 16);
  const r = Math.round(((pa >> 16) & 255) * (1 - t) + ((pb >> 16) & 255) * t);
  const g = Math.round(((pa >> 8) & 255) * (1 - t) + ((pb >> 8) & 255) * t);
  const bl = Math.round((pa & 255) * (1 - t) + (pb & 255) * t);
  return `rgb(${r},${g},${bl})`;
};

export function rr(g: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  g.beginPath();
  g.moveTo(x + rad, y);
  g.lineTo(x + w - rad, y);
  g.arcTo(x + w, y, x + w, y + rad, rad);
  g.lineTo(x + w, y + h - rad);
  g.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  g.lineTo(x + rad, y + h);
  g.arcTo(x, y + h, x, y + h - rad, rad);
  g.lineTo(x, y + rad);
  g.arcTo(x, y, x + rad, y, rad);
  g.closePath();
}

export function shadow(g: Ctx, y = 6, a = 0.35, blur = 14): void {
  g.shadowColor = rgba('#000000', a);
  g.shadowBlur = blur;
  g.shadowOffsetY = y;
}

export const noShadow = (g: Ctx): void => {
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;
};

/** A raised metal plate — the base surface for panels and HUD blocks. */
export function plate(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  opts: { radius?: number; fill?: string; edge?: string; depth?: number; alpha?: number } = {},
): void {
  const radius = opts.radius ?? R.md;
  const depth = opts.depth ?? DEPTH.plate / 2;
  g.save();
  if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
  // contact shadow
  g.fillStyle = rgba('#000000', 0.34);
  rr(g, x, y + depth, w, h, radius);
  g.fill();
  // face
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, opts.fill ?? C.panelHi);
  grad.addColorStop(1, opts.fill ? mix(opts.fill, '#000000', 0.25) : C.panel);
  g.fillStyle = grad;
  rr(g, x, y, w, h, radius);
  g.fill();
  // top highlight
  g.strokeStyle = rgba('#ffffff', 0.07);
  g.lineWidth = W.hair;
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, radius);
  g.stroke();
  if (opts.edge) {
    g.strokeStyle = rgba(opts.edge, 0.55);
    g.lineWidth = W.thin;
    rr(g, x + 1, y + 1, w - 2, h - 2, radius);
    g.stroke();
  }
  g.restore();
}

/** Inset well — used for the letter pool tray and empty slots. */
export function well(g: Ctx, x: number, y: number, w: number, h: number, radius: number = R.md): void {
  g.save();
  const grad = g.createLinearGradient(x, y, x, y + h);
  grad.addColorStop(0, C.panelLo);
  grad.addColorStop(1, mix(C.panelLo, '#ffffff', 0.04));
  g.fillStyle = grad;
  rr(g, x, y, w, h, radius);
  g.fill();
  g.strokeStyle = rgba('#000000', 0.5);
  g.lineWidth = W.thin;
  rr(g, x + 1, y + 1, w - 2, h - 2, radius);
  g.stroke();
  g.strokeStyle = rgba(C.lineHi, 0.35);
  g.lineWidth = W.hair;
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, radius);
  g.stroke();
  g.restore();
}

export type TileState =
  /** Solid letterpress tile holding a letter. */
  | 'filled'
  /** Empty recessed slot waiting for a letter. */
  | 'slot'
  /** Missing letter, emphasised — the wildcard can fill this. */
  | 'missing'
  /** Just filled by the wildcard this instant. */
  | 'wild'
  /** Locked / consumed during the word-completion beat. */
  | 'lock';

/**
 * A physical letter tile. This single primitive carries most of the game's
 * identity, so it takes the most care: bevel, letterpress ink and a real press
 * depth when it locks into a word.
 */
export function tile(
  g: Ctx,
  x: number,
  y: number,
  size: number,
  letter: string | null,
  state: TileState = 'filled',
  opts: { alpha?: number; press?: number; glow?: string; tilt?: number; scale?: number } = {},
): void {
  const s = size * (opts.scale ?? 1);
  const px = x + (size - s) / 2;
  const py = y + (size - s) / 2;
  const press = opts.press ?? 0;
  const rad = s * 0.16;
  g.save();
  if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
  if (opts.tilt) {
    g.translate(px + s / 2, py + s / 2);
    g.rotate(opts.tilt);
    g.translate(-(px + s / 2), -(py + s / 2));
  }

  if (state === 'slot' || state === 'missing') {
    const isMissing = state === 'missing';
    g.fillStyle = rgba(isMissing ? C.gold : C.slotEdge, isMissing ? 0.16 : 0.3);
    rr(g, px, py, s, s, rad);
    g.fill();
    g.setLineDash(isMissing ? [s * 0.16, s * 0.12] : [s * 0.1, s * 0.09]);
    g.lineWidth = Math.max(2, s * 0.055);
    g.strokeStyle = isMissing ? rgba(C.gold, 0.9) : rgba(C.slotEdge, 0.75);
    rr(g, px + g.lineWidth / 2, py + g.lineWidth / 2, s - g.lineWidth, s - g.lineWidth, rad);
    g.stroke();
    g.setLineDash([]);
    if (isMissing) {
      g.fillStyle = rgba(C.gold, 0.75);
      g.font = `700 ${s * 0.46}px ${F.ui}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText('?', px + s / 2, py + s / 2 + s * 0.02);
    }
    g.restore();
    return;
  }

  const depth = DEPTH.tile - press * (DEPTH.tile - DEPTH.press);
  const isWild = state === 'wild';
  const isLock = state === 'lock';
  const faceTop = isWild ? '#e6dcff' : isLock ? '#dff6e6' : C.tileFaceHi;
  const faceBot = isWild ? '#b79cf0' : isLock ? '#8fd8a8' : C.tileFace;
  const side = isWild ? '#6f4fb5' : isLock ? '#4c8a63' : C.tileDeep;

  if (opts.glow) {
    g.shadowColor = rgba(opts.glow, 0.85);
    g.shadowBlur = s * 0.5;
    g.shadowOffsetY = 0;
  } else {
    g.shadowColor = rgba('#000000', 0.42);
    g.shadowBlur = s * 0.16;
    g.shadowOffsetY = depth * 0.8;
  }

  // extruded side
  g.fillStyle = side;
  rr(g, px, py + depth, s, s, rad);
  g.fill();
  g.shadowColor = 'rgba(0,0,0,0)';
  g.shadowBlur = 0;
  g.shadowOffsetY = 0;

  // face
  const grad = g.createLinearGradient(px, py, px, py + s);
  grad.addColorStop(0, faceTop);
  grad.addColorStop(1, faceBot);
  g.fillStyle = grad;
  rr(g, px, py, s, s, rad);
  g.fill();

  // inner bevel
  g.strokeStyle = rgba('#ffffff', 0.55);
  g.lineWidth = Math.max(1, s * 0.03);
  rr(g, px + s * 0.06, py + s * 0.06, s * 0.88, s * 0.88, rad * 0.8);
  g.stroke();
  g.strokeStyle = rgba(side, 0.45);
  rr(g, px + 1, py + 1, s - 2, s - 2, rad);
  g.stroke();

  if (letter) {
    g.fillStyle = isWild ? '#2a1b4d' : isLock ? '#14401f' : C.tileInk;
    g.font = `800 ${s * 0.56}px ${F.ui}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    // letterpress bite: ink sits slightly low and light comes from top
    g.globalAlpha = (opts.alpha ?? 1) * 0.28;
    g.fillText(letter, px + s / 2, py + s / 2 + s * 0.055);
    g.globalAlpha = opts.alpha ?? 1;
    g.fillText(letter, px + s / 2, py + s / 2 + s * 0.03);
  }
  g.restore();
}

/** Small rounded status chip. Shape (a leading dot) carries meaning beyond colour. */
export function chip(
  g: Ctx,
  x: number,
  y: number,
  text: string,
  color: string,
  opts: { align?: 'left' | 'center'; font?: number; pad?: number; icon?: 'dot' | 'none' } = {},
): number {
  const size = opts.font ?? T.micro;
  g.font = `700 ${size}px ${F.ui}`;
  const tw = g.measureText(text).width;
  const pad = opts.pad ?? 9;
  const icon = opts.icon ?? 'dot';
  const w = tw + pad * 2 + (icon === 'dot' ? size * 0.9 : 0);
  const h = size + pad * 1.25;
  const ox = opts.align === 'center' ? x - w / 2 : x;
  g.fillStyle = rgba(color, 0.14);
  rr(g, ox, y, w, h, h / 2);
  g.fill();
  g.strokeStyle = rgba(color, 0.45);
  g.lineWidth = W.hair;
  rr(g, ox + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  g.stroke();
  let tx = ox + pad;
  if (icon === 'dot') {
    g.fillStyle = color;
    g.beginPath();
    g.arc(tx + size * 0.3, y + h / 2, size * 0.26, 0, Math.PI * 2);
    g.fill();
    tx += size * 0.9;
  }
  g.fillStyle = color;
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(text, tx, y + h / 2 + 0.5);
  return w;
}

export function label(
  g: Ctx,
  text: string,
  x: number,
  y: number,
  opts: {
    font?: string;
    size?: number;
    color?: string;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    weight?: number;
    tracking?: number;
    alpha?: number;
  } = {},
): void {
  g.save();
  g.font = `${opts.weight ?? 600} ${opts.size ?? T.body}px ${opts.font ?? F.ui}`;
  g.fillStyle = opts.color ?? C.ink;
  g.textAlign = opts.align ?? 'left';
  g.textBaseline = opts.baseline ?? 'alphabetic';
  if (opts.alpha !== undefined) g.globalAlpha = opts.alpha;
  if (opts.tracking) {
    // letter-spacing is not reliably supported everywhere; fake it for caps labels
    let cx = x;
    const chars = [...text];
    const total = chars.reduce((acc, ch) => acc + g.measureText(ch).width + opts.tracking!, 0);
    if (opts.align === 'center') cx = x - total / 2;
    else if (opts.align === 'right') cx = x - total;
    for (const ch of chars) {
      g.textAlign = 'left';
      g.fillText(ch, cx, y);
      cx += g.measureText(ch).width + opts.tracking;
    }
  } else {
    g.fillText(text, x, y);
  }
  g.restore();
}

/** Horizontal progress bar with a notched track. */
export function bar(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  pct: number,
  color: string,
  opts: { track?: string; glow?: boolean } = {},
): void {
  const p = Math.max(0, Math.min(1, pct));
  g.fillStyle = opts.track ?? rgba('#000000', 0.45);
  rr(g, x, y, w, h, h / 2);
  g.fill();
  if (p > 0) {
    g.save();
    if (opts.glow) {
      g.shadowColor = rgba(color, 0.7);
      g.shadowBlur = 10;
    }
    const grad = g.createLinearGradient(x, y, x, y + h);
    grad.addColorStop(0, mix(color, '#ffffff', 0.25));
    grad.addColorStop(1, color);
    g.fillStyle = grad;
    rr(g, x, y, Math.max(h, w * p), h, h / 2);
    g.fill();
    g.restore();
  }
  g.strokeStyle = rgba(C.lineHi, 0.4);
  g.lineWidth = W.hair;
  rr(g, x + 0.5, y + 0.5, w - 1, h - 1, h / 2);
  g.stroke();
}

/** Diagonal hazard stripes — used to mark blocked / disabled states. */
export function hazardStripes(g: Ctx, x: number, y: number, w: number, h: number, color: string): void {
  g.save();
  rr(g, x, y, w, h, R.sm);
  g.clip();
  g.strokeStyle = rgba(color, 0.35);
  g.lineWidth = 6;
  for (let i = -h; i < w + h; i += 16) {
    g.beginPath();
    g.moveTo(x + i, y + h);
    g.lineTo(x + i + h, y);
    g.stroke();
  }
  g.restore();
}

/** Soft radial glow, cheap and reused by most VFX. */
export function glow(
  g: Ctx,
  x: number,
  y: number,
  radius: number,
  color: string,
  alpha = 0.5,
): void {
  const grad = g.createRadialGradient(x, y, 0, x, y, radius);
  grad.addColorStop(0, rgba(color, alpha));
  grad.addColorStop(1, rgba(color, 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

/** Star / spark shape used for impact pops. */
export function spark(g: Ctx, x: number, y: number, radius: number, points: number, color: string): void {
  g.fillStyle = color;
  g.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = (i / (points * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? radius : radius * 0.45;
    const px = x + Math.cos(a) * r;
    const py = y + Math.sin(a) * r;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
  g.fill();
}

/** Measure text with the exact font a label will use — keeps layout honest. */
export function measure(
  g: Ctx,
  text: string,
  opts: { size?: number; weight?: number; font?: string; tracking?: number } = {},
): number {
  g.save();
  g.font = `${opts.weight ?? 600} ${opts.size ?? T.body}px ${opts.font ?? F.ui}`;
  let w = g.measureText(text).width;
  if (opts.tracking) w += Math.max(0, [...text].length - 1) * opts.tracking;
  g.restore();
  return w;
}

/** Wraps text to a pixel width, returns the lines used. */
export function wrap(g: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}
