# AGENTS.md — rules of engagement for this repository

> Read this before touching anything. It is short on purpose.

## What this project is

**Alphabet Engine** — a systemic roguelite autobattler where letters form words,
words become literal physical objects, and combat output feeds the alphabet
economy that manufactures the next object.

The chain that must never break:

```
RANDOM INPUT → PLAYER-SHAPED ENGINE → READABLE ANTICIPATION → TINY INTERVENTION
→ LITERAL PAYOFF → COMBAT-GENERATED LETTERS → SELF-FEEDING CASCADE
→ BUILD THEORY → ONE MORE ENCOUNTER
```

## Non-negotiable design rules

1. **The word must become the thing.** A completed recipe instantiates a literal
   object with a distinct battlefield function. `BOMB` is a bomb that rolls and
   explodes. `WALL` is a wall. Never `BOMB = +30 damage`.
2. **Curated vocabulary.** No free typing, no dictionary validation, no
   crosswords. Recipes are authored blueprints.
3. **Randomness creates the problem; the player shapes the answer.** Randomness
   decides letter order, offers and encounter composition. It never decides
   whether a planned engine is allowed to function, and never rolls arbitrary
   misses or crits.
4. **Exactly three equipped blueprints**, one shared pool, one intervention
   (the wildcard `?`). Do not add a skill bar.
5. **Enemy letters are fuel during combat**, not loot after it. The drop must be
   visible before the enemy dies.
6. **Machine Rules change rules**, not percentages. `+8% damage` is not an
   upgrade; "the first vowel each cycle is duplicated" is.
7. **Protect the hero moment.** Word completion is a visible beat: letters
   converge → the word locks → the object emerges. Never replace it with a card
   flash.
8. **Readability beats spectacle.** Never bury letters, recipes or threats under
   particles.

## Architecture rules

- `src/alphabet/**` is pure domain logic. **No DOM, no canvas, no timers, no
  `Math.random`.** It must be testable by stepping functions directly.
- `src/battle/**` is the simulation. Deterministic, driven by `update(dt)`.
  Never reads rendering state.
- `src/render/**` and `src/ui/**` read state and draw. **Never mutate the
  simulation.**
- `src/content/**` is data. New blueprints/enemies/encounters/rules are added
  here, not by writing new branches in gameplay code.
- All randomness comes from `src/core/rng.ts` streams. A behaviour that needs a
  new random source gets a **new named stream**, never a shared one.
- Balance numbers live in `src/content/tuning.ts`, not inline in logic.

## Verification workflow (do not skip)

```bash
npm run typecheck                  # must be clean
npm run build                      # must succeed
node tools/shoot.mjs sim --runs=10 --kit=assembly    # balance report
node tools/shoot.mjs shot battle out.png --seconds=9 # look at it
```

- **Visual work is not done until you have looked at a PNG.** `tools/shoot.mjs`
  renders the real game code on a Node canvas, so UI can be inspected without a
  browser. Never claim a screen "looks good" without a shot.
- **Balance claims need numbers** from `sim`, not impressions.
- Acceptance targets (from the design brief):
  - first craft ≈ 2–4 s,
  - encounter ≈ 8–15 s,
  - chain of 2 common, 3 exciting, 4+ uncommon.

## Do not add (scope guardrails)

Branching maps, meta currencies, multiple active abilities, stat-inflation
upgrades, hidden proc chains, online services, accounts, networking. Each of
these was considered and rejected — see `docs/DECISIONS.md`.

## Project memory

Canonical documents live in `docs/`. Update the relevant one in the same change
that alters behaviour. `docs/PROGRESS.md` must always state what works, what is
partial, known bugs, the next five tasks and current risks.
