/** Battlefield entity and event types. Simulation state only — no rendering. */
import type { BlueprintId, Letter, Tag } from '../alphabet/types';
import type { EnemyKindId } from '../content/tuning';

export interface Enemy {
  id: number;
  kind: EnemyKindId;
  x: number;
  lane: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  flying: boolean;
  size: number;
  /** Letter this enemy visibly carries; recovered on death. */
  carry: Letter | null;
  /** True when the letter was announced in the wave preview. */
  announced: boolean;
  hitFlash: number;
  slowT: number;
  slowAmt: number;
  burnT: number;
  burnDps: number;
  freezeT: number;
  stunT: number;
  /** Attack cooldown against blockers / the core. */
  attackCd: number;
  dead: boolean;
  /** Set the moment the enemy reaches the core, for the breach animation. */
  reached: boolean;
  spawnT: number;
  wobble: number;
  /** Boss escort timer. */
  escortT: number;
}

export type EntityState =
  | 'travel'
  | 'fuse'
  | 'armed'
  | 'burning'
  | 'slick'
  | 'sawing'
  | 'blowing'
  | 'hunting'
  | 'idle';

export interface Entity {
  id: number;
  kind: BlueprintId;
  x: number;
  y: number;
  lane: number;
  hp: number;
  maxHp: number;
  /** Remaining life in seconds; -1 means until destroyed. */
  ttl: number;
  age: number;
  alive: boolean;
  /** Materialise animation 0→1 before the object starts acting. */
  spawn: number;
  state: EntityState;
  tags: Tag[];
  /** Kind-specific timer (fuse, bite, blow period…). */
  timer: number;
  targetId: number;
  /** Set of enemy ids already hit (piercing objects). */
  hitIds: number[];
  anim: number;
}

export type BattleEvent =
  | { kind: 'draw'; letter: Letter; uid: number; source: 'bag' | 'bonus' }
  | { kind: 'craftStart'; blueprint: BlueprintId; slot: number; letters: Letter[] }
  | { kind: 'craftLock'; blueprint: BlueprintId; slot: number }
  | { kind: 'materialise'; blueprint: BlueprintId; entityId: number; x: number; lane: number }
  | { kind: 'explosion'; x: number; y: number; radius: number; color: string; blueprint: BlueprintId }
  | { kind: 'ignite'; x: number; radius: number }
  | { kind: 'push'; x: number; y: number }
  | { kind: 'kill'; x: number; y: number; letter: Letter | null; lane: number }
  | { kind: 'letterReturn'; letter: Letter; x: number; y: number; uid: number }
  | { kind: 'coreHit'; amount: number }
  | { kind: 'spawn'; kind2: EnemyKindId; x: number; lane: number; id: number }
  | { kind: 'chain'; depth: number }
  | { kind: 'wildcard'; slot: number; letter: Letter }
  | { kind: 'stalling'; seconds: number }
  | { kind: 'breach'; amount: number; units: number }
  | { kind: 'cleared' }
  | { kind: 'failed' }
  | { kind: 'rule'; id: string; text: string };

/** A craft waiting on the word-completion beat before the object appears. */
export interface PendingCraft {
  blueprint: BlueprintId;
  slot: number;
  /** Letter tiles consumed, kept for the converge animation. */
  letters: Letter[];
  /** 0 = gathering, 1 = locked, 2 = emerging. */
  phase: 0 | 1 | 2;
  t: number;
  /** Wildcard substitution used for this craft. */
  viaWildcard: Letter | null;
  lane: number;
}
