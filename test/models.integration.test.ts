/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Model governance ↔ live control plane: the org's model view (`orgModels.list`)
 * and the caller's EFFECTIVE set (`models.available`). A fresh server carries the
 * Ada model (server ada_model.py); every other model is the super admin's to add.
 * Needs a server at $GLYPHH_SERVER_URL.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";
const ADA = "glyphh::glyphh-ada-1.0";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`mdl-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/sdk — model governance", () => {
  it("lists the org's model view with its flags and list prices", async () => {
    const rows = await (await signIn()).orgModels.list();
    const ada = rows.find((m) => m.id === ADA);
    expect(ada).toBeTruthy();
    expect(ada!.providerEnabled).toBe(true);
    expect(typeof ada!.supported).toBe("boolean");
    expect(typeof ada!.inputUsdPerMTok).toBe("number");
  });

  it("available() is the caller's effective set: supported models, never Ada (a decision model, not a turn model)", async () => {
    const client = await signIn();
    const supported = new Set((await client.orgModels.list()).filter((m) => m.supported).map((m) => m.id));
    const available = (await client.models.available()).map((m) => m.id);
    expect(available.every((id) => supported.has(id))).toBe(true);
    expect(supported.has(ADA)).toBe(true);
    expect(available).not.toContain(ADA);
  });
});
