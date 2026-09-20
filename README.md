# ALPHABET ENGINE

**Build the alphabet. Let it manufacture war.**

A systemic roguelite autobattler where letters assemble into words, words
materialise as literal physical weapons, and kills release the letters they
carried — so combat feeds the factory that fights it.

You do not fire the bomb. You assemble `B O M B`, and a bomb rolls onto the
field, detonates, and scatters its own letters back into your pool.

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # typecheck + production bundle
npm run typecheck
```

## How to play

1. **Your bag feeds the pool.** Every 0.55 s a letter leaves your bag and lands
   in the shared pool at the bottom of the screen. When the bag empties it
   reshuffles — a new **cycle**.
2. **Recipes assemble themselves.** You equip three blueprints (`BOMB B O M B`,
   `FIRE F I R E`, `OIL O I L`). The instant the pool covers a recipe, the word
   builds and becomes a physical object on the field.
3. **Enemies carry letters.** A carrier shows its letter before it dies. Kill it
   and the letter drops straight into your pool — that is your fastest supply.
4. **Chain them.** Crafts that land inside the chain window stack a cascade. The
   chain box tells you how alive your machine is.
5. **One intervention.** A single `?` per encounter fills exactly the missing
   letter the HUD names. Spend it or bank it.
6. **Three slots, one choice between fights.** Bag, Machine Rule, or a new
   blueprint — one of three, every encounter.

Controls: **mouse** for everything, **1×/2×/3×** and **pause** on the HUD,
**Esc** to pause, **L** to toggle language.

## What is in here

| Path | Contents |
| --- | --- |
| `src/alphabet/` | pure domain: bag, pool, recipes, rules, trace |
| `src/battle/` | deterministic combat simulation |
| `src/content/` | authored data: blueprints, enemies, encounters, kits, tuning |
| `src/run/` | run structure and rewards |
| `src/render/`, `src/ui/` | arena, FX, HUD, screens |
| `src/core/` | theme, RNG, i18n, draw primitives, save, audio |
| `tools/` | headless screenshot + balance harness |
| `docs/` | full project memory (see below) |

## Verification

No browser or GPU is required to check this project:

```bash
npm run sim -- --runs=10 --kit=assembly   # balance report over whole runs
npm run shot -- battle out.png --seconds=9 # render the real game to a PNG
```

`sim` plays full runs with a naive first-offer policy and prints measured
statistics against the design targets; `shot` drives the real `App` through
scripted clicks (including `--overlay=pause` and `--click=hud.wild`) on a Node
canvas. Both run the actual game code — nothing is mocked.

## Project memory

Start with `AGENTS.md` (rules of engagement), then:

`docs/PRODUCT.md` · `GDD.md` · `ARCHITECTURE.md` · `UX_UI.md` · `BALANCE.md` ·
`CONTENT_RULES.md` · `TEST_PLAN.md` · `ROADMAP.md` · `DECISIONS.md` ·
`ASSETS.md` · `CHANGELOG_DEV.md` · `PROGRESS.md`

The design brief this implements is versioned at
`docs/_brief_master_prompt.md`.

## Status

Playable end-to-end: title → kit select → 8 encounters across 4 chapters →
run summary, with codex, settings, pause and a persisted run. Vietnamese-first
UI. See `docs/PROGRESS.md` for what is working, what is rough, and the current
risks — including the documented deviation from the brief's target engine.
