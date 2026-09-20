# ALPHABET ENGINE — MASTER PRODUCTION DEVELOPMENT PROMPT

> **Purpose:** Use this as the root brief for an AI coding agent that has access to the game repository, terminal, Godot, screenshots/browser/computer-use if available, and optional image/audio generation tools.
>
> **This is not a request for a throwaway prototype or a jam demo.** Build this as a real indie game project that can be continued, expanded, balanced, tested, polished, and eventually shipped.
>
> If the repository already contains work, audit and preserve useful existing systems before changing anything. Do not restart the project merely because a different architecture would be easier.
>
> Working codename: **ALPHABET ENGINE**

---

# 0. YOUR ROLE

Act as a small senior game-development team, not as a code autocomplete tool.

You are simultaneously responsible for:

- game direction
- systems design
- gameplay engineering
- technical architecture
- UI/UX design
- game-feel implementation
- content-system design
- balancing tools
- accessibility
- QA and playtesting
- performance
- production documentation

Operate like a lead developer who expects this codebase to survive hundreds of future changes.

Do not optimize for producing the most files or the most features. Optimize for:

1. a compelling core loop,
2. readable player decisions,
3. maintainable architecture,
4. fast iteration,
5. measurable balancing,
6. strong audiovisual feedback,
7. low accidental complexity.

Whenever game feel, architecture, and content quantity conflict, protect **game feel and architecture first**.

---

# 1. OPERATING MODE

## 1.1 Investigate before modifying

Before substantial implementation:

1. inspect the entire relevant repository structure,
2. read existing project instructions,
3. read existing design/technical docs,
4. identify the current playable state,
5. run the project if possible,
6. capture obvious bugs and missing systems,
7. only then make a development plan.

Never speculate about code that you have not inspected.

If the project is empty, bootstrap it cleanly.

If the project is non-empty, treat existing working behavior as valuable unless it conflicts with a locked design rule below.

---

## 1.2 Plan, implement, verify, then continue

For every meaningful feature:

1. **Understand** the player-facing purpose.
2. **Plan** the smallest coherent vertical slice.
3. **Implement** it using production-quality structure.
4. **Run** relevant tests.
5. **Play or simulate** the feature.
6. **Inspect the result visually** when UI/VFX are involved.
7. **Fix regressions immediately.**
8. **Update living documentation.**
9. Proceed to the next highest-value task.

Do not stop after scaffolding a system if it is supposed to be player-facing.

Do not claim a feature works only because the code compiles.

---

## 1.3 Maintain project memory in the repository

Create and keep updated:

```text
AGENTS.md
docs/
  PRODUCT.md
  GDD.md
  ARCHITECTURE.md
  UX_UI.md
  BALANCE.md
  CONTENT_RULES.md
  TEST_PLAN.md
  ROADMAP.md
  DECISIONS.md
  ASSETS.md
  CHANGELOG_DEV.md
  PROGRESS.md
```

Use these files as canonical project memory.

Do not duplicate the same information across many documents. Reference canonical files.

`DECISIONS.md` must record important choices and rejected alternatives so future agents do not repeatedly reopen settled questions without new evidence.

`PROGRESS.md` must always state:

- current milestone,
- what is working,
- what is partially working,
- known bugs,
- next 5 highest-value tasks,
- current risks.

---

# 2. TECHNOLOGY BASELINE

Unless the existing repository requires otherwise:

- **Engine:** Godot **4.7.2 stable**
- **Language:** GDScript with static typing
- **Primary platform:** desktop PC
- **Initial release target:** Windows first, architecture portable to Linux/macOS
- **Rendering:** 2D
- **Gameplay presentation:** side-view single-lane / shallow-lane battlefield
- **Target framerate:** stable 60 FPS
- **Reference resolution:** 1920×1080
- **Minimum supported gameplay layout:** 1280×720
- **Input:** mouse + keyboard first; gamepad navigation must be structurally supported
- **Version control:** Git
- **Save data:** local, versioned schema
- **Networking:** none
- **Backend:** none
- **Online account:** none

Do not use Godot 4.8 development builds for production work unless explicitly requested.

Prefer built-in Godot systems over adding dependencies.

Do not introduce a plugin unless it solves a concrete problem better than a small maintainable in-project implementation.

---

# 3. THE GAME IN ONE SENTENCE

> **Build an alphabet economy that manufactures literal weapons, then ignite self-feeding combat cascades from the letters carried by enemies.**

Short marketing-level variants:

> **Build words. Kill for letters. Start a chain reaction.**

> **You do not spell words. You engineer an alphabet that builds weapons.**

These describe the design identity. They are not merely taglines.

---

# 4. CORE PLAYER FANTASY

The player is not a typist and not a wizard spelling arbitrary vocabulary.

The player is an **engine builder**.

They configure a compact system that receives letters, assembles known words, materializes those words as literal physical combat objects, and tries to make the resulting combat chain become self-sustaining.

The desired emotional arc of a good fight is:

```text
ANTICIPATION
→ NEAR-COMPLETION
→ SMALL PLAYER INTERVENTION
→ WORD COMPLETION
→ PHYSICAL PAYOFF
→ ENEMY DEATH
→ LETTER RELEASE
→ NEW WORD COMPLETION
→ CASCADE
→ ESCALATION
→ "MY ENGINE CAUGHT FIRE"
```

The player should occasionally feel that they have **broken the game through a clever build**.

Do not over-balance away this fantasy.

---

# 5. NON-NEGOTIABLE DESIGN PRINCIPLES

## 5.1 Randomness creates the problem; the player shapes the answer

Randomness may determine:

- letter order,
- offered rewards,
- encounter composition within authored constraints,
- which visible letter carriers appear within a bounded distribution.

Randomness must **not** primarily determine:

- whether a planned build is allowed to function at all,
- arbitrary misses,
- arbitrary critical hits,
- hidden proc chains,
- unexplained enemy targeting,
- whether required letters exist in the encounter.

The player should lose thinking:

> "I know what I should change."

Not:

> "The game simply refused to roll what I needed."

---

## 5.2 The word must become the thing

A completed combat word must instantiate a literal, visually understandable object or phenomenon.

Examples:

```text
BOMB → a bomb
FIRE → fire
BEE → a bee
WALL → a wall
FAN → a fan / directional gust source
OIL → an oil slick
MINE → a mine
WEB → a web
ICE → ice
SAW → a moving saw
```

Avoid abstract implementations such as:

```text
BOMB = +30 generic damage
WALL = +20 armor stat
FIRE = +15% DPS modifier
```

Numbers exist under the hood, but the player-facing meaning comes from behavior.

If a word cannot be understood quickly as a literal thing with a distinct battlefield function, it is probably a poor blueprint.

---

## 5.3 Curated vocabulary, not open dictionary

There is **no free typing**.

There is **no Scrabble-like dictionary validation**.

There are **no crossword mechanics**.

There are **no sentences**.

There is **no "enter any English word" mechanic**.

Words are authored **Blueprints** with designed behavior.

A player never needs a large English vocabulary to play.

Every blueprint displays:

- the word,
- required letters,
- a strong icon/silhouette,
- a concise behavior description.

---

## 5.4 Autobattle is the payoff, not an excuse for zero agency

The player does not:

- directly move a hero,
- manually aim weapons,
- repeatedly click enemies,
- spam active abilities.

The engine fights automatically.

Player agency comes from:

- shaping the letter bag,
- choosing blueprints,
- choosing rule-changing upgrades,
- making a very limited intervention during combat,
- learning physical/systemic interactions.

---

## 5.5 One combat intervention: the Wildcard

The initial combat-active input is **Wildcard `?`**.

Baseline behavior:

- one charge per encounter unless modified by a clearly designed build rule,
- can substitute for one missing letter in a currently incomplete equipped Blueprint,
- using it should be a meaningful timing decision,
- it should sometimes be correct to wait,
- it should sometimes be correct to use it immediately,
- using it too early can alter resource availability and lead to a worse cascade.

Do not turn Wildcard into a spam skill bar.

Do not add multiple active buttons until evidence from playtesting proves they are needed.

---

# 6. CORE LOOP — LOCKED

The fundamental loop is:

```text
CONFIGURE BUILD
↓
START ENCOUNTER
↓
LETTER BAG EMITS TILES
↓
SHARED LETTER POOL FILLS
↓
BLUEPRINT COMPLETES
↓
LITERAL OBJECT MATERIALIZES
↓
OBJECT AUTO-FIGHTS
↓
ENEMY DIES
↓
VISIBLE CARRIED LETTER IS RELEASED
↓
LETTER ENTERS SHARED POOL
↓
ANOTHER BLUEPRINT MAY COMPLETE
↓
CASCADE
↓
ENCOUNTER RESOLVES
↓
CHOOSE ONE MEANINGFUL REWARD
↓
MODIFY BUILD
↓
NEXT ENCOUNTER
```

The combat and economy must feed each other.

The enemy-letter drop is not ordinary loot after combat; it is fuel **during** combat.

---

# 7. THREE BUILD PILLARS

Keep the main buildcraft understandable through exactly three conceptual pillars.

## 7.1 Letter Bag

The bag is the player's raw alphabet economy.

Properties:

- finite multiset of letter tiles,
- deterministic seeded shuffle,
- draws without replacement until the current bag cycle is exhausted,
- then reshuffles for a new cycle if the encounter is still running,
- duplicate letters are explicit physical/economic choices,
- bag capacity should create opportunity cost.

Between encounters, upgrades may:

- add a letter,
- remove a letter,
- duplicate a letter,
- transform a letter,
- change bag capacity,
- alter limited draw rules.

Avoid hidden letter-weight probabilities when an explicit tile can communicate the same thing.

---

## 7.2 Equipped Blueprints

Baseline:

- exactly **3 equipped Blueprint slots** during combat,
- each Blueprint has a multiset letter recipe,
- recipes consume letters from the shared letter pool when completed,
- completed words may craft repeatedly if the economy sustains them,
- do **not** limit every Blueprint to once per cycle.

If multiple Blueprints can complete at the exact same time and compete for the same resources:

- resolve deterministically,
- use a simple documented slot-order rule,
- do not turn this conflict-resolution rule into a large standalone UI subsystem.

Blueprint choice should create meaningful competition for shared letters.

Example:

```text
BOMB = B B O M
BEE  = B E E
OIL  = O I L
```

A build with many B-dependent recipes creates a real economy problem.

---

## 7.3 Machine Rules

These are rule-changing upgrades.

They should alter how the alphabet economy behaves rather than simply give invisible percentage bonuses.

Good examples:

- first vowel drawn each bag cycle is duplicated,
- the final tile of each bag cycle is copied,
- one chosen consonant is inserted into the bag at the start of every encounter,
- every third unused tile is recycled,
- the first letter released by a Carrier each encounter is duplicated,
- an unspent Wildcard becomes a random vowel after combat,
- one specific Blueprint refunds one of its letters after crafting.

Bad examples:

- +8% damage,
- +4% crit chance,
- +10% attack speed,
- generic rarity inflation.

Numerical tuning is allowed when needed, but **interesting upgrades should usually change rules**.

---

# 8. LETTER RESOLUTION MODEL

Implement the letter system as a deterministic, inspectable domain system.

## 8.1 Shared Letter Pool

Drawn and dropped letters enter a shared pool.

The HUD must make current counts legible.

The recipe resolver checks equipped Blueprints whenever the pool changes.

A Blueprint may complete when the pool contains its complete required multiset.

When it completes:

1. consume the exact required letters,
2. emit a `blueprint_completed` event,
3. instantiate the corresponding combat object,
4. trigger feedback,
5. immediately re-evaluate the pool because a cascade may already permit another completion.

Protect against infinite synchronous loops with explicit safety guards.

---

## 8.2 Determinism

A run must have a visible or inspectable seed.

Use separate deterministic RNG streams where appropriate, for example:

- bag order,
- reward offers,
- wave composition,
- letter-carrier assignment.

The same seed + same decisions should be reproducible enough for debugging.

Implement developer logging that can reconstruct:

```text
time
letter source
letter emitted
pool before
pool after
blueprint crafted
enemy killed
letter dropped
wildcard used
chain depth
```

Debug logs must be switchable off in normal play.

---

# 9. CASCADE SYSTEM

Cascade is the central retention mechanic.

A **cascade** occurs when combat output generates letter input that causes additional Blueprint completions without requiring a new between-combat decision.

Track chain depth.

Example:

```text
BOMB crafts
→ bomb kills 4 carriers
→ letters enter pool
→ FIRE crafts
→ fire kills 3 enemies
→ letters enter pool
→ BEE crafts
→ bee kills a priority carrier
→ BOMB becomes available again
```

This is not merely a score combo.

The chain must be visibly caused by the system.

## Desired tuning direction

Do not hardcode these as eternal targets, but use them as initial balance hypotheses:

- chain length 2: common enough to establish the mechanic,
- chain length 3: exciting and noticeable,
- chain length 4+: uncommon,
- very large chains: rare enough to remain memorable,
- late-run specialized builds may intentionally break these early-game rates.

Create telemetry/simulation capable of reporting:

- time to first Blueprint craft,
- crafts per encounter,
- chain-length distribution,
- longest chain,
- letter starvation,
- unused letters,
- Wildcard usage timing,
- conversion of Wildcard from loss to win,
- damage/utility contribution by Blueprint,
- enemy letter contribution.

---

# 10. ENEMY LETTER CARRIERS

Enemy letter drops must be readable and partially predictable.

Each relevant enemy may visibly carry a letter:

```text
[M]
enemy
```

The letter must be readable before the enemy dies.

On death, that exact letter physically flies or magnetizes into the shared pool.

Avoid hidden random drops that determine the success of an engine.

Encounter design may preview some or all of the letter ecology:

```text
NEXT WAVE
Threat: Swarm
Known carried letters: B, B, M, E, O
Unknown carriers: 3
```

The amount of preview can vary by encounter type, but the game should provide enough information for planning.

---

# 11. STARTER BLUEPRINT SET

Build these first because together they test direct damage, persistent damage, targeting, blocking, displacement, setup, and systemic interactions.

## BOMB

Recipe:

```text
B B O M
```

Function:

- materializes a physical bomb,
- moves toward enemy density using readable scripted behavior,
- explodes in an area,
- applies impulse to eligible objects/enemies,
- can ignite flammable substances,
- especially strong against clustered ground enemies,
- weaker against scattered/flying targets.

Tags may include:

```text
EXPLOSIVE
PUSHABLE
GROUND
```

---

## FIRE

Recipe:

```text
F I R E
```

Function:

- creates a persistent flame area,
- strong against streams of enemies,
- ignites FLAMMABLE objects/surfaces,
- creates area denial,
- remains readable without filling the screen with opaque VFX.

Tags:

```text
BURNING
AREA
```

---

## BEE

Recipe:

```text
B E E
```

Function:

- creates a flying unit,
- bypasses ground blockers,
- prefers high-value Letter Carriers when available,
- lower raw throughput than BOMB,
- useful for extracting strategically important letters.

Tags:

```text
FLYING
HUNTER
```

---

## WALL

Recipe:

```text
W A L L
```

Function:

- creates a physical blocker,
- stalls ground enemies,
- causes clustering,
- has little or no direct damage,
- creates natural synergy with BOMB, FIRE, OIL, and hazards.

Tags:

```text
BLOCKING
STRUCTURE
```

---

## FAN

Recipe:

```text
F A N
```

Function:

- creates directional pushing force,
- pushes light enemies,
- pushes eligible projectiles/objects such as BOMB,
- can reposition hazards,
- should visibly demonstrate systemic interaction.

Tags:

```text
PUSH
UTILITY
```

---

## OIL

Recipe:

```text
O I L
```

Function:

- creates an oil slick,
- zero or very low direct damage,
- is FLAMMABLE,
- becomes dangerous when ignited,
- serves as a setup Blueprint.

Tags:

```text
LIQUID
FLAMMABLE
SETUP
```

---

# 12. SYSTEMIC INTERACTION MODEL

Do **not** build an unrestricted physics sandbox.

Create a bounded semantic interaction system.

Start from a small tag vocabulary such as:

```text
FLAMMABLE
BURNING
EXPLOSIVE
PUSHABLE
LIGHT
HEAVY
BLOCKING
GROUND
FLYING
LIQUID
STRUCTURE
CARRIER_HUNTER
```

Interactions must come from explicit authored rules.

Examples:

```text
BURNING + FLAMMABLE → ignite
PUSH source + PUSHABLE → displacement
BLOCKING + ground enemy → path obstruction / clustering
EXPLOSIVE + FLAMMABLE → ignition
BEE + Letter Carrier → priority targeting
```

Prefer controlled kinematic behavior over chaotic RigidBody simulation when the latter reduces readability or reproducibility.

The goal is:

> systemic enough to surprise,
> bounded enough to balance and ship.

---

# 13. INITIAL ENEMY ARCHETYPES

Do not balance every Blueprint by turning damage knobs.

Create encounter geometry/behavior that rewards different functions.

## SWARM

- many low-health ground enemies,
- naturally cluster,
- pressure BOMB/OIL/FIRE interaction,
- punish overly slow single-target builds.

## RUNNER / STREAM

- enters in spaced intervals,
- moves quickly,
- reduces BOMB efficiency,
- rewards persistent area control and WALL timing.

## FLYING CARRIER

- ignores ground blockers,
- visibly carries valuable letters,
- encourages BEE or other future anti-air/hunter tools,
- may create high-value target tension.

After these are proven, expand carefully with archetypes such as:

- armored,
- splitter,
- shielded,
- jammer,
- thief,
- heavy,
- volatile carrier.

Do not add alphabet-disruption enemies until the player already understands the alphabet economy.

---

# 14. COMBAT FORMAT

## 14.1 Battlefield

Use a highly readable side-view arena.

Conceptual layout:

```text
PLAYER CORE / ENGINE                        ENEMY ENTRY
[LEFT] -------------------------------------- [RIGHT]

Blueprint HUD / Letter Pool must remain distinct from battlefield action.
```

The player protects a Core/Engine on the left.

Enemies advance toward it.

Enemies reaching the Core deal damage according to their behavior.

If Core HP reaches zero, the encounter/run fails according to run rules.

No controllable hero is required.

---

## 14.2 Encounter duration

Target short, dense feedback loops.

Initial target:

- first meaningful craft: ideally within ~2–4 seconds,
- normal encounter: roughly 8–15 seconds,
- elite/boss encounter may be longer,
- between-encounter decision: roughly 10–25 seconds.

These are experience targets, not rigid timers.

Do not create 60-second stretches where the player only watches a solved engine.

Provide combat speed controls after the default pacing is fun:

- 1×,
- 2×,
- optional faster mode if clarity survives.

Support pause.

---

# 15. WILDCARD UX

Wildcard must always show:

- available charges,
- which Blueprints it can currently complete,
- the exact missing letter it would substitute,
- the consequence of clicking.

Do not force the player to mentally inspect every recipe under combat pressure.

When a Blueprint is missing exactly one letter and Wildcard can complete it:

- highlight the missing slot,
- show a subtle `?`,
- make the Blueprint clearly actionable.

Do not use intrusive full-screen prompts.

Wildcard activation should feel tactile and decisive.

Recommended feedback:

1. click/tap Wildcard,
2. select eligible Blueprint if more than one,
3. wildcard tile snaps into missing slot,
4. micro-pause,
5. word compresses/locks,
6. object materializes.

The entire sequence should be quick.

---

# 16. GAME FEEL / JUICE

The game must be readable before it is spectacular.

Never bury essential letters, enemies, or recipe states under particles.

## 16.1 Word-completion hero moment

When a Blueprint completes:

- required letters visibly converge,
- word briefly locks together,
- strong readable sound,
- small hit-stop or time accent,
- object emerges physically from the word,
- object immediately begins its behavior.

The identity of the game depends on this transformation.

Do not replace it with a generic card flash.

---

## 16.2 Cascade feedback

As chain depth rises:

- increase audio intensity/pitch carefully,
- increase motion energy,
- strengthen typography feedback,
- use subtle camera response,
- make chain count readable,
- reserve strongest effects for genuinely unusual chains.

Avoid constant maximal screen shake.

Provide:

- screen shake intensity setting,
- flash reduction,
- VFX intensity setting if necessary.

No critical information may rely on color alone.

---

# 17. VISUAL DIRECTION

Create a distinct **kinetic typographic toy-machine** identity.

Avoid generic fantasy card-game UI.

Avoid generic glassmorphism SaaS UI.

The player should feel that letters are tangible manufactured pieces.

Design language:

- chunky physical uppercase letter tiles,
- tactile slots and trays,
- crisp silhouettes,
- readable material differences,
- playful industrial / letterpress / toy-machine energy,
- strong contrast,
- limited visual noise,
- objects that are immediately recognizable.

The interface can imply machinery without becoming a conveyor-belt management game.

The battlefield should look alive, but the alphabet system must remain the visual protagonist.

Use a coherent design-token system for:

- typography,
- spacing,
- radii,
- line thickness,
- panel depth,
- interaction states,
- semantic colors,
- focus states.

If an image-generation tool is available:

- create original assets,
- keep one consistent art direction,
- prefer transparent-background modular assets,
- record generation/source information in `docs/ASSETS.md`,
- never imitate protected characters or recognizable copyrighted game art.

If image generation is unavailable:

- use clean vector/procedural shapes during development,
- build the architecture so assets can be swapped without rewriting gameplay.

---

# 18. UI / UX INFORMATION HIERARCHY

The most important combat information is:

1. equipped Blueprint progress,
2. current shared letter pool,
3. Wildcard availability,
4. visible enemy-carried letters,
5. Core health / threat,
6. current cascade state.

Everything else is secondary.

Do not design HUD by adding every available number.

---

## 18.1 Combat HUD

Required elements:

- three Blueprint panels,
- each recipe with filled/unfilled letter states,
- current shared letter pool,
- Wildcard control,
- Core HP,
- wave/progress indicator,
- chain/cascade indicator,
- combat speed control,
- pause access.

The player's eyes should be able to move naturally:

```text
incoming letters
→ recipe nearly complete
→ resulting object
→ enemies carrying next letters
→ next recipe
```

---

## 18.2 Near-completion readability

A recipe at:

```text
B O M _
```

must visually feel different from:

```text
_ _ _ _
```

Use:

- progress fill,
- animation,
- sound accents,
- missing-letter emphasis.

Do not require the player to count tiny icons.

---

## 18.3 Menus

Production project should contain a real menu shell:

### Main menu

- Continue Run, when valid
- New Run
- Collection / Blueprint Codex
- Settings
- Credits
- Quit on desktop

### Pause menu

- Resume
- Restart Encounter when allowed by design
- Settings
- Quit to Main Menu

### Settings

At minimum:

- master volume
- music
- SFX
- UI volume if useful
- screen shake
- flashes / reduced motion
- game speed preference
- fullscreen/windowed
- resolution
- UI scale
- text scale
- input remapping when input scope expands

Use Godot Control nodes and Containers for UI.

Avoid manual pixel positioning as the primary layout strategy.

---

# 19. ACCESSIBILITY BASELINE

Plan accessibility from the beginning.

At minimum:

- readable default font size,
- UI scaling,
- strong text/background contrast,
- no required information conveyed by color alone,
- reduced screen shake,
- reduced flashes,
- adjustable combat speed or pacing support,
- keyboard and mouse operation,
- gamepad focus architecture,
- remappable gameplay controls once more controls exist,
- subtitles/captions for meaningful voiced/audio-only information if such content is added,
- tutorial text advances at the player's pace,
- simple language.

The game should remain readable in hectic cascades.

---

# 20. ONBOARDING

Teach by causing the player to perform the core loop.

Avoid a long tutorial document.

Suggested first-session sequence:

## Step 1 — Word becomes object

Give the player an encounter where BOMB naturally completes.

Show:

```text
B + O + M + B → BOMB → physical bomb
```

No explanation longer than necessary.

## Step 2 — Enemy feeds engine

Introduce an enemy visibly carrying a missing letter.

Kill it.

Animate that letter into the pool.

Immediately complete another Blueprint.

## Step 3 — Wildcard

Create a safe authored state where a Blueprint is one letter short.

Introduce `?`.

Player uses it.

Word completes.

## Step 4 — Build change

After the fight, offer a simple meaningful change to the Letter Bag.

Next fight should visibly demonstrate the consequence.

Goal:

The player understands the game's identity through actions in the first few minutes.

---

# 21. BETWEEN-ENCOUNTER REWARD SYSTEM

After most encounters, offer a small number of high-quality choices.

Initial pattern:

```text
Choose 1 of 3
```

Possible categories:

- Letter Bag modification,
- Blueprint acquire/swap,
- Machine Rule.

Avoid offering five layers of currencies.

A good reward should provoke:

> "This changes what my engine can do."

Not merely:

> "+3%."

Example choices:

```text
ADD B
Remove one tile from your bag
First vowel each cycle is duplicated
Swap FIRE for WALL
BOMB refunds one B after every third craft
Carrier letters move to the pool faster
```

Use curated constraints so reward RNG does not produce obviously useless sets repeatedly.

Implement reroll only if playtests show it is needed; do not add it automatically.

---

# 22. PROGRESSION

## 22.1 In-run progression

The run becomes stronger primarily through:

- bag specialization,
- Blueprint synergy,
- machine-rule interactions,
- engine consistency,
- cascade potential.

The player's late-run fantasy is not just larger damage numbers.

It is:

> an engine that ignites earlier, sustains itself longer, and creates increasingly absurd but understandable chains.

---

## 22.2 Meta progression

Use **horizontal unlocks**.

Allowed:

- new Blueprints,
- new starting kits,
- new Machine Rules,
- new encounter variants,
- cosmetic themes,
- codex discoveries.

Avoid permanent raw-stat upgrades such as:

- +20% starting damage,
- +50 Core HP because account level increased,
- mandatory grind gates.

A new player should be able to win through understanding, not because an account stat is too low.

---

# 23. RUN STRUCTURE

Do not add a complex branching map simply because roguelikes often have one.

Start with a simple production-ready run framework that can later support alternative route structures.

Initial target:

- short-to-medium run,
- multiple encounter groups/chapters,
- regular reward decisions,
- elites or special encounters used sparingly,
- boss encounters that test system understanding rather than only HP throughput.

A reasonable initial content target can be approximately 15–25 minutes per successful run, but tune from playtests.

Run structure must be data-driven.

Do not hardcode encounter sequence in gameplay scripts.

---

# 24. CONTENT EXPANSION RULE

After the starter six Blueprints are genuinely fun, expand gradually.

A new Blueprint is admitted only if it satisfies most of these:

1. literal word-to-object meaning is immediate,
2. it has a tactical role not already saturated,
3. it creates at least two interesting interactions,
4. its recipe changes alphabet economy decisions,
5. it is visually readable in under a second,
6. it does not require an essay of tooltip text,
7. it can be implemented without a one-off architecture hack.

Candidate future words may include:

```text
MINE
WEB
ICE
SAW
ROCK
BOW
DRONE
SHIELD
MAGNET
RAIN
LASER
```

These are candidates, not mandatory content.

Do not inflate the word count merely to advertise a large number.

Twenty meaningful Blueprints are better than two hundred shallow ones.

---

# 25. BALANCING PHILOSOPHY

Balance by function and encounter ecology before using flat stat nerfs.

Examples:

- BOMB excels at clusters but struggles against separated/flying enemies.
- FIRE excels against streams and flammable setups.
- BEE extracts specific Carrier letters.
- WALL clusters ground enemies but cannot stop flyers.
- OIL requires setup but creates powerful ignition interactions.
- FAN provides positioning rather than raw damage.

A Blueprint being strongest in one encounter is fine.

A Blueprint being the best answer to nearly everything is not.

---

# 26. BALANCE TOOLING IS A FIRST-CLASS FEATURE

Do not rely only on manual feel.

Build a deterministic simulation/debug harness using the same core domain logic as the game whenever possible.

It should be able to run many encounters without rendering and output useful metrics.

Track:

```text
seed
bag composition
equipped blueprints
machine rules
encounter id
time to first craft
craft count per blueprint
letters drawn
letters dropped
letters unused
wildcard time/target
enemy kills
core damage
chain lengths
max chain
encounter result
```

Support batch simulation.

Output aggregate summaries such as:

- win rate,
- chain distribution,
- first-craft timing,
- starvation rates,
- Blueprint utilization,
- useless reward frequency.

Do not use simulation as a substitute for human playtests.

Use simulation to detect obvious system imbalance and regression.

---

# 27. ARCHITECTURE REQUIREMENTS

Use modular scenes and pure-ish domain logic where possible.

A suggested organization:

```text
project.godot

src/
  app/
    main/
    navigation/

  core/
    rng/
    events/
    utilities/

  run/
    run_manager/
    run_state/
    rewards/
    progression/

  alphabet/
    letter_bag/
    letter_pool/
    recipe_resolver/
    wildcard/
    machine_rules/

  battle/
    battle_controller/
    encounter_director/
    cascade_tracker/
    targeting/
    battlefield/

  blueprints/
    runtime/
    definitions/
    objects/

  enemies/
    runtime/
    definitions/
    behaviors/

  ui/
    menus/
    hud/
    components/
    theme/

  audio/
  vfx/
  save/
  settings/
  debug/
  tools/

content/
  blueprints/
  enemies/
  encounters/
  rewards/
  starting_kits/
  themes/

tests/

docs/

assets/
  art/
  audio/
  fonts/
  shaders/
```

Adapt if a better Godot-native structure emerges, but preserve clear ownership.

---

# 28. GODOT ARCHITECTURE RULES

## Scenes

Scenes should be independently understandable and reusable where practical.

Avoid child scenes that require fragile hard-coded absolute node paths to unrelated systems.

Prefer:

- explicit setup methods,
- exported dependencies,
- signals,
- narrow interfaces.

## Autoloads

Use only for truly global persistent services, such as:

- SaveManager,
- SettingsManager,
- AudioManager,
- optional GameSession/Navigation service.

Do not put all gameplay logic into a global singleton.

## Signals

Use typed signals for cross-component events.

Avoid a giant global EventBus unless a concrete cross-cutting need proves it valuable.

Local parent-child signals are preferable.

## Data

Use custom `Resource` types for authored content when appropriate.

Candidate definitions:

```text
BlueprintDefinition
EnemyDefinition
EncounterDefinition
MachineRuleDefinition
RewardDefinition
StartingKitDefinition
AudioCueDefinition
```

Gameplay scripts should read content data rather than contain giant content match statements.

---

# 29. SUGGESTED DOMAIN MODELS

## BlueprintDefinition

Possible fields:

```text
id
display_name
recipe_letters
icon
description
object_scene
tags
rarity_or_unlock_group
audio_profile
tutorial_priority
```

Do not put complex runtime mutable state into the definition Resource.

---

## EnemyDefinition

Possible fields:

```text
id
display_name
scene
base_health
move_speed
core_damage
tags
carrier_rules
spawn_rules
reward_weight
```

---

## EncounterDefinition

Possible fields:

```text
id
chapter
duration_or_completion_rule
spawn_script
enemy_groups
letter_carrier_constraints
known_letter_preview
unknown_carrier_count
environment_modifiers
reward_profile
```

---

# 30. CODE QUALITY RULES

- typed GDScript for production code,
- clear naming,
- single responsibility,
- composition over giant inheritance trees,
- avoid giant manager scripts,
- no magic values scattered across scripts,
- export or define tunable balance values centrally,
- avoid per-frame allocations in hot paths,
- pool frequently spawned short-lived objects when profiling justifies it,
- keep presentation animation separate from game-state authority,
- comments explain **why**, not obvious syntax,
- remove dead code,
- do not leave commented-out abandoned implementations,
- avoid premature abstractions that have only one user and no clear extension pressure.

When refactoring, preserve behavior with tests or direct verification.

---

# 31. SAVE / SETTINGS

Implement versioned local save data.

Separate:

- settings,
- meta unlocks,
- run-in-progress state.

Handle:

- missing file,
- corrupt file,
- old schema version,
- first launch.

A save failure must not silently destroy a valid previous save.

Do not serialize arbitrary scene trees.

Persist stable IDs and data.

---

# 32. AUDIO DESIGN

Audio must teach the system.

Create distinct cues for:

- letter draw,
- letter entering pool,
- recipe slot filling,
- recipe near-complete,
- word completion,
- object spawn,
- Wildcard,
- carrier death/drop,
- cascade escalation,
- Core damage,
- reward selection.

Cascade audio may scale by chain depth, but avoid fatiguing repetition.

Music can intensify during a successful ignition, but the game must remain readable with music muted.

Do not require audio to understand essential state.

---

# 33. VFX RULES

VFX should clarify:

- cause,
- direction,
- target,
- consequence.

Every major effect should answer:

> What happened?
> What caused it?
> What will happen next?

Avoid screen-filling particle spam that makes letters unreadable.

Use object pooling if effects become numerous.

Provide reduced-motion / reduced-flash paths.

---

# 34. CAMERA

Because this is an autobattler, camera motion must not steal control from the player.

Use restrained:

- hit reactions,
- micro zoom,
- shake,
- focus framing for rare chain events.

Do not constantly pan away from Blueprint/letter information.

---

# 35. PERFORMANCE TARGETS

Target stable 60 FPS at 1080p on ordinary modern PC hardware.

Build with bursts in mind.

The game may create many:

- letter particles,
- enemy deaths,
- object spawns,
- VFX events

during cascades.

Profile actual bottlenecks.

Do not optimize blindly, but design high-frequency systems so they can be pooled/batched if needed.

Include a developer stress scene that can force:

- many enemies,
- high chain depth,
- repeated explosions,
- large letter emissions.

---

# 36. QA STRATEGY

Testing must exist at multiple levels.

## 36.1 Pure/domain tests

Test deterministic logic such as:

- bag shuffling and cycle reset,
- recipe multiset matching,
- exact letter consumption,
- multiple same letters,
- wildcard substitution,
- deterministic tie resolution,
- carrier drop insertion,
- cascade tracking,
- seeded RNG reproducibility,
- save migration.

If using a community Godot test framework, keep dependency scope small and documented.

A headless custom test/simulation runner is acceptable for deterministic game-domain logic.

---

## 36.2 Integration tests

Verify:

- completed recipe actually spawns the correct object,
- object kills an enemy,
- enemy drops exactly one intended letter,
- letter enters the pool,
- new recipe can complete from that drop,
- Wildcard changes the state correctly,
- battle ends cleanly,
- rewards transition back to combat.

---

## 36.3 Visual / UX verification

When tools allow screenshots or computer use:

Test at least:

```text
1920×1080
1600×900
1280×720
```

Verify:

- no clipped recipe text,
- no overlapping controls,
- carrier letters readable,
- focus navigation works,
- tooltip placement does not hide critical action,
- cascading VFX do not obscure recipes.

---

## 36.4 Playtest questions

For every major build, ask:

1. Can a new observer explain `BOMB → bomb` immediately?
2. Is the first interesting event early enough?
3. During a loss, can the player identify a plausible adjustment?
4. Does Wildcard create a real decision?
5. Do physical interactions create discoveries?
6. Is there enough anticipation before a craft?
7. Does a cascade feel caused by the player's engine?
8. Can the player read why a chain ended?
9. Is any one Blueprint solving most encounters?
10. Is there dead watching time?
11. Is the reward choice interesting or obvious?
12. Would the next encounter test a new theory?

Record findings in `docs/PROGRESS.md` or a dedicated playtest section.

---

# 37. INITIAL ACCEPTANCE TESTS FOR THE CORE

The project is not allowed to call the core loop healthy until these pass.

## Test A — Understandability

A fresh player should understand within seconds that:

```text
letters → word → literal object
```

without reading a paragraph.

## Test B — Agency

After a loss, the player should usually be able to name at least one build change they want to try.

## Test C — Cascade

Enemy letter drops must naturally produce visible follow-up completions in normal play.

## Test D — Intervention

Wildcard must sometimes rescue or ignite a chain, but using it immediately must not always be optimal.

## Test E — Functional diversity

BOMB cannot be the best answer to every initial encounter.

## Test F — Readability

A large chain cannot make letter recipes or carrier information unreadable.

## Test G — Reproducibility

A logged seed/state must be sufficient to investigate a surprising battle.

---

# 38. SCOPE GUARDRAILS — DO NOT ADD WITHOUT EVIDENCE

Do not add these simply because other roguelikes have them:

- free typing,
- giant dictionary,
- crossword board,
- sentence construction,
- PvP,
- asynchronous PvP,
- controllable hero movement,
- aiming,
- inventory grid,
- equipment rarity treadmill,
- letter affixes such as Burning B / Rare O,
- random crit,
- random miss,
- gacha,
- crafting tree,
- full physics sandbox,
- complex conveyor/factory grid,
- dozens of currencies,
- skill tree,
- branching overworld map,
- permanent stat grind,
- live service backend,
- multiplayer,
- daily login rewards.

Any proposal to add one must state:

1. the player problem being solved,
2. why an existing system cannot solve it,
3. added cognitive cost,
4. added production cost,
5. how it will be tested,
6. what can be removed to pay for it.

---

# 39. CONTENT ADMISSION / REMOVAL DISCIPLINE

Every system must earn its complexity.

When a mechanic is weak:

- first try simplifying or deleting it,
- do not automatically add another mechanic to compensate.

Maintain a small `CUT / PARKING LOT` section in `docs/DECISIONS.md`.

The game should become **deeper through interaction**, not deeper through the number of independent subsystems.

---

# 40. UI IMPLEMENTATION RULES

In Godot:

- use `Control` nodes for UI,
- use Containers for layout,
- centralize reusable styling in Theme resources,
- support focus navigation,
- avoid manually hardcoding every pixel position,
- use anchors appropriately,
- keep HUD and menu scenes modular,
- localize player-visible strings through translation keys from the beginning.

Even if English is the only shipping language initially, do not hardwire UI architecture so tightly that localization becomes a rewrite.

The game title and letter Blueprint words may require special handling in localization; document that separately.

---

# 41. LOCALIZATION DESIGN NOTE

This game is mechanically based on letter recipes.

Therefore localization is not a trivial text replacement problem.

Do **not** automatically translate combat recipes into other languages.

Architect the game so:

- UI text is localizable,
- Blueprint display word/recipe can remain a designed gameplay token,
- tooltip can explain meaning in the selected language,
- future language-specific recipe packs are possible but not required.

Record this constraint clearly in `docs/CONTENT_RULES.md`.

---

# 42. ANALYTICS FOR DEVELOPMENT

Implement local development telemetry/logging, not invasive production tracking.

Useful events:

```text
run_start
encounter_start
first_craft
blueprint_craft
carrier_killed
letter_dropped
wildcard_used
cascade_started
cascade_ended
encounter_win
encounter_loss
reward_offered
reward_selected
run_end
```

For development builds, support export to JSON/CSV.

No external analytics SDK is necessary unless explicitly requested.

---

# 43. DEBUG TOOLS

Create developer tooling that makes iteration faster.

Useful debug capabilities:

- set run seed,
- inspect Letter Bag order,
- instantly equip Blueprints,
- spawn chosen enemy archetype,
- assign a carrier letter,
- force a Wildcard charge,
- slow time,
- accelerate time,
- show collision/targeting debug,
- display current shared letter counts,
- display current chain depth,
- jump to reward screen,
- reset encounter,
- stress-test cascade.

Debug UI must be disabled in release builds.

---

# 44. PRODUCTION MILESTONES

Build in coherent slices, but remember: this is a continuing production project, not a disposable prototype.

## M0 — Project foundation

Deliver:

- clean Godot project,
- repository instructions,
- docs structure,
- base navigation,
- settings foundation,
- data definitions,
- deterministic RNG foundation,
- test harness,
- development logging.

Exit criteria:

- project launches cleanly,
- basic automated tests run,
- architecture docs match the repository.

---

## M1 — Core ignition loop

Deliver:

- Letter Bag,
- shared pool,
- recipe resolver,
- 3 Blueprint slots,
- BOMB / FIRE / BEE,
- basic enemies,
- carrier letters,
- Wildcard,
- cascade tracker,
- minimal combat HUD,
- encounter win/loss.

Exit criteria:

- complete letter → object → kill → letter → word loop works,
- no manual debug intervention required,
- deterministic seed can reproduce a fight,
- first balance simulation report exists.

---

## M2 — Systemic combat

Deliver:

- WALL / FAN / OIL,
- semantic interaction tags,
- Swarm / Runner / Flying Carrier encounter differences,
- object interactions,
- stronger audiovisual feedback,
- readable chain escalation.

Exit criteria:

- at least three naturally discoverable object interactions,
- no one starter Blueprint dominates every authored encounter,
- large chains remain readable.

---

## M3 — Run buildcraft

Deliver:

- post-encounter rewards,
- bag editing,
- Blueprint acquire/swap,
- first Machine Rules,
- run state,
- save/continue,
- run failure/success flow,
- starting kit data.

Exit criteria:

- player can form meaningfully different builds across runs,
- reward offers rarely contain three dead choices,
- changing bag composition produces visible combat consequences.

---

## M4 — Real game shell

Deliver:

- main menu,
- codex/collection,
- settings,
- onboarding,
- pause flow,
- accessibility baseline,
- polished HUD,
- audio mix,
- art-direction pass,
- run results.

Exit criteria:

- game can be given to a new person without developer explanation,
- all main flows are reachable without debug UI.

---

## M5 — Content expansion

Expand only from evidence.

Target a modest but meaningful content set rather than a bloated one.

Potential target for an early production alpha:

- 12–20 Blueprints,
- 6–8 enemy archetypes,
- several authored encounter families,
- 2–3 bosses,
- 12–20 Machine Rules,
- multiple starting kits,
- enough combinations for distinct run identities.

Every new piece of content must follow `CONTENT_RULES.md`.

---

## M6 — Balance, performance, release preparation

Deliver:

- batch simulation reports,
- human playtest findings,
- performance stress results,
- bug triage,
- save migration tests,
- accessibility review,
- export verification,
- credits/license audit,
- release checklist.

---

# 45. DO NOT STOP AT "IT WORKS"

For every major mechanic, ask three levels of quality:

## Functional

Does it technically work?

## Legible

Can the player understand cause and effect?

## Desirable

Does it create anticipation, decision, payoff, or discovery?

A technically correct system that is boring is not complete.

---

# 46. SELF-PLAY LOOP FOR THE AGENT

Whenever your environment lets you run or interact with the game:

1. launch the latest build,
2. play multiple encounters,
3. deliberately try weak and strong builds,
4. use Wildcard early and late,
5. try to starve recipes,
6. create overlap between Blueprints,
7. force long cascades,
8. observe UI at multiple resolutions,
9. record bugs/friction,
10. fix the highest-impact issues,
11. replay.

When comparing the current build to this design brief:

- identify the most important missing experience,
- implement only a few coherent improvements at a time,
- test each,
- prioritize regressions before adding novelty.

Do not endlessly add features while known foundational bugs remain.

---

# 47. AGENT DECISION POLICY

When the brief is silent:

Prefer the solution that is:

1. easier for the player to understand,
2. easier to test,
3. more deterministic,
4. more data-driven,
5. more reusable,
6. less likely to require future rewrites.

If two designs are similar in quality, choose the simpler one and record the assumption.

Do not interrupt development for minor preferences that can be safely chosen and documented.

Ask for human direction only when the decision would significantly change:

- game identity,
- monetization,
- platform,
- art direction,
- target audience,
- accessibility promise,
- major scope,
- save compatibility.

---

# 48. DEFINITION OF DONE FOR A FEATURE

A feature is done only when applicable items are complete:

- gameplay behavior implemented,
- authored data separated from runtime logic,
- player feedback exists,
- UI state exists,
- edge cases handled,
- automated/domain tests added,
- integration behavior tested,
- visual behavior inspected,
- no new obvious errors in logs,
- documentation updated,
- tuning values centralized,
- accessibility impact considered,
- performance impact considered,
- no dead placeholder button remains.

---

# 49. FIRST TASK

Start now.

## If the repository is empty

1. Bootstrap a **Godot 4.7.2 stable** project.
2. Create the production documentation structure.
3. Write `AGENTS.md` summarizing the non-negotiable project rules and verification workflow.
4. Define the architecture and data-model plan.
5. Implement the deterministic alphabet domain layer first:
   - seeded RNG,
   - Letter Bag,
   - shared Letter Pool,
   - Blueprint recipe definition,
   - recipe resolver,
   - Wildcard substitution,
   - cascade event model.
6. Add tests for that domain layer.
7. Build the first playable battle slice with BOMB.
8. Extend to FIRE and BEE.
9. Add Carrier enemies.
10. Verify a real:

   ```text
   LETTER
   → WORD
   → OBJECT
   → KILL
   → LETTER
   → WORD
   ```

   chain.
11. Then proceed through the production milestones in priority order.

## If the repository already exists

1. Read the project and instructions.
2. Run the current build.
3. Compare it against this brief.
4. Write an audit into `docs/PROGRESS.md`.
5. Preserve working systems.
6. Identify the smallest architectural corrections required.
7. Continue from the highest-value incomplete milestone.

---

# 50. FIRST VISUAL QUALITY BAR

Do not ship the first playable slice as a collection of default gray Godot controls.

Even during early production, establish enough identity that playtests evaluate the intended experience.

For the first slice, ensure:

- letter tiles feel physical,
- Blueprints are easy to scan,
- word completion has a strong transformation,
- BOMB has satisfying anticipation and impact,
- carrier letters are obvious,
- Wildcard feels special,
- cascade escalation is visible,
- the UI does not resemble a generic dashboard.

Use simple original shapes if polished art is not yet available, but apply coherent typography, spacing, motion, and feedback.

---

# 51. SUCCESS CRITERIA FOR THE PROJECT

This project is succeeding when players naturally say things resembling:

> "I only needed one M."

> "I should have saved the Wildcard."

> "If BEE kills that carrier first, BOMB should start."

> "Wait — FAN can push the bomb?"

> "My build finally started looping."

> "I want to try one more fight with this change."

It is failing when players mostly say:

> "I was just waiting."

> "I don't know why I lost."

> "I got unlucky."

> "All the words basically just deal damage."

> "BOMB is always best."

> "There is too much UI to read."

> "This is Scrabble with combat."

Use those reactions as design diagnostics.

---

# 52. FINAL PROJECT MANTRA

Protect this chain:

```text
RANDOM INPUT
→ PLAYER-SHAPED ENGINE
→ READABLE ANTICIPATION
→ TINY INTERVENTION
→ LITERAL PAYOFF
→ COMBAT-GENERATED LETTERS
→ SELF-FEEDING CASCADE
→ BUILD THEORY
→ ONE MORE ENCOUNTER
```

The hook and the retention loop must be the **same system**.

Do not let future features separate them.

Build the alphabet.

Let it manufacture war.
