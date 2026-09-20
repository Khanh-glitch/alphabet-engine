# V2 Rework — status

Tracking `docs/GAMEPLAY_REWORK_V2.md`. Phases are done in the order §15 mandates;
none may be skipped, because each one is the foundation the next assumes.

## Phase V2.0 — Safety branch  ✅ done

- Baseline captured before any change (`docs/V2_BASELINE.md`).
- `npm run typecheck` clean, `npm test` 17/17, `npm run build` clean.
- Baseline sim recorded for all three kits.
- The baseline note records honestly that the existing chain metric measures
  temporal adjacency over a 2.2 s window, **not** causality, so every V1
  "longest chain" figure is an upper bound on real cascades.

## Phase V2.1 — Socket domain model  ✅ done

`src/alphabet/sockets.ts`. Shared pool replaced as the *player-facing* model by
per-Blueprint recipe sockets; the pool survives internally as the reserve.

Implemented per §3.1.1 / §3.1.2:

| Requirement | State |
| --- | --- |
| `RuntimeLetter` with source union + provenance id | ✅ |
| `RecipeSocket { requiredChar, letter }` | ✅ |
| Unassigned buffer / reserve | ✅ cap is a constructor arg (§3.1.2 says do not finalize) |
| Case A — sole candidate assigns automatically | ✅ |
| Case B — contested routes to Focus, ineligible Focus falls back to slot order **and is reported as a fallback** | ✅ |
| Case C — nobody wants it → reserve, overflow counted not silent | ✅ |
| Focus state + `setFocus` | ✅ |
| Focus telemetry (`focusSwitches`, `contestedLetters`, `focusedAssignments`, `fallbackAssignments`, `reserveOverflow`) | ✅ |
| Wildcard target query + socket insertion | ✅ |
| Deterministic | ✅ asserted by test |

Tests: 18 added, **35 total, all passing**. Covers exactly the cases §15/V2.1
lists — duplicate letters, one eligible, multiple eligible, reserve, exact
completion — plus determinism and the Focus-changes-allocation acceptance test.

**Not yet wired into `Battle`.** This is deliberate: the brief says V2.1 needs
"no new visuals beyond basic debugging at first", and wiring the machine into the
simulation is a 23-call-site refactor across three files. Doing half of it would
leave the playable build broken, so it is its own phase.

## Phase V2.2 — Focus  ✅ done
## Phase V2.3 — Visible letter flight  ✅ done
## Phase V2.4 — Wildcard socket insertion  ✅ done
## Phase V2.5 — Mark + BEE  ✅ done
## Phase V2.6 — Provenance + true causal cascade  ✅ done

See `docs/V2_AUDIT.md` for the measured result of all five, including the
mechanics that turned out not to matter.

## Phase V2.7 — Momentum  ✅ done

Cascade depth now accelerates the machine itself: the bag interval is divided by
the current multiplier, and nothing multiplies damage. One lever only, as §8.3
requires; no second speed bonus is stacked.

The brief's hypothesis ladder (depth 2 → 1.05× … 5+ → 1.20×) was measured and
rejected: on the evaluation set it averaged ×1.014, because 64 % of crafts are
depth 1. It was invisible in play. `npm run bots` sweeps the whole curve, and the
useful result is that the reward only becomes felt around ×1.11 and that past
about ×1.35 raw machine speed starts substituting for routing skill — the RISK E
failure mode. Shipped ladder is `[1, 1.12, 1.18, 1.24, 1.30, 1.30]`, averaging
×1.11, worth about +9 % crafts and −7 % core damage while leaving the steering
gap intact.

§8.4 is implemented causally, not by timer: a chain stays open while the object it
produced is alive, or while kills that object caused are still landing, then it
falls back to depth 1. V1's `TUNE.chainWindow` and the HUD's timer-based
`chainActive` flag are deleted — the chain box and the momentum readout are both
driven by the causal chain, so there is no second definition of "a cascade".

The momentum readout (`⚡×1.11`) sits inside the bag box, next to the cycle
counter, and only appears while it is above 1.015 — it is the thing that speeds
the bag up, and it stays silent the rest of the time.

## Phase V2.9 — Evaluation set, bots and dead-watch  ✅ done

Landed ahead of V2.8 because the V2.6 audit named it the highest-value next step:
without a kit authored for the new mechanics, Focus measured 0 wins out of 55
contested letters and the mechanic looked broken when it was the content that was.

`BỘ THỬ V2` is reachable from the kit picker like any other kit. `Run.mode` picks
the encounter list, so the standard eight-encounter run and the three-encounter
evaluation set coexist without either being a special case in the screens, and
pause/wave counts follow the run rather than a module constant.

`npm run bots` implements the brief's passive / steering bots plus `steer-nomark`,
identical to the steering bot except that it never marks, which is what isolates
Mark's contribution.

## §3.6 — Hard object limits  ✅ done, measured as a null result

Per-blueprint caps no longer block crafts; only an emergency global ceiling of 220
objects remains, and hitting it is logged and counted rather than making a common
recipe fail silently. Each object's natural lifetime is now what keeps the field
readable.

A/B over 96 fights per side (shipped) and 36 (evaluation set): **7.35 -> 7.54
crafts per encounter on the shipped set (+2.6%) and 7.39 -> 7.39 on the evaluation
set (0%)**, with peak simultaneous objects of 5-7 against limits of 4-6 and the
emergency ceiling never reached.

The brief's premise — that caps suppress the late-run engine — does not hold.
The binding constraint is the letter economy, not object count. Kept because the
brief mandates it and it removes a latent failure mode, but `docs/V2_AUDIT.md` §13
records that it did not make the engine stronger.

## Phase V2.8 — Spatial simplification  ⬜ not started

## Phases V2.3 – V2.6  ✅ done

Visible letter flight, wildcard socket insertion, Mark + BEE, provenance and true
causal cascade. Measured results in `docs/V2_AUDIT.md`.
