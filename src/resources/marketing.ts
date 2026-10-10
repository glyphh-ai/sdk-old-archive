/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/marketing.ts — trackable marketing links + click analytics (super_admin;
 * server-enforced). CRUD over links, per-link stats/clicks/reset, and the aggregate
 * campaign overview. The public redirect that records clicks is a browser navigation
 * to /api/r/<slug>, not a method here.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { MarketingClick, MarketingLinksPage, MarketingStats, LinksQuery, MarketingStatsQuery } from "../contract/marketing.js";

function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export class MarketingClient {
  constructor(private readonly http: AuthedHttp) {}

  links(query: LinksQuery = {}): Promise<MarketingLinksPage> {
    return this.http.get<MarketingLinksPage>(withQuery("/api/marketing/links", { q: query.q, campaign: query.campaign, page: query.page, limit: query.limit }));
  }
  /** A page of a link's raw clicks (newest first). */
  clicks(id: string, page = 1, limit = 20): Promise<MarketingClick[]> {
    return this.http.get<MarketingClick[]>(withQuery(`/api/marketing/links/${encodeURIComponent(id)}/clicks`, { page, limit }));
  }
  /** Aggregate campaign overview (clicks by day + totals). */
  stats(query: MarketingStatsQuery = {}): Promise<MarketingStats> {
    return this.http.get<MarketingStats>(withQuery("/api/marketing/stats", { campaign: query.campaign, from: query.from, to: query.to }));
  }
}
