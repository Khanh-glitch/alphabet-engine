/**
 * Design tokens — the single source of truth for colour, type, spacing and depth.
 *
 * Art direction: "kinetic typographic toy-machine". Letters are tangible
 * manufactured pieces: chunky letterpress tiles on a dark industrial bed.
 * Every screen reads these tokens so the whole game stays visually coherent.
 */

/** Logical resolution. Everything is authored here and scaled to the window. */
export const VIEW = { w: 1440, h: 810 } as const;

export const C = {
  // Bed / surfaces — cool dark machinery
  void: '#05070e',
  bed0: '#0a0e1a',
  bed1: '#101728',
  bed2: '#161f36',
  panel: '#131b2e',
  panelHi: '#1a2440',
  panelLo: '#0d1322',
  line: '#26314f',
  lineHi: '#3a4870',

  // Ink
  ink: '#f2efe6',
  dim: '#9aa4c2',
  faint: '#5b6688',
  ghost: '#2c3552',

  // Letterpress tile materials
  tileFace: '#f4ecd8',
  tileFaceHi: '#fffaf0',
  tileEdge: '#c9b98f',
  tileDeep: '#8d7d55',
  tileInk: '#1b1a17',
  slot: '#1a2135',
  slotEdge: '#2f3a5c',

  // Semantic accents (each also carries a shape/icon so colour is never alone)
  gold: '#f0b445',
  goldLo: '#7d5a1c',
  ember: '#f2734a',
  emberLo: '#7a2f18',
  blood: '#e4534f',
  mint: '#4fd8a0',
  cyan: '#4fd8e4',
  violet: '#a274f5',
  lime: '#c8e05a',
  rose: '#f26aa0',
  steel: '#8fa3c8',

  good: '#4fd8a0',
  bad: '#e4534f',
  warn: '#f0b445',
} as const;

/** Semantic role colours used across HUD and battlefield. */
export const ROLE = {
  core: C.cyan,
  carrier: C.gold,
  hazard: C.ember,
  structure: C.steel,
  hunter: C.lime,
} as const;

export const F = {
  /** UI face — Archivo, full Vietnamese coverage. */
  ui: "Archivo, system-ui, sans-serif",
  /** Numerals, counts, seeds — JetBrains Mono. */
  mono: "'JetBrains Mono', ui-monospace, monospace",
} as const;

export const T = {
  micro: 11,
  tiny: 13,
  small: 15,
  body: 17,
  lead: 21,
  head: 27,
  title: 40,
  mega: 74,
} as const;

export const SPC = [0, 4, 8, 12, 16, 24, 32, 48, 64] as const;

export const R = { sm: 6, md: 10, lg: 16, tile: 12, pill: 999 } as const;

export const W = { hair: 1, thin: 2, bold: 3, heavy: 5 } as const;

/** Motion tokens — one rhythm everywhere so feedback feels authored, not random. */
export const MOTION = {
  snap: 0.09,
  fast: 0.18,
  base: 0.3,
  slow: 0.55,
  hero: 0.85,
} as const;

/** Depth offsets for the letterpress look (light from the top-left). */
export const DEPTH = { plate: 4, tile: 5, press: 2 } as const;

/**
 * Battlefield layout in logical units.
 *
 * The arena is a shallow 2.5D side view: a floor plane with five depth lanes.
 * Lane 0 is nearest the camera (lowest on screen, largest), lane 4 is furthest
 * back (highest, smallest). Enemies always stand *on* the floor, which is what
 * makes their position readable at a glance.
 */
export const FIELD = {
  w: VIEW.w,
  h: VIEW.h,
  /** Near edge of the floor plane. */
  floorFront: 604,
  /** Far edge of the floor plane. */
  floorBack: 300,
  lanes: 5,
  /** Vertical gap between lane baselines. */
  laneH: 50,
  /** The player's engine sits here. */
  coreX: 176,
  /** Enemies enter from beyond this x. */
  spawnX: 1520,
  /** Where a ground unit's feet rest in the nearest lane. */
  groundY: 574,
  left: 56,
  right: 1408,
  top: 84,
  bottom: 596,
} as const;

/** Baseline (foot) y for a lane: nearest lane is lowest on screen. */
export const laneY = (lane: number): number => FIELD.groundY - lane * FIELD.laneH;

/** Depth scaling so far lanes read as further away. */
export const laneScale = (lane: number): number => 1 - lane * 0.055;

/** Line where a lane's feet meet the floor, used for contact shadows. */
export const laneFloor = (lane: number): number => laneY(lane) + 12;

/** Bottom deck: blueprint cards on top, the alphabet economy below them. */
export const DECK = {
  top: 604,
  cardY: 626,
  cardH: 100,
  bottomY: 734,
  bottomH: 64,
} as const;

/** Blueprint identity colours — used for their objects in the arena, not the UI. */
export const BP_COLOR: Record<string, string> = {
  BOMB: '#f2734a',
  FIRE: '#f0952e',
  BEE: '#c8e05a',
  WALL: '#8fa3c8',
  FAN: '#4fd8e4',
  OIL: '#7d6bd6',
  MINE: '#e4534f',
  SAW: '#c0c8d8',
  WEB: '#b09cf0',
  ICE: '#8fe3f0',
};
