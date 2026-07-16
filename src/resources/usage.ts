/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/usage.ts — usage rollups (read). One ledger, so mine ⊆ workspace ⊆ org
 * by construction. (Ingest is the runtime's service-gated endpoint, not a client call.)
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { UsageDailyQuery, UsageDay, UsageSummary, UsageByModelRow, UsageByModelQuery } from "../contract/usage.js";

export class UsageClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The caller's own usage. */
  mine(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/mine");
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

  /** A workspace rollup (must be in the caller's org). */
  workspace(id: string): Promise<UsageSummary> {
    return this.http.get<UsageSummary>(`/api/usage/workspace/${encodeURIComponent(id)}`);
  }

  /** The org rollup (org_admin). */
  org(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/org");
  }

  /**
   * Usage attributed BY MODEL. Org-scoped: an org_admin sees the whole org (and may
   * pass `userId` to drill into one member); a member sees only their own. Amounts
   * are micro-credits. `from`/`to` are YYYY-MM-DD (all time when omitted).
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
