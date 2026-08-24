/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/app-servers.ts — the app-server IMAGE catalog picker. `list` is the
 * org-scoped set of active SKUs (sm/md/lg) in the caller org's region, cheapest first —
 * what a size picker renders before a deploy-to-server. Admin CRUD lives on
 * `client.admin` (the runtime-images treatment). The deploy + domain operations live on
 * `client.hosting`, since they act on an app, not the catalog.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { AppServerImage } from "../contract/app-servers.js";

export class AppServersClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The active app-server images available to the caller org (its region), cheapest first. */
  list(): Promise<AppServerImage[]> {
    return this.http.get<AppServerImage[]>("/api/app-servers");
  }
}
