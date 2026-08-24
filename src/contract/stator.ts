/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/stator.ts — the org MEMORY PLANE wire shapes. Recall/write are what
 * every runtime rides; browse/graph/forget/amend are the CURATION surface the
 * desktop Memory panel drives. Owner-scoped end to end: the server proxy
 * region-routes to the org's stator and the bearer's org/user scopes every op.
 */

export type MemoryTier = "short" | "mid" | "long";

export interface StatorFact {
  entity: string;
  role: string;
  filler: string;
  space_id?: string;
  key?: string;
  is_current: boolean;
  speaker?: string;
  tick: number;
  tier?: MemoryTier;
  session?: string;
}

export interface StatorRecallInput { threadId?: string; query?: string; entity?: string; topK?: number; threshold?: number }
export interface StatorRecallResult {
  directives: string[];
  recalled: Array<{ text: string; score: number }>;
  facts: StatorFact[];
  block: string;
}

export interface StatorWriteInput {
  threadId?: string;
  entity?: string;
  mode?: "turn" | "absorb";
  text?: string;
  speaker?: string;
  tier?: MemoryTier;
  date?: string;
}

export interface StatorBrowseResult {
  /** Every fact, superseded versions included (is_current marks the chain head). */
  facts: StatorFact[];
  /** The similarity corpus — recorded turns, "[date] speaker: text"-shaped. */
  turns: string[];
  /** The session recency window (newest last, capped at 20). */
  window: Array<{ speaker: string; text: string }>;
}

export interface StatorGraphInput { threadId?: string; max?: number; semMin?: number; neuralMin?: number; neuralMax?: number }
export interface StatorGraphNode {
  id: number;
  kind: "turn" | "fact";
  text: string;
  tier?: string;
  entity?: string;
  role?: string;
}
export interface StatorGraphResult {
  nodes: StatorGraphNode[];
  /** 3D PCA coordinates, index-aligned with nodes. */
  coords: Array<[number, number, number]>;
  edges: Array<{ a: number; b: number; sim: number; kind: "semantic" | "neural" }>;
}

export interface StatorForgetInput {
  fact?: { entity?: string; role?: string; filler?: string; key?: string };
  turnText?: string;
}

export interface StatorAmendInput { entity: string; role: string; filler: string; key?: string; tier?: MemoryTier }
