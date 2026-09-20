# CHANGELOG_DEV

Development changelog in reverse-chronological order. Player-facing changes are
described in terms of behaviour; internal notes say *why*.

---

## Unreleased — clarity and presentation pass

### Added

- **A "how to play" panel** (`src/ui/screens/howto.ts`), shown automatically
  before a player's first decision and reopenable from the title screen and from
  a `?` button in the battle controls. It states the four things this game cannot
  assume — letters arrive on their own, full recipes craft themselves, carriers
  are the ammunition, the wildcard is the only in-combat decision — plus the goal
  (keep the CORE intact for eight fights). Each step is illustrated with the
  game's own letterpress primitives.
- **Anchored teaching hints.** The single hint line now points at the panel it is
  describing: a gold ring and halo around the recipe cards, the pool tray, the
  wildcard plate, or the carriers, depending on what the lesson is about.
- **A living factory behind the arena.** The back wall is now a four-layer
  letterpress line — gantries, a hopper of raw stock, a conveyor of finished
  tiles, glowing pipework with a travelling pulse, and a slow gear train — so the
  space reads as somewhere the letters are actually made instead of as empty
  darkness.
- **A contact-shadow, rim-light and focus pass.** Units are lit from above,
  sit on soft radial shadow pools at their feet, and the scene is graded so the
  play band keeps the contrast while the wall recedes.
- **`npm test`** — 17 domain regression tests over the alphabet economy, kit
  authoring, craft conservation, determinism and the stall guard.

### Fixed

- **The wildcard panel's detail line ran off the plate and under its own charge
  counter** ("Chưa công thức nào thiếu 1 chữ" + "1" overlapped at the right edge).
  Panel text is now measured and clipped to a width that stops short of the
  counter, and the copy is short enough to fit without truncation.
- **Enemies read as grey UI pills.** `MOTE` and friends are drawn as machines
  with legs, carapaces, lenses, antennae, treads and rim light, and face the
  direction they travel.
- **Carriers showed an empty dashed slot** until their letter was announced,
  which read as a placeholder rather than as undisclosed cargo. Unannounced
  carriers now show a sealed, stamped tile face.
- **Contact shadows were drawn 12 px below the feet** as hard ellipses, so every
  unit looked like it was floating above a puddle.
- **The core was a plain rounded square.** It is now a reactor: plinth with
  hazard stripes, bolted faceplate, turning iris, flanks that vent on the pulse,
  pumping pistons and an exhaust stack.
- **Sixteen UI strings were Vietnamese-only**, so the English toggle showed a
  half-translated screen. All of them now resolve through i18n, including the
  `⚠ LÕI NGUY HIỂM` warning, the title legend, kit labels, seed prompt, spoils
  section headers and the pause screen's kit name.
- **Recipe cards printed `BBOM`** for BOMB. Recipes now spell their word; the
  tile row and the card title agree, so the word reads as a word.
- **Structures could stall an encounter forever.** A defensive build (WALL/FAN)
  produced 131-second fights with over 1,000 crafts. Fixed with per-blueprint
  concurrency limits plus a visible breach countdown (see D-004, D-005).
- **Bastion was unwinnable by construction** — its bag had no `E`, so `MINE`
  could never be crafted. Bag authored against all three recipes.
- **HUD tray count badges overlapped the letter glyphs**; badges moved clear of
  the tile face.
- **Bag contents strip clipped at the well edge** and duplicated information the
  cycle counter already carried; removed in favour of the cycle bar.
- **Recipe deficit read `cần B B`**; now a counted multiset (`thiếu B ×2`).
- **Wildcard panel wrapped to two lines** and collided with its own detail text;
  relaid out so the word and the missing letter sit on one line.
- **Card "needs …" hints collided with craft counters**; the hint is now
  suppressed when the counter would overlap it.
- **Codex text ran under the letter tiles**; moved to a dedicated text column
  with three-line wrap.
- **Kit screen overlapped and clipped** its own descriptions; a `wrapText` helper
  and a 32 px bag row fixed it, and the back button moved out of the content.
- **Settings slider track was mis-scaled** against its number column.
- **Summary had no per-blueprint contribution**; added craft-share bars.
- **Title screen had dead space**; demo moved into the composition, buttons
  raised, faint base grid added.
- Harness `sim` reported `lowest core %` as always-zero because it included the
  fight that ended the run. It now reports the **closest win** — the number that
  actually describes tension.

### Changed

- **Arena geometry is deeper and played closer to the camera.** The floor plane
  now starts at y=300 (was 372), the near lane sits at y=574 (was 556) and lanes
  are 50 px apart (was 42), so the play band owns the frame instead of the
  scenery. Units are drawn 1.35× larger; the simulation's collision `size` is
  deliberately untouched.
- **The cascade pop-up moved into the play band** (it was floating in the dark
  wall region where it read as a stray artefact).
- **English no longer needs a second pass.** `docs/UX_UI.md` still governs; the
  rule that word recipes stay identical in every language is intact.

- Enemy speeds roughly doubled and the bag shortened so the pulse of the game is
  a craft every few seconds rather than a slow trickle.
- Combat values raised across the board (bomb 88 dmg / 2.6 s fuse with contact
  detonation, fire 29 dps, oil 44 dps, bee 230 speed, mine 96, saw 185).
- Wave timestamps pulled in ~22 % to shorten encounters.
- Chain window tightened to 2.2 s and tied to bag cycles: a fresh cycle ends the
  current cascade.
- Repair reward added (34 hp cap) so "I am losing" has an answer that is not
  restarting.
- Blueprint offers now draw from *all* non-equipped blueprints, so a run can
  change identity mid-way.
- Rewards track `craftsByBlueprint`, and `leastUsedSlot()` uses it for real.
- Arena rebuilt as a 2.5D depth floor with five bands, contact shadows and haze.
- FX pass: kill bursts and rings enlarged; mote redrawn with gradient body,
  visor and eyes.
- Overview/kit/codex/settings/summary screens rebuilt for the clarity pass.

### Added

- `tools/harness.ts` + `tools/shoot.mjs` — headless screenshot and balance-sim
  harness driving the real game code in Node.
- `Telemetry` and gated `Trace` for attribution, surfaced via `?debug=1`.
- `H.needs` and the multiset deficit display.
- Repair reward rendering.
- Encounter `openingPool` so chapter 1 can teach by composition.
- Vietnamese-first string dictionary (`src/core/strings.ts`) plus full
  diacritic font subsets.

### Removed

- Debug and meta text from all player-visible screens: no version strings, no
  build tags, no explanatory prose the HUD already communicates.
- The prototype's drag-a-word-from-a-rack control model (see the audit table in
  `PROGRESS.md`).

---

## Prototype checkpoint (preserved in git history)

The repository arrived with ~9,100 lines of an earlier browser prototype: a
Scrabble-rack lane defence with word-dragging and a damage combo counter. It was
committed verbatim before any rebuild so nothing was lost, and its control model
was replaced rather than extended:

- free-form dictionary word search → curated blueprints,
- rack refreshed between fights → bag feeding a shared pool during combat,
- generic loot after combat → visible letter carriers during combat,
- several abilities bound to a flux resource → one wildcard `?`.
