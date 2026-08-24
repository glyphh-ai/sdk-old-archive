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

describe("@glyphh/sdk — billing", () => {
  it("lists the seeded plans (Free/Basic/Pro/Enterprise)", async () => {
    const plans = await (await signIn()).billing.plans();
    const byTier = Object.fromEntries(plans.map((p) => [p.tier, p]));
    expect(byTier.free).toBeDefined();
    expect(byTier.basic).toBeDefined();
    expect(byTier.pro).toBeDefined();
    expect(byTier.enterprise!.sso).toBe(true);
  });

  it("a new org is on the free tier", async () => {
    const client = await signIn();
    const status = await client.billing.status();
    expect(status.tier).toBe("free");
    expect(status.maxSeats).toBe(1);
  });

  it("subscribe returns a Stripe checkout URL", async () => {
    const client = await signIn();
    const { url } = await client.billing.subscribe("basic");
    expect(url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  it("changePlan() on a free org yields a Checkout fallback URL", async () => {
    const client = await signIn();
    const change = await client.billing.changePlan("pro");
    expect(change.effect).toBe("checkout");
    expect(change.url).toMatch(/^https:\/\/checkout\.stripe\.com\//);
  });

  it("invoices() returns an array (empty for a new org)", async () => {
    const client = await signIn();
    expect(await client.billing.invoices()).toEqual([]);
  });
});
