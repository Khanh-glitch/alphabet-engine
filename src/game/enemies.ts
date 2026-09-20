/** Enemy roster. Each family is a readable tile that behaves differently. */
import { C } from '../theme';
import type { EnemyDef, EnemyKind } from './types';

export const ENEMIES: Record<EnemyKind, EnemyDef> = {
  mote: {
    kind: 'mote',
    name: 'mote',
    hp: 26,
    speed: 66,
    damage: 4,
    armor: 0,
    size: 24,
    reward: 2,
    swarm: 3,
    tint: C.dim,
  },
  drone: {
    kind: 'drone',
    name: 'drone',
    hp: 54,
    speed: 46,
    damage: 7,
    armor: 0,
    size: 30,
    reward: 4,
    tint: C.ink,
  },
  zapper: {
    kind: 'zapper',
    name: 'zapper',
    hp: 36,
    speed: 78,
    damage: 6,
    armor: 0,
    size: 24,
    reward: 3,
    slowImmune: true,
    tint: C.gold,
  },
  weaver: {
    kind: 'weaver',
    name: 'weaver',
    hp: 78,
    speed: 42,
    damage: 6,
    armor: 1,
    size: 32,
    reward: 6,
    pulseSlow: 0.45,
    tint: C.violet,
  },
  phantom: {
    kind: 'phantom',
    name: 'phantom',
    hp: 48,
    speed: 60,
    damage: 9,
    armor: 0,
    size: 28,
    reward: 5,
    evasion: 0.45,
    tint: C.rose,
  },
  brute: {
    kind: 'brute',
    name: 'brute',
    hp: 172,
    speed: 30,
    damage: 16,
    armor: 4,
    size: 42,
    reward: 11,
    tint: C.ember,
  },
  warden: {
    kind: 'warden',
    name: 'warden',
    hp: 150,
    speed: 26,
    damage: 12,
    armor: 7,
    size: 40,
    reward: 10,
    auraArmor: 0.45,
    auraRange: 140,
    tint: C.cyan,
  },
  boss: {
    kind: 'boss',
    name: 'skullmaw',
    hp: 1400,
    speed: 20,
    damage: 34,
    armor: 8,
    size: 60,
    reward: 45,
    boss: true,
    tint: C.blood,
  },
};

export const ENEMY_TIP: Record<EnemyKind, string> = {
  mote: 'Spawns in packs of three. Fast, brittle.',
  drone: 'The baseline. Walks, hits the core.',
  zapper: 'Sprints, immune to slows.',
  weaver: 'Pulses a slowing field over your weapons.',
  phantom: 'Phases through shots that do not pierce.',
  brute: 'Heavy armour, resists knockback.',
  warden: 'Shields nearby allies with extra armour.',
  boss: 'Enrages below half health. Huge core damage.',
};

export const ENEMY_COST: Record<EnemyKind, number> = {
  mote: 1,
  drone: 2,
  zapper: 2,
  weaver: 3,
  phantom: 3,
  brute: 5,
  warden: 5,
  boss: 30,
};

export const enemyTint = (k: EnemyKind): string => ENEMIES[k].tint;

/** Which families are in play at a given wave. */
export function rosterFor(wave: number): EnemyKind[] {
  const out: EnemyKind[] = ['mote', 'drone'];
  if (wave >= 2) out.push('zapper');
  if (wave >= 3) out.push('weaver');
  if (wave >= 4) out.push('phantom');
  if (wave >= 5) out.push('brute');
  if (wave >= 6) out.push('warden');
  return out;
}
