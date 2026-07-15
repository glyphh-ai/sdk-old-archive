/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/admin.ts — Glyphh platform administration (super_admin only; the server
 * enforces the role — a non-super_admin call surfaces as ForbiddenError). Releases
 * providers/models into the runtime catalog and sets credit pricing.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Provider, Model, ProviderCreate, ModelCreate, ModelPricing } from "../contract/catalog.js";

export class AdminClient {
  constructor(private readonly http: AuthedHttp) {}

  createProvider(input: ProviderCreate): Promise<Provider> {
    return this.http.post<Provider>("/api/admin/providers", input);
  }

  createModel(input: ModelCreate): Promise<Model> {
    return this.http.post<Model>("/api/admin/models", input);
  }

  setModelPricing(id: string, pricing: ModelPricing): Promise<Model> {
    return this.http.patch<Model>(`/api/admin/models/${encodeURIComponent(id)}`, pricing);
  }
}
