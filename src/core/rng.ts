/**
 * Deterministic seeded RNG (mulberry32).
 *
 * A run is fully reproducible from its seed: bag order, reward offers, wave
 * composition and carrier assignment each get their own named stream so that
 * consuming randomness in one system never shifts another.
 */

const STREAM_SALT: Record<string, number> = {
  bag: 0x1a2b3c4d,
  reward: 0x2f9e1071,
  wave: 0x5bd1e995,
  carrier: 0x27d4eb2f,
  combat: 0x165667b1,
  cosmetic: 0x9e3779b9,
};

export class Rng {
  private s: number;

  constructor(seed: number) {
    this.s = seed >>> 0;
  }

  next(): number {
    this.s = (this.s + 0x6d2b79f5) >>> 0;
    let t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Float in [a, b). */
  range(a: number, b: number): number {
    return a + this.next() * (b - a);
  }

  /** Integer in [a, b] inclusive. */
  int(a: number, b: number): number {
    return a + Math.floor(this.next() * (b - a + 1));
  }

  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(arr: readonly T[]): T {
    return arr[Math.min(arr.length - 1, Math.floor(this.next() * arr.length))];
  }

  /** Weighted pick; weights need not be normalised. */
  weighted<T>(arr: readonly T[], weight: (item: T) => number): T {
    let total = 0;
    for (const it of arr) total += Math.max(0, weight(it));
    if (total <= 0) return this.pick(arr);
    let r = this.next() * total;
    for (const it of arr) {
      r -= Math.max(0, weight(it));
      if (r <= 0) return it;
    }
    return arr[arr.length - 1];
  }

  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr.slice()).slice(0, Math.max(0, n));
  }
}

/** Independent stream for one subsystem, derived from the run seed. */
export function streamFor(seed: number, name: keyof typeof STREAM_SALT | string): Rng {
  const salt = STREAM_SALT[name] ?? 0x1000193;
  let h = (seed ^ salt) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x45d9f3b) >>> 0;
  return new Rng((h ^ (h >>> 16)) >>> 0);
}

let counter = 0;
/** Loose seed for "new run" when the player does not type one. */
export function freshSeed(): number {
  counter += 1;
  return ((Date.now() & 0xffffffff) ^ (counter * 0x9e3779b9) ^ ((Math.random() * 0xffffffff) | 0)) >>> 0;
}

/** Human-friendly base36 seed, e.g. "K7Q2X1". */
export const seedLabel = (seed: number): string => (seed >>> 0).toString(36).toUpperCase().padStart(6, '0');
export const seedFromLabel = (label: string): number => {
  const n = parseInt(label.toLowerCase().replace(/[^0-9a-z]/g, ''), 36);
  return Number.isFinite(n) ? n >>> 0 : freshSeed();
};

export const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number): number => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t: number): number => t * t * (3 - 2 * t);
export const easeOut = (t: number): number => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number): number => t * t * t;
export const easeInOut = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
export const easeBack = (t: number): number => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
export const easeOutElastic = (t: number): number => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};
export const easeOutBack = (t: number): number => {
  const c = 1.9;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

/** Frame-rate independent exponential approach. */
export const damp = (a: number, b: number, rate: number, dt: number): number =>
  lerp(a, b, 1 - Math.exp(-rate * dt));

export const approach = (a: number, b: number, step: number): number =>
  a < b ? Math.min(a + step, b) : Math.max(a - step, b);
