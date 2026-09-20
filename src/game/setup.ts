/** Builds a live battle from run state. Shared by the app shell and by tests. */
import { Battle, type Setup } from './battle';
import { applyBoons, previewWave, rngFor, type RunState } from './run';

export function buildBattle(run: RunState): Battle {
  const wave = previewWave(run);
  const setup: Setup = {
    rng: rngFor(run, 7),
    wave,
    coreHp: run.core,
    maxCoreHp: run.maxCore,
    flux: run.flux,
    fluxMax: run.fluxMax,
    weapons: run.placed.map((p) => ({ def: applyBoons(p.def, run), lane: p.lane, slot: p.slot })),
    // The engine multiplier is deliberately not part of boons: charge is spent.
    engineBonus: 0.8 + run.boons.fluxGain * 0.1,
    abilityCost: {
      purge: Math.round(40 * (1 - run.boons.discount)),
      surge: Math.round(60 * (1 - run.boons.discount)),
    },
  };
  return new Battle(setup);
}
