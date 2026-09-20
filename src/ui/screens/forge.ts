/** The forge: build words out of the rack and mount them as weapons. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, blob, circle, icon, mix, panel, rr, slab, text, textWidth, wrapLines, type Ctx } from '../../core/draw';
import { clamp } from '../../core/rng';
import { sfx } from '../../core/audio';
import { button, chip, divider, heading } from '../kit';
import { letterTile, miniWeapon, weaponCard } from '../tiles';
import { hintWord, isWord, letterValue, MIN_WORD } from '../../game/dict';
import { forgeBreakdown, forgeWord, TRAITS } from '../../game/forge';
import { ENEMIES, ENEMY_TIP } from '../../game/enemies';
import {
  BLESSING_BY_ID,
  applyBoons,
  laneCount,
  previewWave,
  saveRun,
  slotsUsed,
  totalDps,
  weaponCount,
  type RunState,
} from '../../game/run';
import type { WeaponDef } from '../../game/types';
import type { App, Screen } from '../../app';

const PAD = 20;
const TOP_H = 64;
const RAIL_Y = 76;
const RAIL_H = 636;
const BOT_Y = 724;

const RACK_BOX = { x: PAD, y: RAIL_Y, w: 476, h: 296 };
const BENCH_BOX = { x: PAD, y: RAIL_Y + 316, w: 476, h: 320 };
const PREVIEW_BOX = { x: 512, y: RAIL_Y, w: 452, h: RAIL_H };
const ARS_BOX = { x: 980, y: RAIL_Y, w: 440, h: RAIL_H };
const BOT_BOX = { x: PAD, y: BOT_Y, w: SIZE.w - PAD * 2, h: SIZE.h - BOT_Y - 16 };

const CHARGED_LETTERS = 'aeioulmnrst';

export function createForgeScreen(): Screen {
  let sel: number[] = [];
  let melt: { lane: number; slot: number } | null = null;
  let message = '';
  let messageT = 0;
  let found: string[] = [];
  let t = 0;
  let cache: { word: string; def: WeaponDef; raw: number } | null = null;

  const wordOf = (run: RunState): string => sel.map((i) => run.rack[i]?.ch ?? '').join('');
  const isValid = (run: RunState): boolean => {
    const w = wordOf(run);
    return w.length >= MIN_WORD && w.length <= 9 && isWord(w);
  };

  const say = (text: string): void => {
    message = text;
    messageT = 3;
  };

  const previewOf = (run: RunState): { def: WeaponDef; raw: number } | null => {
    if (!isValid(run)) return null;
    const word = wordOf(run);
    if (!cache || cache.word !== word) {
      const { def, raw } = forgeWord(word, run.wave);
      cache = { word, def, raw };
    }
    return { def: applyBoons(cache.def, run), raw: cache.raw };
  };

  const deploy = (app: App, lane: number): void => {
    const run = app.run;
    if (!run) return;
    const w = wordOf(run);
    if (!isValid(run)) {
      sfx.reject();
      say(w.length < MIN_WORD ? 'Words need at least three letters' : `"${w.toUpperCase()}" is not in the lexicon`);
      return;
    }
    if (slotsUsed(run, lane) >= run.slotsPerLane) {
      sfx.reject();
      say(`Lane ${lane + 1} is full - melt a weapon or buy a mount rail`);
      return;
    }
    const boosted = applyBoons(forgeWord(w, run.wave).def, run);
    run.placed.push({ def: boosted, lane, slot: slotsUsed(run, lane) });
    run.stats.forged++;
    if (w.length > run.stats.longestWord.length) run.stats.longestWord = w;
    run.rack = run.rack.filter((_, i) => !sel.includes(i));
    sel = [];
    cache = null;
    saveRun(run);
    sfx.forge(w);
    say(`${w.toUpperCase()} mounted in lane ${lane + 1}`);
    app.toast(`${w.toUpperCase()} forged  ·  ${boosted.damage} damage`, TRAITS[boosted.trait].color);
  };

  const meltWeapon = (lane: number, slot: number): void => {
    const run = app.run;
    if (!run) return;
    const idx = run.placed.findIndex((p) => p.lane === lane && p.slot === slot);
    if (idx < 0) return;
    const [removed] = run.placed.splice(idx, 1);
    run.placed
      .filter((p) => p.lane === lane)
      .sort((a, b) => a.slot - b.slot)
      .forEach((p, i) => (p.slot = i));
    const refund = Math.round(14 + removed.def.len * 7);
    run.salvage += refund;
    saveRun(run);
    sfx.coin();
    say(`Melted ${removed.def.word.toUpperCase()} for ${refund} salvage`);
    melt = null;
  };

  let app!: App;

  const click = (id: string): void => {
    if (id.startsWith('rack:')) {
      const i = Number(id.slice(5));
      const at = sel.indexOf(i);
      if (at >= 0) {
        sel.splice(at, 1);
        sfx.lift();
      } else if (sel.length < 9) {
        sel.push(i);
        sfx.place(sel.length);
      } else {
        sfx.reject();
        say('A word can be at most nine letters');
      }
      return;
    }
    if (id.startsWith('bench:')) {
      const i = Number(id.slice(6));
      if (i >= 0 && i < sel.length) {
        sel.splice(i, 1);
        sfx.lift();
      }
      return;
    }
    if (id.startsWith('lane:')) {
      deploy(app, Number(id.slice(5)));
      return;
    }
    if (id.startsWith('arslane:')) {
      if (isValid(app.run!)) deploy(app, Number(id.slice(8)));
      else {
        sfx.reject();
        say('Spell a real word of 3+ letters first');
      }
      return;
    }
    if (id.startsWith('slot:')) {
      const [, laneS, slotS] = id.split(':');
      const lane = Number(laneS);
      const slot = Number(slotS);
      if (isValid(app.run!)) {
        deploy(app, lane);
        return;
      }
      const run = app.run!;
      const placed = run.placed.find((p) => p.lane === lane && p.slot === slot);
      if (!placed) return;
      if (melt && melt.lane === lane && melt.slot === slot) meltWeapon(lane, slot);
      else {
        melt = { lane, slot };
        say(`Melt ${placed.def.word.toUpperCase()} for ${Math.round(14 + placed.def.len * 7)} salvage?`);
        sfx.ui();
      }
      return;
    }
    switch (id) {
      case 'clear':
        sel = [];
        melt = null;
        sfx.uiBack();
        break;
      case 'hint': {
        const run = app.run;
        if (!run) return;
        if (run.salvage < 8) {
          say('Hints cost 8 salvage');
          sfx.reject();
          return;
        }
        const hint = hintWord(run.rack.map((l) => l.ch), 4);
        if (!hint) {
          say('No words hide in this rack');
          sfx.reject();
          return;
        }
        run.salvage -= 8;
        const used: number[] = [];
        for (const ch of hint) {
          const i = run.rack.findIndex((l, k) => l.ch === ch && !used.includes(k));
          if (i >= 0) used.push(i);
        }
        sel = used;
        cache = null;
        if (!found.includes(hint)) found.unshift(hint);
        say(`Hint: ${hint.toUpperCase()}`);
        sfx.ui();
        saveRun(run);
        break;
      }
      case 'melt-yes':
        if (melt) meltWeapon(melt.lane, melt.slot);
        break;
      case 'melt-no':
        melt = null;
        sfx.uiBack();
        break;
      case 'help':
        app.goto('help');
        break;
      case 'begin': {
        const run = app.run;
        if (!run) return;
        if (!run.placed.length) {
          say('Forge at least one weapon before you begin');
          sfx.reject();
          return;
        }
        saveRun(run);
        app.goto('battle');
        break;
      }
    }
  };

  return {
    id: 'forge',
    enter(a) {
      app = a;
      sel = [];
      melt = null;
      message = '';
      messageT = 0;
      found = [];
      cache = null;
      t = 0;
    },
    update(dt) {
      t += dt;
      if (messageT > 0) messageT -= dt;
    },
    click,
    key(e) {
      const run = app.run;
      if (!run) return false;
      if (e.key === 'Backspace') {
        sel.pop();
        cache = null;
        sfx.lift();
        return true;
      }
      if (e.key === 'Escape') {
        sel = [];
        melt = null;
        cache = null;
        return true;
      }
      if (e.key === 'Enter') {
        let best = 0;
        let bestCount = 99;
        for (let i = 0; i < run.lanes; i++) {
          const used = slotsUsed(run, i);
          if (used < run.slotsPerLane && used < bestCount) {
            bestCount = used;
            best = i;
          }
        }
        deploy(app, best);
        return true;
      }
      if (/^[a-zA-Z]$/.test(e.key)) {
        const ch = e.key.toLowerCase();
        const idx = run.rack.findIndex((l, i) => l.ch === ch && !sel.includes(i));
        if (idx >= 0 && sel.length < 9) {
          sel.push(idx);
          cache = null;
          sfx.place(sel.length);
        } else sfx.reject();
        return true;
      }
      return false;
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      if (!run) {
        app.goto('title');
        return;
      }
      const wave = previewWave(run);

      g.fillStyle = '#080a12';
      g.fillRect(0, 0, SIZE.w, SIZE.h);
      blob(g, 160, 110, 520, C.violet, 0.06);
      blob(g, SIZE.w - 180, SIZE.h - 140, 460, C.cyan, 0.055);

      drawTopBar(g, app, run, wave);
      drawRack(g, app, run, sel);
      drawBench(g, app, run, sel, wordOf(run), isValid(run), message, messageT, melt);
      drawPreview(g, run, previewOf(run));
      button(g, app.kit, {
        id: 'begin',
        x: PREVIEW_BOX.x + 18,
        y: PREVIEW_BOX.y + PREVIEW_BOX.h - 62,
        w: PREVIEW_BOX.w - 36,
        h: 46,
        label: `BEGIN WAVE ${run.wave}`,
        icon: 'play',
        tone: 'primary',
        size: T.body,
        glow: true,
        disabled: !run.placed.length,
        tip: run.placed.length
          ? { lines: [{ text: `${run.placed.length} weapons mounted. Heads into the next assault.` }] }
          : { lines: [{ text: 'Forge at least one weapon first.' }] },
      });
      drawArsenal(g, app, run, isValid(run), melt);
      drawBottom(g, app, wave);

      // selection rail: show which letters are in flight
      if (sel.length) {
        const w = 26 + sel.length * 26;
        panel(g, BENCH_BOX.x + BENCH_BOX.w / 2 - w / 2, TOP_H + 6, w, 22, {
          fill: alpha(C.gold, 0.14),
          stroke: alpha(C.gold, 0.45),
          r: 11,
        });
        text(g, `${wordOf(run).toUpperCase()}  ·  ${sel.length} LETTERS`, BENCH_BOX.x + BENCH_BOX.w / 2, TOP_H + 17, {
          size: T.micro + 1,
          weight: 700,
          color: C.gold,
          font: F.num,
          align: 'center',
          baseline: 'middle',
          track: 1.2,
        });
      }
      void t;
    },
  };
}

// ---------------------------------------------------------------------------
function drawTopBar(g: Ctx, app: App, run: RunState, wave: ReturnType<typeof previewWave>): void {
  panel(g, 0, 0, SIZE.w, TOP_H, { fill: 'rgba(11,14,24,0.94)', stroke: alpha(C.line, 0.6), r: 0 });
  g.fillStyle = alpha(C.gold, 0.45);
  g.fillRect(0, TOP_H - 1, SIZE.w, 1);

  text(g, `WAVE ${run.wave}`, 22, TOP_H / 2, {
    size: 22,
    weight: 700,
    color: C.ink,
    font: F.ui,
    baseline: 'middle',
    track: 1.6,
  });
  chip(g, {
    x: 132,
    y: TOP_H / 2 - 12,
    label: wave.note,
    color: wave.boss ? C.blood : wave.elite ? C.rose : C.gold,
    size: T.micro + 1,
  });

  const corePct = run.core / run.maxCore;
  let x = 372;
  icon(g, 'heart', x, TOP_H / 2, 18, corePct < 0.34 ? C.bad : C.good, true);
  text(g, `${Math.max(0, Math.round(run.core))}/${Math.round(run.maxCore)}`, x + 16, TOP_H / 2, {
    size: T.body,
    weight: 700,
    color: corePct < 0.34 ? C.bad : C.ink,
    font: F.num,
    baseline: 'middle',
  });
  x += 150;
  icon(g, 'coin', x, TOP_H / 2, 18, C.gold, true);
  text(g, `${run.salvage}`, x + 16, TOP_H / 2, {
    size: T.body,
    weight: 700,
    color: C.gold,
    font: F.num,
    baseline: 'middle',
  });
  x += 118;
  icon(g, 'map', x, TOP_H / 2, 17, C.cyan, true);
  text(g, `${run.rack.length} IN RACK`, x + 16, TOP_H / 2, {
    size: T.small,
    weight: 700,
    color: C.dim,
    font: F.num,
    baseline: 'middle',
    track: 0.6,
  });

  let bx = SIZE.w - 460;
  text(g, 'BOONS', bx, TOP_H / 2, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.2,
  });
  bx += 52;
  for (const id of run.blessings.slice(-8)) {
    const bid = `boon:${id}`;
    g.save();
    const hov = app.kit.hoverAmt(bid);
    app.kit.hot({
      id: bid,
      x: bx,
      y: TOP_H / 2 - 11,
      w: 22,
      h: 22,
      tip: { title: id.toUpperCase(), lines: [{ text: boonText(id) }] },
    });
    g.fillStyle = alpha(C.violet, 0.16 + hov * 0.2);
    g.beginPath();
    g.roundRect(bx, TOP_H / 2 - 11, 22, 22, 6);
    g.fill();
    g.strokeStyle = alpha(C.violet, 0.7);
    g.lineWidth = 1;
    g.stroke();
    text(g, id[0].toUpperCase(), bx + 11, TOP_H / 2, {
      size: T.micro + 2,
      weight: 700,
      color: C.violet,
      font: F.num,
      align: 'center',
      baseline: 'middle',
    });
    g.restore();
    bx += 26;
  }

  button(g, app.kit, {
    id: 'help',
    x: SIZE.w - 48,
    y: TOP_H / 2 - 16,
    w: 32,
    h: 32,
    label: '?',
    tone: 'ghost',
    radius: R.sm,
    size: T.body,
  });
}

function drawRack(g: Ctx, app: App, run: RunState, sel: number[]): void {
  const box = RACK_BOX;
  panel(g, box.x, box.y, box.w, box.h, { fill: C.bg1, stroke: C.line, r: R.lg, top: 'rgba(255,255,255,0.03)' });
  heading(g, 'Rack', box.x + 18, box.y + 30, { size: T.lead });
  text(g, 'Click letters to spell a word  ·  or just type it', box.x + 18, box.y + 52, {
    size: T.tiny,
    weight: 500,
    color: C.faint,
    font: F.ui,
    baseline: 'middle',
  });
  text(g, `${run.rack.length} LETTERS`, box.x + box.w - 18, box.y + 30, {
    size: T.tiny,
    weight: 700,
    color: C.faint,
    font: F.num,
    align: 'right',
    baseline: 'middle',
    track: 1.2,
  });

  const many = run.rack.length > 15;
  const perRow = many ? 7 : 6;
  const tile = many ? 46 : 54;
  const gap = 10;
  const totalW = perRow * (tile + gap) - gap;
  const sx = box.x + (box.w - totalW) / 2 + tile / 2;
  const sy = box.y + 92 + tile / 2;
  run.rack.forEach((letter, i) => {
    const col = i % perRow;
    const row = Math.floor(i / perRow);
    const x = sx + col * (tile + gap);
    const y = sy + row * (tile + 14);
    const id = `rack:${i}`;
    const charged = CHARGED_LETTERS.includes(letter.ch);
    app.kit.hot({
      id,
      x: x - tile / 2 - 2,
      y: y - tile / 2 - 2,
      w: tile + 4,
      h: tile + 4,
      tip: {
        title: `${letter.ch.toUpperCase()}  ·  value ${letterValue(letter.ch)}`,
        lines: [
          {
            text: charged
              ? 'CHARGED letter - words using it mark enemies, and marked enemies take +16% damage from everything.'
              : 'CORROSIVE letter - words using it strip 30% of enemy armour on hit.',
            color: charged ? C.cyan : C.ember,
          },
          { text: 'Click to add it to the bench.', color: C.faint },
        ],
        width: 280,
      },
    });
    letterTile(g, {
      x,
      y,
      size: tile,
      ch: letter.ch,
      selected: sel.includes(i),
      hover: app.kit.hoverAmt(id),
      value: letterValue(letter.ch),
    });
  });
  if (!run.rack.length) {
    text(g, 'Rack empty - starting the wave draws a new hand', box.x + box.w / 2, box.y + box.h / 2, {
      size: T.small,
      weight: 500,
      color: C.faint,
      font: F.ui,
      align: 'center',
      baseline: 'middle',
    });
  }
}

function drawBench(
  g: Ctx,
  app: App,
  run: RunState,
  sel: number[],
  word: string,
  valid: boolean,
  message: string,
  messageT: number,
  melt: { lane: number; slot: number } | null,
): void {
  const box = BENCH_BOX;
  panel(g, box.x, box.y, box.w, box.h, {
    fill: valid ? mix(C.bg1, C.gold, 0.05) : C.bg1,
    stroke: valid ? alpha(C.gold, 0.5) : C.line,
    r: R.lg,
    top: 'rgba(255,255,255,0.03)',
  });
  heading(g, 'Forge Bench', box.x + 18, box.y + 30, { size: T.lead });

  const size = 52;
  const gap = 7;
  const letters = sel.map((i) => run.rack[i]?.ch ?? '');
  const total = letters.length * (size + gap) - gap;
  const startX = box.x + (box.w - total) / 2 + size / 2;
  const cy = box.y + 92;

  if (!letters.length) {
    panel(g, box.x + 20, box.y + 62, box.w - 40, size + 12, {
      fill: 'rgba(255,255,255,0.015)',
      stroke: alpha(C.line, 0.9),
      r: R.md,
      dash: [5, 6],
    });
    text(g, 'Pick letters to spell a word', box.x + box.w / 2, cy + 4, {
      size: T.small,
      weight: 500,
      color: C.faint,
      font: F.ui,
      align: 'center',
      baseline: 'middle',
    });
  }
  letters.forEach((ch, i) => {
    const x = startX + i * (size + gap);
    const id = `bench:${i}`;
    app.kit.hot({
      id,
      x: x - size / 2,
      y: cy - size / 2,
      w: size,
      h: size,
      tip: { lines: [{ text: 'Click to send this letter back to the rack.' }] },
    });
    letterTile(g, { x, y: cy, size, ch, value: letterValue(ch), hot: true, hover: app.kit.hoverAmt(id) });
  });

  // status
  const statusY = box.y + 150;
  if (word.length) {
    text(g, word.toUpperCase(), box.x + 18, statusY, {
      size: T.body,
      weight: 700,
      color: C.ink,
      font: F.slab,
      baseline: 'middle',
      track: 2.4,
    });
    const label = valid ? 'READY' : word.length < MIN_WORD ? 'TOO SHORT' : 'NOT A WORD';
    text(g, label, box.x + box.w - 18, statusY, {
      size: T.tiny,
      weight: 700,
      color: valid ? C.good : C.bad,
      font: F.num,
      align: 'right',
      baseline: 'middle',
      track: 1.4,
    });
  } else {
    text(g, 'Three to nine letters. Longer words hit far harder.', box.x + 18, statusY, {
      size: T.tiny,
      weight: 500,
      color: C.faint,
      font: F.ui,
      baseline: 'middle',
    });
  }

  // lane picker
  text(g, valid ? 'CLICK A LANE TO MOUNT' : 'DEPLOY TO LANE', box.x + 18, statusY + 30, {
    size: T.micro,
    weight: 700,
    color: valid ? C.gold : C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.6,
  });
  const lanes = run.lanes;
  const lw = (box.w - 36 - (lanes - 1) * 8) / lanes;
  const front = laneCount(run);
  for (let i = 0; i < lanes; i++) {
    const used = slotsUsed(run, i);
    const full = used >= run.slotsPerLane;
    const active = valid && !full;
    const x = box.x + 18 + i * (lw + 8);
    const y = statusY + 40;
    const id = `lane:${i}`;
    app.kit.hot({ id, x, y, w: lw, h: 62, disabled: !active });
    const hv = app.kit.hoverAmt(id);
    const grad = g.createLinearGradient(0, y, 0, y + 62);
    grad.addColorStop(0, active ? mix(C.panelHi, C.gold, 0.12 + hv * 0.2) : mix(C.panel, C.bg2, 0.4));
    grad.addColorStop(1, active ? mix(C.panel, C.gold, 0.05) : C.bg2);
    rr(g, x, y, lw, 62, R.md);
    g.fillStyle = grad;
    g.fill();
    rr(g, x + 0.5, y + 0.5, lw - 1, 61, R.md - 0.5);
    g.strokeStyle = active ? alpha(C.gold, 0.4 + hv * 0.5) : alpha(C.line, 0.8);
    g.lineWidth = 1;
    g.stroke();
    if (!active && i >= front) {
      text(g, 'SAFE', x + lw / 2, y + 22, {
        size: T.micro + 1,
        weight: 700,
        color: C.ghost,
        font: F.num,
        align: 'center',
        baseline: 'middle',
        track: 1.4,
      });
      text(g, 'no enemies yet', x + lw / 2, y + 44, {
        size: T.micro - 1,
        weight: 500,
        color: C.faint,
        font: F.ui,
        align: 'center',
        baseline: 'middle',
      });
    } else {
    text(g, `${i + 1}`, x + lw / 2, y + 22, {
      size: 21,
      weight: 700,
      color: active ? C.ink : C.faint,
      font: F.num,
      align: 'center',
      baseline: 'middle',
    });
    text(g, full ? 'FULL' : `${used}/${run.slotsPerLane} MOUNTED`, x + lw / 2, y + 44, {
      size: T.micro,
      weight: 700,
      color: full ? C.bad : active ? C.good : C.faint,
      font: F.num,
      align: 'center',
      baseline: 'middle',
      track: 0.6,
    });
    }
    if (i < front) {
      rr(g, x, y, lw, 3, 1.5);
      g.fillStyle = alpha(C.rose, 0.65);
      g.fill();
    }
  }

  // actions
  const ay = box.y + box.h - 52;
  const msgY = ay - 22;
  button(g, app.kit, {
    id: 'clear',
    x: box.x + 18,
    y: ay,
    w: 92,
    h: 38,
    label: 'CLEAR',
    tone: 'ghost',
    size: T.tiny + 1,
    icon: 'close',
  });
  button(g, app.kit, {
    id: 'hint',
    x: box.x + 118,
    y: ay,
    w: 130,
    h: 38,
    label: 'HINT',
    tone: 'secondary',
    size: T.tiny + 1,
    icon: 'star',
    tip: { lines: [{ text: 'Reveals one word hiding in the rack for 8 salvage.' }] },
  });
  if (melt) {
    button(g, app.kit, {
      id: 'melt-yes',
      x: box.x + box.w - 204,
      y: ay,
      w: 98,
      h: 38,
      label: 'MELT',
      tone: 'danger',
      size: T.tiny + 1,
    });
    button(g, app.kit, {
      id: 'melt-no',
      x: box.x + box.w - 98,
      y: ay,
      w: 80,
      h: 38,
      label: 'KEEP',
      tone: 'ghost',
      size: T.tiny + 1,
    });
  } else if (messageT > 0) {
    const w = Math.min(box.w - 40, 420);
    panel(g, box.x + box.w - 18 - w, msgY - 15, w, 30, {
      fill: alpha(C.warn, 0.1),
      stroke: alpha(C.warn, 0.4),
      r: R.sm,
    });
    text(g, message, box.x + box.w - 18 - w / 2, msgY, {
      size: T.tiny,
      weight: 600,
      color: C.warn,
      font: F.ui,
      align: 'center',
      baseline: 'middle',
      alpha: clamp(messageT, 0, 1),
      max: w - 20,
    });
  }
}

function drawPreview(
  g: Ctx,
  run: RunState,
  preview: { def: WeaponDef; raw: number } | null,
): void {
  const box = PREVIEW_BOX;
  panel(g, box.x, box.y, box.w, box.h, { fill: C.bg1, stroke: C.line, r: R.lg, top: 'rgba(255,255,255,0.03)' });
  heading(g, 'Weapon Preview', box.x + 18, box.y + 30, { size: T.lead });

  if (!preview) {
    text(g, 'Spell a word to see the weapon it becomes.', box.x + 18, box.y + 56, {
      size: T.small,
      weight: 500,
      color: C.dim,
      font: F.ui,
      baseline: 'middle',
    });
    divider(g, box.x + 18, box.y + 84, box.w - 36);
    const rows: [string, string, string][] = [
      ['1', 'LETTERS', 'Letter values and word length set raw damage.'],
      ['2', 'KEYWORD', 'A themed word inside the word picks the pattern.'],
      ['3', 'SPECIALS', 'Rare letters like Q, Z, J or K each add a bonus.'],
      ['4', 'POLARITY', 'Soft letters charge, hard letters corrode. Both stack.'],
    ];
    let y = box.y + 112;
    for (const [n, head, body] of rows) {
      g.save();
      g.beginPath();
      g.arc(box.x + 34, y + 8, 13, 0, Math.PI * 2);
      g.fillStyle = alpha(C.gold, 0.14);
      g.fill();
      g.strokeStyle = alpha(C.gold, 0.5);
      g.lineWidth = 1;
      g.stroke();
      g.restore();
      text(g, n, box.x + 34, y + 9, {
        size: T.small,
        weight: 700,
        color: C.gold,
        font: F.num,
        align: 'center',
        baseline: 'middle',
      });
      text(g, head, box.x + 58, y + 1, {
        size: T.tiny,
        weight: 700,
        color: C.ink,
        font: F.num,
        baseline: 'middle',
        track: 1.4,
      });
      text(g, body, box.x + 58, y + 20, {
        size: T.small,
        weight: 500,
        color: C.dim,
        font: F.ui,
        baseline: 'middle',
        max: box.w - 80,
      });
      y += 54;
    }

    // strongest weapons, so the column always earns its space
    divider(g, box.x + 18, y + 12, box.w - 36);
    text(g, 'YOUR STRONGEST WORDS', box.x + 18, y + 34, {
      size: T.micro,
      weight: 700,
      color: C.faint,
      font: F.num,
      baseline: 'middle',
      track: 1.6,
    });
    const strongest = [...run.placed].sort((a, b) => b.def.damage - a.def.damage).slice(0, 5);
    let ry = y + 56;
    for (const p of strongest) {
      if (ry > box.y + box.h - 118) break;
      miniWeapon(g, { x: box.x + 18, y: ry, w: box.w - 36, h: 44, def: p.def });
      ry += 52;
    }
    if (!strongest.length) {
      text(g, 'Nothing forged yet.', box.x + 18, ry + 4, {
        size: T.small,
        weight: 500,
        color: C.faint,
        font: F.ui,
        baseline: 'middle',
      });
    }
    return;
  }

  weaponCard(g, {
    x: box.x + 18,
    y: box.y + 52,
    w: box.w - 36,
    h: 262,
    def: preview.def,
  });

  divider(g, box.x + 18, box.y + 330, box.w - 36);
  text(g, 'WHY THIS WORD IS STRONG', box.x + 18, box.y + 352, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.6,
  });
  let y = box.y + 380;
  for (const line of forgeBreakdown(preview.def, preview.raw)) {
    if (y > box.y + box.h - 118) break;
    g.save();
    g.beginPath();
    g.arc(box.x + 26, y, 3.2, 0, Math.PI * 2);
    g.fillStyle = line.color;
    g.fill();
    g.restore();
    const wrapped = wrapLines(g, line.text, box.w - 72, { size: T.small, weight: 500, font: F.ui });
    wrapped.forEach((part, i) => {
      text(g, part, box.x + 38, y + i * 18, {
        size: T.small,
        weight: 500,
        color: line.color,
        font: F.ui,
        baseline: 'middle',
      });
    });
    y += 20 + wrapped.length * 18;
  }
}

function drawArsenal(
  g: Ctx,
  app: App,
  run: RunState,
  valid: boolean,
  melt: { lane: number; slot: number } | null,
): void {
  const box = ARS_BOX;
  panel(g, box.x, box.y, box.w, box.h, { fill: C.bg1, stroke: C.line, r: R.lg, top: 'rgba(255,255,255,0.03)' });
  heading(g, 'Arsenal', box.x + 18, box.y + 30, { size: T.lead });
  text(g, `${weaponCount(run)} WEAPONS  ·  ${totalDps(run)} DPS`, box.x + box.w - 18, box.y + 30, {
    size: T.tiny,
    weight: 700,
    color: C.dim,
    font: F.num,
    align: 'right',
    baseline: 'middle',
    track: 1,
  });

  const rowH = 96;
  const top = box.y + 54;
  const front = laneCount(run);
  for (let lane = 0; lane < run.lanes; lane++) {
    const y = top + lane * rowH;
    const used = slotsUsed(run, lane);
    const canDrop = valid && used < run.slotsPerLane;
    const id = `arslane:${lane}`;
    app.kit.hot({ id, x: box.x + 12, y: y + 2, w: box.w - 24, h: rowH - 8, disabled: !canDrop });
    const hv = app.kit.hoverAmt(id);

    if (canDrop || hv > 0.01) {
      rr(g, box.x + 12, y + 2, box.w - 24, rowH - 8, R.md);
      g.fillStyle = alpha(C.gold, 0.05 + hv * 0.08);
      g.fill();
      rr(g, box.x + 12.5, y + 2.5, box.w - 25, rowH - 9, R.md - 0.5);
      g.strokeStyle = alpha(C.gold, 0.25 + hv * 0.4);
      g.lineWidth = 1;
      g.stroke();
    }
    if (lane) {
      g.fillStyle = alpha(C.line, 0.6);
      g.fillRect(box.x + 16, y - 4, box.w - 32, 1);
    }

    const inert = lane >= front;
    text(g, `LANE ${lane + 1}`, box.x + 20, y + 17, {
      size: T.tiny,
      weight: 700,
      color: inert ? C.faint : canDrop ? C.gold : C.dim,
      font: F.num,
      baseline: 'middle',
      track: 1.2,
    });
    if (!inert) {
      chip(g, { x: box.x + box.w - 76, y: y + 5, label: 'FRONT', color: C.rose, size: T.micro, w: 56 });
    } else {
      text(g, 'SAFE THIS WAVE', box.x + box.w - 20, y + 17, {
        size: T.micro,
        weight: 700,
        color: C.ghost,
        font: F.num,
        align: 'right',
        baseline: 'middle',
        track: 1,
      });
    }

    const slotSize = 50;
    const slotGap = 8;
    const sy = y + 54;
    for (let s = 0; s < run.slotsPerLane; s++) {
      const px = box.x + 20 + s * (slotSize + slotGap) + slotSize / 2;
      const placed = run.placed.find((p) => p.lane === lane && p.slot === s);
      const sid = `slot:${lane}:${s}`;
      if (placed) {
        app.kit.hot({
          id: sid,
          x: px - slotSize / 2,
          y: sy - slotSize / 2,
          w: slotSize,
          h: slotSize,
          tip: {
            title: placed.def.word.toUpperCase(),
            lines: [
              { text: `${placed.def.damage} damage  ·  ${(1 / placed.def.cooldown).toFixed(2)} shots/s`, color: C.ink },
              { text: `${placed.def.range} range  ·  ${placed.def.len} letters`, color: C.dim },
              { text: TRAITS[placed.def.trait].blurb, color: TRAITS[placed.def.trait].color },
              ...placed.def.mods.map((m) => ({ text: m.toUpperCase(), color: C.dim })),
              {
                text: valid
                  ? 'A word is ready - click to mount it in this lane.'
                  : `Click to melt it for ${Math.round(14 + placed.def.len * 7)} salvage.`,
                color: C.faint,
              },
            ],
            width: 290,
          },
        });
        const hover = app.kit.hoverAmt(sid);
        const melting = !!melt && melt.lane === lane && melt.slot === s;
        letterTile(g, {
          x: px,
          y: sy,
          size: slotSize,
          ch: placed.def.word[0],
          tint: mix(C.bg2, TRAITS[placed.def.trait].color, 0.24),
          hover,
          hot: true,
          selected: melting,
        });
      } else {
        rr(g, px - slotSize / 2, sy - slotSize / 2, slotSize, slotSize, slotSize * 0.2);
        g.fillStyle = 'rgba(255,255,255,0.015)';
        g.fill();
        rr(g, px - slotSize / 2 + 0.5, sy - slotSize / 2 + 0.5, slotSize - 1, slotSize - 1, slotSize * 0.2);
        g.strokeStyle = alpha(canDrop ? C.gold : C.line, canDrop ? 0.35 : 0.5);
        g.setLineDash([4, 5]);
        g.lineWidth = 1;
        g.stroke();
        g.setLineDash([]);
        icon(g, 'plus', px, sy, 13, alpha(canDrop ? C.gold : C.ghost, 0.9), false);
      }
    }

    // weapon readout beside the mounts: name, damage and how it fires
    const weapons = run.placed.filter((pl) => pl.lane === lane);
    const rx0 = box.x + 20 + run.slotsPerLane * (slotSize + slotGap) + 8;
    const rw = box.x + box.w - 18 - rx0;
    if (weapons.length && rw > 90) {
      let ry = sy - 17;
      for (const p of weapons) {
        const wid = `w:${p.def.id}`;
        const sh = app.kit.hoverAmt(wid);
        app.kit.hot({
          id: wid,
          x: rx0 - 4,
          y: ry - 10,
          w: rw,
          h: 20,
          tip: {
            title: p.def.word.toUpperCase(),
            lines: [
              { text: `${p.def.damage} damage  ·  ${p.def.range} range  ·  ${p.def.cooldown}s cooldown`, color: C.ink },
              { text: TRAITS[p.def.trait].blurb, color: TRAITS[p.def.trait].color },
              ...(p.def.polar.includes('pos') ? [{ text: 'CHARGED: marks enemies on hit (+16% damage taken).', color: C.cyan }] : []),
              ...(p.def.polar.includes('neg') ? [{ text: 'CORRODES: strips 30% of enemy armour on hit.', color: C.ember }] : []),
              ...p.def.mods.map((m) => ({ text: m.toUpperCase(), color: C.dim })),
            ],
            width: 300,
          },
        });
        const col = TRAITS[p.def.trait].color;
        circle(g, rx0, ry, 3.4, alpha(col, 0.9 + sh * 0.1));
        g.fill();
        text(g, p.def.word.toUpperCase(), rx0 + 10, ry, {
          size: T.tiny + 1,
          weight: 700,
          color: sh > 0.4 ? C.ink : mix(C.ink, C.dim, 0.35),
          font: F.slab,
          baseline: 'middle',
          track: 0.8,
          max: rw - 76,
        });
        text(g, `${p.def.damage}`, rx0 + rw, ry, {
          size: T.tiny + 1,
          weight: 700,
          color: col,
          font: F.num,
          align: 'right',
          baseline: 'middle',
        });
        ry += 21;
        if (ry > sy + 34) break;
      }
    }
  }
}

function drawBottom(g: Ctx, app: App, wave: ReturnType<typeof previewWave>): void {
  const box = BOT_BOX;
  panel(g, box.x, box.y, box.w, box.h, { fill: C.bg1, stroke: C.line, r: R.lg });
  text(g, `NEXT: ${wave.note}`, box.x + 18, box.y + 22, {
    size: T.small,
    weight: 700,
    color: wave.boss ? C.blood : wave.elite ? C.rose : C.ink,
    font: F.ui,
    baseline: 'middle',
    track: 1.2,
  });
  text(g, `${wave.count} ENEMIES  ·  ${wave.reward} SALVAGE`, box.x + 18, box.y + 44, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1,
  });

  const kinds = [...new Set(wave.kinds)];
  const kx0 = box.x + 18 + Math.max(
    textWidth(g, `NEXT: ${wave.note}`, { size: T.small, weight: 700, font: F.ui, track: 1.2 }),
    textWidth(g, `${wave.count} ENEMIES  ·  ${wave.reward} SALVAGE`, { size: T.micro, weight: 700, font: F.num, track: 1 }),
  ) + 26;
  let kx = kx0;
  const ky = box.y + 39;
  for (const k of kinds) {
    const def = ENEMIES[k];
    const sid = `enemy:${k}`;
    const count = wave.kinds.filter((x) => x === k).length;
    app.kit.hot({
      id: sid,
      x: kx,
      y: ky - 15,
      w: 30,
      h: 30,
      tip: {
        title: `${def.name.toUpperCase()}  x${count}`,
        lines: [
          { text: ENEMY_TIP[k] },
          { text: `${Math.round(def.hp * wave.hpMul)} hp  ·  ${def.speed} speed  ·  ${def.armor} armour  ·  ${def.damage} core damage`, color: C.faint },
        ],
        width: 300,
      },
    });
    const hv = app.kit.hoverAmt(sid);
    slab(g, def.name[0].toUpperCase(), kx + 15, ky, 30, {
      fill: mix(C.bg1, def.tint, 0.26 + hv * 0.2),
      ink: mix(C.ink, def.tint, 0.4),
      r: 8,
      lift: false,
    });
    text(g, `x${count}`, kx + 34, ky, {
      size: T.micro,
      weight: 700,
      color: C.dim,
      font: F.num,
      baseline: 'middle',
    });
    kx += 62;
  }

  // legend, right aligned
  const legend: [string, string][] = [
    ['cascade', 'kills in a row'],
    ['CHARGED', 'marks (+16% dmg)'],
    ['CORRODE', 'strips armour'],
  ];
  let lx = box.x + box.w - 18;
  for (const [term, meaning] of legend.slice().reverse()) {
    const mw = textWidth(g, meaning, { size: T.micro, weight: 500, font: F.ui });
    text(g, meaning, lx - mw, ky, {
      size: T.micro,
      weight: 500,
      color: C.faint,
      font: F.ui,
      baseline: 'middle',
    });
    const tw = textWidth(g, term, { size: T.micro + 1, weight: 700, font: F.num, track: 0.8 });
    text(g, term, lx - mw - tw - 10, ky, {
      size: T.micro + 1,
      weight: 700,
      color: term === 'cascade' ? C.violet : term === 'CHARGED' ? C.cyan : C.ember,
      font: F.num,
      baseline: 'middle',
      track: 0.8,
    });
    lx -= mw + tw + 40;
  }
}

function boonText(id: string): string {
  const b = BLESSING_BY_ID.get(id);
  return b ? `${b.name} - ${b.blurb}` : 'A blessing from the shrine.';
}
