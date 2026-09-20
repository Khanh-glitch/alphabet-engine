# PROGRESS

**Milestone:** M2 complete — systemic combat is in and verified. M3 (run
buildcraft) is playable end-to-end.

## §3.6 object limits

Hard per-blueprint caps no longer gate crafts (rework brief 3.6). Only an emergency
global ceiling of 220 objects remains, logged and counted when hit. Measured as a
near-null result: +2.6% crafts per encounter on the shipped set, 0% on the
evaluation set. `docs/V2_AUDIT.md` §13 records both the measurement and the reason
the brief's premise does not hold in this build — the letter economy is the real
constraint, not object count.

## What the repository contains

A playable browser build of Alphabet Engine: title → kit select → 8 encounters
with reward choices between them → run summary, with a codex and settings.

## Audit of the pre-existing repository (honest record)

The repository arrived with an undocumented working tree: ~9,100 lines of a
different game (a Scrabble-rack lane defence where you drag words from a rack
onto weapons). It was committed verbatim as
`checkpoint: preserve existing browser prototype` before any rebuild, so nothing
was lost, and it is auditable in history.

It did not match this brief. The gaps that mattered:

| Requirement | Old prototype | Now |
| --- | --- | --- |
| Language / target | it is not Godot | Godot 4.7.2 is unreachable from this environment (see DECISIONS) |
| Recipe model | free-form dictionary word search | curated blueprints |
| Letter economy | a rack you drag from, refreshed between fights | bag → shared pool → crafts, mid-combat |
| Enemy letters | generic loot after combat | visible carriers, fuel **during** combat |
| Cascades | a damage combo counter | the core loop (chain ×2–×9 observed) |
| Intervention | several abilities bound to flux | one wildcard `?` |


## V2 rework in progress

A large gameplay rework is underway against `docs/GAMEPLAY_REWORK_V2.md`, which
replaces the abstract shared pool with visible recipe sockets, adds Focus and
Target Mark as steering mechanics, and replaces the timer-based chain with true
causal provenance. Status per phase: `docs/V2_STATUS.md`.

Phases V2.0, V2.1 and V2.2 are complete and the playable build now runs on the V2
model. See `docs/V2_STATUS.md` for detail and `docs/V2_BASELINE.md` for the
before numbers.

**V2.3–V2.5 landed:** letters physically travel into the socket they were routed
to; the wildcard resolves a specific visible socket and travels there; enemies
can be marked and BEE hunts the mark first. `fx.ts`'s old V1 flying-letter system
was deleted rather than left running alongside the new one.

**V2.6–V2.7, V2.9 landed.** The causal cascade is now visible (a chained letter
carries a link mark and the name of the word that produced it) and it drives the
machine: a deeper craft speeds up the bag interval, and the chain — and the speed
— end when the cascade's own object dies, not on a timer. V1's `chainWindow` and
the HUD's timer-based chain flag are deleted, so there is one authority for what
a cascade is.

**V2.9 landed:** a purpose-built three-encounter evaluation set (`BỘ THỬ V2`),
with no machine rules, no attrition and no reward screens between fights, plus
`npm run bots` — three bots (passive, steer, steer-without-mark) so each steering
mechanic can be shown to matter instead of assumed to. The tooling immediately
paid for itself: it showed the brief's own hypothesis bag made Focus worth
+1.4 %, and that Mark currently moves crafts by ~1 %. See `docs/V2_AUDIT.md`.

**V2.2 landed:** one source of truth for letter state. `Battle.pool` is gone,
replaced by `Battle.machine`; every letter — bag draw, carrier drop, wildcard,
rule injection, refund — enters through a single `feed()` gate, which is what
makes Focus provable rather than decorative. Focus is bound to click and 1/2/3,
defaults to the first recipe so the mechanic is visible from frame one, and is
drawn as corner brackets plus a labelled chip (never colour alone).

Chain depth is now causal, not temporal: `src/alphabet/provenance.ts` records
what each craft consumed, and a craft is one deeper than the deepest craft that
fed it.

## Working

- **Onboarding**: a four-step "how to play" panel, auto-shown before the first
  decision and reachable from the title screen and the battle `?` button, plus
  teaching hints that spotlight the panel they describe.

- Deterministic domain layer: seeded streams, `LetterBag`, `LetterPool`,
  recipe resolver, wildcard substitution, machine-rule hooks, trace log.
- Battle simulation: spawn director, bag feed, craft beats, object behaviours
  (bomb/fire/bee/wall/fan/oil/mine/saw/web/ice), enemies (mote/runner/flyer/
  brute/boss), tag interactions, stall guard, telemetry.
- Full HUD at the required information hierarchy; word-completion beat; cascade
  feedback; danger state.
- 8 authored encounters + opening pools + carrier guarantees.
- 3 kits, 10 machine rules / tweaks, reward generator with bag, rule, blueprint
  and repair offers, run summary with per-blueprint contribution.
- Codex, settings (audio, comfort, language, speed), pause, run persistence.
- Vietnamese-first UI with full diacritic coverage; English toggle.
- Headless verification harness (`tools/shoot.mjs`) for both screenshots and
  balance reports.

## Partially working / rough edges

- **Enemy attack on the core is abstract**: enemies reaching the core deduct
  health and die. There is no breach animation beyond the vignette and sound.
- **Web / ICE / Saw / Mine** are implemented and craftable but have thin
  authoring: they appear mainly through rewards, so they are rarely seen.
- **Boss escort spawning** uses a fixed interval rather than authored pressure
  phases.
- **Meta progression is a stub**: the codex records discoveries and best chain,
  nothing unlocks yet. Deliberately deferred (see DECISIONS).
- Card "needs …" hints are suppressed on crowded rows, so a rare layout loses
  the explicit hint and relies on the empty tile.

## Known bugs

The audit in `docs/GAMEPLAY.md` §16 lists every discrepancy found between what
the game displays and what it does. Nine remain open, all of them
design decisions rather than crashes — dead tuning entries
(`TUNE.bomb.knockback`, `TUNE.wall.cooldown`, `TUNE.juice.*`, `TUNE.encounterTarget`,
`TUNE.wildcardCharges`), the five-lane constant duplicated four times, `FIELD.spawnX`
declared but unused, layout maths leaking into `stepBee`, boss escorts skipping
chapter scaling, and `bagDuplicate` being implemented identically to `bagAdd`.

Recently fixed and worth remembering:

- `BBOM` printed on cards — recipes now spell their word (`BOMB`).
- Structural builds (WALL/FAN) could stall an encounter indefinitely; fixed with
  per-blueprint concurrency limits plus a visible breach countdown.
- The bastion kit was unwinnable because `MINE` needs an `E` its bag did not
  contain; fixed by authoring the bag against all three recipes.

## Next five highest-value tasks

1. Playtest pacing by hand (the harness cannot judge feel): confirm the first
   craft lands before the player gets bored and that the wildcard decision is
   tense. **Blocked on player feedback — the build is live for exactly this.**
2. Give the four thin blueprints (MINE, SAW, WEB, ICE) authored homes: encounters
   whose guaranteed letters point at them.
3. Replace the flat boss escort timer with phases that change the *shape* of the
   fight.
4. Cascade "juice" pass: the chain counter is readable, but escalation beyond ×4
   deserves a distinct audiovisual tier (per the brief's 16.2).
5. Core breach feedback: an enemy reaching the core should visibly impact it,
   not just subtract health.

## Current risks

- **Balance floor, not skill ceiling.** The balance report plays a naive "take
  the first offer" player, so numbers describe a floor. A thoughtful player will
  do better; how much better is unmeasured.
- **Only two hands have played this** (the author and the verification harness).
  Feel-level conclusions are unvalidated.
- **Vietnamese wording** was written in-language, not localised from English;
  a native review pass is advisable before treating the text as final.
- The environment cannot run Godot, so if the brief's target engine is
  mandatory, the port is a real cost — see `docs/DECISIONS.md` D-001.
