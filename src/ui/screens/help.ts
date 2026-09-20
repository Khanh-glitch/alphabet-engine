/** Reference: the rules of the engine, in three readable columns. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, icon, mix, panel, rr, text, textWidth, wrapLines, type Ctx } from '../../core/draw';
import { letterValue, polarityOf } from '../../game/dict';
import { LETTER_MODS, TRAITS } from '../../game/forge';
import { ENEMIES, ENEMY_TIP } from '../../game/enemies';
import { BLESSINGS } from '../../game/run';
import { button, heading } from '../kit';
import { sfx } from '../../core/audio';
import type { App, Screen } from '../../app';

type Tab = 'basics' | 'letters' | 'arsenal';

export function createHelpScreen(): Screen {
  let tab: Tab = 'basics';
  let t = 0;
  let app!: App;

  const tabs: [Tab, string][] = [
    ['basics', 'HOW IT WORKS'],
    ['letters', 'THE 26'],
    ['arsenal', 'TRAITS & ENEMIES'],
  ];

  return {
    id: 'help',
    enter(a) {
      app = a;
      t = 0;
    },
    update(dt) {
      t += dt;
    },
    key(e) {
      if (e.key === 'Escape') {
        sfx.uiBack();
        back(app);
        return true;
      }
      return false;
    },
    click(id) {
      if (id.startsWith('tab:')) {
        tab = id.slice(4) as Tab;
        sfx.ui();
      } else if (id === 'back') {
        sfx.uiBack();
        back(app);
      }
    },
    draw(g, a) {
      app = a;
      g.fillStyle = '#080a12';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, 260, 90, 480, C.cyan, 0.05);
      blob(g, SIZE.w - 240, SIZE.h - 120, 460, C.violet, 0.05);

      heading(g, 'The Engine', 60, 60, {
        size: 34,
        sub: 'Everything is made of letters. Even the things trying to kill you.',
      });

      // tabs
      let tx = 60;
      for (const [id, label] of tabs) {
        const w = textWidth(g, label, { size: T.tiny, weight: 700, font: F.num, track: 1.6 }) + 34;
        const active = tab === id;
        const hid = `tab:${id}`;
        const hv = app.kit.hoverAmt(hid);
        app.kit.hot({ id: hid, x: tx, y: 118, w, h: 34 });
        rr(g, tx, 118, w, 34, R.sm);
        g.fillStyle = active ? alpha(C.gold, 0.16) : alpha(C.ink, 0.03 + hv * 0.05);
        g.fill();
        rr(g, tx + 0.5, 118.5, w - 1, 33, R.sm - 0.5);
        g.strokeStyle = alpha(active ? C.gold : C.line, active ? 0.6 : 0.8);
        g.lineWidth = 1;
        g.stroke();
        text(g, label, tx + w / 2, 135, {
          size: T.tiny,
          weight: 700,
          color: active ? C.gold : C.dim,
          font: F.num,
          align: 'center',
          baseline: 'middle',
          track: 1.6,
        });
        tx += w + 8;
      }

      const top = 178;
      const h = SIZE.h - top - 108;
      if (tab === 'basics') drawBasics(g, 60, top, SIZE.w - 120, h);
      else if (tab === 'letters') drawLetters(g, 60, top, SIZE.w - 120, h);
      else drawArsenal(g, 60, top, SIZE.w - 120, h, t);

      button(g, app.kit, {
        id: 'back',
        x: SIZE.w - 300,
        y: SIZE.h - 88,
        w: 240,
        h: 54,
        label: 'BACK',
        icon: 'arrow',
        tone: 'primary',
        size: T.body,
      });
    },
  };
}

function back(app: App): void {
  const prev = app.prev && app.prev !== 'help' ? app.prev : 'title';
  app.goto(prev === 'battle' && !app.battle ? 'forge' : prev);
}

function column(
  g: Ctx,
  o: { x: number; y: number; w: number; h: number; title: string; color?: string },
): void {
  panel(g, o.x, o.y, o.w, o.h, {
    fill: C.bg1,
    stroke: alpha(o.color ?? C.line, 0.6),
    r: R.lg,
    top: alpha(o.color ?? C.line, 0.06),
  });
  text(g, o.title.toUpperCase(), o.x + 20, o.y + 26, {
    size: T.tiny,
    weight: 700,
    color: o.color ?? C.ink,
    font: F.ui,
    baseline: 'middle',
    track: 2.4,
  });
}

function bullets(
  g: Ctx,
  x: number,
  y: number,
  w: number,
  items: [string, string][],
  color: string,
): number {
  let cy = y;
  for (const [head, body] of items) {
    rr(g, x, cy - 5, 3, 14, 2);
    g.fillStyle = alpha(color, 0.75);
    g.fill();
    text(g, head.toUpperCase(), x + 14, cy + 1, {
      size: T.micro + 1,
      weight: 700,
      color: C.ink,
      font: F.num,
      baseline: 'middle',
      track: 1.1,
    });
    const lines = wrapLines(g, body, w - 20, { size: T.small, weight: 500, font: F.ui });
    lines.forEach((line, i) => {
      text(g, line, x + 14, cy + 20 + i * 17, {
        size: T.small,
        weight: 500,
        color: C.dim,
        font: F.ui,
        baseline: 'middle',
      });
    });
    cy += 26 + lines.length * 17;
  }
  return cy;
}

function drawBasics(g: Ctx, x: number, y: number, w: number, h: number): void {
  const colW = (w - 32) / 3;
  const items1: [string, string][] = [
    ['Spell, then mount', 'Spend letters from your rack to spell a real word of 3 to 9 letters. Every word becomes a weapon, mounted into a lane.'],
    ['Letters are stats', 'Letter values and word length set damage. Themed keywords inside the word (blast, chill, chain...) decide how it fires.'],
    ['One word, one lane', 'Weapons only shoot down their own lane. Lanes 1-2 are attacked first; more lanes open up as the run goes on.'],
  ];
  const items2: [string, string][] = [
    ['Polarity', 'Soft letters (a e i o u l m n r s t) charge. Hard letters (b c d f g h j k p q v w x y z) corrode. Words that use both do both.'],
    ['Cascades', 'Kills in quick succession raise the cascade level. Each level adds +8% damage to everything and erupts in a shockwave that hits nearby enemies.'],
    ['The flux engine', 'Kills and cascades fill the charge meter. Charge gives up to +80% weapon damage - or spend it on Purge and Overdrive. Holding it is a real choice.'],
  ];
  const items3: [string, string][] = [
    ['Core', 'Your health, and it carries between waves. Repair it with Iron Husk, Repair Bay nodes or the Yield letter mod.'],
    ['Salvage', 'Earned from kills. Spend it at the market for letters, mounts, engine tuning and forge heat.'],
    ['Builds that feed themselves', 'Charge marks targets so everything hits harder; corrode strips armour. Three-letter words fire fast, nine-letter words hit like a truck.'],
  ];

  column(g, { x, y, w: colW, h, title: 'The Loop', color: C.gold });
  bullets(g, x + 20, y + 56, colW - 40, items1, C.gold);
  column(g, { x: x + colW + 16, y, w: colW, h, title: 'Systems That Feed Each Other', color: C.violet });
  bullets(g, x + colW + 36, y + 56, colW - 40, items2, C.violet);
  column(g, { x: x + (colW + 16) * 2, y, w: colW, h, title: 'Resources', color: C.cyan });
  bullets(g, x + (colW + 16) * 2 + 20, y + 56, colW - 40, items3, C.cyan);
}

function drawLetters(g: Ctx, x: number, y: number, w: number, h: number): void {
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');
  const tile = 62;
  const gap = 10;
  const perRow = 13;
  const gridW = perRow * (tile + gap) - gap;
  const gx = x + (w - gridW) / 2;
  letters.forEach((ch, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const px = gx + col * (tile + gap);
    const py = y + 10 + row * (tile + 34);
    const p = polarityOf(ch);
    const col2 = p === 'pos' ? C.cyan : C.ember;
    rr(g, px, py, tile, tile, 10);
    const grad = g.createLinearGradient(px, py, px, py + tile);
    grad.addColorStop(0, mix(C.panelHi, col2, 0.08));
    grad.addColorStop(1, C.bg1);
    g.fillStyle = grad;
    g.fill();
    rr(g, px + 0.5, py + 0.5, tile - 1, tile - 1, 10);
    g.strokeStyle = alpha(col2, 0.35);
    g.lineWidth = 1;
    g.stroke();
    text(g, ch.toUpperCase(), px + tile / 2, py + tile * 0.44, {
      size: 30,
      weight: 800,
      font: F.slab,
      color: C.ink,
      align: 'center',
      baseline: 'middle',
    });
    text(g, `${letterValue(ch)}`, px + tile - 8, py + tile - 12, {
      size: T.tiny,
      weight: 700,
      color: alpha(C.ink, 0.5),
      font: F.num,
      align: 'right',
      baseline: 'middle',
    });
    text(g, p === 'pos' ? 'CHG' : 'COR', px + 8, py + tile - 12, {
      size: T.micro - 1,
      weight: 700,
      color: col2,
      font: F.num,
      baseline: 'middle',
      track: 0.5,
    });
    const mod = LETTER_MODS.find((m) => m.ch === ch);
    text(g, mod ? mod.tag.toUpperCase() : 'plain', px + tile / 2, py + tile + 14, {
      size: T.micro - 1,
      weight: 700,
      color: mod ? C.gold : C.faint,
      font: F.num,
      align: 'center',
      baseline: 'middle',
      track: 0.8,
    });
  });

  const ly = y + 10 + 2 * (tile + 34) + 16;
  panel(g, x, ly, w, h - (ly - y) - 8, { fill: C.bg1, stroke: C.line, r: R.lg });
  text(g, 'SPECIAL LETTER BONUS  ·  A WORD KEEPS EVERY BONUS IT CONTAINS', x + 20, ly + 24, {
    size: T.tiny,
    weight: 700,
    color: C.gold,
    font: F.ui,
    baseline: 'middle',
    track: 1.8,
  });
  let mx = x + 20;
  let my = ly + 52;
  for (const mod of LETTER_MODS) {
    const label = `${mod.ch.toUpperCase()}  ${mod.tag}`;
    const bw = textWidth(g, label, { size: T.tiny, weight: 700, font: F.num, track: 0.8 }) + 18;
    const descW = w - 60;
    if (mx + bw > x + w - 20) {
      mx = x + 20;
      my += 46;
    }
    rr(g, mx, my, bw, 22, 5);
    g.fillStyle = alpha(C.gold, 0.14);
    g.fill();
    text(g, label, mx + 9, my + 11, {
      size: T.tiny,
      weight: 700,
      color: C.gold,
      font: F.num,
      baseline: 'middle',
      track: 0.8,
    });
    text(g, mod.blurb, mx + bw + 10, my + 11, {
      size: T.small,
      weight: 500,
      color: C.dim,
      font: F.ui,
      baseline: 'middle',
      max: Math.max(80, descW - bw),
    });
    mx += bw + 30 + Math.min(descW - bw, textWidth(g, mod.blurb, { size: T.small, weight: 500, font: F.ui }));
    if (mx > x + w - 120) {
      mx = x + 20;
      my += 30;
    }
  }
}

function drawArsenal(g: Ctx, x: number, y: number, w: number, h: number, t: number): void {
  const colW = (w - 32) / 3;
  column(g, { x, y, w: colW, h, title: 'Keyword Families', color: C.gold });
  let cy = y + 56;
  for (const key of Object.keys(TRAITS) as (keyof typeof TRAITS)[]) {
    if (key === 'NONE') continue;
    const info = TRAITS[key];
    icon(g, info.icon, x + 30, cy + 4, 16, info.color, true);
    text(g, info.label.toUpperCase(), x + 48, cy + 4, {
      size: T.small,
      weight: 700,
      color: info.color,
      font: F.ui,
      baseline: 'middle',
      track: 1.2,
    });
    const lines = wrapLines(g, info.blurb, colW - 70, { size: T.small, weight: 500, font: F.ui });
    lines.forEach((line, i) => {
      text(g, line, x + 48, cy + 24 + i * 16, {
        size: T.small,
        weight: 500,
        color: C.dim,
        font: F.ui,
        baseline: 'middle',
      });
    });
    cy += 26 + lines.length * 16 + 8;
  }
  text(g, 'NONE', x + 30, cy + 4, {
    size: T.small,
    weight: 700,
    color: C.dim,
    font: F.ui,
    baseline: 'middle',
    track: 1.2,
  });
  text(g, 'No family matched - raw damage, no tricks.', x + 48, cy + 4, {
    size: T.small,
    weight: 500,
    color: C.faint,
    font: F.ui,
    baseline: 'middle',
  });

  column(g, { x: x + colW + 16, y, w: colW, h, title: 'Enemies', color: C.bad });
  let ey = y + 56;
  for (const key of Object.keys(ENEMIES) as (keyof typeof ENEMIES)[]) {
    const def = ENEMIES[key];
    rr(g, x + colW + 36, ey - 8, 24, 24, 7);
    g.fillStyle = mix(C.bg1, def.tint, 0.26);
    g.fill();
    text(g, def.name[0].toUpperCase(), x + colW + 48, ey + 4, {
      size: 13,
      weight: 800,
      font: F.slab,
      color: mix(C.ink, def.tint, 0.4),
      align: 'center',
      baseline: 'middle',
    });
    text(g, def.name.toUpperCase(), x + colW + 66, ey + 0, {
      size: T.small,
      weight: 700,
      color: C.ink,
      font: F.ui,
      baseline: 'middle',
      track: 1,
    });
    text(g, `${Math.round(def.hp)} HP  ·  ${def.speed} SPEED  ·  ${def.armor} ARMOUR`, x + colW + 66, ey + 17, {
      size: T.micro,
      weight: 700,
      color: C.faint,
      font: F.num,
      baseline: 'middle',
      track: 0.4,
    });
    const lines = wrapLines(g, ENEMY_TIP[key], colW - 90, { size: T.small, weight: 500, font: F.ui });
    lines.slice(0, 2).forEach((line, i) => {
      text(g, line, x + colW + 66, ey + 36 + i * 16, {
        size: T.small,
        weight: 500,
        color: C.dim,
        font: F.ui,
        baseline: 'middle',
      });
    });
    ey += 44 + lines.length * 16;
    if (ey > y + h - 40) break;
  }

  column(g, { x: x + (colW + 16) * 2, y, w: colW, h, title: 'Blessings', color: C.violet });
  let by = y + 56;
  for (const b of BLESSINGS) {
    const pulse = 0.7 + Math.sin(t * 2 + by * 0.05) * 0.06;
    g.save();
    g.globalAlpha = pulse;
    icon(g, 'star', x + (colW + 16) * 2 + 30, by + 4, 13, C.violet, true);
    g.restore();
    text(g, b.name.toUpperCase(), x + (colW + 16) * 2 + 46, by + 4, {
      size: T.small,
      weight: 700,
      color: C.ink,
      font: F.ui,
      baseline: 'middle',
      track: 0.8,
    });
    text(g, b.blurb, x + (colW + 16) * 2 + 46, by + 22, {
      size: T.small,
      weight: 500,
      color: C.dim,
      font: F.ui,
      baseline: 'middle',
      max: colW - 70,
    });
    by += 46;
    if (by > y + h - 56) break;
  }
  text(g, 'Taken at shrines. They stack.', x + (colW + 16) * 2 + 20, y + h - 18, {
    size: T.tiny,
    weight: 500,
    color: C.faint,
    font: F.ui,
    baseline: 'middle',
  });
}

