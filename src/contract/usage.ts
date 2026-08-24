/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/usage.ts — usage rollups. One append-only ledger of turns + tokens;
 * a summary at any level is a sum of the same rows. Counters enforce the plan's
 * turn quota — they never bill. There are no credits.
 */

export interface UsageSummary {
  /** Turns consumed in the window. */
  turns: number;
  inputTokens: number;
  outputTokens: number;
  /** Number of ledger events. */
  events: number;
}

/** A reporting window for {@link UsageClient.summary}; both bounds ISO or YYYY-MM-DD. */
export interface UsageSummaryQuery {
  from?: string;
  to?: string;
}

/**
 * The caller's TURN ALLOWANCE — the plan's monthly quota, what they've used in
 * the current window, and what remains. Reported by the same code path that
 * ENFORCES the quota, so the number shown is the number enforced.
 */
export interface TurnAllocation {
  turnsPerMonth: number;
  turnsUsed: number;
  turnsRemaining: number;
  windowStart: string;
  windowEnd: string;
}

export interface UsageDay {
  day: string; // YYYY-MM-DD
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

/** One model's usage rollup. */
export interface UsageByModelRow {
  model: string;
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

/** The stack dimension for the day × group series. */
export type UsageSeriesGroupBy = "model" | "source" | "user";

/** One (day, group) cell of the usage chart. */
export interface UsageSeriesPoint {
  day: string;
  /** The group's value: a model id, a source, or a user id ("(none)" when unattributed). */
  key: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
}

/** Query for the day × group series. `from`/`to` are YYYY-MM-DD, bucketed in `tz`. */
export interface UsageSeriesQuery {
  from: string;
  to: string;
  tz?: string;
  /** The stack dimension (default "model"; "user" is org_admin only). */
  groupBy?: UsageSeriesGroupBy;
  /** Optional exact-match dimension filters applied before grouping. */
  model?: string;
  source?: string;
  /** org_admin only — pin the series to one member. */
  userId?: string;
}
