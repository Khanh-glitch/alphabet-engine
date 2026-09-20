# ASSETS

## Approach: everything is drawn or generated

There are **no image assets** in this project. Every visual is produced by code
at runtime: terrain bands, the core, enemies, devices, particles, the HUD. This
was a deliberate consequence of the environment (see `DECISIONS.md` D-001) and it
has a real upside: nothing to load, nothing to lose sync with, and the whole
visual language is in one place (`src/core/theme.ts`, `src/core/draw.ts`).

## Files that do exist

| Path | What | Why |
| --- | --- | --- |
| `public/fonts/ar-500.woff2` | Heading family, medium | UI headings, numbers |
| `public/fonts/ar-600.woff2` | Heading family, semibold | labels |
| `public/fonts/ar-700.woff2` | Heading family, bold | titles |
| `public/fonts/ar-800.woff2` | Heading family, extra bold | emphasis |
| `public/fonts/jb-500.woff2` | Mono, medium | recipe letters, counters |
| `public/fonts/jb-700.woff2` | Mono, bold | tile glyphs |

The subsets were merged from Latin and Vietnamese-extended font sources into
single `woff2` files, so every diacritic the Vietnamese UI needs renders without
a fallback font (fallback would change metrics mid-word and break layout).

## Palette

Colour tokens live in `src/core/theme.ts` (`C`). Rules:

- Background and chrome are near-black navy (`#05070e` family) so gameplay
  objects and letters carry all the luminance.
- Each blueprint has a hue (`BP_COLOR`): BOMB red-orange, FIRE amber, BEE
  yellow, WALL steel, FAN cyan, OIL olive, MINE rust, SAW pale, WEB violet, ICE
  ice-blue.
- Each enemy has an authored colour (mote `#c3cee6`, runner `#ffd166`, flyer
  `#b98cff`, brute `#ff6b5e`, boss `#ff8552`).
- Feedback states reuse gold (chain / count) and cyan (information), never
  interchangeably.

## Layers and depth

The arena fakes 2.5D with five floor bands, per-band gradient shading, contact
shadows under every object, and a haze pass. Objects are scaled and offset by
their lane, which keeps collision on one axis while reading as depth.

## Audio

`src/core/audio.ts` synthesises every sound with the WebAudio API — letters
plucking into the pool, tiles locking, the craft emerging, kills, chain
escalation, breach alarm, UI clicks. No audio files.

**Why synthesis:** it keeps the repository free of binaries, and the sounds are
short UI events where a synthetic pitch mapped to state (chain depth → pitch) is
more informative than a recorded sample.

## Font licensing note

The font families were taken from open-source npm packages
(`@fontsource/*` distributions) and subsetted for this project. Their licences
are open (SIL OFL for the families used); a redistribution audit is advisable
before any public release of the built `dist/`.

## What is intentionally absent

- No sprite sheets, no atlas pipeline, no shader effects.
- No UI textures or nine-slice assets — panels are drawn with rounded-rect
  primitives and gradients.
- No placeholder art of any kind. If something is not drawn, it does not appear.
