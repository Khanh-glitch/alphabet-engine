# V2 Baseline — measured before the rework

Captured at commit `e325e82`, before any V2 phase. Every number below comes from
`node tools/shoot.mjs sim --runs=8 --kit=<kit>`. This is the "before" side of the
comparison §21 of `GAMEPLAY_REWORK_V2.md` asks for.

## Verification state at baseline

```
npm run typecheck   clean
npm test            17/17 pass
npm run build       clean
```

## Measured metrics

| Metric | assembly | bastion | hunter | V2 target |
| --- | --- | --- | --- | --- |
| Encounters cleared (of 8) | 6.63 | 4.50 | 5.25 | n/a in V2 mode |
| First craft (s) | 3.68 | 4.50 | 2.97 | 2–4 |
| Encounter duration (s) | 16.17 | 16.48 | 16.48 | 8–15 |
| Longest chain | 2.90 | 2.73 | 3.14 | 2–4 common |

## What the baseline cannot tell us

The V2 brief is explicit that the current chain metric is **wrong**, not merely
mis-tuned: it measures temporal density over a 2.2 s window, so two crafts that
happen to land close together count as a cascade even when no letter from the
first caused the second. Every "longest chain" number above is therefore an
upper bound on real cascades, and the true causal figure is unknown.

The baseline also does not measure any V2 mechanic, because none exist yet:
Focus switches, contested letters, Focus-influenced assignments, reserve
overflow, marks placed, or combat-fed vs bag-only crafts.

Per §12.4 these become the primary comparison metrics once Phase V2.6 lands.
