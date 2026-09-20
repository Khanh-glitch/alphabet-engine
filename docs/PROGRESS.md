# PROGRESS

**Milestone:** M2 complete — systemic combat is in and verified. M3 (run
buildcraft) is playable end-to-end.

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

None outstanding that are reproducible in the harness. Recently fixed and worth
remembering:

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
