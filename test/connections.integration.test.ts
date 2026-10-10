/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Connections ↔ live control plane. Custom MCP install/list/remove (write-only
 * headers) + the Pipedream-unconfigured path. Needs the server on :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`conn-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/sdk — connections", () => {


  it("apps() searches the connector catalog and returns typed { apps } (degrades to [] when unconfigured)", async () => {
    const client = await signIn();
    const { apps } = await client.connections.apps({ search: "slack", limit: 5 });
    expect(Array.isArray(apps)).toBe(true);
    // Whether Pipedream is live-configured or not, every row matches ConnectorApp.
    for (const a of apps) {
      expect(typeof a.id).toBe("string");
      expect(typeof a.name).toBe("string");
      expect(a.icon === null || typeof a.icon === "string").toBe(true);
    }
  });

  it("org custom-MCP catalog, appTools and org-shared Pipedream for a fresh org", async () => {
    const client = await signIn(); // a personal-org org_admin
    expect(await client.connections.orgMcpList()).toEqual([]);

    // appTools — typed { tools } list.
    const { tools } = await client.connections.appTools("slack");
    expect(Array.isArray(tools)).toBe(true);

    // org-shared Pipedream — empty for a fresh org; disconnect 404s an unknown id.
    expect(await client.connections.pipedreamList()).toEqual([]);
    await expect(client.connections.pipedreamDisconnect(randomUUID())).rejects.toMatchObject({ httpStatus: 404 });
  });

  it("mcpTools (org_admin) 404s a connection the org does not have", async () => {
    const client = await signIn(); // a personal-org org_admin
    await expect(client.connections.mcpTools("mcp-does-not-exist")).rejects.toMatchObject({ httpStatus: 404 });
  });

  it("resolvedTools returns the { connections } shape (empty for a fresh org)", async () => {
    const client = await signIn();
    const resolved = await client.connections.resolvedTools();
    expect(Array.isArray(resolved.connections)).toBe(true);
    expect(resolved.connections).toEqual([]);
  });



});
