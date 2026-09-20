/**
 * Spoils — pick one change for the engine.
 *
 * The screen always shows the current build next to the offers, because the
 * question the player is answering is "what does my engine need?", not "which
 * card looks best".
 */
import { C, R, T, VIEW } from '../../core/theme';
import { label, plate, rgba, rr, tile, well, type Ctx } from '../../core/draw';
import { loc, t } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { store } from '../../core/save';
import { BLUEPRINTS } from '../../content/blueprints';
import { RULES } from '../../content/rules';
import type { App, Screen } from '../../app/app';
import type { RewardDef } from '../../run/rewards';

const CARD_W = 300;
const CARD_H = 330;

export function createSpoilsScreen(): Screen {
  let hovered = -1;

  const drawCard = (g: Ctx, app: App, reward: RewardDef, index: number): void => {
    const x = 200 + index * (CARD_W + 40);
    const y = 190;
    const hover = hovered === index;
    plate(g, x, y, CARD_W, CARD_H, {
      radius: R.lg,
      fill: hover ? '#1c2740' : '#151d30',
      edge: hover ? reward.tone : undefined,
      depth: 8,
    });
    if (hover) {
      g.strokeStyle = rgba(reward.tone, 0.6);
      g.lineWidth = 2;
      rr(g, x - 3, y - 3, CARD_W + 6, CARD_H + 6, R.lg + 3);
      g.stroke();
    }

    // Category chip
    const kindLabel =
      reward.kind === 'rule' || reward.kind === 'tweak'
        ? t('rewardRule')
        : reward.kind === 'blueprint'
          ? t('rewardBlueprint')
          : reward.kind === 'repair'
            ? t('core')
            : t('rewardBag');
    g.fillStyle = rgba(reward.tone, 0.18);
    rr(g, x + 20, y + 18, 132, 26, 13);
    g.fill();
    label(g, kindLabel, x + 32, y + 36, { size: T.micro, color: reward.tone, weight: 800, tracking: 1.4 });

    // Visual: bag rewards show tiles, blueprint rewards show the word, rules show a mark
    if (reward.kind === 'bagAdd' || reward.kind === 'bagDuplicate') {
      tile(g, x + CARD_W / 2 - 33, y + 68, 66, reward.letter, 'filled', { glow: reward.tone });
      if (reward.kind === 'bagDuplicate') {
        tile(g, x + CARD_W / 2 + 6, y + 88, 50, reward.letter, 'filled', { alpha: 0.85 });
      }
    } else if (reward.kind === 'bagRemove') {
      tile(g, x + CARD_W / 2 - 33, y + 68, 66, reward.letter, 'slot');
      g.strokeStyle = C.bad;
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x + CARD_W / 2 - 44, y + 76);
      g.lineTo(x + CARD_W / 2 + 44, y + 148);
      g.stroke();
    } else if (reward.kind === 'blueprint') {
      reward.blueprint.recipe.forEach((letter, i) => {
        const n = reward.blueprint.recipe.length;
        const size = 44;
        const totalW = n * size + (n - 1) * 6;
        tile(g, x + CARD_W / 2 - totalW / 2 + i * (size + 6), y + 74, size, letter, 'filled', {
          glow: reward.tone,
        });
      });
    } else if (reward.kind === 'repair') {
      // A wrench-crossed core reads instantly as "this fixes the machine".
      g.fillStyle = rgba(reward.tone, 0.18);
      g.beginPath();
      g.arc(x + CARD_W / 2, y + 110, 44, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = reward.tone;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(x + CARD_W / 2, y + 110, 44, 0, Math.PI * 2);
      g.stroke();
      label(g, '+', x + CARD_W / 2, y + 130, {
        align: 'center',
        size: 52,
        color: reward.tone,
        weight: 800,
      });
    } else {
      const icon = reward.kind === 'rule' ? '⚙' : '✦';
      label(g, icon, x + CARD_W / 2, y + 110, { align: 'center', size: 56, color: reward.tone, weight: 800 });
    }

    // Text
    label(g, loc(reward.title), x + 20, y + 196, { size: T.lead, color: C.ink, weight: 800 });
    g.font = `500 ${T.small}px Archivo, sans-serif`;
    const words = loc(reward.desc).split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > CARD_W - 40 && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    lines.slice(0, 4).forEach((l, i) => {
      label(g, l, x + 20, y + 226 + i * 20, { size: T.small, color: C.dim, weight: 500 });
    });

    app.ui.button(g, `spoils.take.${index}`, { x: x + 20, y: y + CARD_H - 62, w: CARD_W - 40, h: 46 }, {
      label: t('take'),
      tone: reward.tone,
      fontSize: T.body,
    });
  };

  return {
    id: 'spoils',
    enter() {
      hovered = -1;
    },
    draw(g, app) {
      const run = app.run;
      if (!run) {
        app.goto('title');
        return;
      }
      g.fillStyle = '#080c16';
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      const grad = g.createLinearGradient(0, 0, 0, VIEW.h);
      grad.addColorStop(0, rgba(C.violet, 0.07));
      grad.addColorStop(0.5, 'rgba(0,0,0,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, VIEW.w, VIEW.h);

      label(g, t('spoils'), 200, 92, { size: T.title, color: C.ink, weight: 800, tracking: 3 });
      label(g, t('chooseOne'), 200, 128, { size: T.lead, color: C.gold, weight: 700, tracking: 2 });
      label(
        g,
        `Trận ${Math.min(run.state.encounterIndex + 1, 7)}/8 · ${loc(run.encounter().name)} — ${t('encounterClear')}`,
        200,
        158,
        { size: T.small, color: C.dim, weight: 500 },
      );

      // Build summary so the choice has context.
      const bx = 200;
      const by = 560;
      well(g, bx - 20, by - 30, VIEW.w - 360, 190, R.lg);
      label(g, 'DÂY CHUYỀN HIỆN TẠI', bx, by - 6, {
        size: T.micro,
        color: C.faint,
        weight: 800,
        tracking: 2.4,
      });

      // Bag
      const counts = new Map<string, number>();
      for (const ch of run.state.bag) counts.set(ch, (counts.get(ch) ?? 0) + 1);
      const rows = [...counts.entries()].sort((a, b) => a[0].localeCompare(b[0]));
      rows.slice(0, 14).forEach(([letter, count], i) => {
        const x = bx + i * 34;
        tile(g, x, by + 16, 30, letter, 'filled');
        if (count > 1) {
          label(g, `${count}`, x + 27, by + 42, { size: 10, color: C.gold, align: 'right', weight: 800 });
        }
      });

      // Blueprints
      label(g, 'CÔNG THỨC', bx, by + 96, {
        size: T.micro,
        color: C.faint,
        weight: 800,
        tracking: 2.4,
      });
      run.state.blueprints.forEach((id, i) => {
        if (!id) return;
        const bp = BLUEPRINTS[id];
        const x = bx + 110 + i * 150;
        label(g, bp.word, x, by + 96, { size: T.small, color: bp.color, weight: 800, tracking: 1.4 });
        label(g, loc(bp.name), x + 62, by + 96, { size: 11, color: C.faint, weight: 600 });
      });

      // Rules
      label(g, 'LUẬT MÁY', bx + 640, by + 96, {
        size: T.micro,
        color: C.faint,
        weight: 800,
        tracking: 2.4,
      });
      const ruleNames = run.state.ruleIds
        .map((id) => RULES.find((r) => r.id === id))
        .filter(Boolean)
        .map((r) => loc(r!.name));
      const flags = run.state.flags.map((f) => f);
      const all = [...ruleNames, ...flags];
      label(g, all.length ? all.join(' · ') : '—', bx + 640, by + 118, {
        size: 11,
        color: C.violet,
        weight: 600,
      });

      run.pendingRewards.forEach((reward, i) => {
        const rect = { x: 200 + i * (CARD_W + 40), y: 190, w: CARD_W, h: CARD_H };
        const hit = app.ui.hit(`spoils.hover.${i}`, rect, {});
        if (hit.hover) hovered = i;
        drawCard(g, app, reward, i);
      });

      if (run.pendingRewards.length === 0) {
        label(g, 'Không có lựa chọn nào — tiếp tục.', VIEW.w / 2, 300, {
          align: 'center',
          size: T.lead,
          color: C.dim,
          weight: 600,
        });
        app.ui.button(g, 'spoils.skip', { x: VIEW.w / 2 - 110, y: 340, w: 220, h: 52 }, {
          label: t('skip'),
          tone: C.cyan,
        });
      }
    },
    click(id, app) {
      const run = app.run;
      if (!run) return;
      if (id === 'spoils.skip') {
        run.advance();
        store.saveRun(run.serialize());
        app.goto('battle');
        return;
      }
      if (id.startsWith('spoils.take.')) {
        const index = Number(id.split('.')[2]);
        const reward = run.pendingRewards[index];
        if (!reward) return;
        sfx.ui();
        run.applyReward(reward);
        run.advance();
        store.saveRun(run.serialize());
        app.goto('battle');
      }
    },
    key(e, app) {
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        this.click?.(`spoils.take.${Number(e.key) - 1}`, app);
        return true;
      }
      return false;
    },
  };
}
