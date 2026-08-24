/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/usage.ts — usage rollups (read). One ledger of turns + tokens, so
 * mine ⊆ org by construction. (Ingest is the runtime's service-gated endpoint,
 * not a client call.)
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  UsageDailyQuery, UsageDay, UsageSummary, UsageByModelRow, UsageByModelQuery,
  TurnAllocation, UsageSummaryQuery, UsageSeriesQuery, UsageSeriesPoint,
} from "../contract/usage.js";

export class UsageClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The caller's own usage. */
  mine(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/mine");
  }

  /**
   * The caller's TURN ALLOWANCE — the plan's monthly quota, what's used this
   * window, and what remains. This is what a member's dashboard shows.
   */
  allocation(): Promise<TurnAllocation> {
    return this.http.get<TurnAllocation>("/api/me/allocation");
  }

  /**
   * WINDOWED totals over [from, to) — defaults to the current calendar month. Role-scoped
   * server-side: an org_admin gets the whole org, every other member gets ONLY their own
   * usage, so a member's "this month" is theirs alone.
   */
  summary(query: UsageSummaryQuery = {}): Promise<UsageSummary> {
    const qs = new URLSearchParams();
    if (query.from) qs.set("from", query.from);
    if (query.to) qs.set("to", query.to);
    const s = qs.toString();
    return this.http.get<UsageSummary>(`/api/usage/summary${s ? `?${s}` : ""}`);
  }

  /**
   * Per-day series for the caller's org over [from, to], bucketed in `tz`. Scoped to
   * the caller's org; an org_admin may pass `userId` to break it down by member.
   */
  daily(query: UsageDailyQuery): Promise<{ days: UsageDay[] }> {
    const qs = new URLSearchParams({ from: query.from, to: query.to });
    if (query.tz) qs.set("tz", query.tz);
    if (query.userId) qs.set("userId", query.userId);
    return this.http.get<{ days: UsageDay[] }>(`/api/usage/daily?${qs.toString()}`);
  }

  /**
   * Day × group series for the stacked usage chart — every (day, model|source|user)
   * pair with its requests and tokens. Role-scoped like `daily`; `groupBy: "user"`
   * is org_admin only.
   */
  series(query: UsageSeriesQuery): Promise<{ points: UsageSeriesPoint[] }> {
    const qs = new URLSearchParams({ from: query.from, to: query.to });
    if (query.tz) qs.set("tz", query.tz);
    if (query.groupBy) qs.set("groupBy", query.groupBy);
    if (query.model) qs.set("model", query.model);
    if (query.source) qs.set("source", query.source);
    if (query.userId) qs.set("userId", query.userId);
    return this.http.get<{ points: UsageSeriesPoint[] }>(`/api/usage/series?${qs.toString()}`);
  }

  /** The org rollup (org_admin). */
  org(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/org");
  }

  /**
   * Usage attributed BY MODEL. Org-scoped: an org_admin sees the whole org (and may
   * pass `userId` to drill into one member); a member sees only their own.
   * `from`/`to` are YYYY-MM-DD (all time when omitted).
   */
  byModel(query: UsageByModelQuery = {}): Promise<UsageByModelRow[]> {
    const qs = new URLSearchParams();
    if (query.from) qs.set("from", query.from);
    if (query.to) qs.set("to", query.to);
    if (query.userId) qs.set("userId", query.userId);
    const s = qs.toString();
    return this.http.get<UsageByModelRow[]>(`/api/usage/by-model${s ? `?${s}` : ""}`);
  }
}
