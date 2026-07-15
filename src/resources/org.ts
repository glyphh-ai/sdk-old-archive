/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/org.ts — the caller's organization. Read + (org_admin) update. Authz is
 * server-side; a non-admin update surfaces as a ForbiddenError.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Org, OrgUpdate } from "../contract/org.js";

export class OrgClient {
  constructor(private readonly http: AuthedHttp) {}

  get(): Promise<Org> {
    return this.http.get<Org>("/api/org");
  }

  update(patch: OrgUpdate): Promise<Org> {
    return this.http.patch<Org>("/api/org", patch);
  }
}
