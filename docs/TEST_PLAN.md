# TEST_PLAN

## Strategy

Three layers, cheapest first. Anything that can be verified headlessly must be,
because this environment has no GPU and no browser — but the harness runs the
**real** game code, so "headless" here does not mean "mock".

1. **Type layer** — `npm run typecheck` (TypeScript strict, `noUnusedLocals`,
   `noUnusedParameters`, `verbatimModuleSyntax`). Catches most refactor damage
   instantly and is run before every commit.
2. **Behaviour layer** — `tools/shoot.mjs sim`: full runs stepped at a fixed
   1/120 s, printing balance statistics. This is how both correctness (does a
   run finish?) and feel-target numbers are checked.
3. **Visual layer** — `tools/shoot.mjs shot`: renders the real `App` on a Node
   canvas and writes a PNG, with scripted clicks and overlays. This is the only
   way UI regressions are caught here, and it has caught real ones (overlapping
   tray labels, clipped bag strips, card text colliding with craft counters).

## What must be verified before a change is called done

| Change | Verification |
| --- | --- |
| Any TypeScript | `npm run typecheck` clean |
| Battle/balance numbers | `sim --runs=10` on all three kits, compared against `BALANCE.md` |
| HUD/screens | `shot` for the affected screen, PNG actually looked at |
| Bag/pool/rule logic | `sim` run plus a determinism check (below) |
| New blueprint | buildable from at least one kit's bag; `limit` declared |
| New encounter | appears in a `sim` run; completion rate not degraded |
| Copy/localisation | rendered shot in Vietnamese, diacritics intact |

## Determinism check

Same seed must produce the same run. Compare two `sim` invocations at
`--seed=20240920 --runs=1` and diff the per-encounter report; they must match
exactly. Any divergence means a stream was shared or wall-clock time leaked into
the simulation — treat as a bug, not a flake.

## Automated checks (planned, not yet in the repo)

The domain layer is written to be testable with the Node test runner
(`node --test`), with tests kept **outside** `tsconfig`'s `src` include so they
never ship. Highest-value cases to add:

- `LetterBag` — cycle exhaustion reshuffles, `remaining` is correct, draws are
  reproducible per seed.
- `LetterPool` — `take` consumes in order, `takeAllBut` never over-consumes,
  deficits are reported exactly.
- Recipe resolver — multiset matching, duplicate letters (`BOMB` needs two `B`s),
  wildcard substitution picks the right missing letter.
- Machine-rule hooks — each rule fires exactly once where it claims to.
- Same-seed determinism (above).
- Stall/breach — a passive build still terminates an encounter within
  `stallSeconds` of the last spawn.

## Acceptance tests from the brief (A–G)

| | Test | Status |
| --- | --- | --- |
| A | A player can explain the loop after one encounter | Passes by design (ch1-ignition opening pool); unvalidated by real players |
| B | First craft lands 2–4 s after combat starts | Passes (2.93–4.71 s by kit) |
| C | Killing a carrier visibly returns its letter to the pool and advances the next craft | Passes |
| D | A cascade of ≥3 is achievable and readable | Passes (mean 3.2–4.4, max 15) |
| E | Wildcard is a decision, not a guess | Passes (charge count + exact word + exact missing letter shown) |
| F | A reward visibly changes the machine | Passes (bag/rule/blueprint/repair all mutate observable state) |
| G | A run can be lost, and the loss is attributable | Passes (breach shows countdown before it lands) |

## Manual test script (for a human, ~10 minutes)

1. Launch, select **Assembly**, and start a run.
2. Do nothing for two seconds. Confirm a `BOMB` completes on its own during
   encounter 1 and that you can see the letters fly.
3. Kill a carrier. Confirm the letter badge was visible *before* the kill.
4. Chain three crafts inside a few seconds. Confirm the chain box escalates.
5. Use the wildcard when a card shows one missing letter. Confirm it filled
   exactly what was advertised.
6. Let an enemy reach the core. Confirm you can see the breach countdown first.
7. Take each reward type once; confirm the run summary attributes crafts to the
   right blueprints.
8. Switch language in settings and re-check all HUD text for clipping.

## Known gaps

- No unit tests exist yet (see planned list above).
- No automated screenshot diffing; the visual layer relies on a human (or agent)
  looking at the PNG.
- Feel, tension and audiovisual quality are **not** measurable by this plan, and
  the project has only ever had two players: the author and the harness.
