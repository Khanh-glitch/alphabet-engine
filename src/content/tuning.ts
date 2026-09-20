/**
 * Central tunables.
 *
 * Balance numbers live here, not scattered through gameplay code, so a single
 * file explains how the fight feels. Values marked HYPOTHESIS are initial
 * guesses to be validated by the balance simulator (`npm run sim -- --runs=10 --kit=assembly`).
 */
export const TUNE = {
  /**
   * V2 reserve capacity (brief 3.1.2 hypothesises 4-6). Deliberately here rather
   * than hardcoded: the brief says not to finalize it before playtesting.
   */
  reserveCap: 5,

  /** Seconds of fight time per encounter target (experience guide, not a timer). */
  encounterTarget: { first: 12, normal: 16, elite: 24, boss: 40 },

  /**
   * How often the bag feeds the pool. This is the pulse of the whole game: slow
   * enough to read, fast enough that a 3-4 letter recipe completes in seconds.
   */
  drawInterval: 0.55,
  /** Grace period before the first draw so the opening board reads clearly. */
  drawDelay: 0.9,

  /** Lanes in the side-view arena. */
  lanes: 5,

  coreHp: 100,
  wildcardCharges: 1,

  /**
   * Chain bookkeeping. A cascade is a run of crafts fed by combat drops, so the
   * chain survives as long as crafts keep landing inside this window, and breaks
   * when the pool goes quiet or a fresh bag cycle starts.
   */
  chainWindow: 2.2,

  /** Craft loop guard — protects against recursive completion explosions. */
  maxCraftsPerTick: 24,

  /** Letters fly into the pool over this long, then count as settled. */
  letterFlight: 0.55,

  /**
   * Grace period a stalled defense gets before the surviving enemies breach the
   * core. Bounds every encounter and makes "block without damage" a losing plan.
   */
  stallSeconds: 8,

  /** Blueprint object stats (HYPOTHESIS, tuned by sim). */
  bomb: { fuse: 2.6, damage: 88, radius: 150, knockback: 46, travelSpeed: 150 },
  fire: { duration: 7.5, dps: 29, radius: 92 },
  bee: { speed: 230, damage: 11, biteEvery: 0.38, hp: 30 },
  wall: { hp: 190, cooldown: 1.1 },
  fan: { pushGround: 30, pushDevice: 400, range: 330, period: 1.6 },
  oil: { radius: 100, slow: 0.45, burnDps: 44, burnTime: 6.5 },
  mine: { damage: 96, radius: 108, armTime: 0.55 },
  saw: { speed: 185, damage: 40, radius: 36 },
  web: { duration: 8, slow: 0.6, radius: 104 },
  ice: { duration: 6, slow: 0.72, radius: 104, shatterBonus: 0.55 },

  /**
   * Enemy stats. Speeds are set so a unit crossing the whole arena takes roughly
   * 5-10 seconds, which keeps encounters inside the 8-18s design target.
   */
  enemies: {
    mote: { hp: 14, speed: 118, core: 4, size: 21, attack: 6 },
    runner: { hp: 18, speed: 250, core: 5, size: 23, attack: 8 },
    flyer: { hp: 26, speed: 190, core: 6, size: 25, attack: 9 },
    brute: { hp: 108, speed: 76, core: 11, size: 36, attack: 20 },
    boss: { hp: 420, speed: 52, core: 22, size: 56, attack: 30 },
  },

  /** Scaling per chapter so later encounters stay tense without stat inflation. */
  chapterScale: { hp: 1.15, speed: 1.05 },

  /** Cascade feedback escalation caps, so shake never becomes unreadable. */
  juice: { shakeMax: 9, flashMax: 0.35 },
} as const;

export type EnemyKindId = keyof typeof TUNE.enemies;

/** Offsets applied to a blueprint object when the player takes a specific rule. */
export const RULE_TWEAKS = {
  shortFuse: 0.55,
  longBurn: 1.45,
  fatBlast: 1.22,
  refundEvery: 3,
} as const;
