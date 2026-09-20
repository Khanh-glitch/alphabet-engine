/**
 * "How to play" overlay.
 *
 * The loop is unusual — nobody has played an autobattler where the ammunition is
 * a spelling economy — so the game has to teach four things before it can be
 * enjoyed, in this order:
 *
 *   1. letters arrive on their own (the player has no input here),
 *   2. a full recipe turns into an object that fights by itself,
 *   3. killing carriers is how the line is fed,
 *   4. the wildcard is the player's only in-combat decision.
 *
 * It is drawn on the same letterpress primitives as the rest of the game, so the
 * explanation looks like the thing it is explaining.
 */
import { C, R, T, VIEW } from '../../core/theme';
import { H } from '../../core/strings';
import { t, type Strings } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { glow, label, plate, rgba, rr, tile, well, type Ctx, type Rect } from '../../core/draw';
import type { Screen } from '../../app/app';

const PANEL = { w: 1000, h: 612 };

interface Step {
  n: string;
  /** Resolved at draw time, so switching language re-labels the open panel. */
  titleKey: keyof Strings;
  bodyKey: keyof Strings;
  tone: string;
  draw: (g: Ctx, r: Rect, time: number, tone: string) => void;
}

/** Step 1 art: the bag drops a tile into the pool, on a loop. */
function artFeed(g: Ctx, r: Rect, time: number, tone: string): void {
  const wellH = 26;
  const wellY = r.y + r.h - wellH;
  const tileSize = 30;
  const landY = wellY - tileSize + 4;
  const fall = (time * 0.6) % 1;
  const y = r.y + 2 + fall * (landY - r.y - 2);

  // Bag: a hopper the tiles come out of.
  g.fillStyle = '#0b1220';
  g.beginPath();
  g.moveTo(r.x + 18, r.y);
  g.lineTo(r.x + 74, r.y);
  g.lineTo(r.x + 64, r.y + 20);
  g.lineTo(r.x + 28, r.y + 20);
  g.closePath();
  g.fill();
  g.strokeStyle = rgba(C.lineHi, 0.6);
  g.lineWidth = 1.5;
  g.stroke();

  well(g, r.x, wellY, r.w, wellH, R.sm);
  const a = fall < 0.86 ? 1 : Math.max(0.2, 1 - (fall - 0.86) / 0.14);
  tile(g, r.x + r.w / 2 - tileSize / 2, y, tileSize, 'B', 'filled', { alpha: a });
  if (fall > 0.82) {
    g.strokeStyle = rgba(tone, 0.55 * ((fall - 0.82) / 0.18));
    g.lineWidth = 2;
    g.beginPath();
    g.arc(r.x + r.w / 2, wellY + 4, 12 + (fall - 0.82) * 120, 0, Math.PI * 2);
    g.stroke();
  }
  label(g, H.pool, r.x + r.w / 2, wellY + 18, {
    align: 'center',
    size: 11,
    color: C.faint,
    weight: 800,
    tracking: 1.6,
  });
}

/** Step 2 art: two filled slots and an empty one, then the object. */
function artCraft(g: Ctx, r: Rect, time: number, tone: string): void {
  const size = 32;
  const gap = 6;
  const word = ['B', 'O', 'M'];
  const total = word.length * size + (word.length - 1) * gap;
  const x0 = r.x + (r.w - total) / 2 - 18;
  // The recipe pulses: filled, filled, filling.
  const pulse = 0.5 + Math.sin(time * 3) * 0.5;
  word.forEach((ch, i) => {
    const filled = i < 2 || pulse > 0.45;
    tile(g, x0 + i * (size + gap), r.y + 22, size, filled ? ch : null, filled ? 'filled' : 'missing');
  });
  // Arrow to the object.
  g.strokeStyle = rgba(tone, 0.7);
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(x0 + total + 8, r.y + 38);
  g.lineTo(x0 + total + 34, r.y + 38);
  g.lineTo(x0 + total + 28, r.y + 33);
  g.moveTo(x0 + total + 34, r.y + 38);
  g.lineTo(x0 + total + 28, r.y + 43);
  g.stroke();
  const ox = x0 + total + 62;
  const bob = Math.sin(time * 2.4) * 2;
  g.fillStyle = '#05070e';
  g.beginPath();
  g.ellipse(ox, r.y + 56, 17, 5, 0, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = tone;
  g.beginPath();
  g.arc(ox, r.y + 40 + bob, 14, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = rgba('#ffffff', 0.35);
  g.lineWidth = 2;
  g.beginPath();
  g.arc(ox, r.y + 40 + bob, 14, Math.PI * 1.05, Math.PI * 1.85);
  g.stroke();
}

/** Step 3 art: a carrier dies and its letter flies into the pool. */
function artCarrier(g: Ctx, r: Rect, time: number, tone: string): void {
  const footY = r.y + r.h - 10;
  const loop = (time * 0.55) % 1;
  const ex = r.x + 34 + Math.sin(time * 1.2) * 6;

  // Ground line.
  g.strokeStyle = rgba(C.lineHi, 0.5);
  g.lineWidth = 1.5;
  g.beginPath();
  g.moveTo(r.x, footY);
  g.lineTo(r.x + r.w, footY);
  g.stroke();

  // The carrier: a crawler with a tile over its head.
  g.strokeStyle = '#0a0f1c';
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  for (let i = 0; i < 3; i++) {
    const px = ex - 11 + i * 11;
    const sw = Math.sin(time * 7 + i * 2.1) * 4;
    g.beginPath();
    g.moveTo(px, footY - 14);
    g.lineTo(px + sw, footY);
    g.stroke();
  }
  g.fillStyle = '#c3cee6';
  g.beginPath();
  g.moveTo(ex - 17, footY - 13);
  g.quadraticCurveTo(ex - 19, footY - 36, ex, footY - 38);
  g.quadraticCurveTo(ex + 19, footY - 36, ex + 17, footY - 13);
  g.closePath();
  g.fill();
  g.fillStyle = C.cyan;
  g.beginPath();
  g.arc(ex - 9, footY - 24, 2.6, 0, Math.PI * 2);
  g.fill();
  tile(g, ex - 14, r.y + 2, 28, 'W', 'filled', { glow: C.gold, alpha: loop < 0.45 ? 1 : 0 });

  // The pool it flies into.
  const poolW = 78;
  const poolX = r.x + r.w - poolW;
  well(g, poolX, footY - 24, poolW, 24, R.sm);
  label(g, H.pool, poolX + poolW / 2, footY - 8, {
    align: 'center',
    size: 11,
    color: C.faint,
    weight: 800,
    tracking: 1.4,
  });

  // The recovered letter arcing across, with the trail it came from.
  if (loop > 0.45) {
    const fly = (loop - 0.45) / 0.55;
    const fromX = ex;
    const fromY = r.y + 2;
    const toX = poolX + poolW / 2 - 13;
    const toY = footY - 34;
    const fx = fromX + (toX - fromX) * fly;
    const fy = fromY + (toY - fromY) * fly - Math.sin(fly * Math.PI) * 24;
    g.strokeStyle = rgba(tone, 0.3 * (1 - fly));
    g.lineWidth = 2;
    g.setLineDash([5, 5]);
    g.beginPath();
    g.moveTo(fromX, fromY + 14);
    g.quadraticCurveTo((fromX + toX) / 2, r.y - 6, fx, fy + 13);
    g.stroke();
    g.setLineDash([]);
    tile(g, fx, fy, 26, 'W', 'filled', { alpha: Math.max(0.25, 1 - fly * 0.3) });
  }
}

/** Step 4 art: the wildcard sitting on the empty slot of a recipe. */
function artWildcard(g: Ctx, r: Rect, time: number, tone: string): void {
  const size = 32;
  const gap = 6;
  const word = ['B', 'O', 'M', 'B'];
  const total = word.length * size + (word.length - 1) * gap;
  const x0 = r.x + (r.w - total) / 2;
  const slot = 3;
  const pulse = 0.5 + Math.sin(time * 4) * 0.5;
  word.forEach((ch, i) => {
    if (i === slot) {
      glow(g, x0 + i * (size + gap) + size / 2, r.y + 34, 30 + pulse * 6, tone, 0.35);
      tile(g, x0 + i * (size + gap), r.y + 18, size, '?', 'wild', { glow: tone });
    } else {
      tile(g, x0 + i * (size + gap), r.y + 18, size, ch, 'filled', { alpha: 0.5 });
    }
  });
  label(g, H.wildcard, r.x + r.w / 2, r.y + 74, {
    align: 'center',
    size: 11,
    color: tone,
    weight: 800,
    tracking: 1.6,
  });
}

export function createHowToScreen(onClose?: () => void): Screen {
  const steps: Step[] = [
    {
      n: '1',
      titleKey: 'how1Title',
      bodyKey: 'how1Body',
      tone: C.cyan,
      draw: artFeed,
    },
    {
      n: '2',
      titleKey: 'how2Title',
      bodyKey: 'how2Body',
      tone: C.gold,
      draw: artCraft,
    },
    {
      n: '3',
      titleKey: 'how3Title',
      bodyKey: 'how3Body',
      tone: C.mint,
      draw: artCarrier,
    },
    {
      n: '4',
      titleKey: 'how4Title',
      bodyKey: 'how4Body',
      tone: C.violet,
      draw: artWildcard,
    },
  ];

  return {
    id: 'howto',
    enter() {
      sfx.ui();
    },
    draw(g, app) {
      const time = performance.now() / 1000;
      const x = VIEW.w / 2 - PANEL.w / 2;
      const y = VIEW.h / 2 - PANEL.h / 2;

      plate(g, x, y, PANEL.w, PANEL.h, { radius: R.lg, fill: '#111a2c', edge: C.lineHi, depth: 10 });
      label(g, t('howTitle'), x + 40, y + 56, { size: 34, color: C.ink, weight: 800, tracking: 3 });
      label(g, t('howSubtitle'), x + 40, y + 86, { size: T.small, color: C.dim, weight: 600 });

      // Goal statement: what winning actually means.
      plate(g, x + PANEL.w - 400, y + 30, 360, 62, {
        radius: R.md,
        fill: '#0d1524',
        edge: rgba(C.ember, 0.5),
        depth: 4,
      });
      label(g, t('howGoal'), x + PANEL.w - 380, y + 54, { size: T.tiny, color: C.dim, weight: 700 });
      label(g, t('howGoalValue'), x + PANEL.w - 380, y + 78, { size: T.body, color: C.ember, weight: 800 });

      // Steps: two columns, two rows.
      const colW = (PANEL.w - 80 - 24) / 2;
      steps.forEach((step, i) => {
        const cx = x + 40 + (i % 2) * (colW + 24);
        const cy = y + 118 + Math.floor(i / 2) * 206;
        const card: Rect = { x: cx, y: cy, w: colW, h: 190 };
        plate(g, card.x, card.y, card.w, card.h, {
          radius: R.md,
          fill: '#0e1626',
          edge: rgba(step.tone, 0.42),
          depth: 5,
        });
        // Number badge.
        g.fillStyle = rgba(step.tone, 0.18);
        rr(g, card.x + 16, card.y + 16, 30, 30, 8);
        g.fill();
        label(g, step.n, card.x + 31, card.y + 36, {
          align: 'center',
          size: T.body,
          color: step.tone,
          weight: 800,
        });
        label(g, t(step.titleKey), card.x + 58, card.y + 38, {
          size: T.body,
          color: C.ink,
          weight: 800,
        });
        // Body copy, wrapped by hand: two lines at most by design.
        const words = t(step.bodyKey).split(' ');
        const lines: string[] = [];
        let line = '';
        g.save();
        g.font = `500 ${T.small}px Archivo, system-ui, sans-serif`;
        for (const w of words) {
          const test = line ? `${line} ${w}` : w;
          if (g.measureText(test).width > card.w - 44 && line) {
            lines.push(line);
            line = w;
          } else {
            line = test;
          }
        }
        if (line) lines.push(line);
        g.restore();
        lines.slice(0, 2).forEach((ln, li) => {
          label(g, ln, card.x + 22, card.y + 74 + li * 21, {
            size: T.small,
            color: C.dim,
            weight: 500,
          });
        });

        const artRect: Rect = { x: card.x + 22, y: card.y + card.h - 88, w: card.w - 44, h: 78 };
        g.save();
        rr(g, artRect.x, artRect.y, artRect.w, artRect.h, R.sm);
        g.clip();
        step.draw(g, artRect, time, step.tone);
        g.restore();
      });

      app.ui.button(g, 'howto.ok', { x: x + 40, y: y + PANEL.h - 74, w: 260, h: 50 }, {
        label: t('howOk'),
        tone: C.gold,
        fontSize: T.body,
      });
      label(g, t('howSkip'), x + 320, y + PANEL.h - 44, {
        size: T.small,
        color: C.faint,
        weight: 600,
      });
    },
    click(id, app) {
      if (id === 'howto.ok') {
        sfx.ui();
        if (onClose) onClose();
        else app.setOverlay(null);
      }
    },
  };
}

/** Convenience: the same panel opened from any screen as an overlay. */
export const openHowTo = (app: { setOverlay: (s: Screen | null) => void }): void => {
  app.setOverlay(createHowToScreen());
};
