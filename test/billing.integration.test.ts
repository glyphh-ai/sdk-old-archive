/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Billing ↔ live control plane. Plans catalog, a new org's status + free credit
 * balance, and the "Stripe not configured" path for subscribe. Needs the server on
 * :3001 (Stripe runs unconfigured in dev → subscribe is a clean 404).
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`bill-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/client — billing", () => {
  it("lists the seeded plans (Free/Basic/Pro/Enterprise)", async () => {
    const plans = await (await signIn()).billing.plans();
    const byTier = Object.fromEntries(plans.map((p) => [p.tier, p]));
    expect(byTier.free!.monthlyCredits).toBe(25);
    expect(byTier.basic!.monthlyCredits).toBe(2000);
    expect(byTier.pro!.monthlyCredits).toBe(10000);
    expect(byTier.enterprise!.sso).toBe(true);
  });

  it("a new org is on the free tier with its 25-credit grant", async () => {
    const client = await signIn();
    const status = await client.billing.status();
    expect(status.tier).toBe("free");
    expect(status.maxSeats).toBe(1);
    expect((await client.billing.balance()).credits).toBe(25);
  });

  it("subscribe returns a clean not-configured error when Stripe is off (dev)", async () => {
    const client = await signIn();
    await expect(client.billing.subscribe("basic")).rejects.toMatchObject({ code: "E_NOT_FOUND" });
  });
});
