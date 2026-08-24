/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Roles ↔ live control plane. Base role on signup, CRUD, and the role → glyphh
 * model grants. Needs the server on :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`role-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/sdk — roles", () => {
  it("signup creates one base role", async () => {
    const client = await signIn();
    const list = await client.roles.list();
    expect(list).toHaveLength(1);
    expect(list[0]!.isBase).toBe(true);
    expect(list[0]!.name).toBe("Members");
  });

  it("create → rename → delete a non-base role", async () => {
    const client = await signIn();
    const created = await client.roles.create({ name: "Analysts" });
    expect(created.name).toBe("Analysts");
    expect(created.isBase).toBe(false);

    const updated = await client.roles.update(created.id, { name: "Analysts EMEA" });
    expect(updated.name).toBe("Analysts EMEA");

    await client.roles.delete(created.id);
    expect((await client.roles.list()).some((r) => r.id === created.id)).toBe(false);
  });

  it("the base role cannot be deleted", async () => {
    const client = await signIn();
    const base = (await client.roles.list()).find((r) => r.isBase)!;
    await expect(client.roles.delete(base.id)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("installed models: install with tools, list, and gate grants on them", async () => {
    const client = await signIn();
    const role = await client.roles.create({ name: "Modelers" });
    try {
      // Grants against a model that is NOT installed are refused.
      await expect(client.roles.setModelGrant(role.id, { modelSlug: "toolrouter" })).rejects.toMatchObject({ httpStatus: 404 });

      const installed = await client.roles.installModel("toolrouter", { displayName: "Tool Router", tools: ["route", "score"] });
      expect(installed.slug).toBe("toolrouter");
      expect(installed.tools).toEqual(["route", "score"]);

      const { models, allowCustom } = await client.roles.orgModels();
      expect(models.some((m) => m.slug === "toolrouter")).toBe(true);
      expect(allowCustom).toBe(true);

      // Grant all tools, then narrow to a subset; an unknown tool is refused.
      const all = await client.roles.setModelGrant(role.id, { modelSlug: "toolrouter" });
      expect(all.tools).toBeNull();
      const narrowed = await client.roles.setModelGrant(role.id, { modelSlug: "toolrouter", tools: ["route"] });
      expect(narrowed.tools).toEqual(["route"]);
      await expect(client.roles.setModelGrant(role.id, { modelSlug: "toolrouter", tools: ["bogus"] })).rejects.toMatchObject({ httpStatus: 400 });

      // Uninstall revokes the role's grant with it.
      await client.roles.uninstallModel("toolrouter");
      expect(await client.roles.modelGrants(role.id)).toEqual([]);

      // The custom-models policy round-trips.
      await client.roles.setModelsPolicy(false);
      expect((await client.roles.orgModels()).allowCustom).toBe(false);
      await client.roles.setModelsPolicy(true);
    } finally {
      await client.roles.delete(role.id);
    }
  });

  it("role members: add, list, remove — a member can hold several roles", async () => {
    const client = await signIn();
    const me = await client.me();
    const a = await client.roles.create({ name: "Alpha" });
    const b = await client.roles.create({ name: "Beta" });
    try {
      await client.roles.addMember(a.id, me.userId);
      await client.roles.addMember(b.id, me.userId);
      const membersA = await client.roles.members(a.id);
      const membersB = await client.roles.members(b.id);
      expect(membersA.some((m) => m.userId === me.userId)).toBe(true);
      expect(membersB.some((m) => m.userId === me.userId)).toBe(true);

      await client.roles.removeMember(a.id, me.userId);
      expect((await client.roles.members(a.id)).some((m) => m.userId === me.userId)).toBe(false);
      // Still holds the other role.
      expect((await client.roles.members(b.id)).some((m) => m.userId === me.userId)).toBe(true);
    } finally {
      await client.roles.delete(a.id);
      await client.roles.delete(b.id);
    }
  });
});
