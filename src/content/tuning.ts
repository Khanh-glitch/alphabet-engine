/**
 * Central tunables.
 *
 * Balance numbers live here, not scattered through gameplay code, so a single
 * file explains how the fight feels. Values marked HYPOTHESIS are initial
 * guesses to be validated by the balance simulator (`npm run sim -- --runs=10 --kit=assembly`).
 */
export const TUNE = {
  /**
   * V2 cascade momentum (rework brief 8.3 / 8.4).
   *
   * A deeper causal cascade makes the machine itself run faster — nothing here
   * multiplies damage. The brief allows letter travel, recipe lock speed or the
   * bag interval; the bag interval is the pulse of the whole engine, so it is the
   * one lever used and no second speed bonus is stacked on top.
   *
   * The brief's hypothesis ladder (depth 2 -> 1.05x, 3 -> 1.10x, 4 -> 1.15x,
   * 5+ -> 1.20x) was tested with `npm run bots` and averaged only x1.014 on the
   * evaluation set, because 64% of crafts are depth 1. It was invisible. Sweeping
   * the multiplier gives a clear curve — mean machine speed, then the steer bot's
   * gain over the passive bot, which is the check for RISK E (momentum turning
   * the game into an autoplay):
   *
   *   x1.000  crafts 23.6  coreLost 120.6  steer +13.2% crafts
   *   x1.020  crafts 24.1  coreLost 121.6  steer +14.2% crafts
   *   x1.112  crafts 25.8  coreLost 112.5  steer +14.0% crafts   <- shipped
   *   x1.237  crafts 27.8  coreLost  99.0  steer +13.6% crafts
   *   x1.354  crafts 29.8  coreLost  86.5  steer  +7.5% crafts
   *   x1.784  crafts 34.9  coreLost  58.7  steer  +8.3% crafts
   *
   * Up to about x1.24 the reward is felt and steering still decides the outcome.
   * Past x1.35 the skill gap collapses: raw machine speed substitutes for routing
   * decisions, which is the failure mode the brief warns about. The ladder below
   * keeps a gradient by causal depth and caps at the top of the brief's band.
   *
   * `grace` is the presentation tail after the last causal event of a chain.
   * Section 8.4 requires momentum to end when the cascade ends and is explicit
   * that this must not be the old bag-cycle timer; the chain's own object being
   * alive, or a kill it caused having just landed, are the only things that hold
   * it open.
   */
momentum: { ladder: [1, 1.12, 1.18, 1.24, 1.30, 1.30], ease: 2.5, grace: 1.4 },

  /**
   * V2 reserve capacity (brief 3.1.2 hypothesises 4-6). Deliberately here rather
   * than hardcoded: the brief says not to finalize it before playtesting.
   */
  /**
   * Emergency global object ceiling (rework brief 3.6).
   *
   * Not a balance mechanism. Per-blueprint limits used to gate crafts, which the
   * brief argues suppressed the late-run power fantasy: the player assembles a
   * self-feeding engine and then watches recipes refuse to fire. Objects now
   * leave the field by their own nature -- a bomb detonates, a fire expires, a
   * wall breaks -- and this ceiling exists only so a pathological economy cannot
   * hang a frame. Reaching it is logged and counted, never silent.
   */
  maxRuntimeObjects: 220,

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
