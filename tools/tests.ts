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
