/** Title screen: the logo assembles itself out of letter tiles. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, mix, panel, rr, text, type Ctx } from '../../core/draw';
import { clamp, easeOutElastic, easeOut } from '../../core/rng';
import { button } from '../kit';
import { newRun, hasSave, loadRun, clearRun, saveRun } from '../../game/run';
import type { App, Screen } from '../../app';

const WORD1 = 'ALPHABET';
const WORD2 = 'ENGINE';

interface Drift {
  x: number;
  y: number;
  ch: string;
  size: number;
  sp: number;
  rot: number;
  vr: number;
  depth: number;
}

export function createTitleScreen(): Screen {
  let drifts: Drift[] = [];
  let confirmNew = false;
  let seedOpen = false;
  let seedText = '';
  let t = 0;

  const reset = (): void => {
    drifts = [];
    const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    for (let i = 0; i < 34; i++) {
      drifts.push({
        x: Math.random() * SIZE.w,
        y: Math.random() * SIZE.h,
        ch: letters[Math.floor(Math.random() * 26)],
        size: 16 + Math.random() * 40,
        sp: 6 + Math.random() * 22,
        rot: (Math.random() - 0.5) * 0.7,
        vr: (Math.random() - 0.5) * 0.5,
        depth: Math.random(),
      });
    }
  };

  const tileAt = (index: number, count: number, cx: number, y: number, size: number, gap: number) => {
    const total = count * (size + gap) - gap;
    return { x: cx - total / 2 + index * (size + gap) + size / 2, y };
  };

  const drawWord = (
    g: Ctx,
    word: string,
    cx: number,
    y: number,
    size: number,
    gap: number,
    delay: number,
    time: number,
    ink: string,
  ): void => {
    for (let i = 0; i < word.length; i++) {
      const p = clamp((time - delay - i * 0.055) / 0.75, 0, 1);
      const pos = tileAt(i, word.length, cx, y, size, gap);
      const startY = y - 140 - i * 12;
      const yy = startY + (y - startY) * easeOut(p);
      const settle = p >= 1 ? Math.sin((time - delay - i * 0.055) * 1.6) * 1.6 : 0;
      const a = p < 0.02 ? 0 : 1;
      g.save();
      g.globalAlpha = a;
      if (p < 1) {
        g.shadowBlur = 26 * (1 - p);
        g.shadowColor = alpha(C.gold, 0.7);
      }
      const sc = p < 1 ? 0.9 + 0.1 * easeOutElastic(p) : 1;
      g.translate(pos.x, yy + settle);
      g.scale(sc, sc);
      rr(g, -size / 2, -size / 2, size, size, size * 0.18);
      const grad = g.createLinearGradient(0, -size / 2, 0, size / 2);
      grad.addColorStop(0, mix(C.panelHi, ink, 0.1));
      grad.addColorStop(1, C.bg1);
      g.fillStyle = grad;
      g.fill();
      rr(g, -size / 2 + 0.5, -size / 2 + 0.5, size - 1, size - 1, size * 0.18);
      g.strokeStyle = alpha(ink, 0.22);
      g.lineWidth = 1;
      g.stroke();
      text(g, word[i], 0, size * 0.04, {
        font: F.slab,
        weight: 800,
        size: size * 0.62,
        color: ink,
        align: 'center',
        baseline: 'middle',
      });
      g.restore();
    }
  };

  const screen: Screen = {
    id: 'title',
    enter() {
      reset();
      t = 0;
      confirmNew = false;
      seedOpen = false;
      seedText = '';
    },
    update(dt) {
      t += dt;
      for (const d of drifts) {
        d.y -= d.sp * dt * (0.4 + d.depth);
        d.rot += d.vr * dt;
        if (d.y < -60) {
          d.y = SIZE.h + 60;
          d.x = Math.random() * SIZE.w;
        }
      }
    },
    key(e, app) {
      if (seedOpen) {
        if (e.key === 'Backspace') {
          seedText = seedText.slice(0, -1);
          return true;
        }
        if (e.key === 'Enter') {
          startRun(app, seedText || undefined);
          return true;
        }
        if (e.key === 'Escape') {
          seedOpen = false;
          return true;
        }
        if (/^[a-zA-Z0-9]{1}$/.test(e.key) && seedText.length < 12) {
          seedText += e.key.toUpperCase();
          return true;
        }
        return true;
      }
      if (e.key === 'Enter' || e.key === ' ') {
        startRun(app, undefined);
        return true;
      }
      return false;
    },
    draw(g, app) {
      // backdrop
      const bg = g.createLinearGradient(0, 0, SIZE.w * 0.4, SIZE.h);
      bg.addColorStop(0, '#0b0e1a');
      bg.addColorStop(0.55, '#0a0c16');
      bg.addColorStop(1, '#07080f');
      g.fillStyle = bg;
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, SIZE.w * 0.18, SIZE.h * 0.22, 460, C.violet, 0.16);
      blob(g, SIZE.w * 0.84, SIZE.h * 0.8, 520, C.cyan, 0.1);
      blob(g, SIZE.w * 0.5, SIZE.h * 0.12, 420, C.gold, 0.07);

      // drifting letters
      for (const d of drifts) {
        g.save();
        g.globalAlpha = 0.05 + d.depth * 0.09;
        g.translate(d.x, d.y);
        g.rotate(d.rot);
        text(g, d.ch, 0, 0, {
          font: F.slab,
          weight: 800,
          size: d.size,
          color: d.depth > 0.6 ? C.cyan : C.ink,
          align: 'center',
          baseline: 'middle',
        });
        g.restore();
      }

      // logo plinth
      const cx = SIZE.w / 2;
      blob(g, cx, 300, 380, C.gold, 0.1);

      const size = 74;
      const gap = 8;
      drawWord(g, WORD1, cx, 232, size, gap, 0.25, t, C.ink);
      drawWord(g, WORD2, cx, 232 + size + gap, size, gap, 0.62, t, C.gold);

      const sub = clamp((t - 1.5) / 0.7, 0, 1);
      g.save();
      g.globalAlpha = sub;
      text(g, 'LETTERS BECOME WEAPONS  ·  WEAPONS FEED CASCADES', cx, 232 + (size + gap) * 2 + 22, {
        size: T.small,
        weight: 700,
        color: C.dim,
        font: F.ui,
        align: 'center',
        baseline: 'middle',
        track: 3.4,
      });
      g.restore();

      // menu
      const bw = 300;
      const bx = cx - bw / 2;
      let by = 470;
      const sub2 = clamp((t - 1.8) / 0.6, 0, 1);
      g.save();
      g.globalAlpha = sub2;
      const saved = hasSave();
      if (!confirmNew) {
        button(g, app.kit, {
          id: 'new',
          x: bx,
          y: by,
          w: bw,
          h: 54,
          label: saved ? 'NEW RUN' : 'BEGIN',
          icon: 'play',
          tone: 'primary',
          size: T.body,
          glow: true,
        });
        by += 64;
        if (saved) {
          button(g, app.kit, {
            id: 'continue',
            x: bx,
            y: by,
            w: bw,
            h: 46,
            label: 'CONTINUE RUN',
            icon: 'arrow',
            tone: 'secondary',
          });
          by += 56;
        }
        button(g, app.kit, {
          id: 'seed',
          x: bx,
          y: by,
          w: bw,
          h: 40,
          label: seedOpen ? `SEED  ${seedText || '_'}` : 'SET SEED',
          tone: 'ghost',
          size: T.small,
        });
        by += 50;
        button(g, app.kit, {
          id: 'help',
          x: bx,
          y: by,
          w: bw,
          h: 40,
          label: 'HOW TO PLAY',
          tone: 'ghost',
          size: T.small,
        });
      } else {
        panel(g, bx, by - 10, bw, 150, { fill: 'rgba(10,12,22,0.95)', stroke: alpha(C.bad, 0.5), r: R.lg });
        text(g, 'A RUN IS IN PROGRESS', cx, by + 20, {
          size: T.small,
          weight: 700,
          color: C.bad,
          font: F.ui,
          align: 'center',
          baseline: 'middle',
          track: 1.4,
        });
        text(g, 'Starting over discards it.', cx, by + 44, {
          size: T.small,
          weight: 500,
          color: C.dim,
          font: F.ui,
          align: 'center',
          baseline: 'middle',
        });
        button(g, app.kit, {
          id: 'new-confirm',
          x: bx + 16,
          y: by + 66,
          w: bw / 2 - 24,
          h: 44,
          label: 'DISCARD',
          tone: 'danger',
        });
        button(g, app.kit, {
          id: 'new-cancel',
          x: bx + bw / 2 + 8,
          y: by + 66,
          w: bw / 2 - 24,
          h: 44,
          label: 'KEEP',
          tone: 'secondary',
        });
      }
      g.restore();

      // footer
      g.save();
      g.globalAlpha = 0.75;
      text(g, 'v0.1  ·  EVERY WORD IS A WEAPON  ·  EVERY KILL FEEDS THE NEXT', cx, SIZE.h - 28, {
        size: T.micro + 1,
        weight: 700,
        color: C.faint,
        font: F.num,
        align: 'center',
        baseline: 'middle',
        track: 2.2,
      });
      g.restore();
    },
    click(id, app) {
      switch (id) {
        case 'new':
          if (hasSave()) confirmNew = true;
          else startRun(app, seedText || undefined);
          break;
        case 'new-confirm':
          clearRun();
          startRun(app, seedText || undefined);
          break;
        case 'new-cancel':
          confirmNew = false;
          break;
        case 'continue': {
          const run = loadRun();
          if (run) {
            app.run = run;
            app.goto('forge');
          } else app.toast('Save was unreadable', C.bad);
          break;
        }
        case 'seed':
          seedOpen = !seedOpen;
          break;
        case 'help':
          app.goto('help');
          break;
      }
    },
  };

  return screen;
}

function startRun(app: App, seed?: string): void {
  app.run = newRun(seed);
  saveRun(app.run);
  app.goto('forge');
}
