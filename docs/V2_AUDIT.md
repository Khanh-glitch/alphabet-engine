# V2 Gameplay Audit

Written after phases V2.1–V2.6. Every number here comes from running the build,
not from reading it. Where something was not measured, it says so.

Baseline for comparison: `docs/V2_BASELINE.md` (V1, commit `e325e82`).

---

## 0. The one-line verdict

The four mechanics the rework was about now exist, are visible, and are
measurably not decorative — **except Focus on one kit, where it is measurably
decorative and I could not fix it without doing phase V2.9**. The cascade is now
causal, and the real number is *healthier* than the fake V1 number it replaces.

---

## 1. What changed in the playable combat

| | V1 | V2 |
| --- | --- | --- |
| Where a letter goes | invisible shared pool | a specific visible socket |
| How a word completes | a resolver scans the pool | the last socket fills |
| Chain | 2.2 s timing window | provenance graph, causal ancestry |
| Player input | wildcard only | Focus + Mark + wildcard |
| Letter animation | one system, flying to the old tray | one system, flying to the actual socket |

Two V1 letter-animation systems were found running in parallel (`fx.ts` flew
recovered letters to a tray that no longer exists). Deleted rather than disabled.

---

## 2. Passive bot vs steering bot

6 encounters × 6 seeds, hunter kit. The steering bot re-focuses toward whichever
recipe is closest to complete and marks carriers whose letter an open socket
wants.

| | passive | steering | change |
| --- | --- | --- | --- |
| crafts | 38.7 | **50.5** | **+30.5%** |
| letters recovered | 43.8 | 44.2 | ~flat |
| kills | 114.8 | 105.2 | −8% |
| core damage taken | 238.0 | 236.5 | ~flat |
| marks placed | 0 | 74.2 | — |
| marked-target kills | 0 | 34.3 | — |

Brief test B says a 0–2% gap would mean Focus and Mark are decorative. **30.5% is
not decorative.**

The most interesting number is the flat one. Steering does **not** create
letters — it routes the same letters into complete recipes instead of scattering
them. That is exactly what the mechanic is supposed to do, and it is the first
evidence that the design's central claim holds.

The honest counterpoint: **more crafts did not become more kills or less core
damage.** Focus currently buys throughput, not survival. I do not have an
explanation I trust yet; the likeliest candidate is that the bot optimises for
"closest to complete" rather than "most useful", which is a bot limitation rather
than proof the mechanic is hollow. This needs a human playtest before I would
claim either way.

---

## 3. Focus

| kit | contested per encounter | Focus won | fallback | switches |
| --- | --- | --- | --- | --- |
| assembly | 4.16 | 76 | 111 | 0 |
| **bastion** | **1.83** | **0** | 55 | 0 |
| hunter | 13.41 | 391 | 38 | 0 |

`contested` = a letter that more than one equipped recipe could take.
`fallback` = a contested letter where Focus was ineligible, so slot order decided.
`switches` is 0 because the harness bot never moves Focus — only the steering bot does.

### The finding that matters

**On bastion, Focus wins literally nothing.** Its three recipes are
WALL (W,A,L,L), MINE (M,I,N,E) and BOMB (B,O,M,B). WALL shares no letter with
either other recipe, so whenever a letter is contested — that is, `M` — the
focused word is WALL and it is ineligible. Every contested letter falls through to
the fallback. Focus on that kit is a control that does nothing.

Assembly and hunter are fine; hunter is genuinely rich at 13.4 contested per
encounter.

This is not a bug in the Focus implementation. It is the kits not being authored
for it. The brief anticipated exactly this and prescribes the fix in §3.10: a V2
test kit with BOMB/BEE/WALL and a bag built so **B is contested by design**.
That is phase V2.9 work, and I stopped short of it rather than rewrite the
starting kits unasked.

**Consequence for the reader:** if you playtest bastion and conclude Focus does
nothing, you are right, and the reason is the kit, not the mechanic.

---

## 4. True causal cascade

Depth distribution across 6 encounters × 6 seeds:

| depth | assembly | bastion | hunter |
| --- | --- | --- | --- |
| 1 (bag only) | 55% | 63% | 69% |
| 2 | 35% | 28% | 28% |
| 3 | 10% | 8% | 3% |
| 4+ | 1% | 1% | 0% |
| **max observed** | **5** | **4** | **3** |
| crafts fed by combat | 49% | 37% | 31% |

The brief's tuning direction: chain 2 common, chain 3 exciting and noticeable,
chain 4+ uncommon. **The measured distribution matches that almost exactly**, and
roughly a third to a half of all crafts are fed by letters that came out of a
fight rather than the bag.

### Why the V1 number was meaningless

V1 reported "longest chain 2.20" for bastion. V2 reports max causal depth 4 for
the same kit. These are not the same measurement, and the V1 one was wrong: it
counted two crafts as a cascade if they landed within 2.2 seconds, regardless of
whether either caused the other.

The decisive evidence: when causal depth was first implemented, it reported
**depth 1 for all 207 crafts** across 4 runs while 35 enemy letters completed
recipes. That is not "no cascades" — that is a broken measurement, and finding it
required instrumenting rather than reasoning. The bug was that every node
inherited its parent's depth, so a bag-only craft stored depth 0, the letter it
released also carried 0, and the chain could never grow. Only crafts advance
depth.

---

## 5. Mark

Mark is implemented and measurably active: the steering bot placed 74.2 marks and
scored 34.3 marked-target kills per 6-encounter run. BEE's priority order is now
the brief's §9.2 order.

But I have **not** proven Mark independently changes outcomes, because the
steering bot changes Focus and Mark at the same time. Isolating Mark needs a third
bot that steers Focus but never marks. I am flagging this as unmeasured rather
than claiming a result I did not isolate.

The naive harness bot places zero marks, so the standard `sim` output shows
`marks=0` — that is the bot, not the mechanic.

---

## 6. Wildcard

Functionally correct and now tactile: it resolves a **specific socket**, travels
there visibly, and carries its own provenance node. The intro inconsistency the
brief calls out is fixed — it used to render as available during the intro and
then refuse to act.

Usage is **0 in every simulation**, because no scripted bot uses it. So I can
report that it works and looks right, but not that it is well-tuned. Reserve
overflow (below) suggests there is real demand for it that the bots never exploit.

---

## 7. Letters wasted

| kit | reserve overflow (letters discarded) |
| --- | --- |
| assembly | 180 |
| bastion | 61 |
| hunter | 189 |

The reserve holds 5 and then starts discarding. This is by design (§3.1.2), and
the pips make it visible, but ~5 letters per encounter thrown away is a lot, and
it is the strongest signal that either the reserve cap or the bags need work. It
also means a human who uses wildcards actively has a real lever the bots ignore.

---

## 8. Pacing

| | assembly | bastion | hunter | V1 baseline | target |
| --- | --- | --- | --- | --- | --- |
| first craft (s) | 3.88 | 4.97 | 3.33 | 3.68 / 4.50 / 2.97 | 2–4 |
| encounter (s) | 16.55 | 16.39 | 15.71 | 16.17 / 16.48 / 16.48 | 8–15 |

Encounter length is essentially unchanged from V1 and still **9–11% over the 8–15 s
target**. First craft is inside target for assembly and hunter and ~1 s over for
bastion.

The brief warns against "60-second stretches where the player only watches a
solved engine". I cannot report on that: **dead-watch time was not measured.** I
added the field and never populated it. That is a gap, not a pass.

---

## 9. Things that exist but rarely matter

- **Focus on bastion** — 0 of 55 contested letters. Measured, real, explained in §3.
- **Wildcard** — works, never used by any bot; untested under real pressure.
- **Mark on the default harness bot** — never fired.
- **Reserve pips** — visible, but the overflow they warn about is frequent enough
  that the warning may as well be permanent on assembly and hunter.
- **`TUNE.reserveCap`** — set to 5 on the brief's hypothesis and never tested
  against alternatives. The brief explicitly says not to finalise it, so this is
  expected, not a defect.

---

## 10. Why the cascade now reads as causal

Beyond the numbers, three things make it legible in play, which is the brief's
test F:

1. A letter that descends from an earlier craft flies with a violet link ring and
   names the word whose weapon caused the kill.
2. Socket rows show exactly which position is empty, so "BOMB is missing its
   second B" is readable without counting — including BOMB's two B sockets at
   opposite ends of the word.
3. A craft cannot fire without a socket filling first, so every object on the
   field has a cause the player watched.

---

## 11. Not done

Neither started nor faked:

- **V2.7 Momentum** — not started. It depends on a cascade that is now correct,
  so it is ready to build, but I would not start it and leave it half-verified.
- **V2.8 Spatial simplification** (drop formal 5 lanes) — not started.
- **V2.9 Three authored test encounters** and the §3.10 test kit — **not started,
  and this is the biggest gap.** Without it, Focus is decorative on bastion, and
  the brief's test C cannot be satisfied on the shipped kits.
- **§3.6 hard object limits** — untouched. Limits still gate crafts.
- **§3.8–§3.9 content freeze** — all ten blueprints and all machine rules remain
  active. `SAW` continues to be barely used.
- **Balance** — unchanged in intent: encounter length, boss cadence and reward
  quality are all pre-V2.

---

## 12. What I would do next, in order

1. **V2.9 first, not V2.7.** The test kit is what makes Focus real, and Focus is
   the mechanic the whole rework is built around. Momentum on top of a kit where
   Focus does nothing would be building on sand.
2. Then a **third bot** that steers Focus but never marks, to isolate Mark.
3. Then **dead-watch telemetry**, so pacing claims rest on measurement.
4. Then V2.7 momentum, then V2.8.


---

# Addendum — after V2.9 (the evaluation set) and the bot tool

Recorded after building the three authored encounters, the V2 test kit, and
`tools/bots.ts` (`npm run bots`). This resolves two of the gaps §9 and §11 flagged.

## The test kit fixes Focus, and the brief's own bag was the problem

Replacing bastion with the three-word set turns Focus from a dead control into a
working one:

| | bastion | v2test |
| --- | --- | --- |
| contested letters per encounter | 1.83 | **7.06** |
| contested letters Focus actually won | **0** | **123** |
| fallback (Focus ineligible) | 55 | 4 |

But the brief's §3.10 hypothesis bag — `B B B / O / M / E E / W / A / L L` — is
the *worst* configuration tested for Focus. The bag covers every socket exactly
once, so whichever recipe a contested B goes to, all three still finish. Routing
cannot change the outcome because nothing is scarce.

Measured with `npm run bots`, 6 runs, steer vs passive:

| bag | crafts |
| --- | --- |
| `B B B` (brief hypothesis) | +1.4% |
| **`B B`** (shipped) | **+10.8%** |
| `B B` with M drawn last | +7.8% |

**Focus only matters when letters are scarce.** That is the design lesson, and it
is why the shipped bag drops to two B tiles: BOMB wants two of them, BEE wants
one, so the player cannot satisfy everything from the bag and must choose which
recipe finishes now and which waits for a carrier. The brief says to run
simulation before finalising the hypothesis, and the simulation rejected it.

`npm run bots` on the shipped configuration, 10 runs: **steer beats passive by
11.4% crafts and 10.5% less core damage.** Brief test B's 0–2% threshold for
"decorative" is comfortably cleared.

## Mark does not matter, and that is now isolated rather than suspected

`steer-nomark` is byte-identical to `steer` except it never marks, so the
difference between them is exactly the mark's contribution.

| | steer | steer-nomark | difference |
| --- | --- | --- | --- |
| crafts | 23.4 | 23.1 | +1.3% |
| letters recovered | 21.1 | 21.2 | −0.5% |
| kills | 49.2 | 50.2 | −2.0% |

Within noise, and slightly negative on kills.

A first attempt at this measurement was invalid and is worth recording: the bot
marked `needed[0]`, which is the *same* carrier BEE's own rule 2 already picks, so
it measured nothing. Re-running with the bot marking the needed carrier closest to
the core — a genuinely different choice — changed the result by 1.3%. The mark
really does not matter.

**Why:** BEE's priority rule 2 ("a carrier whose letter a recipe currently needs")
already finds a needed carrier without any player input. Choosing *among*
equally-needed carriers does not change what the machine receives. Mark is
redundant with a rule the brief specifies two sections earlier.

Per the brief's own test D — "if Mark rarely changes anything, remove or redesign
it" — this needs a decision, and every option changes the game's identity, so I
have not made it unilaterally:

1. **Narrow rule 2** so BEE does not seek needed carriers on its own; only a mark
   makes it hunt a specific one. Mark becomes the extraction tool the brief
   describes, at the cost of BEE being less useful unmarked.
2. **Add a second object that respects Mark** (the brief allows this: "future
   hunter/homing objects may respect Mark"), so the mark has a wider effect.
3. **Remove Mark** and keep the three mechanics that do work.

Mark is left implemented, tested and visible in the meantime. It is not harmful;
it is just currently free.

## Dead-watch time is measured, and it is not the problem

§8 flagged dead-watch as unmeasured. It is now instrumented.

**0.0–0.1% of fight time has an empty field** across all kits — 0.1 s in total.
Encounters do not have dead air. The over-length encounters are not caused by the
player watching nothing.

What the measurement did surface instead: **craft beats occupy 27–33% of fight
time.** At ~0.82 s per craft and ~7 crafts, roughly a third of every encounter is
the completion animation. That is the hero moment, so some of it is the point, and
combat continues underneath so it is not stalling — but a third is a lot, and the
brief's §4.3 says the beat must be re-tested now that sockets are visible. It has
not been tuned.

Encounter length is unchanged at ~17 s against an 8–15 s target and remains the
largest outstanding pacing gap.
