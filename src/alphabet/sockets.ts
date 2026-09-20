/**
 * V2 letter sockets — the visible machine.
 *
 * V1 had one abstract shared pool and a resolver that silently consumed a
 * multiset. That is mechanically coherent and completely opaque: the player
 * cannot see where a letter went, which recipe is closest to finishing, or which
 * word is starving.
 *
 * V2 keeps the same economy but changes what the player is looking at. Every
 * equipped Blueprint owns a row of **sockets**, one per required letter. An
 * incoming tile physically travels into a socket. What used to be
 * "resolver consumed B, B, O, M" becomes "B dropped into BOMB's last socket".
 *
 * The shared pool still exists internally as the **reserve**, but only for
 * letters no recipe currently wants.
 *
 * Pure domain logic: no DOM, no canvas, no timers, no `Math.random`.
 */
import type { BlueprintDef, BlueprintId, Letter } from './types';

/**
 * Where a tile came from.
 *
 * Kept richer than V1's flat enum because provenance (§3.5) needs to trace a
 * letter back to the combat object that caused it, and because telemetry has to
 * separate bag-fed crafts from combat-fed crafts — the whole point of a true
 * causal cascade.
 */
export type LetterSource =
  | { kind: 'bag'; drawIndex: number; cycle: number }
  | { kind: 'enemy'; enemyId: number; causedByObjectId?: number }
  | { kind: 'wildcard' }
  | { kind: 'rule'; ruleId: string }
  | { kind: 'refund'; blueprintId: BlueprintId; objectId?: number };

export interface RuntimeLetter {
  /** Unique within a battle. */
  id: number;
  char: Letter;
  source: LetterSource;
  createdAt: number;
  /** Provenance-graph node this tile represents (§3.5.3). */
  provenance: number;
}

export interface RecipeSocket {
  requiredChar: Letter;
  letter: RuntimeLetter | null;
}

/** Live socket state for one equipped Blueprint. */
export interface BlueprintRuntime {
  blueprint: BlueprintDef;
  slot: number;
  sockets: RecipeSocket[];
}

/** Why a letter went where it went — the raw material for Focus telemetry. */
export type AssignmentReason =
  /** Exactly one recipe could use it; no decision existed. */
  | 'sole'
  /** Several recipes wanted it and the Focused one took it. */
  | 'focus'
  /** Several recipes wanted it; focus was ineligible, deterministic order won. */
  | 'fallback'
  /** No recipe wanted it; it went to the reserve. */
  | 'reserve'
  /** No recipe wanted it and the reserve is full. */
  | 'discarded';

export interface Assignment {
  letter: RuntimeLetter;
  reason: AssignmentReason;
  /** Slot it landed in, or -1 for reserve/discard. */
  slot: number;
  /** Socket index inside that slot, or -1. */
  socket: number;
  /** True when more than one equipped recipe could have used this letter. */
  contested: boolean;
  /** Slots that could have taken it, in deterministic order. */
  candidates: number[];
  /** Set when this assignment completed its Blueprint's sockets. */
  completed: boolean;
}

export interface MachineConfig {
  /**
   * Reserve capacity hypothesis from the brief is 4–6. Deliberately a config
   * value rather than a constant, because §3.1.2 says not to finalize it before
   * playtesting.
   */
  reserveCap: number;
}

export const DEFAULT_MACHINE_CONFIG: MachineConfig = { reserveCap: 5 };

/**
 * The player's machine: sockets, reserve, and the Focus that steers them.
 *
 * Deterministic by construction. Same starting blueprints + same sequence of
 * `accept()` calls + same Focus changes always produce the same state, which is
 * what lets the balance harness reason about Focus at all.
 */
export class Machine {
  readonly blueprints: BlueprintRuntime[];
  readonly reserve: RuntimeLetter[] = [];
  private config: MachineConfig;
  private nextLetterId = 1;

  /** Slot the player is steering toward, or -1 when nothing is focused. */
  focusSlot = -1;
  /** Assignments and their reasons, newest last. Cleared by the caller. */
  readonly log: Assignment[] = [];

  // ---- telemetry counters (§3.2.4) --------------------------------------
  focusSwitches = 0;
  contestedLetters = 0;
  focusedAssignments = 0;
  fallbackAssignments = 0;
  reserveOverflow = 0;

  constructor(blueprints: (BlueprintDef | null)[], config: MachineConfig = DEFAULT_MACHINE_CONFIG) {
    this.config = config;
    this.blueprints = [];
    blueprints.forEach((bp, slot) => {
      if (!bp) return;
      this.blueprints.push({
        blueprint: bp,
        slot,
        sockets: bp.recipe.map((requiredChar) => ({ requiredChar, letter: null })),
      });
    });
  }

  // ---- focus -------------------------------------------------------------

  /** Focus a slot. Returns true when the focus actually changed. */
  setFocus(slot: number): boolean {
    if (slot === this.focusSlot) return false;
    if (!this.blueprints.some((b) => b.slot === slot)) return false;
    this.focusSlot = slot;
    this.focusSwitches += 1;
    return true;
  }

  focus(): BlueprintRuntime | null {
    return this.blueprints.find((b) => b.slot === this.focusSlot) ?? null;
  }

  // ---- queries -----------------------------------------------------------

  bySlot(slot: number): BlueprintRuntime | null {
    return this.blueprints.find((b) => b.slot === slot) ?? null;
  }

  /**
   * Index of the leftmost empty socket that requires `char`, or -1.
   *
   * Leftmost-first is what makes duplicate letters behave: a recipe like `WALL`
   * or `BEE` has two identical sockets, and filling them left to right is the
   * only order that reads correctly on screen. It also handles `BOMB`, whose two
   * `B` sockets sit at opposite ends of the word.
   */
  private openSocketFor(runtime: BlueprintRuntime, char: Letter): number {
    return runtime.sockets.findIndex((s) => s.letter === null && s.requiredChar === char);
  }

  /** Every equipped recipe that could currently accept this letter, slot order. */
  candidatesFor(char: Letter): number[] {
    const out: number[] = [];
    for (const runtime of this.blueprints) {
      if (this.openSocketFor(runtime, char) >= 0) out.push(runtime.slot);
    }
    return out;
  }

  /** True when any socket anywhere still wants this letter. */
  wants(char: Letter): boolean {
    return this.candidatesFor(char).length > 0;
  }

  /** Letters the machine still needs, as a multiset, for the incoming panel. */
  neededLetters(): Letter[] {
    const out: Letter[] = [];
    for (const runtime of this.blueprints) {
      for (const s of runtime.sockets) if (s.letter === null) out.push(s.requiredChar);
    }
    return out;
  }

  isComplete(runtime: BlueprintRuntime): boolean {
    return runtime.sockets.every((s) => s.letter !== null);
  }

  /** Recipes missing exactly one letter — the Wildcard's legal targets. */
  wildcardTargets(): { slot: number; socket: number; char: Letter; blueprintId: BlueprintId }[] {
    const out: { slot: number; socket: number; char: Letter; blueprintId: BlueprintId }[] = [];
    for (const runtime of this.blueprints) {
      const empty = runtime.sockets.filter((s) => s.letter === null);
      if (empty.length !== 1) continue;
      const idx = runtime.sockets.findIndex((s) => s.letter === null);
      out.push({
        slot: runtime.slot,
        socket: idx,
        char: runtime.sockets[idx].requiredChar,
        blueprintId: runtime.blueprint.id,
      });
    }
    return out;
  }

  // ---- mutation ----------------------------------------------------------

  /** Mint a tile. Ids are sequential so the provenance graph can reference them. */
  makeLetter(char: Letter, source: LetterSource, createdAt: number, provenance = 0): RuntimeLetter {
    return { id: this.nextLetterId++, char, source, createdAt, provenance };
  }

  /**
   * Route one incoming tile into the machine.
   *
   * The assignment rule is the whole of V2's agency (§3.1.2):
   *   - one recipe wants it  → automatic, no decision existed,
   *   - several want it      → Focus decides; deterministic slot order is the
   *                            documented fallback when Focus cannot take it,
   *   - nobody wants it      → reserve, and only then discard.
   *
   * Returns the decision, including *why*, so telemetry can prove Focus matters
   * rather than assuming it does.
   */
  accept(letter: RuntimeLetter): Assignment {
    const candidates = this.candidatesFor(letter.char);
    const contested = candidates.length > 1;
    if (contested) this.contestedLetters += 1;

    let slot = -1;
    let reason: AssignmentReason = 'reserve';

    if (candidates.length === 1) {
      slot = candidates[0];
      reason = 'sole';
    } else if (candidates.length > 1) {
      if (candidates.includes(this.focusSlot)) {
        slot = this.focusSlot;
        reason = 'focus';
        this.focusedAssignments += 1;
      } else {
        // Deterministic fallback. §3.1.2 requires this be visible/debuggable
        // rather than silent, so it is counted and surfaced in telemetry.
        slot = candidates[0];
        reason = 'fallback';
        this.fallbackAssignments += 1;
      }
    }

    if (slot < 0) {
      if (this.reserve.length < this.config.reserveCap) {
        this.reserve.push(letter);
        reason = 'reserve';
      } else {
        reason = 'discarded';
        this.reserveOverflow += 1;
      }
      const assignment: Assignment = {
        letter,
        reason,
        slot: -1,
        socket: -1,
        contested,
        candidates,
        completed: false,
      };
      this.log.push(assignment);
      return assignment;
    }

    const runtime = this.bySlot(slot) as BlueprintRuntime;
    const socket = this.openSocketFor(runtime, letter.char);
    runtime.sockets[socket].letter = letter;

    const assignment: Assignment = {
      letter,
      reason,
      slot,
      socket,
      contested,
      candidates,
      completed: this.isComplete(runtime),
    };
    this.log.push(assignment);
    return assignment;
  }

  /**
   * Consume a completed recipe, returning the tiles that were committed to it
   * so the craft beat can animate them. The runtime resets to empty sockets.
   */
  commit(slot: number): RuntimeLetter[] | null {
    const runtime = this.bySlot(slot);
    if (!runtime || !this.isComplete(runtime)) return null;
    const letters = runtime.sockets.map((s) => s.letter as RuntimeLetter);
    for (const s of runtime.sockets) s.letter = null;
    return letters;
  }

  /** Wildcard insertion: fill one specific empty socket with a wildcard tile. */
  fillSocket(slot: number, socket: number, createdAt: number, provenance = 0): RuntimeLetter | null {
    const runtime = this.bySlot(slot);
    if (!runtime) return null;
    const target = runtime.sockets[socket];
    if (!target || target.letter !== null) return null;
    const letter = this.makeLetter(target.requiredChar, { kind: 'wildcard' }, createdAt, provenance);
    target.letter = letter;
    return letter;
  }

  /**
   * Pull a reserved tile back out. Used when a craft needs a letter the reserve
   * is holding — the reserve is a waiting room, not a discard pile.
   */
  takeFromReserve(char: Letter): RuntimeLetter | null {
    const i = this.reserve.findIndex((l) => l.char === char);
    if (i < 0) return null;
    return this.reserve.splice(i, 1)[0];
  }

  /**
   * Re-evaluate the reserve against open sockets.
   *
   * A tile can sit in the reserve because no recipe wanted it at the time, then
   * become wanted the moment a different socket fills — `BOMB` wanting `B` at
   * socket 0 may open socket 3. This is deliberately explicit rather than a
   * background poll so the caller controls when the machine re-reads its own
   * reserve, and so it stays deterministic.
   */
  drainReserve(): Assignment[] {
    const out: Assignment[] = [];
    for (let i = 0; i < this.reserve.length; ) {
      const letter = this.reserve[i];
      if (!this.wants(letter.char)) {
        i += 1;
        continue;
      }
      this.reserve.splice(i, 1);
      out.push(this.accept(letter));
    }
    return out;
  }

  /** Every tile currently committed, for provenance and telemetry. */
  committed(): RuntimeLetter[] {
    const out: RuntimeLetter[] = [];
    for (const runtime of this.blueprints) {
      for (const s of runtime.sockets) if (s.letter) out.push(s.letter);
    }
    return out;
  }

  /** How full the reserve is, 0–1, for the tray UI. */
  get reserveFill(): number {
    return this.config.reserveCap > 0 ? this.reserve.length / this.config.reserveCap : 0;
  }

  get reserveCap(): number {
    return this.config.reserveCap;
  }
}
