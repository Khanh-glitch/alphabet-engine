/**
 * Between-encounter rewards.
 *
 * Three offers, curated rather than fully random: the generator looks at the
 * player's bag and equipped recipes so a set is never obviously useless, and any
 * reward that only inflates a number is not in the pool at all.
 */
import { L } from '../core/i18n';
import type { Rng } from '../core/rng';
import { BLUEPRINTS } from '../content/blueprints';
import { RULES, TWEAK_RULES, type RuleFlag } from '../content/rules';
import type { MachineRuleDef } from '../alphabet/rules';
import type { BlueprintDef, BlueprintId, Letter } from '../alphabet/types';
import type { Run } from './run';

export type RewardDef =
  | {
      id: string;
      kind: 'bagAdd';
      letter: Letter;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'bagRemove';
      letter: Letter;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'bagDuplicate';
      letter: Letter;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'rule';
      rule: MachineRuleDef;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'tweak';
      flag: RuleFlag;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'repair';
      amount: number;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    }
  | {
      id: string;
      kind: 'blueprint';
      blueprint: BlueprintDef;
      replaceSlot: number;
      title: ReturnType<typeof L>;
      desc: ReturnType<typeof L>;
      tone: string;
    };

const VOWELS: Letter[] = ['A', 'E', 'I', 'O', 'U'];

/** Letters the equipped recipes still need more of than the bag provides. */
function neededLetters(run: Run): Letter[] {
  const have = new Map<Letter, number>();
  for (const ch of run.state.bag) have.set(ch, (have.get(ch) ?? 0) + 1);
  const need = new Map<Letter, number>();
  for (const id of run.state.blueprints) {
    if (!id) continue;
    for (const ch of BLUEPRINTS[id].recipe) need.set(ch, (need.get(ch) ?? 0) + 1);
  }
  const out: Letter[] = [];
  for (const [letter, count] of need) {
    const deficitCount = count - (have.get(letter) ?? 0);
    if (deficitCount > 0) out.push(letter);
  }
  if (out.length === 0) {
    for (const [letter, count] of need) if (count > 1) out.push(letter);
  }
  return out.length > 0 ? out : ['B', 'E', 'O', 'F'];
}

const mostCommonLetter = (run: Run): Letter => {
  const counts = new Map<Letter, number>();
  for (const ch of run.state.bag) counts.set(ch, (counts.get(ch) ?? 0) + 1);
  let best: Letter = run.state.bag[0] ?? 'E';
  for (const [letter, count] of counts) if (count > (counts.get(best) ?? 0)) best = letter;
  return best;
};

const bagAdd = (letter: Letter): RewardDef => ({
  id: `bagAdd-${letter}`,
  kind: 'bagAdd',
  letter,
  title: L(`THÊM CHỮ ${letter}`, `ADD ${letter}`),
  desc: L('Một viên nữa vào túi để dây chuyền dày hơn.', 'One more tile in the bag keeps the line fed.'),
  tone: '#4fd8a0',
});

export function generateRewards(run: Run, rng: Rng): RewardDef[] {
  const profile = run.encounter().rewardProfile;
  const out: RewardDef[] = [];
  const wants = neededLetters(run);
  const taken = new Set<string>();

  const pushBag = (): void => {
    const letter = rng.pick(wants);
    const def = bagAdd(letter);
    if (!taken.has(def.id)) {
      out.push(def);
      taken.add(def.id);
    }
  };

  const pushDuplicate = (): void => {
    const letter = rng.pick(wants.length > 1 ? wants : VOWELS);
    const def: RewardDef = {
      id: `bagDup-${letter}`,
      kind: 'bagDuplicate',
      letter,
      title: L(`NHÂN ĐÔI ${letter}`, `DUPLICATE ${letter}`),
      desc: L('Túi chữ có thêm một viên nữa của chữ này.', 'A second copy of this tile joins the bag.'),
      tone: '#4fd8e4',
    };
    if (!taken.has(def.id)) {
      out.push(def);
      taken.add(def.id);
    }
  };

  const pushRemove = (): void => {
    const letter = mostCommonLetter(run);
    if ((run.state.bag.filter((c) => c === letter).length ?? 0) < 2) return;
    const def: RewardDef = {
      id: `bagDel-${letter}`,
      kind: 'bagRemove',
      letter,
      title: L(`BỎ MỘT CHỮ ${letter}`, `REMOVE ONE ${letter}`),
      desc: L('Túi gọn hơn: vòng rút ngắn, chữ cần tới nhanh hơn.', 'A leaner bag: shorter cycles, the letters you want arrive sooner.'),
      tone: '#f0b445',
    };
    if (!taken.has(def.id)) {
      out.push(def);
      taken.add(def.id);
    }
  };

  const pushRule = (): void => {
    const owned = new Set(run.state.ruleIds);
    const pool = RULES.filter((r) => !(r.unique && owned.has(r.id)));
    if (pool.length === 0) return;
    const rule = rng.pick(pool);
    if (taken.has(`rule-${rule.id}`)) return;
    out.push({
      id: `rule-${rule.id}`,
      kind: 'rule',
      rule,
      title: rule.name,
      desc: rule.desc,
      tone: '#a274f5',
    });
    taken.add(`rule-${rule.id}`);
  };

  const pushTweak = (): void => {
    const flags: RuleFlag[] = ['shortFuse', 'longBurn', 'fatBlast', 'twoCharges'];
    const free = flags.filter((f) => !run.state.flags.includes(f));
    if (free.length === 0) return;
    const flag = rng.pick(free);
    out.push({
      id: `tweak-${flag}`,
      kind: 'tweak',
      flag,
      title: TWEAK_RULES[flag].name,
      desc: TWEAK_RULES[flag].desc,
      tone: '#f2734a',
    });
  };

  const pushBlueprint = (): void => {
    const equipped = new Set(run.state.blueprints.filter(Boolean) as BlueprintId[]);
    // Any blueprint the player does not currently hold is a legitimate swap, so
    // the starter six can come back around as a real decision.
    const options = Object.values(BLUEPRINTS).filter((b) => !equipped.has(b.id));
    if (options.length === 0) return;
    const blueprint = rng.pick(options);
    const slot = run.leastUsedSlot();
    const replaced = run.state.blueprints[slot];
    out.push({
      id: `bp-${blueprint.id}`,
      kind: 'blueprint',
      blueprint,
      replaceSlot: slot,
      title: L(`${blueprint.word} — ${blueprint.name.vi}`, `${blueprint.word} — ${blueprint.name.en}`),
      desc: replaced
        ? L(`${blueprint.desc.vi} — thay cho ${BLUEPRINTS[replaced].word}.`, `${blueprint.desc.en} — replaces ${BLUEPRINTS[replaced].word}.`)
        : blueprint.desc,
      tone: blueprint.color,
    });
  };

  /**
   * Core repair. Damaged cores make this the honest answer to "should I fix my
   * engine or my hull", which is a real roguelite decision rather than a stat.
   */
  const pushRepair = (): void => {
    const missing = run.state.maxCoreHp - run.state.coreHp;
    if (missing < 12) return;
    const amount = Math.min(missing, 34);
    out.push({
      id: 'repair',
      kind: 'repair',
      amount,
      title: L(`SỬA LÕI +${amount}`, `REPAIR CORE +${amount}`),
      desc: L('Hàn lại lõi trước khi vào trận tiếp theo.', 'Weld the core back together before the next fight.'),
      tone: '#4fd8a0',
    });
  };

  // Curated shape per profile: always fuel + a real decision.
  switch (profile) {
    case 'bag':
      pushBag();
      pushDuplicate();
      if (run.state.coreHp < run.state.maxCoreHp * 0.6) pushRepair();
      else pushRemove();
      break;
    case 'rule':
      pushRule();
      pushBag();
      // A damaged player is offered the honest alternative to more engine.
      if (run.state.coreHp < run.state.maxCoreHp * 0.7) pushRepair();
      else pushTweak();
      break;
    case 'blueprint':
      pushBlueprint();
      pushBag();
      if (run.state.coreHp < run.state.maxCoreHp * 0.6) pushRepair();
      else pushRule();
      break;
    default:
      pushBag();
      rng.chance(0.5) ? pushRule() : pushDuplicate();
      if (run.state.coreHp < run.state.maxCoreHp * 0.6) pushRepair();
      else pushBlueprint();
      break;
  }

  // Top up to three so the screen is never half empty.
  const fillers = [pushDuplicate, pushRepair, pushBag, pushRule, pushTweak, pushRemove];
  let i = 0;
  while (out.length < 3 && i < fillers.length * 2) {
    fillers[i % fillers.length]();
    i += 1;
  }
  rng.shuffle(out);
  return out.slice(0, 3);
}
