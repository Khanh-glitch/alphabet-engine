/**
 * Run state and progression.
 *
 * A run is short and data-driven: an ordered list of encounters, a reward choice
 * between them, and three permanent build pillars (bag, blueprints, machine
 * rules). Nothing here reaches into the battle simulation except to configure it.
 */
import { streamFor } from '../core/rng';
import type { Letter, BlueprintId } from '../alphabet/types';
import { BLUEPRINTS } from '../content/blueprints';
import { RUN, type EncounterDef } from '../content/encounters';
import { KITS, kitById, type KitDef } from '../content/kits';
import { RULES, type RuleFlag } from '../content/rules';
import type { MachineRuleDef } from '../alphabet/rules';
import { Battle, type BattleConfig } from '../battle/battle';
import { generateRewards, type RewardDef } from './rewards';

export interface RunRecord {
  crafts: number;
  kills: number;
  longestChain: number;
  firstCraft: number | null;
  letters: number;
  wildcards: number;
  cleared: number;
  failed: boolean;
  completed: boolean;
}

export interface RunState {
  seed: number;
  kitId: string;
  encounterIndex: number;
  bag: Letter[];
  blueprints: (BlueprintId | null)[];
  ruleIds: string[];
  flags: RuleFlag[];
  coreHp: number;
  maxCoreHp: number;
  wildcards: number;
  record: RunRecord;
  seenBlueprints: string[];
  seenEnemies: string[];
  seenRules: string[];
  /** Crafts per blueprint so far — tells us which word is actually carrying. */
  craftsByBlueprint: Record<string, number>;
}

export const freshRecord = (): RunRecord => ({
  crafts: 0,
  kills: 0,
  longestChain: 0,
  firstCraft: null,
  letters: 0,
  wildcards: 0,
  cleared: 0,
  failed: false,
  completed: false,
});

export class Run {
  state: RunState;
  /** Rewards rolled for the encounter that just finished. */
  pendingRewards: RewardDef[] = [];

  private constructor(state: RunState) {
    this.state = state;
  }

  static create(seed: number, kitId: string): Run {
    const kit = kitById(kitId);
    const run = new Run({
      seed,
      kitId,
      encounterIndex: 0,
      bag: kit.bag.slice(),
      blueprints: kit.blueprints.slice(), 
      ruleIds: [],
      flags: [],
      coreHp: kit.coreHp,
      maxCoreHp: kit.coreHp,
      wildcards: kit.wildcards,
      record: freshRecord(),
      seenBlueprints: kit.blueprints.slice(),
      seenEnemies: [],
      seenRules: [],
      craftsByBlueprint: {},
    });
    return run;
  }

  static deserialize(raw: string): Run | null {
    try {
      const parsed = JSON.parse(raw) as RunState;
      if (!parsed || typeof parsed.seed !== 'number' || !Array.isArray(parsed.bag)) return null;
      return new Run(parsed);
    } catch {
      return null;
    }
  }

  serialize(): string {
    return JSON.stringify(this.state);
  }

  get kit(): KitDef {
    return kitById(this.state.kitId);
  }

  get rules(): MachineRuleDef[] {
    return this.state.ruleIds
      .map((id) => RULES.find((r) => r.id === id))
      .filter((r): r is MachineRuleDef => !!r);
  }

  get blueprints() {
    return this.state.blueprints.map((id) => (id ? BLUEPRINTS[id] : null));
  }

  encounter(): EncounterDef {
    return RUN[Math.min(this.state.encounterIndex, RUN.length - 1)];
  }

  get isLastEncounter(): boolean {
    return this.state.encounterIndex >= RUN.length - 1;
  }

  get finished(): boolean {
    return this.state.record.failed || this.state.record.completed;
  }

  /**
   * The slot whose word has actually carried the least weight so far. Swapping
   * that one keeps the player's best engine intact, which is what makes a
   * blueprint reward feel like an upgrade instead of a replacement.
   */
  leastUsedSlot(): number {
    let best = 2;
    let bestCount = Number.POSITIVE_INFINITY;
    this.state.blueprints.forEach((id, slot) => {
      if (!id) {
        best = slot;
        bestCount = -1;
        return;
      }
      const n = this.state.craftsByBlueprint[id] ?? 0;
      if (n < bestCount) {
        bestCount = n;
        best = slot;
      }
    });
    return best;
  }

  buildBattle(): Battle {
    const encounter = this.encounter();
    const cfg: BattleConfig = {
      seed: this.state.seed,
      encounter,
      bagTiles: this.state.bag.slice(),
      blueprints: this.blueprints,
      rules: this.rules,
      flags: this.state.flags,
      coreHp: this.state.coreHp,
      maxCoreHp: this.state.maxCoreHp,
      wildcards: this.state.wildcards,
      encounterIndex: this.state.encounterIndex,
    };
    return new Battle(cfg);
  }

  /** Fold an encounter's results back into the run. */
  absorb(battle: Battle): void {
    const r = this.state.record;
    const data = battle.telemetry.data;
    r.crafts += data.crafts;
    r.kills += data.kills;
    r.letters += data.lettersRecovered;
    r.wildcards += data.wildcardsUsed;
    r.longestChain = Math.max(r.longestChain, data.longestChain);
    if (data.firstCraftTime !== null) {
      r.firstCraft = r.firstCraft === null ? data.firstCraftTime : Math.min(r.firstCraft, data.firstCraftTime);
    }
    this.state.coreHp = Math.max(0, battle.coreHp);
    this.state.wildcards = battle.wildcardsLeft > 0 ? battle.wildcardsLeft : kitById(this.state.kitId).wildcards;
    for (const [id, count] of Object.entries(data.craftsByBlueprint)) {
      this.state.craftsByBlueprint[id] = (this.state.craftsByBlueprint[id] ?? 0) + count;
    }
    for (const enemy of battle.enemies) {
      if (!this.state.seenEnemies.includes(enemy.kind)) this.state.seenEnemies.push(enemy.kind);
    }
    for (const rule of this.rules) {
      if (!this.state.seenRules.includes(rule.id)) this.state.seenRules.push(rule.id);
    }
    for (const id of this.state.blueprints) {
      if (id && !this.state.seenBlueprints.includes(id)) this.state.seenBlueprints.push(id);
    }

    if (battle.state === 'failed') {
      r.failed = true;
      return;
    }
    r.cleared += 1;
    if (this.isLastEncounter) {
      r.completed = true;
      return;
    }
    this.pendingRewards = generateRewards(this, streamFor(this.state.seed + this.state.encounterIndex * 104729, 'reward'));
  }

  applyReward(reward: RewardDef): void {
    const st = this.state;
    switch (reward.kind) {
      case 'bagAdd':
        st.bag.push(reward.letter);
        break;
      case 'bagRemove': {
        const i = st.bag.indexOf(reward.letter);
        if (i >= 0) st.bag.splice(i, 1);
        break;
      }
      case 'bagDuplicate':
        st.bag.push(reward.letter);
        break;
      case 'repair':
        st.coreHp = Math.min(st.maxCoreHp, st.coreHp + reward.amount);
        break;
      case 'rule':
        if (!st.ruleIds.includes(reward.rule.id)) st.ruleIds.push(reward.rule.id);
        if (!st.seenRules.includes(reward.rule.id)) st.seenRules.push(reward.rule.id);
        break;
      case 'tweak':
        if (!st.flags.includes(reward.flag)) st.flags.push(reward.flag);
        break;
      case 'blueprint': {
        st.blueprints[reward.replaceSlot] = reward.blueprint.id;
        if (!st.seenBlueprints.includes(reward.blueprint.id)) st.seenBlueprints.push(reward.blueprint.id);
        break;
      }
      default:
        break;
    }
    // Wildcard charges refresh every encounter; a run-wide bonus is possible
    // later, but the brief's rule is one charge unless a build adds another.
    st.wildcards = kitById(st.kitId).wildcards + (st.flags.includes('twoCharges') ? 1 : 0);
    this.pendingRewards = [];
  }

  advance(): void {
    this.state.encounterIndex = Math.min(this.state.encounterIndex + 1, RUN.length - 1);
    // Core damage carries between encounters, so the run keeps tension; a
    // fraction is repaired to keep a long run winnable.
    this.state.coreHp = Math.min(
      this.state.maxCoreHp,
      this.state.coreHp + Math.round(this.state.maxCoreHp * 0.24),
    );
  }

  /** All kits, including any unlocked later; hooks for meta progression. */
  static kits(): KitDef[] {
    return KITS;
  }
}

export const runProgress = (state: RunState): { index: number; total: number } => ({
  index: Math.min(state.encounterIndex + 1, RUN.length),
  total: RUN.length,
});
