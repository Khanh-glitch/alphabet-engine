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

## Phase V2.2 — Focus  ⬜ next

Wire `Machine` into `Battle`: replace `stepBag`, `resolveCrafts`, `beginCraft`,
`useWildcard`, the kill path and the refund/rule paths. Add click / 1-2-3 focus
input. Acceptance for this phase is a deterministic test showing the same
incoming sequence produces different allocation under different Focus choices —
that test already exists at the domain level and must hold through the battle.

## Phases V2.3 – V2.9  ⬜ not started

Visible letter flight · wildcard socket insertion · Mark + BEE · provenance and
true causal cascade · momentum · spatial simplification · three authored
encounters.

## Sequencing note

§3.8–§3.12 freeze content (three Blueprints, one kit, three encounters, no run
attrition) during evaluation. Those are cheap and could land early, but they
would change what the current build *plays like* without changing how it
*works*, which would confuse a playtest. They land with V2.2, when the first
real V2 build becomes playable.
