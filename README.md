# Alphabet Engine

A systemic roguelite autobattler where letters form words, words become physical weapons, and combat creates self-feeding cascades.

Playable in the browser: `npm install && npm run dev`.

---

## What it is

You are the last operator of a broken machine that turns language into force. Each
wave you draw a rack of letters, spell real words out of them, and mount each word
as a weapon on a lane. The enemy walks down that lane. Anything with a word aimed
at it does not get far.

Three systems feed each other, which is the whole point:

| System | What it does |
| --- | --- |
| **Letter polarity** | Soft letters (`a e i o u l m n r s t`) make a word `CHARGED`: its hits mark targets, and marked targets take +16% damage from *everything*. Hard letters (`b c d f g h j k p q v w x y z`) make a word `CORRODED`: its hits strip 30% of enemy armour. A word that uses both does both. |
| **Cascades** | Kills in quick succession raise a cascade level. Every level adds +8% damage to all weapons, erupts a shockwave around the kill, and pays charge back into the engine. Cascades are the reason a fast, cheap word is worth forging next to a nine-letter hammer. |
| **The flux engine** | Kills and cascades fill a charge meter that grants up to +80% weapon damage. You can spend that charge on **Purge** (screen-wide damage) or **Overdrive** (+60% fire rate) - or hold it and keep the passive multiplier. |

## How words become weapons

A forged word's power comes from four stacked layers, all of them visible on the
weapon card before you commit:

1. **Letters and length.** Letter values (q, z, x, j, k are worth the most) and word
   length set raw damage, attack rate and range. Nine letters hit roughly six times
   harder than three.
2. **Keyword family.** A themed word inside the word picks the firing pattern:
   `BLAST` (arcing shells), `CHILL` (slowing frost), `CHAIN` (arcs between enemies),
   `PIERCE` (line shots), `HEAVY` (knockback and stun), `SWIFT` (rapid fire), `SPLIT`
   (fan of shots). `thunder` reads BLAST because *thunder* is the longest keyword it
   contains.
3. **Special letters.** b, c, d, f, g, h, j, k, m, p, q, s, v, w, x, y and z each bolt a
   named bonus onto the weapon - Bane, Crux, Deft, Jitter, Quarry, Yield and so on.
4. **Polarity.** As above: charge, corrode, or both.

Mounted weapons also cover the lanes next to them at 65% range, so a thin line is
never completely open.

## Run structure

`Forge` -> `Battle` -> `Spoils` (choose next node) -> back to `Forge`.

Node types: Front, Elite Front, Market, Shrine, Repair Bay, Supply Drop. Market buys
letters, mount rails, core plating, engine tuning and forge heat. Shrines grant one
permanent blessing from thirteen. Every fifth wave is a boss with a health bar that
enrages below half.

Waves have a threat budget, and the enemy roster opens up as the run goes: motes,
drones, zappers (slow-immune), weavers (pulse a slow field over your guns),
phantoms (phase through non-piercing shots), brutes (armoured, knockback-resistant)
and wardens (shield nearby allies).

## Controls

- Mouse for everything. Type directly to pick letters (`thunder`), `Backspace` to
  undo, `Enter` to mount in the best lane, `1`-`3` to pick a node or blessing.
- In battle: `Space` pause, `F` speed, `1` Purge, `2` Overdrive.
- Runs are seeded. Set a seed on the title screen, or copy the summary to share one.

## Tech

TypeScript and a single Canvas 2D surface, fixed 1440x810 logical space letterboxed
to the window, no runtime dependencies. All art is drawn in code; all sound is
synthesised with the Web Audio API; both fonts are vendored locally so the game runs
offline. The dictionary (155k words, 3-9 letters, profanity filtered) and the
familiar-word list are generated once by `tools/build-dict.mjs` into front-coded
strings, which keeps ~1.6 MB of word data in about 336 kB gzipped.

```
npm run dev        # vite dev server
npm run build      # typecheck + production build
npm run typecheck  # tsc only
node tools/build-dict.mjs   # regenerate src/data from the word lists
```

## Repo layout

```
src/core/      rng, canvas drawing primitives, procedural audio
src/game/      dictionary, forge rules, enemy roster, waves, battle simulation, run state
src/ui/        widget kit, domain tiles, and one file per screen
src/data/      generated word data
tools/         dictionary generator
```
