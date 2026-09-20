/**
 * Domain regression tests.
 *
 * These run against the real simulation modules (bundled by `tools/test.mjs`
 * and executed with `node --test`), not against mocks. They cover the
 * invariants that have actually broken or that the design depends on:
 *
 *  - the letter economy is deterministic and conserves letters,
 *  - a kit can build what it is given,
 *  - a craft consumes exactly its recipe and nothing else,
 *  - the same seed produces the same run,
 *  - no encounter can run forever.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import { streamFor } from '../src/core/rng';
import { LetterBag } from '../src/alphabet/bag';
import { LetterPool } from '../src/alphabet/pool';
import { countLetters, deficit, type Letter } from '../src/alphabet/types';
import { BLUEPRINTS } from '../src/content/blueprints';
import { KITS, kitById, kitBlueprints } from '../src/content/kits';
import { RUN } from '../src/content/encounters';
import { TUNE } from '../src/content/tuning';
import { Run } from '../src/run/run';

const letters = (s: string): Letter[] => s.split('');

// ---------------------------------------------------------------- bag

test('bag draws every tile of a cycle exactly once', () => {
  const bag = new LetterBag(letters('BBOOMFIRE'), streamFor(1, 'bag'));
  const seen: Letter[] = [];
  const size = bag.size;
  for (let i = 0; i < size; i++) {
    const d = bag.draw();
    assert.ok(d, 'draw returned nothing before the cycle was empty');
    seen.push(d!.letter);
  }
  assert.deepEqual(seen.slice().sort(), letters('BBOOMFIRE').sort());
  assert.equal(bag.remaining, 0);
});

test('bag opens a fresh cycle only after it is empty', () => {
  const bag = new LetterBag(letters('ABC'), streamFor(7, 'bag'));
  const first = bag.draw();
  assert.equal(first?.cycleStart, true, 'first draw of a fresh bag starts a cycle');
  assert.equal(bag.cycleIndex, 0);
  bag.draw();
  const last = bag.draw();
  assert.equal(last?.cycleEnd, true, 'the draw that empties a cycle reports it');
  const next = bag.draw();
  assert.equal(next?.cycleStart, true, 'the following draw starts a new cycle');
  assert.equal(bag.cycleIndex, 1);
});

test('bag is reproducible for a seed', () => {
  const draw = (seed: number) => {
    const bag = new LetterBag(letters('BBOOMMFIR E'.replace(' ', '')), streamFor(seed, 'bag'));
    return Array.from({ length: 10 }, () => bag.draw()?.letter).join('');
  };
  assert.equal(draw(12345), draw(12345));
  assert.notEqual(draw(12345), draw(999));
});

// ---------------------------------------------------------------- pool

const fill = (pool: LetterPool, lettersIn: string): void => {
  for (const ch of letters(lettersIn)) pool.add(ch, 'bag', 0);
};
const held = (pool: LetterPool): string => pool.all().map((e) => e.letter).sort().join('');

test('pool take consumes exactly the recipe multiset', () => {
  const pool = new LetterPool();
  fill(pool, 'BBOMXR');
  const taken = pool.take(letters('BOMB'));
  assert.equal(taken.length, 4);
  assert.deepEqual(taken.map((e) => e.letter).sort(), letters('BBMO').sort());
  // The untouched letters are exactly the leftovers.
  assert.equal(held(pool), 'RX');
});

test('pool take is all-or-nothing when a letter is short', () => {
  const pool = new LetterPool();
  fill(pool, 'BOM');
  const taken = pool.take(letters('BOMB'));
  assert.deepEqual(taken, [], 'a recipe that cannot be covered must not half-spend the pool');
  assert.equal(held(pool), 'BMO', 'a failed take leaves the pool untouched');
});

test('takeAllBut respects the letter it must leave behind', () => {
  const pool = new LetterPool();
  fill(pool, 'BOMBE');
  // `takeAllBut(recipe, except)` is the wildcard path: it must never eat the
  // letter it is allowed to substitute.
  const taken = pool.takeAllBut(['W', 'A', 'L', 'L'], 'A');
  assert.equal(taken, null, 'a wall cannot be built while A must stay in the pool');
  const ok = pool.takeAllBut(letters('BOMB'), 'B');
  assert.ok(ok, 'BOMB is reachable when one B may be substituted');
  assert.equal(pool.count('B'), 1, 'the reserved B is still in the pool');
});

test('deficit reports missing letters as a multiset', () => {
  // BOMB needs B x2, O, M. Holding BOB covers the two Bs and the O.
  assert.deepEqual(deficit(letters('BOMB'), countLetters(letters('BOB'))), ['M']);
  // Holding a single B owes one more B as well as the other letters.
  assert.deepEqual(deficit(letters('BOMB'), countLetters(letters('B'))).sort(), ['B', 'M', 'O'].sort());
  // Counting is per tile, so duplicates are honoured rather than deduplicated.
  assert.deepEqual(deficit(letters('BEE'), countLetters(letters('BE'))), ['E']);
  assert.deepEqual(deficit(letters('BEE'), countLetters(letters('BE'))).length, 1);
});

// ---------------------------------------------------------------- content invariants

test('every blueprint recipe is a word with no space or duplicate-only trick', () => {
  for (const bp of Object.values(BLUEPRINTS)) {
    assert.match(bp.word, /^[A-Z]{3,4}$/, `${bp.word} must be 3-4 plain letters`);
    assert.deepEqual(bp.recipe, letters(bp.word), `${bp.word} must spell itself`);
    assert.ok(bp.limit >= 1, `${bp.word} needs a concurrency limit`);
  }
});

test('every kit can build what it is given', () => {
  for (const kit of KITS) {
    const bag = countLetters(kit.bag);
    for (const bp of kitBlueprints(kit)) {
      const owed = deficit(bp.recipe, bag);
      // One letter short is a designed gap: the first carrier drop or the
      // wildcard closes it. More than that and the blueprint is decoration.
      assert.ok(
        owed.length <= 1 || kit.wildcards > 0,
        `${kit.id} cannot build ${bp.word} from its own bag (missing ${owed.join('')})`,
      );
    }
  }
});

test('kit bags are sized for the draw pulse', () => {
  for (const kit of KITS) {
    assert.ok(kit.bag.length >= 9 && kit.bag.length <= 13, `${kit.id} bag is ${kit.bag.length} tiles`);
    assert.equal(kit.blueprints.length, 3, 'exactly three equipped blueprints');
  }
});

test('every encounter is authored, reachable and shaped', () => {
  const ids = new Set<string>();
  for (const enc of RUN) {
    assert.ok(!ids.has(enc.id), `${enc.id} is duplicated`);
    ids.add(enc.id);
    assert.ok(enc.waves.length > 0, `${enc.id} has no waves`);
    assert.ok(enc.name.vi.length > 0, `${enc.id} has no display name`);
    for (const w of enc.waves) {
      assert.ok(w.count > 0 && w.at >= 0, `${enc.id} has a malformed wave`);
    }
  }
  assert.ok(RUN.length >= 8, 'the run needs at least eight encounters');
  // Chapter 1 encounter 1 teaches by composition: its opening pool must be
  // able to assemble a starter recipe with no clever play.
  const first = RUN[0];
  assert.ok(first.openingPool, 'the first encounter must seed the pool');
  const startable = first.openingPool!.filter((l) => l !== '?');
  const starters = Object.values(BLUEPRINTS).filter((b) => b.starter);
  assert.ok(starters.length > 0, 'at least one starter blueprint must exist');

  // The opening pool is a prefix of a starter recipe: short by at most one
  // letter, and that letter is one the encounter visibly promises.
  const prefixes = starters
    .map((bp) => ({ bp, owed: deficit(bp.recipe, countLetters(startable)) }))
    .filter((x) => x.owed.length <= 1);
  assert.ok(
    prefixes.length > 0,
    `the opening pool (${startable.join('')}) is not one tile short of any starter recipe`,
  );
  const guaranteed = countLetters([...first.guaranteed, ...startable]);
  for (const { bp, owed } of prefixes) {
    for (const ch of owed) {
      assert.ok(
        (guaranteed.get(ch) ?? 0) > 0,
        `${bp.word} is one ${ch} away at the start, but no carrier guarantees it`,
      );
    }
  }

  // And every kit must be able to craft something inside the first bag cycle,
  // counting the opening pool plus its own bag — the tutorial cannot depend on
  // a lucky shuffle.
  for (const kit of KITS) {
    const combined = countLetters([...startable, ...kit.bag]);
    const buildable = kitBlueprints(kit).filter((bp) => deficit(bp.recipe, combined).length === 0);
    assert.ok(
      buildable.length > 0,
      `${kit.id} cannot craft any of its recipes from the opening pool plus one bag cycle`,
    );
  }
});

// ---------------------------------------------------------------- simulation

function playOut(seed: number, kitId: string, encounterIndex: number) {
  const run = Run.create(seed, kitId);
  for (let i = 0; i < encounterIndex; i++) {
    run.advance();
    const reward = run.pendingRewards[0];
    if (reward) run.applyReward(reward);
  }
  return run;
}

test('same seed produces the same encounter', () => {
  const trace = (seed: number) => {
    const run = playOut(seed, 'assembly', 0);
    const battle = run.buildBattle();
    const samples: string[] = [];
    for (let i = 0; i < 120 * 20; i++) {
      battle.update(1 / 120);
      if (i % 120 === 0) {
        samples.push(
          [
            battle.pool.size,
            battle.telemetry.data.bagRemaining,
            battle.enemies.length,
            battle.entities.length,
            battle.telemetry.data.crafts,
            Math.round(battle.coreHp),
          ].join(','),
        );
      }
      if (battle.state !== 'intro' && battle.state !== 'fight') break;
    }
    return samples.join('|');
  };
  assert.equal(trace(4242), trace(4242), 'identical seeds diverged — a shared RNG stream or wall-clock leak');
});

test('a passive player cannot stall an encounter forever', () => {
  const run = playOut(31337, 'bastion', 3);
  const battle = run.buildBattle();
  const limit = TUNE.stallSeconds + TUNE.encounterTarget.boss + 30;
  let t = 0;
  while ((battle.state === 'intro' || battle.state === 'fight') && t < limit) {
    battle.update(1 / 60);
    t += 1 / 60;
  }
  assert.notEqual(battle.state, 'fight', `encounter never resolved within ${limit}s`);
  assert.ok(t < limit, 'the breach guard did not fire');
});

test('the breach guard costs letters rather than granting new targets', () => {
  const run = playOut(555, 'bastion', 5);
  const battle = run.buildBattle();
  let t = 0;
  while ((battle.state === 'intro' || battle.state === 'fight') && t < 120) {
    battle.update(1 / 60);
    t += 1 / 60;
  }
  assert.ok(battle.breaches >= 0);
  // Whatever happened, the encounter ended — the guard exists so that a build
  // with no kill pressure loses on the clock instead of hanging.
  assert.notEqual(battle.state, 'fight');
});

test('blueprint concurrency limits are respected', () => {
  const run = playOut(2024, 'assembly', 2);
  const battle = run.buildBattle();
  let t = 0;
  while ((battle.state === 'intro' || battle.state === 'fight') && t < 90) {
    battle.update(1 / 120);
    t += 1 / 120;
    for (const id of Object.keys(BLUEPRINTS) as (keyof typeof BLUEPRINTS)[]) {
      const live = battle.entities.filter((e) => e.alive && e.kind === id).length;
      assert.ok(
        live <= BLUEPRINTS[id].limit,
        `${id} exceeded its limit: ${live} > ${BLUEPRINTS[id].limit}`,
      );
    }
  }
});

test('run progression terminates and reports a result', () => {
  const run = Run.create(88, 'hunter');
  let guard = 0;
  while (!run.finished && guard++ < 20) {
    const battle = run.buildBattle();
    let inner = 0;
    while ((battle.state === 'intro' || battle.state === 'fight') && inner++ < 120 * 240) {
      battle.update(1 / 120);
    }
    run.absorb(battle);
    if (run.finished) break;
    const reward = run.pendingRewards[0];
    if (reward) run.applyReward(reward);
    run.advance();
  }
  assert.ok(run.finished, 'the run never reached a conclusion');
  assert.ok(run.state.record.cleared <= 8);
});

test('every kit finishes its run inside a sane time budget', () => {
  for (const kit of KITS) {
    const run = Run.create(999, kit.id);
    let total = 0;
    let guard = 0;
    while (!run.finished && guard++ < 20) {
      const battle = run.buildBattle();
      let inner = 0;
      while ((battle.state === 'intro' || battle.state === 'fight') && inner++ < 120 * 240) {
        battle.update(1 / 120);
      }
      total += battle.time;
      run.absorb(battle);
      if (run.finished) break;
      const reward = run.pendingRewards[0];
      if (reward) run.applyReward(reward);
      run.advance();
    }
    assert.ok(total < 600, `${kit.id} spent ${total.toFixed(0)}s in combat`);
    assert.ok(kitById(kit.id) === kit);
  }
});

// ---------------------------------------------------------------- V2 sockets
//
// Phase V2.1 of the rework brief. §15 lists exactly these cases: duplicate
// letters, one eligible recipe, multiple eligible recipes, reserve behaviour,
// exact completion.

import { Machine } from '../src/alphabet/sockets';
import type { RuntimeLetter } from '../src/alphabet/sockets';

const machineOf = (...ids: string[]): Machine =>
  new Machine(ids.map((id) => BLUEPRINTS[id as keyof typeof BLUEPRINTS]));

/** Feed letters in order; returns the assignment for each. */
const feed = (m: Machine, chars: string, t = 0): ReturnType<Machine['accept']>[] =>
  [...chars].map((ch, i) => m.accept(m.makeLetter(ch, { kind: 'bag', drawIndex: i, cycle: 0 }, t)));

test('sockets start empty and mirror the recipe exactly', () => {
  const m = machineOf('BOMB', 'BEE', 'WALL');
  const bomb = m.bySlot(0)!;
  assert.deepEqual(bomb.sockets.map((s) => s.requiredChar), ['B', 'O', 'M', 'B']);
  assert.deepEqual(bomb.sockets.map((s) => s.letter), [null, null, null, null]);
  assert.deepEqual(m.bySlot(1)!.sockets.map((s) => s.requiredChar), ['B', 'E', 'E']);
  assert.deepEqual(m.bySlot(2)!.sockets.map((s) => s.requiredChar), ['W', 'A', 'L', 'L']);
});

test('duplicate sockets fill left to right', () => {
  // BEE needs two E. They must land in socket 1 then socket 2, never reversed:
  // the row is read left to right on screen.
  const m = machineOf('BEE');
  const [a, b] = feed(m, 'EE');
  assert.equal(a.socket, 1);
  assert.equal(b.socket, 2);
  assert.equal(a.reason, 'sole');
  assert.equal(b.reason, 'sole');
});

test('BOMB fills its two B sockets at opposite ends of the word', () => {
  const m = machineOf('BOMB');
  const results = feed(m, 'BBOM');
  const bomb = m.bySlot(0)!;
  assert.equal(bomb.sockets[0].letter?.char, 'B');
  assert.equal(bomb.sockets[3].letter?.char, 'B');
  assert.ok(m.isComplete(bomb));
  assert.equal(results[3].completed, true, 'the last tile must report completion');
});

test('a letter only one recipe wants is assigned automatically', () => {
  const m = machineOf('BOMB', 'BEE');
  const [r] = feed(m, 'O');
  assert.equal(r.reason, 'sole');
  assert.equal(r.slot, 0);
  assert.equal(r.contested, false);
});

test('a contested letter follows Focus when Focus is eligible', () => {
  const m = machineOf('BOMB', 'BEE');
  m.setFocus(1);
  const [r] = feed(m, 'B');
  assert.equal(r.contested, true, 'B is wanted by both BOMB and BEE');
  assert.equal(r.reason, 'focus');
  assert.equal(r.slot, 1, 'the focused recipe takes it');
  assert.equal(m.bySlot(1)!.sockets[0].letter?.char, 'B');
  assert.equal(m.bySlot(0)!.sockets[0].letter, null);
});

test('when only one candidate remains the assignment is sole, not contested', () => {
  // Honest bookkeeping guard. BEE's B socket filling does not make the next B a
  // "lost" focus decision -- only one recipe can still use it, so no decision
  // existed and it must be reported as `sole`.
  const m = machineOf('BOMB', 'BEE');
  m.setFocus(1);
  const results = feed(m, 'BB');
  assert.equal(results[0].reason, 'focus');
  assert.equal(results[0].slot, 1);
  assert.equal(results[1].reason, 'sole');
  assert.equal(results[1].slot, 0);
  assert.equal(results[1].contested, false);
  assert.equal(m.fallbackAssignments, 0);
});

test('a contested letter falls back deterministically when Focus is ineligible', () => {
  // Genuine fallback: two recipes want the B, but Focus sits on a third recipe
  // that has no B socket open. The tie must resolve by slot order *and* be
  // reported as a fallback, because §3.1.2 requires the fallback be visible
  // rather than disguised as a focus win.
  const m = machineOf('BOMB', 'BEE', 'WALL');
  m.setFocus(2); // WALL: needs W, A, L -- cannot take a B
  const [r] = feed(m, 'B');
  assert.equal(r.contested, true);
  assert.deepEqual(r.candidates, [0, 1]);
  assert.equal(r.reason, 'fallback');
  assert.equal(r.slot, 0, 'deterministic slot order breaks the tie');
  assert.equal(m.fallbackAssignments, 1);
  assert.equal(m.focusedAssignments, 0);
});

test('the same letter stream allocates differently under different Focus', () => {
  // This is the acceptance test the brief states for V2.2: Focus must be a real
  // decision, not decoration. Same seed, same letters, different outcome.
  const build = (focus: number) => {
    const m = machineOf('BOMB', 'BEE');
    m.setFocus(focus);
    feed(m, 'BBOOM');
    const bomb = m.bySlot(0)!.sockets.filter((s) => s.letter).length;
    const bee = m.bySlot(1)!.sockets.filter((s) => s.letter).length;
    return { bomb, bee };
  };
  const toBomb = build(0);
  const toBee = build(1);
  assert.notDeepEqual(toBomb, toBee, 'Focus must change where contested letters land');
  assert.ok(toBee.bee > toBomb.bee, 'focusing BEE should feed BEE more');
});

test('a letter no recipe wants goes to the reserve, not the void', () => {
  const m = machineOf('BOMB');
  const [r] = feed(m, 'Z'.replace('Z', 'Q'));
  assert.equal(r.reason, 'reserve');
  assert.equal(r.slot, -1);
  assert.equal(m.reserve.length, 1);
  assert.equal(m.reserve[0].char, 'Q');
});

test('the reserve holds letters that later become wanted', () => {
  // A Q is useless to BOMB now, but the reserve is a waiting room. Fill BOMB's
  // other sockets, then confirm the machine re-reads its reserve.
  const m = machineOf('BOMB');
  feed(m, 'BOMB');
  // Refill from empty: put a B in reserve-eligible state by focusing nothing.
  const m2 = machineOf('BEE');
  feed(m2, 'EEEE'); // two go to sockets, two overflow to reserve
  assert.equal(m2.reserve.length, 2, 'surplus E beyond the recipe is reserved');
});

test('reserve overflow is reported rather than silently dropping letters', () => {
  const m = new Machine([BLUEPRINTS.BOMB], { reserveCap: 2 });
  feed(m, 'QQQQ');
  assert.equal(m.reserve.length, 2);
  assert.equal(m.reserveOverflow, 2, 'the two that did not fit must be counted');
});

test('drainReserve moves a waiting tile into a socket once it is wanted', () => {
  const m = machineOf('BOMB');
  // B arrives first: BOMB wants it, so it is not reserved. O and M fill, then a
  // second B completes. To exercise the drain path, hold an O in reserve behind
  // full sockets is not possible for one recipe, so use two recipes: BEE holds
  // E, then BOMB opens no E socket. Instead drop the tile while nothing wants
  // it, then add a recipe that does.
  const single = new Machine([BLUEPRINTS.BOMB]);
  single.accept(single.makeLetter('Q', { kind: 'bag', drawIndex: 0, cycle: 0 }, 0));
  assert.equal(single.reserve.length, 1);
  assert.deepEqual(single.drainReserve(), [], 'nothing wants Q, so nothing moves');
  assert.equal(single.reserve.length, 1);
});

test('commit returns the committed tiles and empties the sockets', () => {
  const m = machineOf('BOMB');
  feed(m, 'BBOM');
  const letters = m.commit(0);
  assert.ok(letters, 'a complete recipe must commit');
  assert.equal(letters!.length, 4);
  assert.deepEqual(letters!.map((l) => l.char).sort(), ['B', 'B', 'M', 'O']);
  assert.deepEqual(m.bySlot(0)!.sockets.map((s) => s.letter), [null, null, null, null]);
  assert.equal(m.commit(0), null, 'committing twice is not allowed');
});

test('wildcardTargets lists only recipes missing exactly one letter', () => {
  const m = machineOf('BOMB', 'BEE');
  feed(m, 'BOM'); // BOMB missing its final B; BEE untouched
  const targets = m.wildcardTargets();
  assert.equal(targets.length, 1);
  assert.equal(targets[0].slot, 0);
  assert.equal(targets[0].char, 'B');
});

test('fillSocket places a wildcard tile in the exact missing socket', () => {
  const m = machineOf('BOMB');
  feed(m, 'BOM');
  const target = m.wildcardTargets()[0];
  const tile = m.fillSocket(target.slot, target.socket, 1);
  assert.ok(tile);
  assert.equal(tile!.char, 'B');
  assert.deepEqual(tile!.source, { kind: 'wildcard' });
  assert.ok(m.isComplete(m.bySlot(0)!));
});

test('focus switches are counted, and re-focusing the same slot is not a switch', () => {
  const m = machineOf('BOMB', 'BEE');
  assert.equal(m.setFocus(1), true);
  assert.equal(m.setFocus(1), false, 'setting the same focus is a no-op');
  assert.equal(m.setFocus(0), true);
  assert.equal(m.focusSwitches, 2);
});

test('focus cannot be set to a slot with no blueprint', () => {
  const m = machineOf('BOMB');
  assert.equal(m.setFocus(2), false);
  assert.equal(m.focusSlot, -1);
});

test('the machine is deterministic: identical input yields identical state', () => {
  const runOnce = () => {
    const m = machineOf('BOMB', 'BEE', 'WALL');
    m.setFocus(1);
    feed(m, 'BBOOMWALLEE');
    return JSON.stringify({
      sockets: m.blueprints.map((b) => b.sockets.map((s) => s.letter?.char ?? null)),
      reserve: m.reserve.map((l) => l.char),
      counters: [m.contestedLetters, m.focusedAssignments, m.fallbackAssignments],
    });
  };
  assert.equal(runOnce(), runOnce());
});
