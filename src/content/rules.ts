/**
 * Machine Rules content.
 *
 * Each rule changes how the alphabet economy behaves. Nothing here is a flat
 * percentage: the effects are visible in the pool, the bag or the craft order.
 */
import { L } from '../core/i18n';
import type { MachineRuleDef } from '../alphabet/rules';
import { RULE_TWEAKS } from './tuning';

/** Flags read by the battle simulation for rules that adjust object behaviour. */
export type RuleFlag = 'shortFuse' | 'longBurn' | 'fatBlast' | 'twoCharges';

export const RULES: MachineRuleDef[] = [
  {
    id: 'firstVowelDuplicated',
    name: L('Nguyên âm đầu vòng', 'First vowel echoed'),
    desc: L('Nguyên âm đầu tiên rút ra mỗi vòng túi được nhân đôi.', 'The first vowel drawn each bag cycle is duplicated.'),
    unique: true,
    onDraw: (e) => {
      if (!e.cycleStart) return;
      if (!'AEIOU'.includes(e.letter)) return;
      e.addBonus(e.letter);
    },
  },
  {
    id: 'lastTileCopied',
    name: L('Viên cuối vòng', 'Last tile copied'),
    desc: L('Viên cuối cùng của mỗi vòng túi được nhân đôi.', 'The final tile of every bag cycle is copied.'),
    unique: true,
    onDraw: (e) => {
      if (!e.cycleEnd) return;
      e.addBonus(e.letter);
    },
  },
  {
    id: 'consonantInject',
    name: L('Nhét thêm B', 'Inject B'),
    desc: L('Mỗi trận bắt đầu với thêm một chữ B trong túi.', 'Each encounter starts with an extra B in the bag.'),
    unique: true,
    onEncounterStart: (e) => e.inject('B'),
  },
  {
    id: 'carrierDupe',
    name: L('Chữ rơi nhân đôi', 'Carrier echo'),
    desc: L('Chữ đầu tiên mỗi kẻ mang chữ để lại được nhân đôi.', 'The first letter each carrier drops is duplicated.'),
    unique: true,
    onKill: (e) => {
      if (e.carrier && e.letters.length > 0) e.duplicate(e.letters[0]);
    },
  },
  {
    id: 'firstKillTriple',
    name: L('Mồi đầu trận', 'Opening volley'),
    desc: L('Chữ của kẻ chết đầu tiên trong trận rơi ra gấp ba.', 'The first kill of each encounter drops triple letters.'),
    unique: true,
    onKill: (e) => {
      // "The first kill of each encounter" — not every kill. The guard is the
      // whole rule; without it this tripled every carrier drop in the fight.
      if (e.killIndex !== 1) return;
      if (!e.carrier || e.letters.length === 0) return;
      e.duplicate(e.letters[0]);
      e.duplicate(e.letters[0]);
    },
  },
  {
    id: 'firstCraftRefund',
    name: L('Chế đầu miễn phí', 'Free first craft'),
    desc: L('Lần ghép chữ đầu tiên của mỗi trận hoàn lại toàn bộ chữ.', 'The first craft of each encounter refunds every letter it used.'),
    unique: true,
    onCraft: (e) => {
      if (e.craftIndex !== 1) return;
      for (const ch of e.blueprint.recipe) e.refund(ch);
    },
  },
  {
    id: 'bombRefund',
    name: L('Bom hoàn B', 'Bomb refunds B'),
    desc: L(`Mỗi ${RULE_TWEAKS.refundEvery} lần chế Bom, hoàn lại 1 chữ B.`, `Every ${RULE_TWEAKS.refundEvery}th Bomb refunds one B.`),
    unique: true,
    about: 'BOMB',
    onCraft: (e) => {
      if (e.blueprint.id !== 'BOMB') return;
      if (e.blueprintCraftIndex % RULE_TWEAKS.refundEvery === 0) e.refund('B');
    },
  },
  {
    id: 'unspentWildcard',
    name: L('? để dành', 'Banked wildcard'),
    desc: L('Lượt ? không dùng chuyển thành một nguyên âm trong túi sau trận.', 'An unspent wildcard becomes a random vowel in the bag after combat.'),
    unique: true,
    onEncounterEnd: (e) => {
      if (e.unspentWildcards > 0) e.addToBag(e.randomVowel());
    },
  },
  {
    id: 'startWithTwo',
    name: L('Mở màn có sẵn', 'Head start'),
    desc: L('Đầu mỗi trận, kho chữ có sẵn 2 viên ngẫu nhiên.', 'Each encounter begins with 2 random tiles already in the pool.'),
    unique: true,
    onEncounterStart: (e) => {
      e.addToPool(e.randomLetter());
      e.addToPool(e.randomLetter());
    },
  },
];

/** Rules that apply a behaviour tweak instead of a hook. */
export const TWEAK_RULES: Record<RuleFlag, { name: ReturnType<typeof L>; desc: ReturnType<typeof L> }> = {
  shortFuse: {
    name: L('Ngòi ngắn', 'Short fuse'),
    desc: L('Bom nổ sớm hơn nhưng bán kính lớn hơn.', 'Bombs detonate sooner but blast wider.'),
  },
  longBurn: {
    name: L('Lửa dai', 'Long burn'),
    desc: L('Vùng lửa và dầu cháy lâu hơn.', 'Fire and burning oil last longer.'),
  },
  fatBlast: {
    name: L('Nổ rộng', 'Wide blast'),
    desc: L('Mọi vụ nổ có bán kính lớn hơn.', 'Every explosion covers more ground.'),
  },
  twoCharges: {
    name: L('Hai lượt ?', 'Second wildcard'),
    desc: L('Mỗi trận có 2 lượt chữ ?.', 'Two wildcard charges per encounter.'),
  },
};
