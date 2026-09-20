/**
 * Local persistence: settings, codex discoveries and the suspended run.
 *
 * Everything is versioned so a schema change degrades to defaults instead of
 * breaking a player's session.
 */
import { setLang, type Lang } from './i18n';

const KEYS = {
  settings: 'ae.settings.v1',
  codex: 'ae.codex.v1',
  run: 'ae.run.v1',
} as const;

export interface Settings {
  lang: Lang;
  master: number;
  music: number;
  sfx: number;
  shake: number;
  reducedFlashes: boolean;
  uiScale: number;
  textScale: number;
  speed: 1 | 2 | 3;
  trace: boolean;
}

export const defaultSettings = (): Settings => ({
  lang: 'vi',
  master: 0.8,
  music: 0.5,
  sfx: 0.8,
  shake: 1,
  reducedFlashes: false,
  uiScale: 1,
  textScale: 1,
  speed: 1,
  trace: false,
});

export interface CodexState {
  blueprints: string[];
  enemies: string[];
  rules: string[];
  bestChain: number;
  runs: number;
  wins: number;
}

export const defaultCodex = (): CodexState => ({
  blueprints: ['BOMB', 'FIRE', 'BEE', 'WALL', 'FAN', 'OIL'],
  enemies: [],
  rules: [],
  bestChain: 0,
  runs: 0,
  wins: 0,
});

const read = <T>(key: string, fallback: T): T => {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...fallback, ...parsed };
  } catch {
    return fallback;
  }
};

const write = (key: string, value: unknown): void => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota). Settings simply do not
    // persist rather than breaking the session.
  }
};

class Store {
  settings: Settings = defaultSettings();
  codex: CodexState = defaultCodex();
  suspendedRun: string | null = null;

  load(): void {
    this.settings = read(KEYS.settings, this.settings);
    this.codex = read(KEYS.codex, this.codex);
    try {
      this.suspendedRun = localStorage.getItem(KEYS.run);
    } catch {
      this.suspendedRun = null;
    }
    setLang(this.settings.lang);
  }

  saveSettings(): void {
    write(KEYS.settings, this.settings);
  }

  saveCodex(): void {
    write(KEYS.codex, this.codex);
  }

  saveRun(serialized: string | null): void {
    this.suspendedRun = serialized;
    try {
      if (serialized) localStorage.setItem(KEYS.run, serialized);
      else localStorage.removeItem(KEYS.run);
    } catch {
      // ignore
    }
  }

  discover(kind: 'blueprints' | 'enemies' | 'rules', id: string): boolean {
    const list = this.codex[kind];
    if (list.includes(id)) return false;
    list.push(id);
    this.saveCodex();
    return true;
  }

  recordRun(chain: number, won: boolean): void {
    this.codex.runs += 1;
    if (won) this.codex.wins += 1;
    this.codex.bestChain = Math.max(this.codex.bestChain, chain);
    this.saveCodex();
  }

  resetProgress(): void {
    this.codex = defaultCodex();
    this.suspendedRun = null;
    this.saveCodex();
    this.saveRun(null);
  }
}

export const store = new Store();
