/**
 * Kit selection — the only pre-run decision.
 *
 * A kit is a bag plus three words plus a small rule, so this screen doubles as
 * the game's clearest explanation of what an "engine" is.
 */
import { C, R, T, VIEW } from '../../core/theme';
import { label, plate, rgba, rr, tile, well, type Ctx } from '../../core/draw';
import { loc, t } from '../../core/i18n';
import { freshSeed, seedFromLabel, seedLabel } from '../../core/rng';
import { KITS, type KitDef } from '../../content/kits';
import { BLUEPRINTS } from '../../content/blueprints';
import type { App, Screen } from '../../app/app';
import { Run } from '../../run/run';
import { store } from '../../core/save';

/** Wrap a string to a pixel width using the supplied font. */
function wrapText(g: Ctx, text: string, maxW: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (g.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines;
}

export function createKitScreen(): Screen {
  let selected = 0;
  let seed = freshSeed();
  let editingSeed = false;
  const CARD_W = 400;
  const CARD_H = 470;
  const cardX = (i: number): number => 60 + i * (CARD_W + 30);

  const drawKit = (g: Ctx, app: App, kit: KitDef, index: number): void => {
    const x = cardX(index);
    const y = 150;
    const isSel = index === selected;
    const hit = app.ui.hit(`kit.${index}`, { x, y, w: CARD_W, h: CARD_H }, {
      tooltip: loc(kit.how),
    });

    plate(g, x, y, CARD_W, CARD_H, {
      radius: R.lg,
      fill: isSel ? '#1b2540' : '#141c2e',
      edge: isSel ? kit.color : undefined,
      depth: 7,
    });
    if (hit.hover) {
      g.strokeStyle = rgba(kit.color, 0.5);
      g.lineWidth = 2;
      rr(g, x - 2, y - 2, CARD_W + 4, CARD_H + 4, R.lg + 2);
      g.stroke();
    }

    // Kit identity
    g.fillStyle = rgba(kit.color, isSel ? 0.24 : 0.12);
    rr(g, x, y, CARD_W, 76, R.lg);
    g.fill();
    label(g, loc(kit.name), x + 24, y + 40, { size: T.head, color: C.ink, weight: 800, tracking: 1.4 });
    label(g, loc(kit.tagline), x + 24, y + 62, { size: T.small, color: kit.color, weight: 700 });

    // Blueprint words
    label(g, 'CÔNG THỨC', x + 24, y + 108, {
      size: T.micro,
      color: C.faint,
      weight: 800,
      tracking: 2.4,
    });
    kit.blueprints.forEach((id, i) => {
      const bp = BLUEPRINTS[id];
      const wx = x + 24 + i * 120;
      const wy = y + 116;
      plate(g, wx, wy, 108, 84, { radius: R.sm, fill: '#0f1626', edge: rgba(bp.color, 0.55), depth: 3 });
      label(g, bp.word, wx + 54, wy + 26, {
        align: 'center',
        size: T.small,
        color: C.ink,
        weight: 800,
        tracking: 1.2,
      });
      label(g, loc(bp.name), wx + 54, wy + 48, { align: 'center', size: 11, color: bp.color, weight: 700 });
      label(g, `${bp.recipe.length} chữ`, wx + 54, wy + 68, {
        align: 'center',
        size: 10,
        color: C.faint,
        weight: 600,
      });
    });

    // Bag
    label(g, t('kitBag'), x + 24, y + 228, {
      size: T.micro,
      color: C.faint,
      weight: 800,
      tracking: 2.4,
    });
    label(g, `${kit.bag.length} viên`, x + CARD_W - 24, y + 228, {
      size: T.micro,
      color: C.dim,
      align: 'right',
      weight: 700,
    });
    const counts = new Map<string, number>();
    for (const ch of kit.bag) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    const entries = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
    const bsize = 32;
    const bcount = Math.min(entries.length, Math.floor((CARD_W - 64) / (bsize + 5)));
    entries.slice(0, bcount).forEach(([letter, count], i) => {
      const tx = x + 24 + i * (bsize + 5);
      const ty = y + 246;
      tile(g, tx, ty, bsize, letter, 'filled');
      if (count > 1) {
        label(g, `×${count}`, tx + bsize / 2, ty + bsize + 13, {
          size: 11,
          color: C.gold,
          align: 'center',
          weight: 800,
        });
      }
    });

    // How it plays — wrapped inside the panel so nothing clips.
    well(g, x + 24, y + 292, CARD_W - 48, 96, R.sm);
    g.font = `500 ${T.small}px Archivo, sans-serif`;
    wrapText(g, loc(kit.how), CARD_W - 76)
      .slice(0, 3)
      .forEach((line, i) => {
        label(g, line, x + 40, y + 320 + i * 21, { size: T.small, color: C.ink, weight: 500 });
      });

    // Stats
    g.fillStyle = rgba(C.line, 0.5);
    g.fillRect(x + 24, y + 400, CARD_W - 48, 1);
    label(g, `LÕI ${kit.coreHp}`, x + 24, y + 428, { size: T.tiny, color: C.mint, weight: 800 });
    label(g, `? ${kit.wildcards}`, x + 120, y + 428, { size: T.tiny, color: C.violet, weight: 800 });

    app.ui.button(g, `kit.pick.${index}`, { x: x + CARD_W - 154, y: y + 406, w: 130, h: 42 }, {
      label: isSel ? 'ĐÃ CHỌN' : t('choose'),
      tone: kit.color,
      variant: isSel ? 'solid' : 'ghost',
      disabled: isSel,
      fontSize: T.tiny,
    });
  };

  return {
    id: 'kit',
    enter(app) {
      seed = freshSeed();
      editingSeed = false;
      void app;
    },
    draw(g, app) {
      g.fillStyle = '#080c16';
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      const grad = g.createRadialGradient(VIEW.w / 2, 0, 100, VIEW.w / 2, 0, 900);
      grad.addColorStop(0, rgba(C.cyan, 0.06));
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW.w, VIEW.h);

      label(g, t('chooseKit'), 60, 76, { size: T.title, color: C.ink, weight: 800, tracking: 2 });
      label(g, t('chooseKitHint'), 60, 108, { size: T.body, color: C.dim, weight: 500 });

      KITS.forEach((kit, i) => drawKit(g, app, kit, i));

      // Seed row
      const sy = 664;
      label(g, t('seedLabel'), 60, sy + 22, { size: T.micro, color: C.faint, weight: 800, tracking: 2 });
      well(g, 130, sy, 190, 40, R.sm);
      label(g, seedLabel(seed), 145, sy + 27, {
        size: T.lead,
        color: C.gold,
        weight: 800,
        font: "'JetBrains Mono', monospace",
        tracking: 2,
      });
      app.ui.button(g, 'kit.seed', { x: 130, y: sy, w: 190, h: 40 }, {
        label: '',
        variant: 'bare',
        tooltip: editingSeed ? 'Nhập mã rồi Enter' : 'Chạm để nhập mã ván',
      });
      app.ui.button(g, 'kit.random', { x: 336, y: sy, w: 132, h: 40 }, {
        label: t('random'),
        variant: 'ghost',
        tone: C.cyan,
        fontSize: T.tiny,
      });

      const kit = KITS[selected];
      app.ui.button(g, 'kit.start', { x: VIEW.w - 340, y: sy - 8, w: 280, h: 58 }, {
        label: t('start'),
        tone: kit.color,
        fontSize: T.lead,
      });
      app.ui.button(g, 'kit.back', { x: VIEW.w - 132, y: 68, w: 96, h: 40 }, {
        label: t('back'),
        variant: 'ghost',
        fontSize: T.tiny,
      });
    },
    click(id, app) {
      if (id.startsWith('kit.pick.')) {
        selected = Number(id.split('.')[2]);
        return;
      }
      if (id === 'kit.random') {
        seed = freshSeed();
        return;
      }
      if (id === 'kit.back') {
        app.goto('title');
        return;
      }
      if (id === 'kit.seed') {
        editingSeed = true;
        const input = window.prompt('Mã ván / Run seed', seedLabel(seed));
        if (input) seed = seedFromLabel(input);
        editingSeed = false;
        return;
      }
      if (id === 'kit.start') {
        app.run = Run.create(seed, KITS[selected].id);
        store.saveRun(app.run.serialize());
        app.goto('battle');
      }
    },
    key(e, app) {
      if (e.key === 'Escape') {
        app.goto('title');
        return true;
      }
      if (e.key === 'ArrowRight') {
        selected = Math.min(KITS.length - 1, selected + 1);
        return true;
      }
      if (e.key === 'ArrowLeft') {
        selected = Math.max(0, selected - 1);
        return true;
      }
      if (e.key === 'Enter') {
        app.run = Run.create(seed, KITS[selected].id);
        store.saveRun(app.run.serialize());
        app.goto('battle');
        return true;
      }
      return false;
    },
  };
}
