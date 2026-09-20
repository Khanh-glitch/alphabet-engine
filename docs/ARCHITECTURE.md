# ARCHITECTURE

## Runtime shape

Vite + TypeScript, strict, no framework. One `<canvas>` at 1920×1080 logical
size, letterboxed to the viewport, drawn immediately each frame by
`requestAnimationFrame`. Screens are plain objects with `draw`/`update`/`pointer`
hooks; there is no virtual DOM and no reactive graph anywhere in the gameplay.

```
index.html
 └─ src/main.ts        boot, resize, RAF loop, screen registry, ?debug=1 hooks
     ├─ src/app/app.ts      App shell: state, screen stack, overlay, input, scaling
     ├─ src/core/**         theme, rng, i18n, draw, ui, strings, save, audio
     ├─ src/alphabet/**     pure domain: types, bag, pool, rules, trace
     ├─ src/content/**      authored data: tuning, blueprints, enemies, rules,
     │                      encounters, kits
     ├─ src/battle/**       simulation: types, battle
     ├─ src/run/**          meta-loop: run, rewards
     ├─ src/render/**       arena, fx
     └─ src/ui/**           battleHud + screens/*
```

## Layer contract (enforced by review, not tooling)

| Layer | May depend on | Must never |
| --- | --- | --- |
| `core` | nothing (leaf) | know about the game |
| `alphabet` | `core/rng`, `core/theme` tokens | touch canvas, DOM, wall-clock timers |
| `content` | `alphabet/types`, `core/theme` | contain logic branches |
| `battle` | `alphabet`, `content`, `core/rng` | read render/UI state |
| `run` | `battle`, `content`, `alphabet` | draw anything |
| `render`, `ui` | everything read-only | mutate the simulation |
| `app` | all of the above | contain balance numbers |

This is what makes the headless harness possible: `tools/harness.ts` imports
`app`, `run` and `battle` in Node with no DOM, steps the simulation, and renders
to a `@napi-rs/canvas` surface using the exact same draw code the browser runs.

## Determinism

- `src/core/rng.ts` — small, explicit PRNG with named streams (`mint(name, seed)`).
- A behaviour that needs randomness takes its own stream. Sharing a stream
  couples two systems' futures and breaks reproduction.
- `Battle.update(dt)` is the only clock. Bag draws, spawn schedules, fuses and
  chain windows are all expressed in simulation seconds, so 60 FPS, 120 FPS and
  the harness's fixed 1/120 step produce identical outcomes.
- Bag draws are **cycle-based**: a shuffled order is materialised, then consumed.
  This keeps "what is left in the bag" a stable, displayable quantity while
  staying reproducible.

## Rendering

`src/core/draw.ts` provides the primitives: `rr` (rounded rect), `well`, `plate`,
`tile`, `label`, `measure`, `alpha`, `glow`, `rgba`. Everything is drawn with
plain Canvas 2D calls — no sprite pipeline, no shader, no compositing tricks
beyond `globalAlpha` and gradients. The 2.5D arena is five bands of floor with
gradient shading, contact shadows, and a haze layer; depth is faked by
per-lane scale and vertical offset, which keeps object hit logic on a single
axis.

Text is drawn with two merged font families shipped in `public/fonts/`
(`ar-*` headings, `jb-*` mono) whose subsets include full Vietnamese diacritics.

## Internationalisation

`src/core/i18n.ts` holds `t()`/`loc()`/`setLang()`; `src/core/strings.ts` holds
the HUD dictionary (`viStrings`, `enStrings`) behind the reactive `H` proxy.
Every UI string is translatable. **Recipe words are not** — `BOMB` is a gameplay
token and stays Latin in every locale. Vietnamese is the default language.

## Save

`src/core/save.ts` — versioned localStorage document: language, audio, comfort
settings, codex discoveries, best chain, and a suspended run snapshot.
Migration is version-gated; unknown newer versions are ignored rather than
corrupted.

## Verification harness

`tools/harness.ts` + `tools/shoot.mjs` (esbuild bundle → Node + `@napi-rs/canvas`):

```bash
node tools/shoot.mjs shot battle out.png --seconds=9 --seed=42 --kit=hunter \
     [--overlay=pause] [--click=hud.wild]
node tools/shoot.mjs sim --runs=10 --kit=assembly [--seed=1] [--verbose]
```

`shot` drives the real `App` through a scripted pointer path and writes a PNG.
`sim` runs whole runs with a naive first-offer policy and prints the balance
report. This is the project's regression tool for both looks and numbers, and it
works in an environment with no GPU and no browser.

## Performance notes

- Allocation is avoided in the hot path: telemetry, FX and HUD reuse pooled
  arrays and primitive fields rather than creating closures per frame.
- `Trace` and `Telemetry` are gated, so instrumentation can be shipped live and
  switched on with `?debug=1`.
- The canvas is one draw pass per frame; there is no offscreen buffer churn.
