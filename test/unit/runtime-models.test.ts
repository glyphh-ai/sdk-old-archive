/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime-models.test.ts — the governed SDK↔openrotor model bridge: resolveModels turns a
 * rotor's role→model binding into the endpoint map (gateway → url+bearer+metered; local →
 * ensureLocalModel url+free), honors `provider::` stripping + overrides, and switchModel
 * audits every switch while updating the in-process override the next resolve layers on.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// The local model server is mocked — no real download, spawn, or llama binary.
vi.mock("../../src/models/manager.js", () => ({
  ensureLocalModel: vi.fn(async (id: string) => ({ url: "http://127.0.0.1:52001", model: id, pid: 4242 })),
}));

import {
  resolveModels,
  switchModel,
  sessionOverrides,
  clearSessionOverrides,
} from "../../src/runtime/index.js";
import { ensureLocalModel } from "../../src/models/manager.js";
import type { Client } from "../../src/index.js";
import type { RotorRegistry } from "../../src/contract/bindings.js";

/** A gateway (metered) planner role + a local (free) coder role, the coder still `provider::`-prefixed. */
function reg(): RotorRegistry {
  return {
    rotorSlug: "coder",
    models: [
      { role: "planner", transport: "gateway", url: "https://gw.glyphh.ai/v1", model: "claude-opus-4-8", metered: true },
      { role: "coder", transport: "local", url: null, model: "openweights::qwen2.5-7b", metered: false },
    ],
  };
}

/** A minimal Client stub: only the two resources the bridge touches. */
function fakeClient(
  registry: RotorRegistry | Error,
  record: ReturnType<typeof vi.fn> = vi.fn(async () => ({})),
): Client {
  return {
    rotorConfig: {
      registry: vi.fn(async () => {
        if (registry instanceof Error) throw registry;
        return registry;
      }),
    },
    sessions: { recordModelSwitch: record },
  } as unknown as Client;
}

beforeEach(() => {
  vi.mocked(ensureLocalModel).mockClear();
  clearSessionOverrides("s1");
});

describe("resolveModels", () => {
  it("maps gateway → url+bearer+metered and local → ensureLocalModel url+free", async () => {
    const client = fakeClient(reg());
    const out = await resolveModels(client, { rotorSlug: "coder", token: "TKN" });
    expect(out).toBeDefined();
    expect(out!.registry.planner).toEqual({
      url: "https://gw.glyphh.ai/v1",
      model: "claude-opus-4-8",
      headers: { authorization: "Bearer TKN" },
      metered: true,
    });
    expect(out!.registry.coder).toEqual({ url: "http://127.0.0.1:52001", model: "qwen2.5-7b", metered: false });
    // The `provider::` prefix is stripped before serving the local model.
    expect(ensureLocalModel).toHaveBeenCalledWith("qwen2.5-7b");
  });

  it("returns undefined when nothing is bound", async () => {
    const client = fakeClient({ rotorSlug: "coder", models: [] });
    expect(await resolveModels(client, { rotorSlug: "coder", token: "TKN" })).toBeUndefined();
  });

  it("returns undefined when the control plane can't resolve the rotor", async () => {
    const client = fakeClient(new Error("unknown rotor"));
    expect(await resolveModels(client, { rotorSlug: "nope", token: "TKN" })).toBeUndefined();
  });

  it("an override redirects a role to the override model (same gateway transport)", async () => {
    const client = fakeClient(reg());
    const out = await resolveModels(client, {
      rotorSlug: "coder",
      token: "TKN",
      overrides: { planner: "anthropic::claude-haiku-5" },
    });
    // Same gateway url + bearer + metered, but the switched-to model, prefix stripped.
    expect(out!.registry.planner).toEqual({
      url: "https://gw.glyphh.ai/v1",
      model: "claude-haiku-5",
      headers: { authorization: "Bearer TKN" },
      metered: true,
    });
    // The un-overridden role is untouched.
    expect(out!.registry.coder!.model).toBe("qwen2.5-7b");
  });

  it("an override adopts the transport/url of a twin role already bound to that model", async () => {
    const client = fakeClient(reg());
    // Override the gateway planner to the coder's LOCAL model → adopts local transport.
    const out = await resolveModels(client, {
      rotorSlug: "coder",
      token: "TKN",
      overrides: { planner: "openweights::qwen2.5-7b" },
    });
    expect(out!.registry.planner).toEqual({ url: "http://127.0.0.1:52001", model: "qwen2.5-7b", metered: false });
  });
});

describe("switchModel", () => {
  it("audits the switch and stores the override so the next resolveModels picks it up", async () => {
    const record = vi.fn(async () => ({ sessionId: "s1", from: null, to: "x", surface: "cli" }));
    const client = fakeClient(reg(), record);

    await switchModel(client, {
      sessionId: "s1",
      rotorSlug: "coder",
      role: "planner",
      from: "anthropic::claude-opus-4-8",
      to: "anthropic::claude-haiku-5",
      surface: "cli",
    });

    // (a) The switch is audited with the full context.
    expect(record).toHaveBeenCalledWith({
      sessionId: "s1",
      rotorSlug: "coder",
      role: "planner",
      to: "anthropic::claude-haiku-5",
      surface: "cli",
      from: "anthropic::claude-opus-4-8",
    });
    // (b) The override is stored…
    expect(sessionOverrides("s1", "coder")).toEqual({ planner: "anthropic::claude-haiku-5" });
    // …and the next resolve reflects it.
    const out = await resolveModels(client, {
      rotorSlug: "coder",
      token: "TKN",
      overrides: sessionOverrides("s1", "coder"),
    });
    expect(out!.registry.planner!.model).toBe("claude-haiku-5");
  });

  it("audits again on a second switch (haiku→opus) and updates the override", async () => {
    const record = vi.fn(async () => ({ sessionId: "s1", from: null, to: "x", surface: "cli" }));
    const client = fakeClient(reg(), record);

    await switchModel(client, { sessionId: "s1", rotorSlug: "coder", role: "planner", to: "anthropic::claude-haiku-5", surface: "cli" });
    await switchModel(client, { sessionId: "s1", rotorSlug: "coder", role: "planner", to: "anthropic::claude-opus-4-8", surface: "cli" });

    expect(record).toHaveBeenCalledTimes(2);
    expect(sessionOverrides("s1", "coder")).toEqual({ planner: "anthropic::claude-opus-4-8" });
  });

  it("omits `from` from the audit call when not supplied", async () => {
    const record = vi.fn(async (_input: Record<string, unknown>) => ({ sessionId: "s1", from: null, to: "x", surface: "cli" }));
    const client = fakeClient(reg(), record);
    await switchModel(client, { sessionId: "s1", rotorSlug: "coder", role: "planner", to: "anthropic::claude-haiku-5", surface: "cli" });
    expect(record.mock.calls[0]![0]).not.toHaveProperty("from");
  });
});
