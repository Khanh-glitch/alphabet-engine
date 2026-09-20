/** Market: spend salvage on letters and permanent upgrades. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, icon, mix, panel, rr, slab, text, wrapLines } from '../../core/draw';
import { clamp } from '../../core/rng';
import { sfx } from '../../core/audio';
import { button, chip, heading } from '../kit';
import { buyOffer, rollOffers, saveRun, type Offer } from '../../game/run';
import type { App, Screen } from '../../app';

export function createMarketScreen(): Screen {
  let offers: Offer[] = [];
  let message = '';
  let messageT = 0;
  let t = 0;
  let app!: App;

  const buy = (id: string): void => {
    const run = app.run;
    if (!run) return;
    const offer = offers.find((o) => o.id === id);
    if (!offer) return;
    if (offer.bought >= offer.max) {
      sfx.reject();
      message = 'Already at maximum';
      messageT = 2.4;
      return;
    }
    const res = buyOffer(run, offer);
    if (!res.ok) {
      sfx.reject();
      message = res.message;
      messageT = 2.4;
      return;
    }
    offer.bought++;
    sfx.coin();
    message = res.message;
    messageT = 2.4;
    saveRun(run);
  };

  return {
    id: 'market',
    enter(a) {
      app = a;
      t = 0;
      message = '';
      const run = a.run;
      offers = run ? rollOffers(run) : [];
    },
    update(dt) {
      t += dt;
      if (messageT > 0) messageT -= dt;
    },
    click(id) {
      if (id.startsWith('buy:')) buy(id.slice(4));
      else if (id === 'leave') {
        const run = app.run;
        if (run) saveRun(run);
        sfx.uiBack();
        app.goto('forge');
      }
    },
    key(e) {
      if (e.key === 'Escape' || e.key === 'Enter') {
        sfx.uiBack();
        app.goto('forge');
        return true;
      }
      return false;
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      if (!run) return;

      g.fillStyle = '#080a12';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, 200, 120, 520, C.gold, 0.07);
      blob(g, SIZE.w - 220, SIZE.h - 120, 460, C.cyan, 0.05);

      heading(g, 'Market', 60, 62, { size: 34, sub: 'Letters and upgrades, paid for in salvage.' });
      icon(g, 'coin', SIZE.w - 210, 52, 22, C.gold, true);
      text(g, `${run.salvage}`, SIZE.w - 194, 52, {
        size: 26,
        weight: 700,
        color: C.gold,
        font: F.num,
        baseline: 'middle',
      });
      text(g, 'SALVAGE', SIZE.w - 194, 74, {
        size: T.micro,
        weight: 700,
        color: C.faint,
        font: F.num,
        baseline: 'middle',
        track: 1.6,
      });

      // rack preview panel
      const rackBox = { x: 60, y: 120, w: 300, h: 560 };
      panel(g, rackBox.x, rackBox.y, rackBox.w, rackBox.h, {
        fill: C.bg1,
        stroke: C.line,
        r: R.lg,
        top: 'rgba(255,255,255,0.03)',
      });
      text(g, 'YOUR RACK', rackBox.x + 18, rackBox.y + 26, {
        size: T.tiny,
        weight: 700,
        color: C.dim,
        font: F.num,
        baseline: 'middle',
        track: 1.6,
      });
      const tile = 34;
      const gap = 7;
      const perRow = Math.floor((rackBox.w - 36 + gap) / (tile + gap));
      run.rack.forEach((l, i) => {
        const col = i % perRow;
        const row = Math.floor(i / perRow);
        const x = rackBox.x + 18 + col * (tile + gap) + tile / 2;
        const y = rackBox.y + 56 + row * (tile + gap);
        slab(g, l.ch.toUpperCase(), x, y, tile, {
          fill: 'aeioulmnrst'.includes(l.ch) ? C.bg2 : mix(C.bg2, C.ember, 0.12),
          ink: C.ink,
          r: 8,
          lift: false,
        });
      });
      if (!run.rack.length) {
        text(g, 'Empty', rackBox.x + 18, rackBox.y + 60, {
          size: T.small,
          weight: 500,
          color: C.faint,
          font: F.ui,
          baseline: 'middle',
        });
      }

      let sy = rackBox.y + 400;
      const stats: [string, string][] = [
        ['Rack size', `${run.rackSize + Math.round(run.boons.rackSize)}`],
        ['Damage', `+${Math.round(run.boons.damage * 100)}%`],
        ['Fire rate', `+${Math.round(run.boons.rate * 100)}%`],
        ['Range', `+${Math.round(run.boons.range)}`],
        ['Charge rate', `+${Math.round(run.boons.fluxGain * 100)}%`],
        ['Salvage', `+${Math.round(run.boons.salvage * 100)}%`],
        ['Slots per lane', `${run.slotsPerLane}`],
        ['Boons', `${run.blessings.length}`],
      ];
      for (const [k, v] of stats) {
        text(g, k.toUpperCase(), rackBox.x + 18, sy, {
          size: T.micro,
          weight: 700,
          color: C.faint,
          font: F.num,
          baseline: 'middle',
          track: 1,
        });
        text(g, v, rackBox.x + rackBox.w - 18, sy, {
          size: T.tiny,
          weight: 700,
          color: C.ink,
          font: F.num,
          align: 'right',
          baseline: 'middle',
        });
        sy += 22;
      }

      // offers
      const gx = 400;
      const gw = SIZE.w - gx - 60;
      const cols = 4;
      const cw = (gw - (cols - 1) * 16) / cols;
      const chh = 232;
      offers.forEach((offer, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = gx + col * (cw + 16);
        const y = 120 + row * (chh + 16);
        const maxed = offer.bought >= offer.max;
        const cost = Math.max(1, Math.round(offer.cost * (1 - run.boons.discount * 0.35)));
        const affordable = run.salvage >= cost && !maxed;
        const id = `offer:${offer.id}`;
        const hv = app.kit.hoverAmt(id);
        const tint = offer.kind === 'letter' ? C.cyan : offer.kind === 'pack' ? C.violet : C.gold;

        panel(g, x, y, cw, chh, {
          fill: mix(C.bg1, tint, 0.04 + hv * 0.05),
          stroke: alpha(tint, maxed ? 0.2 : 0.35 + hv * 0.4),
          r: R.lg,
          shadow: hv * 20,
          shadowColor: alpha(tint, 0.3),
          top: alpha(tint, 0.06),
        });

        // header
        rr(g, x + 16, y + 16, 44, 44, R.md);
        g.fillStyle = alpha(tint, maxed ? 0.06 : 0.14);
        g.fill();
        if (offer.kind === 'letter' && offer.payload) {
          slab(g, offer.payload.toUpperCase(), x + 38, y + 38, 34, {
            fill: mix(C.bg2, tint, 0.3),
            ink: C.ink,
            r: 8,
            lift: false,
          });
        } else {
          icon(g, offer.kind === 'pack' ? 'flask' : 'anvil', x + 38, y + 38, 22, maxed ? C.faint : tint, true);
        }
        text(g, offer.name.toUpperCase(), x + 70, y + 30, {
          size: T.small,
          weight: 700,
          color: maxed ? C.faint : C.ink,
          font: F.ui,
          baseline: 'middle',
          track: 0.8,
          max: cw - 86,
        });
        text(g, maxed ? 'MAXED' : offer.kind.toUpperCase(), x + 70, y + 48, {
          size: T.micro,
          weight: 700,
          color: maxed ? C.faint : alpha(tint, 0.9),
          font: F.num,
          baseline: 'middle',
          track: 1.2,
        });

        const lines = wrapLines(g, offer.blurb, cw - 32, { size: T.small, weight: 500, font: F.ui });
        lines.slice(0, 3).forEach((line, li) => {
          text(g, line, x + 16, y + 90 + li * 18, {
            size: T.small,
            weight: 500,
            color: C.dim,
            font: F.ui,
            baseline: 'middle',
          });
        });

        const canLabel = maxed ? 'MAX' : `${cost}`;
        button(g, app.kit, {
          id: `buy:${offer.id}`,
          x: x + 16,
          y: y + chh - 60,
          w: cw - 32,
          h: 44,
          label: maxed ? 'MAXED' : `BUY  ${canLabel}`,
          icon: maxed ? 'check' : 'coin',
          tone: maxed ? 'ghost' : affordable ? 'primary' : 'secondary',
          size: T.small,
          disabled: maxed || !affordable,
          tip: affordable
            ? undefined
            : { lines: [{ text: maxed ? 'Already at maximum.' : `You need ${cost - run.salvage} more salvage.` }] },
        });
        if (offer.max < 90 && !maxed) {
          text(g, `${offer.bought}/${offer.max}`, x + cw - 18, y + 30, {
            size: T.micro,
            weight: 700,
            color: C.faint,
            font: F.num,
            align: 'right',
            baseline: 'middle',
          });
        }
      });

      // footer
      if (messageT > 0) {
        const w = 320;
        panel(g, SIZE.w / 2 - w / 2, SIZE.h - 96, w, 40, {
          fill: alpha(C.ink, 0.06),
          stroke: alpha(C.gold, 0.4),
          r: R.md,
        });
        text(g, message, SIZE.w / 2, SIZE.h - 76, {
          size: T.small,
          weight: 700,
          color: C.gold,
          font: F.ui,
          align: 'center',
          baseline: 'middle',
          alpha: clamp(messageT, 0, 1),
        });
      }
      button(g, app.kit, {
        id: 'leave',
        x: SIZE.w - 300,
        y: SIZE.h - 88,
        w: 240,
        h: 54,
        label: 'BACK TO FORGE',
        icon: 'arrow',
        tone: 'secondary',
        size: T.body,
      });
      chip(g, {
        x: 60,
        y: SIZE.h - 78,
        label: 'Purchases are permanent for this run',
        color: C.faint,
        size: T.tiny,
      });
      void t;
    },
  };
}
