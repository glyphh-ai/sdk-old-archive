/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * ConnectionsClient path mapping — the rich org-MCP catalog + org-shared Pipedream
 * surfaces hit the exact method + path the server mounts, and the list methods unwrap
 * `{ connections }`. Deterministic with a recording stub.
 */

import { describe, it, expect } from "vitest";
import { ConnectionsClient } from "../../src/resources/connections.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";

interface Call { method: string; path: string; body?: unknown }

function recorder(getReturn: unknown = {}) {
  const calls: Call[] = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return getReturn as unknown; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {} as unknown; },
    patch: async (path: string, body?: unknown) => { calls.push({ method: "PATCH", path, body }); return {} as unknown; },
    put: async (path: string, body?: unknown) => { calls.push({ method: "PUT", path, body }); return {} as unknown; },
    del: async (path: string) => { calls.push({ method: "DELETE", path }); return {} as unknown; },
  };
  return { calls, client: new ConnectionsClient(stub as unknown as AuthedHttp) };
}

describe("ConnectionsClient — org custom-MCP catalog", () => {
  it("orgMcpList GETs and unwraps { connections }", async () => {
    const rows = [{ slug: "mcp-a", name: "A", iconSha: null, url: "u", enabled: true, headerKeys: [], toolCount: 0 }];
    const { calls, client } = recorder({ connections: rows });
    expect(await client.orgMcpList()).toEqual(rows);
    expect(calls).toEqual([{ method: "GET", path: "/api/org/mcp-connections" }]);
  });





  it("appTools GETs the connector tools route, URL-encoded", async () => {
    const { calls, client } = recorder({ tools: [] });
    await client.appTools("google/sheets");
    expect(calls).toEqual([{ method: "GET", path: "/api/connectors/apps/google%2Fsheets/tools" }]);
  });

  it("mcpTools GETs the org-mcp tools route and unwraps { tools }", async () => {
    const tools = [{ name: "send", description: null }];
    const { calls, client } = recorder({ tools });
    expect(await client.mcpTools("mcp-a/x")).toEqual(tools);
    expect(calls).toEqual([{ method: "GET", path: "/api/org/mcp-connections/mcp-a%2Fx/tools" }]);
  });

  it("resolvedTools GETs /api/connections/tools and keeps the { connections } shape", async () => {
    const connections = [{ slug: "mcp-a", name: "A", kind: "custom_mcp", tools: [] }];
    const { calls, client } = recorder({ connections });
    expect(await client.resolvedTools()).toEqual({ connections });
    expect(calls).toEqual([{ method: "GET", path: "/api/connections/tools" }]);
  });

});

describe("ConnectionsClient — org-shared Pipedream", () => {
  it("pipedreamList GETs and unwraps { connections }", async () => {
    const rows = [{ id: "1", appSlug: "slack", appName: "Slack", name: "Slack", icon: null, healthy: true, createdAt: "t" }];
    const { calls, client } = recorder({ connections: rows });
    expect(await client.pipedreamList()).toEqual(rows);
    expect(calls).toEqual([{ method: "GET", path: "/api/org/connections" }]);
  });


  it("pipedreamDisconnect DELETEs the id route", async () => {
    const { calls, client } = recorder();
    await client.pipedreamDisconnect("acc-1");
    expect(calls).toEqual([{ method: "DELETE", path: "/api/org/connections/acc-1" }]);
  });
});
