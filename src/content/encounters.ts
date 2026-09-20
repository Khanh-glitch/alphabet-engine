/**
 * Run structure — data, never hardcoded in gameplay code.
 *
 * Each encounter authors its spawn script, the letters it is guaranteed to put
 * on carriers (so an engine always has fuel) and the letters it hides behind
 * "unknown carriers" (so there is still something to read on the way in).
 */
import { L, type LocaleText } from '../core/i18n';
import type { Letter } from '../alphabet/types';
import type { EnemyKindId } from './tuning';

export interface WaveDef {
  /** Seconds after the encounter starts. */
  at: number;
  kind: EnemyKindId;
  count: number;
  /** Seconds between spawns inside this wave. */
  gap: number;
  /** Lane index, or 'spread' to fan across lanes. */
  lane: number | 'spread';
}

export type RewardProfile = 'mixed' | 'bag' | 'blueprint' | 'rule';

export type TutorialBeats = 'craft' | 'carrier' | 'wildcard' | 'reward' | null;

export interface EncounterDef {
  id: string;
  chapter: number;
  name: LocaleText;
  kind: 'tutorial' | 'normal' | 'elite' | 'boss';
  hpMul: number;
  speedMul: number;
  waves: WaveDef[];
  /** Letters forced onto the earliest carriers, in order. */
  guaranteed: Letter[];
  /** Letters already in the pool when the fight opens (authored first craft). */
  openingPool?: Letter[];
  /** Extra carriers whose letters stay hidden until they die. */
  unknownCarriers: number;
  rewardProfile: RewardProfile;
  /** Optional one-line teaching note shown before the encounter. */
  hint?: LocaleText | null;
  teaches?: TutorialBeats;
}

const E = (def: EncounterDef): EncounterDef => def;

export const RUN: EncounterDef[] = [
  E({
    id: 'ch1-ignition',
    chapter: 1,
    name: L('Mồi lửa', 'Ignition'),
    kind: 'tutorial',
    hpMul: 1,
    speedMul: 1,
    // Prefixes of BOMB (B, O, M) are pre-loaded and the encounter guarantees
    // the second B, so the first recipe completes within the opening seconds
    // whether the bag or a carrier delivers it. The player sees
    // word → object → kill → letter without being told a rule.
    openingPool: ['B', 'O', 'M'],
    waves: [
      { at: 0.31, kind: 'mote', count: 3, gap: 0.5, lane: 'spread' },
      { at: 2.03, kind: 'mote', count: 3, gap: 0.45, lane: 'spread' },
      { at: 4.06, kind: 'mote', count: 4, gap: 0.4, lane: 'spread' },
    ],
    guaranteed: ['B', 'B', 'O', 'M'],
    unknownCarriers: 2,
    rewardProfile: 'bag',
    hint: L('Đủ chữ là tự ghép. Hạ kẻ mang chữ để lấy chữ.', 'Full recipes craft themselves. Kill carriers to feed the pool.'),
    teaches: 'craft',
  }),
  E({
    id: 'ch1-stream',
    chapter: 1,
    name: L('Dòng chảy', 'The Stream'),
    kind: 'normal',
    hpMul: 1.05,
    speedMul: 1,
    openingPool: ['F', 'I'],
    waves: [
      { at: 0.31, kind: 'runner', count: 2, gap: 1.1, lane: 1 },
      { at: 0.94, kind: 'mote', count: 3, gap: 0.45, lane: 'spread' },
      { at: 2.81, kind: 'runner', count: 3, gap: 0.9, lane: 2 },
      { at: 4.21, kind: 'mote', count: 4, gap: 0.4, lane: 'spread' },
      { at: 5.93, kind: 'runner', count: 3, gap: 0.8, lane: 3 },
      { at: 7.33, kind: 'mote', count: 5, gap: 0.36, lane: 'spread' },
    ],
    guaranteed: ['F', 'I', 'R', 'E'],
    unknownCarriers: 3,
    rewardProfile: 'mixed',
    hint: L('Kẻ chạy đi rải rác. Lửa và tường giữ chúng lại.', 'Runners come spread out. Fire and walls hold them back.'),
    teaches: 'carrier',
  }),
  E({
    id: 'ch1-slick',
    chapter: 1,
    name: L('Vũng dầu', 'The Slick'),
    kind: 'normal',
    hpMul: 1.12,
    speedMul: 1,
    openingPool: ['O', 'I'],
    waves: [
      { at: 0.31, kind: 'mote', count: 4, gap: 0.36, lane: 'spread' },
      { at: 2.03, kind: 'mote', count: 5, gap: 0.32, lane: 'spread' },
      { at: 4.06, kind: 'runner', count: 3, gap: 0.85, lane: 2 },
      { at: 5.46, kind: 'mote', count: 6, gap: 0.3, lane: 'spread' },
      { at: 7.33, kind: 'runner', count: 4, gap: 0.7, lane: 'spread' },
    ],
    guaranteed: ['O', 'I', 'L', 'B'],
    unknownCarriers: 3,
    rewardProfile: 'mixed',
    hint: L('Dầu không tự gây sát thương. Đốt nó lên.', 'Oil does nothing on its own. Set it alight.'),
    teaches: 'wildcard',
  }),
  E({
    id: 'ch2-wing',
    chapter: 2,
    name: L('Bầy bay', 'Wing Swarm'),
    kind: 'normal',
    hpMul: 1.18,
    speedMul: 1.02,
    openingPool: ['B', 'E'],
    waves: [
      { at: 0.31, kind: 'flyer', count: 2, gap: 1.0, lane: 'spread' },
      { at: 1.25, kind: 'mote', count: 4, gap: 0.4, lane: 'spread' },
      { at: 3.43, kind: 'flyer', count: 3, gap: 0.9, lane: 'spread' },
      { at: 4.99, kind: 'runner', count: 3, gap: 0.8, lane: 1 },
      { at: 6.71, kind: 'flyer', count: 3, gap: 0.8, lane: 'spread' },
      { at: 7.96, kind: 'mote', count: 5, gap: 0.34, lane: 'spread' },
    ],
    guaranteed: ['B', 'E', 'E', 'L'],
    unknownCarriers: 4,
    rewardProfile: 'blueprint',
    hint: L('Kẻ bay bỏ qua tường. Ong săn chúng.', 'Flyers ignore walls. Bees hunt them.'),
    teaches: null,
  }),
  E({
    id: 'ch2-bulwark',
    chapter: 2,
    name: L('Máy ủi', 'Bulwark'),
    kind: 'elite',
    hpMul: 1.25,
    speedMul: 1.05,
    openingPool: ['B', 'B'],
    waves: [
      { at: 0.31, kind: 'brute', count: 1, gap: 1, lane: 2 },
      { at: 0.78, kind: 'mote', count: 4, gap: 0.36, lane: 'spread' },
      { at: 3.12, kind: 'brute', count: 1, gap: 1, lane: 3 },
      { at: 3.59, kind: 'runner', count: 3, gap: 0.8, lane: 1 },
      { at: 5.93, kind: 'mote', count: 5, gap: 0.32, lane: 'spread' },
      { at: 7.33, kind: 'brute', count: 1, gap: 1, lane: 'spread' },
      { at: 8.58, kind: 'runner', count: 3, gap: 0.7, lane: 'spread' },
    ],
    guaranteed: ['W', 'A', 'L', 'L', 'B'],
    unknownCarriers: 4,
    rewardProfile: 'rule',
    hint: L('Giáp dày cần nổ và cháy, không cần đánh lẻ.', 'Heavy plating wants blasts and fire, not chip damage.'),
    teaches: null,
  }),
  E({
    id: 'ch3-crush',
    chapter: 3,
    name: L('Nghiền', 'Crush'),
    kind: 'normal',
    hpMul: 1.32,
    speedMul: 1.08,
    openingPool: ['B', 'O'],
    waves: [
      { at: 0.31, kind: 'mote', count: 5, gap: 0.3, lane: 'spread' },
      { at: 1.87, kind: 'runner', count: 3, gap: 0.7, lane: 2 },
      { at: 3.43, kind: 'mote', count: 5, gap: 0.28, lane: 'spread' },
      { at: 5.15, kind: 'flyer', count: 3, gap: 0.8, lane: 'spread' },
      { at: 6.55, kind: 'mote', count: 5, gap: 0.26, lane: 'spread' },
      { at: 8.27, kind: 'runner', count: 3, gap: 0.65, lane: 4 },
      { at: 9.67, kind: 'flyer', count: 3, gap: 0.7, lane: 'spread' },
    ],
    guaranteed: ['B', 'B', 'O', 'M', 'F'],
    unknownCarriers: 5,
    rewardProfile: 'mixed',
    hint: null,
    teaches: null,
  }),
  E({
    id: 'ch3-heat',
    chapter: 3,
    name: L('Lò nung', 'Furnace'),
    kind: 'normal',
    hpMul: 1.4,
    speedMul: 1.1,
    openingPool: ['O', 'I'],
    waves: [
      { at: 0.31, kind: 'runner', count: 4, gap: 0.6, lane: 'spread' },
      { at: 2.34, kind: 'brute', count: 1, gap: 1, lane: 2 },
      { at: 2.81, kind: 'mote', count: 5, gap: 0.3, lane: 'spread' },
      { at: 4.99, kind: 'runner', count: 4, gap: 0.55, lane: 'spread' },
      { at: 6.71, kind: 'flyer', count: 3, gap: 0.7, lane: 'spread' },
      { at: 8.58, kind: 'brute', count: 2, gap: 1.4, lane: 'spread' },
      { at: 9.36, kind: 'mote', count: 5, gap: 0.3, lane: 'spread' },
    ],
    guaranteed: ['O', 'I', 'L', 'F', 'I'],
    unknownCarriers: 5,
    rewardProfile: 'rule',
    hint: null,
    teaches: null,
  }),
  E({
    id: 'ch4-silencer',
    chapter: 4,
    name: L('Cỗ Máy Câm', 'The Silencer'),
    kind: 'boss',
    hpMul: 1.5,
    speedMul: 1.12,
    openingPool: ['B', 'O', 'M'],
    waves: [
      { at: 0.47, kind: 'mote', count: 4, gap: 0.4, lane: 'spread' },
      { at: 1.87, kind: 'boss', count: 1, gap: 1, lane: 2 },
      { at: 3.9, kind: 'runner', count: 4, gap: 0.7, lane: 'spread' },
      { at: 7.02, kind: 'flyer', count: 3, gap: 0.8, lane: 'spread' },
      { at: 10.14, kind: 'brute', count: 2, gap: 1.5, lane: 'spread' },
      { at: 13.26, kind: 'mote', count: 6, gap: 0.3, lane: 'spread' },
    ],
    guaranteed: ['B', 'B', 'O', 'M', 'W'],
    unknownCarriers: 6,
    rewardProfile: 'mixed',
    hint: L('Nó nhả bầy liên tục. Đốt dầu và dồn nổ.', 'It keeps spawning escorts. Burn the oil and stack the blasts.'),
    teaches: null,
  }),
];

export const encounterById = (id: string): EncounterDef => {
  const found = RUN.find((e) => e.id === id);
  if (!found) throw new Error(`unknown encounter: ${id}`);
  return found;
};
