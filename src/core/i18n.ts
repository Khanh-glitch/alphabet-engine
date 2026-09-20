/**
 * Localization.
 *
 * Vietnamese is the default language. UI text is fully localizable, but
 * blueprint *words* stay identical in every language: a recipe is a gameplay
 * token, not prose. Only the explanation beside it is translated.
 */

export type Lang = 'vi' | 'en';

export interface Strings {
  // Shell
  gameTitle: string;
  gameTagline: string;
  play: string;
  continueRun: string;
  newRun: string;
  codex: string;
  settings: string;
  credits: string;
  quit: string;
  back: string;
  close: string;

  // New run
  chooseKit: string;
  chooseKitHint: string;
  seedLabel: string;
  random: string;
  start: string;
  kitBag: string;

  // Battle HUD
  core: string;
  wave: string;
  chain: string;
  chainBest: string;
  chaptersCleared: string;
  pool: string;
  bag: string;
  bagCycle: string;
  speed: string;
  pause: string;
  resume: string;
  blueprintEmpty: string;
  wildcard: string;
  wildcardReady: string;
  wildcardSpent: string;
  wildcardHint: string;
  wildcardPick: string;
  wildcardCancel: string;
  nextWave: string;
  threat: string;
  carriersKnown: string;
  carriersUnknown: string;
  incoming: string;
  tapToInspect: string;
  recipeNeeds: string;
  craftCount: string;

  // Battle events
  craftWord: string;
  cascade: string;
  carrierDown: string;
  coreHit: string;
  encounterClear: string;
  encounterFail: string;

  // Rewards
  spoils: string;
  chooseOne: string;
  rewardBag: string;
  rewardRule: string;
  rewardBlueprint: string;
  take: string;
  skip: string;
  replaced: string;
  choose: string;

  // Summary
  runComplete: string;
  runOver: string;
  statsCrafts: string;
  statsKills: string;
  statsBestChain: string;
  statsFirstCraft: string;
  statsLetters: string;
  statsWildcards: string;
  again: string;
  toMenu: string;
  score: string;

  // Pause
  paused: string;
  restartEncounter: string;
  quitToMenu: string;

  // Settings
  settingsTitle: string;
  language: string;
  masterVolume: string;
  music: string;
  sfx: string;
  screenShake: string;
  reducedFlashes: string;
  uiScale: string;
  textScale: string;
  defaultSpeed: string;
  resetProgress: string;
  resetConfirm: string;
  on: string;
  off: string;

  // Codex
  codexTitle: string;
  codexBlueprints: string;
  codexEnemies: string;
  codexRules: string;
  codexSeen: string;
  codexLocked: string;
  codexIntro: string;

  // Tutorial
  hintFirstCraft: string;
  hintCarrier: string;
  hintWildcard: string;
  hintReward: string;
  hintPool: string;
  hintSpeed: string;

  // Actions / misc
  fight: string;
  hp: string;
  damage: string;
  seconds: string;
  tap: string;
}

const vi: Strings = {
  gameTitle: 'ALPHABET ENGINE',
  gameTagline: 'Xếp chữ thành vũ khí. Để dây chuyền tự cháy.',
  play: 'CHƠI',
  continueRun: 'TIẾP TỤC',
  newRun: 'VÁN MỚI',
  codex: 'SỔ TAY',
  settings: 'CÀI ĐẶT',
  credits: 'GHI CÔNG',
  quit: 'THOÁT',
  back: 'QUAY LẠI',
  close: 'ĐÓNG',

  chooseKit: 'CHỌN BỘ KHỞI ĐẦU',
  chooseKitHint: 'Mỗi bộ mở ra một cách chơi khác nhau. Chữ trong túi là nhiên liệu.',
  seedLabel: 'MÃ VÁN',
  random: 'NGẪU NHIÊN',
  start: 'BẮT ĐẦU',
  kitBag: 'TÚI CHỮ',

  core: 'LÕI',
  wave: 'ĐỢT',
  chain: 'CHUỖI',
  chainBest: 'CHUỖI DÀI NHẤT',
  chaptersCleared: 'ĐỘT ĐÃ QUA',
  pool: 'KHO CHỮ',
  bag: 'TÚI',
  bagCycle: 'VÒNG',
  speed: 'TỐC ĐỘ',
  pause: 'TẠM DỪNG',
  resume: 'TIẾP TỤC',
  blueprintEmpty: 'Ô TRỐNG',
  wildcard: 'CHỮ ?',
  wildcardReady: 'CÒN LƯỢT',
  wildcardSpent: 'HẾT LƯỢT',
  wildcardHint: 'Điền đúng một chữ còn thiếu',
  wildcardPick: 'CHỌN CÔNG THỨC ĐỂ ĐIỀN',
  wildcardCancel: 'HUỶ',
  nextWave: 'ĐỢT TỚI',
  threat: 'Mối đe doạ',
  carriersKnown: 'Chữ sẽ rơi',
  carriersUnknown: 'Chưa rõ',
  incoming: 'ĐANG TỚI',
  tapToInspect: 'Chạm để xem',
  recipeNeeds: 'Cần',
  craftCount: 'Đã chế',

  craftWord: 'GHÉP CHỮ',
  cascade: 'CHUỖI',
  carrierDown: 'RƠI CHỮ',
  coreHit: 'LÕI TRÚNG ĐẠN',
  encounterClear: 'SẠCH ĐỢT',
  encounterFail: 'LÕI VỠ',

  spoils: 'CHIẾN LỢI PHẨM',
  chooseOne: 'CHỌN 1',
  rewardBag: 'TÚI CHỮ',
  rewardRule: 'LUẬT MÁY',
  rewardBlueprint: 'CÔNG THỨC',
  take: 'LẤY',
  skip: 'BỎ QUA',
  replaced: 'THAY CHO',
  choose: 'CHỌN',

  runComplete: 'VÁN HOÀN THÀNH',
  runOver: 'VÁN KẾT THÚC',
  statsCrafts: 'Lần ghép chữ',
  statsKills: 'Hạ gục',
  statsBestChain: 'Chuỗi dài nhất',
  statsFirstCraft: 'Giây tới chữ đầu',
  statsLetters: 'Chữ nhặt được',
  statsWildcards: 'Lượt ? đã dùng',
  again: 'CHƠI LẠI',
  toMenu: 'VỀ MENU',
  score: 'ĐIỂM',

  paused: 'TẠM DỪNG',
  restartEncounter: 'CHƠI LẠI TRẬN',
  quitToMenu: 'VỀ MENU',

  settingsTitle: 'CÀI ĐẶT',
  language: 'NGÔN NGỮ',
  masterVolume: 'ÂM LƯỢNG',
  music: 'NHẠC NỀN',
  sfx: 'HIỆU ỨNG',
  screenShake: 'RUNG MÀN HÌNH',
  reducedFlashes: 'GIẢM CHỚP SÁNG',
  uiScale: 'CỠ GIAO DIỆN',
  textScale: 'CỠ CHỮ',
  defaultSpeed: 'TỐC ĐỘ MẶC ĐỊNH',
  resetProgress: 'XOÁ TIẾN TRÌNH',
  resetConfirm: 'Chạm lần nữa để xoá',
  on: 'BẬT',
  off: 'TẮT',

  codexTitle: 'SỔ TAY',
  codexBlueprints: 'CÔNG THỨC',
  codexEnemies: 'KẺ ĐỊCH',
  codexRules: 'LUẬT MÁY',
  codexSeen: 'ĐÃ GẶP',
  codexLocked: 'CHƯA MỞ',
  codexIntro: 'Mọi thứ bạn đã ghép, đã gặp và đã mở khoá.',

  hintFirstCraft: 'Đủ chữ là tự ghép. Cứ để dây chuyền chạy.',
  hintCarrier: 'Kẻ địch mang chữ. Hạ nó để lấy chữ về kho.',
  hintWildcard: 'Chữ ? điền đúng một chữ còn thiếu. Chọn công thức.',
  hintReward: 'Chọn 1 thay đổi cho dây chuyền của bạn.',
  hintPool: 'Chữ trong kho sẽ tự lắp vào công thức.',
  hintSpeed: 'Tăng tốc độ khi đã nắm nhịp.',

  fight: 'ĐÁNH',
  hp: 'MÁU',
  damage: 'SÁT THƯƠNG',
  seconds: 'giây',
  tap: 'chạm',
};

const en: Strings = {
  gameTitle: 'ALPHABET ENGINE',
  gameTagline: 'Spell matter into weapons. Let the chain feed itself.',
  play: 'PLAY',
  continueRun: 'CONTINUE',
  newRun: 'NEW RUN',
  codex: 'CODEX',
  settings: 'SETTINGS',
  credits: 'CREDITS',
  quit: 'QUIT',
  back: 'BACK',
  close: 'CLOSE',

  chooseKit: 'CHOOSE A STARTING KIT',
  chooseKitHint: 'Each kit builds a different engine. The letters in your bag are the fuel.',
  seedLabel: 'SEED',
  random: 'RANDOM',
  start: 'START',
  kitBag: 'BAG',

  core: 'CORE',
  wave: 'WAVE',
  chain: 'CHAIN',
  chainBest: 'LONGEST CHAIN',
  chaptersCleared: 'WAVES CLEARED',
  pool: 'LETTER POOL',
  bag: 'BAG',
  bagCycle: 'CYCLE',
  speed: 'SPEED',
  pause: 'PAUSE',
  resume: 'RESUME',
  blueprintEmpty: 'EMPTY SLOT',
  wildcard: 'WILDCARD ?',
  wildcardReady: 'CHARGE READY',
  wildcardSpent: 'SPENT',
  wildcardHint: 'Fills exactly one missing letter',
  wildcardPick: 'PICK A BLUEPRINT TO COMPLETE',
  wildcardCancel: 'CANCEL',
  nextWave: 'NEXT WAVE',
  threat: 'Threat',
  carriersKnown: 'Carried letters',
  carriersUnknown: 'Unknown',
  incoming: 'INCOMING',
  tapToInspect: 'Tap to inspect',
  recipeNeeds: 'Needs',
  craftCount: 'Crafted',

  craftWord: 'WORD LOCKED',
  cascade: 'CHAIN',
  carrierDown: 'LETTER DROP',
  coreHit: 'CORE HIT',
  encounterClear: 'WAVE CLEAR',
  encounterFail: 'CORE BREACH',

  spoils: 'SPOILS',
  chooseOne: 'CHOOSE 1',
  rewardBag: 'BAG',
  rewardRule: 'MACHINE RULE',
  rewardBlueprint: 'BLUEPRINT',
  take: 'TAKE',
  skip: 'SKIP',
  replaced: 'REPLACES',
  choose: 'PICK',

  runComplete: 'RUN COMPLETE',
  runOver: 'RUN OVER',
  statsCrafts: 'Words crafted',
  statsKills: 'Kills',
  statsBestChain: 'Longest chain',
  statsFirstCraft: 'First craft (s)',
  statsLetters: 'Letters recovered',
  statsWildcards: 'Wildcards used',
  again: 'PLAY AGAIN',
  toMenu: 'MAIN MENU',
  score: 'SCORE',

  paused: 'PAUSED',
  restartEncounter: 'RESTART ENCOUNTER',
  quitToMenu: 'QUIT TO MENU',

  settingsTitle: 'SETTINGS',
  language: 'LANGUAGE',
  masterVolume: 'MASTER VOLUME',
  music: 'MUSIC',
  sfx: 'SFX',
  screenShake: 'SCREEN SHAKE',
  reducedFlashes: 'REDUCED FLASHES',
  uiScale: 'UI SCALE',
  textScale: 'TEXT SCALE',
  defaultSpeed: 'DEFAULT SPEED',
  resetProgress: 'RESET PROGRESS',
  resetConfirm: 'Tap again to erase',
  on: 'ON',
  off: 'OFF',

  codexTitle: 'CODEX',
  codexBlueprints: 'BLUEPRINTS',
  codexEnemies: 'ENEMIES',
  codexRules: 'MACHINE RULES',
  codexSeen: 'SEEN',
  codexLocked: 'LOCKED',
  codexIntro: 'Everything you have crafted, fought and unlocked.',

  hintFirstCraft: 'Full recipes craft themselves. Just keep the chain fed.',
  hintCarrier: 'Enemies carry letters. Kill them to feed your pool.',
  hintWildcard: 'The ? fills one missing letter. Pick a blueprint.',
  hintReward: 'Pick one change for your engine.',
  hintPool: 'Letters in the pool auto-fill your recipes.',
  hintSpeed: 'Raise the speed once the rhythm clicks.',

  fight: 'FIGHT',
  hp: 'HP',
  damage: 'DAMAGE',
  seconds: 's',
  tap: 'tap',
};

const TABLE: Record<Lang, Strings> = { vi, en };

let current: Lang = 'vi';
const listeners = new Set<() => void>();

export function setLang(lang: Lang): void {
  if (current === lang) return;
  current = lang;
  document.documentElement.lang = lang;
  for (const fn of listeners) fn();
}

export const getLang = (): Lang => current;
export const onLangChange = (fn: () => void): (() => void) => {
  listeners.add(fn);
  return () => listeners.delete(fn);
};

/** Translate key in the active language. */
export const t = (key: keyof Strings): string => TABLE[current][key];

/** A piece of authored content text, written once in both languages. */
export interface LocaleText {
  vi: string;
  en: string;
}

export const L = (viText: string, enText: string): LocaleText => ({ vi: viText, en: enText });

/** Resolve authored content text for the active language. */
export const loc = (text: LocaleText): string => (current === 'vi' ? text.vi : text.en);
