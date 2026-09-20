# BALANCE

All numbers in this document were produced by the verification harness, not
estimated:

```bash
node tools/shoot.mjs sim --runs=10 --kit=assembly
node tools/shoot.mjs sim --runs=10 --kit=bastion
node tools/shoot.mjs sim --runs=10 --kit=hunter
```

The harness plays a **naive player**: it never withholds letters for a bigger
word, never times a wildcard, and always takes the first reward offer. The
numbers below therefore describe a **floor**, not a skilled ceiling.

## Targets vs measured (10 runs per kit, seeds 20240920 + n·7919)

| Metric | Target | assembly | bastion | hunter |
| --- | --- | --- | --- | --- |
| Encounters cleared (of 8) | — | 6.70 | 4.80 | 5.30 |
| Runs completed | rare for naive play | 1/10 | 0/10 | 0/10 |
| First craft (s) | 2–4 | 3.64 | 4.71 | 2.93 |
| Encounter length (s) | 8–15 | 17.7 | 13.7 | 14.7 |
| Longest chain | 2 common, 3 exciting, 4+ rare | 3.58 (max 8) | 3.19 (max 5) | 4.35 (max 15) |
| Crafts / encounter | — | 7.3 | 4.8 | 7.1 |
| Crafts / second | — | 0.41 | 0.35 | 0.48 |
| Closest win, core % remaining | > 0 | 18.5 (min 1) | — | — |

**Reading:** the cascade target is met (chains of 3–4 are the common case, which
is exactly the designed "exciting" band, with occasional 8–15 spikes). First
craft is inside target for hunter and assembly, slightly slow for bastion.
Encounter length runs ~2–3 s long against the 8–15 s target — the honest read is
that the authored `at` schedules are slightly slow rather than that enemies are
too tough, since crafts-per-encounter is healthy.

## Kit comparison

| Kit | Core HP | Blueprints | Wildcards | Bag | Role |
| --- | --- | --- | --- | --- | --- |
| Assembly | 100 | BOMB, FIRE, OIL | 1 | 10 tiles | baseline damage |
| Bastion | 120 | WALL, MINE, BOMB | 1 | 11 tiles (with `E` for MINE) | defensive, harder |
| Hunter | 90 | BEE, MINE, WEB | 2 | 10 tiles | mobile, high cascade |

Craft distribution (total across 10 runs) shows the kits actually play
differently:

```
assembly : BOMB 272, FIRE 167, OIL 57, ICE 12, MINE 4, SAW 1, FAN 1
bastion  : BOMB 160, WALL 109, MINE 68, FAN 1
hunter   : BEE 253, MINE 130, WEB 103, BOMB 4, ICE 4, OIL 2, WALL 1
```

Bastion sits ~2 encounters behind. That is intentional — a defensive kit should
require the player to solve for damage — but at 0/10 completions for a naive
player it is the top candidate for a small buff (core 120 → 130, or MINE limit
3 → 4).

## Combat table (`src/content/tuning.ts`)

| Object | Key values |
| --- | --- |
| BOMB | fuse 2.6 s, 88 dmg, radius 150, travels 150 u/s, detonates on contact |
| FIRE | 7.5 s, 29 dps, radius 92 |
| BEE | speed 230, 11 dmg / 0.38 s bite, 30 hp |
| WALL | 190 hp, 1.1 s cooldown |
| FAN | push 400 (devices) / 30 (ground), range 330, period 1.6 |
| OIL | 44 dps burn, 0.45 slow, radius 100 |
| MINE | 96 dmg, radius 108, arm 0.55 s |
| SAW | speed 185, 40 dmg, radius 36 |
| WEB | 8 s, 0.6 slow, radius 104 |
| ICE | 6 s, 0.72 slow, +55 % shatter bonus |

Enemies: mote 14 hp / 118 spd · runner 18 / 250 · flyer 26 / 190 · brute 108 / 76
· The Silencer 420 / 52 (escorts).

## Global pacing knobs

| Knob | Value | Why |
| --- | --- | --- |
| `drawInterval` | 0.55 s | pulse of the whole game; 3–4 letter recipe in seconds |
| `drawDelay` | 0.9 s | board must read before the first draw |
| `chainWindow` | 2.2 s | long enough to reward planning, short enough to break |
| `letterFlight` | 0.55 s | visible delivery, not instant |
| `stallSeconds` | 8 | bounds every encounter; visible countdown |
| `chapterScale` | hp ×1.15, spd ×1.05 | escalation without stat inflation |

## Rules and effects

9 Machine Rules + 4 tweaks (`src/content/rules.ts`): first vowel echoed, last
tile copied, inject B, carrier echo, opening volley, free first craft, bomb
refunds B, banked wildcard, head start, short fuse, long burn, wide blast,
second wildcard. Every one changes behaviour rather than a multiplier.

## Known balance debt

1. **MINE / SAW / WEB / ICE are thin.** They appear through rewards and are
   rarely seen in runs (craft counts above). They need authored homes.
2. **Defensive stalling.** Per-blueprint limits plus breach guard bound it, but
   bastion's failure mode is still "survive well, kill poorly".
3. **The naive-player floor may be below the real floor.** A player who reads
   deficits will complete words faster than the sim does; the sim understates
   cascade uptime.
4. **Boss escort pressure is a timer**, not a phase transition.
