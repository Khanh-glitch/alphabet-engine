/** Codex — everything crafted, fought and unlocked, as a reference the player can study. */
import { C, R, T, VIEW } from '../../core/theme';

import { loc, t } from '../../core/i18n';
import { store } from '../../core/save';
import { BLUEPRINTS } from '../../content/blueprints';
import { ENEMIES } from '../../content/enemies';
import { RULES, TWEAK_RULES } from '../../content/rules';
import { sfx } from '../../core/audio';
import { label, plate, rgba, tile, type Ctx } from '../../core/draw';
import type { App, Screen } from '../../app/app';

type Tab = 'blueprints' | 'enemies' | 'rules';

export function createCodexScreen(): Screen {
  let tab: Tab = 'blueprints';
  let scroll = 0;

  const tabButton = (g: Ctx, app: App, id: Tab, x: number, labelText: string): void => {
    const active = tab === id;
    app.ui.button(g, `codex.tab.${id}`, { x, y: 116, w: 220, h: 44 }, {
      label: labelText,
      tone: active ? C.gold : C.cyan,
      variant: active ? 'solid' : 'ghost',
      fontSize: T.small,
    });
  };

  const wrapText = (g: Ctx, text: string, maxW: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    if (line) lines.push(line);
    return lines;
  };

  const drawBlueprint = (g: Ctx, app: App, id: string, x: number, y: number, w: number): void => {
    const bp = BLUEPRINTS[id as keyof typeof BLUEPRINTS];
    const seen = store.codex.blueprints.includes(id);
    plate(g, x, y, w, 118, { radius: R.md, fill: '#141c2e', edge: seen ? rgba(bp.color, 0.5) : undefined, depth: 5 });
    if (!seen) {
      label(g, '? ? ?', x + 24, y + 62, { size: T.head, color: C.ghost, weight: 800, tracking: 6 });
      label(g, t('codexLocked'), x + 24, y + 90, { size: T.micro, color: C.faint, weight: 700 });
      return;
    }
    // The recipe tiles own the left column; everything else starts clear of them.
    const size = 40;
    const gap = 5;
    const tilesW = bp.recipe.length * size + (bp.recipe.length - 1) * gap;
    bp.recipe.forEach((letter, i) => {
      tile(g, x + 20 + i * (size + gap), y + 16, size, letter, 'filled');
    });
    const textX = x + 20 + tilesW + 22;
    const textW = x + w - 20 - textX;
    label(g, bp.word, x + 20, y + 96, { size: T.small, color: C.ink, weight: 800, tracking: 1.6 });
    label(g, loc(bp.name), x + 20 + 74, y + 96, { size: T.tiny, color: bp.color, weight: 700 });
    g.font = `500 12px Archivo, sans-serif`;
    const descLines = wrapText(g, loc(bp.desc), textW);
    descLines.slice(0, 3).forEach((line, i) => {
      label(g, line, textX, y + 40 + i * 17, { size: 12, color: C.dim, weight: 500 });
    });
    label(g, bp.tags.join(' · '), textX, y + 96, { size: 10, color: rgba(C.faint, 0.9), weight: 700 });
    void app;
  };

  const drawEnemy = (g: Ctx, id: string, x: number, y: number, w: number): void => {
    const enemy = ENEMIES[id as keyof typeof ENEMIES];
    const seen = store.codex.enemies.includes(id);
    plate(g, x, y, w, 104, { radius: R.md, fill: '#141c2e', edge: seen ? rgba(enemy.color, 0.5) : undefined, depth: 5 });
    if (!seen) {
      label(g, '? ? ?', x + 24, y + 56, { size: T.head, color: C.ghost, weight: 800, tracking: 6 });
      return;
    }
    g.fillStyle = enemy.color;
    g.beginPath();
    g.arc(x + 52, y + 50, 24, 0, Math.PI * 2);
    g.fill();
    label(g, loc(enemy.name), x + 92, y + 42, { size: T.body, color: C.ink, weight: 800 });
    g.font = `500 12px Archivo, sans-serif`;
    wrapText(g, loc(enemy.note), w - 92 - 24)
      .slice(0, 2)
      .forEach((line, i) => {
        label(g, line, x + 92, y + 66 + i * 16, { size: 12, color: C.dim, weight: 500 });
      });
    label(g, enemy.tags.join(' · '), x + w - 20, y + 92, {
      size: 10,
      color: rgba(C.faint, 0.9),
      align: 'right',
      weight: 700,
    });
  };

  const drawRule = (g: Ctx, id: string, x: number, y: number, w: number): void => {
    const rule = RULES.find((r) => r.id === id);
    const tweak = Object.entries(TWEAK_RULES).find(([k]) => k === id);
    const name = rule ? loc(rule.name) : tweak ? loc(tweak[1].name) : id;
    const desc = rule ? loc(rule.desc) : tweak ? loc(tweak[1].desc) : '';
    const seen = rule ? store.codex.rules.includes(id) : true;
    plate(g, x, y, w, 96, { radius: R.md, fill: '#141c2e', edge: seen ? rgba(C.violet, 0.5) : undefined, depth: 5 });
    if (!seen) {
      label(g, '? ? ?', x + 24, y + 54, { size: T.head, color: C.ghost, weight: 800, tracking: 6 });
      return;
    }
    label(g, '⚙', x + 30, y + 44, { size: 30, color: C.violet, weight: 800 });
    label(g, name, x + 78, y + 40, { size: T.body, color: C.ink, weight: 800 });
    g.font = `500 12px Archivo, sans-serif`;
    wrapText(g, desc, w - 110)
      .slice(0, 2)
      .forEach((line, i) => {
        label(g, line, x + 78, y + 64 + i * 16, { size: 12, color: C.dim, weight: 500 });
      });
  };

  return {
    id: 'codex',
    enter() {
      scroll = 0;
    },
    draw(g, app) {
      g.fillStyle = '#080c16';
      g.fillRect(0, 0, VIEW.w, VIEW.h);
      label(g, t('codexTitle'), 72, 62, { size: T.title, color: C.ink, weight: 800, tracking: 3 });
      label(g, t('codexIntro'), 72, 90, { size: T.small, color: C.dim, weight: 500 });

      const tabs: [Tab, string][] = [
        ['blueprints', t('codexBlueprints')],
        ['enemies', t('codexEnemies')],
        ['rules', t('codexRules')],
      ];
      tabs.forEach(([id, text], i) => tabButton(g, app, id, 72 + i * 234, text));

      app.ui.button(g, 'codex.back', { x: VIEW.w - 140, y: 116, w: 100, h: 44 }, {
        label: t('back'),
        variant: 'ghost',
        fontSize: T.small,
      });

      const top = 184;
      const colW = (VIEW.w - 144 - 24) / 2;

      if (tab === 'blueprints') {
        Object.keys(BLUEPRINTS).forEach((id, i) => {
          const x = 72 + (i % 2) * (colW + 24);
          const y = top + Math.floor(i / 2) * 130 - scroll;
          if (y < top - 130 || y > VIEW.h) return;
          drawBlueprint(g, app, id, x, y, colW);
        });
      } else if (tab === 'enemies') {
        Object.keys(ENEMIES).forEach((id, i) => {
          const x = 72 + (i % 2) * (colW + 24);
          const y = top + Math.floor(i / 2) * 116 - scroll;
          if (y < top - 116 || y > VIEW.h) return;
          drawEnemy(g, id, x, y, colW);
        });
      } else {
        const ids = [...RULES.map((r) => r.id), ...Object.keys(TWEAK_RULES)];
        ids.forEach((id, i) => {
          const x = 72 + (i % 2) * (colW + 24);
          const y = top + Math.floor(i / 2) * 108 - scroll;
          if (y < top - 108 || y > VIEW.h) return;
          drawRule(g, id, x, y, colW);
        });
      }
    },
    click(id, app) {
      if (id === 'codex.back') {
        sfx.ui();
        app.goto('title');
        return;
      }
      if (id.startsWith('codex.tab.')) {
        tab = id.split('.')[2] as Tab;
        scroll = 0;
        sfx.ui();
      }
    },
    wheel(dy) {
      scroll = Math.max(0, scroll + dy * 0.5);
      return;
    },
    key(e, app) {
      if (e.key === 'Escape') {
        app.goto('title');
        return true;
      }
      return false;
    },
  };
}
