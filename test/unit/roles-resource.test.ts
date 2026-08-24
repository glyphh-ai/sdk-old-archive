/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * RolesClient wire shapes — the /api/roles surface and the role → glyphh-model
 * grant routes, recorded against a stub transport.
 */

import { describe, it, expect } from "vitest";
import { RolesClient } from "../../src/resources/roles.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";

interface Call {
  method: string;
  path: string;
  body?: unknown;
}

function recorder(): { calls: Call[]; client: RolesClient } {
  const calls: Call[] = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return [] as unknown; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {} as unknown; },
    patch: async (path: string, body?: unknown) => { calls.push({ method: "PATCH", path, body }); return {} as unknown; },
    put: async (path: string, body?: unknown) => { calls.push({ method: "PUT", path, body }); return {} as unknown; },
    del: async (path: string) => { calls.push({ method: "DELETE", path }); return undefined as unknown; },
  };
  return { calls, client: new RolesClient(stub as unknown as AuthedHttp) };
}

describe("RolesClient wire shapes", () => {
  it("CRUD rides /api/roles", async () => {
    const { calls, client } = recorder();
    await client.list();
    await client.create({ name: "Analysts" });
    await client.update("r1", { name: "Analysts EMEA" });
    await client.delete("r/1");
    expect(calls).toEqual([
      { method: "GET", path: "/api/roles" },
      { method: "POST", path: "/api/roles", body: { name: "Analysts" } },
      { method: "PATCH", path: "/api/roles/r1", body: { name: "Analysts EMEA" } },
      { method: "DELETE", path: "/api/roles/r%2F1" },
    ]);
  });

  it("model grants ride /api/roles/:id/models — PUT upserts by slug, tools default null (all tools)", async () => {
    const { calls, client } = recorder();
    await client.modelGrants("r1");
    await client.setModelGrant("r1", { modelSlug: "toolrouter" });
    await client.setModelGrant("r1", { modelSlug: "firewall", tools: ["classify", "score"] });
    await client.removeModelGrant("r1", "toolrouter");
    expect(calls).toEqual([
      { method: "GET", path: "/api/roles/r1/models" },
      { method: "PUT", path: "/api/roles/r1/models/toolrouter", body: { tools: null } },
      { method: "PUT", path: "/api/roles/r1/models/firewall", body: { tools: ["classify", "score"] } },
      { method: "DELETE", path: "/api/roles/r1/models/toolrouter" },
    ]);
  });
});
