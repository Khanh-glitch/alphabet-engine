/**
 * Battle screen.
 *
 * Owns the frame loop for one encounter: fixed-step simulation at the player's
 * chosen speed, event-to-feedback translation, the HUD, and the single combat
 * intervention (the wildcard). All game state lives in `Battle`.
 */
import { C, VIEW } from '../../core/theme';
import { label, plate, rgba, rr, tile, type Ctx } from '../../core/draw';
import { loc, t } from '../../core/i18n';
import { sfx } from '../../core/audio';
import { store } from '../../core/save';
import { TUNE } from '../../content/tuning';


import { FxLayer } from '../../render/fx';
import { drawArena, enemyHitRect } from '../../render/arena';
import {
  drawHud,
  cardRect,
  socketGeom,
  LETTER_FLIGHT,
  BAGBOX,
  TRAY,
  WILD_RECT,
  type HudFlight,
} from '../battleHud';
import type { Battle } from '../../battle/battle';
import { openHowTo } from './howto';
import type { Screen } from '../../app/app';

const STEP = 1 / 120;

export function createBattleScreen(): Screen {
  const fx = new FxLayer();
  let acc = 0;
  let inspectSlot: number | null = null;
  let wildcardMode = false;
  let endTimer = -1;
  let hintT = 0;
  let hint: string | null = null;
  let hintTarget: 'pool' | 'recipes' | 'carriers' | 'wildcard' | null = null;
  /**
   * Tiles currently flying into sockets.
   *
   * The simulation routes a letter the instant it arrives, so the flight lives
   * with the screen: the sim stays deterministic and time-independent, and the
   * animation owns presentation only.
   */
  let flights: HudFlight[] = [];
  let flightZ = 0;

  /** Where a routed letter should fly to, in HUD space. */
  const destinationOf = (
    battle: Battle,
    slot: number,
    socket: number,
  ): { x: number; y: number; size: number } => {
    if (slot < 0) {
      // Reserve-bound: land on the tray position it will actually occupy.
      const idx = Math.max(0, battle.machine.reserve.length - 1);
      return { x: TRAY.x + 118 + 21 + idx * 49, y: TRAY.y + TRAY.h / 2 - 8, size: 42 };
    }
    const bp = battle.slots[slot];
    if (!bp) return { x: TRAY.x + 140, y: TRAY.y + 30, size: 42 };
    const geom = socketGeom(bp, slot);
    return {
      x: geom.startX + socket * (geom.size + geom.gap) + geom.size / 2,
      y: geom.ty + geom.size / 2,
      size: geom.size,
    };
  };

  /** Wrap text to a pixel width — used by the inspect panel and hints. */
  const wrap = (g: Ctx, text: string, maxW: number): string[] => {
    const words = text.split(' ');
    const lines: string[] = [];
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (g.measureText(test).width > maxW && line) {
        lines.push(line);
        line = w;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  };

  return {
    id: 'battle',
    enter(app) {
      const run = app.run;
      if (!run || run.finished) {
        app.goto('title');
        return;
      }
      app.battle = run.buildBattle();
      fx.clear();
      acc = 0;
      endTimer = -1;
      hintT = 0;
      hint = null;
      hintTarget = null;
      inspectSlot = null;
      wildcardMode = false;
      flights = [];
      flightZ = 0;
    },
    update(dt, app) {
      const battle = app.battle;
      if (!battle) return;

      acc += dt * app.speed;
      let guard = 0;
      while (acc >= STEP && guard++ < 40) {
        battle.update(STEP);
        acc -= STEP;
      }

      fx.absorb(battle.events, {
        shake: store.settings.shake,
        reducedFlashes: store.settings.reducedFlashes,
      });
      for (const ev of battle.events) {
        // Spawn an incoming-letter flight for anything that was routed somewhere.
        if (ev.kind === 'draw') {
          const dest = destinationOf(battle, ev.slot, ev.socket);
          flights.push({
            char: ev.letter,
            fromX: BAGBOX.x + BAGBOX.w - 40,
            fromY: BAGBOX.y + BAGBOX.h / 2,
            toX: dest.x,
            toY: dest.y,
            size: dest.size,
            t: 0,
            z: flightZ++,
          });
        } else if (ev.kind === 'wildcard') {
          // Brief 3.3: the substitution must move into the missing socket rather
          // than mutate the recipe invisibly.
          const dest = destinationOf(battle, ev.slot, ev.socket);
          flights.push({
            char: '?',
            fromX: WILD_RECT.x + WILD_RECT.w / 2,
            fromY: WILD_RECT.y + WILD_RECT.h / 2,
            toX: dest.x,
            toY: dest.y,
            size: dest.size,
            t: 0,
            z: flightZ++,
          });
        } else if (ev.kind === 'letterReturn') {
          const dest = destinationOf(battle, ev.slot, ev.socket);
          flights.push({
            char: ev.letter,
            fromX: ev.x,
            fromY: ev.y + 40,
            toX: dest.x,
            toY: dest.y,
            size: dest.size,
            t: 0,
            z: flightZ++,
            // Provenance, not a timer: this tile exists because a specific craft
            // the player made killed a specific enemy.
            continuesChain: ev.fromBlueprint !== null,
            fromWord: ev.fromBlueprint ?? undefined,
          });
        }
        switch (ev.kind) {
          case 'craftStart':
            sfx.craft(battle.chain);
            break;
          case 'explosion':
            sfx.explosion();
            break;
          case 'ignite':
            sfx.ignite();
            break;
          case 'kill':
            sfx.kill();
            break;
          case 'letterReturn':
            sfx.drop();
            break;
          case 'coreHit':
            sfx.coreHit();
            break;
          case 'wildcard':
            sfx.wildcard();
            break;
          case 'focus':
          case 'mark':
            sfx.ui();
            break;
          case 'cleared':
            sfx.cleared();
            break;
          case 'failed':
            sfx.failed();
            break;
          default:
            break;
        }
      }
      battle.events.length = 0;
      const fstep = dt * app.speed;
      for (const f of flights) f.t += fstep;
      flights = flights.filter((f) => f.t < LETTER_FLIGHT);
      flights.sort((a, b) => a.z - b.z);
      fx.update(dt);

      // Contextual teaching hints, one at a time, never modal.
      hintT = Math.max(0, hintT - dt);
      if (battle.state === 'fight' && hintT <= 0) {
        const enc = battle.cfg.encounter;
        if (battle.telemetry.data.crafts === 0 && enc.teaches === 'craft') {
          hint = t('hintFirstCraft');
          // Point at the recipes while they are still filling: the player needs
          // to know *where* the craft happens, not just that it will.
          hintTarget = battle.machine.committed().length > 0 ? 'recipes' : 'pool';
          hintT = 7;
        } else if (battle.telemetry.data.kills < 2 && battle.enemies.some((e) => e.carry)) {
          hint = t('hintCarrier');
          hintTarget = 'carriers';
          hintT = 7;
        } else if (battle.wildcardsLeft > 0 && battle.targets.length > 0) {
          hint = t('hintWildcard');
          hintTarget = 'wildcard';
          hintT = 6;
        } else {
          hint = null;
          hintTarget = null;
        }
      }

      if (battle.state === 'cleared' || battle.state === 'failed') {
        if (endTimer < 0) endTimer = 1.6;
        endTimer -= dt;
        if (endTimer <= 0) {
          endTimer = -1;
          const run = app.run;
          if (run) {
            run.absorb(battle);
            store.saveRun(run.serialize());
            if (battle.state === 'failed' || run.finished) {
              store.recordRun(run.state.record.longestChain, run.state.record.completed);
              app.goto('summary');
              return;
            }
          }
          // V2 evaluation set has no reward phase between fights (brief 3.12):
          // the point is replaying one encounter until the loop itself is good.
          app.goto(app.run?.mode === 'v2test' && !app.run.finished ? 'battle' : 'spoils');
        }
      }
    },
    draw(g, app) {
      const battle = app.battle;
      if (!battle) return;
      const time = battle.time;
      const shake = fx.offset();
      const eligible = battle.targets.map((tg) => tg.slot);

      g.save();
      g.translate(shake.x, shake.y);
      drawArena(g, battle, time, { showGuides: true });
      // Marking is a battlefield click, so enemies register as hit targets in the
      // same space they are drawn in. The mark changes targeting priority only
      // (brief 3.4.2) — it never becomes click-to-kill.
      for (const enemy of battle.enemies) {
        if (enemy.dead) continue;
        app.ui.hit(`hud.enemy.${enemy.id}`, enemyHitRect(enemy), {
          tooltip: enemy.carry
            ? `${t('mark')}: ${enemy.carry}`
            : t('mark'),
        });
      }
      fx.drawWorld(g);
      g.restore();

      // Blueprint cards are interactive: inspect, or receive the wildcard.
      for (let slot = 0; slot < 3; slot++) {
        const bp = battle.slots[slot];
        if (!bp) continue;
        const rect = cardRect(slot);
        const canWild = wildcardMode && eligible.includes(slot);
        app.ui.hit(`hud.card.${slot}`, rect, {
          tooltip: wildcardMode
            ? `${bp.word} — ${t('wildcardPick')}`
            : `${bp.word} — ${loc(bp.name)} · ${loc(bp.desc)}`,
        });
        // The bottom strip opens the explain panel; the card body steers Focus.
        // Both live on one card, so the strip is registered last and wins there.
        app.ui.hit(`hud.cardinfo.${slot}`, { x: rect.x, y: rect.y + rect.h - 30, w: rect.w, h: 30 });
        if (wildcardMode && !canWild) {
          g.fillStyle = rgba('#05070e', 0.5);
          rr(g, rect.x, rect.y, rect.w, rect.h, 10);
          g.fill();
        }
      }

      drawHud(g, app.ui, battle, {
        time,
        wildcardMode,
        eligible,
        hoveredSlot: null,
        speed: app.speed,
        chainActive: time - battle.lastCraftAt < TUNE.chainWindow,
        chainPulse: Math.max(0, 1 - (time - battle.lastCraftAt) / 1.2),
        waveIndex: (app.run?.state.encounterIndex ?? 0) + 1,
        waveTotal: app.run?.encounters.length ?? 1,
        hint: hint && hintT > 0 ? hint : null,
        hintEmphasis: hintT > 1,
        hintTarget: hint && hintT > 0 ? hintTarget : null,
        flights,
      });

      fx.drawOverlay(g);

      // Inspect panel: what the selected word actually does. This is the answer
      // to "what will this word do?" without a manual.
      if (inspectSlot !== null) {
        const bp = battle.slots[inspectSlot];
        if (bp) {
          const px = 24;
          const py = 452;
          plate(g, px, py, 336, 150, { radius: 12, fill: '#0e1526', edge: bp.color, depth: 6 });
          tile(g, px + 14, py + 14, 42, bp.word[0], 'filled');
          label(g, bp.word, px + 68, py + 36, { size: 21, color: C.ink, weight: 800, tracking: 2 });
          label(g, loc(bp.name), px + 68, py + 58, { size: 15, color: bp.color, weight: 700 });
          g.font = `500 13px Archivo, sans-serif`;
          wrap(g, loc(bp.desc), 306)
            .slice(0, 3)
            .forEach((line, i) => {
              label(g, line, px + 14, py + 88 + i * 18, { size: 13, color: C.dim, weight: 500 });
            });
          const missing = battle.missingFor(bp);
          label(
            g,
            missing.length === 0 ? t('poolReadyCraft') : `${t('poolStillNeeds')}${missing.join(' ')}`,
            px + 14,
            py + 140,
            { size: 12, color: missing.length === 0 ? C.mint : C.gold, weight: 700 },
          );
        }
      }

      // Wildcard prompt strip
      if (wildcardMode) {
        const w = 470;
        const x = VIEW.w / 2 - w / 2;
        const y = 96;
        plate(g, x, y, w, 44, { radius: 10, fill: '#241a44', edge: C.violet, depth: 5 });
        label(
          g,
          eligible.length > 0 ? t('wildcardPick') : t('noWildTarget'),
          x + w / 2,
          y + 28,
          { size: 15, color: C.ink, align: 'center', weight: 700 },
        );
        app.ui.button(g, 'hud.wildcancel', { x: x + w + 10, y, w: 104, h: 44 }, {
          label: t('wildcardCancel'),
          variant: 'ghost',
          fontSize: 13,
        });
      }

      // Danger vignette when the core is close to failing.
      const pct = battle.coreHp / Math.max(1, battle.maxCoreHp);
      if (pct < 0.34) {
        const pulse = 0.5 + Math.sin(time * 6) * 0.5;
        const grad = g.createRadialGradient(
          VIEW.w / 2,
          VIEW.h / 2,
          VIEW.h * 0.3,
          VIEW.w / 2,
          VIEW.h / 2,
          VIEW.h * 0.9,
        );
        grad.addColorStop(0, 'rgba(0,0,0,0)');
        grad.addColorStop(1, rgba(C.bad, 0.18 + pulse * 0.16));
        g.fillStyle = grad;
        g.fillRect(0, 0, VIEW.w, VIEW.h);
      }

      // Encounter result banner
      if (battle.state === 'cleared' || battle.state === 'failed') {
        const won = battle.state === 'cleared';
        label(g, won ? t('encounterClear') : t('encounterFail'), VIEW.w / 2, VIEW.h / 2 - 20, {
          align: 'center',
          size: 64,
          color: won ? C.mint : C.bad,
          weight: 800,
          tracking: 6,
        });
      }
    },
    click(id, app) {
      const battle = app.battle;
      if (!battle) return;
      if (id === 'hud.help') openHowTo(app);
      if (id === 'hud.pause') {
        void import('./pause').then((m) => app.setOverlay(m.createPauseScreen()));
        return;
      }
      if (id === 'hud.speed') {
        app.speed = app.speed >= 3 ? 1 : app.speed + 1;
        store.settings.speed = app.speed as 1 | 2 | 3;
        store.saveSettings();
        sfx.ui();
        return;
      }
      if (id === 'hud.wild') {
        if (battle.wildcardsLeft <= 0 || battle.targets.length === 0) return;
        wildcardMode = !wildcardMode;
        sfx.ui();
        return;
      }
      if (id === 'hud.wildcancel') {
        wildcardMode = false;
        return;
      }
      if (id.startsWith('hud.enemy.')) {
        battle.mark(Number(id.split('.')[2]));
        sfx.ui();
        return;
      }
      if (id.startsWith('hud.cardinfo.')) {
        const slot = Number(id.split('.')[2]);
        inspectSlot = inspectSlot === slot ? null : slot;
        sfx.ui();
        return;
      }
      if (id.startsWith('hud.card.')) {
        const slot = Number(id.split('.')[2]);
        if (wildcardMode) {
          if (battle.useWildcard(slot)) wildcardMode = false;
          return;
        }
        // Primary action is Focus (brief 3.2.2): clicking a word tells the
        // machine to send contested letters to it.
        battle.focus(slot);
        sfx.ui();
      }
    },
    key(e, app) {
      const battle = app.battle;
      if (!battle) return false;
      if (e.key === 'p' || e.key === ' ') {
        void import('./pause').then((m) => app.setOverlay(m.createPauseScreen()));
        return true;
      }
      if (e.key === 'w') {
        if (battle.wildcardsLeft > 0 && battle.targets.length > 0) wildcardMode = !wildcardMode;
        return true;
      }
      if (e.key === '1' || e.key === '2' || e.key === '3') {
        // Brief 3.2.2: 1-2-3 selects Focus. Speed keeps the button and gets a
        // key of its own rather than fighting the mandate.
        battle.focus(Number(e.key) - 1);
        sfx.ui();
        return true;
      }
      if (e.key === 's') {
        app.speed = app.speed >= 3 ? 1 : app.speed + 1;
        store.settings.speed = app.speed as 1 | 2 | 3;
        store.saveSettings();
        sfx.ui();
        return true;
      }
      if (e.key === 'Escape') {
        wildcardMode = false;
        inspectSlot = null;
        battle.clearMark();
        return true;
      }
      return false;
    },
    exit() {
      fx.clear();
      wildcardMode = false;
      inspectSlot = null;
      endTimer = -1;
    },
  };
}
