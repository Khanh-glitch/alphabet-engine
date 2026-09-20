/** Wave composition and difficulty curve. */
import type { Rng } from '../core/rng';
import { ENEMY_COST, ENEMIES, rosterFor } from './enemies';
import type { EnemyKind, WaveDef } from './types';

const NOTES = [
  'SCOUT PARTY',
  'FIRST CONTACT',
  'PRESSURE',
  'SWARM FRONT',
  'ARMOURED LINE',
  'JAMMING',
  'DEEP PUSH',
  'SIEGE',
  'THE CRUSH',
  'OVERWHELM',
  'ENDLESS',
];

/**
 * Enemy health curve. Gentle for the opening three waves so a first build can
 * breathe, then quadratic so late waves genuinely threaten a finished line.
 */
export function waveHpMul(wave: number): number {
  const w = wave - 1;
  const open = 1 + 0.34 * w;
  const late = 1 + 0.55 * w + 0.045 * w * w;
  const blend = Math.min(1, Math.max(0, (wave - 3) / 4));
  return open * (1 - blend) + late * blend;
}

export function makeWave(wave: number, rng: Rng): WaveDef {
  const boss = wave % 5 === 0;
  const elite = !boss && wave % 5 === 4;
  const budget = Math.round(6 + 2.1 * (wave - 1) + 0.15 * (wave - 1) * (wave - 1));
  const kinds: EnemyKind[] = [];
  const roster = rosterFor(wave);

  if (boss) {
    const guards = Math.max(2, Math.round(wave / 4));
    kinds.push('boss');
    for (let i = 0; i < guards; i++) kinds.push(rng.pick(roster));
  } else {
    let left = budget;
    let guard = 0;
    while (left > 0 && guard++ < 200) {
      // Later waves lean on the tougher families.
      const available = roster.filter((k) => ENEMY_COST[k] <= Math.max(2, left));
      if (!available.length) break;
      const pick = rng.weighted(available, (k) => {
        const tier = roster.indexOf(k);
        return 1 + tier * 0.55 * Math.min(1, wave / 6);
      });
      const pack = ENEMIES[pick].swarm ?? 1;
      const cost = ENEMY_COST[pick] * pack;
      if (cost > left && left < 2) break;
      for (let i = 0; i < pack; i++) kinds.push(pick);
      left -= cost;
    }
  }

  // Shuffle so spawn order varies, but keep the boss in front of its guards.
  if (boss) {
    const guards = rng.shuffle(kinds.slice(1));
    kinds.length = 1;
    kinds.push(...guards);
  } else {
    rng.shuffle(kinds);
  }

  const count = kinds.length;
  const gap = Math.max(0.52, 1.25 - wave * 0.04) * (elite || boss ? 0.88 : 1);
  const duration = Math.max(9, count * gap + 7);
  const reward = Math.round(24 + wave * 8 + (elite ? 14 : 0) + (boss ? 46 : 0));

  const note = boss
    ? `BOSS - ${ENEMIES.boss.name.toUpperCase()}`
    : elite
      ? 'ELITE WAVE'
      : NOTES[Math.min(NOTES.length - 1, wave - 1)];

  return {
    index: wave,
    hpMul: waveHpMul(wave) * (elite ? 1.15 : 1),
    pool: budget,
    count,
    kinds,
    gap,
    duration,
    reward,
    elite,
    boss,
    note,
  };
}

/** Enemy budget preview for the map screen: rough threat rating. */
export function threatLabel(wave: WaveDef): string {
  const t = wave.pool;
  if (t < 12) return 'low';
  if (t < 24) return 'moderate';
  if (t < 40) return 'high';
  if (t < 60) return 'severe';
  return 'extreme';
}
