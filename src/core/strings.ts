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
  /** V2: the small buffer for letters no recipe currently wants (brief 3.1.2). */
  reserve: string;
  reserveEmpty: string;
  /** V2: the steering mechanic's label (brief 3.2.3). */
  focus: string;
  focusHint: string;
  mark: string;
  markHint: string;
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
  reserve: 'DỰ TRỮ',
  reserveEmpty: 'Trống — chữ nào công thức cần sẽ tự vào ô',
  focus: 'ƯU TIÊN',
  focusHint: 'Bấm thẻ hoặc phím 1 2 3 để máy dồn chữ tranh chấp cho từ này',
  mark: 'ĐÁNH DẤU',
  markHint: 'Bấm một kẻ địch để BEE săn nó trước',
  bag: 'TÚI CHỮ',
  cycle: 'Vòng',
  incomingLetters: 'CHỮ SẼ RƠI',
  incomingNone: 'Không còn chữ nào được hứa trước',
  incomingUnknown: 'kẻ chưa rõ chữ',
  wildcard: 'CHỮ ?',
  wildReady: 'Điền 1 chữ còn thiếu',
  wildSpent: 'Đã dùng hết lượt',
  wildWaiting: 'Chưa có gì để điền',
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
  reserve: 'RESERVE',
  reserveEmpty: 'Empty — a letter goes straight into whichever recipe wants it',
  focus: 'FOCUS',
  focusHint: 'Click a card or press 1 2 3 to send contested letters to that word',
  mark: 'MARK',
  markHint: 'Click an enemy to make BEE hunt it first',
  bag: 'LETTER BAG',
  cycle: 'Cycle',
  incomingLetters: 'LETTERS STILL COMING',
  incomingNone: 'No further letters are promised',
  incomingUnknown: 'carriers unrevealed',
  wildcard: 'WILDCARD',
  wildReady: 'Fills one missing letter',
  wildSpent: 'All charges spent',
  wildWaiting: 'Nothing to fill',
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
