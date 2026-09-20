# CONTENT_RULES

How to author content in this project without breaking the systemic promise.
Everything here is enforceable by reading the data files; none of it requires
new code.

## 1. Recipes

- A recipe is a **word**, upper-case, one letter per tile, no spaces, no
  hyphens. `BOMB` — never `BBOM`. (The prototype printed `BBOM` once and it made
  the whole card read as a code instead of a word.)
- Length: 3–4 letters. Five is a design decision to be argued, not a default;
  longer words slow the pulse of the game more than they add.
- The blueprint must be **visibly a physical object** doing one legible thing.
  If you cannot say what it looks like in one clause, it is not ready.
- Every blueprint declares a `limit` (max concurrent instances). Structures and
  passive devices especially — a defensive build with no cap can stall a fight
  forever (see `DECISIONS.md` D-004).
- Recipes must not collide in a way that makes one unbuildable. Two blueprints
  may share letters; three sharing a rare letter is a trap.

## 2. Kits

- A kit is 3 blueprints, a core HP, a wildcard count and a bag.
- **The bag must be able to spell every equipped blueprint.** This is checked by
  hand today; bastion shipped unbuildable once because its bag had no `E` for
  `MINE`. Before adding a kit, spell all three recipes from the bag alone.
- Bag size 10–12 tiles. Below 9 the cycle churns too fast to plan; above 13 the
  player waits.
- A kit's identity should be legible from the bag's letter mix alone.

## 3. Enemies

- Every enemy is authored with: colour, hp, speed, radius, lane preference,
  arrival damage, and whether it can carry letters.
- Colour must be distinguishable from the arena background and from other
  enemies **without relying on hue alone** — the shape and silhouette differ
  per archetype.
- Speeds: a unit crossing the arena takes 5–10 s. Faster than that and the
  player cannot react; slower and the encounter drags.
- Carriers must be **readable before death**: the badge appears on the body as
  soon as the letter is attached.

## 4. Encounters

- An encounter declares: id, chapter, display name, kind, hp/speed multipliers,
  optional `openingPool`, waves `{at, kind, count, gap, lane}`, guaranteed
  letters, unknown-carrier count, reward profile, hint, and what it teaches.
- **Chapter 1 encounter 1 must be winnable while doing nothing clever.**
  Its `openingPool` contains only the letters of the starter recipes so the
  player's first craft happens by observation, not insight.
- Waves should overlap rather than queue: pressure comes from composition, not
  from a longer list of identical spawns.
- Every encounter needs a *shape* (a stream, a wall of brutes, a flying
  carrier run). "More of the last one" is not an encounter.
- `guaranteed` letters are the anti-frustration tool: if a player's build needs
  a letter to function, an authored encounter should promise it somewhere.

## 5. Letters and randomness

- Randomness decides *order and offers*, never whether a planned engine works.
- Letter assignment goes through the event API — `addToPool(randomLetter())`.
  Never place a literal letter in authored content that is supposed to be
  random, and never bypass the pool to grant a letter directly.
- The bag is a cycle, not an endless shuffle. Content that cares about "fresh
  cycle" (several rules do) relies on this contract.

## 6. Machine Rules

- A rule rewrites **behaviour**. If your rule can be rewritten as a percentage,
  it is not a rule.
- Rules are authored against named hooks in `src/alphabet/rules.ts`. Adding a
  hook is a code change and needs review; adding a rule is content.
- Rule names are two or three words of fiction in both languages, not
  mechanical descriptions (`Ngòi ngắn` / `Short fuse`).
- No hidden state. If a rule changes an outcome, the change must be attributable
  and observable in the trace.

## 7. Rewards

- Reward profiles: `bag`, `rule`, `blueprint`, `mixed`.
- Blueprint offers draw from **all non-equipped blueprints**, so a run can
  genuinely change identity mid-way.
- Repair is offered when the core is hurt (34 hp cap) so "I am losing" has a
  path that is not "restart".
- Every reward must show the physical thing it changes, not a stat line.

## 8. Text and localisation

- All player-facing strings go through the dictionaries. Vietnamese is authored
  first, English second; neither is a translation of the other's phrasing.
- Recipe words, and only recipe words, stay Latin in all locales: they are
  gameplay tokens, not prose.
- No unexplained proper nouns in UI chrome.

## 9. Naming conventions

- Encounter ids: `ch<chapter>-<slug>` (`ch2-bulwark`).
- Rule ids: camelCase describing behaviour (`firstVowelDuplicated`).
- Blueprint ids: the upper-case word (`BOMB`), with the Vietnamese gloss in the
  L() pair.
