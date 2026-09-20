/** Word lookup, letter values and polarity. */
import { DICT_RAW } from '../data/dict';
import { COMMON_RAW } from '../data/common';
import { PRIMER_RAW } from '../data/primer';
import type { Polarity } from './types';

const WORDS: string[] = decode(DICT_RAW);
const WORD_SET: Set<string> = new Set(WORDS);
const COMMON_LIST: string[] = decode(COMMON_RAW);
const COMMON_SET: Set<string> = new Set(COMMON_LIST);
export const PRIMER: string[] = decode(PRIMER_RAW);

/** 26-bit letter mask per dictionary word - a fast reject before counting. */
const MASKS = new Uint32Array(WORDS.length);
for (let i = 0; i < WORDS.length; i++) {
  let m = 0;
  const w = WORDS[i];
  for (let j = 0; j < w.length; j++) m |= 1 << (w.charCodeAt(j) - 97);
  MASKS[i] = m;
}

export const MIN_WORD = 3;
export const MAX_WORD = 9;

/** Letter worth, roughly Scrabble-shaped but flattened so short words stay viable. */
const VALUE: Record<string, number> = {
  a: 1, e: 1, i: 1, o: 1, u: 1, l: 1, n: 1, s: 1, t: 1, r: 1,
  d: 2, g: 2,
  b: 3, c: 3, m: 3, p: 3,
  f: 4, h: 4, v: 4, w: 4, y: 4,
  k: 5,
  j: 8, x: 8,
  q: 10, z: 10,
};

export const letterValue = (ch: string): number => VALUE[ch] ?? 1;

/** Vowels and soft sonorants charge your engine; hard consonants corrode the enemy. */
const POSITIVE = new Set('aeioulmnrst');

export function polarityOf(ch: string): Polarity {
  return POSITIVE.has(ch) ? 'pos' : 'neg';
}

export const isWord = (s: string): boolean => WORD_SET.has(s);
export const isCommon = (s: string): boolean => COMMON_SET.has(s);

/** Word score used for power and for ranking found words. */
export function scoreWord(word: string): number {
  const n = word.length;
  let v = 0;
  for (const ch of word) v += letterValue(ch);
  const lengthBonus = 1 + (n - MIN_WORD) * 0.24;
  const obscurity = COMMON_SET.has(word) ? 0.94 : 1.06;
  return v * lengthBonus * obscurity;
}

/** Fixed board bonus so weapons stay useful as enemy stats scale. */
export const RANK_BONUS = [0, 0, 0, 0, 5, 16, 30, 52, 84, 130];
export const rankBonus = (len: number) => RANK_BONUS[Math.min(len, MAX_WORD)] ?? 0;

/** Length multiplier applied to the letter pipeline. */
export const LENGTH_MUL = [0, 0, 0, 1, 1.22, 1.5, 1.86, 2.3, 2.85, 3.5];
export const lengthMul = (len: number) => LENGTH_MUL[Math.min(len, MAX_WORD)] ?? 1;

export type Found = { word: string; score: number; common: boolean };

/**
 * Every dictionary word this letter multiset can spell (order free).
 * Bounded so it stays instant for a 10 letter rack with blanks.
 */
export function findWords(letters: string[], limit = 240, min = MIN_WORD): Found[] {
  const counts = new Array(26).fill(0) as number[];
  let rackMask = 0;
  for (const ch of letters) {
    const c = ch.charCodeAt(0) - 97;
    counts[c]++;
    rackMask |= 1 << c;
  }
  const avail = letters.length;
  const cap = limit * 3;
  const out: Found[] = [];
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    const n = w.length;
    if (n < min || n > avail) continue;
    if ((MASKS[i] & ~rackMask) !== 0) continue;
    const need = NEED;
    need.fill(0);
    let ok = true;
    for (let j = 0; j < n; j++) {
      const c = w.charCodeAt(j) - 97;
      if (++need[c] > counts[c]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    out.push({ word: w, score: scoreWord(w), common: COMMON_SET.has(w) });
    if (out.length >= cap) break;
  }
  out.sort((a, b) => b.score - a.score || a.word.length - b.word.length || a.word.localeCompare(b.word));
  return out.slice(0, limit);
}

const NEED = new Array(26).fill(0) as number[];

/** Is `word` spellable from the rack (each letter used at most once)? */
export function spellable(word: string, letters: string[]): number[] {
  const used = new Array(letters.length).fill(false);
  const idx: number[] = [];
  for (const ch of word) {
    let found = -1;
    for (let i = 0; i < letters.length; i++) {
      if (!used[i] && letters[i] === ch) {
        found = i;
        break;
      }
    }
    if (found < 0) return [];
    used[found] = true;
    idx.push(found);
  }
  return idx;
}

/**
 * A rack with no spellable word would soft-lock the forge. This swaps letters
 * until a familiar word fits, so there is always something to build.
 */
export function ensureSpellable(letters: string[], swap: (i: number, ch: string) => void): boolean {
  if (hasWord(letters)) return true;
  for (const w of COMMON_LIST) {
    if (w.length < 4 || w.length > letters.length) continue;
    const idx = spellable(w, letters);
    if (!idx.length) continue;
    for (let k = 0; k < w.length; k++) {
      if (letters[idx[k]] !== w[k]) swap(idx[k], w[k]);
    }
    return true;
  }
  // fall back to a primer word, replacing whatever is in the way
  for (const w of PRIMER) {
    if (w.length > letters.length) continue;
    for (let k = 0; k < w.length; k++) if (letters[k] !== w[k]) swap(k, w[k]);
    return true;
  }
  return false;
}

/** Is there at least one dictionary word in this rack? */
export function hasWord(letters: string[]): boolean {
  if (letters.length < MIN_WORD) return false;
  const counts = new Array(26).fill(0) as number[];
  let mask = 0;
  for (const ch of letters) {
    const c = ch.charCodeAt(0) - 97;
    counts[c]++;
    mask |= 1 << c;
  }
  for (let i = 0; i < WORDS.length; i++) {
    const w = WORDS[i];
    const n = w.length;
    if (n < MIN_WORD || n > letters.length) continue;
    if ((MASKS[i] & ~mask) !== 0) continue;
    const need = NEED;
    need.fill(0);
    let ok = true;
    for (let j = 0; j < n; j++) {
      const c = w.charCodeAt(j) - 97;
      if (++need[c] > counts[c]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

/** A nudge when the player is stuck: one real, friendly word hiding in the rack. */
export function hintWord(letters: string[], min = 4): string | null {
  const counts = new Array(26).fill(0) as number[];
  for (const ch of letters) counts[ch.charCodeAt(0) - 97]++;
  let fallback: string | null = null;
  for (const w of COMMON_LIST) {
    if (w.length < min || w.length > letters.length) continue;
    const need = new Array(26).fill(0) as number[];
    let ok = true;
    for (let i = 0; i < w.length; i++) {
      const c = w.charCodeAt(i) - 97;
      if (++need[c] > counts[c]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      if (!fallback || w.length < fallback.length || (w.length === fallback.length && w < fallback)) {
        // Prefer a word the player has not seen yet; keep the shortest as fallback.
        if (!fallback) fallback = w;
        else if (w.length < fallback.length) fallback = w;
      }
      if (w.length === min && fallback) return fallback;
    }
  }
  return fallback;
}

/** Decode a front-coded list: prefix length + suffix per entry. */
function decode(raw: string): string[] {
  const out: string[] = [];
  let prev = '';
  for (const line of raw.split('\n')) {
    const shared = line.charCodeAt(0);
    const word = prev.slice(0, shared) + line.slice(1);
    out.push(word);
    prev = word;
  }
  return out;
}
