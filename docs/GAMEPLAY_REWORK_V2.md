# ALPHABET ENGINE — GAMEPLAY REWORK V2

> **Status:** Authoritative gameplay rework brief for the current TypeScript/browser-canvas implementation.
>
> **Purpose:** Correct the current combat loop before further content expansion, visual polish, or engine migration.
>
> **Important:** This document does **not** ask for a new prototype or a rewrite from scratch. It asks for a controlled rework of the existing game while preserving useful systems, deterministic simulation, tests, and content infrastructure.
>
> **Current implementation reference:** `GAMEPLAY.md` at commit `79865f8` plus the three patches documented there.
>
> **Priority:** Gameplay feel first. Do not spend significant time on final art, Godot migration, content quantity, boss expansion, or polish until the V2 acceptance tests in this document pass.

---

# 0. EXECUTIVE DECISION

The existing game has a functioning systemic core:

```text
letter bag
→ shared resource
→ word recipe
→ literal combat object
→ enemy death
→ enemy letter
→ more recipes
→ cascade
```

But the current implementation is **too automated and too abstract at the exact point where the game should feel tactile and player-owned**.

The current system often makes the player watch:

```text
bag emits letters
→ backend shared pool updates
→ backend recipe resolver consumes a multiset
→ object spawns automatically
→ object chooses target automatically
→ combat resolves automatically
```

while the player's only combat intervention is the scarce `?` Wildcard.

That produces a game that is mechanically coherent but not sufficiently compelling moment-to-moment.

The V2 goal is therefore:

> **Keep the engine-building autobattler identity, but move player ownership back into the formation of words and the direction of the cascade.**

The new combat identity is:

# **VISIBLE LETTER SOCKETS + FOCUS + WILDCARD + TARGET MARK + TRUE CAUSAL CASCADE**

The player still does **not** type words, aim weapons, move a hero, or micromanage every tile.

The machine still runs automatically.

But the player now continuously **steers** the machine.

---

# 1. THE EXPERIENCE WE ARE TRYING TO CREATE

A good V2 combat sequence should look and feel like this:

```text
A letter B enters the machine.

BOMB and BEE both need B.

The player has BOMB focused.

The B visibly snaps into BOMB.

BOMB now reads:

B O M _

A visible enemy carries B.

The player marks that carrier.

BEE is already active and prioritizes the marked carrier.

The carrier dies.

Its B physically flies toward the machine.

That B fills the final BOMB socket.

BOMB locks.

A physical bomb emerges.

The bomb kills three carriers.

Their letters visibly fly into recipes.

FIRE completes from those combat-generated letters.

FIRE kills more enemies.

The machine's cascade meter climbs.

The player realizes:
"If this keeps feeding itself, the engine is igniting."
```

The emotional loop should be:

```text
SEE
→ PREDICT
→ STEER
→ COMPLETE
→ PAYOFF
→ CAUSE
→ CASCADE
→ PANIC / EXCITEMENT
→ THEORY
→ NEXT FIGHT
```

The player should feel:

> "I caused that chain."

not merely:

> "The simulator happened to chain."

---

# 2. WHAT THE CURRENT GAME ALREADY GETS RIGHT — KEEP THESE

Do not throw away functioning systems simply because combat is being reworked.

## KEEP: finite seeded Letter Bag

Retain:

- finite multiset of letters,
- seeded shuffle,
- draw without replacement,
- cycle reshuffle,
- deterministic replay/debugging.

This is a strong source of bounded randomness.

---

## KEEP: curated Blueprint vocabulary

Retain:

- no free typing,
- no dictionary lookup,
- no Scrabble board,
- no sentence construction,
- authored Blueprint recipes.

A Blueprint is still a designed combat object.

---

## KEEP: literal word-to-object rule

Retain as non-negotiable:

```text
BOMB → physical bomb
BEE → physical bee
WALL → physical wall
FIRE → actual fire
```

Never convert the game into abstract "word damage."

---

## KEEP: exactly 3 equipped Blueprints

Three active recipes remain the correct information density for combat.

Do not increase this during the V2 rework.

---

## KEEP: Wildcard `?`

Wildcard remains the scarce intervention.

But it is no longer the player's **only** meaningful combat input.

---

## KEEP: enemy letter carriers

Enemy-carried letters remain central to the loop.

Their readability becomes even more important in V2.

---

## KEEP: deterministic simulation/test tooling

Preserve and extend:

- seeded simulation,
- typecheck/build/tests,
- screenshot tooling,
- debug logging,
- combat metrics.

Do not sacrifice determinism for visual spectacle.

---

## KEEP: literal object interactions

Preserve useful systemic interactions such as:

```text
EXPLOSIVE + FLAMMABLE
BURNING + FLAMMABLE
PUSH + PUSHABLE
ICE + EXPLOSIVE vulnerability
```

But do not expand the interaction catalog until the reworked combat loop is fun.

---

# 3. WHAT MUST CHANGE

The following are not small tuning requests. They are the core V2 rework.

---

# 3.1 REPLACE ABSTRACT SHARED-POOL PRESENTATION WITH VISIBLE RECIPE SOCKETS

The existing shared pool can remain internally useful, but it must no longer be the player's primary mental model.

## Current mental model

```text
POOL:
A B B E I M O R

resolver:
"Enough for BOMB."

consume B B O M
```

This is too abstract.

## V2 player-facing model

Each Blueprint visibly owns recipe sockets:

```text
BOMB
[B] [O] [M] [_]

BEE
[_] [E] [E]

WALL
[W] [A] [L] [L]
```

Each socket visibly represents one required letter.

A physical incoming letter should visibly travel into a socket when assigned.

The player must be able to answer at a glance:

```text
What is almost complete?
What exact letter is missing?
Which Blueprint is receiving contested letters?
```

---

## 3.1.1 Internal model

Do not necessarily delete the shared pool domain object.

Instead separate:

### Unassigned buffer

Letters available but not yet committed.

### Blueprint sockets

Letters already committed to recipes.

Recommended runtime representation:

```ts
type LetterSource =
  | { kind: 'bag'; drawIndex: number; cycle: number }
  | { kind: 'enemy'; enemyId: number; causedByObjectId?: number }
  | { kind: 'wildcard' }
  | { kind: 'rule'; ruleId: string }
  | { kind: 'refund'; blueprintId: string; objectId?: number };

interface RuntimeLetter {
  id: number;
  char: string;
  source: LetterSource;
  createdAt: number;
  provenance: ProvenanceNodeId;
}

interface RecipeSocket {
  requiredChar: string;
  letter: RuntimeLetter | null;
}
```

A Blueprint runtime state should visibly correspond to its socket array.

---

## 3.1.2 Assignment rule

When a new letter arrives:

### Case A — only one equipped Blueprint currently needs that letter

Assign automatically.

### Case B — multiple Blueprints currently need that letter

Assign to the **Focused Blueprint** if it is one of the eligible recipients.

If the Focused Blueprint does not need it:

- use deterministic slot order as fallback,
- but this fallback must be visible/debuggable.

### Case C — no Blueprint currently needs the letter

Put it in a small **buffer / reserve tray**.

Do not immediately discard it.

The reserve tray must stay visually compact.

Initial reserve-cap hypothesis:

```text
4–6 letters
```

Do not finalize the capacity before playtesting.

---

# 3.2 ADD FOCUS — THE CONTINUOUS LOW-FRICTION STEERING MECHANIC

Focus is the central new V2 input.

## Definition

At any time during active combat, exactly one Blueprint may be **Focused**.

The focused recipe receives priority when an incoming letter can satisfy more than one recipe.

Example:

```text
BOMB needs B
BEE needs B

Focus = BOMB

incoming B
→ BOMB receives it
```

This turns resource conflict into player agency.

---

## 3.2.1 Focus is NOT a skill

Focus:

- has no cooldown,
- costs no mana,
- does not pause combat,
- does not directly create damage,
- does not manually place every letter.

It is simply:

> "Machine, prioritize this recipe."

---

## 3.2.2 Focus controls

Desktop baseline:

```text
Click Blueprint card
```

Also support:

```text
1 = slot 1
2 = slot 2
3 = slot 3
```

Focus changes immediately.

---

## 3.2.3 Focus visual feedback

Focused Blueprint must be unmistakable without being visually noisy.

Use:

- stronger border,
- mechanical highlight,
- subtle directional flow from incoming-letter rail,
- clear `FOCUS` state or equivalent icon,
- no reliance on color alone.

Do not cover recipe letters.

---

## 3.2.4 Focus meaningfulness metric

Focus is only justified if it creates real decisions.

Track:

```text
focusSwitchCount
contestedLetters
focusedAssignments
fallbackAssignments
```

A typical encounter should produce several opportunities where Focus matters.

Initial experiential target:

```text
~1 meaningful micro-decision every 2–4 seconds
```

This is not a rigid input quota.

The game should still auto-run when no decision exists.

---

# 3.3 RETAIN WILDCARD AS THE SCARCE INTERVENTION

Wildcard still completes a Blueprint that is missing exactly one letter.

But the V2 UI should make this action far more tactile.

Example:

```text
BOMB
[B] [O] [M] [_B_]

Wildcard available: ?
```

When used:

1. player activates `?`,
2. eligible near-complete Blueprints highlight,
3. player selects one,
4. `?` physically moves into the missing socket,
5. socket resolves as the required letter,
6. Blueprint enters completion beat,
7. object emerges.

Do not make Wildcard an instant invisible backend mutation.

---

# 3.4 ADD TARGET MARK — SMALL OWNERSHIP OVER COMBAT OUTPUT

The current game automatically targets nearly everything.

V2 adds one light steering action:

# **MARK**

The player may click a visible enemy to mark it as a priority target.

This does **not** cause direct attacks.

It affects only objects that are logically capable of priority targeting.

Initial support:

```text
BEE strongly respects Mark.
Future hunter/homing objects may respect Mark.
BOMB does not become a manual homing missile solely because of Mark.
```

The point is not manual aim.

The point is:

> "I need that M carrier. Please make the machine care."

---

## 3.4.1 Mark readability

A marked enemy displays:

- strong but compact reticle,
- its carried letter remains readable,
- no giant UI banner.

Only one enemy may be marked at a time in V2.

Click another enemy to move the mark.

Optional:

```text
right click / Escape clears mark
```

---

## 3.4.2 Mark restrictions

Do not allow Mark to turn all combat into click-to-kill.

Mark influences targeting priority only.

If an object cannot logically hit the marked target:

- it ignores the mark.

Example:

```text
ground MINE cannot target flying carrier.
```

---

# 3.5 REPLACE TIMER-BASED CASCADE WITH TRUE CAUSAL CASCADE

The existing `chainWindow = 2.2s` system is not sufficient.

It measures temporal density, not causality.

V2 must track **provenance**.

---

## 3.5.1 Core definition

A Blueprint craft continues a cascade when at least one letter used to complete it came from combat output that descends from an earlier craft in the same causal chain.

Example:

```text
BOMB #12
kills Enemy #31

Enemy #31 drops M

M is assigned to FIRE

FIRE completes using M
```

Then:

```text
BOMB #12 → FIRE #18
```

is a real causal edge.

---

## 3.5.2 Non-chain example

```text
BOMB completes entirely from bag letters.

1.5 seconds later FIRE completes entirely from bag letters.
```

This is **not** a causal continuation merely because it happened quickly.

It may still be visually satisfying, but should not increase the true cascade depth.

---

## 3.5.3 Provenance graph

Implement a lightweight provenance graph.

Possible structure:

```ts
type ProvenanceNodeId = number;

interface ProvenanceNode {
  id: ProvenanceNodeId;
  kind:
    | 'bag_letter'
    | 'enemy_letter'
    | 'wildcard_letter'
    | 'rule_letter'
    | 'blueprint_craft'
    | 'combat_object'
    | 'enemy_kill';
  parentIds: ProvenanceNodeId[];
  timestamp: number;
  metadata?: Record<string, unknown>;
}
```

The graph does not need to be retained forever.

It only needs enough lifetime to:

- determine causal chain ancestry,
- debug surprising chains,
- produce telemetry.

---

## 3.5.4 Craft ancestry

When a Blueprint crafts:

- collect provenance of all letters consumed,
- create a `blueprint_craft` provenance node,
- link it to the letter provenance nodes.

When its object kills an enemy:

- create `enemy_kill`,
- link to the object/craft provenance.

When that enemy drops a letter:

- create `enemy_letter`,
- link to the kill provenance.

Thus combat-generated letters inherit chain ancestry naturally.

---

## 3.5.5 True chain depth

A craft has chain depth:

```text
1
```

if it has no ancestor craft through combat-generated letters.

Otherwise:

```text
1 + max(parent craft chain depth)
```

This creates actual causal cascade depth.

---

## 3.5.6 Remove bag-cycle chain reset

A bag reshuffle must **not** automatically cut a causal cascade.

If combat-generated letters keep feeding descendants, the chain is still alive.

Remove the existing design rule:

```text
new bag cycle = chain reset
```

from player-facing cascade logic.

Bag cycles remain economically meaningful, but not cascade-breaking by definition.

---

# 3.6 REMOVE HARD OBJECT LIMITS AS PRIMARY BALANCE

The current object limits suppress the engine's late-run power fantasy.

For V2:

## Disable hard per-Blueprint limits as a balancing mechanism

Do not block a craft merely because:

```text
BOMB alive >= 4
```

Instead use natural lifetime:

- bomb explodes,
- fire expires,
- bee expires/dies,
- wall breaks,
- oil burns,
- mine triggers,
- saw exits field.

If technical safety is required, add a **high emergency global cap** that is not intended to be reached during normal play.

Example:

```text
MAX_RUNTIME_OBJECTS = safety guard only
```

If reached:

- log it,
- expose in debug telemetry,
- do not silently make common recipes fail.

---

# 3.7 REDUCE SPATIAL COMPLEXITY — DISABLE FORMAL 5-LANE GAMEPLAY

The existing five-lane model creates information the player cannot meaningfully control.

For V2 core evaluation:

# Disable formal 5-lane gameplay.

Use one readable shallow battlefield.

Possible representation:

```text
x = forward/back
y = continuous shallow depth
```

or even:

```text
single primary ground line
+ flying altitude state
```

Choose the smallest implementation that preserves:

- clustering,
- walls,
- bombs,
- flying enemies,
- push interactions,
- readable spatial cause/effect.

Do not preserve lanes merely because existing code already has them.

---

## 3.7.1 What must remain spatially meaningful

BOMB:

- can move toward a useful cluster.

WALL:

- blocks/stalls ground enemies.

BEE:

- bypasses ground blockers and can hunt carriers.

FAN:

- later may push eligible enemies/objects.

But the player should not be forced to understand five hidden/semi-hidden lanes while lacking lane control.

---

# 3.8 FREEZE CONTENT — CORE TEST SET ONLY

During V2 gameplay rework, do not balance ten Blueprints at once.

## Active V2 test Blueprints

Use exactly:

```text
BOMB
BEE
WALL
```

Why:

### BOMB

Tests:

- visible completion,
- AoE payoff,
- carrier kill bursts,
- cascade generation.

### BEE

Tests:

- Mark mechanic,
- letter extraction,
- flying/targeted combat,
- different role from BOMB.

### WALL

Tests:

- non-damage utility,
- clustering,
- whether physical interaction can create value without direct DPS.

---

## Park, do not delete

Disable from standard V2 test runs:

```text
FIRE
OIL
FAN
MINE
SAW
WEB
ICE
```

Keep their code/content available.

Do not expand them until BOMB/BEE/WALL prove the loop is fun.

---

# 3.9 FREEZE MACHINE RULES AND TWEAKS

Disable all Machine Rules and tuning modifiers from the default V2 playtest.

Reason:

They can hide whether the base loop is good.

The first V2 test should answer:

> Is visible word formation + Focus + Mark + Wildcard + causal cascade fun without build-rule complexity?

Once yes, reintroduce rules gradually.

Do not delete the existing rules system.

---

# 3.10 USE ONE STARTING KIT

For V2 evaluation:

```text
1 starting kit
3 Blueprints:
BOMB
BEE
WALL
```

Construct the bag so all three are viable but letters overlap enough to create Focus decisions.

Initial candidate bag should deliberately create competition around:

```text
B
```

because both BOMB and BEE need it.

Example starting bag hypothesis:

```text
B B B
O
M
E E
W
A
L L
```

This is only a starting hypothesis.

Run simulation before finalizing.

---

# 3.11 REDUCE ENCOUNTER SET TO THREE PURPOSE-BUILT TESTS

Replace the eight-run evaluation loop with three focused encounter types during V2 development.

---

## Encounter A — CLUSTER / IGNITION

Purpose:

- make BOMB feel excellent,
- teach visible socket completion,
- create clear carrier chain,
- demonstrate first causal cascade.

Enemies:

- mostly weak ground cluster,
- several visible letters that matter.

Expected player learning:

```text
word → object → kill → letter → word
```

---

## Encounter B — CARRIER HUNT

Purpose:

- make BEE valuable,
- make Mark meaningful,
- prevent BOMB from solving everything.

Include:

- important visible carrier behind less valuable enemies,
- flying or spatially awkward targets,
- letter need that strongly rewards killing a specific carrier.

Expected player thought:

> "I need THAT letter."

---

## Encounter C — CONTROL / WALL

Purpose:

- make WALL matter,
- test non-damage value,
- create natural clustering that later enables BOMB.

Expected player discovery:

```text
WALL stalls
→ enemies bunch up
→ BOMB becomes better
```

No tooltip should need to say:

```text
WALL grants +30% BOMB synergy
```

The battlefield should prove it.

---

# 3.12 TEMPORARILY DISABLE RUN ATTRITION

During V2 gameplay validation:

- no 8-encounter survival requirement,
- no persistent Core HP attrition,
- no long reward run,
- no boss requirement.

Each test encounter should be independently restartable.

Why:

The immediate question is:

> Is combat intrinsically satisfying and steerable?

Do not punish the player across a long run while testing that question.

Preserve the existing run system but bypass it in a V2 gameplay test mode.

---

# 3.13 BLUEPRINT REPLACEMENT MUST BE PLAYER-CHOSEN

Remove automatic replacement behavior from future run reintroduction.

Do not use:

```text
leastUsedSlot()
```

to decide which Blueprint gets replaced.

When a new Blueprint is offered:

```text
New Blueprint: FIRE

Choose:
Replace BOMB
Replace BEE
Replace WALL
Skip
```

Build identity decisions belong to the player.

---

# 4. V2 BATTLE STATE MACHINE

Create an explicit combat state model.

Recommended:

```text
intro
fight
completion_beat
resolved
paused
```

But recipe completion must not globally stop all combat unless a micro-hit-stop is intentionally used.

---

## 4.1 INTRO

Duration should be short.

Player can:

- inspect Blueprints,
- inspect visible carriers,
- set Focus,
- set Mark if enemies already visible.

Do not show active controls as enabled if they cannot function.

Fix the current Wildcard intro inconsistency.

---

## 4.2 FIGHT

During fight:

- bag emits letters,
- letters visibly assign,
- player can change Focus,
- player can Mark,
- player can use Wildcard,
- combat objects act,
- carriers die and emit letters,
- causal cascade is tracked.

---

## 4.3 COMPLETION BEAT

Blueprint completion still needs a hero beat.

Existing timing totals ~0.82 seconds, but do not assume that exact timing is correct.

Re-test with V2 visible sockets.

Desired phases:

```text
socket finalizes
→ word locks
→ micro hit-stop / emphasis
→ physical object emerges
→ object enters battle
```

The sequence should be satisfying but not repeatedly stall combat.

Early hypothesis:

```text
~0.35–0.60s perceived emphasis
```

depending on whether combat continues underneath.

Measure, do not guess.

---

## 4.4 RESOLVED

Encounter ends when its authored win/loss condition is met.

Immediately show concise metrics for development builds:

```text
Focus switches
Contested letters
Wildcard used?
Mark changes
True max cascade
Time to first craft
Crafts
Core damage
```

Release builds can hide most of these.

---

# 5. LETTER VISUAL FLOW

This system must be built for causal readability.

---

# 5.1 Bag letter

Visual path:

```text
BAG
↓
incoming rail
↓
eligible Blueprint / reserve
```

The letter tile should be identifiable during motion.

---

# 5.2 Enemy letter

Visual path:

```text
enemy dies
↓
letter pops from enemy
↓
brief readable hang / arc
↓
machine
↓
socket or reserve
```

Enemy-generated letters must feel different enough from bag letters that the player can understand:

> "Combat fed my engine."

Do not make the difference so dramatic that UI becomes noisy.

---

# 5.3 Wildcard letter

Wildcard should have its own unmistakable material treatment.

But once inserted, it resolves as the missing required character.

Example:

```text
? → [B]
```

The player must understand what letter it substituted.

---

# 6. RECIPE SOCKET UX

Each Blueprint panel must show:

```text
word name
literal icon/object silhouette
recipe sockets
Focus state
near-complete state
Wildcard eligibility
```

Example:

```text
┌──────── BOMB ────────┐
│ 💣                   │
│ [B] [O] [M] [_B_]    │
│          NEED B       │
└──────────────────────┘
```

Do not overcrowd the card with:

- DPS,
- rarity,
- long tooltips,
- hidden percentages,
- excessive tags.

Clicking the card changes Focus.

Secondary inspect interaction may show detailed behavior.

---

# 7. BUFFER / RESERVE TRAY

Some letters will not currently fit any recipe.

Do not force them into invisible accounting.

Show a compact reserve tray.

Example:

```text
RESERVE
[A] [I] [R]
```

When a Blueprint opens a matching empty socket:

- eligible reserve letters may auto-assign,
- use deterministic oldest-first rule unless Focus creates a meaningful conflict.

The reserve exists to prevent wasted draws from feeling arbitrary.

Do not let it become a large inventory-management minigame.

---

# 8. TRUE CASCADE FEEDBACK

The player should see when a chain is **causal**, not merely temporally close.

---

## 8.1 Chain display

Instead of generic:

```text
CHAIN ×3
```

consider:

```text
CASCADE 3
```

or another term consistent with localization.

The key is that the displayed value now means something real.

---

## 8.2 Causal visual cue

When a combat-generated letter creates a descendant craft:

- emphasize the letter trail,
- briefly connect source to destination,
- make the chain increment occur at the descendant craft.

Do not draw giant graph lines across the battlefield.

Use short-lived readable signals.

---

# 8.3 Momentum bonus

Add one small positive feedback mechanism tied to **true causal cascade depth**.

Initial hypothesis:

```text
cascade depth 1 → 1.00x letter-flight/assignment speed
depth 2 → 1.05x
depth 3 → 1.10x
depth 4 → 1.15x
depth 5+ → cap around 1.20–1.30x
```

This should accelerate **machine momentum**, not directly multiply damage.

Exact implementation may affect:

- letter travel speed,
- recipe lock speed,
- bag draw interval slightly,
- or some subset.

Pick the least confusing option.

Do not stack several speed bonuses at once.

---

## 8.4 Momentum reset

Momentum should decay or reset when causal cascade ends.

Do not use the old bag-cycle reset.

A chain ends when the provenance graph no longer has an active causal continuation under the chosen V2 definition.

Implement a reasonable short grace period only for presentation if needed, but causal ancestry remains authoritative.

---

# 9. OBJECT BEHAVIOR V2

Only tune the active three.

---

# 9.1 BOMB

Role:

```text
cluster punishment
cascade ignition
```

Requirements:

- visually physical bomb,
- moves toward useful cluster,
- explosion kills visibly,
- enemy letters eject clearly,
- natural short lifetime,
- no hard normal-play live cap.

Do not make BOMB respect Mark in a way that turns it into manual aim.

---

# 9.2 BEE

Role:

```text
letter extraction
priority hunting
```

Targeting order:

```text
1. marked target if valid and reachable
2. visible carrier that provides a currently-needed letter
3. other visible carrier
4. normal fallback target
```

This is important.

BEE should become the clearest embodiment of:

> "I need that letter."

BEE damage must be sufficient to matter but not so high that it replaces BOMB as general damage.

---

# 9.3 WALL

Role:

```text
stall
cluster
space control
```

WALL should:

- block/stall ground enemies,
- create enemy bunching,
- naturally improve BOMB value,
- have little or no direct damage.

The player should discover WALL → BOMB without an explicit stat synergy.

---

# 10. ENEMY DESIGN V2

Use only enough enemy variety to test the new controls.

---

## 10.1 MOTE / BASIC GROUND

Purpose:

- cluster,
- die visibly,
- carry letters,
- feed BOMB cascades.

---

## 10.2 RUNNER

Purpose:

- pressure timing,
- test whether WALL is useful,
- create urgency around Focus/Wildcard.

---

## 10.3 FLYING CARRIER

Purpose:

- bypass WALL,
- make BEE valuable,
- hold important letters,
- create Mark decisions.

---

# 10.4 Carrier visibility

For V2 tests:

# All strategically relevant carrier letters should be visible.

Disable hidden carrier letters initially.

Hidden information can return later if it produces interesting uncertainty.

Do not test uncertainty before testing agency.

---

# 11. REMOVE OR DISABLE THESE DURING V2

Do not delete unless necessary.

Disable from standard V2 gameplay:

```text
8-encounter run structure
persistent Core HP
boss
hidden carrier letters
5 formal lanes
Machine Rules
Rule Tweaks
FIRE
OIL
FAN
MINE
SAW
WEB
ICE
automatic Blueprint replacement
timer-only chain logic
bag-cycle chain reset
hard normal-play object limits
long content progression
```

These are parked features.

The V2 branch is successful if it proves the combat loop, not if it preserves every existing production feature.

---

# 12. SIMULATION CHANGES

The current simulation framework is valuable but must be upgraded to reflect the new agency.

A naive bot that always takes the first reward is not enough for V2 combat validation.

Implement several deterministic policy bots.

---

## 12.1 BOT A — PASSIVE

Behavior:

- never changes Focus,
- never Marks,
- uses no Wildcard.

Purpose:

- establish automation baseline.

---

## 12.2 BOT B — SIMPLE STEERING

Behavior:

- Focus Blueprint with highest completion percentage,
- Mark visible carrier that supplies a missing letter for focused Blueprint,
- use Wildcard when focused Blueprint is missing exactly one letter after a threshold.

Purpose:

- test whether V2 inputs create measurable advantage.

---

## 12.3 BOT C — GREEDY CASCADE

Behavior:

- Focus recipe most likely to produce immediate kill/cascade,
- Mark carrier that completes a causal descendant,
- preserve Wildcard if natural completion is imminent.

Purpose:

- stress cascade system.

---

# 12.4 Required simulation metrics

Track:

```text
win rate
time to first craft
combat duration
Focus switches
contested letters
Focus-influenced assignments
reserve overflow
Wildcard timing
Wildcard changed loss→win
Marks placed
marked target kills
letters gained from marked targets
craft count
craft count by Blueprint
true causal cascade distribution
max causal cascade
bag-only crafts
combat-fed crafts
object count peak
Core damage
```

---

# 13. HUMAN PLAYTEST QUESTIONS

Simulation cannot determine fun.

For every V2 build, ask human testers:

## Immediate comprehension

1. Can you tell where a letter is going?
2. Can you tell what each Blueprint still needs?
3. Do you understand why BOMB completed?

## Agency

4. Did Focus matter?
5. Did you ever switch Focus because you wanted a different outcome?
6. Did Mark feel useful rather than decorative?
7. Did Wildcard feel like a meaningful save/ignite decision?

## Causality

8. Could you see that an enemy's dropped letter caused the next craft?
9. Did a cascade feel like your machine feeding itself?
10. Could you tell why a cascade stopped?

## Excitement

11. Did you have a moment where the machine suddenly "caught fire"?
12. Did you want the chain not to stop?
13. Did you want to replay immediately with a different Focus/Mark decision?

## Friction

14. Were you clicking too often?
15. Were you waiting too long?
16. Did you feel the game played itself?
17. Did the UI make you read instead of react?

---

# 14. V2 ACCEPTANCE TESTS

Do not re-expand content until these pass.

---

## TEST A — LETTER FORMATION IS VISIBLE

A fresh observer can watch a combat clip and correctly explain:

```text
letters are filling word slots
```

without reading a tutorial paragraph.

PASS requires visible physical assignment.

---

## TEST B — PLAYER AGENCY IS MEASURABLE

A simple steering bot must outperform a passive bot by a meaningful amount across authored encounters.

The exact threshold is not fixed yet, but:

```text
0–2% difference
```

would strongly suggest Focus/Mark are decorative.

---

## TEST C — FOCUS CREATES REAL CONFLICT

Normal combat must regularly produce letters useful to more than one Blueprint.

The player should sometimes think:

> "Give this B to BOMB, not BEE."

If this almost never happens, redesign the bag/recipes.

---

## TEST D — MARK MATTERS

Marked carrier targeting must produce measurable changes in:

- important letter acquisition,
- craft timing,
- or encounter outcome.

If Mark rarely changes anything, remove or redesign it.

---

## TEST E — TRUE CASCADE EXISTS

The game must produce chains where:

```text
craft
→ combat kill
→ dropped letter
→ descendant craft
```

and telemetry must prove the causal relationship.

Timer adjacency alone does not count.

---

## TEST F — CASCADE IS LEGIBLE

A player can tell:

> "That B came from the enemy my previous object killed."

without opening debug tools.

---

## TEST G — ENGINE IGNITION MOMENT

At least some successful encounters must visibly shift from:

```text
slow buildup
```

to:

```text
self-feeding production
```

without scripted fake spawning.

---

## TEST H — NO SINGLE AUTO-WINNER

BOMB must not solve Carrier Hunt better than BEE.

WALL must create value in Control encounters.

Functional matchup matters more than flat damage balancing.

---

## TEST I — LOW DEAD WATCH TIME

Normal V2 encounter:

```text
~8–12 seconds target
```

but late successful engines may clear faster.

There should not be long periods with:

- no decision,
- no near-complete recipe,
- no carrier tension,
- no meaningful object interaction.

---

## TEST J — PLAYER CAN EXPLAIN A LOSS

After failure, the player can usually name a plausible adjustment:

```text
wrong Focus
ignored a carrier
spent Wildcard too early
failed to use WALL
bag composition problem
```

If the dominant explanation is:

> "bad random"

the system fails.

---

# 15. IMPLEMENTATION ORDER

Do not attempt the entire V2 rework in one giant patch.

---

# PHASE V2.0 — SAFETY BRANCH

1. Create a dedicated gameplay rework branch.
2. Ensure current tests pass before changes.
3. Save baseline simulation output.
4. Save representative screenshots/video if available.
5. Document baseline metrics.

No feature work before baseline exists.

---

# PHASE V2.1 — SOCKET DOMAIN MODEL

Implement:

- Blueprint socket runtime state,
- explicit committed letters,
- reserve/buffer,
- deterministic assignment.

No new visuals required beyond basic debugging at first.

Tests:

- duplicate letters,
- one eligible recipe,
- multiple eligible recipes,
- reserve behavior,
- exact completion.

---

# PHASE V2.2 — FOCUS

Implement:

- selected Blueprint,
- click / 1-2-3 controls,
- contested-letter priority,
- focus telemetry,
- visible Focus state.

Acceptance:

- deterministic tests show same incoming sequence produces different allocation under different Focus choices.

---

# PHASE V2.3 — VISIBLE LETTER FLIGHT

Implement:

- bag letter → socket,
- enemy letter → socket/reserve,
- visible missing slots,
- near-complete state.

At this point, manually play.

Do not continue if letter movement is unreadable.

---

# PHASE V2.4 — WILDCARD SOCKET INSERTION

Adapt existing Wildcard to:

- fill visible missing socket,
- preserve deterministic behavior,
- create strong completion beat.

---

# PHASE V2.5 — MARK + BEE

Implement:

- one marked target,
- click to mark,
- BEE targeting priority,
- mark telemetry.

Test Carrier Hunt encounter.

---

# PHASE V2.6 — PROVENANCE + TRUE CASCADE

Implement:

- provenance nodes,
- craft ancestry,
- combat kill ancestry,
- enemy letter ancestry,
- true chain depth,
- debug visualization/log.

Disable old timer-only chain UI.

Do not remove old code until new telemetry is verified.

---

# PHASE V2.7 — MOMENTUM

Only after causal cascade works.

Add restrained cascade momentum acceleration.

A/B test with:

```text
momentum OFF
momentum ON
```

Do not assume faster is better.

---

# PHASE V2.8 — SPATIAL SIMPLIFICATION

Remove/disable formal five-lane dependency from active V2 test mode.

Do this carefully because existing targeting/render code may depend on lane values.

Prefer an adapter/migration step over breaking the entire simulator at once.

---

# PHASE V2.9 — THREE AUTHORED TEST ENCOUNTERS

Create:

```text
Cluster / Ignition
Carrier Hunt
Control / Wall
```

No long run.

Each encounter directly restartable.

---

# PHASE V2.10 — HUMAN PLAYTEST GATE

Do not proceed to FIRE/OIL/FAN until:

- Focus feels meaningful,
- Mark feels meaningful,
- causal cascade is readable,
- machine ignition happens naturally,
- combat is worth replaying.

---

# 16. CODE MIGRATION GUIDANCE

The current project is TypeScript/browser-canvas.

Do **not** port to Godot during this rework.

The purpose of the current codebase is to answer:

> "Is the game fun?"

before paying migration/polish cost.

---

## 16.1 Preserve deterministic core

Keep gameplay authority separate from rendering.

Do not move critical recipe/letter logic into canvas animation code.

The visual socket animation should reflect domain state.

It must not own the state.

---

## 16.2 Prefer explicit domain events

Useful events may include:

```text
letter_created
letter_assigned
letter_buffered
focus_changed
mark_changed
socket_filled
blueprint_ready
blueprint_crafted
object_spawned
enemy_killed
carrier_letter_released
cascade_edge_created
cascade_depth_changed
wildcard_used
```

Presentation subscribes to these.

---

# 16.3 Avoid second parallel gameplay implementation

Do not leave:

```text
old shared-pool resolver
```

and

```text
new socket resolver
```

both deciding crafts in production.

During migration:

- feature flag if needed,
- then remove/disable the old authority.

One source of truth.

---

# 17. UI LAYOUT HYPOTHESIS

Do not over-polish yet.

A simple combat composition:

```text
┌────────────────────────────────────────────────────────────┐
│ Encounter / Core HP / Cascade                             │
├────────────────────────────────────────────────────────────┤
│                                                            │
│                     BATTLEFIELD                            │
│                                                            │
│ enemy [M]       enemy [E]       marked enemy [B]           │
│                                                            │
├────────────────────────────────────────────────────────────┤
│ incoming letters / reserve                                 │
│                                                            │
│ [ BOMB ]        [ BEE ]         [ WALL ]                   │
│ B O M _         B E _           W A _ _                    │
│ FOCUS                                                      │
│                                                            │
│ Wildcard [?]                                               │
└────────────────────────────────────────────────────────────┘
```

This is conceptual, not a pixel-perfect mandate.

The key visual relationship is:

```text
battlefield letter source
↓
machine recipe destination
```

---

# 18. DO NOT SOLVE ART YET

Current self-drawn graphics may look poor.

That is not the priority of this document.

For V2:

- use clean temporary shapes,
- improve readability,
- use strong motion,
- use clear typography,
- avoid wasting time generating final art.

Do not block gameplay work because Godot or asset downloads are unavailable.

The current browser implementation is sufficient to validate combat.

Once V2 passes, then decide:

```text
continue web/canvas
or
port to Godot
or
rebuild presentation layer
```

---

# 19. WHAT NOT TO ADD DURING THIS REWORK

Do not add:

```text
new Blueprints
new bosses
new chapters
new currencies
meta upgrades
new kits
inventory grid
equipment
rarity systems
letter affixes
free typing
crosswords
PvP
branching map
complex economy
extra active skills
new art pipeline
Godot port
```

unless the rework itself cannot function without them.

If something feels missing, first ask:

> "Can Focus, Mark, Wildcard, sockets, or cascade clarity solve this?"

---

# 20. DESIGN RISKS TO WATCH

---

## RISK A — Focus becomes fake choice

If most letters only fit one recipe:

Focus is pointless.

Response:

- increase recipe letter overlap,
- tune starting bag,
- author conflicts.

Do not add more buttons.

---

## RISK B — Focus becomes exhausting micromanagement

If every incoming tile demands a click:

the game stops being an autobattler.

Response:

- automatic assignment when unambiguous,
- Focus persists,
- player acts only on conflicts.

---

## RISK C — Mark becomes click-to-kill

If every object follows Mark:

combat becomes manual targeting.

Response:

- only hunter-like objects respect Mark strongly,
- preserve object identity.

---

## RISK D — True cascade becomes invisible math

If provenance is technically correct but players cannot see it:

the feature fails.

Response:

- strengthen source-to-socket animation,
- simplify VFX,
- reduce simultaneous noise.

---

## RISK E — Momentum creates runaway victory too easily

If any chain immediately snowballs forever:

tension disappears.

Response:

- cap acceleration,
- use encounter ecology,
- avoid direct damage multiplier,
- preserve resource competition.

---

## RISK F — Reserve tray becomes inventory game

If player manages 15 stored letters:

scope drifts.

Response:

- small capacity,
- automatic oldest-first behavior,
- keep reserve secondary.

---

# 21. METRICS THAT WOULD CONVINCE US V2 IS BETTER

Compared with the current baseline, V2 should show:

### More agency

- meaningful Focus switches,
- marked carrier choices,
- player decisions correlate with outcome.

### Better causal clarity

- more players correctly explain why the next word completed.

### Less dead watch time

- fewer multi-second periods with no relevant decision or anticipation.

### Better replay desire

Players spontaneously say:

> "I want to try focusing BEE first next time."

or:

> "I should have marked the M carrier."

rather than only:

> "I need better RNG."

---

# 22. REQUIRED DEV DEBUG VIEW

Add a toggleable developer overlay showing:

```text
seed
bag remaining
reserve letters
Focus target
Mark target
each Blueprint sockets
contested assignment count
last letter source
last craft provenance
true cascade depth
current momentum multiplier
active object count
```

For a selected letter/object, allow logging its provenance ancestry.

This will be critical for debugging causal chains.

---

# 23. REQUIRED TEST CASES

Add automated tests for:

## Socket assignment

```text
B goes to only eligible recipe.
```

```text
B contested by BOMB/BEE goes to Focused recipe.
```

```text
Focus not eligible → deterministic fallback.
```

## Reserve

```text
unneeded letter enters reserve.
```

```text
reserve letter later fills newly available socket.
```

## Wildcard

```text
recipe missing exactly one letter → wildcard completes it.
```

## Provenance

```text
bag-only craft depth = 1.
```

```text
craft A kills carrier → dropped letter completes craft B → B depth = A depth + 1.
```

```text
two crafts close in time but no ancestry → no causal chain increment.
```

## Mark

```text
BEE prefers valid marked carrier.
```

```text
invalid/unreachable marked target falls back correctly.
```

---

# 24. REWORK DEFINITION OF DONE

V2 is not done when:

```text
code compiles
```

or:

```text
socket UI exists
```

V2 is done only when all of the following are true:

1. letters visibly occupy recipe sockets,
2. Focus changes contested-letter outcomes,
3. Wildcard visibly fills a missing socket,
4. Mark changes BEE targeting in a useful way,
5. enemy-dropped letters visibly feed recipes,
6. causal cascade uses provenance rather than only time,
7. bag-cycle reset does not falsely break causal chains,
8. normal-play object hard caps no longer suppress engine payoff,
9. formal five-lane complexity is removed/disabled from V2 test mode,
10. BOMB/BEE/WALL each have a distinct reason to exist,
11. three short test encounters are directly replayable,
12. human playtests report less passive waiting,
13. players can explain why major chains happened,
14. players want to retry because of a decision, not merely because of RNG.

---

# 25. FIRST TASK FOR THE CODING AGENT

Read this document and the current `GAMEPLAY.md` in full.

Then:

1. inspect the current implementation files named in `GAMEPLAY.md`,
2. run the existing typecheck/build/tests,
3. run and record the current simulation baseline,
4. create a dedicated V2 gameplay rework branch,
5. update `docs/DECISIONS.md` with:
   - why the current combat is being reworked,
   - which systems are parked,
   - which systems are retained,
6. write a short technical migration plan before changing gameplay authority,
7. implement **Phase V2.1: socket domain model** only,
8. add automated tests,
9. verify no regression in determinism,
10. update `docs/PROGRESS.md`.

Do not implement every V2 phase in one uncontrolled pass.

After V2.1 is verified, continue sequentially through the phases.

At the end of each phase:

- run typecheck,
- run tests,
- run build,
- run relevant simulation,
- inspect one real rendered screenshot,
- update progress notes,
- state what changed in player experience,
- state what remains unproven.

---

# 26. FINAL DESIGN MANTRA

V1 leaned too far toward:

```text
BUILD
→ WATCH
```

V2 must become:

```text
BUILD
→ WATCH
→ NOTICE
→ STEER
→ CAUSE
→ CASCADE
```

The machine should still feel autonomous.

But the player must feel responsible for where it goes.

Protect this chain:

```text
VISIBLE LETTER
→ VISIBLE NEED
→ SMALL PLAYER STEERING
→ VISIBLE COMPLETION
→ LITERAL OBJECT
→ VISIBLE KILL
→ VISIBLE LETTER RELEASE
→ CAUSAL DESCENDANT CRAFT
→ ENGINE IGNITION
```

If a future mechanic does not strengthen that chain, it should probably wait.
