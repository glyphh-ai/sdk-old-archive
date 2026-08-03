/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Sessions ↔ live control plane. Provision a runtime (LocalProvisioner in dev),
 * receive a one-time `gy_rk_` runtime token + a ready `runtimeUrl`, see it in the
 * list, then deprovision. Needs the server on :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`sess-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/sdk — sessions", () => {
  it("provisions a runtime, lists it, and deprovisions", async () => {
    const client = await signIn();

    const { session, runtimeToken } = await client.sessions.create({ rotor: "default" });
    expect(session.status).toBe("ready");
    expect(session.rotor).toBe("default");
    expect(session.runtimeUrl).toBeTruthy();
    expect(runtimeToken).toMatch(/^gy_rk_/);

    const listed = await client.sessions.list();
    expect(listed.some((s) => s.id === session.id)).toBe(true);
    // The token is never echoed back on reads.
    expect(JSON.stringify(listed)).not.toContain(runtimeToken);

    const got = await client.sessions.get(session.id);
    expect(got.id).toBe(session.id);

    await client.sessions.delete(session.id);
    // After deprovision it is gone or stopped — either way not "ready".
    const after = await client.sessions.list();
    const still = after.find((s) => s.id === session.id);
    expect(still?.status ?? "stopped").not.toBe("ready");
  });
});
