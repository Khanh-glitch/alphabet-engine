# DECISIONS

Architecture and design decisions with their reasoning, so a future contributor
does not relitigate them by accident.

---

## D-001 — Runtime: TypeScript + Canvas, not Godot 4.7.2 / GDScript

**Status:** deviation from the brief, documented, user-visible.

**The brief asked for** Godot 4.7.2 stable with statically typed GDScript.

**What happened:** the engine could not be obtained in this environment. The
official release asset exists (`Godot_v4.7.2-stable_linux.x86_64.zip` on
`godotengine/godot` releases) but every download attempt fails with SSL error 35
against `release-assets.githubusercontent.com`, and there is no GPU or display
server for a rendering engine anyway. `deb.debian.org`,
`storage.googleapis.com` and `googlechromelabs.github.io` are similarly
unreachable; only the npm and PyPI registries are open.

**Decision:** build the game in TypeScript on Canvas 2D, under strict compiler
settings, with the domain layer written engine-agnostically.

**Why this is not a throwaway:**

- `src/alphabet/**`, `src/battle/**`, `src/content/**` and `src/run/**` contain
  no rendering or platform calls. They are a pure simulation with an explicit
  `update(dt)`, deterministic streams and data-only content. Porting them to
  GDScript is a transcription exercise, not a redesign.
- Every layout constant, recipe, encounter, rule and balance number is already
  data, and the tuning file is the single source of truth.
- The behavioural spec is now executable: the harness can verify the design
  targets (`first craft 2–4 s`, `encounter 8–15 s`, `chain 3+`) numerically.
  That verification is portable to any engine.

**Risk accepted:** if the engine choice is mandatory rather than a means to an
end, the port is real work and the visual ceiling of Canvas is lower than
Godot's. The project therefore over-invests in readability, typography and
feedback in compensation. This is the largest open risk in the project and it is
the user's call, not the author's.

---

## D-002 — One canvas, immediate-mode screens (no framework)

Screens are plain objects with `draw`/`update`/`pointer`. No React, no virtual
DOM, no retained widget tree.

**Why:** the entire game is one 1920×1080 surface redrawn at 60 Hz, and the HUD
must reconcile with simulation state at frame rate. Immediate mode keeps the
draw path inspectable and lets the harness render any screen to a PNG in Node
with no browser. A framework would add indirection for no gain at this scale.

---

## D-003 — Curated blueprints, and recipes are words

The brief forbids free typing, dictionary validation and sentences. Within that,
one choice was ours: **recipes spell their English word** (`BOMB`, `FIRE`,
`WALL`) rather than a compressed code (`BBOM`).

**Why:** the prototype showed `BBOM` on the card and it read as a cipher. A word
that is visibly a word is what makes "the word becomes the thing" land. Cost:
`BOMB` needs two `B`s and is therefore a heavier craft than a 3-letter recipe,
which is a *feature* — the bomb is the payoff for a real investment.

---

## D-004 — Per-blueprint concurrency limits

Each blueprint declares a maximum concurrent instance count (BOMB 4, FIRE 2,
WALL 4, FAN 3, …).

**Why:** during balance testing, a defensive kit (WALL/FAN/BOMB) produced 131-
second encounters and over 1,000 crafts because structures have no win
condition and nothing was dying. Caps make "spend these letters or wait" a real
decision and stop the machine from eating itself. Caps are balance data, not
code.

---

## D-005 — Breach, not pressure waves

When waves are exhausted and nothing has died for `stallSeconds`, a visible
countdown runs, then every surviving enemy deals its full arrival damage and
dies, dropping nothing.

**Why:** the first attempt at a stall guard spawned *more* enemies, which made
long fights longer (240 s observed) and rewarded passivity with fresh targets.
The breach does the opposite: it converts stalling into a loss of letters, which
is the resource the player actually cares about, and it is always announced
before it lands.

---

## D-006 — Cycle-based bag, not continuous shuffle

The bag materialises a shuffled order and consumes it; emptying starts a new
cycle, which is a first-class event (it resets cascade history and triggers
rules).

**Why:** a continuously shuffled bag makes "what remains" unshowable and makes
several interesting rules impossible to author honestly. A cycle gives the
player a readable economy and gives the designer a beat to hang rules on.

---

## D-007 — Enemy letters are combat fuel, not post-combat loot

Letters are attached to enemies before death and released on death.

**Why:** the alternative (a loot screen) inserts a modal pause between the
cascade and its reward, which is precisely the wrong place to spend the
player's attention. The whole point is the kill *is* the draw.

---

## D-008 — Vietnamese-first, recipe words stay Latin

Vietnamese is the default locale and the UI strings were authored in Vietnamese
rather than translated. Recipe words (`BOMB`, `FIRE`) remain Latin in every
language.

**Why:** recipe words are gameplay tokens the player manipulates; translating
them would break the direct relationship between the letters in the bag and the
word on the card. UI prose is translatable because it is prose.

---

## D-009 — One intervention: the wildcard

No ability bar, no item slots, no per-blueprint buttons. A single `?` charge per
encounter, whose effect is fully disclosed (which word, which letter).

**Why:** the brief requires one combat intervention, and every additional
control dilutes the cascade as the source of excitement. A disclosed wildcard is
a decision; a hidden one is a dice roll.

---

## D-010 — Machine Rules change behaviour, never percentages

Nine rules plus four tweaks, all behavioural.

**Why:** the brief is explicit that upgrades must feel like discovering a new
combination. `+8 % damage` is a number the player cannot see working; "the first
vowel of each cycle is duplicated" is a sentence they can build a plan around.

---

## D-011 — Deterministic named RNG streams

Every system that needs randomness takes its own named stream from a seeded
generator.

**Why:** reproduction. A bug report that names a seed must be replayable, and
the harness's balance reports are only comparable across builds if the seeds
mean the same thing. Sharing a stream silently couples two systems' futures.

---

## D-012 — Headless verification harness in-repo

`tools/harness.ts` bundles the real game and drives it in Node, rendering to
`@napi-rs/canvas`.

**Why:** this environment has no browser and no GPU, and the alternative was to
claim "it should look fine". Rendering the real screens to PNGs caught genuine
layout bugs (overlapping HUD labels, clipped text, card hints colliding with
counters), and `sim` turned balance arguments into numbers. It is now the
project's regression tool and the reason `BALANCE.md` contains measured values.

---

## D-013 — Meta progression deferred

Codex discovery and best-chain records persist, but nothing unlocks.

**Why:** the brief requires the systemic loop to be self-sustaining before
anything is layered on top. Unlock trees are an easy way to hide an unengaging
core loop behind a progression treadmill. Revisit only after the loop is
validated with real players.
