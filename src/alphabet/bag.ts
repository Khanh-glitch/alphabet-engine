/**
 * The Letter Bag — the player's raw alphabet economy.
 *
 * Deterministic seeded shuffle, draws without replacement until the cycle is
 * exhausted, then a fresh shuffle. Duplicated letters are explicit tiles, never
 * hidden weights, so the player can reason about their own economy.
 */
import type { Rng } from '../core/rng';
import type { Letter } from './types';

export interface DrawResult {
  letter: Letter;
  /** 0-based index of the cycle the tile came from. */
  cycle: number;
  /** True when this draw started a new cycle. */
  cycleStart: boolean;
  /** True when the bag was emptied by this draw (the tile was the last of the cycle). */
  cycleEnd: boolean;
  /** Position within the current cycle. */
  indexInCycle: number;
}

export class LetterBag {
  private tiles: Letter[] = [];
  private queue: Letter[] = [];
  private cursor = 0;
  private cycle = 0;
  private rng: Rng;
  /** Draws performed in the current cycle — drives "first vowel / last tile" rules. */
  drawnThisCycle = 0;

  constructor(tiles: readonly Letter[], rng: Rng) {
    this.tiles = tiles.slice();
    this.rng = rng;
    this.reshuffle();
  }

  get cycleIndex(): number {
    return this.cycle;
  }

  get size(): number {
    return this.tiles.length;
  }

  /** Tiles still to be drawn this cycle. */
  get remaining(): number {
    return Math.max(0, this.queue.length - this.cursor);
  }

  /** The full multiset, sorted for display. */
  contents(): Letter[] {
    return this.tiles.slice().sort();
  }

  counts(): Map<Letter, number> {
    const out = new Map<Letter, number>();
    for (const ch of this.tiles) out.set(ch, (out.get(ch) ?? 0) + 1);
    return out;
  }

  private reshuffle(): void {
    this.queue = this.rng.shuffle(this.tiles.slice());
    this.cursor = 0;
    this.drawnThisCycle = 0;
  }

  /** Draw one tile; a new cycle is prepared once the current one is exhausted. */
  draw(): DrawResult {
    const cycleStart = this.drawnThisCycle === 0;
    if (this.cursor >= this.queue.length) {
      this.cycle += 1;
      this.reshuffle();
    }
    const letter = this.queue[this.cursor];
    this.cursor += 1;
    this.drawnThisCycle += 1;
    return {
      letter,
      cycle: this.cycle,
      cycleStart,
      cycleEnd: this.cursor >= this.queue.length,
      indexInCycle: this.drawnThisCycle - 1,
    };
  }

  /** Add a tile to the bag; it joins the current cycle's remaining queue when possible. */
  add(letter: Letter, opts: { front?: boolean } = {}): void {
    this.tiles.push(letter);
    if (opts.front) this.queue.splice(this.cursor, 0, letter);
    else this.queue.push(letter);
  }

  /** Remove one copy of a letter. Returns false when the bag has none. */
  remove(letter: Letter): boolean {
    const i = this.tiles.indexOf(letter);
    if (i < 0) return false;
    this.tiles.splice(i, 1);
    const q = this.queue.indexOf(letter, this.cursor);
    if (q >= 0) this.queue.splice(q, 1);
    return true;
  }

  /** Replace one letter with another, keeping the draw position. */
  replace(from: Letter, to: Letter): boolean {
    const i = this.tiles.indexOf(from);
    if (i < 0) return false;
    this.tiles[i] = to;
    const q = this.queue.indexOf(from, this.cursor);
    if (q >= 0) this.queue[q] = to;
    return true;
  }

  /** Change the bag's capacity by trimming the queued tail (or adding a tile). */
  setSize(target: number, filler: Letter): void {
    while (this.tiles.length > target) {
      const dropped = this.tiles.pop();
      if (dropped === undefined) break;
      const q = this.queue.lastIndexOf(dropped);
      if (q >= this.cursor) this.queue.splice(q, 1);
    }
    while (this.tiles.length < target) this.add(filler);
  }
}
