/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * AdminClient path mapping — the super_admin catalog surface (createModel POSTs the
 * catalog wire shape; deleteModel DELETEs the (provider, model) route) hits the
 * exact HTTP method + path the server mounts. Deterministic with a recording stub.
 */

import { describe, it, expect } from "vitest";
import { AdminClient } from "../../src/resources/admin.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";

interface Call { method: string; path: string; body?: unknown }

function recorder() {
  const calls: Call[] = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return {} as unknown; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {} as unknown; },
    patch: async (path: string, body?: unknown) => { calls.push({ method: "PATCH", path, body }); return {} as unknown; },
    put: async (path: string, body?: unknown) => { calls.push({ method: "PUT", path, body }); return {} as unknown; },
    del: async (path: string) => { calls.push({ method: "DELETE", path }); return undefined as unknown; },
  };
  return { calls, client: new AdminClient(stub as unknown as AuthedHttp) };
}

describe("AdminClient catalog mutations", () => {
  it("createModel POSTs the catalog wire shape to /api/admin/models", async () => {
    const { calls, client } = recorder();
    const input = { id: "acme::m1", providerSlug: "acme", name: "M1", kind: "proxied" as const, inputCreditsPerMTok: 3, outputCreditsPerMTok: 6 };
    await client.createModel(input);
    expect(calls).toEqual([{ method: "POST", path: "/api/admin/models", body: input }]);
  });

  it("deleteModel DELETEs the (provider, model) route, URL-encoded", async () => {
    const { calls, client } = recorder();
    await client.deleteModel("acme", "m/1");
    expect(calls).toEqual([{ method: "DELETE", path: "/api/admin/models/acme/m%2F1" }]);
  });
});
