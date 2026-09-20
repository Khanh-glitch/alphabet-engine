/**
 * Encounter simulation.
 *
 * The whole fight is one deterministic step function: spawn director → bag feed
 * → recipe resolution → craft beat → object behaviour → enemy behaviour →
 * letter recovery. Rendering reads this state and never mutates it.
 *
 * Design rules honoured here:
 *  - letters recovered from carriers are fuel *during* combat, not loot after it,
 *  - a craft always passes through a visible word-completion beat,
 *  - interactions come from authored tag rules, never from a physics engine,
 *  - everything is reproducible from the run seed.
 */
import { LetterBag } from '../alphabet/bag';
import { Machine } from '../alphabet/sockets';
import type { Assignment, LetterSource, RuntimeLetter } from '../alphabet/sockets';
import { Provenance } from '../alphabet/provenance';
import type { MachineRuleDef } from '../alphabet/rules';
import { Telemetry, trace } from '../alphabet/trace';
import { Rng, streamFor, clamp } from '../core/rng';
import { BLUEPRINTS } from '../content/blueprints';
import { ENEMIES } from '../content/enemies';
import type { EncounterDef, WaveDef } from '../content/encounters';
import { TUNE, RULE_TWEAKS, type EnemyKindId } from '../content/tuning';
import type { RuleFlag } from '../content/rules';
import type { BlueprintDef, BlueprintId, Letter, WildcardTarget } from '../alphabet/types';
import type { BattleEvent, Enemy, Entity, PendingCraft } from './types';

export interface BattleConfig {
  seed: number;
  encounter: EncounterDef;
  bagTiles: Letter[];
  blueprints: (BlueprintDef | null)[];
  rules: MachineRuleDef[];
  flags: RuleFlag[];
  coreHp: number;
  maxCoreHp: number;
  wildcards: number;
  /** Encounter index inside the run, used for telemetry and rule bookkeeping. */
  encounterIndex: number;
}

export type BattleState = 'intro' | 'fight' | 'cleared' | 'failed';

const VOWELS = 'AEIOU';
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Craft beat timings (seconds). Fast enough to stay punchy under pressure. */
const BEAT = { gather: 0.36, lock: 0.2, emerge: 0.26 } as const;

export class Battle {
  readonly cfg: BattleConfig;
  /**
   * The player's machine — the single authority for where a letter goes.
   *
   * V1 had one shared pool that a resolver silently consumed. V2 replaces it
   * with visible per-Blueprint sockets plus a small reserve, so an incoming tile
   * has a destination the player can point at (`GAMEPLAY_REWORK_V2.md` 3.1).
   * There is deliberately no second pool: one source of truth for letter state.
   */
  readonly machine: Machine;
  /** Causal ancestry of every craft, kill and dropped letter (brief 3.5). */
  readonly provenance = new Provenance();
  readonly bag: LetterBag;
  readonly telemetry = new Telemetry();
  readonly events: BattleEvent[] = [];
  readonly enemies: Enemy[] = [];
  readonly entities: Entity[] = [];
  readonly pending: PendingCraft[] = [];
  readonly slots: (BlueprintDef | null)[];
  /** Blueprints the wildcard can currently complete, refreshed on pool change. */
  targets: WildcardTarget[] = [];

  coreHp: number;
  maxCoreHp: number;
  wildcardsLeft: number;
  state: BattleState = 'intro';
  time = 0;
  chain = 0;
  bestChain = 0;
  /** Time the bag last started a fresh cycle; drives the bag readout's pulse. */
  cycleAt = -99;

  /** Time of the most recent craft — the HUD uses it to show a live chain. */
  lastCraftAt = -99;
  private drawTimer = 0;
  private spawnQueue: { wave: WaveDef; index: number; at: number }[] = [];
  private guaranteed: Letter[] = [];
  private unknownCarriersLeft = 0;
  private nextId = 1;
  private craftCount = 0;
  private craftCountByBlueprint: Record<string, number> = {};
  private killsThisEncounter = 0;
  private bagDrawIndex = 0;
  /** Entity that dealt the damage currently being applied — attributes kills. */
  private damageSource: number | null = null;
  /** Entity id → provenance node of the craft that produced it. */
  private entityProvenance = new Map<number, number>();
  /** V2 measurements required by brief 12.4. */
  readonly v2 = {
    crafts: 0,
    /** Times the emergency object ceiling actually blocked a craft (brief 3.6). */
    safetyCapHits: 0,
    bagOnlyCrafts: 0,
    combatFedCrafts: 0,
    wildcardsUsed: 0,
    wildcardTimes: [] as number[],
    chainLengths: [] as number[],
    maxCascade: 0,
    marksPlaced: 0,
    markedKills: 0,
    lettersFromMarked: 0,
    /**
     * Seconds of active fight time with nothing on the field, nothing crafting
     * and nothing in flight — the player is watching an empty screen.
     *
     * The brief's test I is about dead watch time, and it warns against
     * "60-second stretches where the player only watches a solved engine". This
     * measures the narrow, unambiguous half of that: there is literally nothing to
     * look at. The harder half — enemies alive but the player has no decision —
     * is not captured here, and should not be read as covered.
     */
    deadWatch: 0,
    /** Seconds a craft beat was playing, i.e. the machine briefly owned the screen. */
    beatSeconds: 0,
  };
  private randomLetterRng: Rng;
  private cleanupCd = 0;
  private introT = 0;
  /** Seconds with spawns finished but nothing dying — drives the stall guard. */
  stallTimer = 0;
  stalling = false;
  breaches = 0;
  /**
   * The one enemy the player has marked (brief 3.4).
   *
   * Mark never causes damage. It only changes targeting priority, and only for
   * objects that are logically able to act on it — so it is announced as an
   * intention, not as an order the machine must obey.
   */
  markedId = -1;
  /**
   * Current machine speed multiplier from cascade momentum (brief 8.3).
   *
   * Eased toward the depth-derived target rather than snapped, so the engine
   * spinning up reads as acceleration instead of a jolt. Never below 1: momentum
   * is a reward, and a chain ending should not slow the machine below its base
   * rate, which would punish the player for something they cannot control.
   */
  momentum = 1;
  /**
   * The object created by the newest craft, i.e. the chain's live continuation.
   * Momentum holds while it exists, or while kills it caused are still landing
   * (brief 8.4). Not a timer, and specifically not the bag cycle: a chain that
   * produced nothing dies even if the bag has not refilled yet.
   */
  private chainObjectNode: number | null = null;
  /** Time of the last causal event inside the current chain. */
  private chainPulseAt = -99;

  constructor(cfg: BattleConfig) {
    this.cfg = cfg;
    this.slots = cfg.blueprints.slice(0, 3);
    while (this.slots.length < 3) this.slots.push(null);
    this.machine = new Machine(
      this.slots.filter((b): b is BlueprintDef => b !== null),
      { reserveCap: TUNE.reserveCap },
    );
    this.bag = new LetterBag(cfg.bagTiles, streamFor(cfg.seed, 'bag'));
    this.coreHp = cfg.coreHp;
    this.maxCoreHp = cfg.maxCoreHp;
    this.wildcardsLeft = cfg.wildcards;
    this.randomLetterRng = streamFor(cfg.seed ^ 0x51ed, 'carrier');
    this.telemetry.data.encounters = 1;
    this.guaranteed = cfg.encounter.guaranteed.slice();
    this.unknownCarriersLeft = cfg.encounter.unknownCarriers;
    const waveRng = streamFor(cfg.seed + cfg.encounterIndex * 7919, 'wave');
    this.spawnQueue = cfg.encounter.waves.map((wave) => ({
      wave,
      index: 0,
      // A whisper of variance keeps repeat encounters from feeling identical
      // without ever changing what the player has to plan around.
      at: wave.at * waveRng.range(0.94, 1.06),
    }));
    this.drawTimer = TUNE.drawDelay;
    this.introT = 0.5;
    // Authored opening letters: the first craft is designed, not hoped for.
    for (const letter of cfg.encounter.openingPool ?? []) {
      this.feed(letter, { kind: 'rule', ruleId: 'opening' });
    }
    this.applyEncounterStart();
    this.refreshTargets();
    trace.setTime(0);
    trace.log('start', `encounter ${cfg.encounter.id}`, { data: { seed: cfg.seed } });
  }

  // ---- rules ------------------------------------------------------------

  private rules(): MachineRuleDef[] {
    return this.cfg.rules;
  }

  private applyEncounterStart(): void {
    for (const rule of this.rules()) {
      rule.onEncounterStart?.({
        inject: (letter) => {
          this.bag.add(letter);
          trace.log('rule', `${rule.id}: +${letter} vào túi`);
        },
        addToPool: (letter) => {
          const a = this.feed(letter, { kind: 'rule', ruleId: rule.id });
          this.emit({
            kind: 'draw', letter, uid: a.letter.id, source: 'bonus',
            slot: a.slot, socket: a.socket, reason: a.reason,
          });
          this.resolveCompletions();
        },
        randomLetter: () => this.randomLetterRng.pick(ALPHABET.split('')),
      });
    }
  }

  private fireCraftHooks(bp: BlueprintDef): void {
    this.craftCount += 1;
    const perBlueprint = (this.craftCountByBlueprint[bp.id] ?? 0) + 1;
    this.craftCountByBlueprint[bp.id] = perBlueprint;
    for (const rule of this.rules()) {
      rule.onCraft?.({
        blueprint: bp,
        craftIndex: this.craftCount,
        blueprintCraftIndex: perBlueprint,
        refund: (letter) => {
          this.feed(letter, {
            kind: 'refund',
            blueprintId: bp.id,
            objectId: undefined,
          });
          trace.log('rule', `${rule.id}: hoàn ${letter}`);
        },
      });
    }
  }

  private fireDrawHooks(e: {
    letter: Letter;
    cycle: number;
    cycleStart: boolean;
    cycleEnd: boolean;
  }): void {
    for (const rule of this.rules()) {
      rule.onDraw?.({
        ...e,
        addBonus: (letter, count = 1) => {
          for (let i = 0; i < count; i++) {
            const a = this.feed(letter, { kind: 'rule', ruleId: rule.id });
            this.emit({
              kind: 'draw', letter, uid: a.letter.id, source: 'bonus',
              slot: a.slot, socket: a.socket, reason: a.reason,
            });
            trace.log('rule', `${rule.id}: nhân đôi ${letter}`);
          }
        },
      });
    }
  }

  private fireKillHooks(letters: Letter[], carrier: boolean): void {
    for (const rule of this.rules()) {
      rule.onKill?.({
        carrier,
        letters,
        killIndex: this.killsThisEncounter,
        duplicate: (letter) => {
          const a = this.feed(letter, { kind: 'rule', ruleId: rule.id });
          this.emit({
            kind: 'draw', letter, uid: a.letter.id, source: 'bonus',
            slot: a.slot, socket: a.socket, reason: a.reason,
          });
          trace.log('rule', `${rule.id}: nhân ${letter}`);
        },
      });
    }
  }

  private finishEncounter(): void {
    for (const rule of this.rules()) {
      rule.onEncounterEnd?.({
        unspentWildcards: this.wildcardsLeft,
        addToBag: (letter) => this.bag.add(letter),
        randomVowel: () => this.randomLetterRng.pick(VOWELS.split('')),
      });
    }
  }

  // ---- helpers -----------------------------------------------------------

  flag(name: RuleFlag): boolean {
    return this.cfg.flags.includes(name);
  }

  private emit(event: BattleEvent): void {
    this.events.push(event);
  }

  private rand(): Rng {
    return this.randomLetterRng;
  }

  /** How many live enemies sit in each lane — drives placement choices. */
  private lanePressure(): number[] {
    const counts = new Array<number>(TUNE.lanes).fill(0);
    for (const e of this.enemies) if (!e.dead) counts[clamp(e.lane, 0, TUNE.lanes - 1)] += 1;
    return counts;
  }

  private busiestLane(): number {
    const counts = this.lanePressure();
    let best = 0;
    for (let i = 1; i < counts.length; i++) if (counts[i] > counts[best]) best = i;
    return best;
  }

  private leftmostEnemy(): Enemy | null {
    let best: Enemy | null = null;
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (!best || e.x < best.x) best = e;
    }
    return best;
  }

  /** The enemy standing in the densest crowd — bombs aim here. */
  private densestEnemy(): Enemy | null {
    let best: Enemy | null = null;
    let bestScore = -1;
    for (const e of this.enemies) {
      if (e.dead || e.flying) continue;
      let score = 0;
      for (const other of this.enemies) {
        if (other.dead) continue;
        const d = Math.abs(other.x - e.x) + Math.abs(other.lane - e.lane) * 24;
        if (d < 140) score += 1;
      }
      if (score > bestScore) {
        bestScore = score;
        best = e;
      }
    }
    return best ?? this.leftmostEnemy();
  }

  private carrierTargets(): Enemy[] {
    return this.enemies.filter((e) => !e.dead && e.carry);
  }

  // ---- letter routing ---------------------------------------------------

  /**
   * Route one letter into the machine.
   *
   * This is the only way a letter enters the battle: bag draws, carrier
   * recoveries, wildcard substitutions, rule injections and refunds all pass
   * through here, so there is exactly one place routing happens — and therefore
   * exactly one place Focus can be shown to matter.
   *
   * The machine decides; the caller emits the event, because only the caller
   * knows where the letter physically came from.
   */
  private feed(char: Letter, source: LetterSource, killNodeId?: number): Assignment {
    const prov = this.provenance.letter(source, this.time, killNodeId);
    const letter = this.machine.makeLetter(char, source, this.time, prov);
    return this.machine.accept(letter);
  }

  /** Recompute which blueprints the wildcard could complete right now. */
  refreshTargets(): void {
    this.targets = this.machine
      .wildcardTargets()
      .map((tg) => ({
        blueprint: this.slots[tg.slot] as BlueprintDef,
        slot: tg.slot,
        missing: tg.char,
        socket: tg.socket,
      }));
  }

  /**
   * Craft every recipe whose sockets are all filled, in slot order.
   *
   * V1 scanned the pool for anything it could afford, which meant stockpiles
   * silently turned into objects. V2 completes only when a socket row fills up,
   * so every craft has a visible cause. The loop re-drains the reserve between
   * crafts: emptying a socket can make a reserved letter useful again.
   */
  private resolveCompletions(): void {
    let guard = 0;
    for (;;) {
      if (guard++ > TUNE.maxCraftsPerTick) {
        trace.log('craft', 'guard tripped: quá nhiều lần ghép trong một nhịp');
        break;
      }
      let progress = false;

      // A reserved letter may have become wanted when a socket opened.
      for (const a of this.machine.drainReserve()) {
        if (a.slot >= 0) progress = true;
      }

      for (const rt of this.machine.blueprints) {
        const bp = rt.blueprint;
        if (this.atCapacity(bp)) continue;
        if (!this.machine.isComplete(rt)) continue;
        const letters = this.machine.commit(rt.slot);
        if (!letters) continue;
        // Provenance, not a flag, tells us a wildcard was involved: the tile in
        // the socket remembers where it came from.
        const wild = letters.find((l) => l.source.kind === 'wildcard');
        this.beginCraft(bp, rt.slot, letters, wild ? wild.char : null);
        progress = true;
        break;
      }
      if (!progress) break;
    }
    this.refreshTargets();
  }

  /**
   * Live count of a blueprint's objects, counting crafts that are still playing
   * their completion beat so capacity can never be overshot.
   */
  liveCount(id: BlueprintId): number {
    let n = 0;
    for (const ent of this.entities) if (ent.alive && ent.kind === id) n += 1;
    for (const craft of this.pending) if (craft.blueprint === id) n += 1;
    return n;
  }

  /**
   * Whether a craft is blocked.
   *
   * Brief 3.6 removes hard per-blueprint limits as a balancing tool: the natural
   * lifetime of each object keeps the field readable, not a cap. Only the
   * emergency global ceiling remains, and hitting it is counted and logged rather
   * than quietly making a common recipe fail.
   */
  atCapacity(_bp: BlueprintDef): boolean {
    if (this.entities.length >= TUNE.maxRuntimeObjects) {
      this.v2.safetyCapHits += 1;
      trace.log('craft', `chạm trần an toàn ${TUNE.maxRuntimeObjects} vật thể`);
      return true;
    }
    return false;
  }

  private beginCraft(
    bp: BlueprintDef,
    slot: number,
    letters: RuntimeLetter[],
    viaWildcard: Letter | null,
  ): void {
    // Chain bookkeeping. Depth is now causal, not temporal: a craft inherits the
    // ancestry of the letters it consumed (brief 3.5.5), so two crafts landing
    // close together no longer count as a cascade unless one actually fed the
    // other.
    const consumed = letters.map((l) => l.provenance);
    const node = this.provenance.craft(bp.id, consumed, this.time);
    const depth = this.provenance.chainDepth(node);
    const fromCombat = letters.some((l) => l.source.kind === 'enemy');

    this.chain = depth;
    this.lastCraftAt = this.time;
    // A new craft starts a new continuation; the previous object no longer holds
    // the chain open just because it is still on the field.
    this.chainObjectNode = null;
    this.chainPulseAt = this.time;
    this.bestChain = Math.max(this.bestChain, depth);
    this.fireCraftHooks(bp);
    const chars = letters.map((l) => l.char);
    const lane = this.busiestLane();
    this.pending.push({
      blueprint: bp.id,
      slot,
      letters: chars,
      provenance: node,
      phase: 0,
      t: 0,
      viaWildcard,
      lane,
    });
    this.emit({ kind: 'craftStart', blueprint: bp.id, slot, letters: chars, provenance: node });
    if (depth > 1) this.emit({ kind: 'chain', depth });
    this.telemetry.onCraft(bp.id, this.time, depth);
    this.v2.crafts += 1;
    if (fromCombat) this.v2.combatFedCrafts += 1;
    else this.v2.bagOnlyCrafts += 1;
    this.v2.chainLengths.push(depth);
    this.v2.maxCascade = Math.max(this.v2.maxCascade, depth);
    trace.log(
      'craft',
      `${bp.word} (${chars.join('')})${depth > 1 ? ` ⛓ ${depth}` : ''}`,
      { chain: depth },
    );
  }

  /** Player intervention: fill the single missing socket of one recipe. */
  useWildcard(slot: number): boolean {
    // Legal during the intro as well as the fight. The brief calls out the old
    // inconsistency (4.1): the control rendered as available during the intro and
    // then refused to act. If the machine can resolve the socket, it should.
    if (this.wildcardsLeft <= 0) return false;
    if (this.state === 'cleared' || this.state === 'failed') return false;
    const target = this.targets.find((tg) => tg.slot === slot);
    if (!target) return false;
    // The machine places the tile in the exact socket that was empty, so the
    // wildcard resolves a *position*, not an abstract multiset (brief 3.3).
    const prov = this.provenance.letter({ kind: 'wildcard' }, this.time);
    const letter = this.machine.fillSocket(target.slot, target.socket, this.time, prov);
    if (!letter) return false;
    this.wildcardsLeft -= 1;
    this.emit({ kind: 'wildcard', slot, letter: target.missing, socket: target.socket });
    this.telemetry.onWildcard(this.time < 6);
    this.v2.wildcardsUsed += 1;
    this.v2.wildcardTimes.push(this.time);
    trace.log('wildcard', `điền ${target.missing} vào ô ${target.socket} của ${target.blueprint.word}`);
    this.resolveCompletions();
    return true;
  }

  // ---- target mark (brief 3.4) -------------------------------------------

  /**
   * Mark one enemy as the priority target, or clear the mark by marking the same
   * enemy twice. Returns the enemy now marked, or -1 for none.
   */
  mark(enemyId: number): number {
    const enemy = this.enemies.find((e) => e.id === enemyId && !e.dead);
    if (!enemy) return this.markedId;
    this.markedId = this.markedId === enemyId ? -1 : enemyId;
    if (this.markedId >= 0) {
      this.v2.marksPlaced += 1;
      this.emit({ kind: 'mark', enemyId: this.markedId });
      trace.log('mark', `đánh dấu ${enemy.kind}${enemy.carry ? ` mang ${enemy.carry}` : ''}`);
    } else {
      trace.log('mark', 'bỏ đánh dấu');
    }
    return this.markedId;
  }

  clearMark(): void {
    this.markedId = -1;
  }

  /** The marked enemy, if it is still alive. */
  get marked(): Enemy | null {
    if (this.markedId < 0) return null;
    return this.enemies.find((e) => e.id === this.markedId && !e.dead) ?? null;
  }

  // ---- focus (brief 3.2) -------------------------------------------------

  /**
   * Steer the machine toward one recipe. No cooldown, no cost, no pause — the
   * only thing it changes is who wins a contested letter.
   */
  focus(slot: number): boolean {
    const changed = this.machine.setFocus(slot);
    if (changed) {
      this.emit({ kind: 'focus', slot });
      trace.log('focus', `ưu tiên ${this.slots[slot]?.word ?? slot}`);
    }
    return changed;
  }

  get focusSlot(): number {
    return this.machine.focusSlot;
  }

  /** Letters a recipe still needs, left to right — the socket row, as data. */
  missingFor(bp: BlueprintDef): Letter[] {
    const rt = this.machine.bySlot(this.slots.indexOf(bp));
    if (!rt) return bp.recipe.slice();
    return rt.sockets.filter((sk) => sk.letter === null).map((sk) => sk.requiredChar);
  }

  get reserveSize(): number {
    return this.machine.reserve.length;
  }

  // ---- main step ---------------------------------------------------------

  update(dt: number): void {
    if (this.state === 'cleared' || this.state === 'failed') return;
    this.time += dt;
    trace.setTime(this.time);

    // Recover a small amount of cleanup cadence; the arrays are tiny in practice.
    this.cleanupCd -= dt;
    if (this.cleanupCd <= 0) {
      this.cleanupCd = 0.5;
      this.compact();
    }

    if (this.state === 'intro') {
      this.introT -= dt;
      if (this.introT <= 0) this.state = 'fight';
      this.stepCrafts(dt);
      return;
    }

    // Dead-watch accounting runs before the steps, on the state the player was
    // actually looking at for this frame.
    if (this.state === 'fight') {
      const nothingToWatch =
        !this.enemies.some((e) => !e.dead) &&
        this.pending.length === 0 &&
        this.craftCount === 0;
      if (nothingToWatch) this.v2.deadWatch += dt;
      if (this.pending.length > 0) this.v2.beatSeconds += dt;
    }

    // A cascade is over when its object is gone and nothing it caused is still
    // landing, so the chain falls back to depth 1. Causal, not timed (brief 8.4).
    if (this.chain > 1) {
      const objectAlive =
        this.chainObjectNode !== null &&
        this.entities.some((e) => e.alive && this.entityProvenance.get(e.id) === this.chainObjectNode);
      if (!objectAlive && this.time - this.chainPulseAt > TUNE.momentum.grace) this.chain = 1;
    }

    // Momentum follows causal depth, eased. Depth 1 is base speed by definition.
    const ladder = TUNE.momentum.ladder;
    const target = ladder[Math.min(Math.max(0, this.chain), ladder.length - 1)];
    this.momentum += (target - this.momentum) * Math.min(1, dt * TUNE.momentum.ease);

    this.stepSpawner();
    this.stepBag(dt);
    this.stepCrafts(dt);
    this.stepEntities(dt);
    this.stepEnemies(dt);
    this.stepStallGuard(dt);
    this.checkOutcome();
  }

  private compact(): void {
    for (let i = this.enemies.length - 1; i >= 0; i--) if (this.enemies[i].dead) this.enemies.splice(i, 1);
    for (let i = this.entities.length - 1; i >= 0; i--) if (!this.entities[i].alive) this.entities.splice(i, 1);
  }

  private stepSpawner(): void {
    const hpScale = this.cfg.encounter.hpMul * Math.pow(TUNE.chapterScale.hp, Math.max(0, this.cfg.encounter.chapter - 1));
    const speedScale = this.cfg.encounter.speedMul * Math.pow(TUNE.chapterScale.speed, Math.max(0, this.cfg.encounter.chapter - 1));
    for (const slot of this.spawnQueue) {
      if (slot.index >= slot.wave.count) continue;
      if (this.time < slot.at) continue;
      const wave = slot.wave;
      const lane = wave.lane === 'spread' ? (slot.index * 2 + Math.floor(slot.index / 2)) % 5 : wave.lane;
      this.spawn(wave.kind, lane, hpScale, speedScale);
      slot.index += 1;
      slot.at = this.time + wave.gap;
    }
  }

  private spawn(kind: EnemyKindId, lane: number, hpScale: number, speedScale: number): void {
    const def = ENEMIES[kind];
    const stats = TUNE.enemies[kind];
    const hp = Math.round(stats.hp * hpScale);
    const carry = this.assignLetter(def.carrierChance, def.prefers);
    const enemy: Enemy = {
      id: this.nextId++,
      kind,
      x: 1510,
      lane,
      y: 0,
      hp,
      maxHp: hp,
      speed: stats.speed * speedScale,
      flying: def.flying,
      size: stats.size,
      carry: carry?.letter ?? null,
      announced: carry?.announced ?? false,
      hitFlash: 0,
      slowT: 0,
      slowAmt: 0,
      burnT: 0,
      burnDps: 0,
      freezeT: 0,
      stunT: 0,
      attackCd: 0,
      dead: false,
      reached: false,
      spawnT: 0,
      wobble: this.rand().range(0, Math.PI * 2),
      escortT: def.spawns?.every ?? 0,
    };
    this.enemies.push(enemy);
    this.emit({ kind: 'spawn', kind2: kind, x: enemy.x, lane, id: enemy.id });
    trace.log('spawn', `${kind} lane ${lane}${enemy.carry ? ` mang ${enemy.carry}` : ''}`);
  }

  /**
   * Carrier letters are authored: the encounter's guaranteed list is spent
   * first, so a planned engine always gets the fuel it was promised.
   */
  private assignLetter(chance: number, prefers: string[]): { letter: Letter; announced: boolean } | null {
    if (this.guaranteed.length > 0) {
      const letter = this.guaranteed.shift() as Letter;
      return { letter, announced: true };
    }
    if (this.unknownCarriersLeft > 0 && this.rand().chance(chance)) {
      this.unknownCarriersLeft -= 1;
      return { letter: this.rand().pick(prefers), announced: false };
    }
    if (this.rand().chance(chance * 0.5)) {
      return { letter: this.rand().pick(prefers), announced: false };
    }
    return null;
  }

  private stepBag(dt: number): void {
    this.drawTimer -= dt;
    if (this.drawTimer > 0) return;
    // The bag runs faster while a cascade is alive. This is the whole of
    // momentum: one lever, no damage multiplication (brief 8.3).
    this.drawTimer = TUNE.drawInterval / this.momentum;
    const result = this.bag.draw();
    if (result.cycleStart) {
      this.cycleAt = this.time;
    }
    const drawIndex = this.bagDrawIndex++;
    const a = this.feed(result.letter, { kind: 'bag', drawIndex, cycle: result.cycle });
    this.telemetry.onDraw();
    this.emit({
      kind: 'draw',
      letter: result.letter,
      uid: a.letter.id,
      source: 'bag',
      slot: a.slot,
      socket: a.socket,
      reason: a.reason,
    });
    this.fireDrawHooks(result);
    trace.log('draw', `${result.letter} → ${a.slot < 0 ? 'kho dự trữ' : `${this.slots[a.slot]?.word} ô ${a.socket}`}`);
    this.resolveCompletions();
  }

  private stepCrafts(dt: number): void {
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const craft = this.pending[i];
      craft.t += dt;
      if (craft.phase === 0 && craft.t >= BEAT.gather) {
        craft.phase = 1;
        craft.t = 0;
        this.emit({ kind: 'craftLock', blueprint: craft.blueprint, slot: craft.slot });
      } else if (craft.phase === 1 && craft.t >= BEAT.lock) {
        craft.phase = 2;
        craft.t = 0;
      } else if (craft.phase === 2 && craft.t >= BEAT.emerge) {
        this.pending.splice(i, 1);
        this.materialise(craft);
      }
    }
  }

  private materialise(craft: PendingCraft): void {
    const bp = BLUEPRINTS[craft.blueprint];
    const entity = this.createEntity(craft.blueprint, craft.lane);
    // The object inherits the craft's ancestry, so anything it kills — and any
    // letter that kill releases — belongs to the same causal chain.
    const objectNode = this.provenance.object(craft.provenance, this.time, craft.blueprint);
    this.entityProvenance.set(entity.id, objectNode);
    // The object is the chain's continuation, and this is the causal event that
    // keeps momentum alive (brief 8.4).
    this.chainObjectNode = objectNode;
    this.chainPulseAt = this.time;
    this.emit({
      kind: 'materialise',
      blueprint: craft.blueprint,
      entityId: entity.id,
      x: entity.x,
      lane: entity.lane,
    });
    trace.log('craft', `${bp.word} → vật thể tại x=${Math.round(entity.x)}`, { chain: this.chain });
  }

  private createEntity(kind: BlueprintId, lane: number): Entity {
    const id = this.nextId++;
    const base: Entity = {
      id,
      kind,
      x: 260,
      y: 0,
      lane,
      hp: 1,
      maxHp: 1,
      ttl: -1,
      age: 0,
      alive: true,
      spawn: 0,
      state: 'idle',
      tags: BLUEPRINTS[kind].tags,
      timer: 0,
      targetId: 0,
      hitIds: [],
      anim: 0,
    };
    const leftmost = this.leftmostEnemy();
    switch (kind) {
      case 'BOMB': {
        base.x = 300;
        base.state = 'fuse';
        base.timer = this.flag('shortFuse') ? TUNE.bomb.fuse * RULE_TWEAKS.shortFuse : TUNE.bomb.fuse;
        base.hp = base.maxHp = 1;
        base.ttl = 999;
        break;
      }
      case 'FIRE': {
        const anchor = leftmost ?? this.densestEnemy();
        base.x = anchor && anchor.x > 380 ? anchor.x + 40 : 620;
        base.state = 'burning';
        base.ttl = TUNE.fire.duration * (this.flag('longBurn') ? RULE_TWEAKS.longBurn : 1);
        break;
      }
      case 'BEE': {
        base.x = 280;
        base.y = 200;
        base.state = 'hunting';
        base.hp = base.maxHp = TUNE.bee.hp;
        base.ttl = 12;
        const target = this.carrierTargets().sort((a, b) => a.x - b.x)[0] ?? leftmost;
        base.targetId = target?.id ?? 0;
        break;
      }
      case 'WALL': {
        const laneWithEnemies = this.lanePressure();
        let bestLane = -1;
        for (let i = 0; i < laneWithEnemies.length; i++) {
          const occupied = this.entities.some((e) => e.alive && e.kind === 'WALL' && e.lane === i);
          if (occupied) continue;
          if (bestLane < 0 || laneWithEnemies[i] > laneWithEnemies[bestLane]) bestLane = i;
        }
        base.lane = bestLane >= 0 ? bestLane : lane;
        base.x = 720;
        base.state = 'idle';
        base.hp = base.maxHp = TUNE.wall.hp;
        base.ttl = 20;
        break;
      }
      case 'FAN': {
        base.x = 520;
        base.state = 'blowing';
        base.ttl = 18;
        break;
      }
      case 'OIL': {
        const anchor = this.densestEnemy();
        base.x = anchor ? clamp(anchor.x + this.rand().range(-60, 120), 420, 1360) : 900;
        base.state = 'slick';
        base.ttl = 26;
        break;
      }
      case 'MINE': {
        const anchor = leftmost;
        base.x = clamp(anchor ? anchor.x + 150 : 900, 460, 1380);
        base.state = 'armed';
        base.timer = TUNE.mine.armTime;
        base.ttl = 24;
        break;
      }
      case 'SAW': {
        base.x = 300;
        base.state = 'sawing';
        base.ttl = 12;
        break;
      }
      case 'WEB': {
        const anchor = this.densestEnemy();
        base.x = anchor ? anchor.x : 860;
        base.state = 'idle';
        base.ttl = TUNE.web.duration;
        break;
      }
      case 'ICE': {
        const anchor = this.densestEnemy();
        base.x = anchor ? anchor.x : 820;
        base.state = 'idle';
        base.ttl = TUNE.ice.duration;
        break;
      }
      default:
        break;
    }
    this.entities.push(base);
    return base;
  }

  // ---- object behaviour --------------------------------------------------

  private stepEntities(dt: number): void {
    for (const ent of this.entities) {
      if (!ent.alive) continue;
      ent.age += dt;
      ent.spawn = Math.min(1, ent.spawn + dt / 0.22);
      if (ent.spawn < 1) continue;
      // Bombs are spent by their fuse, not by a lifetime; everything else
      // expires so the field cannot silt up with stale objects.
      if (ent.ttl > 0) {
        ent.ttl -= dt;
        if (ent.ttl <= 0 && ent.kind !== 'BOMB') {
          ent.alive = false;
          continue;
        }
      }
      switch (ent.kind) {
        case 'BOMB':
          this.stepBomb(ent, dt);
          break;
        case 'FIRE':
          this.stepFire(ent, dt);
          break;
        case 'BEE':
          this.stepBee(ent, dt);
          break;
        case 'FAN':
          this.stepFan(ent, dt);
          break;
        case 'MINE':
          this.stepMine(ent, dt);
          break;
        case 'SAW':
          this.stepSaw(ent, dt);
          break;
        case 'OIL':
          this.stepOil(ent, dt);
          break;
        case 'WEB':
          this.stepZone(ent, TUNE.web.radius, (enemy) => {
            enemy.slowT = Math.max(enemy.slowT, 0.4);
            enemy.slowAmt = Math.max(enemy.slowAmt, TUNE.web.slow);
            // Web tugs ground units toward its centre: clustering for bombs.
            const pull = (ent.x - enemy.x) * 0.35 * dt;
            enemy.x += clamp(pull, -24 * dt, 24 * dt);
          });
          break;
        case 'ICE':
          this.stepZone(ent, TUNE.ice.radius, (enemy) => {
            enemy.freezeT = Math.max(enemy.freezeT, 0.25);
            enemy.slowAmt = Math.max(enemy.slowAmt, TUNE.ice.slow);
          });
          break;
        default:
          break;
      }
    }
  }

  /**
   * A bomb rolls toward the densest crowd and detonates on contact, with its
   * fuse as a fallback. Contact detonation is what makes the object feel like a
   * bomb instead of a timed area effect.
   */
  private stepBomb(ent: Entity, dt: number): void {
    const target = this.densestEnemy();
    if (target && target.x > ent.x) {
      ent.x += TUNE.bomb.travelSpeed * dt;
      ent.lane = ent.lane + clamp(target.lane - ent.lane, -1, 1) * dt * 1.8;
    }
    ent.timer -= dt;
    const contact = this.enemies.some(
      (e) => !e.dead && Math.abs(e.x - ent.x) < 34 && Math.abs(e.lane - ent.lane) < 1.2,
    );
    if (ent.timer <= 0 || contact) this.explode(ent, TUNE.bomb.damage, this.blastRadius('BOMB'), 'BOMB');
  }

  private blastRadius(kind: BlueprintId): number {
    const wide = this.flag('fatBlast') ? RULE_TWEAKS.fatBlast : 1;
    if (kind === 'BOMB') return TUNE.bomb.radius * (this.flag('shortFuse') ? 1.15 : 1) * wide;
    if (kind === 'MINE') return TUNE.mine.radius * wide;
    return TUNE.bomb.radius * wide;
  }

  private explode(ent: Entity, damage: number, radius: number, source: BlueprintId): void {
    const kick = this.flag('fatBlast') ? RULE_TWEAKS.fatBlast : 1;
    this.emit({ kind: 'explosion', x: ent.x, y: 0, radius, color: BLUEPRINTS[source].color, blueprint: source });
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      const dist = Math.abs(enemy.x - ent.x);
      if (dist > radius) continue;
      const falloff = clamp(1 - (dist / radius) * 0.55, 0.45, 1);
      let dmg = damage * falloff;
      if (enemy.freezeT > 0) dmg *= 1 + TUNE.ice.shatterBonus;
      if (enemy.kind === 'brute' || enemy.kind === 'boss') dmg *= 1.25;
      this.hit(ent, enemy, dmg);
      enemy.x += 26 * kick;
      enemy.stunT = Math.max(enemy.stunT, 0.18);
    }
    // EXPLOSIVE + FLAMMABLE → ignition
    for (const other of this.entities) {
      if (!other.alive || other.id === ent.id) continue;
      if (other.kind === 'OIL' && Math.abs(other.x - ent.x) < radius) this.igniteOil(other);
    }
    ent.alive = false;
  }

  private stepFire(ent: Entity, dt: number): void {
    const radius = TUNE.fire.radius;
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      if (enemy.flying) continue;
      if (Math.abs(enemy.x - ent.x) <= radius) {
        this.hit(ent, enemy, TUNE.fire.dps * dt, { pulse: false });
        if (this.rand().chance(dt * 0.6)) {
          enemy.burnT = Math.max(enemy.burnT, 1.4);
          enemy.burnDps = Math.max(enemy.burnDps, TUNE.fire.dps * 0.5);
        }
      }
    }
    for (const other of this.entities) {
      if (other.alive && other.kind === 'OIL' && Math.abs(other.x - ent.x) < radius + 40) this.igniteOil(other);
    }
  }

  private stepBee(ent: Entity, dt: number): void {
    const current = this.enemies.find((e) => e.id === ent.targetId && !e.dead) ?? null;
    // BEE is the object the Mark exists for: it extracts letters and it can reach
    // flying carriers, which is precisely what the mark is usually asking for.
    // Priority order fixed by the brief (9.2):
    //   1. the marked target, if still valid
    //   2. a carrier whose letter a recipe currently needs
    //   3. any other carrier
    //   4. the normal fallback
    // Rule 1 is checked every tick, so marking re-routes a bee already in flight.
    const marked = this.marked;
    let target: Enemy | null = null;
    if (marked) {
      target = marked;
    } else if (current) {
      // Keep the current target unless a better one exists, so bees do not
      // oscillate between two equally valid carriers.
      const carriers = this.carrierTargets();
      const needed = carriers.filter((e) => e.carry && this.machine.wants(e.carry));
      const better = needed[0] ?? carriers[0] ?? null;
      target = better && better.id !== current.id ? better : current;
      if (!current.carry && better) target = better;
    }
    if (!target) {
      const carriers = this.carrierTargets();
      const needed = carriers.filter((e) => e.carry && this.machine.wants(e.carry));
      target = needed[0] ?? carriers[0] ?? this.leftmostEnemy();
    }
    if (target) ent.targetId = target.id;
    if (!target) {
      ent.x += (330 - ent.x) * dt * 1.2;
      ent.y += (210 - ent.y) * dt;
      return;
    }
    const dx = target.x - ent.x;
    const dy = 300 + target.lane * TUNE.enemies.mote.size * 1.4 - ent.y;
    const dist = Math.hypot(dx, dy) || 1;
    ent.x += (dx / dist) * TUNE.bee.speed * dt;
    ent.y += (dy / dist) * TUNE.bee.speed * dt;
    ent.anim += dt * 24;
    if (dist < target.size + 16) {
      ent.timer -= dt;
      if (ent.timer <= 0) {
        ent.timer = TUNE.bee.biteEvery;
        this.hit(ent, target, TUNE.bee.damage);
        this.emit({ kind: 'push', x: ent.x, y: ent.y });
      }
    }
  }

  /**
   * PUSH + PUSHABLE → displacement. The fan is the clearest systemic toy in the
   * starter set: it shoves ground enemies back *and* launches bombs further, so
   * the same word can be a control tool or a delivery system.
   */
  private stepFan(ent: Entity, dt: number): void {
    ent.timer -= dt;
    if (ent.timer <= 0) {
      ent.timer = TUNE.fan.period * 0.5;
      this.emit({ kind: 'push', x: ent.x, y: ent.y });
    }
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.flying) continue;
      const dist = enemy.x - ent.x;
      if (dist < 0 || dist > TUNE.fan.range) continue;
      const strength = TUNE.fan.pushGround * (1 - dist / TUNE.fan.range + 0.35);
      enemy.x += strength * dt;
      enemy.stunT = Math.max(enemy.stunT, 0.06);
    }
    for (const other of this.entities) {
      if (!other.alive || other.id === ent.id) continue;
      if (!other.tags.includes('PUSHABLE')) continue;
      const dist = other.x - ent.x;
      if (dist < 0 || dist > TUNE.fan.range) continue;
      other.x += TUNE.fan.pushDevice * dt;
    }
  }

  private stepMine(ent: Entity, dt: number): void {
    if (ent.timer > 0) {
      ent.timer -= dt;
      return;
    }
    const trigger = this.enemies.find((e) => !e.dead && !e.flying && Math.abs(e.x - ent.x) < TUNE.mine.radius * 0.55);
    if (trigger) this.explode(ent, TUNE.mine.damage, this.blastRadius('MINE'), 'MINE');
  }

  private stepSaw(ent: Entity, dt: number): void {
    ent.x += TUNE.saw.speed * dt;
    ent.anim += dt * 18;
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.flying) continue;
      if (ent.hitIds.includes(enemy.id)) continue;
      if (Math.abs(enemy.x - ent.x) < TUNE.saw.radius + enemy.size) {
        this.hit(ent, enemy, TUNE.saw.damage);
        ent.hitIds.push(enemy.id);
      }
    }
    if (ent.x > 1460) ent.alive = false;
  }

  private stepOil(ent: Entity, dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.flying) continue;
      if (Math.abs(enemy.x - ent.x) <= TUNE.oil.radius) {
        enemy.slowT = Math.max(enemy.slowT, 0.3);
        enemy.slowAmt = Math.max(enemy.slowAmt, TUNE.oil.slow);
      }
    }
    if (ent.state === 'burning') {
      for (const enemy of this.enemies) {
        if (enemy.dead || enemy.flying) continue;
        if (Math.abs(enemy.x - ent.x) <= TUNE.oil.radius + 20) {
          this.hit(ent, enemy, TUNE.oil.burnDps * dt, { pulse: false });
          enemy.burnT = Math.max(enemy.burnT, 1.2);
          enemy.burnDps = Math.max(enemy.burnDps, TUNE.oil.burnDps * 0.4);
        }
      }
    }
  }

  private igniteOil(oil: Entity): void {
    if (oil.state === 'burning') return;
    oil.state = 'burning';
    oil.ttl = TUNE.oil.burnTime * (this.flag('longBurn') ? RULE_TWEAKS.longBurn : 1);
    this.emit({ kind: 'ignite', x: oil.x, radius: TUNE.oil.radius });
    for (const other of this.entities) {
      if (other.alive && other.kind === 'OIL' && other.id !== oil.id && Math.abs(other.x - oil.x) < TUNE.oil.radius * 2) {
        this.igniteOil(other);
      }
    }
  }

  private stepZone(ent: Entity, radius: number, apply: (enemy: Enemy) => void): void {
    for (const enemy of this.enemies) {
      if (enemy.dead || enemy.flying) continue;
      if (Math.abs(enemy.x - ent.x) <= radius) apply(enemy);
    }
  }

  // ---- enemies -----------------------------------------------------------

  private stepEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (enemy.dead) continue;
      enemy.spawnT += dt;
      enemy.wobble += dt * 6;
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 3);
      if (enemy.burnT > 0) {
        enemy.burnT -= dt;
        this.damageEnemy(enemy, enemy.burnDps * dt, { pulse: false });
        if (enemy.dead) continue;
      }
      if (enemy.freezeT > 0) {
        enemy.freezeT -= dt;
        continue;
      }
      if (enemy.stunT > 0) {
        enemy.stunT -= dt;
        continue;
      }
      let speed = enemy.speed;
      if (enemy.slowT > 0) {
        enemy.slowT -= dt;
        speed *= 1 - enemy.slowAmt;
      } else {
        enemy.slowAmt = 0;
      }

      // BLOCKING + ground enemy → obstruction (and clustering)
      const blocker = this.blockerInFront(enemy);
      if (blocker) {
        enemy.attackCd -= dt;
        if (enemy.attackCd <= 0) {
          enemy.attackCd = 0.7;
          blocker.hp -= this.enemyAttack(enemy);
          if (blocker.hp <= 0) {
            blocker.alive = false;
            this.emit({ kind: 'push', x: blocker.x, y: 0 });
          }
        }
        enemy.x += -speed * dt * 0.05;
        continue;
      }

      enemy.x -= speed * dt;

      if (enemy.x <= this.coreEdge()) {
        this.hitCore(enemy);
        continue;
      }

      const def = ENEMIES[enemy.kind];
      if (def.spawns) {
        enemy.escortT -= dt;
        if (enemy.escortT <= 0) {
          enemy.escortT = def.spawns.every;
          const hpScale = this.cfg.encounter.hpMul;
          for (let i = 0; i < def.spawns.count; i++) {
            this.spawn(def.spawns.kind, (enemy.lane + i * 2) % 5, hpScale, this.cfg.encounter.speedMul);
          }
        }
      }
    }
  }

  private coreEdge(): number {
    return 210;
  }

  private enemyAttack(enemy: Enemy): number {
    const base = TUNE.enemies[enemy.kind].attack;
    return base;
  }

  private blockerInFront(enemy: Enemy): Entity | null {
    if (enemy.flying) return null;
    for (const ent of this.entities) {
      if (!ent.alive || ent.kind !== 'WALL') continue;
      if (ent.lane !== enemy.lane) continue;
      const gap = enemy.x - ent.x;
      if (gap > -6 && gap < enemy.size + 26) return ent;
    }
    return null;
  }

  private hitCore(enemy: Enemy): void {
    const dmg = TUNE.enemies[enemy.kind].core;
    this.coreHp = Math.max(0, this.coreHp - dmg);
    this.telemetry.onCoreHit(dmg);
    enemy.reached = true;
    // An enemy that reaches the core takes its letter with it: breaches cost
    // fuel as well as health, which is what makes the core the real clock.
    enemy.carry = null;
    this.damageEnemy(enemy, enemy.hp + 1);
    this.emit({ kind: 'coreHit', amount: dmg });
    trace.log('corehit', `${enemy.kind} gây ${dmg}`);
    if (this.coreHp <= 0) {
      this.state = 'failed';
      this.finishEncounter();
      this.emit({ kind: 'failed' });
      trace.log('fail', 'lõi vỡ');
    }
  }

  // ---- interactions & damage --------------------------------------------

  /**
   * Damage entry point: handles death, letter recovery and hooks.
   *
   * `pulse` marks a discrete hit - the kind that should make the unit flash
   * white for a moment. Damage-over-time must pass `false`: burn ticks arrive
   * once per frame, and a flat flash increment per tick saturates the flash at
   * 1.0 forever, so anything standing in fire renders as a solid white blob and
   * its own burning animation is hidden.
   */
  /**
   * Damage attributed to one of the player's objects.
   *
   * Attribution is what lets the cascade be *causal*: the kill knows which craft
   * produced the weapon, so the letter it releases inherits that craft's
   * ancestry. Damage with no identifiable source (ambient burn, a breach) goes
   * through `damageEnemy` directly and starts no lineage.
   */
  private hit(source: Entity, enemy: Enemy, amount: number, opts: { pulse?: boolean } = {}): void {
    this.damageSource = source.id;
    this.damageEnemy(enemy, amount, opts);
    this.damageSource = null;
  }

  damageEnemy(enemy: Enemy, amount: number, opts: { pulse?: boolean } = {}): void {
    if (enemy.dead) return;
    enemy.hp -= amount;
    if (opts.pulse !== false) {
      enemy.hitFlash = Math.min(1, enemy.hitFlash + amount / Math.max(1, enemy.maxHp) + 0.25);
    }
    if (enemy.hp > 0) return;
    enemy.dead = true;
    this.telemetry.onKill(!!enemy.carry);
    // Mark telemetry (brief 3.4 / 12.4): a mark only earns its place if killing
    // the marked enemy measurably changes what the machine receives.
    if (enemy.id === this.markedId) {
      this.v2.markedKills += 1;
      if (enemy.carry) this.v2.lettersFromMarked += 1;
      this.markedId = -1;
    }
    const letters: Letter[] = [];
    if (enemy.carry) letters.push(enemy.carry);
    this.emit({ kind: 'kill', x: enemy.x, y: 300 + enemy.lane * 40, letter: enemy.carry, lane: enemy.lane });
    this.killsThisEncounter += 1;
    // The kill is caused by whichever object last dealt this damage, so the
    // letter it releases can be traced back to the craft that made that object.
    const killerNode =
      this.damageSource !== null ? this.entityProvenance.get(this.damageSource) : undefined;
    const killNode = this.provenance.kill(this.time, killerNode);
    // A kill caused by the chain's own object is what keeps the chain alive: the
    // player watches the cascade continue, so momentum should still be running.
    if (killerNode !== undefined && killerNode === this.chainObjectNode) {
      this.chainPulseAt = this.time;
    }
    if (enemy.carry) {
      const a = this.feed(
        enemy.carry,
        { kind: 'enemy', enemyId: enemy.id, causedByObjectId: this.damageSource ?? undefined },
        killNode,
      );
      const ancestor = this.provenance.causalAncestor(killNode);
      this.emit({
        kind: 'letterReturn',
        letter: enemy.carry,
        x: enemy.x,
        y: 300,
        uid: a.letter.id,
        slot: a.slot,
        socket: a.socket,
        reason: a.reason,
        fromBlueprint: ancestor?.blueprintId ?? null,
      });
      trace.log(
        'drop',
        `${enemy.carry} rơi → ${a.slot < 0 ? 'kho dự trữ' : `${this.slots[a.slot]?.word} ô ${a.socket}`}` +
          (ancestor ? ` (nhân quả từ ${ancestor.blueprintId})` : ''),
      );
    }
    this.fireKillHooks(letters, !!enemy.carry);
    this.resolveCompletions();
  }

  /**
   * Stall guard.
   *
   * A defense build that blocks everything without killing anything would run
   * forever. Instead of quietly extending the fight, the engine counts down and
   * then lets the surviving enemies breach: they walk through the defense and
   * charge the core for their full arrival damage. It is bounded, it is visible
   * (the player gets a countdown), and it teaches the real lesson — blocking is
   * not winning.
   */
  private stepStallGuard(dt: number): void {
    const spawning = this.spawnQueue.some((s) => s.index < s.wave.count);
    const live = this.enemies.filter((e) => !e.dead);
    if (spawning || live.length === 0) {
      this.stallTimer = 0;
      this.stalling = false;
      return;
    }
    if (!this.stalling) {
      this.stalling = true;
      this.stallTimer = 0;
      trace.log('stall', 'không còn mục tiêu nào chết — bắt đầu đếm ngược');
    }
    this.stallTimer += dt;
    const remaining = TUNE.stallSeconds - this.stallTimer;
    this.emit({ kind: 'stalling', seconds: Math.max(0, remaining) });
    if (this.stallTimer < TUNE.stallSeconds) return;

    let amount = 0;
    for (const enemy of live) {
      amount += TUNE.enemies[enemy.kind].core;
      // Breaching units are spent, and they take their letter with them.
      enemy.carry = null;
      enemy.hp = 0;
      enemy.dead = true;
    }
    this.stalling = false;
    this.stallTimer = 0;
    this.coreHp = Math.max(0, this.coreHp - amount);
    this.telemetry.onCoreHit(amount);
    this.breaches += 1;
    this.emit({ kind: 'breach', amount, units: live.length });
    trace.log('breach', `${live.length} đơn vị tràn vào lõi, -${amount} máu`);
    if (this.coreHp <= 0) {
      this.state = 'failed';
      this.finishEncounter();
      this.emit({ kind: 'failed' });
    }
  }

  private checkOutcome(): void {
    if (this.state !== 'fight') return;
    const spawning = this.spawnQueue.some((s) => s.index < s.wave.count);
    const live = this.enemies.some((e) => !e.dead);
    if (!spawning && !live && this.pending.length === 0) {
      this.state = 'cleared';
      this.finishEncounter();
      this.emit({ kind: 'cleared' });
      trace.log('clear', `${this.time.toFixed(1)}s, chuỗi dài nhất ${this.bestChain}`);
    }
  }

  /** Snapshot used by the renderer for HUD counters. */
  snapshot(): {
    corePct: number;
    chain: number;
    poolSize: number;
    bagRemaining: number;
    cycle: number;
    wildcards: number;
    enemies: number;
    /** Machine speed multiplier from cascade momentum. */
    momentum: number;
  } {
    return {
      corePct: this.maxCoreHp > 0 ? this.coreHp / this.maxCoreHp : 0,
      chain: this.chain,
      poolSize: this.machine.reserve.length,
      bagRemaining: this.bag.remaining,
      cycle: this.bag.cycleIndex,
      wildcards: this.wildcardsLeft,
      enemies: this.enemies.filter((e) => !e.dead).length,
      momentum: this.momentum,
    };
  }
}
