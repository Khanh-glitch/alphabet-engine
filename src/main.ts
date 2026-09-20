/**
 * Entry point: wires the screens, restores saved state and runs the fixed-step
 * frame loop. Deterministic simulation, presentation on top.
 */
import './styles.css';
import { App } from './app/app';
import { store } from './core/save';
import { sfx } from './core/audio';
import { setLang } from './core/i18n';
import { trace } from './alphabet/trace';
import { RUN } from './content/encounters';
import { Run } from './run/run';
import type { Battle } from './battle/battle';
import { createTitleScreen } from './ui/screens/title';
import { createKitScreen } from './ui/screens/kit';
import { createBattleScreen } from './ui/screens/battle';
import { createSpoilsScreen } from './ui/screens/spoils';
import { createSummaryScreen } from './ui/screens/summary';
import { createCodexScreen } from './ui/screens/codex';
import { createSettingsScreen } from './ui/screens/settings';

declare global {
  interface Window {
    /** Debug surface used by the headless screenshot/balance harness. */
    __AE?: {
      app: App;
      goto: (id: string) => void;
      startRun: (seed: number, kitId: string) => void;
      battle: () => Battle | null;
      advanceTime: (seconds: number, step?: number) => void;
      traceDump: () => string;
      run: () => Run | null;
    };
  }
}

const canvas = document.getElementById('stage') as HTMLCanvasElement | null;
if (!canvas) throw new Error('missing #stage');

store.load();
setLang(store.settings.lang);
sfx.applySettings(store.settings);
trace.enabled = store.settings.trace;
if (store.settings.music > 0) sfx.startMusic();

const app = new App(canvas);

app.register(
  createTitleScreen(),
  createKitScreen(),
  createBattleScreen(),
  createSpoilsScreen(),
  createSummaryScreen(),
  createCodexScreen(),
  createSettingsScreen(),
);

// Resume a suspended run, or start clean on the title.
if (store.suspendedRun) {
  const restored = Run.deserialize(store.suspendedRun);
  if (restored && !restored.finished) {
    app.run = restored;
    app.goto(restored.pendingRewards.length > 0 ? 'spoils' : 'battle');
  } else {
    store.saveRun(null);
    app.goto('title');
  }
} else {
  app.goto('title');
}

let last = performance.now();
let acc = 0;
const STEP = 1 / 120;

function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  acc += dt;
  let guard = 0;
  // The battle screen runs its own fixed-step loop so that changing the combat
  // speed never changes simulation outcomes.
  while (acc >= STEP && guard++ < 8) {
    app.update(STEP);
    acc -= STEP;
  }
  app.draw();
  requestAnimationFrame(frame);
}

requestAnimationFrame((now) => {
  last = now;
  frame(now);
  const boot = document.getElementById('boot');
  if (boot) {
    boot.classList.add('gone');
    window.setTimeout(() => boot.remove(), 600);
  }
});

const unlock = (): void => {
  sfx.unlock();
  window.removeEventListener('pointerdown', unlock);
  window.removeEventListener('keydown', unlock);
};
window.addEventListener('pointerdown', unlock);
window.addEventListener('keydown', unlock);

// Debug hooks, opt-in via ?debug=1 so normal play stays clean.
if (new URLSearchParams(window.location.search).has('debug')) {
  app.debug = true;
  window.__AE = {
    app,
    goto: (id) => app.goto(id),
    startRun: (seed, kitId) => {
      app.run = Run.create(seed, kitId);
      app.goto('battle');
    },
    battle: () => app.battle,
    run: () => app.run,
    advanceTime: (seconds, step = 1 / 120) => {
      const battle = app.battle;
      if (!battle) return;
      const steps = Math.floor(seconds / step);
      for (let i = 0; i < steps; i++) battle.update(step);
    },
    traceDump: () => trace.dump(),
  };
  // Expose the encounter count for harness assertions.
  void RUN;
}
