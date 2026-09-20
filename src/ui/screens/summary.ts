/** End of run: what happened, and the words you built. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, panel, text, textWidth } from '../../core/draw';
import { clamp, easeOut } from '../../core/rng';
import { sfx } from '../../core/audio';
import { button, heading } from '../kit';
import { miniWeapon } from '../tiles';
import { clearRun, newRun, saveRun, type RunState } from '../../game/run';
import { BLESSING_BY_ID } from '../../game/run';
import type { App, Screen } from '../../app';

export function createSummaryScreen(): Screen {
  let t = 0;
  let app!: App;
  let exportOpen = false;

  const restart = (app2: App, sameSeed: boolean): void => {
    const run = app2.run;
    const seed = sameSeed && run ? run.seedText : undefined;
    app2.run = newRun(seed);
    saveRun(app2.run);
    app2.goto('forge');
  };

  return {
    id: 'summary',
    enter(a) {
      app = a;
      t = 0;
      exportOpen = false;
      sfx.lose();
    },
    update(dt) {
      t += dt;
    },
    click(id) {
      if (id === 'new') {
        clearRun();
        restart(app, false);
      } else if (id === 'retry') restart(app, true);
      else if (id === 'title') app.goto('title');
      else if (id === 'copy') {
        const run = app.run;
        if (run) {
          const text_ = seedBlurb(run);
          void navigator.clipboard?.writeText(text_).then(
            () => app.toast('Run summary copied', C.good),
            () => app.toast('Could not copy', C.bad),
          );
        }
      }
    },
    key(e) {
      if (e.key === 'Escape') app.goto('title');
      return false;
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      if (!run) return;
      const win = run.victory;
      const p = easeOut(clamp(t / 0.6, 0, 1));

      g.fillStyle = '#07080f';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, SIZE.w / 2, 180, 620, win ? C.gold : C.bad, win ? 0.12 : 0.09);
      blob(g, SIZE.w * 0.16, SIZE.h - 100, 420, C.violet, 0.05);

      g.save();
      g.globalAlpha = p;
      text(g, win ? 'RUN COMPLETE' : 'CORE BREACHED', 60, 78, {
        size: 42,
        weight: 700,
        color: win ? C.gold : C.bad,
        font: F.ui,
        baseline: 'middle',
        track: 4,
        glow: alpha(win ? C.gold : C.bad, 0.5),
        glowSize: 24,
      });
      text(
        g,
        win
          ? `The engine held for ${run.stats.wavesCleared} waves.`
          : `The alphabet got through on wave ${run.wave}.`,
        62,
        116,
        { size: T.lead, weight: 500, color: C.dim, font: F.ui, baseline: 'middle' },
      );
      g.restore();

      // stat grid
      const stats: [string, string, string][] = [
        ['Waves cleared', `${run.stats.wavesCleared}`, C.ink],
        ['Enemies killed', `${run.stats.kills}`, C.ink],
        ['Weapons forged', `${run.stats.forged}`, C.gold],
        ['Best cascade', `x${run.stats.bestCascade}`, C.violet],
        ['Damage dealt', `${Math.round(run.stats.damage).toLocaleString()}`, C.ember],
        ['Salvage earned', `${run.stats.salvageEarned}`, C.gold],
        ['Longest word', run.stats.longestWord ? run.stats.longestWord.toUpperCase() : '-', C.cyan],
        ['Core at end', `${Math.max(0, Math.round(run.core))} / ${run.maxCore}`, C.good],
      ];
      const gx = 60;
      let gy = 170;
      const colW = 300;
      stats.forEach((s, i) => {
        const x = gx + (i % 2) * (colW + 20);
        const y = gy + Math.floor(i / 2) * 58;
        panel(g, x, y, colW, 48, { fill: C.bg1, stroke: alpha(C.line, 0.8), r: R.md });
        text(g, s[0].toUpperCase(), x + 16, y + 24, {
          size: T.micro,
          weight: 700,
          color: C.faint,
          font: F.num,
          baseline: 'middle',
          track: 1.2,
        });
        text(g, s[1], x + colW - 16, y + 24, {
          size: T.lead,
          weight: 700,
          color: s[2],
          font: F.num,
          align: 'right',
          baseline: 'middle',
        });
      });

      // blessings
      let by = gy + 4 * 58 + 26;
      text(g, 'BLESSINGS TAKEN', gx, by, {
        size: T.micro,
        weight: 700,
        color: C.faint,
        font: F.num,
        baseline: 'middle',
        track: 1.8,
      });
      by += 24;
      if (!run.blessings.length) {
        text(g, 'None', gx, by, { size: T.small, weight: 500, color: C.faint, font: F.ui, baseline: 'middle' });
      }
      let bx = gx;
      for (const id of run.blessings) {
        const b = BLESSING_BY_ID.get(id);
        const label = b ? b.name : id;
        const w = textWidth(g, label.toUpperCase(), { size: T.tiny, weight: 700, font: F.num }) + 22;
        panel(g, bx, by - 12, w, 24, { fill: alpha(C.violet, 0.12), stroke: alpha(C.violet, 0.4), r: 6 });
        text(g, label.toUpperCase(), bx + w / 2, by, {
          size: T.tiny,
          weight: 700,
          color: C.violet,
          font: F.num,
          align: 'center',
          baseline: 'middle',
        });
        bx += w + 6;
        if (bx > gx + colW * 2 - 80) {
          bx = gx;
          by += 30;
        }
      }

      // lexicon
      const lx = 760;
      const lw = SIZE.w - lx - 60;
      panel(g, lx, 170, lw, 452, { fill: C.bg1, stroke: C.line, r: R.lg, top: 'rgba(255,255,255,0.03)' });
      heading(g, 'Lexicon', lx + 20, 200, { size: T.lead });
      text(g, `${run.placed.length} WORDS MOUNTED`, lx + lw - 20, 200, {
        size: T.micro,
        weight: 700,
        color: C.faint,
        font: F.num,
        align: 'right',
        baseline: 'middle',
        track: 1.2,
      });

      const sorted = [...run.placed].sort((x, y) => y.def.damage - x.def.damage);
      const rows = Math.min(sorted.length, 8);
      for (let i = 0; i < rows; i++) {
        const w = i % 2;
        const r = Math.floor(i / 2);
        miniWeapon(g, {
          x: lx + 20 + w * ((lw - 40) / 2 + 12),
          y: 226 + r * 52,
          w: (lw - 40) / 2,
          h: 44,
          def: sorted[i].def,
        });
      }
      if (!sorted.length) {
        text(g, 'No weapons were forged. Harsh.', lx + 20, 240, {
          size: T.small,
          weight: 500,
          color: C.faint,
          font: F.ui,
          baseline: 'middle',
        });
      }

      // buttons
      button(g, app.kit, {
        id: 'retry',
        x: 60,
        y: SIZE.h - 108,
        w: 250,
        h: 56,
        label: 'RETRY SEED',
        icon: 'arrow',
        tone: 'primary',
        sub: run.seedText,
        size: T.body,
      });
      button(g, app.kit, {
        id: 'new',
        x: 322,
        y: SIZE.h - 108,
        w: 250,
        h: 56,
        label: 'NEW RUN',
        icon: 'play',
        tone: 'secondary',
        size: T.body,
      });
      button(g, app.kit, {
        id: 'copy',
        x: 584,
        y: SIZE.h - 108,
        w: 190,
        h: 56,
        label: 'COPY RUN',
        icon: 'map',
        tone: 'ghost',
        size: T.small,
      });
      button(g, app.kit, {
        id: 'title',
        x: SIZE.w - 250,
        y: SIZE.h - 108,
        w: 190,
        h: 56,
        label: 'TITLE',
        tone: 'ghost',
        size: T.small,
      });
      text(g, `SEED  ${run.seedText}`, SIZE.w - 280, SIZE.h - 40, {
        size: T.small,
        weight: 700,
        color: C.faint,
        font: F.num,
        baseline: 'middle',
        track: 1.6,
      });
      void exportOpen;
    },
  };
}

function seedBlurb(run: RunState): string {
  return [
    `ALPHABET ENGINE run - seed ${run.seedText}`,
    `${run.stats.wavesCleared} waves · ${run.stats.kills} kills · best cascade x${run.stats.bestCascade}`,
    `${run.stats.forged} weapons forged · longest word ${run.stats.longestWord.toUpperCase()}`,
  ].join('\n');
}

