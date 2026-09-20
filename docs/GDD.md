# GDD — Game Design Document

## 1. Battlefield

A single shallow lane viewed from the side, with 2.5D depth bands so objects can
layer in front of or behind one another. The core (your machine) sits at
`x ≈ 176`. Everything arrives from the right. Reference resolution 1920×1080,
minimum 1280×720; the playfield scales, the HUD geometry is authored at
reference size and scaled uniformly.

Three lanes of depth:

| Lane | `laneFloor` | Used for |
| --- | --- | --- |
| back | 372 | long-range devices, some flyers |
| mid | 464 | default spawn lane |
| front | 556 | ground traffic, contact objects |

## 2. Letter economy

Two containers, one flow:

- **Bag** — a shuffled cycle of the player's letters. Draws pop one letter every
  `drawInterval` and send it to the pool. When the bag empties it reshuffles
  with a visible animation: a new cycle begins.
- **Pool** — the shared, visible supply of available letters. Recipe tiles fill
  from it. Killing enemies adds letters to it directly.

A cycle boundary is a *systemic event*, not bookkeeping: it resets the cascade
window's history and is the trigger for several Machine Rules.

## 3. Blueprints and crafting

A blueprint is a fixed recipe (`BOMB` = `B`,`O`,`M`,`B`) plus a physical
behaviour and a **concurrency limit**.

- You equip exactly **three** blueprints for a run.
- A recipe completes the instant the pool can cover it, in pool order — the
  player shapes *which* words complete by choosing what to spend letters on and
  what to leave alone.
- **Wildcard `?`** substitutes exactly one missing letter. One charge per
  encounter. The HUD names the exact word and missing letter it would fill, so
  the intervention is never a guess.
- Each blueprint carries a **limit** (BOMB 4, FIRE 2, BEE 4, WALL 4, FAN 3,
  OIL 2, MINE 3, SAW 2, WEB 2, ICE 2). This is not a balance knob for DPS; it is
  what stops a defensive build from stalling an encounter forever, and it makes
  "spend letters or wait" a real decision.

### Catalog

| Blueprint | Recipe | Behaviour | Limit |
| --- | --- | --- | --- |
| BOMB | B O M B | Rolls forward, detonates on contact or after fuse | 4 |
| FIRE | F I R E | Persistent burn zone | 2 |
| BEE | B E E | Homing striker, retargets | 4 |
| WALL | W A L L | Structure, blocks ground movement | 4 |
| FAN | F A N | Pushes enemies back continuously | 3 |
| OIL | O I L | Slick: enemies on it move slower and burn harder | 2 |
| MINE | M I N E | Armed mine, heavy damage, stationary | 3 |
| SAW | S A W | Fast saw, shreds swarms | 2 |
| WEB | W E B | Slows and pins a cluster | 2 |
| ICE | I C E | Slows, embrittles targets | 2 |

## 4. Enemies and the letter-carrier rule

Every enemy is an economic object. Some carry letters, shown on the body as a
tile badge before they die, and released on death.

- **Mote** (`#c3cee6`, 14 hp, fast) — the baseline pressure.
- **Runner** (`#ffd166`, 18 hp, very fast) — punishes slow readers.
- **Flyer** (`#b98cff`, 26 hp, 190) — the carrier archetype; crosses over walls.
- **Brute** (`#ff6b5e`, 108 hp, slow) — pushes through structures, big target.
- **Boss: The Silencer** (`#ff8552`, 420 hp) — spawns escorts, ends the run.

Guaranteed letters and unknown carriers are authored per encounter, so the pool
is never starved of the letters a build actually needs.

## 5. Cascades

Completing a craft within `chainWindow` (and without a bag-cycle reset) extends
the chain. The chain is displayed prominently with escalation colour and pulse.
Observed depths in the balance harness: mean 3.2–4.4, maximum 15.

The chain is not a multiplier bolted on top — it is the player's read on whether
the machine is currently feeding itself.

## 6. Failure and pacing

- **Core health** is the run's life. Enemies that reach it deal arrival damage.
- **Breach guard.** If waves are finished and nothing has died for
  `stallSeconds`, a countdown appears; at zero every surviving enemy deals its
  full arrival damage and dies, dropping nothing. Losing letters hurts more than
  losing health, and it is always visible before it lands.
- **Repair** is a reward option (34 hp cap, offered when the core is hurt).

## 7. Machine Rules

Rules rewrite the machine's behaviour, one per encounter from rewards: draw
order, duplicate letters, cycle triggers, wildcard refunds, cascade extension.
They are authored in `src/content/rules.ts` against explicit hooks in
`src/alphabet/rules.ts`, so a new rule is content, not code.

## 8. Run structure

4 chapters, 8 encounters, `src/content/encounters.ts`. Chapters escalate via
`chapterScale` (hp ×1.15, speed ×1.05 per chapter) plus authored composition.
Between encounters: one reward from three offers (bag change, Machine Rule,
blueprint, or repair).

## 9. Feel targets

- Word completion is a three-beat animation (gather → lock → emerge) that must
  never be shortened for throughput.
- Kill feedback is a burst + ring; high chains add another tier.
- Every informative colour has a non-colour redundancy (shape, badge, label).
