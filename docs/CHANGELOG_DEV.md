# CHANGELOG_DEV

Development changelog in reverse-chronological order. Player-facing changes are
described in terms of behaviour; internal notes say *why*.

---

## Unreleased — clarity and presentation pass

### Fixed

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
