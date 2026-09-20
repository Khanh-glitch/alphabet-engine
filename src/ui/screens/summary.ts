/** Run summary: what the engine actually did. */
import { C, R, T, VIEW } from '../../core/theme';

import { loc, t } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { store } from '../../core/save';
import { label, plate, rgba, rr, type Ctx } from '../../core/draw';
import { BLUEPRINTS } from '../../content/blueprints';
import type { Screen } from '../../app/app';


export function createSummaryScreen(): Screen {
  return {
    id: 'summary',
    enter() {
      sfx.ui();
    },
    draw(g, app) {
      const run = app.run;
      const rec = run?.state.record;
      const won = !!rec?.completed;

      g.fillStyle = '#080c16';
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      const grad = g.createRadialGradient(VIEW.w / 2, 200, 60, VIEW.w / 2, 200, 900);
      grad.addColorStop(0, rgba(won ? C.mint : C.bad, 0.12));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW.w, VIEW.h);

      label(g, won ? t('runComplete') : t('runOver'), VIEW.w / 2, 130, {
        align: 'center',
        size: 62,
        color: won ? C.mint : C.bad,
        weight: 800,
        tracking: 5,
      });
      label(g, run ? `${loc(run.kit.name)} · ${t('chaptersCleared')} ${rec?.cleared ?? 0}/8` : '', VIEW.w / 2, 166, {
        align: 'center',
        size: T.small,
        color: C.faint,
        weight: 700,
        tracking: 1.5,
      });

      // Score card
      const cardW = 720;
      const cardX = VIEW.w / 2 - cardW / 2;
      plate(g, cardX, 210, cardW, 250, { radius: R.lg, fill: '#121a2c', edge: C.lineHi, depth: 7 });

      const stats: [string, string, string][] = [
        [t('statsCrafts'), `${rec?.crafts ?? 0}`, C.gold],
        [t('statsKills'), `${rec?.kills ?? 0}`, C.ember],
        [t('statsBestChain'), `×${rec?.longestChain ?? 0}`, C.violet],
        [t('statsFirstCraft'), rec?.firstCraft != null ? `${rec.firstCraft.toFixed(1)}s` : '—', C.cyan],
        [t('statsLetters'), `${rec?.letters ?? 0}`, C.mint],
        [t('statsWildcards'), `${rec?.wildcards ?? 0}`, C.rose],
      ];
      stats.forEach(([name, value, color], i) => {
        const col = i % 3;
        const row = Math.floor(i / 3);
        const x = cardX + 40 + col * (cardW - 80) / 3;
        const y = 250 + row * 96;
        label(g, name, x, y, { size: T.micro, color: C.faint, weight: 800, tracking: 1.6 });
        label(g, value, x, y + 40, { size: 36, color, weight: 800 });
      });

      // Which words carried the engine. The craft counts are the story of the run:
      // they show the player what their build actually did.
      if (run) {
        const used = run.state.blueprints.filter(Boolean) as string[];
        const crafts = run.state.craftsByBlueprint;
        const total = used.reduce((a, id) => a + (crafts[id] ?? 0), 0) || 1;
        const cardW = 190;
        const gap = 16;
        const startX = VIEW.w / 2 - (used.length * cardW + (used.length - 1) * gap) / 2;
        used.forEach((id, i) => {
          const bp = BLUEPRINTS[id as keyof typeof BLUEPRINTS];
          const n = crafts[id] ?? 0;
          const x = startX + i * (cardW + gap);
          const y = 486;
          plate(g, x, y, cardW, 74, { radius: R.sm, fill: '#0f1626', edge: rgba(bp.color, 0.6), depth: 4 });
          label(g, bp.word, x + 14, y + 28, { size: T.small, color: C.ink, weight: 800, tracking: 1.4 });
          label(g, loc(bp.name), x + 14, y + 48, { size: 11, color: bp.color, weight: 700 });
          label(g, `×${n}`, x + cardW - 14, y + 30, {
            size: T.lead,
            color: C.ink,
            align: 'right',
            weight: 800,
          });
          // Share of the run's output: the quiet answer to "what is my build doing?"
          const barW = cardW - 28;
          g.fillStyle = rgba('#000000', 0.4);
          rr(g, x + 14, y + 58, barW, 6, 3);
          g.fill();
          if (n > 0) {
            g.fillStyle = bp.color;
            rr(g, x + 14, y + 58, Math.max(4, barW * (n / total)), 6, 3);
            g.fill();
          }
        });
      }

      app.ui.button(g, 'summary.again', { x: VIEW.w / 2 - 260, y: 610, w: 240, h: 56 }, {
        label: t('again'),
        tone: C.gold,
        fontSize: T.body,
      });
      app.ui.button(g, 'summary.menu', { x: VIEW.w / 2 + 20, y: 610, w: 240, h: 56 }, {
        label: t('toMenu'),
        variant: 'ghost',
        tone: C.cyan,
        fontSize: T.body,
      });
      void (g as unknown as Ctx);
    },
    click(id, app) {
      if (id === 'summary.again') {
        app.run = null;
        store.saveRun(null);
        app.goto('kit');
      } else if (id === 'summary.menu') {
        app.run = null;
        store.saveRun(null);
        app.goto('title');
      }
    },
  };
}
