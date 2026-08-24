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
/**
 * The caller's own SPEND ALLOWANCE — whole credits. What a non-admin member sees in
 * place of the org plan: the credit cap their org admin set on their workspace, what
 * they've spent in the current window, and the interval it resets on. Reported by the
 * same code path that ENFORCES the cap, so the number shown is the number enforced.
 */
export interface CreditAllocation {
  /** True when the workspace has no cap — spend is unlimited (cap/remaining are 0). */
  uncapped: boolean;
  capCredits: number;
  spentCredits: number;
  remainingCredits: number;
  /** The admin-set interval: 1 (daily) | 7 (weekly) | 30 (monthly). */
  periodDays: number;
  windowStart: string;
  windowEnd: string;
  workspaceName: string;
}

/** A reporting window for {@link UsageClient.summary}; both bounds ISO or YYYY-MM-DD. */
export interface UsageSummaryQuery {
  from?: string;
  to?: string;
}

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

/** The stack dimension for the day × group series. */
export type UsageSeriesGroupBy = "model" | "source" | "user";

/** One (day, group) cell of the usage chart (charged credits in micro-credits). */
export interface UsageSeriesPoint {
  day: string;
  /** The group's value: a model id, a source, or a user id ("(none)" when unattributed). */
  key: string;
  credits: number; // micro-credits
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
