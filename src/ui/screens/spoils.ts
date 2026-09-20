/** After a wave: results, then the choice of what comes next. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, icon, mix, panel, rr, text, wrapLines, type IconName } from '../../core/draw';
import { clamp, easeOut } from '../../core/rng';
import { sfx } from '../../core/audio';
import { button, chip } from '../kit';
import { RARE, addLetter, previewWave, rngOf, saveRun, type NodeKind, type RunState } from '../../game/run';
import type { App, Screen } from '../../app';

interface Choice {
  kind: NodeKind;
  name: string;
  blurb: string;
  detail: string;
  icon: IconName;
  color: string;
}

const CHOICES: Record<NodeKind, Choice> = {
  battle: {
    kind: 'battle',
    name: 'Front',
    blurb: 'Push straight into the next assault.',
    detail: '+10% salvage this wave',
    icon: 'sword',
    color: C.ink,
  },
  elite: {
    kind: 'elite',
    name: 'Elite Front',
    blurb: 'A heavier, deadlier wave - and a far better prize.',
    detail: '+60% salvage  ·  +1 rare letter',
    icon: 'skull',
    color: C.blood,
  },
  market: {
    kind: 'market',
    name: 'Market',
    blurb: 'Trade salvage for letters and permanent upgrades.',
    detail: 'Spend salvage',
    icon: 'coin',
    color: C.gold,
  },
  shrine: {
    kind: 'shrine',
    name: 'Shrine',
    blurb: 'Take one lasting blessing.',
    detail: 'Pick 1 of 3 boons',
    icon: 'star',
    color: C.violet,
  },
  rest: {
    kind: 'rest',
    name: 'Repair Bay',
    blurb: 'Weld the core back together.',
    detail: 'Restore 22 core',
    icon: 'shield',
    color: C.lime,
  },
  supply: {
    kind: 'supply',
    name: 'Supply Drop',
    blurb: 'Extra letters and salvage for the road.',
    detail: '+3 letters  ·  +20 salvage',
    icon: 'flask',
    color: C.cyan,
  },
};

export function createSpoilsScreen(): Screen {
  let offers: Choice[] = [];
  let t = 0;
  let app!: App;

  const roll = (run: RunState): Choice[] => {
    const rng = rngOf(run);
    const pool: NodeKind[] = ['battle', 'battle', 'market', 'shrine', 'rest', 'supply'];
    if (run.wave >= 3) pool.push('elite');
    if (run.wave >= 6) pool.push('elite');
    const kinds = rng.shuffle(pool.slice());
    const picked: NodeKind[] = [];
    for (const k of kinds) {
      if (picked.length >= 3) break;
      if (picked.includes(k)) continue;
      picked.push(k);
    }
    while (picked.length < 3) picked.push('battle');
    return picked.map((k) => ({ ...CHOICES[k], detail: CHOICES[k].detail }));
  };

  const resolve = (kind: NodeKind): void => {
    const run = app.run;
    if (!run) return;
    sfx.ui();
    switch (kind) {
      case 'battle':
        run.salvageBonus += 0.1;
        app.goto('forge');
        break;
      case 'elite': {
        run.eliteNext = true;
        const rng = rngOf(run);
        const picks = rng.sample(RARE, 1);
        for (const ch of picks) addLetter(run, ch);
        saveRun(run);
        app.toast(`Elite front  ·  gained ${picks.join(' ').toUpperCase()}`, C.blood);
        app.goto('forge');
        break;
      }
      case 'market':
        app.goto('market');
        break;
      case 'shrine':
        app.goto('shrine');
        break;
      case 'rest':
        run.core = Math.min(run.maxCore, run.core + 22);
        saveRun(run);
        app.toast('Core repaired +22', C.good);
        app.goto('forge');
        break;
      case 'supply': {
        const rng = rngOf(run);
        const letters = rng.sample(
          ['e', 'a', 's', 't', 'r', 'n', 'l', 'o', 'i', 'c', 'd', 'm', 'p', 'h', 'g', 'y', 'w', 'v', 'k'],
          3,
        );
        for (const ch of letters) addLetter(run, ch);
        run.salvage += 20;
        saveRun(run);
        app.toast(`Supply: +${letters.join(' ').toUpperCase()} and 20 salvage`, C.cyan);
        app.goto('forge');
        break;
      }
    }
  };

  return {
    id: 'spoils',
    enter(a) {
      app = a;
      t = 0;
      const run = a.run;
      if (run) offers = roll(run).slice(0, 3);
    },
    update(dt) {
      t += dt;
    },
    click(id) {
      if (id.startsWith('node-btn:')) resolve(id.slice(9) as NodeKind);
      else if (id.startsWith('node:')) resolve(id.slice(5) as NodeKind);
    },
    key(e) {
      if (e.key === '1' && offers[0]) resolve(offers[0].kind);
      if (e.key === '2' && offers[1]) resolve(offers[1].kind);
      if (e.key === '3' && offers[2]) resolve(offers[2].kind);
      return false;
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      if (!run) return;
      const last = run.history[run.history.length - 1];
      const wave = previewWave(run);

      g.fillStyle = '#080a12';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, 240, 140, 540, C.gold, 0.07);
      blob(g, SIZE.w - 200, SIZE.h - 160, 480, C.violet, 0.06);

      const p = easeOut(clamp(t / 0.5, 0, 1));

      // title
      g.save();
      g.globalAlpha = p;
      text(g, `WAVE ${last ? last.wave : run.wave - 1} CLEARED`, 60, 76, {
        size: 40,
        weight: 700,
        color: C.ink,
        font: F.ui,
        baseline: 'middle',
        track: 3,
      });
      text(
        g,
        run.victory ? 'THE ENGINE HOLDS - RUN COMPLETE' : 'Choose what the next push looks like',
        62,
        112,
        {
          size: T.small,
          weight: 500,
          color: run.victory ? C.gold : C.dim,
          font: F.ui,
          baseline: 'middle',
          track: 0.4,
        },
      );
      g.restore();

      // results strip
      const sx = 60;
      const sy = 150;
      const results: [string, string, string, IconName][] = [
        ['Core left', `${Math.max(0, Math.round(run.core))}`, run.core / run.maxCore < 0.4 ? C.bad : C.good, 'heart'],
        ['Killed', `${last?.killed ?? 0}`, C.ink, 'skull'],
        ['Best cascade', `x${last?.cascade ?? 0}`, C.violet, 'bolt'],
        ['Salvage', `${run.salvage}`, C.gold, 'coin'],
        ['Rocked up', `${run.placed.length} weapons`, C.cyan, 'anvil'],
      ];
      let rx = sx;
      for (const [label, value, color, ic] of results) {
        const w = 172;
        panel(g, rx, sy, w, 74, { fill: C.bg1, stroke: alpha(C.line, 0.8), r: R.md });
        icon(g, ic, rx + 24, sy + 26, 18, color, true);
        text(g, label.toUpperCase(), rx + 42, sy + 26, {
          size: T.micro,
          weight: 700,
          color: C.faint,
          font: F.num,
          baseline: 'middle',
          track: 1.1,
        });
        text(g, value, rx + 18, sy + 52, {
          size: T.lead,
          weight: 700,
          color,
          font: F.num,
          baseline: 'middle',
          track: 0.6,
        });
        rx += w + 12;
      }

      // node cards
      text(g, 'CHOOSE YOUR PATH', sx, 268, {
        size: T.tiny,
        weight: 700,
        color: C.faint,
        font: F.num,
        baseline: 'middle',
        track: 3.2,
      });

      const cw = 420;
      const chh = 300;
      const gap = 24;
      const totalW = cw * 3 + gap * 2;
      const cx0 = (SIZE.w - totalW) / 2;
      offers.forEach((choice, i) => {
        const x = cx0 + i * (cw + gap);
        const y = 300;
        const id = `node:${choice.kind}`;
        const hv = app.kit.hoverAmt(id);
        g.save();
        g.globalAlpha = clamp((t - 0.15 - i * 0.08) / 0.4, 0, 1);
        panel(g, x, y, cw, chh, {
          fill: mix(C.bg1, choice.color, 0.04 + hv * 0.05),
          stroke: alpha(choice.color, 0.3 + hv * 0.5),
          r: R.lg,
          shadow: hv * 24,
          shadowColor: alpha(choice.color, 0.35),
          top: alpha(choice.color, 0.07),
        });
        app.kit.hot({ id, x, y, w: cw, h: chh });

        // icon plaque
        rr(g, x + 24, y + 24, 56, 56, R.md);
        g.fillStyle = alpha(choice.color, 0.14);
        g.fill();
        icon(g, choice.icon, x + 52, y + 52, 26, choice.color, true);

        text(g, choice.name.toUpperCase(), x + 96, y + 52, {
          size: T.head,
          weight: 700,
          color: C.ink,
          font: F.ui,
          baseline: 'middle',
          track: 2,
        });

        const blurbLines = wrapLines(g, choice.blurb, cw - 48, { size: T.body, weight: 500, font: F.ui });
        blurbLines.slice(0, 2).forEach((line, li) => {
          text(g, line, x + 24, y + 116 + li * 22, {
            size: T.body,
            weight: 500,
            color: C.dim,
            font: F.ui,
            baseline: 'middle',
          });
        });

        chip(g, { x: x + 24, y: y + 170, label: choice.detail, color: choice.color, size: T.tiny });

        // preview of the consequence
        if (choice.kind === 'battle' || choice.kind === 'elite') {
          const mul = choice.kind === 'elite' ? 1.6 : 1.1;
          text(
            g,
            `NEXT WAVE: ${wave.count} enemies  ·  ${Math.round(wave.reward * mul)} salvage`,
            x + 24,
            y + 220,
            { size: T.tiny, weight: 700, color: C.faint, font: F.num, baseline: 'middle', track: 0.6 },
          );
        } else if (choice.kind === 'rest') {
          text(g, `CORE BECOMES ${Math.min(run.maxCore, Math.round(run.core) + 22)}  (+22)`, x + 24, y + 220, {
            size: T.tiny,
            weight: 700,
            color: C.lime,
            font: F.num,
            baseline: 'middle',
            track: 0.6,
          });
        } else if (choice.kind === 'supply') {
          text(g, `RACK GROWS TO ${run.rack.length + 3} LETTERS`, x + 24, y + 220, {
            size: T.tiny,
            weight: 700,
            color: C.cyan,
            font: F.num,
            baseline: 'middle',
            track: 0.6,
          });
        } else if (choice.kind === 'market') {
          text(g, `SALVAGE AVAILABLE: ${run.salvage}`, x + 24, y + 220, {
            size: T.tiny,
            weight: 700,
            color: C.gold,
            font: F.num,
            baseline: 'middle',
            track: 0.6,
          });
        }

        button(g, app.kit, {
          id: `node-btn:${choice.kind}`,
          x: x + 24,
          y: y + chh - 64,
          w: cw - 48,
          h: 44,
          label: i === 0 ? 'TAKE THIS PATH' : 'TAKE',
          tone: i === 0 ? 'primary' : 'secondary',
          size: T.small,
          glow: i === 0,
        });
        g.restore();
      });

      // history rail
      const hy = SIZE.h - 74;
      text(g, 'RUN SO FAR', 60, hy - 22, {
        size: T.micro,
        weight: 700,
        color: C.faint,
        font: F.num,
        baseline: 'middle',
        track: 2,
      });
      const recent = run.history.slice(-9);
      let hx = 60;
      for (const h of recent) {
        const w = 132;
        panel(g, hx, hy, w, 44, { fill: 'rgba(255,255,255,0.02)', stroke: alpha(C.line, 0.7), r: R.sm });
        text(g, `W${h.wave}`, hx + 12, hy + 15, {
          size: T.micro + 1,
          weight: 700,
          color: C.faint,
          font: F.num,
          baseline: 'middle',
        });
        text(g, `x${h.cascade}`, hx + w - 12, hy + 15, {
          size: T.micro + 1,
          weight: 700,
          color: C.violet,
          font: F.num,
          align: 'right',
          baseline: 'middle',
        });
        text(g, `${h.killed} kills  ·  core ${h.core}`, hx + 12, hy + 31, {
          size: T.micro,
          weight: 500,
          color: C.dim,
          font: F.ui,
          baseline: 'middle',
        });
        hx += w + 8;
      }
    },
  };
}
