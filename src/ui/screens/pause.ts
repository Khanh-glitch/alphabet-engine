/** Pause overlay: the game keeps its context visible behind it. */
import { C, R, T, VIEW } from '../../core/theme';

import { loc, t } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { RUN } from '../../content/encounters';
import { label, plate, type Ctx } from '../../core/draw';
import type { Screen } from '../../app/app';


export function createPauseScreen(): Screen {
  return {
    id: 'pause',
    enter() {
      sfx.ui();
    },
    draw(g, app) {
      const w = 460;
      const h = 420;
      const x = VIEW.w / 2 - w / 2;
      const y = VIEW.h / 2 - h / 2;
      plate(g, x, y, w, h, { radius: R.lg, fill: '#101828', edge: C.gold, depth: 9 });
      label(g, t('paused'), x + w / 2, y + 66, {
        align: 'center',
        size: 40,
        color: C.gold,
        weight: 800,
        tracking: 6,
      });

      const run = app.run;
      if (run) {
        const encounter = RUN[Math.min(run.state.encounterIndex, RUN.length - 1)];
        label(g, loc(run.kit.name), x + w / 2, y + 96, {
          align: 'center',
          size: T.small,
          color: C.dim,
          weight: 600,
        });
        label(
          g,
          `${t('wave')} ${run.state.encounterIndex + 1}/${RUN.length} · ${loc(encounter.name)}`,
          x + w / 2,
          y + 120,
          { align: 'center', size: T.small, color: C.faint, weight: 600 },
        );
      }

      app.ui.button(g, 'pause.resume', { x: x + 40, y: y + 156, w: w - 80, h: 54 }, {
        label: t('resume'),
        tone: C.mint,
        fontSize: T.body,
      });
      app.ui.button(g, 'pause.restart', { x: x + 40, y: y + 222, w: w - 80, h: 48 }, {
        label: t('restartEncounter'),
        variant: 'ghost',
        tone: C.cyan,
        fontSize: T.small,
      });
      app.ui.button(g, 'pause.settings', { x: x + 40, y: y + 280, w: w - 80, h: 48 }, {
        label: t('settings'),
        variant: 'ghost',
        tone: C.violet,
        fontSize: T.small,
      });
      app.ui.button(g, 'pause.quit', { x: x + 40, y: y + 338, w: w - 80, h: 48 }, {
        label: t('quitToMenu'),
        variant: 'ghost',
        tone: C.bad,
        fontSize: T.small,
      });
      void (g as unknown as Ctx);
    },
    click(id, app) {
      if (id === 'pause.resume') {
        app.setOverlay(null);
        return;
      }
      if (id === 'pause.restart') {
        // Rebuilding the battle keeps the same encounter and seed but resets the
        // fight, which is exactly what "restart encounter" means.
        if (app.run) app.battle = app.run.buildBattle();
        app.setOverlay(null);
        return;
      }
      if (id === 'pause.settings') {
        app.setOverlay(null);
        app.goto('settings');
        return;
      }
      if (id === 'pause.quit') {
        if (app.run) app.run.pendingRewards = [];
        app.setOverlay(null);
        app.run = null;
        app.goto('title');
      }
    },
  };
}
