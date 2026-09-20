/**
 * Battle HUD.
 *
 * Information hierarchy is fixed by the design brief:
 *   1. equipped blueprint progress
 *   2. current shared letter pool
 *   3. wildcard availability
 *   4. letters still coming in on carriers
 *   5. core health / threat
 *   6. cascade chain depth
 * Nothing else is allowed on screen during a fight.
 *
 * The HUD also owns the word-completion beat, because that transformation has to
 * happen on the blueprint card the player's eye is already on.
 */
import { C, DECK, R, T, W, BP_COLOR } from '../core/theme';
import { clamp, easeOut } from '../core/rng';
import { glow, label, measure, mix, plate, rgba, rr, tile, well, type Ctx, type Rect } from '../core/draw';
import { loc, t } from '../core/i18n';
import { H } from '../core/strings';
import type { Battle } from '../battle/battle';
import type { BlueprintDef } from '../alphabet/types';
import type { Ui } from '../core/ui';

// ---- layout (all logical px) ---------------------------------------------

export const CARD = { x: 24, y: 622, w: 300, h: 100, gap: 16 };
export const cardRect = (slot: number): Rect => ({
  x: CARD.x + slot * (CARD.w + CARD.gap),
  y: CARD.y,
  w: CARD.w,
  h: CARD.h,
});

export const INCOMING: Rect = { x: 984, y: CARD.y, w: 432, h: CARD.h };
export const BAGBOX: Rect = { x: 24, y: 730, w: 250, h: 70 };
export const TRAY: Rect = { x: 286, y: 730, w: 834, h: 70 };
export const WILD_RECT: Rect = { x: 1132, y: 730, w: 284, h: 70 };

/** How long a tile spends flying into its socket, in seconds. */
export const LETTER_FLIGHT = 0.34;

/**
 * Socket row geometry for one card.
 *
 * Extracted so the card and the incoming-letter animation compute the same
 * destination from the same code — the brief's whole claim is that a letter
 * visibly travels *into* a socket, which only reads correctly if the flight
 * lands exactly where the socket is drawn.
 */
export function socketGeom(
  bp: BlueprintDef,
  slot: number,
): { startX: number; ty: number; size: number; gap: number } {
  const r = cardRect(slot);
  const gap = 5;
  const avail = r.w - 32;
  const size = Math.min(52, (avail - (bp.recipe.length - 1) * gap) / bp.recipe.length);
  const totalW = bp.recipe.length * size + (bp.recipe.length - 1) * gap;
  return { startX: r.x + (r.w - totalW) / 2, ty: r.y + 12, size, gap };
}

/** One tile in flight from its source to the socket it was routed into. */
export interface HudFlight {
  char: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  size: number;
  /** Elapsed seconds. The screen owns this because it owns real time. */
  t: number;
  /** Depth on z, so a carrier drop draws over a bag draw if they overlap. */
  z: number;
}

const STRIP: Rect = { x: 60, y: 14, w: 580, h: 68 };
const CHAIN_BOX: Rect = { x: 656, y: 14, w: 112, h: 68 };
const CONTROLS: Rect = { x: 784, y: 26, w: 196, h: 44 };
const HINT: Rect = { x: 60, y: 92, w: 580, h: 38 };

/**
 * Truncates text to a pixel width with an ellipsis.
 *
 * Panels here have fixed geometry and the copy is localized, so any label that
 * sits next to a counter or an icon has to be clipped by measurement rather than
 * by hope.
 */
function fit(g: Ctx, text: string, maxW: number, size: number, weight: number): string {
  if (measure(g, text, { size, weight }) <= maxW) return text;
  const chars = [...text];
  while (chars.length > 1) {
    chars.pop();
    const test = `${chars.join('')}…`;
    if (measure(g, test, { size, weight }) <= maxW) return test;
  }
  return '…';
}


function blueprintCard(
  g: Ctx,
  battle: Battle,
  bp: BlueprintDef | null,
  slot: number,
  time: number,
  opts: HudInteraction,
): void {
  const r = cardRect(slot);
  const hovered = opts.hoveredSlot === slot;
  const eligible = opts.eligible.includes(slot);
  const armed = opts.wildcardMode;

  if (!bp) {
    plate(g, r.x, r.y, r.w, r.h, { radius: R.md, fill: '#101728', depth: 5 });
    label(g, H.emptySlot, r.x + r.w / 2, r.y + r.h / 2, {
      align: 'center',
      baseline: 'middle',
      size: T.tiny,
      color: C.faint,
      weight: 700,
      tracking: 2,
    });
    return;
  }

  const tone = BP_COLOR[bp.id] ?? C.cyan;
  // V2: the card shows the blueprint's own sockets. Each position is either
  // occupied by a physical tile or visibly empty, so "what is almost complete"
  // and "what exact letter is missing" are readable without counting (brief 3.1).
  const rt = battle.machine.bySlot(slot);
  const sockets =
    rt?.sockets ?? bp.recipe.map((requiredChar) => ({ requiredChar, letter: null }));
  const covered = sockets.map((sk) => sk.letter !== null);
  const focused = battle.focusSlot === slot;
  const missingCount = covered.filter((c) => !c).length;
  const crafts = battle.telemetry.data.craftsByBlueprint[bp.id] ?? 0;
  const almost = missingCount === 1;

  plate(g, r.x, r.y, r.w, r.h, {
    radius: R.md,
    fill: focused ? '#1c2742' : hovered || (armed && eligible) ? '#1e2a46' : '#151d30',
    edge: armed && eligible ? C.gold : focused ? tone : almost ? rgba(tone, 0.85) : undefined,
    depth: 5,
  });

  // Focus state. The brief asks for it to be unmistakable without being noisy,
  // and explicitly not to rely on colour alone — so it is a labelled bracket,
  // not a tint.
  if (focused) {
    const pulse = 0.55 + Math.sin(time * 4) * 0.2;
    g.strokeStyle = rgba(tone, pulse);
    g.lineWidth = W.bold + 1;
    rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, R.md + 3);
    g.stroke();
    // Corner brackets: the mechanical "selected" read.
    const bl = 16;
    g.strokeStyle = rgba('#ffffff', 0.85);
    g.lineWidth = 2.5;
    for (const [cx, cy, dx, dy] of [
      [r.x - 3, r.y - 3, 1, 1],
      [r.x + r.w + 3, r.y - 3, -1, 1],
      [r.x - 3, r.y + r.h + 3, 1, -1],
      [r.x + r.w + 3, r.y + r.h + 3, -1, -1],
    ]) {
      g.beginPath();
      g.moveTo(cx + dx * bl, cy);
      g.lineTo(cx, cy);
      g.lineTo(cx, cy + dy * bl);
      g.stroke();
    }
    // The label sits above the card as a chip: inside the card it would print on
    // top of the socket row, and the sockets are the thing the player is reading.
    const chipW = measure(g, H.focus, { size: T.micro, weight: 800, tracking: 2 }) + 22;
    const chipX = r.x + r.w - chipW;
    const chipY = r.y - 21;
    plate(g, chipX, chipY, chipW, 17, { radius: 5, fill: '#12192b', edge: tone, depth: 3 });
    label(g, H.focus, chipX + chipW / 2, chipY + 12, {
      size: T.micro,
      color: tone,
      align: 'center',
      weight: 800,
      tracking: 2,
    });
  }

  // Progress wash — the card brightens as its recipe fills up.
  const filled = (bp.recipe.length - missingCount) / bp.recipe.length;
  if (filled > 0) {
    g.save();
    rr(g, r.x, r.y, r.w, r.h, R.md);
    g.clip();
    const grad = g.createLinearGradient(r.x, r.y, r.x, r.y + r.h);
    grad.addColorStop(0, rgba(tone, 0.06 + filled * 0.14));
    grad.addColorStop(1, rgba(tone, 0.02 + filled * 0.06));
    g.fillStyle = grad;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.restore();
  }

  // Recipe tiles, in spelling order, plus the word they spell.
  const gap = 5;
  const avail = r.w - 32;
  const size = Math.min(52, (avail - (bp.recipe.length - 1) * gap) / bp.recipe.length);
  const totalW = bp.recipe.length * size + (bp.recipe.length - 1) * gap;
  const startX = r.x + (r.w - totalW) / 2;
  const ty = r.y + 12;

  sockets.forEach((sk, i) => {
    const x = startX + i * (size + gap);
    const letter = sk.letter;
    // A tile that has not landed yet is drawn as a ghost socket: the letter is
    // already committed logically (so the sim stays deterministic) but the player
    // watches it arrive rather than finding the slot silently full.
    const arriving = letter !== null && time - letter.createdAt < LETTER_FLIGHT;
    if (arriving) {
      // An outlined socket, not a filled one. A solid tint here read as "already
      // occupied" — the tile itself is still in the air, so the socket has to
      // look like it is *about to* receive something.
      tile(g, x, ty, size, null, 'slot');
      const e = clamp((time - letter.createdAt) / LETTER_FLIGHT, 0, 1);
      g.save();
      g.globalAlpha = 0.45 + e * 0.5;
      g.strokeStyle = tone;
      g.lineWidth = 2.5;
      g.setLineDash([5, 4]);
      rr(g, x + 3, ty + 3, size - 6, size - 6, 6);
      g.stroke();
      g.restore();
    } else if (letter !== null) {
      tile(g, x, ty, size, letter.char, 'filled');
    } else if (armed && eligible) {
      tile(g, x, ty, size, null, 'missing');
    } else {
      tile(g, x, ty, size, null, 'slot');
    }
  });

  // Word + behaviour, so the player never has to remember what BBOM was.
  label(g, bp.word, r.x + 16, r.y + r.h - 12, {
    size: T.body,
    color: C.ink,
    weight: 800,
    tracking: 2,
  });
  // Positioned by measurement, never by the ambient canvas font: `g.measureText`
  // here would read whatever font the previous draw call happened to leave set.
  const wordW = measure(g, bp.word, { size: T.body, weight: 800, tracking: 2 });
  label(g, loc(bp.name), r.x + 16 + wordW + 42, r.y + r.h - 12, {
    size: T.small,
    color: tone,
    weight: 700,
  });
  const craftLabel = crafts > 0 ? `×${crafts}` : null;
  const craftW = craftLabel ? measure(g, craftLabel, { size: T.small, weight: 800 }) : 0;
  // What the pool still owes this recipe, spelled out — but only when the word
  // has not crafted yet, so it never collides with the craft counter.
  const owedCounts = new Map<string, number>();
  bp.recipe.forEach((letter, i) => {
    if (!covered[i]) owedCounts.set(letter, (owedCounts.get(letter) ?? 0) + 1);
  });
  const owed = [...owedCounts.entries()].map(([letter, n]) => (n > 1 ? `${letter}×${n}` : letter));
  // The "still needs" line and the craft counter share the card's bottom-right
  // corner, so the guard has to reserve the counter's actual width — a bare
  // "is there room for the text" check let them print on top of each other.
  const nameEnd = r.x + 16 + wordW + 42 + measure(g, loc(bp.name), { size: T.small, weight: 700 });
  const needText = owed.length > 0 ? `${H.needs} ${owed.join(' ')}` : null;
  const needW = needText ? measure(g, needText, { size: T.small, weight: 800 }) : 0;
  const rightEdge = r.x + r.w - 16;
  // While this card is playing its completion beat the sockets are already empty
  // (the letters were committed) but the beat redraws them as the finished word.
  // Printing "still needs ..." underneath that contradiction is worse than
  // printing nothing.
  const crafting = battle.pending.some((p) => p.slot === slot);
  // The "still needs" line wins the corner and the craft counter yields: what the
  // recipe is waiting for is actionable, how many times it has fired is not.
  if (needText && !crafting && rightEdge - needW > nameEnd + 8) {
    label(g, needText, rightEdge, r.y + r.h - 12, {
      size: T.small,
      color: rgba(C.gold, 0.95),
      align: 'right',
      weight: 800,
    });
  }
  const showCounter =
    craftLabel !== null &&
    !crafting &&
    (!needText || rightEdge - needW - 12 - craftW > nameEnd + 8);
  if (showCounter && craftLabel) {
    label(g, craftLabel, rightEdge, r.y + r.h - 12, {
      size: T.small,
      color: C.dim,
      align: 'right',
      weight: 800,
    });
  }

  // Actionable wildcard: only the missing tile is highlighted, nothing modal.
  if (armed && eligible) {
    const pulse = 0.5 + Math.sin(time * 6) * 0.5;
    g.strokeStyle = rgba(C.gold, 0.5 + pulse * 0.5);
    g.lineWidth = W.bold;
    rr(g, r.x - 3, r.y - 3, r.w + 6, r.h + 6, R.md + 3);
    g.stroke();
  }

  // ---- the word-completion beat ------------------------------------------
  const craft = battle.pending.find((p) => p.slot === slot);
  if (!craft) return;
  const beat =
    craft.phase === 0 ? craft.t / 0.36 : craft.phase === 1 ? craft.t / 0.2 : craft.t / 0.26;

  if (craft.phase === 0) {
    // The tiles are already sitting in their own sockets, so the hero beat is the
    // row tightening and lighting up in place rather than letters arriving from
    // somewhere else. That is the whole point of V2: the player watched each tile
    // land, so the completion has a cause they already traced.
    craft.letters.forEach((letter, i) => {
      const e = clamp(easeOut(clamp(beat + (craft.letters.length - 1 - i) * 0.07, 0, 1)), 0, 1);
      const lift = Math.sin(e * Math.PI) * 7;
      tile(g, startX + i * (size + gap), ty - lift, size, letter, 'filled', {
        alpha: 0.5 + e * 0.5,
        glow: e > 0.55 ? C.gold : undefined,
      });
    });
  } else if (craft.phase === 1) {
    // Lock: the word squeezes together into one solid block.
    const squeeze = 1 - beat * 0.3;
    g.save();
    g.translate(r.x + r.w / 2, ty + size / 2);
    g.scale(squeeze, 1 / squeeze);
    g.translate(-(r.x + r.w / 2), -(ty + size / 2));
    bp.recipe.forEach((letter, i) => {
      tile(g, startX + i * (size + gap), ty, size, letter, 'lock', { press: 1, glow: C.gold });
    });
    g.restore();
    glow(g, r.x + r.w / 2, ty + size / 2, 200 * beat, C.gold, 0.22);
  } else {
    // Emerge: the object leaves the card for the battlefield.
    const a = 1 - beat;
    g.strokeStyle = rgba(C.gold, a * 0.9);
    g.lineWidth = 5 * a + 1;
    g.beginPath();
    g.moveTo(r.x + r.w / 2, r.y);
    g.quadraticCurveTo(r.x + r.w / 2 + 80, r.y - 160, r.x + r.w / 2 + 320, 470);
    g.stroke();
  }
}

/**
 * The reserve tray.
 *
 * Deliberately small, and deliberately not the centre of the screen: in V2 a
 * letter's normal destination is a socket, and this holds only the ones no
 * recipe currently wants. Capacity pips make the overflow rule visible before it
 * bites (brief 3.1.2).
 */
function reserveTray(g: Ctx, battle: Battle, time: number): void {
  well(g, TRAY.x, TRAY.y, TRAY.w, TRAY.h, R.md);
  // Label lives inside the well, in its own column, so tiles never touch text.
  label(g, H.reserve, TRAY.x + 16, TRAY.y + TRAY.h / 2 + 4, {
    size: T.micro,
    color: C.faint,
    weight: 800,
    tracking: 2,
  });
  const trayInner = { x: TRAY.x + 118, w: TRAY.w - 118 - 16 };

  const letters = battle.machine.reserve;
  const size = 42;
  const gap = 7;
  const y = TRAY.y + (TRAY.h - size) / 2 - 6;
  // Capacity pips, so "the reserve is nearly full" is readable at a glance.
  const cap = battle.machine.reserveCap;
  const pipY = TRAY.y + TRAY.h - 10;

  letters.forEach((letter, i) => {
    const x = trayInner.x + i * (size + gap);
    const age = time - letter.createdAt;
    if (age < LETTER_FLIGHT) {
      // Still in flight; the socket-style outline keeps the tray honest about
      // what the player actually owns right now.
      tile(g, x, y, size, null, 'slot');
      return;
    }
    const pop = age < 0.62 ? 1 + (0.62 - age) * 0.85 : 1;
    tile(g, x, y, size, letter.char, 'filled', { scale: pop, press: 0 });
  });

  for (let i = 0; i < cap; i++) {
    const x = trayInner.x + i * (size + gap) + size / 2;
    g.fillStyle = i < letters.length ? rgba(C.gold, 0.8) : rgba('#ffffff', 0.16);
    g.beginPath();
    g.arc(x, pipY, 2.5, 0, Math.PI * 2);
    g.fill();
  }

  if (letters.length === 0) {
    label(g, H.reserveEmpty, trayInner.x + trayInner.w / 2 - 60, TRAY.y + TRAY.h / 2 + 5, {
      size: T.small,
      color: C.faint,
      align: 'center',
      weight: 600,
    });
  }
}

/** Bag readout: the player's raw economy and how much of the cycle is left. */
function bagBox(g: Ctx, battle: Battle, time: number): void {
  well(g, BAGBOX.x, BAGBOX.y, BAGBOX.w, BAGBOX.h, R.md);
  label(g, H.bag, BAGBOX.x + 14, BAGBOX.y + 20, {
    size: T.micro,
    color: C.faint,
    weight: 800,
    tracking: 2,
  });
  const remain = battle.bag.remaining;
  const total = Math.max(1, battle.bag.size);
  // A fresh cycle is a systemic beat: it refills the bag and cuts the current
  // cascade, so it gets a moment of light rather than passing silently.
  const since = Math.min(1, Math.max(0, (time - battle.cycleAt) / 0.9));
  const pulse = since < 1 ? 1 - since : 0;
  label(g, `${H.cycle} ${battle.bag.cycleIndex + 1}`, BAGBOX.x + 14, BAGBOX.y + 40, {
    size: T.tiny,
    color: C.dim,
    weight: 700,
  });
  label(g, `${remain}/${total}`, BAGBOX.x + BAGBOX.w - 14, BAGBOX.y + 40, {
    size: T.small,
    color: C.ink,
    align: 'right',
    weight: 800,
  });
  const trackX = BAGBOX.x + 14;
  const trackW = BAGBOX.w - 28;
  g.fillStyle = rgba('#000000', 0.45);
  rr(g, trackX, BAGBOX.y + 50, trackW, 12, 6);
  g.fill();
  if (pulse > 0) {
    g.strokeStyle = rgba(C.gold, 0.35 + pulse * 0.6);
    g.lineWidth = 2;
    rr(g, BAGBOX.x - 1, BAGBOX.y - 1, BAGBOX.w + 2, BAGBOX.h + 2, R.md + 1);
    g.stroke();
  }
  g.fillStyle = pulse > 0 ? mix(C.cyan, C.gold, pulse) : C.cyan;
  rr(g, trackX, BAGBOX.y + 50, Math.max(6, trackW * (remain / total)), 12, 6);
  g.fill();
}

/** Wildcard: charges, and exactly what it would do right now. */
function wildcard(g: Ctx, ui: Ui, battle: Battle, time: number, inter: HudInteraction): void {
  const left = battle.wildcardsLeft;
  const armed = inter.wildcardMode;
  const usable = left > 0 && battle.targets.length > 0;
  const pulse = 0.5 + Math.sin(time * 5) * 0.5;
  const hover = ui.hit('hud.wild', WILD_RECT, {
    disabled: left <= 0,
    tooltip: `${H.wildcard} — ${H.wildcardHint}`,
  });

  if (usable) {
    glow(g, WILD_RECT.x + 52, WILD_RECT.y + WILD_RECT.h / 2, 64 + pulse * 8, C.violet, 0.26);
  }
  plate(g, WILD_RECT.x, WILD_RECT.y, WILD_RECT.w, WILD_RECT.h, {
    radius: R.md,
    fill: armed ? '#2b2050' : '#1a2136',
    edge: usable ? C.violet : undefined,
    depth: 5,
    alpha: left > 0 ? 1 : 0.5,
  });
  tile(g, WILD_RECT.x + 12, WILD_RECT.y + 12, 46, '?', usable ? 'wild' : 'slot', {
    glow: usable ? C.violet : undefined,
  });

  const tx = WILD_RECT.x + 68;
  // The charge counter owns the right end of the plate, so the detail lines are
  // laid out against a width that stops short of it — otherwise a long
  // "no recipe needs one letter" line runs under the number and off the screen.
  const countW = 44;
  const textW = WILD_RECT.x + WILD_RECT.w - 14 - countW - tx;
  const detail =
    left <= 0
      ? H.wildSpent
      : battle.targets.length > 0
        ? `${battle.targets[0].blueprint.word} ${H.needLetter}${battle.targets[0].missing}`
        : H.wildWaiting;
  label(g, fit(g, detail, textW, T.small, 800), tx, WILD_RECT.y + 30, {
    size: T.small,
    color: left > 0 ? C.ink : C.faint,
    weight: 800,
  });
  label(g, fit(g, H.wildReady, textW, T.micro, 700), tx, WILD_RECT.y + 52, {
    size: T.micro,
    color: left > 0 && battle.targets.length > 0 ? C.violet : C.faint,
    weight: 700,
  });
  label(g, `${left}`, WILD_RECT.x + WILD_RECT.w - 14, WILD_RECT.y + 32, {
    size: T.head,
    color: left > 0 ? C.ink : C.faint,
    align: 'right',
    weight: 800,
  });

  if (hover.hover && left > 0) {
    g.strokeStyle = rgba('#ffffff', 0.35);
    g.lineWidth = W.hair;
    rr(g, WILD_RECT.x - 3, WILD_RECT.y - 3, WILD_RECT.w + 6, WILD_RECT.h + 6, R.md + 3);
    g.stroke();
  }
}

/** Incoming letters: what is still promised, and how many carriers are unknown. */
function incomingPanel(g: Ctx, battle: Battle): void {
  plate(g, INCOMING.x, INCOMING.y, INCOMING.w, INCOMING.h, {
    radius: R.md,
    fill: '#131b2e',
    edge: C.lineHi,
    depth: 5,
  });
  label(g, H.incomingLetters, INCOMING.x + 16, INCOMING.y + 22, {
    size: T.micro,
    color: C.faint,
    weight: 800,
    tracking: 2,
  });

  const known = battle.cfg.encounter.guaranteed;
  const size = 40;
  const gap = 6;
  const maxShown = Math.floor((INCOMING.w - 150) / (size + gap));
  const shown = known.slice(0, maxShown);
  const y = INCOMING.y + INCOMING.h - size - 12;
  shown.forEach((letter, i) => {
    tile(g, INCOMING.x + 16 + i * (size + gap), y, size, letter, 'filled');
  });
  if (known.length === 0) {
    label(g, H.incomingNone, INCOMING.x + 16, y + 28, {
      size: T.small,
      color: C.faint,
      weight: 600,
    });
  }
  const unknown = battle.cfg.encounter.unknownCarriers;
  if (unknown > 0) {
    label(g, `${unknown} ${H.incomingUnknown}`, INCOMING.x + INCOMING.w - 16, INCOMING.y + INCOMING.h - 22, {
      size: T.small,
      color: C.gold,
      align: 'right',
      weight: 700,
    });
  }
}

/** Top-left: which encounter this is and how much of it is left. */
function encounterStrip(g: Ctx, battle: Battle, waveIndex: number, waveTotal: number): void {
  plate(g, STRIP.x, STRIP.y, STRIP.w, STRIP.h, {
    radius: R.md,
    fill: '#121a2c',
    edge: C.lineHi,
    depth: 5,
  });
  const enc = battle.cfg.encounter;
  const kindColor = enc.kind === 'boss' ? C.bad : enc.kind === 'elite' ? C.gold : C.cyan;
  const kindText = H.kindLabel[enc.kind];
  const nameW = measure(g, loc(enc.name), { size: T.lead, weight: 800 });
  const kindW = measure(g, kindText, { size: T.micro, weight: 800 }) + 24;
  const chipX = STRIP.x + 18 + nameW + 14;
  g.fillStyle = rgba(kindColor, 0.16);
  rr(g, chipX, STRIP.y + 12, kindW, 24, 12);
  g.fill();
  label(g, kindText, chipX + 12, STRIP.y + 29, { size: T.micro, color: kindColor, weight: 800 });
  label(g, loc(enc.name), STRIP.x + 18, STRIP.y + 30, { size: T.lead, color: C.ink, weight: 800 });
  label(g, `${H.wave} ${waveIndex}/${waveTotal}`, STRIP.x + 18, STRIP.y + 56, {
    size: T.small,
    color: C.dim,
    weight: 700,
  });
  const live = battle.enemies.filter((e) => !e.dead).length;
  label(g, `${H.remaining} ${live}`, STRIP.x + STRIP.w - 18, STRIP.y + 56, {
    size: T.small,
    color: live > 0 ? C.ember : C.mint,
    align: 'right',
    weight: 800,
  });
}

/** Top-centre: the cascade counter — only loud while a chain is alive. */
function chainBox(g: Ctx, battle: Battle, active: boolean, pulse: number): void {
  const r = CHAIN_BOX;
  const depth = Math.max(1, battle.chain);
  plate(g, r.x, r.y, r.w, r.h, {
    radius: R.md,
    fill: active ? '#2b1c42' : '#121a2c',
    edge: active ? C.violet : C.lineHi,
    depth: 5,
  });
  label(g, H.chain, r.x + r.w / 2, r.y + 24, {
    size: T.micro,
    color: active ? C.violet : C.faint,
    align: 'center',
    weight: 800,
    tracking: 2,
  });
  label(g, `×${depth}`, r.x + r.w / 2, r.y + 54, {
    size: active ? 30 : 24,
    color: active ? C.ink : C.faint,
    align: 'center',
    weight: 800,
  });
  if (pulse > 0 && active) {
    g.strokeStyle = rgba(C.violet, pulse * 0.8);
    g.lineWidth = 3;
    rr(g, r.x - 2, r.y - 2, r.w + 4, r.h + 4, R.md + 2);
    g.stroke();
  }
}

/**
 * Incoming-letter flights (brief 5).
 *
 * Each tile travels from where it actually came from — the bag, or a carrier
 * dying on the battlefield — into the socket it was routed to. This is the
 * mechanic the whole rework exists for: the player can answer "where did that
 * letter go?" by watching, instead of reading a panel.
 */
function letterFlights(g: Ctx, flights: readonly HudFlight[]): void {
  for (const f of flights) {
    const e = clamp(f.t / LETTER_FLIGHT, 0, 1);
    if (e >= 1) continue;
    const ease = easeOut(e);
    const x = f.fromX + (f.toX - f.fromX) * ease;
    // A short arc, so a tile crossing the screen reads as thrown rather than
    // pasted.
    const y = f.fromY + (f.toY - f.fromY) * ease - Math.sin(ease * Math.PI) * 54;
    const size = clamp(f.size * (0.72 + ease * 0.28), 20, 60);
    tile(g, x - size / 2, y - size / 2, size, f.char, 'filled', {
      alpha: 0.4 + ease * 0.6,
      glow: ease > 0.75 ? C.gold : undefined,
    });
  }
}

function controlButton(
  g: Ctx,
  ui: Ui,
  id: string,
  rect: Rect,
  text: string,
  tone: string,
  tooltip: string,
): void {
  const hit = ui.hit(id, rect, { tooltip });
  g.fillStyle = hit.hover ? rgba(tone, 0.26) : rgba(tone, 0.1);
  rr(g, rect.x, rect.y, rect.w, rect.h, rect.h / 2);
  g.fill();
  g.strokeStyle = rgba(tone, hit.hover ? 0.85 : 0.45);
  g.lineWidth = W.thin;
  rr(g, rect.x + 1, rect.y + 1, rect.w - 2, rect.h - 2, rect.h / 2);
  g.stroke();
  label(g, text, rect.x + rect.w / 2, rect.y + rect.h / 2 + 6, {
    size: T.small,
    color: C.ink,
    align: 'center',
    weight: 800,
  });
}

export interface HudInteraction {
  wildcardMode: boolean;
  eligible: number[];
  hoveredSlot: number | null;
}

export interface HudOptions {
  time: number;
  wildcardMode: boolean;
  eligible: number[];
  hoveredSlot: number | null;
  speed: number;
  chainActive: boolean;
  chainPulse: number;
  waveIndex: number;
  waveTotal: number;
  /** Short contextual hint; null hides the strip entirely. */
  hint: string | null;
  /** Teaching hint is emphasised and stays longer. */
  hintEmphasis: boolean;
  /** What the current hint points at, so the lesson is anchored to the UI. */
  hintTarget?: 'pool' | 'recipes' | 'carriers' | 'wildcard' | null;
  /** Tiles currently travelling into sockets, drawn over the cards. */
  flights?: readonly HudFlight[];
}

export function drawHud(g: Ctx, ui: Ui, battle: Battle, opts: HudOptions): void {
  const inter: HudInteraction = {
    wildcardMode: opts.wildcardMode,
    eligible: opts.eligible,
    hoveredSlot: opts.hoveredSlot,
  };

  // Deck bed so the control panel reads as part of the machine.
  const deckGrad = g.createLinearGradient(0, DECK.top - 26, 0, DECK.top + 60);
  deckGrad.addColorStop(0, rgba('#05070e', 0));
  deckGrad.addColorStop(1, rgba('#05070e', 0.94));
  g.fillStyle = deckGrad;
  g.fillRect(0, DECK.top - 26, 1440, 90);
  g.fillStyle = '#080c16';
  g.fillRect(0, DECK.top + 64, 1440, 810 - DECK.top - 64);
  g.strokeStyle = rgba(C.lineHi, 0.35);
  g.lineWidth = W.hair;
  g.beginPath();
  g.moveTo(0, DECK.top + 64);
  g.lineTo(1440, DECK.top + 64);
  g.stroke();

  label(g, H.recipes, CARD.x, DECK.top + 14, {
    size: T.micro,
    color: C.faint,
    weight: 800,
    tracking: 2.4,
  });

  for (let slot = 0; slot < 3; slot++) {
    blueprintCard(g, battle, battle.slots[slot], slot, opts.time, inter);
  }
  incomingPanel(g, battle);
  bagBox(g, battle, opts.time);
  reserveTray(g, battle, opts.time);
  wildcard(g, ui, battle, opts.time, inter);
  encounterStrip(g, battle, opts.waveIndex, opts.waveTotal);
  chainBox(g, battle, battle.chain >= 2 && opts.chainActive, opts.chainPulse);
  if (opts.flights && opts.flights.length > 0) letterFlights(g, opts.flights);

  // Controls: speed and pause, plus the run's position.
  plate(g, CONTROLS.x, CONTROLS.y, CONTROLS.w, CONTROLS.h, {
    radius: R.pill,
    fill: '#161f34',
    edge: C.lineHi,
    depth: 3,
  });
  controlButton(g, ui, 'hud.speed', { x: CONTROLS.x + 6, y: CONTROLS.y + 6, w: 78, h: 32 }, `${opts.speed}×`, C.cyan, H.speedTip);
  controlButton(g, ui, 'hud.help', { x: CONTROLS.x + 90, y: CONTROLS.y + 6, w: 44, h: 32 }, '?', C.mint, t('howTo'));
  controlButton(g, ui, 'hud.pause', { x: CONTROLS.x + 140, y: CONTROLS.y + 6, w: 50, h: 32 }, 'II', C.gold, H.pauseTip);

  if (opts.hint && opts.hintTarget) {
    // Spotlight the element the hint is talking about. A ring around the real
    // panel teaches far better than a line of text floating on its own.
    const target: Rect | null =
      opts.hintTarget === 'pool'
        ? TRAY
        : opts.hintTarget === 'recipes'
          ? { x: CARD.x, y: CARD.y, w: CARD.w * 3 + CARD.gap * 2, h: CARD.h }
          : opts.hintTarget === 'wildcard'
            ? WILD_RECT
            : null;
    if (target) {
      const pulse = 0.5 + Math.sin(opts.time * 4) * 0.5;
      g.save();
      g.strokeStyle = rgba(C.gold, 0.35 + pulse * 0.45);
      g.lineWidth = 3;
      rr(g, target.x - 6, target.y - 6, target.w + 12, target.h + 12, R.md + 6);
      g.stroke();
      // A soft halo, so the eye is pulled without the panel being obscured.
      const halo = g.createRadialGradient(
        target.x + target.w / 2,
        target.y + target.h / 2,
        Math.min(target.w, target.h) * 0.3,
        target.x + target.w / 2,
        target.y + target.h / 2,
        Math.max(target.w, target.h) * 0.62,
      );
      halo.addColorStop(0, rgba(C.gold, 0.09 + pulse * 0.06));
      halo.addColorStop(1, rgba(C.gold, 0));
      g.fillStyle = halo;
      rr(g, target.x - 30, target.y - 30, target.w + 60, target.h + 60, R.lg);
      g.fill();
      g.restore();
    }
  }
  if (opts.hint) {
    const a = opts.hintEmphasis ? 1 : 0.92;
    g.save();
    g.globalAlpha = a;
    plate(g, HINT.x, HINT.y, HINT.w, HINT.h, {
      radius: R.sm,
      fill: '#101a30',
      edge: rgba(C.cyan, 0.55),
      depth: 3,
    });
    label(g, opts.hint, HINT.x + 16, HINT.y + 25, {
      size: T.small,
      color: C.ink,
      weight: 600,
    });
    g.restore();
  }
}
