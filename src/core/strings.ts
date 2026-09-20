/**
 * Short HUD strings.
 *
 * Kept separate from the menu strings because they are terse, always-visible
 * labels where wording is a layout decision as much as a translation one.
 * `H` resolves through the active language at read time.
 */
import { getLang } from './i18n';

export interface HudStrings {
  recipes: string;
  emptySlot: string;
  pool: string;
  poolEmpty: string;
  bag: string;
  cycle: string;
  incomingLetters: string;
  incomingNone: string;
  incomingUnknown: string;
  wildcard: string;
  wildReady: string;
  wildSpent: string;
  wildWaiting: string;
  wildcardHint: string;
  needLetter: string;
  needs: string;
  wave: string;
  remaining: string;
  chain: string;
  speedTip: string;
  pauseTip: string;
  kindLabel: Record<'tutorial' | 'normal' | 'elite' | 'boss', string>;
}

const vi: HudStrings = {
  recipes: 'CÔNG THỨC',
  emptySlot: 'Ô TRỐNG',
  pool: 'KHO CHỮ',
  poolEmpty: 'Chưa có chữ nào — chờ túi nhả hoặc hạ kẻ mang chữ',
  bag: 'TÚI CHỮ',
  cycle: 'Vòng',
  incomingLetters: 'CHỮ SẼ RƠI',
  incomingNone: 'Không còn chữ nào được hứa trước',
  incomingUnknown: 'kẻ chưa rõ chữ',
  wildcard: 'CHỮ ?',
  wildReady: 'Điền 1 chữ còn thiếu',
  wildSpent: 'Đã dùng hết lượt',
  wildWaiting: 'Chưa công thức nào thiếu 1 chữ',
  wildcardHint: 'Chọn công thức để điền chữ còn thiếu',
  needLetter: 'thiếu ',
  needs: 'thiếu',
  wave: 'ĐỢT',
  remaining: 'CÒN LẠI',
  chain: 'CHUỖI',
  speedTip: 'Tốc độ trận (1/2/3)',
  pauseTip: 'Tạm dừng (P)',
  kindLabel: { tutorial: 'MỞ MÀN', normal: 'THƯỜNG', elite: 'TINH ANH', boss: 'TRÙM' },
};

const en: HudStrings = {
  recipes: 'BLUEPRINTS',
  emptySlot: 'EMPTY SLOT',
  pool: 'LETTER POOL',
  poolEmpty: 'Pool is empty — wait for the bag or kill a carrier',
  bag: 'LETTER BAG',
  cycle: 'Cycle',
  incomingLetters: 'LETTERS STILL COMING',
  incomingNone: 'No further letters are promised',
  incomingUnknown: 'carriers unrevealed',
  wildcard: 'WILDCARD',
  wildReady: 'Fills one missing letter',
  wildSpent: 'All charges spent',
  wildWaiting: 'No blueprint is one letter short',
  wildcardHint: 'Pick a blueprint to complete',
  needLetter: 'needs ',
  needs: 'needs',
  wave: 'WAVE',
  remaining: 'REMAINING',
  chain: 'CHAIN',
  speedTip: 'Combat speed (1/2/3)',
  pauseTip: 'Pause (P)',
  kindLabel: { tutorial: 'OPENING', normal: 'STANDARD', elite: 'ELITE', boss: 'BOSS' },
};

/** Live HUD strings in the active language. */
export const H = new Proxy({} as HudStrings, {
  get: (_target, key: string) => {
    const table = getLang() === 'vi' ? vi : en;
    return (table as unknown as Record<string, unknown>)[key];
  },
});

export { vi as viStrings, en as enStrings };
