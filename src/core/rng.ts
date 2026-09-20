/** Deterministic seeded RNG (mulberry32) so runs are reproducible from a seed. */
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

  /** Integer in [a, b]. */
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
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  sample<T>(arr: readonly T[], n: number): T[] {
    return this.shuffle(arr.slice()).slice(0, n);
  }
}

let counter = 0;
/** A loosely random seed for "new run" without a seed string. */
export function freshSeed(): number {
  counter += 1;
  return ((Date.now() & 0xffffffff) ^ (counter * 0x9e3779b9) ^ (Math.random() * 0xffffffff)) >>> 0;
}

export const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const invLerp = (a: number, b: number, v: number) => (b === a ? 0 : (v - a) / (b - a));
export const smooth = (t: number) => t * t * (3 - 2 * t);
export const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
export const easeIn = (t: number) => t * t * t;
export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
export const easeBack = (t: number) => 1 + 2.2 * Math.pow(t - 1, 3) + 1.2 * Math.pow(t - 1, 2);
export const easeOutElastic = (t: number) => {
  if (t <= 0) return 0;
  if (t >= 1) return 1;
  const c = (2 * Math.PI) / 3;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c) + 1;
};

/** Frame-rate independent exponential approach. */
export const damp = (a: number, b: number, rate: number, dt: number) =>
  lerp(a, b, 1 - Math.exp(-rate * dt));

export const approach = (a: number, b: number, step: number) =>
  a < b ? Math.min(a + step, b) : Math.max(a - step, b);
