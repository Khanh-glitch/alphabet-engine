/**
 * Battle simulation: lanes, weapons, enemies, projectiles, cascades.
 * Pure logic - it never touches the canvas, so the view can draw it any way it likes.
 */
import type { Rng } from '../core/rng';
import { clamp } from '../core/rng';
import { C } from '../theme';
import { ENEMIES } from './enemies';
import { traitColor } from './forge';
import type {
  EnemyInst,
  EnemyKind,
  Fx,
  Proj,
  WeaponDef,
  WeaponInst,
  WaveDef,
} from './types';

export const LANE_COUNT = 5;
export const SLOTS_PER_LANE = 4;
export const BOX = { l: 356, r: 1416, top: 68, bot: 700 } as const;
export const LANE_H = (BOX.bot - BOX.top) / LANE_COUNT;
export const laneY = (lane: number) => BOX.top + LANE_H * (lane + 0.5);
export const CORE_X = BOX.l + 8;
export const SPAWN_X = BOX.r + 30;
export const slotX = (slot: number) => BOX.l + 52 + slot * 56;

export interface CascadeEntry {
  id: number;
  text: string;
  color: string;
  level: number;
  t: number;
}

export interface Setup {
  rng: Rng;
  wave: WaveDef;
  coreHp: number;
  maxCoreHp: number;
  flux: number;
  weapons: { def: WeaponDef; lane: number; slot: number }[];
  fluxMax: number;
  engineBonus: number;
  abilityCost: { purge: number; surge: number };
}

export type Phase = 'ready' | 'fight' | 'cleared' | 'failed';

export interface AbilityState {
  purgeCd: number;
  surgeT: number;
}

let uidSeq = 1;
const nextUid = () => uidSeq++;

export class Battle {
  rng: Rng;
  wave: WaveDef;
  phase: Phase = 'ready';
  time = 0;
  countdown = 3.4;

  coreHp: number;
  maxCoreHp: number;
  flux: number;
  fluxMax: number;
  engineBonus: number;
  abilityCost: { purge: number; surge: number };

  towers: WeaponInst[] = [];
  enemies: EnemyInst[] = [];
  projs: Proj[] = [];
  fx: Fx[] = [];
  feed: CascadeEntry[] = [];

  spawnQueue: { kind: EnemyKind; t: number }[] = [];
  spawned = 0;
  killed = 0;
  leaked = 0;
  damageDealt = 0;
  salvage = 0;
  bestCascade = 0;

  combo = 0;
  comboT = 0;
  cascadeLevel = 0;
  shake = 0;
  flash = 0;
  coreFlash = 0;
  towerChill = 0;
  slowWave = 0;
  surgeT = 0;
  purgeCd = 0;
  lanePool: number[] = [];
  topWeapon = { word: '', kills: 0 };
  endT = 0;

  constructor(s: Setup) {
    this.rng = s.rng;
    this.wave = s.wave;
    this.coreHp = s.coreHp;
    this.maxCoreHp = s.maxCoreHp;
    this.flux = s.flux;
    this.fluxMax = s.fluxMax;
    this.engineBonus = s.engineBonus;
    this.abilityCost = s.abilityCost;

    const lanes = Math.min(LANE_COUNT, 2 + Math.floor((s.wave.index - 1) / 2));
    this.lanePool = Array.from({ length: lanes }, (_, i) => i);

    for (const w of s.weapons) {
      this.towers.push({
        ...w.def,
        lane: w.lane,
        slot: w.slot,
        x: slotX(w.slot),
        y: laneY(w.lane),
        cd: this.rng.range(0.1, 0.8),
        flash: 0,
        recoil: 0,
        aim: 0,
        kills: 0,
        shake: 0,
      });
    }

    let t = 1.1;
    for (const kind of s.wave.kinds) {
      this.spawnQueue.push({ kind, t });
      t += s.wave.gap * this.rng.range(0.82, 1.18);
    }
    this.spawnQueue.sort((a, b) => a.t - b.t);
  }

  // ---- helpers -----------------------------------------------------------
  get charge(): number {
    return this.flux / this.fluxMax;
  }

  /** Everything stacked on a shot: the flux engine plus an active cascade. */
  get globalMul(): number {
    return (1 + this.charge * this.engineBonus) * (1 + this.cascadeLevel * 0.08);
  }

  push(text: string, color: string, level = 0): void {
    this.feed.push({ id: nextUid(), text, color, level, t: 0 });
    if (this.feed.length > 5) this.feed.splice(0, this.feed.length - 5);
  }

  private addFx(f: Partial<Fx> & { kind: Fx['kind']; x: number; y: number }): void {
    this.fx.push({
      life: f.max ?? 0.5,
      max: f.max ?? 0.5,
      size: f.size ?? 10,
      color: f.color ?? C.ink,
      vx: f.vx ?? 0,
      vy: f.vy ?? 0,
      text: f.text,
      lane: f.lane,
      amount: f.amount,
      kind: f.kind,
      x: f.x,
      y: f.y,
    });
    if (this.fx.length > 400) this.fx.splice(0, this.fx.length - 400);
  }

  spam(x: number, y: number, color: string, n: number, power = 1): void {
    for (let i = 0; i < n; i++) {
      const a = this.rng.range(0, Math.PI * 2);
      const sp = this.rng.range(60, 260) * power;
      this.addFx({
        kind: 'spark',
        x,
        y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        color,
        size: this.rng.range(1.6, 3.6) * power,
        max: this.rng.range(0.24, 0.6),
      });
    }
  }

  // ---- abilities ---------------------------------------------------------
  abilityReady(which: 'purge' | 'surge'): boolean {
    return which === 'purge' ? this.purgeCd <= 0 : this.surgeT <= 0;
  }

  useAbility(which: 'purge' | 'surge'): boolean {
    if (this.phase !== 'fight') return false;
    const cost = which === 'purge' ? this.abilityCost.purge : this.abilityCost.surge;
    if (this.flux < cost) return false;
    if (which === 'purge' && this.purgeCd > 0) return false;
    if (which === 'surge' && this.surgeT > 0) return false;
    this.flux -= cost;
    if (which === 'purge') {
      this.purgeCd = 6;
      this.flash = 0.5;
      this.shake = Math.max(this.shake, 9);
      for (const e of this.enemies) {
        this.hurt(e, 40 + this.wave.index * 4, C.gold, false, 0);
      }
      this.addFx({ kind: 'ring', x: BOX.l + 120, y: BOX.top + (BOX.bot - BOX.top) / 2, size: 900, color: C.gold, max: 0.6 });
      this.spam(BOX.l + 200, (BOX.top + BOX.bot) / 2, C.gold, 40, 1.6);
      this.push('CORE PURGE', C.gold, 3);
    } else {
      this.surgeT = 5;
      this.push('OVERDRIVE +60% RATE', C.lime, 2);
      for (const tw of this.towers) this.spam(tw.x, tw.y, C.lime, 6, 0.8);
    }
    return true;
  }

  // ---- damage ------------------------------------------------------------
  armourOf(e: EnemyInst, shred: number): number {
    const drop = clamp(shred + (e.corrT > 0 ? 0.3 : 0), 0, 0.9);
    let base = e.armor * (1 - drop);
    for (const w of this.enemies) {
      if (w === e || w.dead) continue;
      const def = ENEMIES[w.kind];
      if (!def.auraArmor) continue;
      const dx = w.x - e.x;
      const dy = w.y - e.y;
      if (dx * dx + dy * dy < (def.auraRange ?? 0) ** 2) base *= 1 + def.auraArmor;
    }
    return base;
  }

  /** Returns true when the hit killed the enemy. */
  hurt(
    e: EnemyInst,
    amount: number,
    color: string,
    crit: boolean,
    shred: number,
    mark = false,
  ): boolean {
    if (e.dead) return false;
    const armour = this.armourOf(e, shred);
    const dealt = Math.max(1, amount - armour);
    e.hp -= dealt;
    e.hitFlash = 0.14;
    this.damageDealt += dealt;
    if (mark) e.markT = 3;
    if (crit) {
      this.addFx({
        kind: 'text',
        x: e.x,
        y: e.y - e.size * 0.7,
        text: `${Math.round(dealt)}!`,
        color: C.rose,
        size: 22,
        max: 0.75,
      });
    }
    if (e.hp <= 0) {
      this.kill(e, color);
      return true;
    }
    return false;
  }

  kill(e: EnemyInst, color: string): void {
    if (e.dead) return;
    e.dead = true;
    this.killed++;
    this.salvage += e.reward;
    this.spam(e.x, e.y, color, ENEMIES[e.kind].boss ? 46 : 12, ENEMIES[e.kind].boss ? 2 : 1);
    this.addFx({ kind: 'ring', x: e.x, y: e.y, size: e.size * 2.6, color, max: 0.4 });
    this.addFx({
      kind: 'text',
      x: e.x,
      y: e.y,
      text: `+${e.reward}`,
      color: C.gold,
      size: 13,
      max: 0.7,
    });
    this.bumpCombo(e.x, e.y, e.kind === 'boss');
    for (const t of this.towers) {
      if (t.kills > this.topWeapon.kills) this.topWeapon = { word: t.word, kills: t.kills };
    }
  }

  hitWeapon(uid: number): void {
    const t = this.towers.find((tw) => tw.id === uid);
    if (t) t.kills++;
    if (t && t.kills > this.topWeapon.kills) this.topWeapon = { word: t.word, kills: t.kills };
  }

  /** Kills in quick succession build the cascade level, which feeds itself. */
  bumpCombo(x: number, y: number, big = false): void {
    this.combo++;
    this.comboT = 2.6;
    const level = Math.min(9, Math.floor(this.combo / 3));
    if (level > this.cascadeLevel) {
      this.cascadeLevel = level;
      this.bestCascade = Math.max(this.bestCascade, level);
      const radius = 90 + level * 14;
      this.addFx({ kind: 'ring', x, y, size: radius * 2, color: C.violet, max: 0.42 });
      this.shake = Math.max(this.shake, 2.5 + level * 1.2);
      const dmg = 4 + level * 7;
      for (const e of this.enemies) {
        if (e.dead) continue;
        const dx = e.x - x;
        const dy = e.y - y;
        if (dx * dx + dy * dy < radius * radius) this.hurt(e, dmg, C.violet, false, 0);
      }
      this.gainFlux(3 + level * 1.2);
      this.push(`CASCADE x${level}  +${Math.round(3 + level * 1.2)} CHARGE`, C.violet, level);
    }
    if (big) this.push('BOSS DOWN', C.gold, 4);
  }

  gainFlux(v: number): void {
    this.flux = Math.min(this.fluxMax, this.flux + v);
  }

  // ---- main loop ---------------------------------------------------------
  update(dt: number, speed = 1): void {
    const step = dt * speed;
    this.time += step;
    this.shake = Math.max(0, this.shake - step * 26);
    this.flash = Math.max(0, this.flash - step * 3);
    this.coreFlash = Math.max(0, this.coreFlash - step * 3);
    if (this.surgeT > 0) this.surgeT = Math.max(0, this.surgeT - step);
    if (this.purgeCd > 0) this.purgeCd = Math.max(0, this.purgeCd - step);
    if (this.towerChill > 0) this.towerChill = Math.max(0, this.towerChill - step);

    for (const f of this.fx) {
      f.life -= step;
      f.x += (f.vx ?? 0) * step;
      f.y += (f.vy ?? 0) * step;
      if (f.kind === 'spark') {
        f.vx = (f.vx ?? 0) * (1 - 2.4 * step);
        f.vy = (f.vy ?? 0) * (1 - 2.4 * step);
      }
    }
    if (this.fx.length) this.fx = this.fx.filter((f) => f.life > 0);

    for (const f of this.feed) f.t += step;
    this.feed = this.feed.filter((f) => f.t < 5.5);

    if (this.phase === 'ready') {
      this.countdown -= step;
      if (this.countdown <= 0) {
        this.phase = 'fight';
        this.push('ENGAGE', C.ink, 0);
      }
      return;
    }
    if (this.phase !== 'fight') {
      this.endT += step;
      return;
    }

    // combo decay
    if (this.comboT > 0) {
      this.comboT -= step;
      if (this.comboT <= 0) {
        this.combo = 0;
        this.cascadeLevel = 0;
      }
    }

    this.spawnStep();
    this.towerStep(step);
    this.projStep(step);
    this.enemyStep(step);

    if (this.coreHp <= 0) {
      this.phase = 'failed';
      this.shake = 18;
      this.push('CORE BREACH', C.bad, 5);
      return;
    }
    if (this.spawned >= this.wave.kinds.length && this.enemies.length === 0) {
      this.phase = 'cleared';
      this.endT = 0;
      this.push('WAVE CLEAR', C.good, 2);
    }
  }

  private spawnStep(): void {
    while (this.spawnQueue.length && this.spawnQueue[0].t <= this.time) {
      const s = this.spawnQueue.shift();
      if (s) this.spawn(s.kind);
    }
  }

  private spawn(kind: EnemyKind): void {
    const def = ENEMIES[kind];
    const lane = this.rng.pick(this.lanePool);
    const hpMul = this.wave.hpMul;
    const hp = Math.round(def.hp * hpMul);
    this.enemies.push({
      uid: nextUid(),
      kind,
      name: def.name,
      hp,
      maxHp: hp,
      x: SPAWN_X + this.rng.range(0, 30),
      y: laneY(lane),
      lane,
      speed: def.speed,
      baseSpeed: def.speed,
      damage: Math.round(def.damage * (1 + (this.wave.index - 1) * 0.06)),
      armor: def.armor * (1 + (this.wave.index - 1) * 0.03),
      size: def.size,
      reward: def.reward,
      slowT: 0,
      slowAmt: 0,
      stunT: 0,
      dotDps: 0,
      dotT: 0,
      hitFlash: 0,
      markT: 0,
      corrT: 0,
      charge: 0,
      wobble: this.rng.range(0, 6.28),
      dead: false,
      reached: false,
      pulseCd: def.pulseSlow ? 2.5 : 0,
      uidAura: false,
    });
    this.spawned++;
    this.addFx({ kind: 'ring', x: SPAWN_X, y: laneY(lane), size: 46, color: C.faint, max: 0.4 });
  }

  private towerStep(dt: number): void {
    const chillMul = this.towerChill > 0 ? 0.55 : 1;
    const surgeMul = this.surgeT > 0 ? 1.6 : 1;
    for (const t of this.towers) {
      t.flash = Math.max(0, t.flash - dt * 4);
      t.recoil = Math.max(0, t.recoil - dt * 7);
      t.shake = Math.max(0, t.shake - dt * 5);
      t.cd -= dt * chillMul * surgeMul;
      if (t.cd > 0) continue;
      const target = this.findTarget(t);
      if (!target) {
        t.cd = Math.min(t.cd, 0.12);
        continue;
      }
      this.fire(t, target);
      t.cd = t.cooldown;
    }
  }

  /**
   * A weapon owns its lane outright and reaches into the lanes next to it at
   * 65% range, so a thin line never leaves a lane completely open.
   */
  private findTarget(t: WeaponInst): EnemyInst | null {
    let best: EnemyInst | null = null;
    let bestScore = -Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const laneGap = Math.abs(e.lane - t.lane);
      if (laneGap > 1) continue;
      const range = laneGap === 0 ? t.range : t.range * 0.65;
      const dx = e.x - t.x;
      const dy = e.y - t.y;
      if (dx * dx + dy * dy > range * range) continue;
      // closest to the core first, own lane first
      const score = -e.x - laneGap * 120;
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best;
  }

  private fire(t: WeaponInst, target: EnemyInst): void {
    t.flash = 1;
    t.recoil = 1;
    t.aim = Math.atan2(target.y - t.y, target.x - t.x);
    const color = traitColor(t.trait);
    const base = t.damage * this.globalMul;
    const n = Math.max(1, t.shots);
    for (let i = 0; i < n; i++) {
      const spread = n === 1 ? 0 : (i - (n - 1) / 2) * t.spread;
      const a = Math.atan2(target.y - t.y, target.x - t.x) + spread;
      const arc = t.trait === 'BLAST' ? 1 : 0;
      this.projs.push({
        uid: nextUid(),
        x: t.x,
        y: t.y,
        vx: Math.cos(a),
        vy: Math.sin(a),
        speed: arc ? 420 : 620,
        damage: base,
        trait: t.trait,
        lane: t.lane,
        targetUid: target.uid,
        hits: [],
        pierce: t.pierce,
        aoe: t.aoe,
        chain: t.chain,
        chainFalloff: t.chainFalloff,
        knockback: t.knockback,
        stun: t.stun,
        slow: t.slow,
        slowDur: t.slowDur,
        dot: t.dot,
        dotDur: t.dotDur,
        arc,
        life: 2.6,
        fromX: t.x,
        fromY: t.y,
        travel: 0,
        travelMax: t.range * 1.4,
        color,
        size: t.trait === 'BLAST' ? 6 : t.trait === 'HEAVY' ? 5.5 : 3.4,
        weaponUid: t.id,
        dead: false,
        trail: [],
      });
    }
    this.addFx({ kind: 'ring', x: t.x, y: t.y, size: 14, color, max: 0.16 });
    if (t.trait === 'BLAST') {
      this.shake = Math.max(this.shake, 1.2);
    }
  }

  private projStep(dt: number): void {
    for (const p of this.projs) {
      if (p.dead) continue;
      p.life -= dt;
      if (p.life <= 0) {
        p.dead = true;
        continue;
      }
      const target = this.enemies.find((e) => e.uid === p.targetUid && !e.dead);
      if (target) {
        const desired = Math.atan2(target.y - p.y, target.x - p.x);
        if (!p.arc) {
          const cur = Math.atan2(p.vy, p.vx);
          let diff = desired - cur;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          const turn = clamp(diff, -6 * dt, 6 * dt);
          const na = cur + turn;
          p.vx = Math.cos(na);
          p.vy = Math.sin(na);
        }
      }
      const step = p.speed * dt;
      p.x += p.vx * step;
      p.y += p.vy * step;
      p.travel += step;
      if (!p.arc && this.rng.next() < 0.6) {
        p.trail.push(p.x, p.y);
        if (p.trail.length > 12) p.trail.splice(0, 2);
      }
      if (p.travel > p.travelMax || p.x < BOX.l - 20 || p.x > BOX.r + 60) {
        p.dead = true;
        continue;
      }
      // collision
      for (const e of this.enemies) {
        if (e.dead || p.dead) continue;
        if (p.hits.includes(e.uid)) continue;
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = (e.size / 2 + p.size) ** 2;
        if (dx * dx + dy * dy <= rr) {
          const def = ENEMIES[e.kind];
          if (def.evasion && p.pierce <= 0 && p.aoe <= 0 && this.rng.chance(def.evasion)) {
            this.addFx({
              kind: 'text',
              x: e.x,
              y: e.y - 18,
              text: 'PHASE',
              color: C.rose,
              size: 12,
              max: 0.5,
            });
            p.hits.push(e.uid);
            continue;
          }
          this.impact(p, e);
        }
      }
    }
    if (this.projs.length) this.projs = this.projs.filter((p) => !p.dead);
  }

  private impact(p: Proj, e: EnemyInst): void {
    const crit = this.rng.chance(this.critOf(p.weaponUid));
    const dmg = p.damage * (crit ? 2 : 1) * (e.markT > 0 ? 1.16 : 1);
    const exec = this.executeOf(p.weaponUid);
    const finalDmg = exec > 1 && e.hp / e.maxHp < 0.45 ? dmg * exec : dmg;
    const killed = this.hurt(e, finalDmg, p.color, crit, this.shredOf(p.weaponUid), this.chargedOf(p.weaponUid));
    if (this.corrodedOf(p.weaponUid)) e.corrT = 4;
    this.hitWeapon(p.weaponUid);

    const fluxOnHit = this.fluxHitOf(p.weaponUid);
    if (fluxOnHit) this.gainFlux(fluxOnHit);

    // On-hit effects
    if (p.slow > 0 && !ENEMIES[e.kind].slowImmune) {
      e.slowAmt = Math.max(e.slowAmt, p.slow);
      e.slowT = Math.max(e.slowT, p.slowDur);
    }
    if (p.dot > 0) {
      e.dotDps = Math.max(e.dotDps, p.dot);
      e.dotT = Math.max(e.dotT, p.dotDur);
    }
    if (p.stun > 0) e.stunT = Math.max(e.stunT, p.stun);
    if (p.knockback > 0) {
      const resist = e.kind === 'brute' || e.kind === 'boss' || e.kind === 'warden' ? 0.45 : 1;
      e.x = Math.min(SPAWN_X, e.x + p.knockback * resist);
    }
    if (killed) {
      const hc = this.healChanceOf(p.weaponUid);
      if (hc > 0 && this.rng.chance(hc)) {
        this.coreHp = Math.min(this.maxCoreHp, this.coreHp + 1);
        this.addFx({
          kind: 'text',
          x: CORE_X + 26,
          y: laneY(2),
          text: '+1 CORE',
          color: C.good,
          size: 13,
          max: 0.9,
        });
      }
    }

    switch (p.trait) {
      case 'BLAST':
        this.explode(p, e);
        p.dead = true;
        break;
      case 'CHILL':
        this.addFx({ kind: 'ring', x: e.x, y: e.y, size: 56, color: C.cyan, max: 0.3 });
        if (p.aoe > 0) this.splash(p, e, p.aoe, 0.5);
        p.dead = true;
        break;
      case 'CHAIN': {
        p.hits.push(e.uid);
        if (p.chain > 0) {
          const next = this.nearestOther(e, p.hits);
          if (next) {
            p.chain--;
            p.damage *= p.chainFalloff;
            p.targetUid = next.uid;
            p.x = e.x;
            p.y = e.y;
            p.vx = Math.cos(Math.atan2(next.y - p.y, next.x - p.x));
            p.vy = Math.sin(Math.atan2(next.y - p.y, next.x - p.x));
            this.addFx({
              kind: 'beam',
              x: e.x,
              y: e.y,
              size: 6,
              color: p.color,
              max: 0.18,
              amount: next.x,
              lane: next.y,
            });
            break;
          }
        }
        p.dead = true;
        break;
      }
      case 'PIERCE':
        p.hits.push(e.uid);
        if (p.pierce <= 0) p.dead = true;
        else p.pierce--;
        break;
      default: {
        p.hits.push(e.uid);
        if (p.aoe > 0) this.splash(p, e, p.aoe, 0.6);
        p.dead = true;
      }
    }
  }

  private explode(p: Proj, e: EnemyInst): void {
    const r = Math.max(p.aoe, 40);
    this.addFx({ kind: 'boom', x: e.x, y: e.y, size: r * 2, color: C.ember, max: 0.42 });
    this.addFx({ kind: 'ring', x: e.x, y: e.y, size: r * 2.2, color: C.gold, max: 0.36 });
    this.spam(e.x, e.y, C.ember, 16, 1.2);
    this.shake = Math.max(this.shake, 4);
    this.splash(p, e, r, 0.75, true);
  }

  private splash(p: Proj, from: EnemyInst, radius: number, mul: number, skipCenter = false): void {
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (skipCenter && e.uid === from.uid) continue;
      const dx = e.x - from.x;
      const dy = e.y - from.y;
      if (dx * dx + dy * dy > radius * radius) continue;
      this.hurt(e, p.damage * mul, p.color, false, this.shredOf(p.weaponUid));
      if (p.slow > 0 && !ENEMIES[e.kind].slowImmune) {
        e.slowAmt = Math.max(e.slowAmt, p.slow);
        e.slowT = Math.max(e.slowT, p.slowDur);
      }
    }
  }

  private nearestOther(from: EnemyInst, exclude: number[]): EnemyInst | null {
    let best: EnemyInst | null = null;
    let bestD = 150 * 150;
    for (const e of this.enemies) {
      if (e.dead || exclude.includes(e.uid)) continue;
      const dx = e.x - from.x;
      const dy = e.y - from.y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private weaponOf(uid: number): WeaponInst | undefined {
    return this.towers.find((t) => t.id === uid);
  }
  private critOf(uid: number): number {
    return this.weaponOf(uid)?.crit ?? 0;
  }
  private executeOf(uid: number): number {
    return this.weaponOf(uid)?.execute ?? 1;
  }
  private shredOf(uid: number): number {
    return this.weaponOf(uid)?.shred ?? 0;
  }
  private healChanceOf(uid: number): number {
    return this.weaponOf(uid)?.healChance ?? 0;
  }
  private fluxHitOf(uid: number): number {
    return this.weaponOf(uid)?.fluxOnHit ?? 0;
  }
  private chargedOf(uid: number): boolean {
    return this.weaponOf(uid)?.polar.includes('pos') ?? false;
  }
  private corrodedOf(uid: number): boolean {
    return this.weaponOf(uid)?.polar.includes('neg') ?? false;
  }

  private enemyStep(dt: number): void {
    let leaked = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.hitFlash = Math.max(0, e.hitFlash - dt * 5);
      e.markT = Math.max(0, e.markT - dt);
      e.corrT = Math.max(0, e.corrT - dt);
      e.wobble += dt * 3;
      if (e.slowT > 0) {
        e.slowT -= dt;
        if (e.slowT <= 0) e.slowAmt = 0;
      }
      if (e.stunT > 0) e.stunT -= dt;
      if (e.dotT > 0) {
        e.dotT -= dt;
        e.hp -= e.dotDps * dt;
        if (this.rng.next() < dt * 7) {
          this.addFx({ kind: 'spark', x: e.x + this.rng.range(-8, 8), y: e.y - 6, vx: 0, vy: -22, color: C.acid, size: 2.4, max: 0.5 });
        }
        if (e.hp <= 0) {
          this.kill(e, C.acid);
          continue;
        }
      }
      // weaver pulses slow your line
      const def = ENEMIES[e.kind];
      if (def.pulseSlow) {
        e.pulseCd -= dt;
        if (e.pulseCd <= 0) {
          e.pulseCd = 6;
          this.addFx({ kind: 'ring', x: e.x, y: e.y, size: 340, color: C.violet, max: 0.6 });
          this.towerChill = Math.max(this.towerChill, 1.8);
        }
      }
      if (def.boss && e.hp / e.maxHp < 0.5) e.speed = e.baseSpeed * 1.45;

      const mul = 1 - clamp(e.slowAmt, 0, 0.85);
      const stun = e.stunT > 0 ? 0 : 1;
      e.x -= e.speed * mul * stun * dt;
      e.y = laneY(e.lane) + Math.sin(e.wobble) * (def.boss ? 2 : 1.6);

      if (e.x <= CORE_X + e.size * 0.4) {
        e.dead = true;
        e.reached = true;
        leaked = true;
        this.leaked++;
        this.coreHp -= e.damage;
        this.coreFlash = 1;
        this.shake = Math.max(this.shake, 6 + e.damage * 0.3);
        this.spam(CORE_X, e.y, C.bad, 14, 1.1);
        this.addFx({
          kind: 'text',
          x: CORE_X + 40,
          y: e.y,
          text: `-${e.damage} CORE`,
          color: C.bad,
          size: 17,
          max: 0.9,
        });
        this.push(`${e.name.toUpperCase()} HIT CORE -${e.damage}`, C.bad, 1);
      }
    }
    if (leaked) this.enemies = this.enemies.filter((e) => !(e.dead && e.reached));
    else if (this.enemies.some((e) => e.dead)) this.enemies = this.enemies.filter((e) => !e.dead);
  }

  /** Where an enemy's tile should be drawn, accounting for stun/slow tint. */
  progressOf(e: EnemyInst): number {
    return clamp(1 - (e.x - CORE_X) / (SPAWN_X - CORE_X), 0, 1);
  }
}
