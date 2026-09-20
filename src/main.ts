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
import { buildBattle } from './game/setup';
import { sfx } from './core/audio';

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #stage');

const app = new App(canvas);

// The battle screen is handed a fully built battle so it never has to know how
// one is assembled.
const forgeScreen = createForgeScreen();
const battleScreen = createBattleScreen();
const withBattleBuild: typeof battleScreen = {
  ...battleScreen,
  enter(a) {
    if (a.run) a.battle = buildBattle(a.run);
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

