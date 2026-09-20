/**
 * Enemy content.
 *
 * Archetypes exist to reward different blueprints, not to be damage sponges:
 * SWARM clusters (bombs), RUNNER streams (fire, walls), FLYING CARRIER ignores
 * blockers (bee), BRUTE soaks single-target damage (oil + fire, mines).
 */
import { L } from '../core/i18n';
import type { Tag } from '../alphabet/types';
import type { EnemyKindId } from './tuning';

export interface EnemyDef {
  id: EnemyKindId;
  name: ReturnType<typeof L>;
  /** Short behavioural note shown in the codex and the wave preview. */
  note: ReturnType<typeof L>;
  tags: Tag[];
  flying: boolean;
  /** Relative share of encounter budgets. */
  cost: number;
  /** Chance this unit carries a letter at all. */
  carrierChance: number;
  /** Preferred letters when a carrier assignment happens. */
  prefers: string[];
  color: string;
  shape: 'mote' | 'runner' | 'flyer' | 'brute' | 'boss';
  /** Bosses spawn escorts on a timer. */
  spawns?: { kind: EnemyKindId; every: number; count: number };
}

export const ENEMIES: Record<EnemyKindId, EnemyDef> = {
  mote: {
    id: 'mote',
    name: L('Mảnh vụn', 'Mote'),
    note: L('Đi bộ theo bầy. Chết nhanh, dễ dồn cụm.', 'Walks in packs. Fragile, clusters naturally.'),
    tags: ['GROUND', 'LIGHT'],
    flying: false,
    cost: 1,
    carrierChance: 0.55,
    prefers: ['B', 'O', 'M', 'E'],
    color: '#c3cee6',
    shape: 'mote',
  },
  runner: {
    id: 'runner',
    name: L('Kẻ chạy', 'Runner'),
    note: L('Chạy nhanh, đi rải rác. Bom khó trúng.', 'Fast and spread out. Hard for bombs to catch.'),
    tags: ['GROUND'],
    flying: false,
    cost: 1.4,
    carrierChance: 0.7,
    prefers: ['R', 'I', 'F', 'E'],
    color: '#ffd166',
    shape: 'runner',
  },
  flyer: {
    id: 'flyer',
    name: L('Kẻ bay', 'Flyer'),
    note: L('Bay qua tường, tha chữ quý.', 'Flies over walls, carries precious letters.'),
    tags: ['FLYING'],
    flying: true,
    cost: 2,
    carrierChance: 1,
    prefers: ['I', 'A', 'L', 'N'],
    color: '#b98cff',
    shape: 'flyer',
  },
  brute: {
    id: 'brute',
    name: L('Máy ủi', 'Brute'),
    note: L('Máu dày, đập nát tường. Cần lửa và dầu.', 'Thick plating, smashes walls. Wants fire and oil.'),
    tags: ['GROUND', 'HEAVY'],
    flying: false,
    cost: 4,
    carrierChance: 1,
    prefers: ['W', 'D', 'N', 'S'],
    color: '#ff6b5e',
    shape: 'brute',
  },
  boss: {
    id: 'boss',
    name: L('Cỗ Máy Câm', 'The Silencer'),
    note: L('Nhả bầy mỗi 4 giây. Nổ và cháy mới xuyên được giáp.', 'Spawns escorts every 4s. Only fire and blasts crack its plating.'),
    tags: ['GROUND', 'HEAVY'],
    flying: false,
    cost: 10,
    carrierChance: 1,
    prefers: ['E', 'O', 'B'],
    color: '#ff8552',
    shape: 'boss',
    spawns: { kind: 'mote', every: 4, count: 3 },
  },
};

export const enemyById = (id: EnemyKindId): EnemyDef => ENEMIES[id];
