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

describe("@glyphh/client — connections", () => {
  it("install a custom MCP (write-only headers) → list → remove", async () => {
    const client = await signIn();
    expect(await client.connections.list()).toEqual([]);

    const conn = await client.connections.installCustomMcp({
      slug: "sfdc",
      name: "Salesforce",
      url: "https://mcp.example.com",
      headers: { Authorization: "Bearer super-secret-token" },
    });
    expect(conn.slug).toBe("mcp-sfdc"); // auto-prefixed
    expect(conn.kind).toBe("custom_mcp");
    expect(conn.hasCredentials).toBe(true);
    expect(JSON.stringify(conn)).not.toContain("super-secret");

    const list = await client.connections.list();
    expect(list.some((c) => c.slug === "mcp-sfdc")).toBe(true);

    await client.connections.removeCustomMcp("mcp-sfdc");
    expect(await client.connections.list()).toEqual([]);
  });

  it("Pipedream connect returns a hosted connect link (live-configured)", async () => {
    const { url } = await (await signIn()).connections.pipedreamConnectLink();
    expect(url).toMatch(/^https:\/\/pipedream\.com\//);
  });
});
