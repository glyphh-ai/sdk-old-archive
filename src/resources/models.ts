/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/models.ts — the caller's EFFECTIVE model set. `available()` returns the
 * models this member may actually use right now — the catalog narrowed by the org's
 * supported set and the caller's workspace allow-list — each tagged with how it's
 * reached (proxy / byok / local). This is what a model picker should show.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { AvailableModel } from "../contract/models.js";

export class ModelsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The models the caller may actually use (catalog ∩ org-supported ∩ workspace allow-list). */
  available(): Promise<AvailableModel[]> {
    return this.http.get<AvailableModel[]>("/api/models/available");
  }
}
