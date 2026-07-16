/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Admin ↔ live control plane. The console is super_admin-only; a normal user's
 * createOrg surfaces as a ForbiddenError (403) — proving the typed method + the
 * server's role gate are wired. The super_admin happy path is covered server-side.
 * Needs the server on :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, ForbiddenError } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn() {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`admin-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/client — admin.createOrg", () => {
  it("is forbidden for a non-super_admin", async () => {
    const client = await signIn();
    await expect(client.admin.createOrg({ name: "Globex" })).rejects.toBeInstanceOf(ForbiddenError);
  });
});
