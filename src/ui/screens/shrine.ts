/** Shrine: pick one permanent blessing. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, icon, mix, panel, text, wrapLines, type IconName } from '../../core/draw';
import { clamp } from '../../core/rng';
import { sfx } from '../../core/audio';
import { button, heading } from '../kit';
import { BLESSINGS, rngOf, saveRun, type Blessing, type RunState } from '../../game/run';
import type { App, Screen } from '../../app';

const ICONS: Record<string, IconName> = {
  loud: 'bolt',
  quick: 'play',
  long: 'arrow',
  static: 'wave',
  greed: 'coin',
  husk: 'shield',
  magnet: 'star',
  prism: 'arrow',
  echo: 'wave',
  wrap: 'star',
  polyglot: 'map',
  vowel: 'flask',
  surge: 'bolt',
};

const COLORS = [C.violet, C.cyan, C.gold, C.lime, C.rose, C.ember];

export function createShrineScreen(): Screen {
  let picks: Blessing[] = [];
  let taken = false;
  let leaveT = 0;
  let t = 0;
  let app!: App;

  const choose = (b: Blessing): void => {
    const run = app.run;
    if (!run || taken) return;
    taken = true;
    b.apply(run.boons);
    run.blessings.push(b.id);
    if (b.id === 'husk') {
      run.maxCore += 18;
      run.core = Math.min(run.maxCore, run.core + 18);
    }
    saveRun(run);
    sfx.levelUp();
    app.toast(`${b.name}  ·  ${b.blurb}`, C.violet);
    // a beat to read the flourish, then back to the forge
    leaveT = 0.5;
  };

  return {
    id: 'shrine',
    enter(a) {
      app = a;
      t = 0;
      taken = false;
      leaveT = 0;
      const run = a.run;
      if (!run) return;
      const rng = rngOf(run);
      const pool = BLESSINGS.filter((b) => !run.blessings.includes(b.id) || countOf(run, b.id) < 2);
      picks = rng.sample(pool, Math.min(3, pool.length));
    },
    update(dt) {
      t += dt;
      if (leaveT > 0) {
        leaveT -= dt;
        if (leaveT <= 0) app.goto('forge');
      }
    },
    click(id) {
      // the card and its button both accept the blessing
      const key = id.startsWith('bless-btn:') ? id.slice(10) : id.startsWith('bless:') ? id.slice(6) : null;
      if (!key) return;
      const b = picks.find((p) => p.id === key);
      if (b) choose(b);
    },
    key(e) {
      if (['1', '2', '3'].includes(e.key)) {
        const b = picks[Number(e.key) - 1];
        if (b) choose(b);
      }
      return false;
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      if (!run) return;

      g.fillStyle = '#070812';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, SIZE.w / 2, 220, 620, C.violet, 0.12);
      blob(g, SIZE.w * 0.2, SIZE.h - 120, 420, C.cyan, 0.05);

      // altar glow
      const pulse = 0.6 + Math.sin(t * 1.6) * 0.08;
      const grad = g.createRadialGradient(SIZE.w / 2, 150, 20, SIZE.w / 2, 150, 360 * pulse);
      grad.addColorStop(0, alpha(C.violet, 0.22));
      grad.addColorStop(1, alpha(C.violet, 0));
      g.fillStyle = grad;
      g.fillRect(0, 0, SIZE.w, 420);

      heading(g, 'Shrine', SIZE.w / 2, 92, {
        size: 38,
        sub: 'Take one blessing. It lasts for the whole run.',
        align: 'center',
      });
      text(g, 'CHOOSE WISELY  ·  PRESS 1 2 3', SIZE.w / 2, 152, {
        size: T.micro,
        weight: 700,
        color: C.faint,
        font: F.num,
        align: 'center',
        baseline: 'middle',
        track: 2.6,
      });

      const cw = 340;
      const chh = 420;
      const gap = 28;
      const total = picks.length * cw + (picks.length - 1) * gap;
      const x0 = (SIZE.w - total) / 2;
      picks.forEach((b, i) => {
        const x = x0 + i * (cw + gap);
        const y = 196;
        const id = `bless:${b.id}`;
        const hv = app.kit.hoverAmt(id);
        const col = COLORS[i % COLORS.length];
        const appear = clamp((t - i * 0.09) / 0.4, 0, 1);
        g.save();
        g.globalAlpha = appear;
        panel(g, x, y, cw, chh, {
          fill: mix(C.bg1, col, 0.05 + hv * 0.06),
          stroke: alpha(col, 0.32 + hv * 0.5),
          r: R.lg,
          shadow: hv * 30,
          shadowColor: alpha(col, 0.4),
          top: alpha(col, 0.08),
        });
        app.kit.hot({ id, x, y, w: cw, h: chh });

        // rune
        const ry = y + 110;
        g.save();
        g.translate(x + cw / 2, ry);
        g.rotate(Math.sin(t * 0.4 + i) * 0.05);
        g.beginPath();
        for (let k = 0; k < 6; k++) {
          const a2 = (k / 6) * Math.PI * 2 - Math.PI / 2;
          const r2 = 56;
          const px = Math.cos(a2) * r2;
          const py = Math.sin(a2) * r2;
          k === 0 ? g.moveTo(px, py) : g.lineTo(px, py);
        }
        g.closePath();
        g.fillStyle = alpha(col, 0.1);
        g.fill();
        g.strokeStyle = alpha(col, 0.45);
        g.lineWidth = 1.4;
        g.stroke();
        g.restore();
        icon(g, ICONS[b.id] ?? 'star', x + cw / 2, ry, 44, col, true);

        text(g, b.name.toUpperCase(), x + cw / 2, y + 208, {
          size: T.head,
          weight: 700,
          color: C.ink,
          font: F.ui,
          align: 'center',
          baseline: 'middle',
          track: 2,
        });
        const lines = wrapLines(g, b.blurb, cw - 56, { size: T.lead, weight: 500, font: F.ui });
        lines.slice(0, 3).forEach((line, li) => {
          text(g, line, x + cw / 2, y + 250 + li * 26, {
            size: T.lead,
            weight: 500,
            color: C.dim,
            font: F.ui,
            align: 'center',
            baseline: 'middle',
          });
        });

        if (run.blessings.includes(b.id)) {
          text(g, `ALREADY TAKEN x${countOf(run, b.id)}`, x + cw / 2, y + chh - 96, {
            size: T.micro,
            weight: 700,
            color: C.faint,
            font: F.num,
            align: 'center',
            baseline: 'middle',
            track: 1.4,
          });
        }

        button(g, app.kit, {
          id: `bless-btn:${b.id}`,
          x: x + 24,
          y: y + chh - 72,
          w: cw - 48,
          h: 48,
          label: taken ? 'TAKEN' : 'ACCEPT',
          tone: taken ? 'ghost' : 'primary',
          size: T.body,
          glow: !taken,
          disabled: taken,
        });
        g.restore();
      });

      text(g, 'Blessings stack with everything else, including market upgrades.', SIZE.w / 2, SIZE.h - 44, {
        size: T.tiny,
        weight: 500,
        color: C.faint,
        font: F.ui,
        align: 'center',
        baseline: 'middle',
      });
    },
  };
}

const countOf = (run: RunState, id: string): number => run.blessings.filter((b) => b === id).length;

