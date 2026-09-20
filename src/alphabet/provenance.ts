/**
 * Causal provenance for the V2 cascade.
 *
 * V1 measured a chain with a stopwatch: two crafts landing inside a 2.2 s window
 * counted as a cascade. That is temporal adjacency, not causation — two words
 * that happen to finish close together are not a chain, and a real chain that
 * takes four seconds was invisible.
 *
 * V2 answers the actual question: *did a letter produced by an earlier craft
 * cause this one?* Every craft records the ancestry of the letters it consumed;
 * every kill records the craft that caused it; every dropped letter inherits
 * that ancestry. A craft's chain depth is therefore
 *
 *     1 + max(depth of the letters it consumed)
 *
 * so depth 1 means "built from the bag", depth 2 means "one craft fed me", and
 * so on. See `GAMEPLAY_REWORK_V2.md` 3.5.
 *
 * The graph is bounded: it only needs to live long enough to decide ancestry and
 * report telemetry, so old nodes are pruned rather than retained for the run.
 *
 * Pure domain logic: no DOM, no canvas, no timers, no `Math.random`.
 */
import type { BlueprintId } from './types';
import type { LetterSource } from './sockets';

export type ProvenanceKind =
  | 'bag_letter'
  | 'enemy_letter'
  | 'wildcard_letter'
  | 'rule_letter'
  | 'blueprint_craft'
  | 'combat_object'
  | 'enemy_kill';

export interface ProvenanceNode {
  id: number;
  kind: ProvenanceKind;
  parentIds: number[];
  timestamp: number;
  /**
   * Causal chain depth. A craft is one deeper than the deepest craft feeding it;
   * everything else (letters, objects, kills) inherits the depth it descends
   * from. Zero for anything that came out of the bag.
   */
  depth: number;
  blueprintId?: BlueprintId;
}

/** How long the graph is kept. Ancestry only matters while a chain is alive. */
const DEFAULT_RETENTION = 600;

export class Provenance {
  private nodes = new Map<number, ProvenanceNode>();
  private nextId = 1;
  private retention: number;

  constructor(retention = DEFAULT_RETENTION) {
    this.retention = retention;
  }

  get size(): number {
    return this.nodes.size;
  }

  node(id: number): ProvenanceNode | null {
    return this.nodes.get(id) ?? null;
  }

  private add(
    kind: ProvenanceKind,
    parentIds: number[],
    timestamp: number,
    blueprintId?: BlueprintId,
  ): number {
    const id = this.nextId++;
    let depth = 0;
    for (const pid of parentIds) {
      const parent = this.nodes.get(pid);
      if (parent) depth = Math.max(depth, parent.depth);
    }
    // Only crafts advance the depth; everything else inherits. Measured mistake
    // worth keeping: making crafts inherit too meant a bag-only craft stored
    // depth 0, so the letter it released also carried 0 and the next craft was
    // reported as chain depth 1 no matter how long the cascade actually ran.
    if (kind === 'blueprint_craft') depth += 1;
    const node: ProvenanceNode = { id, kind, parentIds, timestamp, depth, blueprintId };
    this.nodes.set(id, node);
    if (this.nodes.size > this.retention) this.prune(timestamp);
    return id;
  }

  /**
   * Register a letter entering the machine.
   *
   * A carrier drop is created *after* the kill that freed it, so it inherits the
   * kill's ancestry — this is the edge the whole cascade hangs on. Every other
   * source starts a fresh depth-0 lineage.
   */
  letter(source: LetterSource, timestamp: number, killNodeId?: number): number {
    if (source.kind === 'enemy') {
      const parents = killNodeId !== undefined ? [killNodeId] : [];
      return this.add('enemy_letter', parents, timestamp);
    }
    const kind: ProvenanceKind =
      source.kind === 'bag'
        ? 'bag_letter'
        : source.kind === 'wildcard'
          ? 'wildcard_letter'
          : 'rule_letter';
    return this.add(kind, [], timestamp);
  }

  /**
   * Register a craft from the ancestry of the letters it consumed.
   * Returns the new node id; its `depth` is the true causal chain depth.
   */
  craft(blueprintId: BlueprintId, consumedNodeIds: number[], timestamp: number): number {
    return this.add('blueprint_craft', consumedNodeIds, timestamp, blueprintId);
  }

  /** Register the physical object a craft produced. */
  object(craftNodeId: number, timestamp: number, blueprintId?: BlueprintId): number {
    return this.add('combat_object', [craftNodeId], timestamp, blueprintId);
  }

  /**
   * Register a kill caused by one of the player's objects.
   *
   * `objectNodeId` may be missing for damage with no identifiable source (burn
   * ticks spreading, breaches); such a kill starts its own lineage rather than
   * inventing a causal edge that is not there.
   */
  kill(timestamp: number, objectNodeId?: number): number {
    const parents = objectNodeId !== undefined ? [objectNodeId] : [];
    return this.add('enemy_kill', parents, timestamp);
  }

  /**
   * Causal chain depth of a craft node.
   *
   * `1` means no ancestor craft contributed through combat-generated letters;
   * `1 + max(parent craft depth)` otherwise (brief 3.5.5).
   */
  chainDepth(nodeId: number): number {
    return Math.max(1, this.nodes.get(nodeId)?.depth ?? 0);
  }

  /**
   * Which edge explains a craft: the blueprint of the ancestral craft, if any.
   * Used to make the cascade legible in the UI rather than only in telemetry.
   */
  causalAncestor(nodeId: number): { blueprintId: BlueprintId; depth: number } | null {
    const node = this.nodes.get(nodeId);
    if (!node || node.depth === 0) return null;
    let best: ProvenanceNode | null = null;
    for (const pid of node.parentIds) {
      const p = this.nodes.get(pid);
      if (!p) continue;
      // Walk one level up to the craft that produced this letter's ancestry.
      const craftNode = p.kind === 'blueprint_craft' ? p : this.nearestCraft(p.id);
      if (craftNode && (!best || craftNode.depth > best.depth)) best = craftNode;
    }
    if (!best?.blueprintId) return null;
    return { blueprintId: best.blueprintId, depth: node.depth };
  }

  private nearestCraft(id: number, guard = 0): ProvenanceNode | null {
    if (guard > 8) return null;
    const node = this.nodes.get(id);
    if (!node) return null;
    if (node.kind === 'blueprint_craft') return node;
    for (const pid of node.parentIds) {
      const found = this.nearestCraft(pid, guard + 1);
      if (found) return found;
    }
    return null;
  }

  /** Drop the oldest nodes once the graph outgrows its retention budget. */
  private prune(now: number): void {
    const keep: number[] = [];
    // Keep structural nodes (crafts, objects, kills, enemy letters) longer than
    // bag letters: a chain can be several seconds long, and an enemy letter
    // whose craft ancestor was pruned would silently look like a fresh lineage.
    for (const [id, node] of this.nodes) {
      const structural = node.kind !== 'bag_letter' && node.kind !== 'rule_letter';
      const age = now - node.timestamp;
      if (structural ? age < 12 : age < 4) keep.push(id);
    }
    if (keep.length === this.nodes.size) return;
    const kept = new Set(keep);
    for (const id of [...this.nodes.keys()]) if (!kept.has(id)) this.nodes.delete(id);
  }
}
