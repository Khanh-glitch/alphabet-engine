/**
 * The forge: turns a word into a weapon.
 *
 * Three layers stack, and all three are visible on the weapon card:
 *   1. LETTERS   - letter values and word length set the raw damage curve.
 *   2. KEYWORD   - a themed family in the word (BLAST, CHILL, ...) sets the firing pattern.
 *   3. SPECIALS  - rare letters (q, z, j, k, x ...) each bolt on a bonus.
 * On top of that, letter polarity applies CHARGED / CORRODED on hit, which is
 * what makes weapons feed each other.
 */
import type { IconName } from '../core/draw';
import { C, TRAIT_COLOR } from '../theme';
import { alpha, mix } from '../core/draw';
import { letterValue, polarityOf, rankBonus, MIN_WORD } from './dict';
import type { Polarity, Trait, WeaponDef } from './types';

export interface TraitInfo {
  label: string;
  icon: IconName;
  blurb: string;
  color: string;
}

export const TRAITS: Record<Trait, TraitInfo> = {
  BLAST: {
    label: 'Blast',
    icon: 'star',
    blurb: 'Arcing shells that detonate in a wide radius.',
    color: TRAIT_COLOR.BLAST,
  },
  CHILL: {
    label: 'Chill',
    icon: 'wave',
    blurb: 'Frost bursts that slow everything they touch.',
    color: TRAIT_COLOR.CHILL,
  },
  CHAIN: {
    label: 'Chain',
    icon: 'bolt',
    blurb: 'Arcs jump to nearby enemies after the first hit.',
    color: TRAIT_COLOR.CHAIN,
  },
  PIERCE: {
    label: 'Pierce',
    icon: 'arrow',
    blurb: 'Rounds punch straight through a line of enemies.',
    color: TRAIT_COLOR.PIERCE,
  },
  HEAVY: {
    label: 'Heavy',
    icon: 'anvil',
    blurb: 'Crushing hits with knockback and stun.',
    color: TRAIT_COLOR.HEAVY,
  },
  SWIFT: {
    label: 'Swift',
    icon: 'play',
    blurb: 'Fires far more often for a little less per shot.',
    color: TRAIT_COLOR.SWIFT,
  },
  SPLIT: {
    label: 'Split',
    icon: 'map',
    blurb: 'Scatters into a fan of projectiles.',
    color: TRAIT_COLOR.SPLIT,
  },
  NONE: { label: 'Plain', icon: 'check', blurb: 'No family. Steady, honest damage.', color: C.dim },
};

type Family = { trait: Trait; words: string[] };

/** Keyword families. The longest matching keyword wins, so "thunderclap" reads BLAST. */
const FAMILIES: Family[] = [
  {
    trait: 'BLAST',
    words: [
      'blast', 'bomb', 'boom', 'burst', 'crash', 'crush', 'doom', 'drum', 'fury', 'gale', 'gun',
      'hammer', 'howl', 'kick', 'kill', 'loud', 'mine', 'nova', 'nuke', 'quake', 'rage', 'rend',
      'roar', 'rocket', 'slam', 'smash', 'smack', 'storm', 'shock', 'strike', 'thunder', 'wreck',
      'clash', 'crack', 'brute', 'powder', 'shatter', 'tremor', 'volcano', 'war', 'beat', 'brawl',
    ],
  },
  {
    trait: 'CHILL',
    words: [
      'chill', 'cold', 'cool', 'cryo', 'freeze', 'frost', 'frozen', 'gel', 'glacial', 'hail',
      'ice', 'icy', 'mist', 'numb', 'sleet', 'slow', 'snow', 'winter', 'haze', 'still', 'calm',
      'quiet', 'hush', 'lull', 'fog', 'dew', 'damp',
    ],
  },
  {
    trait: 'CHAIN',
    words: [
      'arc', 'chain', 'charge', 'circuit', 'coil', 'current', 'flux', 'link', 'loop', 'mesh',
      'net', 'node', 'pulse', 'relay', 'ripple', 'spark', 'stream', 'surge', 'volt', 'wave',
      'web', 'wire', 'zap', 'lash', 'whip', 'tide', 'flow',
    ],
  },
  {
    trait: 'PIERCE',
    words: [
      'arrow', 'bolt', 'dart', 'drill', 'gore', 'harpoon', 'impale', 'javelin', 'lance', 'nail',
      'needle', 'pierce', 'pin', 'quill', 'rail', 'rapier', 'shaft', 'skewer', 'sliver', 'spear',
      'spike', 'spine', 'stab', 'sting', 'thorn', 'thrust', 'tracer', 'lash', 'beam', 'ray',
    ],
  },
  {
    trait: 'HEAVY',
    words: [
      'anchor', 'anvil', 'boulder', 'brick', 'bulk', 'chunk', 'clod', 'colossus', 'great', 'grinder',
      'heavy', 'huge', 'iron', 'lead', 'mass', 'mega', 'mountain', 'rock', 'slab', 'stone', 'titan',
      'ton', 'wall', 'weight', 'grit', 'granite', 'stump', 'trunk', 'core', 'ballast', 'obelisk',
    ],
  },
  {
    trait: 'SWIFT',
    words: [
      'blink', 'dash', 'dodge', 'fast', 'flash', 'fleet', 'flick', 'flit', 'glide', 'gust', 'haste',
      'hurry', 'jet', 'jolt', 'leap', 'quick', 'rapid', 'run', 'rush', 'sprint', 'swoop', 'swift',
      'velocity', 'whirl', 'wind', 'zoom', 'whiz', 'zip', 'sly', 'feint',
    ],
  },
  {
    trait: 'SPLIT',
    words: [
      'break', 'cleave', 'clone', 'cut', 'dice', 'divide', 'echo', 'flock', 'fork', 'fragment',
      'part', 'prism', 'rift', 'rip', 'scatter', 'schism', 'sever', 'shard', 'shear', 'slice',
      'slit', 'snap', 'spawn', 'splinter', 'split', 'swarm', 'tear', 'twin', 'two', 'prong',
    ],
  },
];

function detectTrait(word: string): Trait {
  let best: Trait = 'NONE';
  let bestLen = 0;
  for (const fam of FAMILIES) {
    for (const kw of fam.words) {
      if (kw.length > word.length) continue;
      if (kw.length > bestLen && word.includes(kw)) {
        best = fam.trait;
        bestLen = kw.length;
      }
    }
  }
  // The word itself may be the keyword even if a longer one also matched.
  for (const fam of FAMILIES) if (fam.words.includes(word)) return fam.trait;
  return best;
}

export interface LetterMod {
  ch: string;
  tag: string;
  blurb: string;
}

/** Rare letters bolt a bonus onto the weapon. Shown as tags on the card. */
export const LETTER_MODS: LetterMod[] = [
  { ch: 'b', tag: 'Bane', blurb: '+30% damage to enemies under 45% health' },
  { ch: 'c', tag: 'Crux', blurb: '+18% critical chance (crits deal double)' },
  { ch: 'd', tag: 'Deft', blurb: '-15% cooldown' },
  { ch: 'f', tag: 'Flux', blurb: '+0.05 cascade charge per kill' },
  { ch: 'g', tag: 'Grit', blurb: 'Ignores 25% of armour' },
  { ch: 'h', tag: 'Haze', blurb: 'Applies lingering acid damage' },
  { ch: 'j', tag: 'Jitter', blurb: '+2 projectiles, wider spread' },
  { ch: 'k', tag: 'Kick', blurb: 'Knockback and a brief stun' },
  { ch: 'm', tag: 'Mass', blurb: '+10 explosion radius' },
  { ch: 'p', tag: 'Punch', blurb: '+12% damage' },
  { ch: 'q', tag: 'Quarry', blurb: '+30% damage and punches through one more' },
  { ch: 's', tag: 'Snap', blurb: '-12% cooldown' },
  { ch: 'v', tag: 'Volt', blurb: '+2 cascade charge on every hit' },
  { ch: 'w', tag: 'Wave', blurb: 'Arcs to one extra enemy' },
  { ch: 'x', tag: 'Xeno', blurb: '+1 projectile' },
  { ch: 'y', tag: 'Yield', blurb: 'Kills have an 8% chance to repair the core' },
  { ch: 'z', tag: 'Zilch', blurb: 'Slows the target hard' },
];

const MOD_BY_LETTER = new Map(LETTER_MODS.map((m) => [m.ch, m]));

export interface ForgeResult {
  def: WeaponDef;
  /** Damage the baseline letter pipeline produced before keyword/specials. */
  raw: number;
}

let uid = 1;

export function forgeWord(word: string, wave: number): ForgeResult {
  const len = word.length;
  const trait = detectTrait(word);
  const seen = new Set<string>();

  let value = 0;
  const polar: Polarity[] = [];
  for (const ch of word) {
    value += letterValue(ch);
    const p = polarityOf(ch);
    if (!polar.includes(p)) polar.push(p);
    if (MOD_BY_LETTER.has(ch)) seen.add(ch);
  }

  // 1. letters + length
  let dmg = value * 6.4 + rankBonus(len);
  dmg *= 1 + Math.max(0, len - MIN_WORD) * 0.16;

  let cooldown = 2.15 - len * 0.115;
  let range = 150 + len * 15 + (word.includes('y') || word.includes('x') ? 18 : 0);
  let aoe = 0;
  let pierce = 0;
  let chain = 0;
  let chainFalloff = 0.7;
  let shots = 1;
  let spread = 0.12;
  let knockback = 0;
  let stun = 0;
  let slow = 0;
  let slowDur = 0;
  let dot = 0;
  let dotDur = 0;
  let crit = 0.05;
  let critMul = 2;
  let execute = 1;
  let shred = 0;
  let healChance = 0;
  let fluxOnHit = 0;

  // 2. keyword family
  switch (trait) {
    case 'BLAST':
      dmg *= 1.26;
      aoe += 42;
      cooldown *= 1.12;
      break;
    case 'CHILL':
      dmg *= 0.84;
      slow = Math.max(slow, 0.42);
      slowDur = Math.max(slowDur, 1.5);
      aoe += 26;
      break;
    case 'CHAIN':
      dmg *= 0.9;
      chain += 2;
      chainFalloff = 0.72;
      break;
    case 'PIERCE':
      dmg *= 1.02;
      pierce += 3;
      break;
    case 'HEAVY':
      dmg *= 1.36;
      knockback += 24;
      stun = Math.max(stun, 0.32);
      cooldown *= 1.2;
      break;
    case 'SWIFT':
      dmg *= 0.88;
      cooldown *= 0.6;
      break;
    case 'SPLIT':
      dmg *= 0.72;
      shots += 2;
      spread = 0.45;
      break;
    case 'NONE':
      break;
  }

  // 3. special letters
  const mods: string[] = [];
  for (const ch of seen) {
    const m = MOD_BY_LETTER.get(ch);
    if (!m) continue;
    mods.push(m.tag);
    switch (ch) {
      case 'b': execute = 1.3; break;
      case 'c': crit += 0.18; break;
      case 'd': cooldown *= 0.85; break;
      case 'f': fluxOnHit += 0; break;
      case 'g': shred = Math.max(shred, 0.25); break;
      case 'h': dot = 3.2; dotDur = 3; break;
      case 'j': shots += 2; spread = Math.max(spread, 0.5); break;
      case 'k': knockback += 22; stun = Math.max(stun, 0.35); break;
      case 'm': aoe += 10; break;
      case 'p': dmg *= 1.12; break;
      case 'q': dmg *= 1.3; pierce += 1; break;
      case 's': cooldown *= 0.88; break;
      case 'v': fluxOnHit += 2; break;
      case 'w': chain += 1; break;
      case 'x': shots += 1; break;
      case 'y': healChance += 0.08; break;
      case 'z':
        slow = Math.max(slow, 0.35);
        slowDur = Math.max(slowDur, 1.6);
        break;
    }
  }
  // 'f' Flux tag is a cascade bonus rather than a per-hit bonus.
  const cascade =
    0.1 + len * 0.035 + (seen.has('f') ? 0.05 : 0) + (polar.includes('pos') ? 0.03 : 0);

  // Polarity decides the on-hit status: positive charges, negative corrodes.
  const def: WeaponDef = {
    id: uid++,
    word,
    trait,
    damage: Math.round(dmg * 10) / 10,
    cooldown: Math.round(Math.max(0.55, cooldown) * 100) / 100,
    range: Math.round(range),
    aoe,
    pierce,
    chain,
    chainFalloff,
    shots,
    spread,
    knockback,
    stun,
    slow,
    slowDur,
    dot,
    dotDur,
    crit,
    critMul,
    execute,
    shred,
    healChance,
    fluxOnHit,
    polar,
    cascade,
    len,
    mods,
    cost: 0,
    bornWave: wave,
  };
  return { def, raw: value * 6.4 + rankBonus(len) };
}

export const traitColor = (t: Trait): string => TRAITS[t].color;
export const traitLabel = (t: Trait): string => TRAITS[t].label;

/** Short human summary of a weapon, used on cards and tooltips. */
export function weaponLines(def: WeaponDef): { label: string; value: string; color: string }[] {
  const out: { label: string; value: string; color: string }[] = [
    { label: 'Damage', value: `${def.damage}`, color: C.ink },
    { label: 'Rate', value: `${(1 / def.cooldown).toFixed(2)}/s`, color: C.dim },
    { label: 'Range', value: `${def.range}`, color: C.dim },
  ];
  if (def.aoe > 0) out.push({ label: 'Blast', value: `${Math.round(def.aoe)}`, color: TRAIT_COLOR.BLAST });
  if (def.pierce > 0) out.push({ label: 'Pierce', value: `${def.pierce}`, color: TRAIT_COLOR.PIERCE });
  if (def.chain > 0) out.push({ label: 'Chain', value: `${def.chain}`, color: TRAIT_COLOR.CHAIN });
  if (def.shots > 1) out.push({ label: 'Shots', value: `${def.shots}`, color: TRAIT_COLOR.SPLIT });
  if (def.slow > 0) out.push({ label: 'Slow', value: `${Math.round(def.slow * 100)}%`, color: TRAIT_COLOR.CHILL });
  if (def.crit > 0.05) out.push({ label: 'Crit', value: `${Math.round(def.crit * 100)}%`, color: C.rose });
  return out;
}

/** The full stack of why a word is powerful - shown in the forge inspector. */
export function forgeBreakdown(def: WeaponDef, raw: number): { text: string; color: string }[] {
  const lines: { text: string; color: string }[] = [];
  lines.push({ text: `Letters and length: ${Math.round(raw * 10) / 10} base`, color: C.dim });
  const info = TRAITS[def.trait];
  if (def.trait !== 'NONE') {
    lines.push({ text: `${info.label}: ${info.blurb}`, color: info.color });
  }
  for (const m of def.mods) {
    const lm = LETTER_MODS.find((x) => x.tag === m);
    if (lm) lines.push({ text: `${lm.ch.toUpperCase()} - ${lm.tag}: ${lm.blurb}`, color: C.ink });
  }
  if (def.polar.includes('pos')) {
    lines.push({ text: 'CHARGED: hits mark the target, +16% damage from all sources', color: C.cyan });
  }
  if (def.polar.includes('neg')) {
    lines.push({ text: 'CORRODED: hits strip 30% of enemy armour', color: C.ember });
  }
  return lines;
}

export const CHARGED = alpha(C.cyan, 1);
export const CORRODED = alpha(C.ember, 1);

/** Blend used for weapon glyph colours so each word reads uniquely at a glance. */
export function weaponColor(def: WeaponDef): string {
  const base = TRAITS[def.trait].color;
  if (def.trait === 'NONE') {
    return def.polar.includes('neg') ? mix(C.dim, C.ember, 0.4) : mix(C.dim, C.cyan, 0.45);
  }
  return base;
}

export const RACK_SIZE_BASE = 8;
