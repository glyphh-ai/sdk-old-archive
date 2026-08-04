/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Panel broker ↔ live control plane. Opens a server-brokered browser panel, receives a
 * pod-minted panelId + a public wsUrl + a one-time scoped `gy_pt_` token, navigates it,
 * and closes it. Needs the server on :3011 with PANEL_POD_URL pointing at a FAKE pod
 * (this test starts one; the verify harness passes its URL to the server). When the
 * server has no PANEL_POD_URL the broker is "not configured" and the test SKIPS the flow
 * (the SDK surface + route wiring are still proven by cli-parity + the server suite).
 */

import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";
const podConfigured = !!process.env.GLYPHH_PANEL_POD_CONFIGURED;

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`panel-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

// A minimal FAKE pod so verify needs no real Chromium. The harness sets PANEL_POD_URL to
// this pod's address on the server before launch (see the verify script).
let pod: Server;
const podCalls = { nav: 0, close: 0 };
beforeAll(async () => {
  let n = 0;
  pod = createServer((req, res) => {
    const path = (req.url ?? "").split("?", 1)[0] ?? "";
    res.setHeader("content-type", "application/json");
    if (req.method === "POST" && path === "/panel/browser") {
      const id = `pnl_${++n}`;
      res.end(JSON.stringify({ panelId: id, wsPath: `/panel/browser/${id}`, wire: "glyphh.panel/v1" }));
      return;
    }
    if (req.method === "POST" && path === "/panel/terminal") {
      const id = `trm_${++n}`;
      res.end(JSON.stringify({ panelId: id, wsPath: `/panel/terminal/${id}`, wire: "glyphh.terminal/v1" }));
      return;
    }
    if (req.method === "POST" && /\/nav$/.test(path)) { podCalls.nav++; res.end(JSON.stringify({ ok: true })); return; }
    if (req.method === "DELETE") { podCalls.close++; res.end(JSON.stringify({ ok: true })); return; }
    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not-found" }));
  });
  const podPort = Number(process.env.PANEL_FAKE_POD_PORT ?? 8099);
  await new Promise<void>((r) => pod.listen(podPort, "127.0.0.1", r));
});
afterAll(async () => {
  await new Promise<void>((r) => pod.close(() => r()));
});

describe("@glyphh/sdk — panel broker", () => {
  it.skipIf(!podConfigured)("opens a brokered browser panel, navigates, and closes", async () => {
    const client = await signIn();
    const opened = await client.panel.openBrowser({ url: "https://example.com", deviceScaleFactor: 2 });
    expect(opened.panelId).toMatch(/^pnl_/);
    expect(opened.wsUrl).toMatch(/^wss?:\/\/.+\/panel\/browser\//);
    expect(opened.token).toMatch(/^gy_pt_/);

    const nav = await client.panel.nav(opened.panelId, "https://news.ycombinator.com");
    expect(nav.ok).toBe(true);

    await client.panel.close(opened.panelId);
  });

  it.skipIf(!podConfigured)("opens a brokered TERMINAL panel and closes it", async () => {
    const client = await signIn();
    const opened = await client.panel.openTerminal({ sessionId: "sess-1", cols: 100, rows: 30 });
    expect(opened.panelId).toMatch(/^trm_/);
    expect(opened.wsUrl).toMatch(/^wss?:\/\/.+\/panel\/terminal\//);
    expect(opened.token).toMatch(/^gy_pt_/);
    expect(opened.wire).toBe("glyphh.terminal/v1");
    await client.panel.closeTerminal(opened.panelId);
  });

  it("exposes the panel surface on the client", () => {
    const client = createClient({ url });
    expect(typeof client.panel.openBrowser).toBe("function");
    expect(typeof client.panel.nav).toBe("function");
    expect(typeof client.panel.close).toBe("function");
    expect(typeof client.panel.openTerminal).toBe("function");
    expect(typeof client.panel.closeTerminal).toBe("function");
  });
});
