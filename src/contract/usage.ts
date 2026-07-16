/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/usage.ts — usage rollups. Everything flows user → workspace → org from
 * one append-only ledger, so a summary at any level is a sum of the same rows.
 * Credits are whole credits; `creditsSaved` is the shadow price of zero-cost usage
 * (local / open-weight / custom MCP).
 */

export interface UsageSummary {
  /** Credits consumed in the window. */
  credits: number;
  /** Shadow price of zero-cost usage ("credits saved"). */
  creditsSaved: number;
  /** Credit breakdown by source. */
  bySource: {
    fly: number;
    pipedream: number;
    provider: number;
  };
  /** Number of ledger events. */
  events: number;
}

/** One day of the org usage series (credits in micro-credits; only days with usage). */
export interface UsageDay {
  day: string; // YYYY-MM-DD
  credits: number; // micro-credits
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}

/** Query for the per-day series. `from`/`to` are YYYY-MM-DD; `tz` defaults to UTC. */
export interface UsageDailyQuery {
  from: string;
  to: string;
  tz?: string;
  /** org_admin only — break the org series down to one member. */
  userId?: string;
}

/** One model's usage rollup (charged credits in micro-credits). */
export interface UsageByModelRow {
  model: string;
  credits: number; // micro-credits
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/** Query for the by-model rollup. `from`/`to` are YYYY-MM-DD (optional; all time when omitted). */
export interface UsageByModelQuery {
  from?: string;
  to?: string;
  /** org_admin only — drill into one member (members are pinned to their own usage). */
  userId?: string;
}
