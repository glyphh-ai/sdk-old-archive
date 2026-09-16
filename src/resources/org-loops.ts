/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/org-loops.ts — the ORG's loop support list: which CLIs this
 * organization runs at all. Mirrors orgModels exactly, and binds on every
 * plan — it is the org → user configuration, not something a tier buys.
 *
 * A loop off here is off for every member, whatever their role allows.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { OrgLoop } from "../contract/loops.js";

export class OrgLoopsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Every loop in the catalog with this org's on/off state. */
  list(): Promise<OrgLoop[]> {
    return this.http.get<OrgLoop[]>("/api/org/loops");
  }

  /** Turn one on or off for the whole org (org_admin). */
  setEnabled(cli: string, enabled: boolean): Promise<{ cli: string; enabled: boolean }> {
    return this.http.put<{ cli: string; enabled: boolean }>("/api/org/loops", { cli, enabled });
  }
}
