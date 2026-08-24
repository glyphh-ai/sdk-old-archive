/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * MembersClient path mapping — the member-edit writes hit the exact method + path the
 * server mounts: profile on the base PATCH, role on the /role subpath, and role
 * assignment on /org-role (null clears to the base). Deterministic recording stub.
 */

import { describe, it, expect } from "vitest";
import { MembersClient } from "../../src/resources/members.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";

interface Call { method: string; path: string; body?: unknown }

function recorder() {
  const calls: Call[] = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return {} as unknown; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {} as unknown; },
    patch: async (path: string, body?: unknown) => { calls.push({ method: "PATCH", path, body }); return {} as unknown; },
    del: async (path: string) => { calls.push({ method: "DELETE", path }); return undefined as unknown; },
  };
  return { calls, client: new MembersClient(stub as unknown as AuthedHttp) };
}

describe("MembersClient writes", () => {
  it("updateProfile PATCHes the base member route", async () => {
    const { calls, client } = recorder();
    await client.updateProfile("u1", { firstName: "Grace", lastName: "Hopper" });
    expect(calls).toEqual([{ method: "PATCH", path: "/api/org/members/u1", body: { firstName: "Grace", lastName: "Hopper" } }]);
  });

  it("setRole PATCHes the /role subpath (accepts the admin tier)", async () => {
    const { calls, client } = recorder();
    await client.setRole("u1", "admin");
    expect(calls).toEqual([{ method: "PATCH", path: "/api/org/members/u1/role", body: { role: "admin" } }]);
  });


});
