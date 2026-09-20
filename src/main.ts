/** Boot the engine. */
import { App } from './app';
import { createTitleScreen } from './ui/screens/title';
import { createForgeScreen } from './ui/screens/forge';
import { createBattleScreen } from './ui/screens/battle';
import { createSpoilsScreen } from './ui/screens/spoils';
import { createMarketScreen } from './ui/screens/market';
import { createShrineScreen } from './ui/screens/shrine';
import { createSummaryScreen } from './ui/screens/summary';
import { createHelpScreen } from './ui/screens/help';
import { Battle } from './game/battle';
import { applyBoons, previewWave, rngFor } from './game/run';
import { sfx } from './core/audio';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #stage');

const app = new App(canvas);

// The forge needs to hand a fully built battle to the battle screen. Rather than
// letting the forge know about battle internals, the app builds it on entry.
const forgeScreen = createForgeScreen();
const battleScreen = createBattleScreen();

const withBattleBuild: typeof battleScreen = {
  ...battleScreen,
  enter(a) {
    const run = a.run;
    if (run) {
      const wave = previewWave(run);
      const rng = rngFor(run, 7);
      a.battle = new Battle({
        rng,
        wave,
        coreHp: run.core,
        maxCoreHp: run.maxCore,
        flux: run.flux,
        fluxMax: run.fluxMax,
        weapons: run.placed.map((p) => ({ def: applyBoons(p.def, run), lane: p.lane, slot: p.slot })),
        engineBonus: 0.8 + run.boons.fluxGain * 0.1,
        abilityCost: {
          purge: Math.round(40 * (1 - run.boons.discount)),
          surge: Math.round(60 * (1 - run.boons.discount)),
        },
      });
    }
    battleScreen.enter?.(a);
  },
  exit(a) {
    battleScreen.exit?.(a);
  },
};

app.register(
  createTitleScreen(),
  forgeScreen,
  withBattleBuild,
  createSpoilsScreen(),
  createMarketScreen(),
  createShrineScreen(),
  createSummaryScreen(),
  createHelpScreen(),
);

// start on the title
app.goto('title');

let last = performance.now();
let acc = 0;
const STEP = 1 / 120;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  while (acc >= STEP && guard++ < 8) {
    app.update(STEP);
    acc -= STEP;
  }
  app.draw();
  requestAnimationFrame(frame);
}

// hide the boot splash once the first frame is on screen
requestAnimationFrame((now) => {
  last = now;
  frame(now);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('gone');
    window.setTimeout(() => boot.remove(), 600);
  }
});

// first gesture unlocks the audio context
const unlock = (): void => {
  sfx.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

