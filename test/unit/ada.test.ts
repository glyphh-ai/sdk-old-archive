/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Ada: every model call is the gateway's POST /ada on the member's own key,
 * naming its model; a registered device holds a local model's records in a
 * row store the server reads over the relay.
 */

import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { AdaClient } from "../../src/resources/ada.js";
import { openAdaStore } from "../../src/runtime/ada-store.js";
import type { AuthedHttp } from "../../src/core/authed-http.js";
import type { GatewayClient } from "../../src/resources/gateway.js";

type Call = { url: string; init: RequestInit };
const MODEL = "am_0123456789ab";

function gateway(token = { baseUrl: "https://gw.example/", token: "sk-member", gateway: true }) {
  let minted = 0;
  const gw = { token: async () => { minted++; return token; } } as unknown as GatewayClient;
  return { gw, minted: () => minted };
}

function http() {
  const calls: Array<{ method: string; path: string; body?: unknown }> = [];
  const stub = {
    get: async (path: string) => { calls.push({ method: "GET", path }); return { devices: [] }; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return { device_id: "dev_0123456789ab", name: "laptop" }; },
  } as unknown as AuthedHttp;
  return { stub, calls };
}

function fetcher(replies: Array<{ status?: number; body: unknown }>) {
  const calls: Call[] = [];
  const impl = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const r = replies.shift()!;
    return new Response(JSON.stringify(r.body), { status: r.status ?? 200 });
  }) as unknown as typeof fetch;
  return { impl, calls };
}

describe("AdaClient", () => {
  it("names the model on every call to the gateway's /ada, on the member key", async () => {
    const { gw, minted } = gateway();
    const { impl, calls } = fetcher([{ body: { data: { top: "dual_write", act: true } } }, { body: { data: { models: [{ model_id: MODEL }] } } }]);
    const ada = new AdaClient(http().stub, gw, impl);
    const answer = await ada.query({ modelId: MODEL, situation: { risk: "downtime" }, weights: { risk: 2 } });
    expect(answer.top).toBe("dual_write");
    const first = calls[0]!;
    expect(first.url).toBe("https://gw.example/ada");
    expect((first.init.headers as Record<string, string>).authorization).toBe("Bearer sk-member");
    expect(JSON.parse(String(first.init.body))).toEqual({ op: "query", model_id: MODEL, situation: { risk: "downtime" }, weights: { risk: 2 } });
    expect(await ada.models()).toEqual([{ model_id: MODEL }]);
    expect(minted()).toBe(1);
  });

  it("creates a local model with its device", async () => {
    const { impl, calls } = fetcher([{ body: { data: { model_id: MODEL } } }]);
    await new AdaClient(http().stub, gateway().gw, impl).createModel({ name: "routing", storage: "local", deviceId: "dev_0123456789ab" });
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ op: "create_model", name: "routing", storage: "local", device_id: "dev_0123456789ab" });
  });

  it("registers this machine with the session, not the gateway key", async () => {
    const h = http();
    const { impl, calls } = fetcher([]);
    const dev = await new AdaClient(h.stub, gateway().gw, impl).registerDevice("laptop");
    expect(dev.device_id).toBe("dev_0123456789ab");
    expect(h.calls).toEqual([{ method: "POST", path: "/api/ada/devices", body: { name: "laptop" } }]);
    expect(calls).toEqual([]);
  });

  it("turns Ada's refusals, an empty budget and a dead key into errors", async () => {
    const { gw, minted } = gateway();
    const { impl } = fetcher([
      { status: 400, body: { error: { code: "E_ADA", message: "situation must be a non-empty object" } } },
      { status: 402, body: { detail: { error: "The organization has used its monthly budget." } } },
      { status: 401, body: { detail: "bad key" } },
      { body: { data: { id: "r1" } } },
    ]);
    const ada = new AdaClient(http().stub, gw, impl);
    await expect(ada.query({ modelId: MODEL, situation: {} })).rejects.toMatchObject({ code: "E_ADA", message: "situation must be a non-empty object" });
    await expect(ada.record({ modelId: MODEL, situation: { a: "b" }, outcome: "x" })).rejects.toMatchObject({ code: "E_PAYMENT", httpStatus: 402 });
    await expect(ada.models()).rejects.toMatchObject({ httpStatus: 401 });
    await ada.veto({ modelId: MODEL, situation: { a: "b" }, outcome: "x" });
    expect(minted()).toBe(2);
  });

  it("refuses when the org's gateway is off", async () => {
    const ada = new AdaClient(http().stub, gateway({ baseUrl: "", token: "", gateway: false }).gw, fetcher([]).impl);
    await expect(ada.facts({ modelId: MODEL, situation: { a: "b" } })).rejects.toMatchObject({ code: "E_ENTITLEMENT" });
  });
});

describe("the device's Ada row store", () => {
  const row = (id: string, store = "wins") => ({ id, store, situation: { a: id, nested: { k: [1, 2] } }, outcome: `o-${id}`, author: "pat", ts: 1.5 });

  it("keeps a model's records, hands them back past a watermark, and edits them", async () => {
    const h = await openAdaStore(join(mkdtempSync(join(tmpdir(), "ada-store-")), "records.db"));
    for (const id of ["r1", "r2", "r3"]) await h["ada.append"]!({ model_id: MODEL, row: row(id, id === "r3" ? "vetoes" : "wins") });
    await h["ada.append"]!({ model_id: "am_ffffffffffff", row: row("other") });
    const all = (await h["ada.rows"]!({ model_id: MODEL, since: 0, limit: 5000 })) as { rows: Array<{ id: string; seq: number; situation: unknown }>; max_seq: number };
    expect(all.rows.map((r) => r.id)).toEqual(["r1", "r2", "r3"]);
    expect(all.rows[0]!.situation).toEqual({ a: "r1", nested: { k: [1, 2] } });
    const after = (await h["ada.rows"]!({ model_id: MODEL, since: all.rows[0]!.seq, limit: 5000 })) as { rows: Array<{ id: string }> };
    expect(after.rows.map((r) => r.id)).toEqual(["r2", "r3"]);
    expect(await h["ada.page"]!({ model_id: MODEL, store: "vetoes", offset: 0, limit: 50 })).toMatchObject({ total: 1, records: [{ id: "r3" }] });
    expect(await h["ada.update"]!({ model_id: MODEL, id: "r1", outcome: "fixed", situation: null })).toEqual({ ok: true });
    expect(await h["ada.update"]!({ model_id: "am_ffffffffffff", id: "r1", outcome: "x", situation: null })).toEqual({ ok: false });
    expect(await h["ada.delete"]!({ model_id: MODEL, id: "r2" })).toEqual({ ok: true });
    const left = (await h["ada.rows"]!({ model_id: MODEL, since: 0 })) as { rows: Array<{ id: string; outcome: string }> };
    expect(left.rows.map((r) => [r.id, r.outcome])).toEqual([["r1", "fixed"], ["r3", "o-r3"]]);
    expect(await h["ada.drop"]!({ model_id: MODEL })).toEqual({ deleted: 2 });
    expect(await h["ada.page"]!({ model_id: "am_ffffffffffff", offset: 0, limit: 50 })).toMatchObject({ total: 1 });
  });

  it("appends many rows in one call, all or none, in the order given", async () => {
    const h = await openAdaStore(join(mkdtempSync(join(tmpdir(), "ada-store-")), "records.db"));
    const rows = ["a", "b", "c"].map((id) => row(id));
    expect(await h["ada.appendMany"]!({ model_id: MODEL, rows })).toEqual({ appended: 3, max_seq: 3 });
    await expect(h["ada.appendMany"]!({ model_id: MODEL, rows: [row("d"), { id: "e", store: "maybe" }] })).rejects.toThrow("rows[1]");
    await expect(h["ada.appendMany"]!({ model_id: MODEL, rows: [row("f"), row("a")] })).rejects.toThrow();
    const all = (await h["ada.rows"]!({ model_id: MODEL, since: 0 })) as { rows: Array<{ id: string }> };
    expect(all.rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    await expect(h["ada.appendMany"]!({ model_id: MODEL, rows: [] })).rejects.toThrow("rows");
  });

  it("refuses calls without a model or with a bad row", async () => {
    const h = await openAdaStore(join(mkdtempSync(join(tmpdir(), "ada-store-")), "records.db"));
    await expect(h["ada.rows"]!({ since: 0 })).rejects.toThrow("model_id");
    await expect(h["ada.append"]!({ model_id: MODEL, row: { id: "x", store: "maybe" } })).rejects.toThrow("store");
    await expect(h["ada.drop"]!("nope")).rejects.toThrow("object");
  });
});
