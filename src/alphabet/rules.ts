/**
 * Machine Rules — the third build pillar.
 *
 * A Machine Rule changes how the alphabet economy behaves instead of adding a
 * percentage. Rules are data: they expose hooks that the battle fires, and each
 * hook may push letters back into the system through the same API everything
 * else uses.
 */
import type { LocaleText } from '../core/i18n';
import type { BlueprintDef, Letter } from './types';

export interface DrawHookEvent {
  letter: Letter;
  cycle: number;
  cycleStart: boolean;
  cycleEnd: boolean;
  /** Push extra tiles straight into the pool. */
  addBonus: (letter: Letter, count?: number) => void;
}

export interface CraftHookEvent {
  blueprint: BlueprintDef;
  /** 1-based index of this craft within the encounter. */
  craftIndex: number;
  /** 1-based index of this craft for this blueprint within the encounter. */
  blueprintCraftIndex: number;
  /** Return a letter to the pool after crafting. */
  refund: (letter: Letter) => void;
}

export interface KillHookEvent {
  /** True when the dead enemy was a letter carrier. */
  carrier: boolean;
  letters: Letter[];
  /**
   * 1-based index of this kill within the encounter.
   *
   * Without it a rule cannot express "the first kill" — which is exactly the
   * behaviour `firstKillTriple` advertises, and why that rule used to fire on
   * every single carrier kill instead.
   */
  killIndex: number;
  /** Duplicate a recovered letter before it settles in the pool. */
  duplicate: (letter: Letter) => void;
}

export interface EncounterStartEvent {
  /** Insert a tile into the bag for this encounter onward. */
  inject: (letter: Letter) => void;
  /** Drop a tile straight into the shared pool as the fight opens. */
  addToPool: (letter: Letter) => void;
  /** A letter from the blueprint alphabet, chosen from the encounter's own RNG. */
  randomLetter: () => Letter;
}

export interface EncounterEndEvent {
  /** Wildcard charges left unspent when the encounter resolved. */
  unspentWildcards: number;
  /** Add a tile to the bag for the next encounter. */
  addToBag: (letter: Letter) => void;
  /** Draw a random vowel from the supplied alphabet. */
  randomVowel: () => Letter;
}

export interface RuleHooks {
  onDraw?: (e: DrawHookEvent) => void;
  onCraft?: (e: CraftHookEvent) => void;
  onKill?: (e: KillHookEvent) => void;
  onEncounterStart?: (e: EncounterStartEvent) => void;
  onEncounterEnd?: (e: EncounterEndEvent) => void;
}

export interface MachineRuleDef extends RuleHooks {
  id: string;
  name: LocaleText;
  desc: LocaleText;
  /** Rules with a slot limit stop being offered once owned. */
  unique?: boolean;
  /** Which blueprint the rule mentions, purely for codex grouping. */
  about?: BlueprintDef['id'];
}
