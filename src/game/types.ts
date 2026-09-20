/** Shared data model for the alphabet engine. */

export type Trait = 'BLAST' | 'CHILL' | 'CHAIN' | 'PIERCE' | 'HEAVY' | 'SWIFT' | 'SPLIT' | 'NONE';
export type Polarity = 'pos' | 'neg';

/** A word forged into a weapon. Everything here is derived from its letters. */
export interface WeaponDef {
  id: number;
  word: string;
  trait: Trait;
  damage: number;
  cooldown: number;
  range: number;
  aoe: number;
  pierce: number;
  chain: number;
  chainFalloff: number;
  shots: number;
  spread: number;
  knockback: number;
  stun: number;
  slow: number;
  slowDur: number;
  dot: number;
  dotDur: number;
  crit: number;
  critMul: number;
  execute: number;
  shred: number;
  healChance: number;
  fluxOnHit: number;
  polar: Polarity[];
  cascade: number;
  len: number;
  mods: string[];
  cost: number;
  bornWave: number;
}

export interface WeaponInst extends WeaponDef {
  lane: number;
  slot: number;
  x: number;
  y: number;
  cd: number;
  flash: number;
  recoil: number;
  aim: number;
  kills: number;
  shake: number;
}

export type EnemyKind =
  | 'mote'
  | 'drone'
  | 'brute'
  | 'weaver'
  | 'zapper'
  | 'warden'
  | 'phantom'
  | 'boss';

export interface EnemyDef {
  kind: EnemyKind;
  name: string;
  hp: number;
  speed: number;
  damage: number;
  armor: number;
  size: number;
  reward: number;
  slowImmune?: boolean;
  evasion?: number;
  auraArmor?: number;
  auraRange?: number;
  pulseSlow?: number;
  swarm?: number;
  boss?: boolean;
  tint: string;
}

export interface EnemyInst {
  uid: number;
  kind: EnemyKind;
  name: string;
  hp: number;
  maxHp: number;
  x: number;
  y: number;
  lane: number;
  speed: number;
  baseSpeed: number;
  damage: number;
  armor: number;
  size: number;
  reward: number;
  slowT: number;
  slowAmt: number;
  stunT: number;
  dotDps: number;
  dotT: number;
  hitFlash: number;
  markT: number;
  corrT: number;
  charge: number;
  wobble: number;
  dead: boolean;
  reached: boolean;
  pulseCd: number;
  uidAura: boolean;
}

export interface Proj {
  uid: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  speed: number;
  damage: number;
  trait: Trait;
  lane: number;
  targetUid: number;
  hits: number[];
  pierce: number;
  aoe: number;
  chain: number;
  chainFalloff: number;
  knockback: number;
  stun: number;
  slow: number;
  slowDur: number;
  dot: number;
  dotDur: number;
  arc: number;
  life: number;
  fromX: number;
  fromY: number;
  travel: number;
  travelMax: number;
  color: string;
  size: number;
  weaponUid: number;
  dead: boolean;
  trail: number[];
}

export interface Fx {
  kind: 'spark' | 'ring' | 'boom' | 'text' | 'shake' | 'flash' | 'beam';
  x: number;
  y: number;
  vx?: number;
  vy?: number;
  life: number;
  max: number;
  size: number;
  color: string;
  text?: string;
  lane?: number;
  amount?: number;
}

export interface WaveDef {
  index: number;
  hpMul: number;
  pool: number;
  count: number;
  kinds: EnemyKind[];
  gap: number;
  duration: number;
  reward: number;
  elite: boolean;
  boss: boolean;
  note: string;
}

export interface RackLetter {
  uid: number;
  ch: string;
}

export interface RunStats {
  kills: number;
  forged: number;
  bestCascade: number;
  damage: number;
  salvageEarned: number;
  longestWord: string;
  wavesCleared: number;
  turns: number;
  started: number;
}

export interface PerkDef {
  id: string;
  name: string;
  blurb: string;
  cost: number;
  max: number;
  tag: 'rack' | 'core' | 'flux' | 'forge' | 'lane';
}
