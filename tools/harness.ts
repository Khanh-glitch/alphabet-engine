/**
 * Headless harness.
 *
 * Runs the real game code against a Node canvas so screens can be rendered to
 * PNG and the simulation can be played without a browser. This is how visual and
 * balance work is verified before anything is claimed to be finished.
 *
 * Usage (through tools/shoot.mjs):
 *   node tools/shoot.mjs shot title out.png
 *   node tools/shoot.mjs battle out.png --seconds=9 --kit=assembly --seed=7
 *   node tools/shoot.mjs sim --runs=12
 */
import { createCanvas, GlobalFonts } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

interface ShimWindow {
  innerWidth: number;
  innerHeight: number;
  devicePixelRatio: number;
  addEventListener: () => void;
  removeEventListener: () => void;
  setTimeout: typeof setTimeout;
  clearInterval: typeof clearInterval;
  setInterval: typeof setInterval;
  prompt: () => null;
  location: { search: string };
}

function installDomShim(width: number, height: number): void {
  const w = globalThis as unknown as Record<string, unknown>;
  const store: Record<string, string> = {};
  const win: ShimWindow = {
    innerWidth: width,
    innerHeight: height,
    devicePixelRatio: 1,
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: ((fn: () => void, ms?: number) => setTimeout(fn, ms)) as unknown as typeof setTimeout,
    clearInterval: clearInterval as unknown as typeof clearInterval,
    setInterval: setInterval as unknown as typeof setInterval,
    prompt: () => null,
    location: { search: '' },
  };
  w.window = win;
  w.performance = { now: () => Date.now() };
  w.requestAnimationFrame = () => 0;
  w.cancelAnimationFrame = () => {};
  try {
    Object.defineProperty(w, 'navigator', {
      value: { userAgent: 'node', language: 'vi' },
      configurable: true,
      writable: true,
    });
  } catch {
    // Node already provides a read-only navigator; that is fine for the harness.
  }
  w.localStorage = {
    getItem: (k: string) => (k in store ? store[k] : null),
    setItem: (k: string, v: string) => {
      store[k] = v;
    },
    removeItem: (k: string) => {
      delete store[k];
    },
  };
  w.document = {
    documentElement: { lang: 'vi' },
    getElementById: () => null,
    addEventListener: () => {},
    body: { style: { cursor: 'default' } },
    hidden: false,
  };
  // Audio and other browser-only APIs stay undefined; the game degrades quietly.
}

function registerFonts(): void {
  const base = new URL('../public/fonts/', import.meta.url).pathname;
  for (const [file, family] of [
    ['ar-500', 'Archivo'],
    ['ar-600', 'Archivo'],
    ['ar-700', 'Archivo'],
    ['ar-800', 'Archivo'],
    ['jb-500', 'JetBrains Mono'],
    ['jb-700', 'JetBrains Mono'],
  ] as const) {
    try {
      GlobalFonts.registerFromPath(`${base}${file}.woff2`, family);
    } catch {
      // A missing font only costs fidelity in the harness, never correctness.
    }
  }
}

interface HarnessCanvas {
  width: number;
  height: number;
  style: Record<string, string>;
  addEventListener: () => void;
  getContext: (type: string, opts?: unknown) => unknown;
  getBoundingClientRect: () => { left: number; top: number; width: number; height: number };
  toBuffer?: (mime: string) => Buffer;
}

async function boot(width: number, height: number) {
  installDomShim(width, height);
  registerFonts();
  const canvas = createCanvas(width, height);
  const wrapped = canvas as unknown as HarnessCanvas;
  wrapped.style = {};
  wrapped.addEventListener = () => {};
  wrapped.getBoundingClientRect = () => ({ left: 0, top: 0, width, height });

  const { App } = await import('../src/app/app');
  const { trace } = await import('../src/alphabet/trace');
  const title = await import('../src/ui/screens/title');
  const kit = await import('../src/ui/screens/kit');
  const battle = await import('../src/ui/screens/battle');
  const spoils = await import('../src/ui/screens/spoils');
  const summary = await import('../src/ui/screens/summary');
  const codex = await import('../src/ui/screens/codex');
  const settings = await import('../src/ui/screens/settings');
  const { Run } = await import('../src/run/run');
  const { store } = await import('../src/core/save');
  const pause = await import('../src/ui/screens/pause');

  const app = new App(wrapped as unknown as HTMLCanvasElement);
  app.register(
    title.createTitleScreen(),
    kit.createKitScreen(),
    battle.createBattleScreen(),
    spoils.createSpoilsScreen(),
    summary.createSummaryScreen(),
    codex.createCodexScreen(),
    settings.createSettingsScreen(),
  );
  return { app, canvas, trace, Run, store, pause };
}

type Booted = Awaited<ReturnType<typeof boot>>;

function save(booted: Booted, path: string): void {
  // Render the frame the same way the browser loop does.
  booted.app.draw();
  const buffer = booted.canvas.toBuffer('image/png');
  writeFileSync(path, buffer);
}

/** Advance the whole app (including the battle screen's fixed-step loop). */
function advance(booted: Booted, seconds: number): void {
  const step = 1 / 120;
  const steps = Math.round(seconds / step);
  for (let i = 0; i < steps; i++) booted.app.update(step);
}

const args = process.argv.slice(2);
const cmd = args[0] ?? 'shot';
const flag = (name: string, fallback: number): number => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? Number(hit.split('=')[1]) : fallback;
};
const stringFlag = (name: string, fallback: string): string => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=')[1] : fallback;
};

async function main(): Promise<void> {
  const W = 1440;
  const H = 810;

  if (cmd === 'shot') {
    const screen = args[1] ?? 'title';
    const out = args[2] ?? 'shot.png';
    const booted = await boot(W, H);
    // Clicks to replay before the shot: lets interaction states be inspected.
    const clicks = args.filter((a) => a.startsWith('--click=')).map((a) => a.split('=')[1]);

    if (screen === 'battle' || screen === 'spoils' || screen === 'summary') {
      const seed = flag('seed', 12345);
      const kitId = stringFlag('kit', 'assembly');
      booted.app.run = booted.Run.create(seed, kitId);
      booted.app.goto('battle');
      advance(booted, flag('seconds', 8));
      for (const id of clicks) {
        booted.app.active.click?.(id, booted.app);
        advance(booted, 0.3);
      }
      if (screen !== 'battle') {
        // Drive the encounter to its end so the follow-up screen has real data.
        const b = booted.app.battle;
        if (b) {
          let guard = 0;
          while ((b.state === 'intro' || b.state === 'fight') && guard++ < 120 * 120) {
            b.update(1 / 120);
          }
        }
        booted.app.update(1 / 120);
        advance(booted, 2.0);
        booted.app.goto(screen);
        advance(booted, 0.5);
      }
      for (const id of clicks) {
        booted.app.active.click?.(id, booted.app);
        advance(booted, 0.25);
      }
    } else {
      booted.app.goto(screen);
      advance(booted, flag('seconds', 0.5));
    }
    for (const id of clicks) {
      booted.app.active.click?.(id, booted.app);
      advance(booted, 0.25);
    }
    const overlay = stringFlag('overlay', '');
    if (overlay === 'pause') booted.app.setOverlay(booted.pause.createPauseScreen());
    if (overlay) advance(booted, 0.3);
    save(booted, out);
    console.log(`shot ${screen}${overlay ? `+${overlay}` : ''} -> ${out}`);
    return;
  }

  if (cmd === 'sim') {
    const baseSeed = flag('seed', 20240920);
    const runs = flag('runs', 1);
    const kitId = stringFlag('kit', 'assembly');
    const booted = await boot(W, H);
    const all: Record<string, unknown>[] = [];
    const agg = {
      runs: 0,
      cleared: 0,
      failed: 0,
      firstCraft: [] as number[],
      chains: [] as number[],
      seconds: [] as number[],
      crafts: [] as number[],
      craftsPerSecond: [] as number[],
      minCorePct: [] as number[],
      clearedEncounter: [] as number[],
      byBlueprint: {} as Record<string, number>,
    };

    for (let r = 0; r < runs; r++) {
      const seed = (baseSeed + r * 7919) >>> 0;
      const run = booted.Run.create(seed, kitId);
      const report: Record<string, unknown>[] = [];
      let guardRun = 0;
      while (!run.finished && guardRun++ < 20) {
        const battle = run.buildBattle();
        let guard = 0;
        while ((battle.state === 'intro' || battle.state === 'fight') && guard++ < 120 * 240) {
          battle.update(1 / 120);
        }
        const corePct = Math.round((battle.coreHp / Math.max(1, battle.maxCoreHp)) * 100);
        const result = battle.state;
        run.absorb(battle);
        const t = battle.telemetry.data;
        report.push({
          encounter: battle.cfg.encounter.id,
          result,
          seconds: Number(battle.time.toFixed(1)),
          corePct,
          crafts: t.crafts,
          firstCraft: t.firstCraftTime === null ? null : Number(t.firstCraftTime.toFixed(2)),
          longestChain: t.longestChain,
          kills: t.kills,
          lettersRecovered: t.lettersRecovered,
          wildcardsUsed: t.wildcardsUsed,
          byBlueprint: t.craftsByBlueprint,
        });
        if (battle.state === 'failed' || run.finished) break;
        // A naive player: take the first offer. Deliberately not optimal, so the
        // numbers describe a floor rather than a best case.
        const reward = run.pendingRewards[0];
        if (reward) run.applyReward(reward);
        run.advance();
      }
      const cleared = run.state.record.cleared;
      const failed = run.state.record.failed;
      agg.runs += 1;
      if (failed) agg.failed += 1;
      if (run.state.record.completed) agg.cleared += 1;
      agg.clearedEncounter.push(cleared);
      const totalSeconds = report.reduce((a, e) => a + (e.seconds as number), 0);
      const totalCrafts = report.reduce((a, e) => a + (e.crafts as number), 0);
      agg.seconds.push(totalSeconds);
      agg.crafts.push(totalCrafts);
      agg.craftsPerSecond.push(totalCrafts / Math.max(1, totalSeconds));
      const wonPcts = report.filter((e) => e.result === 'cleared').map((e) => e.corePct as number);
      if (wonPcts.length > 0) agg.minCorePct.push(Math.min(...wonPcts));
      for (const e of report) {
        if (e.firstCraft !== null && e.firstCraft !== undefined) agg.firstCraft.push(e.firstCraft as number);
        if ((e.longestChain as number) > 0) agg.chains.push(e.longestChain as number);
        for (const [k, v] of Object.entries(e.byBlueprint as Record<string, number>)) {
          agg.byBlueprint[k] = (agg.byBlueprint[k] ?? 0) + (v as number);
        }
      }
      all.push({ seed, cleared, failed, report });
    }

    const stat = (arr: number[]): string => {
      if (arr.length === 0) return 'n/a';
      const sorted = arr.slice().sort((a, b) => a - b);
      const mean = arr.reduce((a, b) => a + b, 0) / arr.length;
      return `mean=${mean.toFixed(2)} p50=${sorted[Math.floor(sorted.length / 2)].toFixed(2)} min=${sorted[0].toFixed(2)} max=${sorted[sorted.length - 1].toFixed(2)}`;
    };

    if (args.includes('--verbose')) {
      console.log(JSON.stringify(all, null, 2));
    } else {
      console.log(`kit=${kitId} runs=${agg.runs} completed=${agg.cleared} failed=${agg.failed}`);
      console.log(`encounters cleared  : ${stat(agg.clearedEncounter.map(Number))} (of 8)`);
      console.log(`first craft (s)     : ${stat(agg.firstCraft)}   target 2-4`);
      console.log(`longest chain       : ${stat(agg.chains)}   target 2-4 common`);
      console.log(`encounter seconds   : ${stat(agg.seconds.map((v) => v / 7))}   target 8-15`);
      console.log(`crafts per encounter: ${stat(agg.crafts.map((v) => v / 7))}`);
      console.log(`crafts per second   : ${stat(agg.craftsPerSecond)}`);
      console.log(`closest win core %  : ${stat(agg.minCorePct.map(Number))}`);
      console.log(`crafts by blueprint : ${JSON.stringify(agg.byBlueprint)}`);
    }
    return;
  }

  console.error(`unknown command: ${cmd}`);
  process.exitCode = 1;
}

void main();
