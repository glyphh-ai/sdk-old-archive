/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Catalog ↔ live control plane. Read the platform catalog + org provider enablement
 * (BYOK write-only). Admin (super_admin) release is covered server-side. Needs :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`cat-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/client — catalog", () => {
  it("lists the seeded models with credit pricing", async () => {
    const models = await (await signIn()).catalog.models();
    const opus = models.find((m) => m.id === "anthropic::claude-opus-4-8");
    expect(opus).toBeTruthy();
    expect(opus!.inputCreditsPerMTok).toBe(417);
    expect(opus!.providerSlug).toBe("anthropic");
  });

  it("enable a provider with a BYOK key (write-only) then disable", async () => {
    const client = await signIn();
    const before = await client.catalog.providers();
    expect(before.find((p) => p.slug === "anthropic")!.enabledForOrg).toBe(false);

    const enabled = await client.providers.enable("anthropic", "sk-secret-never-returned");
    expect(enabled.enabledForOrg).toBe(true);
    expect(enabled.hasByokKey).toBe(true);
    // the key must never appear in any response
    expect(JSON.stringify(enabled)).not.toContain("sk-secret");

    await client.providers.disable("anthropic");
    const after = await client.catalog.providers();
    expect(after.find((p) => p.slug === "anthropic")!.enabledForOrg).toBe(false);
  });

  it("enabling an unknown provider is a 404", async () => {
    await expect((await signIn()).providers.enable("no-such-provider")).rejects.toMatchObject({ httpStatus: 404 });
  });
});
