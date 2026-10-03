/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Ada: every model call is the gateway's POST /ada on the member's own key,
 * naming its model; a model's records live with Glyphh on the Ada runtime.
 */

import { describe, expect, it } from "vitest";
import { AdaClient } from "../../src/resources/ada.js";
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
    get: async (path: string) => { calls.push({ method: "GET", path }); return {}; },
    post: async (path: string, body?: unknown) => { calls.push({ method: "POST", path, body }); return {}; },
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

  it("creates a model with its spec through the gateway's /ada and hands back the model it answered", async () => {
    const h = http();
    const spec = { name: "routing", layers: [] };
    const created = { model_id: MODEL, name: "routing", own: true, shared: false, version: null, source: null, spec };
    const { impl, calls } = fetcher([{ body: { data: created } }]);
    const model = await new AdaClient(h.stub, gateway().gw, impl).createModel({ name: "routing", spec });
    expect(model).toEqual(created);
    expect(calls[0]!.url).toBe("https://gw.example/ada");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ op: "create_model", name: "routing", spec });
    expect(h.calls).toEqual([]);
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
