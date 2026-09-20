/** Run state: rack, lexicon, boons, market, map and persistence. */
import { Rng, freshSeed } from '../core/rng';
import { PRIMER, ensureSpellable, polarityOf } from './dict';
import { makeWave } from './waves';
import type { PerkDef, RackLetter, RunStats, WaveDef, WeaponDef } from './types';

export interface Placed {
  def: WeaponDef;
  lane: number;
  slot: number;
}

export interface Boons {
  /** Additive percentage multipliers. */
  damage: number;
  rate: number;
  range: number;
  crit: number;
  pierce: number;
  chain: number;
  core: number;
  rackSize: number;
  fluxGain: number;
  salvage: number;
  cascadeHold: number;
  discount: number;
  vowelPower: number;
}

export const emptyBoons = (): Boons => ({
  damage: 0,
  rate: 0,
  range: 0,
  crit: 0,
  pierce: 0,
  chain: 0,
  core: 0,
  rackSize: 0,
  fluxGain: 0,
  salvage: 0,
  cascadeHold: 0,
  discount: 0,
  vowelPower: 0,
});

export type NodeKind = 'battle' | 'elite' | 'market' | 'shrine' | 'rest' | 'supply';

export interface NodeDef {
  kind: NodeKind;
  name: string;
  blurb: string;
  detail: string;
}

export const NODES: Record<NodeKind, NodeDef> = {
  battle: {
    kind: 'battle',
    name: 'Front',
    blurb: 'A standard push on the core.',
    detail: '+10% salvage this wave',
  },
  elite: {
    kind: 'elite',
    name: 'Elite Front',
    blurb: 'A heavier push, and a rarer prize.',
    detail: '+60% salvage, +1 rare letter',
  },
  market: {
    kind: 'market',
    name: 'Market',
    blurb: 'Spend salvage on letters and upgrades.',
    detail: 'Trade salvage for power',
  },
  shrine: {
    kind: 'shrine',
    name: 'Shrine',
    blurb: 'Take one blessing, permanently.',
    detail: 'Pick 1 of 3 boons',
  },
  rest: {
    kind: 'rest',
    name: 'Repair Bay',
    blurb: 'Weld the core back together.',
    detail: 'Restore 22 core',
  },
  supply: {
    kind: 'supply',
    name: 'Supply Drop',
    blurb: 'Extra letters and salvage.',
    detail: '+3 letters, +20 salvage',
  },
};

export interface Blessing {
  id: string;
  name: string;
  blurb: string;
  apply: (b: Boons) => void;
}

export const BLESSINGS: Blessing[] = [
  { id: 'loud', name: 'Loud Words', blurb: '+12% weapon damage', apply: (b) => (b.damage += 0.12) },
  { id: 'quick', name: 'Quick Tongue', blurb: '+12% fire rate', apply: (b) => (b.rate += 0.12) },
  { id: 'long', name: 'Long Reach', blurb: '+18 range on every weapon', apply: (b) => (b.range += 18) },
  { id: 'static', name: 'Static Hold', blurb: 'Cascades linger 45% longer', apply: (b) => (b.cascadeHold += 0.45) },
  { id: 'greed', name: 'Greed', blurb: '+35% salvage from kills', apply: (b) => (b.salvage += 0.35) },
  { id: 'husk', name: 'Iron Husk', blurb: '+18 max core, repaired now', apply: (b) => (b.core += 18) },
  { id: 'magnet', name: 'Magnet', blurb: 'Abilities cost 20% less charge', apply: (b) => (b.discount += 0.2) },
  { id: 'prism', name: 'Prism', blurb: 'Every weapon pierces +1 enemy', apply: (b) => (b.pierce += 1) },
  { id: 'echo', name: 'Echo', blurb: 'Every weapon arcs to +1 enemy', apply: (b) => (b.chain += 1) },
  { id: 'wrap', name: 'Sharp Eye', blurb: '+8% crit chance on every weapon', apply: (b) => (b.crit += 0.08) },
  { id: 'polyglot', name: 'Polyglot', blurb: '+2 letters drawn each wave', apply: (b) => (b.rackSize += 2) },
  { id: 'vowel', name: 'Vowel Power', blurb: 'Words with 3+ vowels deal +25%', apply: (b) => (b.vowelPower += 0.25) },
  { id: 'surge', name: 'Deep Well', blurb: '+25% charge gained', apply: (b) => (b.fluxGain += 0.25) },
];

export const BLESSING_BY_ID = new Map(BLESSINGS.map((b) => [b.id, b]));

export interface HistoryEntry {
  wave: number;
  core: number;
  killed: number;
  cascade: number;
  note: string;
}

export interface RunState {
  seed: number;
  seedText: string;
  wave: number;
  core: number;
  maxCore: number;
  salvage: number;
  flux: number;
  fluxMax: number;
  rackSize: number;
  lanes: number;
  slotsPerLane: number;
  rack: RackLetter[];
  placed: Placed[];
  boons: Boons;
  blessings: string[];
  stats: RunStats;
  history: HistoryEntry[];
  eliteNext: boolean;
  salvageBonus: number;
  runRng: number;
  over: boolean;
  victory: boolean;
}

export interface SaveBlob {
  version: number;
  run: RunState;
}

const SAVE_KEY = 'ae.run.v2';

const LETTER_FREQ: [string, number][] = [
  ['e', 12.7], ['t', 9.1], ['a', 8.2], ['o', 7.5], ['i', 7.0], ['n', 6.7], ['s', 6.3],
  ['h', 6.1], ['r', 6.0], ['d', 4.3], ['l', 4.0], ['c', 2.8], ['u', 2.8], ['m', 2.4],
  ['w', 2.4], ['f', 2.2], ['g', 2.0], ['y', 2.0], ['p', 1.9], ['b', 1.5], ['v', 1.0],
  ['k', 0.8], ['j', 0.15], ['x', 0.15], ['q', 0.10], ['z', 0.07],
];
export const RARE = ['j', 'q', 'x', 'z', 'k', 'v', 'w', 'y'];

let letterUid = 1;

export function newRun(seedText?: string): RunState {
  const seed = seedText ? hashSeed(seedText) : freshSeed();
  const run: RunState = {
    seed,
    seedText: seedText ?? seed.toString(36).toUpperCase().slice(0, 6),
    wave: 1,
    core: 100,
    maxCore: 100,
    salvage: 40,
    flux: 0,
    fluxMax: 100,
    rackSize: 9,
    lanes: 5,
    slotsPerLane: 2,
    rack: [],
    placed: [],
    boons: emptyBoons(),
    blessings: [],
    stats: {
      kills: 0,
      forged: 0,
      bestCascade: 0,
      damage: 0,
      salvageEarned: 0,
      longestWord: '',
      wavesCleared: 0,
      turns: 0,
      started: Date.now(),
    },
    history: [],
    eliteNext: false,
    salvageBonus: 0,
    runRng: seed >>> 0,
    over: false,
    victory: false,
  };
  refillRack(run, true);
  return run;
}

function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export const rngFor = (run: RunState, salt: number): Rng =>
  new Rng((run.seed ^ Math.imul(run.wave + 1, 2654435761) ^ Math.imul(salt, 40503)) >>> 0);

export const rngOf = (run: RunState): Rng => {
  run.runRng = (run.runRng + 0x6d2b79f5) >>> 0;
  return new Rng(run.runRng);
};

/** Draw letters. Always seeds at least one real word so the rack is never dead. */
export function refillRack(run: RunState, initial = false): void {
  const rng = rngOf(run);
  const target = run.rackSize + Math.round(run.boons.rackSize);
  if (initial) {
    run.rack = [];
  } else if (run.rack.length > target) {
    run.rack = run.rack.slice(0, target);
  }
  if (run.rack.length >= target) return;

  const need = target - run.rack.length;
  const letters: string[] = [];

  // A guaranteed word, so there is always something to forge.
  const seedWord = rng.pick(PRIMER.filter((w) => w.length <= Math.min(5, need)));
  if (seedWord) for (const ch of seedWord) letters.push(ch);

  while (letters.length < need) {
    const ch = rng.weighted(LETTER_FREQ, (l) => l[1])[0];
    letters.push(ch);
  }
  // Keep a vowel floor and a consonant floor on the drawn portion.
  const vowels = 'aeiou';
  for (let i = 0; i < letters.length; i++) {
    const pool = letters.slice(seedWord ? seedWord.length : 0);
    const vc = pool.filter((c) => vowels.includes(c)).length;
    if (vc < 2) {
      const j = i < (seedWord?.length ?? 0) ? letters.length - 1 - (i % 3) : i;
      if (j >= 0 && j < letters.length && !vowels.includes(letters[j]) && letters[j] !== undefined) {
        letters[j] = rng.pick(['a', 'e', 'i', 'o', 'u']);
      }
    }
    if (i > 6) break;
  }

  rng.shuffle(letters);
  for (const ch of letters) run.rack.push({ uid: letterUid++, ch });
  if (run.rack.length > target) run.rack = run.rack.slice(0, target);
  guardPlayable(run);
}

/** Never hand the player a rack they cannot spell anything with. */
function guardPlayable(run: RunState): void {
  ensureSpellable(
    run.rack.map((l) => l.ch),
    (i, ch) => {
      if (run.rack[i] && run.rack[i].ch !== ch) run.rack[i] = { uid: letterUid++, ch };
    },
  );
}

export function addLetter(run: RunState, ch: string): void {
  run.rack.push({ uid: letterUid++, ch });
}

/** Apply permanent boons to a freshly forged weapon. */
export function applyBoons(def: WeaponDef, run: RunState): WeaponDef {
  const b = run.boons;
  const vowels = [...def.word].filter((c) => 'aeiou'.includes(c)).length;
  const vowelMul = vowels >= 3 ? 1 + b.vowelPower : 1;
  return {
    ...def,
    damage: Math.round(def.damage * (1 + b.damage) * vowelMul * 10) / 10,
    cooldown: Math.round((def.cooldown / (1 + b.rate)) * 100) / 100,
    range: Math.round(def.range + b.range),
    crit: def.crit + b.crit,
    pierce: def.pierce + b.pierce,
    chain: def.chain + b.chain,
  };
}

export function salvageMul(run: RunState): number {
  return 1 + run.boons.salvage + run.salvageBonus;
}

export function nextSlots(run: RunState): number {
  return run.slotsPerLane;
}

export function laneCount(run: RunState): number {
  return Math.min(5, 2 + Math.floor((run.wave - 1) / 2));
}

export function slotsUsed(run: RunState, lane: number): number {
  return run.placed.filter((p) => p.lane === lane).length;
}

export function laneFull(run: RunState, lane: number): boolean {
  return slotsUsed(run, lane) >= run.slotsPerLane;
}

export function totalSlots(run: RunState): number {
  return run.lanes * run.slotsPerLane;
}

// ---- market ---------------------------------------------------------------
export interface Offer {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  kind: 'letter' | 'pack' | 'upgrade';
  payload?: string;
  max: number;
  bought: number;
}

export function rollOffers(run: RunState): Offer[] {
  const rng = rngOf(run);
  const pool = LETTER_FREQ.map((l) => l[0]);
  const wanted = rng.sample(pool, 3);
  const offers: Offer[] = wanted.map((ch, i) => ({
    id: `letter-${i}-${ch}`,
    name: `Letter  ${ch.toUpperCase()}`,
    blurb: 'Adds this letter to your rack right now.',
    cost: 16,
    kind: 'letter' as const,
    payload: ch,
    max: 99,
    bought: 0,
  }));

  const catalogue: Offer[] = [
    {
      id: 'pack-vowel',
      name: 'Vowel Cache',
      blurb: 'Adds A, E and I to the rack.',
      cost: 34,
      kind: 'pack',
      payload: 'aei',
      max: 99,
      bought: 0,
    },
    {
      id: 'pack-rare',
      name: 'Rare Cache',
      blurb: 'Adds two rare letters (J Q X Z K V W Y).',
      cost: 38,
      kind: 'pack',
      payload: 'rare',
      max: 99,
      bought: 0,
    },
    {
      id: 'up-rack',
      name: 'Bigger Rack',
      blurb: '+2 letters drawn every wave.',
      cost: 46 + run.boons.rackSize * 12,
      kind: 'upgrade',
      payload: 'rackSize',
      max: 5,
      bought: run.blessings.filter((b) => b === 'up-rack').length,
    },
    {
      id: 'up-core',
      name: 'Core Plating',
      blurb: '+16 max core, and repair 16 now.',
      cost: 42 + (run.maxCore - 100) * 1.6,
      kind: 'upgrade',
      payload: 'core',
      max: 8,
      bought: Math.round((run.maxCore - 100) / 16),
    },
    {
      id: 'up-engine',
      name: 'Engine Tuning',
      blurb: '+20% charge from every kill, and +1 damage per shot.',
      cost: 52 + run.boons.fluxGain * 40,
      kind: 'upgrade',
      payload: 'fluxGain',
      max: 5,
      bought: Math.round(run.boons.fluxGain / 0.2),
    },
    {
      id: 'up-forge',
      name: 'Forge Heat',
      blurb: '+8% damage for every weapon you own.',
      cost: 58 + run.boons.damage * 60,
      kind: 'upgrade',
      payload: 'damage',
      max: 8,
      bought: Math.round(run.boons.damage / 0.08),
    },
    {
      id: 'up-slot',
      name: 'Mount Rail',
      blurb: '+1 weapon slot in every lane.',
      cost: 54 + (run.slotsPerLane - 2) * 40,
      kind: 'upgrade',
      payload: 'slot',
      max: 3,
      bought: run.slotsPerLane - 2,
    },
    {
      id: 'up-focus',
      name: 'Focusing Array',
      blurb: '+16 range and +8% fire rate.',
      cost: 48 + run.boons.rate * 50,
      kind: 'upgrade',
      payload: 'focus',
      max: 4,
      bought: Math.round(run.boons.rate / 0.08),
    },
  ];

  const picks = rng.sample(catalogue, 4).map((o) => ({ ...o, cost: Math.round(o.cost) }));
  return [...offers, ...picks];
}

export function buyOffer(run: RunState, offer: Offer): { ok: boolean; message: string } {
  const discount = 1 - run.boons.discount * 0.35;
  const cost = Math.max(1, Math.round(offer.cost * discount));
  if (run.salvage < cost) return { ok: false, message: 'Not enough salvage' };
  run.salvage -= cost;
  switch (offer.id.startsWith('letter-') ? 'letter' : (offer.payload ?? offer.id)) {
    case 'letter': {
      const ch = offer.payload;
      if (ch) addLetter(run, ch);
      return { ok: true, message: `Added ${ch?.toUpperCase()}` };
    }
    case 'aei':
      for (const ch of 'aei') addLetter(run, ch);
      return { ok: true, message: 'Added A E I' };
    case 'rare': {
      const rng = rngOf(run);
      const picks = rng.sample(RARE, 2);
      for (const ch of picks) addLetter(run, ch);
      return { ok: true, message: `Added ${picks.join(' ').toUpperCase()}` };
    }
    case 'rackSize':
      run.boons.rackSize += 2;
      refillRack(run);
      return { ok: true, message: '+2 rack' };
    case 'core':
      run.maxCore += 16;
      run.core = Math.min(run.maxCore, run.core + 16);
      return { ok: true, message: '+16 core' };
    case 'fluxGain':
      run.boons.fluxGain += 0.2;
      return { ok: true, message: 'Engine tuned' };
    case 'damage':
      run.boons.damage += 0.08;
      return { ok: true, message: 'Forge hotter' };
    case 'slot':
      run.slotsPerLane += 1;
      return { ok: true, message: '+1 slot per lane' };
    case 'focus':
      run.boons.rate += 0.08;
      run.boons.range += 16;
      return { ok: true, message: 'Array focused' };
    default:
      return { ok: false, message: 'Unavailable' };
  }
}

export const SHOP_PERKS: PerkDef[] = [];

// ---- persistence ----------------------------------------------------------
export function saveRun(run: RunState): void {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify({ version: 2, run }));
  } catch {
    /* storage may be unavailable */
  }
}

export function loadRun(): RunState | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const blob = JSON.parse(raw) as SaveBlob;
    if (!blob || blob.version !== 2 || !blob.run) return null;
    const run = blob.run;
    if (!run.rack || !Array.isArray(run.placed)) return null;
    return run;
  } catch {
    return null;
  }
}

export function clearRun(): void {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    /* ignore */
  }
}

export const hasSave = (): boolean => loadRun() !== null;

export function rackLetters(run: RunState): string[] {
  return run.rack.map((l) => l.ch);
}

export function spentLetters(run: RunState): number {
  return run.rack.length;
}

export function polarityMix(word: string): { pos: number; neg: number } {
  let pos = 0;
  let neg = 0;
  for (const ch of word) (polarityOf(ch) === 'pos' ? (pos += 1) : (neg += 1));
  return { pos, neg };
}

/** The wave the player is about to face - shared by the forge preview and the battle. */
export function previewWave(run: RunState): WaveDef {
  const w = makeWave(run.wave, rngFor(run, 7));
  if (run.eliteNext) {
    w.elite = true;
    w.note = 'ELITE FRONT';
    w.hpMul *= 1.18;
    w.reward = Math.round(w.reward * 1.6);
  }
  if (run.salvageBonus > 0) w.reward = Math.round(w.reward * (1 + run.salvageBonus));
  return w;
}

export function weaponCount(run: RunState): number {
  return run.placed.length;
}

export function totalDps(run: RunState): number {
  return Math.round(run.placed.reduce((a, p) => a + p.def.damage / p.def.cooldown, 0));
}
