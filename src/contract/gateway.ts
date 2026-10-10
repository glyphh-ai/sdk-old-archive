/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/gateway.ts — the metered model call. The gateway is the ONE egress for
 * model traffic: it resolves the sent model against the org's catalog, decrypts the
 * org's provider key (never exposed to any client), calls upstream, and meters the
 * tokens against the caller + workspace.
 *
 * It speaks OpenAI chat-completions on both edges — including in its RESPONSE, which
 * is returned verbatim rather than in the SDK's `{ data }` envelope, so an
 * OpenAI-shaped client can point at it unchanged.
 */

export interface GatewayMessage {
  role: string;
  content: string;
}

export interface GatewayCompletionInput {
  /** Billing service line for this call ('enrichment' | 'memory-rotor') —
   *  background work declares itself so the ledger stays honest. */
  service?: string;
  /** The turn this call belongs to (x-glyphh-run) — ties background work to
   *  the run that caused it. */
  runId?: string;
  /** Catalog id (`provider::model`) or the bare model id. */
  model: string;
  messages: GatewayMessage[];
  temperature?: number;
  seed?: number;
  maxTokens?: number;
}

export interface GatewayChoice {
  index: number;
  message: GatewayMessage;
  finish_reason: string | null;
}

export interface GatewayUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

/** An OpenAI-shaped chat completion, exactly as the gateway returns it. */
export interface GatewayCompletion {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: GatewayChoice[];
  usage?: GatewayUsage;
}

// ── Anthropic Messages (the tool-capable turn) ───────────────────────────────




// ── anonymous guest chat (no account) ────────────────────────────────────────



