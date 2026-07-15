/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/catalog.ts — the provider/model catalog (read). What Glyphh released,
 * joined with the caller org's enablement.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Provider, Model } from "../contract/catalog.js";

export class CatalogClient {
  constructor(private readonly http: AuthedHttp) {}

  providers(): Promise<Provider[]> {
    return this.http.get<Provider[]>("/api/catalog/providers");
  }

  models(): Promise<Model[]> {
    return this.http.get<Model[]>("/api/catalog/models");
  }
}
