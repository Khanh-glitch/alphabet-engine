/**
 * The shared Letter Pool.
 *
 * Every letter the player owns during a fight lives here: bag draws, letters
 * recovered from carriers, refunds and wildcard substitutions. The pool is the
 * only thing the recipe resolver reads, which is why a kill can immediately
 * complete a blueprint — and why cascades happen.
 */
import type { Letter, LetterSource, PoolEntry } from './types';
import { deficit } from './types';

export class LetterPool {
  private entries: PoolEntry[] = [];
  private nextUid = 1;

  get size(): number {
    return this.entries.length;
  }

  /** Tiles in pool order (oldest first). */
  all(): readonly PoolEntry[] {
    return this.entries;
  }

  add(letter: Letter, source: LetterSource, t: number, incoming = false): PoolEntry {
    const entry: PoolEntry = { uid: this.nextUid++, letter, source, t, incoming };
    this.entries.push(entry);
    return entry;
  }

  /** Mark an arriving tile as settled so it stops being animated. */
  settle(uid: number): void {
    const entry = this.entries.find((e) => e.uid === uid);
    if (entry) entry.incoming = false;
  }

  notes(): Map<Letter, number> {
    const out = new Map<Letter, number>();
    for (const e of this.entries) out.set(e.letter, (out.get(e.letter) ?? 0) + 1);
    return out;
  }

  count(letter: Letter): number {
    let n = 0;
    for (const e of this.entries) if (e.letter === letter) n += 1;
    return n;
  }

  hasRecipe(recipe: readonly Letter[]): boolean {
    return deficit(recipe, this.notes()).length === 0;
  }

  /** Missing letters for a recipe (empty when craftable). */
  missing(recipe: readonly Letter[]): Letter[] {
    return deficit(recipe, this.notes());
  }

  /**
   * Consume the exact multiset a recipe needs. Oldest tiles are spent first so
   * the tray drains in a readable left-to-right order.
   */
  take(recipe: readonly Letter[]): PoolEntry[] {
    const taken: PoolEntry[] = [];
    for (const ch of recipe) {
      const idx = this.entries.findIndex(
        (e) => e.letter === ch && !taken.some((tk) => tk.uid === e.uid),
      );
      if (idx < 0) return [];
      taken.push(this.entries[idx]);
    }
    this.entries = this.entries.filter((e) => !taken.some((tk) => tk.uid === e.uid));
    return taken;
  }

  /**
   * Consume every letter of a recipe except one instance of `except` — the
   * wildcard path, where the substitution stands in for the missing letter.
   * Returns null when the rest of the recipe is not actually available.
   */
  takeAllBut(recipe: readonly Letter[], except: Letter): PoolEntry[] | null {
    const need = recipe.slice();
    const i = need.indexOf(except);
    if (i < 0) return null;
    need.splice(i, 1);
    const taken = this.take(need);
    return taken.length === need.length ? taken : null;
  }

  /** Remove a specific tile by id (used by recycling rules). */
  removeUid(uid: number): PoolEntry | null {
    const i = this.entries.findIndex((e) => e.uid === uid);
    if (i < 0) return null;
    return this.entries.splice(i, 1)[0];
  }

  /** Distinct letters with counts, sorted A→Z — the HUD's tray order. */
  tray(): { letter: Letter; count: number; uid: number }[] {
    const seen = new Map<Letter, { letter: Letter; count: number; uid: number }>();
    for (const e of this.entries) {
      const row = seen.get(e.letter);
      if (row) row.count += 1;
      else seen.set(e.letter, { letter: e.letter, count: 1, uid: e.uid });
    }
    return [...seen.values()].sort((a, b) => a.letter.localeCompare(b.letter));
  }

  clear(): void {
    this.entries = [];
  }
}
