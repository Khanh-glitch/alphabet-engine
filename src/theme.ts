/** Design tokens: one source of truth for colour, type and rhythm. */

export const SIZE = { w: 1440, h: 810 } as const;

export const C = {
  void: '#06070d',
  bg0: '#0a0c15',
  bg1: '#0e111d',
  bg2: '#141828',
  panel: '#141a2b',
  panelHi: '#1b2237',
  line: '#252c45',
  lineHi: '#333d5e',
  grid: '#171d31',

  ink: '#eae7de',
  dim: '#8b93b0',
  faint: '#4b5474',
  ghost: '#2b3350',

  gold: '#f0b445',
  goldLo: '#8a6524',
  cyan: '#4fd8e4',
  cyanLo: '#1d6a72',
  violet: '#a274f5',
  violetLo: '#4a3480',
  ember: '#f2734a',
  blood: '#e4534f',
  lime: '#67d98a',
  acid: '#c8e05a',
  rose: '#f26aa0',

  good: '#67d98a',
  bad: '#e4534f',
  warn: '#f0b445',
} as const;

export const TRAIT_COLOR: Record<string, string> = {
  BLAST: C.ember,
  CHILL: C.cyan,
  CHAIN: C.violet,
  PIERCE: C.acid,
  HEAVY: C.gold,
  SWIFT: C.lime,
  SPLIT: C.rose,
  NONE: C.dim,
};

export const F = {
  ui: 'Grotesk, system-ui, sans-serif',
  num: 'Mono, ui-monospace, monospace',
  slab: 'Slab, Georgia, serif',
} as const;

export const T = {
  detail: 9,
  micro: 10,
  tiny: 11,
  small: 13,
  body: 15,
  lead: 18,
  head: 24,
  title: 40,
  mega: 68,
} as const;

export const R = { sm: 6, md: 10, lg: 16, pill: 999 } as const;

// ---- battle layout -------------------------------------------------------
export const L = {
  hudH: 58,
  gutter: 20,
  consoleW: 322,
  arenaTop: 58,
  arenaBot: 704,
  rackTop: 716,
  lanes: 5,
} as const;

export const LANE_TOP = L.arenaTop + 10;
export const LANE_H = (L.arenaBot - L.arenaTop - 20) / L.lanes;
export const laneY = (i: number) => LANE_TOP + LANE_H * (i + 0.5);
export const ARENA_L = 356;
export const ARENA_R = SIZE.w - 24;
export const CONSOLE_L = L.gutter;
export const CONSOLE_R = ARENA_L - 18;
