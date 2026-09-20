/** Title screen. The first thing a player sees has to explain the game's idea. */


import { C, R, T, VIEW } from '../../core/theme';
import { chip, glow, label, plate, rgba, tile, type Ctx } from '../../core/draw';
import { loc, t } from '../../core/i18n';
import { H } from '../../core/strings';
import type { Screen } from '../../app/app';
import { BLUEPRINTS, STARTER_BLUEPRINTS } from '../../content/blueprints';

import { store } from '../../core/save';
import { createHowToScreen } from './howto';

/** A slowly assembling word — the whole game in one looping animation. */
const DEMO_WORD: (keyof typeof BLUEPRINTS)[] = ['BOMB', 'FIRE', 'OIL', 'WALL', 'BEE', 'FAN'];

function drawDemo(g: Ctx, time: number, cx: number, cy: number): void {
  const period = 3.4;
  const index = Math.floor(time / period) % DEMO_WORD.length;
  const local = (time % period) / period;
  const bp = BLUEPRINTS[DEMO_WORD[index]];
  const letters = bp.recipe;
  const size = 66;
  const gap = 8;
  const totalW = letters.length * size + (letters.length - 1) * gap;
  const startX = cx - totalW / 2;

  // letters gather, lock, then the object leaves
  const gather = Math.min(1, local / 0.4);
  const locked = local > 0.4 && local < 0.72;
  const leaving = local >= 0.72;
  const leaveT = leaving ? (local - 0.72) / 0.28 : 0;

  for (let i = 0; i < letters.length; i++) {
    const targetX = startX + i * (size + gap);
    const fromX = targetX + (i % 2 === 0 ? -220 : 220);
    const x = fromX + (targetX - fromX) * gather;
    const y = cy + Math.sin(gather * Math.PI + i) * -34 * (1 - gather);
    const press = locked || leaving ? 1 : 0;
    if (leaving && leaveT > 0.35) continue;
    tile(g, x, y, size, letters[i], locked || leaving ? 'lock' : 'filled', {
      press,
      glow: locked ? C.gold : undefined,
      alpha: leaving ? 1 - leaveT : 1,
    });
  }

  // The object that emerges from the word
  if (leaving) {
    const e = Math.min(1, leaveT * 2.4);
    const ox = cx - totalW / 2 - 40 + e * -140;
    const oy = cy + 40 + e * 30;
    g.save();
    g.globalAlpha = 1 - Math.max(0, (leaveT - 0.6) / 0.4);
    glow(g, ox + 40, oy, 58, bp.color, 0.4 * e);
    g.fillStyle = bp.color;
    g.beginPath();
    g.arc(ox + 40, oy, 22 * e, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }

  label(g, bp.word, cx, cy + 84, {
    align: 'center',
    size: T.small,
    color: rgba(C.gold, locked || leaving ? 0.95 : 0.4),
    weight: 800,
    tracking: 6,
  });
  label(g, bp.name.vi.toUpperCase(), cx, cy + 106, {
    align: 'center',
    size: T.micro,
    color: C.faint,
    weight: 700,
    tracking: 2,
  });
}

export function createTitleScreen(): Screen {
  let time = 0;

  return {
    id: 'title',
    enter(app) {
      time = 0;
      // First launch: teach the loop before the player has to make a decision.
      if (!store.settings.seenHowto) {
        store.settings.seenHowto = true;
        store.saveSettings();
        app.setOverlay(createHowToScreen(() => app.setOverlay(null)));
      }
    },
    update(dt) {
      time += dt;
    },
    draw(g, app) {
      // Bed
      const grad = g.createLinearGradient(0, 0, 0, VIEW.h);
      grad.addColorStop(0, '#070b14');
      grad.addColorStop(0.6, '#0b1120');
      grad.addColorStop(1, '#070a12');
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW.w, VIEW.h);

      // Faint machinery grid
      g.strokeStyle = rgba(C.line, 0.22);
      g.lineWidth = 1;
      for (let x = 0; x < VIEW.w; x += 72) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, VIEW.h);
        g.stroke();
      }
      for (let y = 0; y < VIEW.h; y += 72) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(VIEW.w, y);
        g.stroke();
      }

      // Title block
      const lx = 120;
      label(g, 'ALPHABET', lx, 250, { size: 86, color: C.ink, weight: 800, tracking: 2 });
      label(g, 'ENGINE', lx, 336, { size: 86, color: C.gold, weight: 800, tracking: 2 });
      g.strokeStyle = rgba(C.gold, 0.5);
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(lx, 366);
      g.lineTo(lx + 430, 366);
      g.stroke();
      label(g, t('gameTagline'), lx, 404, { size: T.lead, color: C.dim, weight: 500 });
      label(g, t('navHint'), lx, 740, { size: T.micro, color: rgba(C.faint, 0.8), weight: 600 });

      // Three pillars, stated once, plainly.
      const pillars: [string, string, string][] = [
        [H.bag.toUpperCase(), t('legendBag'), C.cyan],
        [H.recipes, t('legendBlueprint'), C.gold],
        [t('codexRules'), t('legendRule'), C.violet],
      ];
      pillars.forEach(([title, sub, tone], i) => {
        const y = 452 + i * 58;
        chip(g, lx, y, title, tone as string, { font: T.tiny });
        label(g, sub, lx + 128, y + 18, { size: T.small, color: C.dim, weight: 500 });
      });

      drawDemo(g, time, 1040, 328);

      // Buttons
      const bx = 120;
      const bw = 330;
      const bh = 54;
      let by = 610;
      const hasRun = !!store.suspendedRun;
      if (hasRun) {
        app.ui.button(g, 'title.continue', { x: bx, y: by, w: bw, h: bh }, {
          label: t('continueRun'),
          tone: C.mint,
          fontSize: T.body,
        });
        by += 64;
      }
      app.ui.button(g, 'title.new', { x: bx, y: by, w: bw, h: bh }, {
        label: t('newRun'),
        tone: C.gold,
        fontSize: T.body,
      });
      by += 64;
      app.ui.button(g, 'title.codex', { x: bx, y: by, w: bw / 2 - 6, h: 46 }, {
        label: t('codex'),
        variant: 'ghost',
        tone: C.cyan,
      });
      app.ui.button(g, 'title.settings', { x: bx + bw / 2 + 6, y: by, w: bw / 2 - 6, h: 46 }, {
        label: t('settings'),
        variant: 'ghost',
        tone: C.violet,
      });
      by += 56;
      app.ui.button(g, 'title.howto', { x: bx, y: by, w: bw, h: 46 }, {
        label: t('howTo'),
        variant: 'ghost',
        tone: C.gold,
      });

      // Starter set strip: the vocabulary the player will actually use
      label(g, t('starterSet'), 890, 574, {
        size: T.micro,
        color: C.faint,
        weight: 800,
        tracking: 2.4,
      });
      STARTER_BLUEPRINTS.forEach((bp, i) => {
        const x = 890 + (i % 3) * 124;
        const y = 592 + Math.floor(i / 3) * 80;
        plate(g, x, y, 104, 66, { radius: R.sm, fill: '#131b2e', edge: rgba(bp.color, 0.5), depth: 4 });
        label(g, bp.word, x + 52, y + 28, { align: 'center', size: T.tiny, color: C.ink, weight: 800, tracking: 1.6 });
        label(g, loc(bp.name), x + 52, y + 50, { align: 'center', size: 11, color: bp.color, weight: 700 });
      });

    },
    click(id, app) {
      if (id === 'title.howto') app.setOverlay(createHowToScreen(() => app.setOverlay(null)));
      else if (id === 'title.new') app.goto('kit');
      else if (id === 'title.continue') app.goto('battle', { keepOverlay: false });
      else if (id === 'title.codex') app.goto('codex');
      else if (id === 'title.settings') app.goto('settings');
    },
  };
}
