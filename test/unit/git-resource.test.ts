/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * GitClient path mapping — the GitHub lane hits the exact method + path the server
 * mounts: connect carries a returnTo only when given, branches names the repo's two
 * segments URL-encoded, and a cloud run carries the base branch only beside its repo.
 * Deterministic with a recording stub.
 */

import { describe, it, expect } from "vitest";
import { GitClient } from "../../src/resources/git.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";

interface Call { method: string; path: string; body?: unknown }

function recorder(getReturn: unknown = {}) {
  const calls: Call[] = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return getReturn as unknown; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {} as unknown; },
    del: async (path: string) => { calls.push({ method: "DELETE", path }); return {} as unknown; },
  };
  return { calls, client: new GitClient(stub as unknown as AuthedHttp) };
}

describe("GitClient — the GitHub lane", () => {
  it("connect POSTs an empty body, or the returnTo when given", async () => {
    const { calls, client } = recorder();
    await client.connect();
    await client.connect({ returnTo: "https://mobile.glyphh.ai/settings" });
    expect(calls).toEqual([
      { method: "POST", path: "/api/git/connect", body: {} },
      { method: "POST", path: "/api/git/connect", body: { returnTo: "https://mobile.glyphh.ai/settings" } },
    ]);
  });

  it("complete POSTs the link when given, an empty body for the newest pending one, and returns the status shape", async () => {
    const { calls, client } = recorder();
    await client.complete("n0nce");
    await client.complete();
    expect(calls).toEqual([
      { method: "POST", path: "/api/git/connect/complete", body: { link: "n0nce" } },
      { method: "POST", path: "/api/git/connect/complete", body: {} },
    ]);
  });

  it("status, repos and disconnect hit their routes", async () => {
    const { calls, client } = recorder([]);
    await client.status();
    await client.repos();
    await client.disconnect();
    expect(calls.map((c) => [c.method, c.path])).toEqual([["GET", "/api/git/status"], ["GET", "/api/git/repos"], ["DELETE", "/api/git/connection"]]);
  });

  it("branches GETs the repo's branches route, each segment URL-encoded, and refuses a name that is not owner/name", async () => {
    const rows = [{ name: "main", default: true }, { name: "release/1.0", default: false }];
    const { calls, client } = recorder(rows);
    expect(await client.branches("glyphh-ai/sdk")).toEqual(rows);
    await client.branches("o/we ird");
    expect(calls).toEqual([
      { method: "GET", path: "/api/git/repos/glyphh-ai/sdk/branches" },
      { method: "GET", path: "/api/git/repos/o/we%20ird/branches" },
    ]);
    expect(() => client.branches("sdk")).toThrow(/owner\/name/);
    expect(() => client.branches("/sdk")).toThrow(/owner\/name/);
  });

  it("cloneToken POSTs the repo", async () => {
    const { calls, client } = recorder();
    await client.cloneToken("glyphh-ai/sdk");
    expect(calls).toEqual([{ method: "POST", path: "/api/git/clone-token", body: { repo: "glyphh-ai/sdk" } }]);
  });
});
