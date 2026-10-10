/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/usage.ts — usage rollups (read). One ledger, so mine ⊆ workspace ⊆ org
 * by construction. (Ingest is the runtime's service-gated endpoint, not a client call.)
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { UsageSummary, UsageSummaryQuery, UsageSeriesQuery, UsageSeriesPoint } from "../contract/usage.js";

export class UsageClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The caller's own usage. */
  mine(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/mine");
  }

  /**
   * WINDOWED totals over [from, to) — defaults to the current calendar month. Role-scoped
   * server-side: an org_admin gets the whole org, every other member gets ONLY their own
   * spend, so a member's "this month" is theirs alone.
   */
  summary(query: UsageSummaryQuery = {}): Promise<UsageSummary> {
    const qs = new URLSearchParams();
    if (query.from) qs.set("from", query.from);
    if (query.to) qs.set("to", query.to);
    const s = qs.toString();
    return this.http.get<UsageSummary>(`/api/usage/summary${s ? `?${s}` : ""}`);
  }


  /**
   * Day × group series for the stacked usage chart — every (day, model|source|user)
   * pair with its dollars, requests, and tokens. Role-scoped like
   * `daily`; `groupBy: "user"` is org_admin only.
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

}
