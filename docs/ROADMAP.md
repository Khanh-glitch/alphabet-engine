# ROADMAP

Milestones follow the brief's M0–M6. Each is "done" only when verified by the
harness or by looking at a rendered shot.

## M0 — Foundation ✅

Repo audit; project setup (Vite + strict TypeScript); core primitives (theme,
seeded RNG, i18n, draw kit, UI kit); the domain layer (`alphabet/`) with bag,
pool, rules and trace; content data files.

## M1 — One encounter that proves the idea ✅

Battle simulation (`battle/`): spawning, bag feed, craft beats, object
behaviours, enemies, tags, telemetry. A single encounter that runs end-to-end and
can be won or lost.

## M2 — The cascade is real ✅

Kill → letter → pool → faster craft, verified numerically. Chain tracking with
the cycle rule. Wildcard intervention. Breach guard so no encounter can stall.

## M3 — Run structure ✅

3 kits, 8 authored encounters across 4 chapters, reward generator (bag / rule /
blueprint / repair), run state, repair pacing, run summary with per-blueprint
attribution.

**Now:** M3.5 — the visual and clarity pass the player asked for (engine-quality
presentation, Vietnamese-first copy, "how to play" legibility, no meta text).
This is where the project currently sits.

## M4 — Presentation and feel ⏳

- Distinct audiovisual tier above chain ×4.
- Core breach should visibly impact the core, not just subtract health.
- Boss pressure should be phases, not a flat escort timer.
- Screenshot-diff regression so visual style stops regressing.

## M5 — Content depth ⏳

- Author homes for MINE / SAW / WEB / ICE so every blueprint is reachable by
  intent, not luck.
- More blueprints (each with a declared `limit` and a legible physical form).
- Encounter variety per chapter: at least two shapes per chapter.

## M6 — Ship-readiness ⏳

- Unit tests for the domain layer (see `TEST_PLAN.md` for the list) via
  `node --test`, kept outside the shipped `tsconfig` include.
- Accessibility pass: contrast audit, reduced-motion coverage, keyboard-only
  run of the full loop.
- Save migration tested across two versions.
- Native Vietnamese copy review.
- Balance pass against a *competent* player policy, not only the naive one.

## Explicitly not on the roadmap

Unlock trees, meta currencies, daily runs, leaderboards, accounts, multiplayer,
store pages, monetisation. Each is recorded in `DECISIONS.md`.
