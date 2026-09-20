/**
 * Bot comparison harness — rework brief 12.1–12.3.
 *
 * The brief asks for three bots of increasing competence so that each steering
 * mechanic can be *shown* to matter rather than assumed to. The value of this
 * tool is the isolation: `steer-nomark` is identical to `steer` except that it
 * never marks, so the difference between them is the mark's contribution and
 * nothing else.
 *
 *   passive       never focuses, never marks          (brief 12.1 BOT A)
 *   steer         focuses toward the nearest recipe, marks needed carriers
 *   steer-nomark  focuses, never marks                (isolates Mark)
 *
 * All three are deliberately simple. A clever bot would flatter the mechanics.
 *
 * Not part of the game build.
 */
import { Battle } from '../src/battle/battle';
import { BLUEPRINTS } from '../src/content/blueprints';
import { KITS } from '../src/content/kits';
import { encountersFor, type RunMode } from '../src/content/encounters';
import { TUNE } from '../src/content/tuning';

type BotMode = 'passive' | 'steer' | 'steer-nomark';

interface Totals {
  crafts: number;
  combatFed: number;
  lettersRecovered: number;
  kills: number;
  coreLost: number;
  seconds: number;
  clears: number;
  fights: number;
  marks: number;
  markedKills: number;
  focusWon: number;
  contested: number;
  maxDepth: number;
  wildcardsUsed: number;
  /** Mean machine speed multiplier actually experienced (brief line 2285). */
  momentum: number;
  momentumSamples: number;
}

const empty = (): Totals => ({
  crafts: 0,
  combatFed: 0,
  lettersRecovered: 0,
  kills: 0,
  coreLost: 0,
  seconds: 0,
  clears: 0,
  fights: 0,
  marks: 0,
  markedKills: 0,
  focusWon: 0,
  contested: 0,
  maxDepth: 0,
  wildcardsUsed: 0,
  momentum: 0,
  momentumSamples: 0,
});

/**
 * One run of the encounter list, steered by a bot.
 *
 * Mirrors the real run closely enough to be meaningful: three equipped recipes,
 * an authored bag, wildcard charges, and the same deterministic clock the game
 * uses.
 */
function playRun(mode: BotMode, kitId: string, seed: number, encounters: RunMode): Totals {
  const kit = KITS.find((k) => k.id === kitId);
  if (!kit) throw new Error(`unknown kit ${kitId}`);
  const list = encountersFor(encounters);
  const t = empty();
  let core = kit.coreHp;

  for (const enc of list) {
    const battle = new Battle({
      seed: seed + enc.id.length * 31,
      encounter: enc,
      bagTiles: kit.bag.slice(),
      blueprints: kit.blueprints.map((id) => BLUEPRINTS[id]),
      rules: [],
      flags: [],
      coreHp: core,
      maxCoreHp: kit.coreHp,
      wildcards: kit.wildcards,
      encounterIndex: t.fights,
    });
    t.fights += 1;
    for (let i = 0; i < 120 * 30; i++) {
      if (battle.state === 'cleared' || battle.state === 'failed') break;
      battle.update(1 / 120);
      t.momentum += battle.momentum;
      t.momentumSamples += 1;
      if (mode !== 'passive' && i % 20 === 0) steer(battle, mode === 'steer', t);
    }
    if (battle.state === 'cleared') t.clears += 1;
    t.crafts += battle.v2.crafts;
    t.combatFed += battle.v2.combatFedCrafts;
    t.lettersRecovered += battle.telemetry.data.lettersRecovered;
    t.kills += battle.telemetry.data.kills;
    t.coreLost += battle.maxCoreHp - Math.max(0, battle.coreHp);
    t.seconds += battle.time;
    t.marks += battle.v2.marksPlaced;
    t.markedKills += battle.v2.markedKills;
    t.focusWon += battle.machine.focusedAssignments;
    t.contested += battle.machine.contestedLetters;
    t.maxDepth = Math.max(t.maxDepth, battle.v2.maxCascade);
    t.wildcardsUsed += battle.v2.wildcardsUsed;
    // No attrition across the evaluation set (brief 3.12).
    core = battles(encounters) ? kit.coreHp : Math.max(1, Math.round(kit.coreHp * 0.35));
    if (battle.state === 'failed' && !battles(encounters)) break;
  }
  return t;
}

const battles = (mode: RunMode): boolean => mode === 'v2test';

/** One steering tick. Kept trivial on purpose. */
function steer(battle: Battle, allowMark: boolean, totals: Totals): void {
  // Focus the recipe closest to completion, so contested letters go where they
  // finish something rather than where they merely fit.
  let best = -1;
  let bestFrac = -1;
  for (const rt of battle.machine.blueprints) {
    const filled = rt.sockets.filter((s) => s.letter !== null).length;
    const frac = filled / rt.sockets.length;
    if (frac < 1 && frac > bestFrac) {
      bestFrac = frac;
      best = rt.slot;
    }
  }
  if (best >= 0 && best !== battle.focusSlot) battle.focus(best);

  if (!allowMark) return;
  const live = battle.enemies.filter((e) => !e.dead && e.carry);
  const wanted = live.filter((e) => battle.machine.wants(e.carry as string));
  // Mark the needed carrier closest to the core, not the first one in array
  // order. This matters: BEE's own rule 2 already picks `needed[0]`, so a bot
  // that marks `needed[0]` would measure nothing and report the mark as useless
  // regardless of whether it works.
  const pick =
    wanted.slice().sort((a, b) => a.x - b.x)[0] ??
    live.slice().sort((a, b) => a.x - b.x)[0] ??
    null;
  const current = battle.marked;
  if (pick && current?.id !== pick.id) {
    if (current) battle.mark(current.id); // clear
    battle.mark(pick.id);
    totals.marks += 1;
  }
}

// ---------------------------------------------------------------- driver

const arg = (name: string, fallback: string): string => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};

// A/B switch the brief asks for (8.3): "do not assume faster is better".
if (arg('momentum', 'on') === 'off') TUNE.momentum.ladder = TUNE.momentum.ladder.map(() => 1);

const runs = Number(arg('runs', '8'));
const kitId = arg('kit', 'v2test');
const mode: RunMode = arg('set', 'v2test') === 'standard' ? 'standard' : 'v2test';
const modes: BotMode[] = ['passive', 'steer-nomark', 'steer'];

console.log(`bots: kit=${kitId} set=${mode} runs=${runs} (${encountersFor(mode).length} encounters each)`);
console.log(
  'bot           crafts  combat-fed  kills  letters  coreLost  seconds  clears  marks  markKills  maxChain  mom',
);
const results: Record<string, Totals> = {};
for (const m of modes) {
  const acc = empty();
  for (let r = 0; r < runs; r++) {
    const one = playRun(m, kitId, 1000 + r * 7919, mode);
    for (const k of Object.keys(acc) as (keyof Totals)[]) acc[k] += one[k];
  }
  results[m] = acc;
  const f = (n: number, d = 1) => (n / runs).toFixed(d).padStart(6);
  console.log(
    `${m.padEnd(13)} ${f(acc.crafts)}  ${f(acc.combatFed)}      ${f(acc.kills)}  ${f(acc.lettersRecovered)}  ` +
      `${f(acc.coreLost)}  ${f(acc.seconds)}  ${f(acc.clears)}  ${f(acc.marks)}  ${f(acc.markedKills)}  ` +
      `${f(acc.maxDepth)}  x${(acc.momentum / Math.max(1, acc.momentumSamples)).toFixed(3)}`,
  );
}

const pct = (a: number, b: number): string => (b === 0 ? 'n/a' : `${(((a - b) / b) * 100).toFixed(1)}%`);
console.log('');
console.log(`steer vs passive       crafts ${pct(results.steer.crafts, results.passive.crafts)}  ` +
  `kills ${pct(results.steer.kills, results.passive.kills)}  ` +
  `coreLost ${pct(results.steer.coreLost, results.passive.coreLost)}`);
console.log(`mark isolation         crafts ${pct(results.steer.crafts, results['steer-nomark'].crafts)}  ` +
  `letters ${pct(results.steer.lettersRecovered, results['steer-nomark'].lettersRecovered)}  ` +
  `kills ${pct(results.steer.kills, results['steer-nomark'].kills)}`);
