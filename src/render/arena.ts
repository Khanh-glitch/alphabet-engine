/**
 * Battlefield renderer.
 *
 * Pure presentation: it reads simulation state and draws it. The arena is a
 * shallow 2.5D side view — a floor plane with five depth lanes — so every unit
 * visibly stands on the ground and the letters they carry stay the clearest
 * thing on screen.
 */
import { C, FIELD, laneY, laneScale, laneFloor, BP_COLOR } from '../core/theme';
import { clamp } from '../core/rng';
import { glow, label, mix, plate, rgba, rr, tile, type Ctx } from '../core/draw';
import type { Battle } from '../battle/battle';
import type { Enemy, Entity } from '../battle/types';
import { ENEMIES } from '../content/enemies';

const FLOOR_BACK = FIELD.floorBack;
const FLOOR_FRONT = FIELD.floorFront;
const CORE_COLOR = C.cyan;

/** Back wall: machinery silhouettes the arena is set inside. */
function backWall(g: Ctx, t: number): void {
  const grad = g.createLinearGradient(0, 0, 0, FLOOR_BACK + 40);
  grad.addColorStop(0, '#070a13');
  grad.addColorStop(0.7, '#0b111e');
  grad.addColorStop(1, '#0e1526');
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD.w, FLOOR_BACK + 40);

  // Structural pillars
  g.save();
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 186;
    const w = 58;
    g.fillStyle = '#0d1524';
    g.fillRect(x, 40, w, FLOOR_BACK - 20);
    g.fillStyle = rgba('#ffffff', 0.03);
    g.fillRect(x, 40, 3, FLOOR_BACK - 20);
    // rivet plates
    for (let j = 0; j < 4; j++) {
      g.fillStyle = rgba(C.lineHi, 0.18);
      g.fillRect(x + 8, 70 + j * 60, w - 16, 4);
    }
  }
  // Overhead pipework
  g.strokeStyle = rgba(C.lineHi, 0.22);
  g.lineWidth = 10;
  g.beginPath();
  g.moveTo(0, 46);
  g.lineTo(FIELD.w, 46);
  g.stroke();
  g.lineWidth = 6;
  g.beginPath();
  g.moveTo(0, 62);
  g.lineTo(FIELD.w, 62);
  g.stroke();
  // A slow turning gear to give the space life
  g.save();
  g.translate(1180, 168);
  g.rotate(t * 0.1);
  g.strokeStyle = rgba(C.lineHi, 0.16);
  g.lineWidth = 12;
  g.beginPath();
  g.arc(0, 0, 92, 0, Math.PI * 2);
  g.stroke();
  for (let i = 0; i < 14; i++) {
    g.rotate((Math.PI * 2) / 14);
    g.beginPath();
    g.moveTo(92, 0);
    g.lineTo(116, 0);
    g.stroke();
  }
  g.restore();
  // Warm hazard lamp
  const lamp = 0.55 + Math.sin(t * 1.6) * 0.45;
  glow(g, 300, 96, 90, C.ember, 0.1 + lamp * 0.06);
  g.fillStyle = rgba(C.ember, 0.35 + lamp * 0.35);
  g.beginPath();
  g.arc(300, 96, 7, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/**
 * The floor plane.
 *
 * Five depth bands, each with a crisp lane rail and a soft tile pattern. The
 * bands are what make a 2D side view read as ground instead of as empty space,
 * and they are deliberately low-contrast so units stay dominant.
 */
function floor(g: Ctx, t: number): void {
  const grad = g.createLinearGradient(0, FLOOR_BACK, 0, FLOOR_FRONT);
  grad.addColorStop(0, '#0d1526');
  grad.addColorStop(0.35, '#141d31');
  grad.addColorStop(1, '#1a233c');
  g.fillStyle = grad;
  g.fillRect(0, FLOOR_BACK, FIELD.w, FLOOR_FRONT - FLOOR_BACK);

  // Depth bands + lane rails
  for (let i = 0; i < FIELD.lanes; i++) {
    const y = laneY(i);
    const bandTop = y - FIELD.laneH;
    if (i % 2 === 1) {
      g.fillStyle = rgba('#ffffff', 0.016);
      g.fillRect(0, bandTop, FIELD.w, FIELD.laneH);
    }
    // Lane rail: a broken line so it guides without reading as a wall.
    g.strokeStyle = rgba(C.cyan, 0.07);
    g.lineWidth = 1;
    g.setLineDash([26, 22]);
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(FIELD.w, y);
    g.stroke();
    g.setLineDash([]);
  }

  // Back edge: hazard chevrons mark the side enemies walk in from.
  g.save();
  g.globalAlpha = 0.55 + Math.sin(t * 2) * 0.08;
  for (let x = -40; x < FIELD.w; x += 30) {
    g.fillStyle = rgba(C.gold, 0.2);
    g.beginPath();
    g.moveTo(x, FLOOR_BACK);
    g.lineTo(x + 14, FLOOR_BACK);
    g.lineTo(x + 3, FLOOR_BACK + 10);
    g.lineTo(x - 11, FLOOR_BACK + 10);
    g.closePath();
    g.fill();
  }
  g.restore();

  // Front lip of the deck
  g.fillStyle = '#0b1120';
  g.fillRect(0, FLOOR_FRONT, FIELD.w, FIELD.bottom + 40 - FLOOR_FRONT);
  g.fillStyle = rgba('#ffffff', 0.09);
  g.fillRect(0, FLOOR_FRONT, FIELD.w, 2);
  g.fillStyle = rgba('#000000', 0.5);
  g.fillRect(0, FLOOR_FRONT + 2, FIELD.w, 4);
  g.fillStyle = rgba(C.lineHi, 0.28);
  for (let x = 20; x < FIELD.w; x += 56) {
    g.beginPath();
    g.arc(x, FLOOR_FRONT + 24, 2.2, 0, Math.PI * 2);
    g.fill();
  }
}

/** Distance haze so far lanes recede without hurting contrast. */
function haze(g: Ctx): void {
  const grad = g.createLinearGradient(0, FLOOR_BACK - 10, 0, FLOOR_BACK + 90);
  grad.addColorStop(0, rgba('#0a1020', 0.6));
  grad.addColorStop(1, rgba('#0a1020', 0));
  g.fillStyle = grad;
  g.fillRect(0, FLOOR_BACK - 10, FIELD.w, 110);
}

/** Contact shadow — the single strongest cue that a unit is standing on the floor. */
function contact(g: Ctx, x: number, lane: number, size: number, strength = 0.4): void {
  const y = laneFloor(lane);
  g.save();
  g.fillStyle = rgba('#000000', strength);
  g.beginPath();
  g.ellipse(x, y, size * 1.15, size * 0.34, 0, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function core(g: Ctx, battle: Battle, t: number): void {
  const x = FIELD.coreX;
  const lane = 0;
  const baseY = laneY(lane) + 6;
  const pct = battle.maxCoreHp > 0 ? battle.coreHp / battle.maxCoreHp : 0;
  const danger = pct < 0.34;
  const pulse = 0.6 + Math.sin(t * (danger ? 7 : 2.4)) * 0.4;
  const accent = danger ? C.bad : CORE_COLOR;

  contact(g, x + 10, lane, 96, 0.42);
  glow(g, x - 20, baseY - 60, 190, accent, 0.1 + pulse * 0.05);

  // Floor plate the machine is bolted to
  g.fillStyle = '#0d1424';
  rr(g, x - 108, baseY - 6, 224, 22, 5);
  g.fill();
  g.fillStyle = rgba(C.lineHi, 0.5);
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(x - 88 + i * 44, baseY + 5, 3, 0, Math.PI * 2);
    g.fill();
  }

  // Housing
  plate(g, x - 84, baseY - 158, 186, 152, { radius: 14, fill: '#1a2540', edge: C.lineHi, depth: 7 });
  for (let i = 0; i < 6; i++) {
    g.fillStyle = rgba(C.lineHi, 0.55);
    g.beginPath();
    g.arc(x - 70 + i * 32, baseY - 146, 3, 0, Math.PI * 2);
    g.fill();
  }

  // Reactor eye
  const eyeY = baseY - 92;
  glow(g, x + 6, eyeY, 66 + pulse * 14, accent, 0.45 * pulse);
  g.fillStyle = '#060a12';
  g.beginPath();
  g.arc(x + 6, eyeY, 36, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba(accent, 0.9);
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x + 6, eyeY, 36, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(x + 6, eyeY, 15 + pulse * 4, 0, Math.PI * 2);
  g.fill();

  // Pistons
  for (let i = 0; i < 2; i++) {
    const px = x - 60 + i * 138;
    const lift = Math.sin(t * 2.2 + i * Math.PI) * 5;
    g.fillStyle = '#26314f';
    g.fillRect(px - 7, baseY - 46 + lift, 14, 36 - lift);
    g.fillStyle = C.steel;
    g.fillRect(px - 11, baseY - 52 + lift, 22, 10);
  }

  // Health readout, attached to the machine so the eye never has to hunt.
  const barW = 176;
  const barX = x - 78;
  const barY = baseY - 196;
  g.fillStyle = rgba('#000000', 0.62);
  rr(g, barX, barY, barW, 22, 11);
  g.fill();
  const hpColor = danger ? C.bad : pct < 0.66 ? C.warn : C.mint;
  g.fillStyle = hpColor;
  rr(g, barX + 3, barY + 3, Math.max(5, (barW - 6) * pct), 16, 8);
  g.fill();
  g.strokeStyle = rgba(accent, 0.75);
  g.lineWidth = 2;
  rr(g, barX, barY, barW, 22, 11);
  g.stroke();
  label(g, `${Math.ceil(battle.coreHp)} / ${battle.maxCoreHp}`, barX + barW / 2, barY + 15, {
    align: 'center',
    size: 12,
    color: '#05070e',
    weight: 800,
  });
  if (danger) {
    const warn = 0.6 + Math.sin(t * 7) * 0.4;
    label(g, '⚠ LÕI NGUY HIỂM', x, barY - 12, {
      align: 'center',
      size: 11,
      color: rgba(C.bad, warn),
      weight: 800,
      tracking: 1.6,
    });
  }
}

/** The letter an enemy carries, floating above its head. */
function carrierBadge(g: Ctx, enemy: Enemy, t: number): void {
  if (!enemy.carry) return;
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const scale = laneScale(lane);
  const size = 30 * scale;
  const bob = Math.sin(t * 3 + enemy.wobble) * 2;
  const y = enemyTop(enemy) - size - 10 + bob;
  const x = enemy.x - size / 2;
  // Undisclosed letters are shown face-down, so the preview stays honest.
  tile(g, x, y, size, enemy.announced ? enemy.carry : '?', enemy.announced ? 'filled' : 'slot');
  const pulse = 0.5 + Math.sin(t * 4 + enemy.wobble) * 0.5;
  g.strokeStyle = rgba(enemy.announced ? C.gold : C.faint, 0.2 + pulse * 0.3);
  g.lineWidth = 2;
  rr(g, x - 3, y - 3, size + 6, size + 6, 9);
  g.stroke();
}

/** Foot position of an enemy (ground contact point). */
function enemyFoot(enemy: Enemy): number {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  return enemy.flying ? laneY(lane) - 62 + Math.sin(enemy.wobble) * 5 : laneY(lane);
}

/**
 * How tall an enemy draws above its feet. Health bars and carrier letters stack
 * on top of this, so nothing ever floats in empty space.
 */
function enemyTop(enemy: Enemy): number {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const scale = laneScale(lane);
  const s = enemy.size * scale;
  switch (ENEMIES[enemy.kind].shape) {
    case 'brute':
      return enemyFoot(enemy) - s * 2.2;
    case 'boss':
      return enemyFoot(enemy) - s * 2.6;
    case 'flyer':
      return enemyFoot(enemy) - s * 1.7;
    default:
      return enemyFoot(enemy) - s * 1.5;
  }
}

function drawEnemy(g: Ctx, enemy: Enemy, t: number): void {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const scale = laneScale(lane);
  const s = enemy.size * scale;
  const def = ENEMIES[enemy.kind];
  const flash = enemy.hitFlash;

  if (!enemy.flying) contact(g, enemy.x, lane, s, 0.34);

  g.save();
  g.translate(enemy.x, enemyFoot(enemy));
  g.scale(scale, scale);

  const body = flash > 0.4 ? '#ffffff' : def.color;
  g.fillStyle = body;
  g.strokeStyle = rgba('#050810', 0.9);
  g.lineWidth = 2 / scale;

  switch (def.shape) {
    case 'mote': {
      // Chunky rounded body with a bright visor: reads at a glance at any size.
      const grad = g.createLinearGradient(0, -s * 1.4, 0, 0);
      grad.addColorStop(0, mix(def.color, '#ffffff', 0.22));
      grad.addColorStop(1, def.color);
      g.fillStyle = flash > 0.4 ? '#ffffff' : grad;
      rr(g, -s * 0.82, -s * 1.32, s * 1.64, s * 1.32, s * 0.34);
      g.fill();
      g.strokeStyle = rgba('#050810', 0.95);
      g.lineWidth = 2 / scale;
      rr(g, -s * 0.82, -s * 1.32, s * 1.64, s * 1.32, s * 0.34);
      g.stroke();
      g.fillStyle = '#080d18';
      rr(g, -s * 0.6, -s * 1.02, s * 1.2, s * 0.44, s * 0.16);
      g.fill();
      g.fillStyle = C.cyan;
      g.beginPath();
      g.arc(-s * 0.28, -s * 0.8, s * 0.13, 0, Math.PI * 2);
      g.arc(s * 0.28, -s * 0.8, s * 0.13, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'runner': {
      // Legs
      g.strokeStyle = rgba('#050810', 0.95);
      g.lineWidth = 3 / scale;
      const stride = Math.sin(enemy.wobble * 3) * s * 0.35;
      g.beginPath();
      g.moveTo(-s * 0.2, -s * 0.4);
      g.lineTo(-s * 0.2 - stride, 0);
      g.moveTo(s * 0.2, -s * 0.4);
      g.lineTo(s * 0.2 + stride, 0);
      g.stroke();
      // Body leaning forward
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(-s * 0.9, -s * 0.5);
      g.lineTo(s * 0.8, -s * 1.25);
      g.lineTo(s * 0.5, -s * 0.55);
      g.lineTo(s * 0.8, -s * 0.1);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
    case 'flyer': {
      const flap = Math.sin(t * 14 + enemy.wobble) * 0.5;
      g.fillStyle = rgba(def.color, 0.5);
      g.beginPath();
      g.ellipse(-s * 0.25, -s * 0.7, s * 1.2, s * 0.4, flap, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(s * 0.25, -s * 0.7, s * 1.2, s * 0.4, -flap, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = body;
      g.beginPath();
      g.moveTo(0, -s * 1.5);
      g.lineTo(s * 0.72, -s * 0.7);
      g.lineTo(0, 0);
      g.lineTo(-s * 0.72, -s * 0.7);
      g.closePath();
      g.fill();
      g.stroke();
      break;
    }
    case 'brute': {
      plate(g, -s, -s * 2.1, s * 2, s * 2.1, { radius: 8, fill: body, edge: '#7d2a24', depth: 5 });
      g.fillStyle = rgba('#050810', 0.85);
      g.fillRect(-s * 0.72, -s * 1.5, s * 1.44, s * 0.3);
      g.fillStyle = rgba('#ffffff', 0.16);
      for (let i = 0; i < 3; i++) g.fillRect(-s * 0.66 + i * s * 0.55, -s * 0.85, s * 0.34, s * 0.2);
      // treads
      g.fillStyle = '#0d1220';
      g.fillRect(-s * 0.9, -s * 0.25, s * 1.8, s * 0.25);
      break;
    }
    case 'boss': {
      glow(g, 0, -s, s * 2.4, C.ember, 0.32);
      plate(g, -s, -s * 2.5, s * 2, s * 2.5, { radius: 14, fill: body, edge: '#7a2f18', depth: 8 });
      g.fillStyle = '#050810';
      g.beginPath();
      g.arc(0, -s * 1.5, s * 0.52, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = C.gold;
      g.beginPath();
      g.arc(0, -s * 1.5, s * 0.24 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = rgba('#050810', 0.85);
      for (let i = -1; i <= 1; i++) g.fillRect(i * s * 0.45 - s * 0.11, -s * 0.5, s * 0.22, s * 0.5);
      break;
    }
    default:
      break;
  }

  if (enemy.freezeT > 0) {
    g.fillStyle = rgba('#8fe3f0', 0.4);
    g.beginPath();
    g.arc(0, -s * 0.7, s * 1.2, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba('#ffffff', 0.65);
    g.lineWidth = 2 / scale;
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.moveTo(Math.cos(a) * s * 0.3, -s * 0.7 + Math.sin(a) * s * 0.3);
      g.lineTo(Math.cos(a) * s * 1.1, -s * 0.7 + Math.sin(a) * s * 1.1);
      g.stroke();
    }
  } else if (enemy.burnT > 0) {
    for (let i = 0; i < 3; i++) {
      const fx = -7 + i * 7;
      const h = 14 + Math.sin(t * 18 + i * 2 + enemy.wobble) * 6;
      g.fillStyle = rgba(i % 2 === 0 ? '#f2734a' : '#f0b445', 0.85);
      g.beginPath();
      g.moveTo(fx, -s * 1.4);
      g.lineTo(fx + 4, -s * 1.4 - h);
      g.lineTo(fx + 9, -s * 1.4);
      g.closePath();
      g.fill();
    }
  }
  g.restore();

  if (enemy.hp < enemy.maxHp) {
    const w = Math.max(30, s * 2.1);
    const hx = enemy.x - w / 2;
    const hy = enemyTop(enemy) - (enemy.carry ? 42 : 12);
    g.fillStyle = rgba('#05070e', 0.7);
    rr(g, hx, hy, w, 6, 3);
    g.fill();
    g.fillStyle = def.tags.includes('HEAVY') ? C.ember : C.mint;
    rr(g, hx, hy, Math.max(2, w * (enemy.hp / enemy.maxHp)), 6, 3);
    g.fill();
  }
  carrierBadge(g, enemy, t);
}

function drawEntity(g: Ctx, ent: Entity, t: number): void {
  const lane = clamp(Math.round(ent.lane), 0, FIELD.lanes - 1);
  const scale = laneScale(lane) * (0.45 + 0.55 * ent.spawn);
  const color = BP_COLOR[ent.kind] ?? C.cyan;
  const isZone = ent.kind === 'OIL' || ent.kind === 'WEB' || ent.kind === 'ICE';

  if (!isZone || ent.kind === 'OIL') contact(g, ent.x, lane, 40 * scale, ent.kind === 'OIL' ? 0.22 : 0.3);

  g.save();
  g.translate(ent.x, laneY(lane));
  g.scale(scale, scale);

  switch (ent.kind) {
    case 'BOMB': {
      glow(g, 0, -4, 34, color, 0.35);
      g.fillStyle = '#1c2132';
      g.beginPath();
      g.arc(0, -14, 20, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba(color, 0.95);
      g.lineWidth = 2;
      g.stroke();
      g.fillStyle = rgba('#ffffff', 0.14);
      g.beginPath();
      g.arc(-5, -20, 7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#c9b98f';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(7, -30);
      g.quadraticCurveTo(20, -42, 13, -52);
      g.stroke();
      const fuse = clamp(ent.timer / 1.35, 0, 1);
      glow(g, 13, -52, 14, '#ffd27a', 0.9);
      g.fillStyle = '#fff3c4';
      g.beginPath();
      g.arc(13, -52, 3 + (1 - fuse) * 3, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba('#ffd27a', 0.45);
      g.lineWidth = 3;
      g.beginPath();
      g.arc(0, -14, 30, -Math.PI / 2, -Math.PI / 2 + (1 - fuse) * Math.PI * 2);
      g.stroke();
      break;
    }
    case 'FIRE': {
      const life = clamp(ent.ttl / 7.5, 0, 1);
      glow(g, 0, -14, 96, '#f2734a', 0.26);
      for (let i = -3; i <= 3; i++) {
        const fx = i * 24;
        const h = 30 + Math.sin(t * 12 + i) * 9 + (1 - life) * 8;
        g.fillStyle = rgba(i % 2 === 0 ? '#f2734a' : '#f0b445', 0.72 * (0.55 + life * 0.45));
        g.beginPath();
        g.moveTo(fx - 13, 0);
        g.quadraticCurveTo(fx, -h, fx + 13, 0);
        g.closePath();
        g.fill();
      }
      break;
    }
    case 'BEE': {
      const flap = Math.sin(t * 40) * 0.7;
      g.fillStyle = rgba('#ffffff', 0.5);
      g.beginPath();
      g.ellipse(-5, -26, 13, 5, flap, 0, Math.PI * 2);
      g.ellipse(7, -26, 13, 5, -flap, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = color;
      g.beginPath();
      g.ellipse(0, -16, 13, 9, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#2b3350';
      g.fillRect(-7, -24, 4, 17);
      g.fillRect(3, -24, 4, 17);
      break;
    }
    case 'WALL': {
      const pct = clamp(ent.hp / ent.maxHp, 0, 1);
      plate(g, -38, -96, 76, 100, { radius: 8, fill: '#2b3a56', edge: C.steel, depth: 6 });
      g.save();
      rr(g, -38, -96, 76, 100, 8);
      g.clip();
      g.strokeStyle = rgba(C.gold, 0.2);
      g.lineWidth = 11;
      for (let i = -140; i < 140; i += 28) {
        g.beginPath();
        g.moveTo(i, 4);
        g.lineTo(i + 104, -96);
        g.stroke();
      }
      g.restore();
      if (pct < 0.7) {
        g.strokeStyle = rgba('#050810', 0.85);
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(-22, -70);
        g.lineTo(-6, -40);
        g.lineTo(-18, -6);
        g.stroke();
        if (pct < 0.35) {
          g.beginPath();
          g.moveTo(18, -80);
          g.lineTo(8, -46);
          g.lineTo(24, -18);
          g.stroke();
        }
      }
      break;
    }
    case 'FAN': {
      plate(g, -34, -70, 68, 68, { radius: 10, fill: '#1d2a42', edge: C.cyan, depth: 5 });
      g.save();
      g.translate(0, -40);
      for (let i = 0; i < 4; i++) {
        g.rotate(Math.PI / 2);
        g.fillStyle = rgba(C.cyan, 0.85);
        g.beginPath();
        g.moveTo(0, 0);
        g.quadraticCurveTo(16, -9 + Math.sin(t * 9 + i) * 3, 27, 0);
        g.lineTo(0, 7);
        g.closePath();
        g.fill();
      }
      g.restore();
      g.fillStyle = C.steel;
      g.beginPath();
      g.arc(0, -40, 5, 0, Math.PI * 2);
      g.fill();
      for (let i = 0; i < 3; i++) {
        const off = ((t * 170 + i * 62) % 190) - 20;
        g.strokeStyle = rgba(C.cyan, 0.22 * (1 - off / 190));
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(34 + off, -58 + i * 18);
        g.lineTo(66 + off, -58 + i * 18);
        g.stroke();
      }
      break;
    }
    case 'OIL': {
      const burning = ent.state === 'burning';
      g.fillStyle = burning ? 'rgba(62,26,14,0.92)' : 'rgba(26,20,50,0.94)';
      g.beginPath();
      g.ellipse(0, 0, 104, 22, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = burning ? rgba('#f2734a', 0.6) : rgba(C.violet, 0.5);
      g.lineWidth = 2;
      g.stroke();
      g.strokeStyle = rgba(burning ? '#f0b445' : '#b09cf0', 0.3);
      g.lineWidth = 3;
      g.beginPath();
      g.ellipse(-14, -4, 56, 9, 0, 0, Math.PI);
      g.stroke();
      if (burning) {
        glow(g, 0, -20, 130, '#f2734a', 0.24);
        for (let i = -4; i <= 4; i++) {
          const h = 26 + Math.sin(t * 14 + i * 1.7) * 12;
          g.fillStyle = rgba(i % 2 === 0 ? '#f2734a' : '#f0b445', 0.7);
          g.beginPath();
          g.moveTo(i * 22 - 11, 0);
          g.quadraticCurveTo(i * 22, -h, i * 22 + 11, 0);
          g.closePath();
          g.fill();
        }
      }
      break;
    }
    case 'MINE': {
      const armed = ent.timer <= 0;
      g.fillStyle = '#1c2132';
      g.beginPath();
      g.arc(0, -8, 18, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = rgba(C.bad, 0.9);
      g.lineWidth = 2;
      g.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.strokeStyle = rgba(C.steel, 0.75);
        g.beginPath();
        g.moveTo(Math.cos(a) * 16, -8 + Math.sin(a) * 16);
        g.lineTo(Math.cos(a) * 25, -8 + Math.sin(a) * 25);
        g.stroke();
      }
      g.fillStyle = armed && Math.sin(t * 8) > 0 ? C.bad : '#5a2530';
      g.beginPath();
      g.arc(0, -8, 4.5, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'SAW': {
      g.fillStyle = '#4b5474';
      g.beginPath();
      g.arc(0, -22, 7, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(0, -22);
      g.rotate(t * 16);
      g.fillStyle = '#c0c8d8';
      g.beginPath();
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        const r = i % 2 === 0 ? 24 : 17;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) g.moveTo(px, py);
        else g.lineTo(px, py);
      }
      g.closePath();
      g.fill();
      g.restore();
      g.fillStyle = '#4b5474';
      g.beginPath();
      g.arc(0, -22, 6, 0, Math.PI * 2);
      g.fill();
      break;
    }
    case 'WEB': {
      g.strokeStyle = rgba('#b09cf0', 0.55);
      g.lineWidth = 2;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * 100, Math.sin(a) * 30);
        g.stroke();
      }
      for (let r = 26; r < 100; r += 26) {
        g.beginPath();
        g.ellipse(0, 0, r, r * 0.3, 0, 0, Math.PI * 2);
        g.stroke();
      }
      break;
    }
    case 'ICE': {
      glow(g, 0, -14, 120, '#8fe3f0', 0.2);
      for (let i = 0; i < 5; i++) {
        const ix = -84 + i * 42;
        const h = 30 + ((i * 37) % 26);
        g.fillStyle = rgba('#8fe3f0', 0.34);
        g.beginPath();
        g.moveTo(ix - 15, 0);
        g.lineTo(ix, -h);
        g.lineTo(ix + 15, 0);
        g.closePath();
        g.fill();
        g.strokeStyle = rgba('#ffffff', 0.45);
        g.lineWidth = 1.5;
        g.stroke();
      }
      break;
    }
    default:
      break;
  }
  g.restore();

  // Expiry ring for timed zones so their ending is never a surprise.
  if (ent.ttl > 0 && ent.kind !== 'BOMB' && ent.ttl < 2.4) {
    g.strokeStyle = rgba('#ffffff', 0.3 * (1 - ent.ttl / 2.4));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(ent.x, laneY(lane), 44, 0, Math.PI * 2);
    g.stroke();
  }
}

/** Streak from the player's deck to a freshly materialised object. */
function drawSpawnStreaks(g: Ctx, battle: Battle): void {
  for (const ent of battle.entities) {
    if (ent.spawn >= 1 || !ent.alive) continue;
    const color = BP_COLOR[ent.kind] ?? C.cyan;
    const a = 1 - ent.spawn;
    const y = laneY(clamp(Math.round(ent.lane), 0, FIELD.lanes - 1));
    g.strokeStyle = rgba(color, a * 0.85);
    g.lineWidth = 7 * a;
    g.beginPath();
    g.moveTo(ent.x - 200, FIELD.bottom - 40);
    g.quadraticCurveTo(ent.x - 70, y - 150, ent.x, y - 40);
    g.stroke();
    glow(g, ent.x, y - 40, 60 * a, color, a * 0.4);
  }
}

export interface ArenaOptions {
  /** Show the five lane rails and the spawn-side marker. */
  showGuides: boolean;
}

export function drawArena(g: Ctx, battle: Battle, t: number, opts: ArenaOptions): void {
  g.save();
  backWall(g, t);
  floor(g, t);
  haze(g);

  // Zones sit under everything else on the floor.
  for (const ent of battle.entities) {
    if (!ent.alive) continue;
    if (ent.kind === 'OIL' || ent.kind === 'WEB' || ent.kind === 'ICE') drawEntity(g, ent, t);
  }
  core(g, battle, t);

  // Structures and devices, sorted back-to-front so depth reads correctly.
  const structures = battle.entities
    .filter((e) => e.alive && e.kind !== 'OIL' && e.kind !== 'WEB' && e.kind !== 'ICE')
    .sort((a, b) => b.lane - a.lane);
  for (const ent of structures) drawEntity(g, ent, t);

  drawSpawnStreaks(g, battle);

  const enemies = battle.enemies.filter((e) => !e.dead).sort((a, b) => b.lane - a.lane);
  for (const enemy of enemies) drawEnemy(g, enemy, t);

  if (opts.showGuides) {
    // Entry marker: something is about to walk in from this edge.
    const grad = g.createLinearGradient(FIELD.right - 70, 0, FIELD.right, 0);
    grad.addColorStop(0, rgba(C.bad, 0));
    grad.addColorStop(1, rgba(C.bad, 0.22));
    g.fillStyle = grad;
    g.fillRect(FIELD.right - 70, FIELD.floorBack, 70, FIELD.floorFront - FIELD.floorBack);
    g.strokeStyle = rgba(C.bad, 0.35);
    g.lineWidth = 2;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(FIELD.right - 6, FIELD.floorBack);
    g.lineTo(FIELD.right - 6, FIELD.floorFront);
    g.stroke();
    g.setLineDash([]);
  }
  g.restore();
}

/** Arena-space marker used by tutorial spotlights. */
export function highlightZone(g: Ctx, x: number, y: number, radius: number, t: number): void {
  const pulse = 0.5 + Math.sin(t * 4) * 0.5;
  g.strokeStyle = rgba(C.gold, 0.3 + pulse * 0.4);
  g.lineWidth = 3;
  g.beginPath();
  g.arc(x, y, radius + pulse * 4, 0, Math.PI * 2);
  g.stroke();
}
