/**
 * Battlefield renderer.
 *
 * Pure presentation: it reads simulation state and draws it. The arena is a
 * shallow 2.5D side view — a floor plane with five depth lanes — so every unit
 * visibly stands on the ground and the letters they carry stay the clearest
 * thing on screen.
 */
import { C, F, FIELD, laneY, laneScale, laneFloor, BP_COLOR } from '../core/theme';
import { t as tr } from '../core/i18n';
import { clamp } from '../core/rng';
import { glow, hazardStripes, label, mix, plate, rgba, rr, tile, type Ctx } from '../core/draw';
import type { Battle } from '../battle/battle';
import type { Enemy, Entity } from '../battle/types';
import { ENEMIES } from '../content/enemies';

const FLOOR_BACK = FIELD.floorBack;
const FLOOR_FRONT = FIELD.floorFront;
const CORE_COLOR = C.cyan;

/**
 * Presentation-only size multiplier for battlefield units.
 *
 * Enemy `size` is a simulation value — it feeds collision and targeting — so it
 * is deliberately left alone and the *drawing* is scaled up instead. Units read
 * as substantial machines at the arena's real resolution without changing how
 * anything hits.
 */
const UNIT = 1.35;

/** Deterministic pseudo-random in [0,1) from an integer — background dressing only. */
function noise(n: number): number {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
}

/**
 * The factory hall behind the arena.
 *
 * This is the game's thesis rendered as a place: letters are *manufactured*, so
 * the wall is a working letterpress line — a hopper overhead, a conveyor of
 * finished tiles, pipework carrying stock, and the dark gantries above it all.
 * It exists to give the play band a sense of depth and scale, so it is built in
 * four receding layers and kept low-contrast beneath the units.
 */
function backWall(g: Ctx, t: number): void {
  const grad = g.createLinearGradient(0, 0, 0, FLOOR_BACK + 40);
  grad.addColorStop(0, '#05070f');
  grad.addColorStop(0.45, '#080d1a');
  grad.addColorStop(1, '#0d1526');
  g.fillStyle = grad;
  g.fillRect(0, 0, FIELD.w, FLOOR_BACK + 40);

  // --- layer 1: far gantries, almost lost in the dark ---------------------
  g.save();
  for (let i = 0; i < 5; i++) {
    const x = 120 + i * 330;
    g.fillStyle = '#070b16';
    g.fillRect(x, 96, 210, FLOOR_BACK - 96);
    g.fillStyle = rgba('#000000', 0.35);
    g.fillRect(x + 210, 96, 26, FLOOR_BACK - 96);
  }
  // Roof trusses
  g.strokeStyle = rgba(C.lineHi, 0.1);
  g.lineWidth = 3;
  for (let i = 0; i < 11; i++) {
    const x = 60 + i * 138;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + 60, 58);
    g.lineTo(x + 120, 0);
    g.stroke();
  }
  g.restore();

  // --- layer 2: the letter line ------------------------------------------
  // Hopper: raw stock waiting to be pressed into tiles.
  g.save();
  g.fillStyle = '#0b1220';
  g.beginPath();
  g.moveTo(880, 52);
  g.lineTo(1160, 52);
  g.lineTo(1122, 128);
  g.lineTo(918, 128);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(C.lineHi, 0.35);
  g.lineWidth = 2;
  g.stroke();
  // Stock inside the hopper — a slow settling pile of raw letterforms.
  g.save();
  g.beginPath();
  g.moveTo(880, 52);
  g.lineTo(1160, 52);
  g.lineTo(1122, 128);
  g.lineTo(918, 128);
  g.closePath();
  g.clip();
  for (let i = 0; i < 14; i++) {
    const nx = noise(i * 3.3);
    const ny = noise(i * 7.7 + 11);
    const bob = Math.sin(t * 0.9 + i) * 2.5;
    const x = 906 + nx * 222;
    const y = 60 + ny * 52 + bob;
    g.save();
    g.translate(x, y);
    g.rotate((noise(i * 5.1) - 0.5) * 0.9);
    g.fillStyle = rgba(C.tileFace, 0.09 + ny * 0.08);
    rr(g, -9, -6, 18, 12, 2);
    g.fill();
    g.restore();
  }
  g.restore();
  g.restore();

  // Conveyor: finished tiles ride toward the drop into the arena.
  g.save();
  const beltY = 150;
  g.fillStyle = '#0a1020';
  g.fillRect(560, beltY, 860, 26);
  g.fillStyle = rgba('#000000', 0.4);
  g.fillRect(560, beltY + 20, 860, 6);
  g.strokeStyle = rgba(C.lineHi, 0.3);
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(560, beltY);
  g.lineTo(1420, beltY);
  g.stroke();

  // Rollers, turning.
  for (let i = 0; i < 22; i++) {
    const x = 580 + i * 40;
    const spin = (t * 1.6 + i * 0.6) % 1;
    g.fillStyle = rgba(C.lineHi, 0.5);
    g.beginPath();
    g.arc(x, beltY + 24, 5, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = rgba(C.lineHi, 0.85);
    g.lineWidth = 1.4;
    g.beginPath();
    g.moveTo(x - Math.cos(spin * 6.28) * 4, beltY + 24 - Math.sin(spin * 6.28) * 4);
    g.lineTo(x + Math.cos(spin * 6.28) * 4, beltY + 24 + Math.sin(spin * 6.28) * 4);
    g.stroke();
  }

  // The tiles themselves, looping along the belt. They fade in at the hopper
  // and fall out of view at the right, so the belt always looks like it is
  // delivering stock toward the player's side.
  for (let i = 0; i < 9; i++) {
    const speed = 46;
    const span = 900;
    const x = 640 + ((i * 110 + t * speed) % span);
    if (x > 1410) continue;
    g.save();
    g.globalAlpha = clamp((1400 - x) / 90, 0, 1) * 0.26;
    tile(g, x - 15, beltY - 30, 30, LETTERS_BELT[(i + Math.floor(t * speed / 110)) % LETTERS_BELT.length], 'filled');
    g.restore();
  }
  g.restore();
  void (beltY && noise(-1));

  // --- layer 3: pipework carrying glowing stock ---------------------------
  g.save();
  const pipes: Array<[number, number, string, number]> = [
    [78, 4, C.cyan, 0.3],
    [92, 8, C.cyan, 0.2],
    [300, 6, C.ember, 0.24],
  ];
  for (const [y, w, color, a] of pipes) {
    g.strokeStyle = rgba(C.lineHi, 0.22);
    g.lineWidth = w + 6;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(FIELD.w, y);
    g.stroke();
    // Pulse travelling down the pipe: the line is live.
    const phase = ((t * 0.28) % 1) * FIELD.w;
    const px = phase;
    const flow = g.createLinearGradient(px - 200, 0, px + 200, 0);
    flow.addColorStop(0, rgba(color, 0));
    flow.addColorStop(0.5, rgba(color, a));
    flow.addColorStop(1, rgba(color, 0));
    g.strokeStyle = flow;
    g.lineWidth = w;
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(FIELD.w, y);
    g.stroke();
  }
  g.restore();

  // --- layer 4: near structures, columns and lamps ------------------------
  g.save();
  for (let i = 0; i < 8; i++) {
    const x = 40 + i * 186;
    const w = 58;
    g.fillStyle = '#090f1c';
    g.fillRect(x, 40, w, FLOOR_BACK - 20);
    g.fillStyle = rgba('#ffffff', 0.035);
    g.fillRect(x, 40, 3, FLOOR_BACK - 20);
    g.fillStyle = rgba('#000000', 0.3);
    g.fillRect(x + w - 5, 40, 5, FLOOR_BACK - 20);
    for (let j = 0; j < 4; j++) {
      g.fillStyle = rgba(C.lineHi, 0.1);
      g.fillRect(x + 8, 70 + j * 60, w - 16, 4);
      g.fillStyle = rgba(C.lineHi, 0.3);
      g.beginPath();
      g.arc(x + 12, 74 + j * 60, 2, 0, Math.PI * 2);
      g.arc(x + w - 12, 74 + j * 60, 2, 0, Math.PI * 2);
      g.fill();
    }
  }

  // A slow turning gear, and a second counter-rotating one behind it.
  g.save();
  const gear = (cx: number, cy: number, r: number, teeth: number, dir: number, alpha: number): void => {
    g.save();
    g.translate(cx, cy);
    g.rotate(t * 0.1 * dir);
    g.strokeStyle = rgba(C.lineHi, alpha);
    g.lineWidth = 12;
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.stroke();
    for (let i = 0; i < teeth; i++) {
      g.rotate((Math.PI * 2) / teeth);
      g.beginPath();
      g.moveTo(r, 0);
      g.lineTo(r + 24, 0);
      g.stroke();
    }
    g.restore();
  };
  gear(1180, 226, 84, 14, 1, 0.1);
  gear(1318, 186, 50, 10, -1, 0.07);
  g.restore();

  // Hazard lamps hanging over the lane the enemies walk in from.
  const lamp = 0.55 + Math.sin(t * 1.6) * 0.45;
  glow(g, 300, 96, 90, C.ember, 0.1 + lamp * 0.06);
  g.fillStyle = rgba(C.ember, 0.35 + lamp * 0.35);
  g.beginPath();
  g.arc(300, 96, 7, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.5)';
  g.fillRect(292, 74, 16, 14);
  g.restore();
}

/** The letters the decorative conveyor cycles through. */
const LETTERS_BELT = ['A', 'L', 'P', 'H', 'B', 'E', 'T', 'M', 'O', 'R', 'S', 'I'];

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

  // Plates: the floor is decking, so it gets seams that converge toward the
  // vanishing point. They are the main reason the plane reads as *ground*.
  g.save();
  g.strokeStyle = rgba('#ffffff', 0.028);
  g.lineWidth = 1;
  const vpX = 430;
  for (let x = -600; x < FIELD.w + 600; x += 150) {
    g.beginPath();
    g.moveTo(vpX + (x - vpX) * 0.72, FLOOR_BACK);
    g.lineTo(x, FLOOR_FRONT);
    g.stroke();
  }
  g.restore();

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

  // Warm light pooling on the deck from the lamps above, so the near lanes do
  // not go flat black where the action actually happens.
  const pool = g.createLinearGradient(0, FLOOR_BACK, 0, FLOOR_FRONT);
  pool.addColorStop(0, rgba(C.cyan, 0.0));
  pool.addColorStop(0.55, rgba(C.steel, 0.035));
  pool.addColorStop(1, rgba(C.ember, 0.045));
  g.fillStyle = pool;
  g.fillRect(0, FLOOR_BACK, FIELD.w, FLOOR_FRONT - FLOOR_BACK);

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

/**
 * Focus pass. Drawn over the arena, under the HUD.
 *
 * The scene is busy by design — a working factory — so this pulls the eye down
 * onto the play band: the far wall is graded darker, the near corners fall off,
 * and a faint warm bloom sits over the middle of the floor where fights happen.
 */
function focus(g: Ctx): void {
  // Far wall falls away from the light.
  const wall = g.createLinearGradient(0, 0, 0, FLOOR_BACK);
  wall.addColorStop(0, rgba('#04060c', 0.42));
  wall.addColorStop(0.62, rgba('#04060c', 0.18));
  wall.addColorStop(1, rgba('#04060c', 0));
  g.fillStyle = wall;
  g.fillRect(0, 0, FIELD.w, FLOOR_BACK);

  // Corner falloff over the whole battlefield.
  const vg = g.createRadialGradient(
    FIELD.w * 0.5,
    FLOOR_BACK + (FLOOR_FRONT - FLOOR_BACK) * 0.45,
    180,
    FIELD.w * 0.5,
    FLOOR_BACK + (FLOOR_FRONT - FLOOR_BACK) * 0.45,
    FIELD.w * 0.72,
  );
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(0.7, 'rgba(0,0,0,0.1)');
  vg.addColorStop(1, 'rgba(0,0,0,0.32)');
  g.fillStyle = vg;
  g.fillRect(0, 0, FIELD.w, FIELD.bottom + 8);
}

/**
 * Contact shadow — the single strongest cue that a unit is standing on the
 * floor.
 *
 * Drawn as a soft radial pool *at the foot line*, not as a hard ellipse: a hard
 * ellipse reads as a puddle under the unit rather than as ground occlusion.
 */
function contact(g: Ctx, x: number, lane: number, size: number, strength = 0.4): void {
  const y = laneFloor(lane);
  const rx = size * 0.92;
  const ry = Math.max(3, size * 0.26);
  g.save();
  g.translate(x, y);
  g.scale(1, ry / rx);
  const grad = g.createRadialGradient(0, 0, 0, 0, 0, rx);
  grad.addColorStop(0, rgba('#000000', strength));
  grad.addColorStop(0.55, rgba('#000000', strength * 0.55));
  grad.addColorStop(1, rgba('#000000', 0));
  g.fillStyle = grad;
  g.beginPath();
  g.arc(0, 0, rx, 0, Math.PI * 2);
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
  const hullW = 190;
  const hullH = 150;
  const hullX = x - 84;
  const hullY = baseY - 158;

  contact(g, x + 10, lane, 104, 0.45);
  glow(g, x - 20, baseY - 62, 200, accent, 0.1 + pulse * 0.05);

  // --- the plinth it is bolted to ---------------------------------------
  g.fillStyle = '#080d18';
  rr(g, x - 112, baseY - 10, 232, 26, 6);
  g.fill();
  g.fillStyle = '#0f1728';
  rr(g, x - 106, baseY - 8, 220, 20, 5);
  g.fill();
  g.fillStyle = rgba(C.lineHi, 0.4);
  for (let i = 0; i < 5; i++) {
    g.beginPath();
    g.arc(x - 88 + i * 44, baseY + 2, 3.4, 0, Math.PI * 2);
    g.fill();
  }
  hazardStripes(g, x - 106, baseY - 22, 220, 12, C.gold);

  // --- body ---------------------------------------------------------------
  plate(g, hullX, hullY, hullW, hullH, { radius: 16, fill: '#1b2642', edge: C.lineHi, depth: 8 });
  // Faceplate with an inset panel.
  g.fillStyle = '#131c30';
  rr(g, hullX + 10, hullY + 10, hullW - 20, hullH - 20, 12);
  g.fill();
  // Rivets along the top and bottom rails.
  g.fillStyle = rgba(C.lineHi, 0.7);
  for (let i = 0; i < 6; i++) {
    g.beginPath();
    g.arc(hullX + 22 + i * 29, hullY + 14, 2.6, 0, Math.PI * 2);
    g.arc(hullX + 22 + i * 29, hullY + hullH - 14, 2.6, 0, Math.PI * 2);
    g.fill();
  }

  // --- the reactor eye ----------------------------------------------------
  const eyeY = hullY + 62;
  glow(g, x + 6, eyeY, 74 + pulse * 16, accent, 0.42 * pulse);
  g.fillStyle = '#05070e';
  g.beginPath();
  g.arc(x + 6, eyeY, 40, 0, Math.PI * 2);
  g.fill();
  // Iris blades, turning slowly — the machine is running.
  g.save();
  g.translate(x + 6, eyeY);
  g.rotate(t * 0.5);
  g.strokeStyle = rgba(accent, 0.55);
  g.lineWidth = 5;
  for (let i = 0; i < 10; i++) {
    g.rotate((Math.PI * 2) / 10);
    g.beginPath();
    g.moveTo(30, 0);
    g.lineTo(38, 0);
    g.stroke();
  }
  g.restore();
  g.strokeStyle = rgba(accent, 0.9);
  g.lineWidth = 4;
  g.beginPath();
  g.arc(x + 6, eyeY, 38, 0, Math.PI * 2);
  g.stroke();
  g.fillStyle = accent;
  g.beginPath();
  g.arc(x + 6, eyeY, 14 + pulse * 4, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = rgba('#ffffff', 0.8);
  g.beginPath();
  g.arc(x + 1, eyeY - 5, 4.5, 0, Math.PI * 2);
  g.fill();

  // --- vents on the flanks, breathing with the pulse ----------------------
  for (let i = 0; i < 3; i++) {
    const vy = eyeY + 26 + i * 9;
    g.fillStyle = rgba('#05070e', 0.6);
    g.fillRect(hullX + 16, vy, 26, 4);
    g.fillRect(hullX + hullW - 42, vy, 26, 4);
    g.fillStyle = rgba(accent, 0.1 + pulse * 0.12);
    g.fillRect(hullX + 18, vy + 1, 22, 2);
    g.fillRect(hullX + hullW - 40, vy + 1, 22, 2);
  }

  // --- pistons pumping on either side -------------------------------------
  for (let i = 0; i < 2; i++) {
    const px = x - 62 + i * 140;
    const lift = Math.sin(t * 2.2 + i * Math.PI) * 5;
    g.fillStyle = '#0b1220';
    g.fillRect(px - 9, baseY - 50 + lift, 18, 42 - lift);
    g.fillStyle = C.steel;
    g.fillRect(px - 13, baseY - 58 + lift, 26, 11);
    g.fillStyle = rgba('#ffffff', 0.25);
    g.fillRect(px - 13, baseY - 58 + lift, 26, 2);
  }

  // --- exhaust stack tying the machine into the wall pipework --------------
  g.fillStyle = '#0b1220';
  rr(g, hullX + hullW - 46, hullY - 34, 24, 40, 4);
  g.fill();
  g.fillStyle = rgba(C.steel, 0.35);
  g.fillRect(hullX + hullW - 46, hullY - 34, 24, 6);
  const puff = (t * 0.5) % 1;
  g.globalAlpha = (1 - puff) * 0.22;
  g.fillStyle = C.steel;
  g.beginPath();
  g.arc(hullX + hullW - 34, hullY - 40 - puff * 46, 6 + puff * 14, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;

  // --- health readout, bolted to the machine -------------------------------
  const barW = 176;
  const barX = x - 78;
  // Clear of the exhaust stack above the hull, which would otherwise cross it.
  const barY = baseY - 222;
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
    label(g, `⚠ ${tr('coreDanger')}`, x, barY - 12, {
      align: 'center',
      size: 11,
      color: rgba(C.bad, warn),
      weight: 800,
      tracking: 1.6,
    });
  }
}

/**
 * The letter an enemy carries, floating above its head.
 *
 * An announced letter is a bright tile with a gold ring: the player can plan
 * around it. An unannounced carrier shows a sealed tile-face instead — solid and
 * clearly occupied, so it does not read as an empty placeholder, but with no
 * letter revealed.
 */
function carrierBadge(g: Ctx, enemy: Enemy, t: number): void {
  if (!enemy.carry) return;
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const scale = laneScale(lane);
  const size = 30 * scale;
  const bob = Math.sin(t * 3 + enemy.wobble) * 2;
  const y = enemyTop(enemy) - size - 12 + bob;
  const x = enemy.x - size / 2;

  if (enemy.announced) {
    const pulse = 0.5 + Math.sin(t * 4 + enemy.wobble) * 0.5;
    glow(g, x + size / 2, y + size / 2, size * 1.2, C.gold, 0.16 + pulse * 0.1);
    tile(g, x, y, size, enemy.carry, 'filled', { glow: C.gold });
    g.strokeStyle = rgba(C.gold, 0.35 + pulse * 0.3);
    g.lineWidth = 2;
    rr(g, x - 3, y - 3, size + 6, size + 6, 9);
    g.stroke();
  } else {
    // Sealed stock: a dark tile with a stamped mark and a strapped edge.
    const grad = g.createLinearGradient(x, y, x, y + size);
    grad.addColorStop(0, '#232c46');
    grad.addColorStop(1, '#161d31');
    g.fillStyle = rgba('#000000', 0.4);
    rr(g, x, y + 3, size, size, 8);
    g.fill();
    g.fillStyle = grad;
    rr(g, x, y, size, size, 8);
    g.fill();
    g.strokeStyle = rgba(C.slotEdge, 0.9);
    g.lineWidth = 2;
    rr(g, x, y, size, size, 8);
    g.stroke();
    // Stamped question mark, sunk into the face.
    g.fillStyle = rgba(C.faint, 0.85);
    g.font = `800 ${size * 0.5}px ${F.ui}`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('?', x + size / 2, y + size / 2 + size * 0.03);
    g.fillStyle = rgba(C.gold, 0.22);
    g.fillRect(x + size * 0.12, y + size * 0.5, size * 0.76, size * 0.06);
  }
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

/**
 * Screen-space bounds of an enemy's body.
 *
 * Exported because the player marks enemies by clicking them, and a click target
 * that does not match what is drawn is its own bug. Derived from the same
 * scale/foot math the renderer uses.
 */
export function enemyHitRect(enemy: Enemy): { x: number; y: number; w: number; h: number } {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const s = enemy.size * laneScale(lane) * UNIT;
  const foot = enemyFoot(enemy);
  return { x: enemy.x - s * 1.15, y: foot - s * 2.25, w: s * 2.3, h: s * 2.6 };
}

function drawEnemy(g: Ctx, enemy: Enemy, t: number, marked = false): void {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const scale = laneScale(lane);
  const s = enemy.size * scale * UNIT;
  const def = ENEMIES[enemy.kind];
  const flash = enemy.hitFlash;

  if (!enemy.flying) contact(g, enemy.x, lane, s, 0.42);

  g.save();
  g.translate(enemy.x, enemyFoot(enemy));
  g.scale(scale, scale);

  /** Vertical body gradient: lit from above, falling into its own shadow. */
  const shell = (color: string, top: number, bottom: number): string | CanvasGradient => {
    if (flash > 0.4) return '#ffffff';
    const grad = g.createLinearGradient(0, top, 0, bottom);
    grad.addColorStop(0, mix(color, '#ffffff', 0.34));
    grad.addColorStop(0.5, color);
    grad.addColorStop(1, mix(color, '#05070e', 0.55));
    return grad;
  };

  /** A glowing lens, with the dark socket around it that makes it read as an eye. */
  const eye = (x: number, y: number, r: number, color: string, phase = 0): void => {
    const pulse = 0.68 + Math.sin(t * 3.4 + phase) * 0.32;
    glow(g, x, y, r * 5, color, 0.42 * pulse);
    g.fillStyle = '#05070e';
    g.beginPath();
    g.arc(x, y, r * 1.62, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  };

  /** Legs. `pair` counts limbs on the visible side; they stride as it walks. */
  const legs = (count: number, top: number, reach: number, spread: number, color = '#080d18'): void => {
    g.strokeStyle = color;
    g.lineWidth = Math.max(1.8, s * 0.1);
    g.lineCap = 'round';
    for (let i = 0; i < count; i++) {
      const px = -spread / 2 + (i / Math.max(1, count - 1)) * spread;
      const phase = enemy.wobble * 7 + i * 2.2;
      const swing = Math.sin(phase) * reach * 0.5;
      const lift = Math.max(0, Math.sin(phase)) * reach * 0.22;
      g.beginPath();
      g.moveTo(px, top);
      g.lineTo(px + swing * 0.6 - reach * 0.12, top + (0 - top) * 0.55 - lift);
      g.lineTo(px + swing, -lift * 0.4);
      g.stroke();
    }
  };

  switch (def.shape) {
    // ---- MOTE: a beetle-like crawler. Small, but it visibly has legs, a
    // carapace and one wide lens, so it never reads as a UI pill.
    case 'mote': {
      legs(3, -s * 0.44, s * 0.46, s * 1.06, '#070b14');
      // Antennae
      g.strokeStyle = '#070b14';
      g.lineWidth = Math.max(1.2, s * 0.06);
      for (const a of [-0.5, 0.4]) {
        g.beginPath();
        g.moveTo(-s * 0.62, -s * 0.92);
        g.quadraticCurveTo(-s * (1.1 + a * 0.2), -s * (1.5 + a * 0.25), -s * (1.24 + a * 0.3), -s * (1.66 + a * 0.3));
        g.stroke();
      }
      // Carapace: domed shell with a spine seam.
      g.beginPath();
      g.moveTo(-s * 0.92, -s * 0.3);
      g.quadraticCurveTo(-s * 1.0, -s * 1.32, 0, -s * 1.4);
      g.quadraticCurveTo(s * 0.98, -s * 1.32, s * 0.9, -s * 0.3);
      g.closePath();
      g.fillStyle = shell(def.color, -s * 1.4, -s * 0.2);
      g.fill();
      g.strokeStyle = rgba('#050810', 0.95);
      g.lineWidth = 2 / scale;
      g.stroke();
      // Spine seam + segment lines: reads as a shell, not a capsule.
      g.strokeStyle = rgba('#050810', 0.35);
      g.lineWidth = Math.max(1, s * 0.05);
      g.beginPath();
      g.moveTo(0, -s * 1.38);
      g.lineTo(0, -s * 0.34);
      for (let i = 0; i < 3; i++) {
        const yy = -s * (0.55 + i * 0.28);
        g.moveTo(-s * 0.86, yy);
        g.quadraticCurveTo(0, yy - s * 0.1, s * 0.84, yy);
      }
      g.stroke();
      // Rim light along the top of the shell.
      g.strokeStyle = rgba('#ffffff', 0.3);
      g.lineWidth = Math.max(1.4, s * 0.07);
      g.beginPath();
      g.moveTo(-s * 0.86, -s * 0.72);
      g.quadraticCurveTo(-s * 0.8, -s * 1.26, 0, -s * 1.34);
      g.stroke();
      // Single wide lens, at the front (it walks toward the core, to the left).
      g.fillStyle = '#05070e';
      rr(g, -s * 1.02, -s * 0.95, s * 0.72, s * 0.42, s * 0.16);
      g.fill();
      eye(-s * 0.72, -s * 0.74, s * 0.14, C.cyan, enemy.wobble);
      // Mandibles.
      g.strokeStyle = rgba('#050810', 0.9);
      g.lineWidth = Math.max(1.4, s * 0.08);
      g.beginPath();
      g.moveTo(-s * 0.9, -s * 0.4);
      g.lineTo(-s * 1.16, -s * 0.18);
      g.moveTo(-s * 0.9, -s * 0.28);
      g.lineTo(-s * 1.14, -s * 0.06);
      g.stroke();
      break;
    }
    // ---- RUNNER: a lean two-legged strider, leaning into its sprint.
    case 'runner': {
      const stride = Math.sin(enemy.wobble * 9) * s * 0.5;
      g.strokeStyle = '#080d18';
      g.lineWidth = Math.max(2, s * 0.12);
      g.lineCap = 'round';
      for (const [off, alpha] of [[0, 1], [-s * 0.3, 0.5]] as Array<[number, number]>) {
        g.globalAlpha = alpha;
        g.beginPath();
        g.moveTo(s * 0.1 + off, -s * 0.7);
        g.lineTo(s * 0.1 + off - stride, -s * 0.34);
        g.lineTo(s * 0.1 + off - stride * 1.4, 0);
        g.stroke();
        g.beginPath();
        g.moveTo(s * 0.3 + off, -s * 0.7);
        g.lineTo(s * 0.3 + off + stride, -s * 0.34);
        g.lineTo(s * 0.3 + off + stride * 1.3, 0);
        g.stroke();
      }
      g.globalAlpha = 1;
      // Torso: a wedge, low at the front, high at the hip.
      g.beginPath();
      g.moveTo(-s * 0.95, -s * 0.82);
      g.lineTo(-s * 0.2, -s * 1.16);
      g.lineTo(s * 0.62, -s * 1.06);
      g.lineTo(s * 0.5, -s * 0.6);
      g.lineTo(-s * 0.6, -s * 0.56);
      g.closePath();
      g.fillStyle = shell(def.color, -s * 1.16, -s * 0.56);
      g.fill();
      g.strokeStyle = rgba('#050810', 0.95);
      g.lineWidth = 2 / scale;
      g.stroke();
      // Neck + head, thrust forward.
      g.beginPath();
      g.moveTo(-s * 0.86, -s * 0.84);
      g.lineTo(-s * 1.3, -s * 0.9);
      g.lineTo(-s * 1.28, -s * 1.06);
      g.lineTo(-s * 0.8, -s * 1.08);
      g.closePath();
      g.fillStyle = shell(def.color, -s * 1.1, -s * 0.85);
      g.fill();
      g.stroke();
      // Rim light along the spine.
      g.strokeStyle = rgba('#ffffff', 0.32);
      g.lineWidth = Math.max(1.4, s * 0.07);
      g.beginPath();
      g.moveTo(-s * 0.2, -s * 1.12);
      g.lineTo(s * 0.6, -s * 1.02);
      g.stroke();
      eye(-s * 1.12, -s * 0.98, s * 0.11, C.gold, enemy.wobble + 1);
      // Speed streaks behind it.
      if (enemy.speed > 0) {
        g.strokeStyle = rgba(def.color, 0.28);
        g.lineWidth = Math.max(1, s * 0.05);
        for (let i = 0; i < 3; i++) {
          const yy = -s * (0.6 + i * 0.22);
          const len = s * (0.9 - i * 0.16);
          g.beginPath();
          g.moveTo(s * 0.7, yy);
          g.lineTo(s * 0.7 + len, yy);
          g.stroke();
        }
      }
      break;
    }
    // ---- FLYER: a hovering carrier with a rotating blade ring and a hanging
    // grip, so it reads as airborne even without a shadow to sell it.
    case 'flyer': {
      const flap = Math.sin(t * 13 + enemy.wobble);
      // Rotor blur discs.
      for (const [dx, alpha] of [[-s * 0.9, 0.4], [s * 0.9, 0.4]] as Array<[number, number]>) {
        g.save();
        g.globalAlpha = alpha * (0.6 + Math.abs(flap) * 0.4);
        g.strokeStyle = rgba(def.color, 0.85);
        g.lineWidth = Math.max(1.6, s * 0.09);
        g.beginPath();
        g.ellipse(dx, -s * 1.05, s * 0.62, s * 0.16, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      // Rotor arms.
      g.strokeStyle = '#080d18';
      g.lineWidth = Math.max(1.6, s * 0.09);
      g.beginPath();
      g.moveTo(-s * 0.86, -s * 1.02);
      g.lineTo(-s * 0.3, -s * 0.86);
      g.moveTo(s * 0.86, -s * 1.02);
      g.lineTo(s * 0.3, -s * 0.86);
      g.stroke();
      // Hull.
      g.beginPath();
      g.ellipse(0, -s * 0.78, s * 0.66, s * 0.42, 0, 0, Math.PI * 2);
      g.fillStyle = shell(def.color, -s * 1.2, -s * 0.36);
      g.fill();
      g.strokeStyle = rgba('#050810', 0.95);
      g.lineWidth = 2 / scale;
      g.stroke();
      g.strokeStyle = rgba('#ffffff', 0.3);
      g.lineWidth = Math.max(1.3, s * 0.06);
      g.beginPath();
      g.ellipse(0, -s * 0.78, s * 0.6, s * 0.34, 0, Math.PI * 1.05, Math.PI * 1.95);
      g.stroke();
      // Hanging grip: this is the thing that hauls letters over walls.
      g.strokeStyle = '#080d18';
      g.lineWidth = Math.max(1.6, s * 0.09);
      g.beginPath();
      g.moveTo(-s * 0.3, -s * 0.42);
      g.lineTo(-s * 0.34, -s * 0.02);
      g.lineTo(s * 0.34, -s * 0.02);
      g.lineTo(s * 0.3, -s * 0.42);
      g.stroke();
      g.fillStyle = rgba(def.color, 0.35);
      g.fillRect(-s * 0.34, -s * 0.06, s * 0.68, s * 0.08);
      eye(-s * 0.3, -s * 0.82, s * 0.1, C.violet, enemy.wobble + 2);
      eye(s * 0.3, -s * 0.82, s * 0.1, C.violet, enemy.wobble + 3.4);
      break;
    }
    // ---- BRUTE: a tracked battering hulk. Weight comes from the treads, the
    // overhanging armour brow and the exhaust stacks.
    case 'brute': {
      // Treads.
      g.fillStyle = '#080d18';
      rr(g, -s * 1.0, -s * 0.46, s * 2.0, s * 0.46, s * 0.16);
      g.fill();
      g.fillStyle = rgba(C.steel, 0.5);
      const roll = (t * 40) % 18;
      for (let i = 0; i < 9; i++) {
        g.beginPath();
        g.arc(-s * 0.9 + i * s * 0.225 + roll * 0, -s * 0.23, s * 0.07, 0, Math.PI * 2);
        g.fill();
      }
      // Idler wheels.
      g.fillStyle = '#131b2e';
      for (const wx of [-s * 0.66, 0, s * 0.66]) {
        g.beginPath();
        g.arc(wx, -s * 0.23, s * 0.17, 0, Math.PI * 2);
        g.fill();
      }
      // Hull.
      plate(g, -s * 0.94, -s * 1.86, s * 1.88, s * 1.46, {
        radius: s * 0.14,
        fill: '#7d2a24',
        edge: '#3a1509',
        depth: s * 0.12,
      });
      g.fillStyle = flash > 0.4 ? '#ffffff' : shell(def.color, -s * 1.86, -s * 0.5);
      rr(g, -s * 0.9, -s * 1.82, s * 1.8, s * 1.38, s * 0.14);
      g.fill();
      // Armour brow overhanging the face.
      g.fillStyle = mix(def.color, '#000000', 0.34);
      g.beginPath();
      g.moveTo(-s * 1.06, -s * 1.5);
      g.lineTo(-s * 0.34, -s * 1.78);
      g.lineTo(-s * 0.34, -s * 1.44);
      g.lineTo(-s * 1.06, -s * 1.28);
      g.closePath();
      g.fill();
      g.strokeStyle = rgba('#050810', 0.9);
      g.lineWidth = 2 / scale;
      g.stroke();
      // Vent slits on the flank.
      for (let i = 0; i < 3; i++) {
        g.fillStyle = rgba('#050810', 0.72);
        g.fillRect(s * 0.08 + i * s * 0.24, -s * 1.0, s * 0.14, s * 0.4);
      }
      // Rim light along the hull top.
      g.strokeStyle = rgba('#ffffff', 0.22);
      g.lineWidth = Math.max(1.6, s * 0.06);
      g.beginPath();
      g.moveTo(-s * 0.86, -s * 1.78);
      g.lineTo(s * 0.84, -s * 1.78);
      g.stroke();
      // Exhaust stacks, puffing on a slow cycle.
      for (const ex of [-s * 0.5, -s * 0.16]) {
        g.fillStyle = '#0d1322';
        rr(g, ex, -s * 2.06, s * 0.22, s * 0.34, s * 0.06);
        g.fill();
        const puff = ((t * 0.7 + ex / s) % 1);
        g.globalAlpha = (1 - puff) * 0.3;
        g.fillStyle = C.steel;
        g.beginPath();
        g.arc(ex + s * 0.11, -s * 2.1 - puff * s * 0.5, s * (0.12 + puff * 0.2), 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
      // Headlamps.
      eye(-s * 0.78, -s * 1.16, s * 0.1, C.ember, enemy.wobble + 0.6);
      eye(-s * 0.5, -s * 1.16, s * 0.1, C.ember, enemy.wobble + 1.8);
      break;
    }
    // ---- BOSS: the machine the whole line feeds. Big core, hazard plating,
    // and a slowly opening iris that telegraphs its mood.
    case 'boss': {
      glow(g, 0, -s * 1.1, s * 2.6, C.ember, 0.3);
      // Base skirt.
      g.fillStyle = '#080d18';
      rr(g, -s * 1.06, -s * 0.42, s * 2.12, s * 0.42, s * 0.12);
      g.fill();
      // Main housing.
      plate(g, -s * 1.0, -s * 2.42, s * 2.0, s * 2.0, {
        radius: s * 0.18,
        fill: '#7a2f18',
        edge: '#3a1509',
        depth: s * 0.2,
      });
      const housing = shell(def.color, -s * 2.4, -s * 0.5);
      g.fillStyle = flash > 0.4 ? '#ffffff' : housing;
      rr(g, -s * 0.96, -s * 2.38, s * 1.92, s * 1.96, s * 0.18);
      g.fill();
      g.strokeStyle = rgba('#050810', 0.9);
      g.lineWidth = 2 / scale;
      rr(g, -s * 0.96, -s * 2.38, s * 1.92, s * 1.96, s * 0.18);
      g.stroke();
      // Hazard chevrons on the shoulder plates.
      g.save();
      rr(g, -s * 0.96, -s * 2.38, s * 1.92, s * 1.96, s * 0.18);
      g.clip();
      hazardStripes(g, -s * 1.0, -s * 0.92, s * 2.0, s * 0.3, '#f0b445');
      g.restore();
      // Iris: a ring of blades around a molten centre.
      const irisY = -s * 1.62;
      g.fillStyle = '#05070e';
      g.beginPath();
      g.arc(0, irisY, s * 0.56, 0, Math.PI * 2);
      g.fill();
      glow(g, 0, irisY, s * 1.1, C.gold, 0.34);
      g.fillStyle = C.gold;
      g.beginPath();
      g.arc(0, irisY, s * 0.26 + Math.sin(t * 6) * s * 0.03, 0, Math.PI * 2);
      g.fill();
      g.save();
      g.translate(0, irisY);
      g.rotate(t * 0.7);
      g.strokeStyle = rgba('#050810', 0.85);
      g.lineWidth = Math.max(2, s * 0.07);
      for (let i = 0; i < 8; i++) {
        g.rotate((Math.PI * 2) / 8);
        g.beginPath();
        g.moveTo(s * 0.3, 0);
        g.lineTo(s * 0.54, 0);
        g.stroke();
      }
      g.restore();
      // Rim light.
      g.strokeStyle = rgba('#ffffff', 0.2);
      g.lineWidth = Math.max(1.8, s * 0.05);
      g.beginPath();
      g.moveTo(-s * 0.9, -s * 2.32);
      g.lineTo(s * 0.9, -s * 2.32);
      g.stroke();
      // Piston legs.
      for (let i = -1; i <= 1; i++) {
        const px = i * s * 0.56;
        const lift = Math.sin(t * 2.4 + i * 1.4) * s * 0.06;
        g.fillStyle = '#131b2e';
        g.fillRect(px - s * 0.1, -s * 0.52 + lift, s * 0.2, s * 0.44 - lift);
        g.fillStyle = C.steel;
        g.fillRect(px - s * 0.15, -s * 0.6 + lift, s * 0.3, s * 0.12);
      }
      break;
    }
    default:
      break;
  }

  if (enemy.freezeT > 0) {
    // Encased in ice: a cracked pane over the whole silhouette.
    g.fillStyle = rgba('#8fe3f0', 0.3);
    rr(g, -s * 1.1, -s * 2.2, s * 2.2, s * 2.2, s * 0.3);
    g.fill();
    g.strokeStyle = rgba('#ffffff', 0.6);
    g.lineWidth = 2 / scale;
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.4;
      g.beginPath();
      g.moveTo(0, -s * 1.1);
      g.lineTo(Math.cos(a) * s * 1.0, -s * 1.1 + Math.sin(a) * s * 1.0);
      g.stroke();
    }
    rr(g, -s * 1.1, -s * 2.2, s * 2.2, s * 2.2, s * 0.3);
    g.strokeStyle = rgba('#d8f6ff', 0.75);
    g.lineWidth = 2.4 / scale;
    g.stroke();
  } else if (enemy.burnT > 0) {
    const top = enemyTop(enemy) - enemyFoot(enemy);
    for (let i = 0; i < 4; i++) {
      const fx = -s * 0.6 + i * s * 0.4;
      const h = s * (0.5 + Math.abs(Math.sin(t * 9 + i * 2 + enemy.wobble)) * 0.5);
      g.fillStyle = rgba(i % 2 === 0 ? C.ember : C.gold, 0.8);
      g.beginPath();
      g.moveTo(fx - s * 0.14, top);
      g.quadraticCurveTo(fx, top - h * 0.7, fx + s * 0.02, top - h);
      g.quadraticCurveTo(fx + s * 0.12, top - h * 0.6, fx + s * 0.16, top);
      g.closePath();
      g.fill();
    }
    glow(g, 0, top, s * 1.6, C.ember, 0.2);
  }
  g.restore();

  if (enemy.hp < enemy.maxHp) {
    const w = Math.max(34, s * 2.1);
    const hx = enemy.x - w / 2;
    const hy = enemyTop(enemy) - (enemy.carry ? 44 : 14);
    g.fillStyle = rgba('#05070e', 0.72);
    rr(g, hx - 1, hy - 1, w + 2, 8, 4);
    g.fill();
    g.fillStyle = def.tags.includes('HEAVY') ? C.ember : C.mint;
    rr(g, hx, hy, Math.max(2, w * (enemy.hp / enemy.maxHp)), 6, 3);
    g.fill();
  }
  carrierBadge(g, enemy, t);
  if (marked) markReticle(g, enemy, t);
}

/**
 * The Target Mark reticle (brief 3.4.1).
 *
 * Deliberately compact and drawn *around* the unit: it must not cover the carried
 * letter, because the letter is the reason the player marked this enemy in the
 * first place. No banner, no arrow.
 */
function markReticle(g: Ctx, enemy: Enemy, t: number): void {
  const lane = clamp(enemy.lane, 0, FIELD.lanes - 1);
  const s = enemy.size * laneScale(lane) * UNIT;
  const foot = enemyFoot(enemy);
  const rw = s * 1.75;
  const rh = s * 2.0;
  const cx = enemy.x;
  const cy = foot - s * 1.05;
  const pulse = 0.62 + Math.sin(t * 7) * 0.22;

  // Rotating corner brackets: reads as a targeting computer rather than a
  // selection highlight, and survives being scaled down on far lanes.
  const arm = Math.max(9, s * 0.42);
  g.save();
  glow(g, cx, cy, s * 2.2, C.gold, 0.16);
  g.strokeStyle = rgba(C.gold, pulse);
  g.lineWidth = 3;
  for (const [dx, dy] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ]) {
    const px = cx + dx * rw * 0.5;
    const py = cy + dy * rh * 0.5;
    g.beginPath();
    g.moveTo(px - dx * arm, py);
    g.lineTo(px, py);
    g.lineTo(px, py - dy * arm);
    g.stroke();
  }
  // Four ticks orbiting the target, so the mark still reads on a still frame.
  g.strokeStyle = rgba(C.gold, pulse * 0.7);
  g.lineWidth = 1.6;
  for (let i = 0; i < 4; i++) {
    const a = t * 1.6 + (i * Math.PI) / 2;
    const ox = Math.cos(a) * rw * 0.62;
    const oy = Math.sin(a) * rh * 0.62;
    g.beginPath();
    g.moveTo(cx + ox - 3, cy + oy);
    g.lineTo(cx + ox + 3, cy + oy);
    g.stroke();
  }
  g.restore();
}

function drawEntity(g: Ctx, ent: Entity, t: number): void {
  const lane = clamp(Math.round(ent.lane), 0, FIELD.lanes - 1);
  const scale = laneScale(lane) * (0.45 + 0.55 * ent.spawn) * UNIT;
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
  for (const enemy of enemies) drawEnemy(g, enemy, t, enemy.id === battle.markedId);

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
  focus(g);
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
