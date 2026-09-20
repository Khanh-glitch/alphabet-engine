# PRODUCT

## The promise

**Alphabet Engine** is a systemic roguelite autobattler in which letters assemble
themselves into words, and words materialise as literal physical instruments of
war. You do not fire the bomb. You assemble `B`, `O`, `M`, `B` and a bomb rolls
onto the field, detonates, and scatters its own letters back into your pool so
the next word can be built faster.

The mantra: **Build the alphabet. Let it manufacture war.**

## The core loop

```
letters enter the pool → you complete a word → the word becomes an object
→ the object kills → the kill releases letters → the pool is richer
→ the next word comes sooner → the chain accelerates
```

That last arrow is the entire game. Everything upstream of it — a bag that
cycles, enemies that carry letters visibly, rules that rewrite draw order —
exists to shape how fast and how violently that arrow can turn.

## Design pillars

1. **Manufacturing as combat.** Damage is a side effect of assembly. The player's
   skill is in reading the pool and deciding which word is one letter away.
2. **The word is the weapon.** `WALL` is a wall. `BEE` is a bee that hunts. No
   abstract stat sticks wearing a word costume.
3. **Anticipation is the pleasure.** An enemy carrying the `E` you need must be
   visibly carrying it before you decide to kill it. The brief's "readable
   anticipation" is a build target, not a vibe.
4. **Small interventions, large consequences.** One `?` per encounter. The
   cascade does the rest.
5. **Escalation, not inflation.** Machine Rules change how the machine thinks.
   A rule that says "+5% damage" is a bug.

## Who plays it, and what a session looks like

A player who likes Balatro-style compounding and Vampire-Survivors-style
automatic combat. A session is one run: 8 encounters across 4 chapters,
25–35 minutes, ending in either The Silencer collapsing or the core failing.

Decision texture per encounter:

- ~7 crafts, each a 1-second decision: take the immediate kill or hold for a
  bigger word.
- 1 wildcard decision: guaranteed to matter, rationed to once per encounter.
- 1 reward choice between encounters, from a bag / rule / blueprint pool.

## What the player never does

- Type a word. Search a dictionary. Play Scrabble.
- Read a number they could not have anticipated.
- Lose to a dice roll they could not have shaped.
- Manage more than three things at a time.

## Success criteria

| Criterion | Target | Measured |
| --- | --- | --- |
| First craft after encounter start | 2–4 s | 2.9–4.7 s mean by kit |
| Encounter length | 8–15 s | 13–18 s (above target; see BALANCE) |
| Reward decision time | 10–25 s | not instrumented |
| Cascade depth | 2 common, 3 exciting, 4+ uncommon | mean 3.2–4.4, max 15 |
| Frames | 60 FPS at 1920×1080 | canvas is a single layered draw pass; see ARCHITECTURE |
| Run completion with a naive player | rare | 1/10 runs |

## Out of scope (deliberately)

Branching maps, meta currencies and unlock trees, multiple active abilities,
manual aiming, free-text input, multiplayer, accounts, networking, monetisation.
Rationale for each is in `DECISIONS.md`.
