/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/usage.ts — usage rollups (read). One ledger, so mine ⊆ workspace ⊆ org
 * by construction. (Ingest is the runtime's service-gated endpoint, not a client call.)
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { UsageSummary } from "../contract/usage.js";

export class UsageClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The caller's own usage. */
  mine(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/mine");
  }

  /** A workspace rollup (must be in the caller's org). */
  workspace(id: string): Promise<UsageSummary> {
    return this.http.get<UsageSummary>(`/api/usage/workspace/${encodeURIComponent(id)}`);
  }

  /** The org rollup (org_admin). */
  org(): Promise<UsageSummary> {
    return this.http.get<UsageSummary>("/api/usage/org");
  }
}
