/** Domain visuals: letter tiles, weapons, enemies, cards. */
import { C, F, R, T } from '../theme';
import { alpha, bar, circle, icon, mix, ngon, panel, rr, slab, text, textWidth, ellipsize, type Ctx } from '../core/draw';
import { polarityOf } from '../game/dict';
import { TRAITS, weaponColor } from '../game/forge';
import { ENEMIES } from '../game/enemies';
import type { EnemyInst, WeaponDef, WeaponInst } from '../game/types';
import { clamp, lerp } from '../core/rng';

export const POLAR_INK = { pos: C.cyan, neg: C.ember } as const;

/** The building block of the whole UI: a letter on a slab. */
export function letterTile(
  g: Ctx,
  o: {
    x: number;
    y: number;
    size: number;
    ch: string;
    selected?: boolean;
    dim?: boolean;
    hover?: number;
    value?: number;
    tint?: string;
    tilt?: number;
    hot?: boolean;
    ghost?: boolean;
    pulse?: number;
  },
): void {
  const size = o.size;
  const hv = o.hover ?? 0;
  const sel = o.selected ? 1 : 0;
  const lift = hv * 4 - sel * 6 + (o.pulse ? Math.sin(o.pulse * 3) * 1.2 : 0);
  const p = polarityOf(o.ch);
  const tint = o.tint ?? (p === 'pos' ? C.bg2 : mix(C.bg2, C.ember, 0.14));
  const fill = o.selected ? mix(tint, C.gold, 0.24) : mix(tint, C.panelHi, hv * 0.5);
  g.save();
  if (o.dim) g.globalAlpha = 0.38;
  if (o.ghost) g.globalAlpha = 0.5;
  if (sel || hv > 0.05 || o.hot) {
    g.shadowBlur = 16 * Math.max(hv, sel) + (o.hot ? 10 : 0);
    g.shadowColor = alpha(o.selected ? C.gold : C.cyan, 0.55 * Math.max(hv, sel));
  }
  slab(g, o.ch.toUpperCase(), o.x, o.y - lift, size, {
    fill,
    ink: o.selected ? '#1a1405' : C.ink,
  });
  g.shadowBlur = 0;
  // polarity pip
  const pip = size * 0.13;
  circle(g, o.x + size * 0.34, o.y - lift + size * 0.34, pip * 0.6, alpha(POLAR_INK[p], 0.9));
  g.fill();
  if (o.value !== undefined) {
    text(g, `${o.value}`, o.x - size * 0.36, o.y - lift + size * 0.36, {
      size: size * 0.19,
      weight: 700,
      color: alpha('#ffffff', 0.5),
      font: F.num,
      align: 'left',
      baseline: 'middle',
    });
  }
  if (o.selected) {
    rr(g, o.x - size / 2 - 3, o.y - lift - size / 2 - 3, size + 6, size + 6, size * 0.22);
    g.strokeStyle = alpha(C.gold, 0.9);
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}

/** A forged word standing on its mount, aiming down the lane. */
export function weaponTower(
  g: Ctx,
  o: {
    x: number;
    y: number;
    def: WeaponInst | WeaponDef;
    slot?: number;
    flash?: number;
    recoil?: number;
    aim?: number;
    range?: number;
    showRange?: boolean;
    hover?: number;
    selected?: boolean;
    time?: number;
    scale?: number;
    chilled?: boolean;
  },
): void {
  const color = o.chilled ? mix(weaponColor(o.def), C.cyan, 0.45) : weaponColor(o.def);
  const size = (o.def.len >= 6 ? 44 : 40) * (o.scale ?? 1);
  const flash = o.flash ?? 0;
  const recoil = (o.recoil ?? 0) * 5;
  const tilt = (o.aim ?? 0) * 0.06;

  g.save();
  if (o.showRange && o.range) {
    circle(g, o.x, o.y, o.range);
    g.fillStyle = alpha(color, 0.05 + 0.02 * Math.sin((o.time ?? 0) * 2));
    g.fill();
    circle(g, o.x, o.y, o.range);
    g.strokeStyle = alpha(color, 0.22);
    g.setLineDash([5, 6]);
    g.lineWidth = 1;
    g.stroke();
    g.setLineDash([]);
  }
  // mount
  rr(g, o.x - size * 0.62, o.y + size * 0.34, size * 1.24, 10, 5);
  g.fillStyle = 'rgba(0,0,0,0.42)';
  g.fill();

  // barrel
  g.save();
  g.translate(o.x, o.y);
  g.rotate(tilt);
  const bl = size * (0.85 + (o.def.trait === 'PIERCE' ? 0.3 : 0));
  rr(g, size * 0.1 - recoil, -size * 0.11, bl, size * 0.22, size * 0.1);
  const bgr = g.createLinearGradient(o.x, -6, o.x + bl, 6);
  bgr.addColorStop(0, mix(color, '#ffffff', 0.25));
  bgr.addColorStop(1, shadeAlpha(color, 0.9));
  g.fillStyle = bgr;
  g.fill();
  g.restore();

  if (flash > 0.02) {
    g.save();
    g.shadowBlur = 22 * flash;
    g.shadowColor = color;
    circle(g, o.x + size * 0.62 - recoil, o.y, size * 0.24 * flash + 2);
    g.fillStyle = alpha('#ffffff', 0.85 * flash);
    g.fill();
    g.restore();
  }

  const glow = Math.max(o.hover ?? 0, o.selected ? 1 : 0, flash);
  if (glow > 0.02) {
    g.shadowBlur = 18 * glow;
    g.shadowColor = alpha(color, 0.8);
  }
  slab(g, o.def.word[0].toUpperCase(), o.x, o.y, size, {
    fill: mix(C.bg2, color, 0.28),
    ink: C.ink,
    r: size * 0.22,
  });
  g.shadowBlur = 0;
  // trait gem
  const gy = o.y - size * 0.62;
  ngon(g, o.x, gy, size * 0.16, 6);
  g.fillStyle = color;
  g.fill();
  if (o.def.mods.length) {
    for (let i = 0; i < Math.min(3, o.def.mods.length); i++) {
      circle(g, o.x - size * 0.34 + i * size * 0.2, o.y + size * 0.62, 2.6, alpha(C.ink, 0.5));
      g.fill();
    }
  }
  g.restore();
}

const shadeAlpha = (hex: string, a: number) => alpha(hex, a);

/** Enemy units are letter tiles too - the same alphabet, turned against you. */
export function enemyTile(
  g: Ctx,
  o: { e: EnemyInst; time: number; laneH: number; hover?: number },
): void {
  const e = o.e;
  const def = ENEMIES[e.kind];
  const size = e.size;
  const x = e.x;
  const y = e.y;
  const hurt = e.hitFlash > 0;
  const frozen = e.slowT > 0;
  const marked = e.markT > 0;
  const corr = e.corrT > 0;
  g.save();

  // ground contact: a flat ellipse, not a second tile
  g.save();
  g.globalAlpha = 0.3;
  g.translate(x, y + size * 0.6);
  g.scale(1, 0.28);
  circle(g, 0, 0, size * 0.44, 'rgba(0,0,0,0.85)');
  g.fill();
  g.restore();

  if (def.boss) {
    const pulse = 1 + Math.sin(o.time * 3) * 0.04;
    circle(g, x, y, size * 0.95 * pulse);
    g.fillStyle = alpha(C.blood, 0.12);
    g.fill();
    // name plate so the headline threat is unmistakable
    const label = e.name.toUpperCase();
    text(g, label, x, y - size * 0.92, {
      size: T.micro + 2,
      weight: 700,
      color: C.blood,
      font: F.ui,
      align: 'center',
      baseline: 'middle',
      track: 3,
      glow: alpha(C.blood, 0.6),
      glowSize: 12,
    });
  }
  if (marked) {
    circle(g, x, y, size * (0.86 + 0.05 * Math.sin(o.time * 6)));
    g.strokeStyle = alpha(C.cyan, 0.75);
    g.lineWidth = 2;
    g.stroke();
  }
  if (corr) {
    circle(g, x, y, size * (0.92 + 0.05 * Math.cos(o.time * 5)));
    g.strokeStyle = alpha(C.ember, 0.6);
    g.lineWidth = 2;
    g.setLineDash([7, 6]);
    g.stroke();
    g.setLineDash([]);
  }

  let fill = mix(C.bg1, def.tint, 0.22);
  if (frozen) fill = mix(fill, C.cyan, 0.35);
  if (hurt) fill = mix(fill, '#ffffff', 0.7);

  const tilt = def.boss ? Math.sin(o.time * 2) * 0.02 : 0;
  g.save();
  if (hurt) {
    g.shadowBlur = 20;
    g.shadowColor = '#ffffff';
  }
  slab(g, e.name[0].toUpperCase(), x, y, size, {
    fill,
    ink: hurt ? '#111420' : mix(C.ink, def.tint, 0.35),
    r: size * (def.boss ? 0.2 : 0.26),
    tilt,
  });
  g.restore();

  // armour pips
  if (e.armor >= 2) {
    const n = Math.min(4, Math.round(e.armor / 3));
    for (let i = 0; i < n; i++) {
      const px = x - (n - 1) * 5.5 + i * 11;
      ngon(g, px, y - size * 0.72, 3.6, 6);
      g.fillStyle = alpha(C.cyan, 0.9);
      g.fill();
      g.strokeStyle = alpha(C.bg0, 0.8);
      g.lineWidth = 1;
      g.stroke();
    }
  }
  if (e.stunT > 0) {
    for (let i = 0; i < 3; i++) {
      const a = o.time * 6 + (i / 3) * Math.PI * 2;
      circle(g, x + Math.cos(a) * size * 0.7, y - size * 0.55 + Math.sin(a) * 5, 2.4, alpha(C.gold, 0.9));
      g.fill();
    }
  }
  if (e.dotT > 0) {
    circle(g, x - size * 0.55, y - size * 0.55, 4, alpha(C.acid, 0.9));
    g.fill();
    icon(g, 'flask', x - size * 0.55, y - size * 0.55, 7, C.bg0, true);
  }

  // health bar: always visible on anything with real health
  const pct = clamp(e.hp / e.maxHp, 0, 1);
  if (pct < 1 || e.maxHp > 60) {
    const w = size * 1.16;
    bar(g, x - w / 2, y + size * 0.54, w, 4.5, pct, pct > 0.5 ? C.good : pct > 0.25 ? C.warn : C.bad, {
      bg: 'rgba(0,0,0,0.62)',
      r: 2,
    });
    rr(g, x - w / 2 + 0.5, y + size * 0.54 + 0.5, w - 1, 3.5, 2);
    g.strokeStyle = 'rgba(0,0,0,0.5)';
    g.lineWidth = 1;
    g.stroke();
  }
  g.restore();
}

/** Numeric readout block used on cards and panels. */
export function statRow(
  g: Ctx,
  o: { x: number; y: number; w: number; label: string; value: string; color?: string; size?: number; mono?: boolean },
): void {
  const size = o.size ?? T.small;
  text(g, o.label.toUpperCase(), o.x, o.y, {
    size: T.micro + 1,
    weight: 700,
    color: C.faint,
    font: F.num,
    track: 1.1,
    baseline: 'middle',
  });
  text(g, o.value, o.x + o.w, o.y, {
    size,
    weight: 700,
    color: o.color ?? C.ink,
    font: o.mono === false ? F.ui : F.num,
    align: 'right',
    baseline: 'middle',
    track: 0.3,
  });
}

/** Full weapon card: the payoff of forging a word. */
export function weaponCard(
  g: Ctx,
  o: {
    x: number;
    y: number;
    w: number;
    h: number;
    def: WeaponDef;
    hover?: number;
    selected?: boolean;
    time?: number;
    kills?: number;
    compact?: boolean;
  },
): void {
  const color = weaponColor(o.def);
  const pad = 14;
  g.save();
  panel(g, o.x, o.y, o.w, o.h, {
    fill: mix(C.panel, color, 0.06),
    stroke: alpha(color, o.selected ? 0.9 : 0.35 + (o.hover ?? 0) * 0.3),
    r: R.lg,
    top: alpha(color, 0.08),
    shadow: o.selected ? 20 : 0,
    shadowColor: alpha(color, 0.35),
  });

  const tileSize = Math.min(46, o.h - pad * 2 - 8);
  letterTile(g, {
    x: o.x + pad + tileSize / 2,
    y: o.y + pad + tileSize / 2 + 4,
    size: tileSize,
    ch: o.def.word[0],
    tint: mix(C.bg2, color, 0.2),
  });

  const tx = o.x + pad + tileSize + 14;
  const tw = o.w - (tx - o.x) - pad;
  text(g, o.def.word.toUpperCase(), tx, o.y + pad + 13, {
    size: 19,
    weight: 700,
    color: C.ink,
    font: F.slab,
    track: 1.6,
    baseline: 'middle',
    max: tw,
  });
  text(g, `${o.def.len} LETTERS  ·  ${TRAITS[o.def.trait].label.toUpperCase()}`, tx, o.y + pad + 32, {
    size: T.micro + 1,
    weight: 700,
    color: color,
    font: F.num,
    track: 1.3,
    baseline: 'middle',
  });

  let ly = o.y + pad + 58;
  const rows: [string, string, string][] = [
    ['DMG', `${o.def.damage}`, C.ink],
    ['RATE', `${(1 / o.def.cooldown).toFixed(2)}/s`, C.dim],
    ['RANGE', `${o.def.range}`, C.dim],
  ];
  if (o.def.aoe > 0) rows.push(['BLAST', `${Math.round(o.def.aoe)}`, C.ember]);
  if (o.def.pierce > 0) rows.push(['PIERCE', `${o.def.pierce}`, C.acid]);
  if (o.def.chain > 0) rows.push(['CHAIN', `${o.def.chain}`, C.violet]);
  if (o.def.shots > 1) rows.push(['SHOTS', `${o.def.shots}`, C.rose]);
  if (o.def.slow > 0) rows.push(['SLOW', `${Math.round(o.def.slow * 100)}%`, C.cyan]);
  if (o.def.crit > 0.05) rows.push(['CRIT', `${Math.round(o.def.crit * 100)}%`, C.rose]);
  if (o.def.knockback > 0) rows.push(['KNOCK', `${o.def.knockback}`, C.gold]);

  if (!o.compact) {
    const cols = 2;
    const cw = (o.w - pad * 2) / cols;
    const maxRows = Math.floor((o.h - (ly - o.y) - 46) / 17);
    for (let i = 0; i < Math.min(rows.length, maxRows * cols); i++) {
      const cx = o.x + pad + (i % cols) * cw;
      const cy = ly + Math.floor(i / cols) * 17;
      statRow(g, { x: cx, y: cy, w: cw - 8, label: rows[i][0], value: rows[i][1], color: rows[i][2], size: T.tiny + 1 });
    }
  } else {
    statRow(g, { x: o.x + pad, y: ly, w: o.w - pad * 2, label: 'DMG', value: `${o.def.damage}`, size: T.small });
  }

  // mods
  const modY = o.y + o.h - 22;
  let mx = o.x + pad;
  for (const m of o.def.mods.slice(0, 4)) {
    const w = textWidth(g, m.toUpperCase(), { size: T.micro, weight: 700, font: F.num, track: 0.7 }) + 12;
    if (mx + w > o.x + o.w - pad) break;
    rr(g, mx, modY - 8, w, 16, 4);
    g.fillStyle = alpha(C.ink, 0.08);
    g.fill();
    text(g, m.toUpperCase(), mx + w / 2, modY, {
      size: T.micro,
      weight: 700,
      color: C.dim,
      font: F.num,
      align: 'center',
      baseline: 'middle',
      track: 0.7,
    });
    mx += w + 5;
  }
  // polarity tags
  const tags: [string, string][] = [];
  if (o.def.polar.includes('pos')) tags.push(['CHARGED', C.cyan]);
  if (o.def.polar.includes('neg')) tags.push(['CORRODE', C.ember]);
  let px = o.x + o.w - pad;
  for (const [label, col] of tags.reverse()) {
    const w = textWidth(g, label, { size: T.micro, weight: 700, font: F.num, track: 0.8 }) + 14;
    rr(g, px - w, modY - 8, w, 16, 4);
    g.fillStyle = alpha(col, 0.18);
    g.fill();
    rr(g, px - w + 0.5, modY - 7.5, w - 1, 15, 4);
    g.strokeStyle = alpha(col, 0.5);
    g.lineWidth = 1;
    g.stroke();
    text(g, label, px - w / 2, modY, {
      size: T.micro,
      weight: 700,
      color: col,
      font: F.num,
      align: 'center',
      baseline: 'middle',
      track: 0.8,
    });
    px -= w + 6;
  }
  if (o.kills !== undefined && o.kills > 0) {
    text(g, `${o.kills} KILLS`, o.x + o.w - pad, o.y + pad + 13, {
      size: T.micro,
      weight: 700,
      color: C.faint,
      font: F.num,
      align: 'right',
      baseline: 'middle',
      track: 0.8,
    });
  }
  g.restore();
}

/** Small arsenal entry used on the wall of forged words. */
export function miniWeapon(
  g: Ctx,
  o: { x: number; y: number; w: number; h: number; def: WeaponDef; hover?: number; selected?: boolean },
): void {
  const color = weaponColor(o.def);
  const pad = 8;
  panel(g, o.x, o.y, o.w, o.h, {
    fill: mix(C.panel, color, 0.05 + (o.hover ?? 0) * 0.08),
    stroke: alpha(color, o.selected ? 0.85 : 0.28 + (o.hover ?? 0) * 0.4),
    r: R.md,
  });
  const s = o.h - pad * 2;
  const showTile = o.w >= 150;
  if (showTile) {
    slab(g, o.def.word[0].toUpperCase(), o.x + pad + s / 2, o.y + o.h / 2, s, {
      fill: mix(C.bg2, color, 0.26),
      ink: C.ink,
      r: s * 0.22,
      lift: false,
    });
  }
  const tx = showTile ? o.x + pad + s + 10 : o.x + pad + 2;
  text(g, o.def.word.toUpperCase(), tx, o.y + o.h / 2 - 7, {
    size: T.small,
    weight: 700,
    color: C.ink,
    font: F.slab,
    baseline: 'middle',
    track: 1,
    max: o.w - (tx - o.x) - 54,
  });
  text(g, `${o.def.damage} DMG  ·  ${(1 / o.def.cooldown).toFixed(1)}/S`, tx, o.y + o.h / 2 + 9, {
    size: T.micro + 1,
    weight: 700,
    color: alpha(color, 0.9),
    font: F.num,
    baseline: 'middle',
    track: 0.6,
    max: o.w - (tx - o.x) - 54,
  });
  text(g, `${o.def.len}`, o.x + o.w - pad - 4, o.y + o.h / 2, {
    size: 20,
    weight: 700,
    color: alpha(C.ink, 0.14),
    font: F.slab,
    align: 'right',
    baseline: 'middle',
  });
}

export function wordChip(
  g: Ctx,
  o: { x: number; y: number; word: string; color?: string; size?: number; dim?: boolean },
): number {
  const size = o.size ?? T.small;
  const w = textWidth(g, o.word.toUpperCase(), { size, weight: 700, font: F.slab, track: 1 }) + 20;
  rr(g, o.x, o.y, w, size + 12, R.sm);
  g.fillStyle = alpha(o.color ?? C.gold, o.dim ? 0.08 : 0.16);
  g.fill();
  rr(g, o.x + 0.5, o.y + 0.5, w - 1, size + 11, R.sm - 0.5);
  g.strokeStyle = alpha(o.color ?? C.gold, o.dim ? 0.25 : 0.5);
  g.lineWidth = 1;
  g.stroke();
  text(g, o.word.toUpperCase(), o.x + w / 2, o.y + (size + 12) / 2, {
    size,
    weight: 700,
    color: o.dim ? C.dim : o.color ?? C.gold,
    font: F.slab,
    align: 'center',
    baseline: 'middle',
    track: 1,
  });
  return w;
}

export const tileLabel = (g: Ctx, str: string, max: number, size = T.small): string =>
  ellipsize(g, str, max, { size, weight: 700, font: F.ui });

export const laneFade = (y: number, laneH: number): number => lerp(0.5, 1, 1 - Math.abs(y - (68 + laneH * 2.5)) / 400);
