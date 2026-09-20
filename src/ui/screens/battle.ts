/** Battle view: the arena, the console, the cascade feed. */
import { C, F, R, SIZE, T } from '../../theme';
import { alpha, circle, icon, mix, panel, rr, slab, text, type Ctx } from '../../core/draw';
import { clamp, easeOut } from '../../core/rng';
import { sfx } from '../../core/audio';
import { Battle, BOX, CORE_X, LANE_H, laneY } from '../../game/battle';
import { ENEMIES } from '../../game/enemies';
import { TRAITS } from '../../game/forge';
import { refillRack, saveRun, salvageMul, type RunState } from '../../game/run';
import { button, heading, iconButton, meter } from '../kit';
import { enemyTile, weaponTower } from '../tiles';
import type { Fx } from '../../game/types';
import type { App, Screen } from '../../app';

const CONSOLE = { x: 20, y: 68, w: 322, h: 632 };
const BOTTOM = { x: 20, y: 716, w: SIZE.w - 40, h: 78 };

const SPEEDS = [1, 2, 3];

export function createBattleScreen(): Screen {
  let speedIdx = 0;
  let clearT = 0;
  let failT = 0;
  let shakeX = 0;
  let shakeY = 0;
  let t = 0;
  let app!: App;

  const speed = (): number => SPEEDS[speedIdx];

  const endWave = (b: Battle, run: RunState, won: boolean): void => {
    run.core = Math.max(0, b.coreHp);
    run.flux = b.flux;
    run.stats.kills += b.killed;
    run.stats.damage += Math.round(b.damageDealt);
    run.stats.bestCascade = Math.max(run.stats.bestCascade, b.bestCascade);
    run.history.push({
      wave: run.wave,
      core: Math.round(b.coreHp),
      killed: b.killed,
      cascade: b.bestCascade,
      note: b.wave.note,
    });
    if (won) {
      const earned = Math.round(b.salvage * salvageMul(run));
      run.salvage += earned;
      run.stats.salvageEarned += earned;
      run.stats.wavesCleared++;
      run.wave += 1;
      run.eliteNext = false;
      run.salvageBonus = 0;
      refillRack(run);
    } else {
      run.over = true;
    }
    saveRun(run);
  };

  const screen: Screen = {
    id: 'battle',
    enter(a) {
      app = a;
      speedIdx = 0;
      clearT = 0;
      failT = 0;
      t = 0;
    },
    exit() {
      app.battle = null;
    },
    update(dt, a) {
      app = a;
      t += dt;
      const b = app.battle;
      if (!b) return;
      if (!app.paused) b.update(dt, speed());
      const target = b.shake;
      shakeX = (Math.random() - 0.5) * target * 2;
      shakeY = (Math.random() - 0.5) * target * 2;

      if (b.phase === 'cleared') {
        clearT += dt;
        if (clearT > 2.1) {
          const run = app.run;
          if (run) {
            endWave(b, run, true);
            sfx.win();
            app.goto('spoils');
          }
        }
      } else if (b.phase === 'failed') {
        failT += dt;
        if (failT > 2.4) {
          const run = app.run;
          if (run) {
            endWave(b, run, false);
            sfx.lose();
            app.goto('summary');
          }
        }
      }
    },
    key(e, a) {
      app = a;
      const b = app.battle;
      if (!b) return false;
      if (e.key === 'Escape') {
        app.paused = !app.paused;
        sfx.uiBack();
        return true;
      }
      if (e.key === ' ') {
        app.paused = !app.paused;
        return true;
      }
      if (e.key === 'f' || e.key === 'F') {
        speedIdx = (speedIdx + 1) % SPEEDS.length;
        sfx.ui();
        return true;
      }
      if (e.key === '1' && b.useAbility('purge')) sfx.hit('BLAST');
      if (e.key === '2' && b.useAbility('surge')) sfx.ui();
      return false;
    },
    click(id, a) {
      app = a;
      const b = app.battle;
      if (!b) return;
      if (id === 'pause') app.paused = !app.paused;
      else if (id === 'speed') {
        speedIdx = (speedIdx + 1) % SPEEDS.length;
        sfx.ui();
      } else if (id === 'mute') {
        sfx.setMuted(!sfx.muted);
      } else if (id === 'help') app.goto('help');
      else if (id === 'resume') app.paused = false;
      else if (id === 'purge') {
        if (b.useAbility('purge')) sfx.hit('BLAST');
        else sfx.reject();
      } else if (id === 'surge') {
        if (b.useAbility('surge')) sfx.ui();
        else sfx.reject();
      } else if (id === 'abandon') {
        const run = app.run;
        if (run) {
          run.over = true;
          saveRun(run);
        }
        app.goto('summary');
      }
    },
    draw(g, a) {
      app = a;
      const run = app.run;
      const b = app.battle;
      if (!run || !b) return;

      g.fillStyle = '#07090f';
      g.fillRect(0, 0, SIZE.w, SIZE.h);

      g.save();
      g.translate(shakeX, shakeY);

      drawArena(g, app, b);
      drawConsole(g, app, run, b);
      drawBottom(g, b);
      g.restore();

      drawHud(g, app, run, b, speed());

      if (b.phase === 'ready') drawCountdown(g, b);
      if (b.phase === 'cleared') drawBanner(g, 'WAVE CLEARED', C.good, easeOut(clamp(clearT / 0.5, 0, 1)));
      if (b.phase === 'failed') drawBanner(g, 'CORE BREACHED', C.bad, easeOut(clamp(failT / 0.5, 0, 1)));
      if (app.paused) drawPause(g, app, run, b);

    },
  };

  return screen;
}

// ---------------------------------------------------------------------------
function drawArena(g: Ctx, app: App, b: Battle): void {
  const kit = app.kit;
  const h = BOX.bot - BOX.top;

  panel(g, BOX.l, BOX.top, BOX.r - BOX.l, h, {
    fill: 'rgba(11,14,24,0.72)',
    stroke: alpha(C.line, 0.7),
    r: R.lg,
  });

  // lanes
  for (let i = 0; i < 5; i++) {
    const y = laneY(i);
    const top = y - LANE_H / 2;
    if (i % 2 === 0) {
      g.fillStyle = 'rgba(255,255,255,0.014)';
      g.fillRect(BOX.l + 1, top, BOX.r - BOX.l - 2, LANE_H);
    }
    g.fillStyle = alpha(C.line, 0.5);
    g.fillRect(BOX.l + 1, top, BOX.r - BOX.l - 2, 1);

    // lane rail
    g.fillStyle = alpha(C.lineHi, 0.35);
    g.fillRect(BOX.l + 16, y + LANE_H / 2 - 10, BOX.r - BOX.l - 32, 1);

    text(g, `${i + 1}`, BOX.l + 16, y, {
      size: T.small,
      weight: 700,
      color: alpha(C.faint, 0.9),
      font: F.num,
      align: 'center',
      baseline: 'middle',
    });
    const front = b.lanePool.includes(i);
    if (front && b.phase === 'fight') {
      const p = (b.time * 0.7 + i * 0.4) % 1;
      g.fillStyle = alpha(C.rose, 0.05 + 0.05 * (1 - p));
      g.fillRect(BOX.l + 1, top, BOX.r - BOX.l - 2, LANE_H);
    }
  }

  // spawn portal
  const grad = g.createLinearGradient(BOX.r - 60, 0, BOX.r, 0);
  grad.addColorStop(0, alpha(C.bad, 0));
  grad.addColorStop(1, alpha(C.bad, 0.1));
  g.fillStyle = grad;
  g.fillRect(BOX.r - 60, BOX.top + 1, 60, h - 2);
  g.fillStyle = alpha(C.bad, 0.35);
  g.fillRect(BOX.r - 2, BOX.top + 1, 2, h - 2);

  // core column
  const corePct = clamp(b.coreHp / b.maxCoreHp, 0, 1);
  const flash = b.coreFlash;
  g.save();
  g.shadowBlur = 20 + flash * 30;
  g.shadowColor = alpha(corePct < 0.34 ? C.bad : C.cyan, 0.6 + flash * 0.4);
  g.fillStyle = alpha(corePct < 0.34 ? C.bad : C.cyan, 0.5 + flash * 0.4);
  g.fillRect(CORE_X - 10, BOX.top + 6, 6, h - 12);
  g.restore();
  // segmented charge beside the core
  const segs = 12;
  const segH = (h - 30) / segs;
  for (let i = 0; i < segs; i++) {
    const on = corePct > i / segs;
    g.fillStyle = on ? alpha(corePct < 0.34 ? C.bad : C.good, 0.75) : alpha(C.ghost, 0.6);
    g.fillRect(CORE_X - 20, BOX.top + 14 + i * segH, 4, segH - 3);
  }
  circle(g, CORE_X - 3, BOX.top + h / 2, 5, alpha(C.cyan, 0.9));
  g.fill();

  // mount sockets
  for (const tower of b.towers) {
    const id = `tower:${tower.id}`;
    kit.hot({
      id,
      x: tower.x - 22,
      y: tower.y - 22,
      w: 44,
      h: 44,
      tip: {
        title: tower.word.toUpperCase(),
        lines: [
          { text: `${tower.damage} damage  ·  ${(1 / tower.cooldown).toFixed(2)} shots/s`, color: C.ink },
          { text: `${tower.kills} kills this wave`, color: C.dim },
          { text: TRAITS[tower.trait].blurb, color: TRAITS[tower.trait].color },
          ...tower.mods.map((m) => ({ text: m.toUpperCase(), color: C.dim })),
        ],
        width: 280,
      },
    });
  }

  // range indicator for hovered tower
  const hovered = b.towers.find((tw) => kit.isHover(`tower:${tw.id}`));
  if (hovered && hovered.aoe > 0) {
    circle(g, hovered.x, hovered.y, hovered.range);
    g.fillStyle = alpha(C.gold, 0.05);
    g.fill();
    circle(g, hovered.x, hovered.y, hovered.range);
    g.strokeStyle = alpha(C.gold, 0.35);
    g.setLineDash([4, 6]);
    g.lineWidth = 1;
    g.stroke();
    g.setLineDash([]);
  }

  // mounted weapons
  for (const tower of b.towers) {
    const chilled = b.towerChill > 0;
    weaponTower(g, {
      x: tower.x,
      y: tower.y,
      def: tower,
      flash: tower.flash,
      recoil: tower.recoil,
      aim: tower.aim,
      hover: kit.hoverAmt(`tower:${tower.id}`),
      time: b.time,
      chilled,
    });
  }

  // enemies
  for (const e of b.enemies) {
    const id = `enemy:${e.uid}`;
    const def = ENEMIES[e.kind];
    app.kit.hot({
      id,
      x: e.x - e.size / 2,
      y: e.y - e.size / 2,
      w: e.size,
      h: e.size,
      tip: {
        title: `${def.name.toUpperCase()}`,
        lines: [
          { text: `${Math.ceil(e.hp)} / ${e.maxHp} hp`, color: C.ink },
          { text: `${e.armor.toFixed(1)} armour  ·  ${e.damage} core damage`, color: C.dim },
          ...(e.slowT > 0 ? [{ text: `SLOWED ${Math.round(e.slowAmt * 100)}%`, color: C.cyan }] : []),
          ...(e.markT > 0 ? [{ text: 'MARKED: takes +16% damage', color: C.cyan }] : []),
          ...(e.corrT > 0 ? [{ text: 'CORRODED: armour stripped 30%', color: C.ember }] : []),
        ],
        width: 250,
      },
    });
    enemyTile(g, { e, time: b.time, laneH: LANE_H });
  }

  // projectiles
  for (const p of b.projs) {
    if (p.arc) {
      g.save();
      g.shadowBlur = 16;
      g.shadowColor = p.color;
      circle(g, p.x, p.y, p.size + 1);
      g.fillStyle = mix(p.color, '#ffffff', 0.4);
      g.fill();
      g.restore();
      circle(g, p.x, p.y + 6, p.size * 0.6, alpha(C.ember, 0.35));
      g.fill();
    } else {
      const tail = p.trail.length >= 4 ? { x: p.trail[p.trail.length - 4], y: p.trail[p.trail.length - 3] } : { x: p.x - p.vx * 20, y: p.y - p.vy * 20 };
      g.save();
      g.strokeStyle = alpha(p.color, 0.5);
      g.lineWidth = p.size * 1.5;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(tail.x, tail.y);
      g.lineTo(p.x, p.y);
      g.stroke();
      g.shadowBlur = 12;
      g.shadowColor = p.color;
      circle(g, p.x, p.y, p.size);
      g.fillStyle = mix(p.color, '#ffffff', 0.65);
      g.fill();
      g.restore();
    }
  }

  // fx
  for (const f of b.fx) drawFx(g, f);
}

function drawFx(g: Ctx, f: Fx): void {
  const p = clamp(f.life / f.max, 0, 1);
  switch (f.kind) {
    case 'spark':
      g.save();
      g.globalAlpha = p;
      circle(g, f.x, f.y, f.size * (0.4 + p * 0.8));
      g.fillStyle = f.color;
      g.fill();
      g.restore();
      break;
    case 'ring': {
      const r = (f.size / 2) * (1 - p * p);
      g.save();
      g.globalAlpha = p * 0.45;
      circle(g, f.x, f.y, Math.max(1, r));
      g.strokeStyle = f.color;
      g.lineWidth = 1.5 + p * 3;
      g.stroke();
      g.restore();
      break;
    }
    case 'boom': {
      const r = (f.size / 2) * (1 - p * 0.8);
      const k = Math.max(0.001, r);
      const grad = g.createRadialGradient(f.x, f.y, 0, f.x, f.y, k);
      grad.addColorStop(0, alpha('#ffffff', 0.5 * p));
      grad.addColorStop(0.2, alpha(C.gold, 0.35 * p));
      grad.addColorStop(0.5, alpha(f.color, 0.28 * p));
      grad.addColorStop(1, alpha(f.color, 0));
      g.save();
      circle(g, f.x, f.y, k);
      g.fillStyle = grad;
      g.fill();
      g.restore();
      break;
    }
    case 'beam': {
      const x2 = f.amount ?? f.x;
      const y2 = f.lane ?? f.y;
      g.save();
      g.globalAlpha = p;
      g.strokeStyle = f.color;
      g.lineWidth = 2 + p * 3;
      g.shadowBlur = 12;
      g.shadowColor = f.color;
      g.beginPath();
      for (let i = 0; i <= 6; i++) {
        const k = i / 6;
        const jx = f.x + (x2 - f.x) * k + Math.sin(k * 9 + f.life * 40) * 5;
        const jy = f.y + (y2 - f.y) * k + Math.cos(k * 11 + f.life * 40) * 5;
        i === 0 ? g.moveTo(jx, jy) : g.lineTo(jx, jy);
      }
      g.stroke();
      g.restore();
      break;
    }
    case 'text':
      g.save();
      g.globalAlpha = p;
      text(g, f.text ?? '', f.x, f.y - (1 - p) * 26, {
        size: f.size,
        weight: 700,
        font: F.num,
        color: f.color,
        align: 'center',
        baseline: 'middle',
        glow: alpha(f.color, 0.8 * p),
        glowSize: 14,
      });
      g.restore();
      break;
    default:
      break;
  }
}

function drawConsole(g: Ctx, app: App, run: RunState, b: Battle): void {
  const box = CONSOLE;
  panel(g, box.x, box.y, box.w, box.h, { fill: 'rgba(13,16,27,0.9)', stroke: C.line, r: R.lg });

  // wave block
  heading(g, b.wave.note, box.x + 16, box.y + 26, {
    size: T.lead,
    color: b.wave.boss ? C.blood : C.ink,
  });
  text(g, `${b.killed} KILLED  ·  ${b.leaked} LEAKED  ·  ${b.enemies.length + (b.wave.kinds.length - b.spawned)} LEFT`, box.x + 16, box.y + 50, {
    size: T.micro + 1,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 0.8,
  });

  // abilities
  const ay = box.y + 74;
  drawAbility(g, app, {
    id: 'purge',
    x: box.x + 16,
    y: ay,
    w: box.w - 32,
    h: 52,
    name: 'PURGE',
    blurb: 'Damage every enemy on screen',
    cost: b.abilityCost.purge,
    ready: b.purgeCd <= 0 && b.flux >= b.abilityCost.purge,
    cd: b.purgeCd,
    cdMax: 6,
    color: C.gold,
    icon: 'star',
    key: '1',
  });
  drawAbility(g, app, {
    id: 'surge',
    x: box.x + 16,
    y: ay + 60,
    w: box.w - 32,
    h: 52,
    name: 'OVERDRIVE',
    blurb: '+60% fire rate for 5s',
    cost: b.abilityCost.surge,
    ready: b.surgeT <= 0 && b.flux >= b.abilityCost.surge,
    cd: b.surgeT,
    cdMax: 5,
    color: C.lime,
    icon: 'bolt',
    key: '2',
  });

  // arsenal, right below the abilities so the space earns its keep
  const sy = ay + 136;
  divider(g, box.x + 16, sy - 16, box.w - 32);
  text(g, `ARSENAL  ·  ${run.placed.length}`, box.x + 16, sy, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.4,
  });
  let wy = sy + 22;
  for (const p of run.placed.slice(0, 6)) {
    const tower = b.towers.find((tw) => tw.id === p.def.id);
    const col = TRAITS[p.def.trait].color;
    circle(g, box.x + 22, wy, 3, col);
    g.fill();
    text(g, p.def.word.toUpperCase(), box.x + 32, wy, {
      size: T.tiny,
      weight: 700,
      color: C.ink,
      font: F.slab,
      baseline: 'middle',
      track: 0.8,
      max: 150,
    });
    text(g, `L${p.lane + 1}  ${Math.round(p.def.damage / p.def.cooldown)}dps${tower && tower.kills ? `  ${tower.kills}k` : ''}`, box.x + box.w - 16, wy, {
      size: T.micro + 1,
      weight: 700,
      color: C.dim,
      font: F.num,
      align: 'right',
      baseline: 'middle',
      track: 0.4,
    });
    wy += 22;
  }
  if (!run.placed.length) {
    text(g, 'No weapons mounted', box.x + 32, wy, {
      size: T.tiny,
      weight: 500,
      color: C.faint,
      font: F.ui,
      baseline: 'middle',
    });
  }
}

function divider(g: Ctx, x: number, y: number, w: number): void {
  g.fillStyle = alpha(C.line, 0.8);
  g.fillRect(x, y, w, 1);
}

function drawAbility(
  g: Ctx,
  app: App,
  o: {
    id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    name: string;
    blurb: string;
    cost: number;
    ready: boolean;
    cd: number;
    cdMax: number;
    color: string;
    icon: 'star' | 'bolt';
    key: string;
  },
): void {
  const b = app.battle!;
  const affordable = b.flux >= o.cost && o.cd <= 0;
  const hv = app.kit.hoverAmt(o.id);
  app.kit.hot({
    id: o.id,
    x: o.x,
    y: o.y,
    w: o.w,
    h: o.h,
    disabled: !affordable,
    tip: {
      title: o.name,
      lines: [
        { text: o.blurb },
        { text: `Costs ${o.cost} charge. Charge builds from kills and cascades.`, color: C.faint },
      ],
      width: 260,
    },
  });
  g.save();
  g.globalAlpha = affordable ? 1 : 0.5;
  rr(g, o.x, o.y, o.w, o.h, R.md);
  const grad = g.createLinearGradient(0, o.y, 0, o.y + o.h);
  grad.addColorStop(0, alpha(o.color, 0.16 + hv * 0.16));
  grad.addColorStop(1, alpha(o.color, 0.05));
  g.fillStyle = grad;
  g.fill();
  rr(g, o.x + 0.5, o.y + 0.5, o.w - 1, o.h - 1, R.md - 0.5);
  g.strokeStyle = alpha(o.color, affordable ? 0.55 + hv * 0.4 : 0.25);
  g.lineWidth = 1;
  g.stroke();
  if (o.cd > 0) {
    rr(g, o.x + 1, o.y + 1, (o.w - 2) * (1 - o.cd / o.cdMax), o.h - 2, R.md - 1);
    g.fillStyle = alpha(o.color, 0.16);
    g.fill();
  }
  icon(g, o.icon, o.x + 26, o.y + o.h / 2, 20, o.color, true);
  text(g, o.name, o.x + 46, o.y + 19, {
    size: T.small,
    weight: 700,
    color: C.ink,
    font: F.ui,
    baseline: 'middle',
    track: 1,
  });
  text(g, o.blurb, o.x + 46, o.y + 35, {
    size: T.micro + 1,
    weight: 500,
    color: C.dim,
    font: F.ui,
    baseline: 'middle',
    max: o.w - 110,
  });
  text(g, `${o.cost}`, o.x + o.w - 14, o.y + 19, {
    size: T.small,
    weight: 700,
    color: affordable ? C.gold : C.faint,
    font: F.num,
    align: 'right',
    baseline: 'middle',
  });
  text(g, o.key, o.x + o.w - 14, o.y + 36, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    align: 'right',
    baseline: 'middle',
  });
  g.restore();
}

function drawBottom(g: Ctx, b: Battle): void {
  const box = BOTTOM;
  panel(g, box.x, box.y, box.w, box.h, { fill: 'rgba(13,16,27,0.9)', stroke: C.line, r: R.lg });
  text(g, 'INBOUND', box.x + 16, box.y + 20, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.6,
  });
  const counts = new Map<string, number>();
  for (const item of b.spawnQueue) counts.set(item.kind, (counts.get(item.kind) ?? 0) + 1);
  let x = box.x + 96;
  const y = box.y + 32;
  for (const [kind, n] of counts) {
    const def = ENEMIES[kind as keyof typeof ENEMIES];
    slab(g, def.name[0].toUpperCase(), x + 13, y, 26, {
      fill: mix(C.bg1, def.tint, 0.24),
      ink: mix(C.ink, def.tint, 0.4),
      r: 7,
      lift: false,
    });
    text(g, `x${n}`, x + 30, y, {
      size: T.tiny,
      weight: 700,
      color: C.dim,
      font: F.num,
      baseline: 'middle',
      track: 0.4,
    });
    x += 54;
    if (x > box.x + box.w - 360) break;
  }
  if (!counts.size) {
    text(
      g,
      b.phase === 'cleared'
        ? 'Wave cleared'
        : b.enemies.length
          ? 'Last of them on the field'
          : 'All enemies deployed',
      x,
      y,
      { size: T.tiny, weight: 500, color: C.faint, font: F.ui, baseline: 'middle' },
    );
  }

  // engine charge readout
  const mx = box.x + box.w - 300;
  const pct = b.charge;
  text(g, 'ENGINE', mx, box.y + 20, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.6,
  });
  text(g, `+${Math.round((b.globalMul - 1) * 100)}% DAMAGE`, mx + 280, box.y + 20, {
    size: T.micro + 1,
    weight: 700,
    color: pct > 0.6 ? C.gold : C.dim,
    font: F.num,
    align: 'right',
    baseline: 'middle',
    track: 0.8,
  });
  meter(g, { x: mx, y: box.y + 32, w: 280, h: 16, pct, color: C.gold });
  text(g, `${Math.floor(b.flux)} / ${b.fluxMax}`, mx + 140, box.y + 58, {
    size: T.micro + 1,
    weight: 700,
    color: C.gold,
    font: F.num,
    align: 'center',
    baseline: 'middle',
  });
}

function drawHud(g: Ctx, app: App, run: RunState, b: Battle, spd: number): void {
  panel(g, 0, 0, SIZE.w, 58, { fill: 'rgba(10,13,22,0.95)', stroke: alpha(C.line, 0.7), r: 0 });
  g.fillStyle = alpha(C.gold, 0.4);
  g.fillRect(0, 57, SIZE.w, 1);

  // core
  const corePct = clamp(b.coreHp / b.maxCoreHp, 0, 1);
  const coreCol = corePct < 0.34 ? C.bad : corePct < 0.6 ? C.warn : C.good;
  icon(g, 'heart', 30, 29, 20, coreCol, true);
  text(g, 'CORE', 48, 20, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.4,
  });
  text(g, `${Math.max(0, Math.round(bt(b.coreHp)))}`, 48, 40, {
    size: T.body,
    weight: 700,
    color: coreCol,
    font: F.num,
    baseline: 'middle',
  });
  meter(g, {
    x: 100,
    y: 22,
    w: 160,
    h: 14,
    pct: corePct,
    color: coreCol,
    ghost: undefined,
  });

  // wave
  text(g, `WAVE ${b.wave.index}`, 300, 20, {
    size: T.small,
    weight: 700,
    color: C.ink,
    font: F.ui,
    baseline: 'middle',
    track: 1.4,
  });
  text(g, b.wave.note, 300, 40, {
    size: T.micro + 1,
    weight: 700,
    color: b.wave.boss ? C.blood : b.wave.elite ? C.rose : C.dim,
    font: F.num,
    baseline: 'middle',
    track: 1,
  });
  const spawnedPct = b.wave.kinds.length ? b.spawned / b.wave.kinds.length : 1;
  meter(g, { x: 440, y: 22, w: 140, h: 14, pct: spawnedPct, color: C.cyan });

  // cascade
  const lvl = b.cascadeLevel;
  const cx = 640;
  text(g, 'CASCADE', cx, 20, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 1.6,
  });
  text(g, `x${lvl}`, cx, 40, {
    size: 21,
    weight: 700,
    color: lvl > 0 ? C.violet : C.faint,
    font: F.num,
    baseline: 'middle',
    glow: lvl > 0 ? alpha(C.violet, 0.8) : undefined,
    glowSize: 14,
  });
  meter(g, {
    x: cx + 44,
    y: 26,
    w: 120,
    h: 10,
    pct: clamp(b.comboT / 2.6, 0, 1),
    color: C.violet,
  });
  text(g, `${b.combo} KILL CHAIN`, cx + 44, 44, {
    size: T.micro,
    weight: 700,
    color: C.faint,
    font: F.num,
    baseline: 'middle',
    track: 0.8,
  });

  // controls
  const ctrlY = 13;
  let x = SIZE.w - 46;
  iconButton(g, app.kit, {
    id: 'help',
    x,
    y: ctrlY,
    s: 32,
    icon: 'map',
    tip: { lines: [{ text: 'Reference: letters, traits, enemies.' }] },
  });
  x -= 40;
  iconButton(g, app.kit, {
    id: 'mute',
    x,
    y: ctrlY,
    s: 32,
    icon: sfx.muted ? 'mute' : 'sound',
    tip: { lines: [{ text: sfx.muted ? 'Sound off' : 'Sound on' }] },
  });
  x -= 40;
  iconButton(g, app.kit, {
    id: 'pause',
    x,
    y: ctrlY,
    s: 32,
    icon: app.paused ? 'play' : 'pause',
    tip: { lines: [{ text: 'Pause (Space)' }] },
  });
  x -= 62;
  button(g, app.kit, {
    id: 'speed',
    x,
    y: ctrlY,
    w: 54,
    h: 32,
    label: `${spd}`,
    sub: undefined,
    tone: 'ghost',
    size: T.small,
    radius: R.sm,
    tip: { lines: [{ text: 'Cycle battle speed (F)' }] },
  });
  void run;
}

function drawCountdown(g: Ctx, b: Battle): void {
  const p = clamp(1 - b.countdown / 3.4, 0, 1);
  g.save();
  g.globalAlpha = 0.5 * (1 - p);
  g.fillStyle = '#05070d';
  g.fillRect(BOX.l, BOX.top, BOX.r - BOX.l, BOX.bot - BOX.top);
  g.restore();
  const n = Math.ceil(b.countdown);
  const frac = b.countdown - Math.floor(b.countdown);
  g.save();
  g.globalAlpha = clamp(1 - frac, 0.2, 1);
  text(g, `${n}`, (BOX.l + BOX.r) / 2, (BOX.top + BOX.bot) / 2 - 10, {
    size: 120,
    weight: 700,
    color: C.ink,
    font: F.num,
    align: 'center',
    baseline: 'middle',
    glow: alpha(C.gold, 0.6),
    glowSize: 40,
  });
  g.restore();
  text(g, 'ENGINE SPINNING UP', (BOX.l + BOX.r) / 2, (BOX.top + BOX.bot) / 2 + 76, {
    size: T.small,
    weight: 700,
    color: C.faint,
    font: F.num,
    align: 'center',
    baseline: 'middle',
    track: 3,
  });
}

function drawBanner(g: Ctx, label: string, color: string, p: number): void {
  const y = SIZE.h * 0.42;
  g.save();
  g.globalAlpha = p;
  g.fillStyle = alpha('#05070d', 0.55 * p);
  g.fillRect(0, y - 60, SIZE.w, 120);
  g.fillStyle = alpha(color, 0.6);
  g.fillRect(0, y - 60, SIZE.w, 1);
  g.fillRect(0, y + 59, SIZE.w, 1);
  text(g, label, SIZE.w / 2, y, {
    size: 46,
    weight: 700,
    color,
    font: F.ui,
    align: 'center',
    baseline: 'middle',
    track: 8,
    glow: alpha(color, 0.7),
    glowSize: 26,
  });
  g.restore();
}

function drawPause(g: Ctx, app: App, run: RunState, b: Battle): void {
  g.save();
  g.fillStyle = 'rgba(5,7,13,0.78)';
  g.fillRect(0, 0, SIZE.w, SIZE.h);
  const w = 460;
  const h = 320;
  const x = SIZE.w / 2 - w / 2;
  const y = SIZE.h / 2 - h / 2;
  panel(g, x, y, w, h, {
    fill: 'rgba(16,20,33,0.98)',
    stroke: alpha(C.gold, 0.4),
    r: R.lg,
    shadow: 40,
  });
  heading(g, 'Paused', x + 24, y + 40, { size: T.head, sub: 'The wave waits for you.' });
  const rows: [string, string][] = [
    ['Wave', `${b.wave.index}  ·  ${b.wave.note}`],
    ['Core', `${Math.max(0, Math.round(b.coreHp))} / ${b.maxCoreHp}`],
    ['Killed', `${b.killed} enemies`],
    ['Best cascade', `x${b.bestCascade}`],
    ['Salvage so far', `${Math.round(b.salvage)}`],
  ];
  let ry = y + 96;
  for (const [k, v] of rows) {
    text(g, k.toUpperCase(), x + 28, ry, {
      size: T.micro,
      weight: 700,
      color: C.faint,
      font: F.num,
      baseline: 'middle',
      track: 1.2,
    });
    text(g, v, x + w - 28, ry, {
      size: T.small,
      weight: 700,
      color: C.ink,
      font: F.num,
      align: 'right',
      baseline: 'middle',
    });
    ry += 26;
  }
  button(g, app.kit, {
    id: 'resume',
    x: x + 28,
    y: y + h - 68,
    w: 180,
    h: 44,
    label: 'RESUME',
    icon: 'play',
    tone: 'primary',
  });
  button(g, app.kit, {
    id: 'abandon',
    x: x + w - 168,
    y: y + h - 68,
    w: 140,
    h: 44,
    label: 'ABANDON',
    tone: 'ghost',
    size: T.tiny + 1,
  });
  g.restore();
  void run;
}

const bt = (v: number): number => Math.max(0, v);
