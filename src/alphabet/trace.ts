/**
 * Development telemetry and trace log.
 *
 * Disabled in normal play (toggle in Settings → debug, or `?debug=1`). It exists
 * so balance questions are answered with numbers instead of impressions, and so
 * a seeded run can be reconstructed step by step.
 */
export type TraceKind =
  | 'draw'
  | 'craft'
  | 'kill'
  | 'drop'
  | 'wildcard'
  | 'spawn'
  | 'corehit'
  | 'clear'
  | 'fail'
  | 'reward'
  | 'rule'
  | 'stall'
  | 'breach'
  | 'focus'
  | 'mark'
  | 'start';

export interface TraceLine {
  t: number;
  kind: TraceKind;
  text: string;
  chain?: number;
  data?: Record<string, unknown>;
}

export interface RunTelemetry {
  crafts: number;
  kills: number;
  lettersRecovered: number;
  lettersDrawn: number;
  lettersUnused: number;
  wildcardsUsed: number;
  wildcardsSpentEarly: number;
  firstCraftTime: number | null;
  chainLengths: number[];
  longestChain: number;
  craftsByBlueprint: Record<string, number>;
  encounters: number;
  coreDamageTaken: number;
}

export const emptyTelemetry = (): RunTelemetry => ({
  crafts: 0,
  kills: 0,
  lettersRecovered: 0,
  lettersDrawn: 0,
  lettersUnused: 0,
  wildcardsUsed: 0,
  wildcardsSpentEarly: 0,
  firstCraftTime: null,
  chainLengths: [],
  longestChain: 0,
  craftsByBlueprint: {},
  encounters: 0,
  coreDamageTaken: 0,
});

export class Trace {
  enabled = false;
  lines: TraceLine[] = [];
  private clock = 0;
  private limit = 4000;

  setTime(t: number): void {
    this.clock = t;
  }

  log(kind: TraceKind, text: string, extra: Omit<TraceLine, 't' | 'kind' | 'text'> = {}): void {
    if (!this.enabled) return;
    this.lines.push({ t: this.clock, kind, text, ...extra });
    if (this.lines.length > this.limit) this.lines.splice(0, this.lines.length - this.limit);
  }

  get time(): number {
    return this.clock;
  }

  clear(): void {
    this.lines = [];
  }

  /** Plain text export, used by the balance simulator and bug reports. */
  dump(): string {
    return this.lines
      .map((l) => `${l.t.toFixed(2)}s ${l.kind.padEnd(8)} ${l.text}${l.chain ? ` [chain ${l.chain}]` : ''}`)
      .join('\n');
  }
}

export const trace = new Trace();

/** Records the per-run numbers surfaced in the summary screen and sim reports. */
export class Telemetry {
  data: RunTelemetry = emptyTelemetry();

  reset(): void {
    this.data = emptyTelemetry();
  }

  onCraft(blueprintId: string, time: number, chain: number): void {
    const d = this.data;
    d.crafts += 1;
    d.craftsByBlueprint[blueprintId] = (d.craftsByBlueprint[blueprintId] ?? 0) + 1;
    if (d.firstCraftTime === null) d.firstCraftTime = time;
    d.chainLengths.push(chain);
    d.longestChain = Math.max(d.longestChain, chain);
  }

  onKill(carrier: boolean): void {
    this.data.kills += 1;
    if (carrier) this.data.lettersRecovered += 1;
  }

  onDraw(): void {
    this.data.lettersDrawn += 1;
  }

  onWildcard(early: boolean): void {
    this.data.wildcardsUsed += 1;
    if (early) this.data.wildcardsSpentEarly += 1;
  }

  onCoreHit(amount: number): void {
    this.data.coreDamageTaken += amount;
  }

  finishEncounter(poolSize: number): void {
    this.data.encounters += 1;
    this.data.lettersUnused += poolSize;
  }
}
