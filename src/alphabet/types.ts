/** Core alphabet domain types. Pure data — no DOM, no rendering, no timers. */
import type { LocaleText } from '../core/i18n';

/** A single letter tile is always one uppercase ASCII letter. */
export type Letter = string;

export type BlueprintId =
  | 'BOMB'
  | 'FIRE'
  | 'BEE'
  | 'WALL'
  | 'FAN'
  | 'OIL'
  | 'MINE'
  | 'SAW'
  | 'WEB'
  | 'ICE';

/**
 * Bounded semantic vocabulary. Interactions come from authored rules over these
 * tags rather than from a physics engine, which keeps combat reproducible.
 */
export type Tag =
  | 'EXPLOSIVE'
  | 'BURNING'
  | 'FLAMMABLE'
  | 'LIQUID'
  | 'PUSHABLE'
  | 'PUSH'
  | 'LIGHT'
  | 'HEAVY'
  | 'BLOCKING'
  | 'STRUCTURE'
  | 'GROUND'
  | 'FLYING'
  | 'HUNTER'
  | 'AREA'
  | 'SETUP'
  | 'UTILITY';

export interface BlueprintDef {
  id: BlueprintId;
  /** The recipe word. Identical in every language: it is a gameplay token. */
  word: string;
  /** Required letter multiset, e.g. ['B','B','O','M']. */
  recipe: Letter[];
  tags: Tag[];
  /** Which object this word materialises as. */
  object: BlueprintId;
  name: LocaleText;
  desc: LocaleText;
  color: string;
  /**
   * Maximum simultaneous objects of this blueprint. Structures and zones have no
   * win condition, so without a cap a defensive build could stall a fight
   * forever — the cap keeps every encounter resolvable and the field readable.
   */
  limit: number;
  /** Ordering for codex lists and tutorial authoring. */
  order: number;
  starter: boolean;
}

export type LetterSource = 'bag' | 'carrier' | 'bonus' | 'recycle' | 'wildcard';

/** One physical tile sitting in the shared pool. */
export interface PoolEntry {
  uid: number;
  letter: Letter;
  source: LetterSource;
  /** Simulation time the tile entered the pool (used for arrival animation). */
  t: number;
  /** True while the tile is still flying in from its source. */
  incoming?: boolean;
}

export interface Completion {
  blueprint: BlueprintDef;
  slot: number;
  entries: PoolEntry[];
}

export interface WildcardTarget {
  blueprint: BlueprintDef;
  slot: number;
  missing: Letter;
  /**
   * Which socket position is empty. V2 resolves a *position*, not an abstract
   * multiset, so the wildcard tile has somewhere exact to land (brief 3.3).
   */
  socket: number;
}

/** Multiset helpers shared by bag, pool and resolver. */
export function countLetters(letters: readonly Letter[]): Map<Letter, number> {
  const out = new Map<Letter, number>();
  for (const ch of letters) out.set(ch, (out.get(ch) ?? 0) + 1);
  return out;
}

/**
 * Multiset difference `need - have`. Returns the letters still required.
 * An empty result means the recipe can be crafted.
 */
export function deficit(need: readonly Letter[], have: Map<Letter, number>): Letter[] {
  const remaining = new Map(have);
  const out: Letter[] = [];
  for (const ch of need) {
    const n = remaining.get(ch) ?? 0;
    if (n > 0) remaining.set(ch, n - 1);
    else out.push(ch);
  }
  return out;
}
