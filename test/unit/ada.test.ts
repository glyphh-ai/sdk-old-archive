/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Ada: every call is a gateway ada_* tool on the member's own key, so it is
 * metered like the same tool anywhere else, and its refusals read plainly.
 */

import { describe, expect, it } from "vitest";
import { AdaClient } from "../../src/resources/ada.js";
import { ApiError } from "../../src/core/errors.js";
import type { GatewayClient } from "../../src/resources/gateway.js";

type Call = { url: string; init: RequestInit };

function gateway(token = { baseUrl: "https://gw.example/", token: "sk-member", gateway: true }) {
  let minted = 0;
  const gw = { token: async () => { minted++; return token; } } as unknown as GatewayClient;
  return { gw, minted: () => minted };
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

const tool = (payload: unknown) => ({ body: { content: [{ type: "text", text: JSON.stringify(payload) }], isError: false } });

describe("AdaClient", () => {
  it("calls the gateway tool on the member key and returns its answer", async () => {
    const { gw, minted } = gateway();
    const { impl, calls } = fetcher([tool({ top: "dual_write", act: true }), tool({ spaces: [{ space: "ops", wins: 3 }] })]);
    const ada = new AdaClient(gw, impl);
    const answer = await ada.query({ space: "ops", situation: { risk: "downtime" }, weights: { risk: 2 } });
    expect(answer.top).toBe("dual_write");
    const first = calls[0]!;
    expect(first.url).toBe("https://gw.example/mcp-rest/tools/call");
    expect((first.init.headers as Record<string, string>).authorization).toBe("Bearer sk-member");
    expect(JSON.parse(String(first.init.body))).toEqual({
      name: "ada_query", arguments: { space: "ops", situation: { risk: "downtime" }, weights: { risk: 2 } },
    });
    expect(await ada.status()).toEqual([{ space: "ops", wins: 3 }]);
    expect(minted()).toBe(1);
  });

  it("turns a tool error, an empty budget and a dead key into errors", async () => {
    const { gw, minted } = gateway();
    const { impl } = fetcher([
      { body: { content: [{ type: "text", text: "situation must be a non-empty object" }], isError: true } },
      { status: 402, body: { detail: { error: "The organization has used its monthly budget." } } },
      { status: 401, body: { detail: "bad key" } },
      tool({ id: "r1" }),
    ]);
    const ada = new AdaClient(gw, impl);
    await expect(ada.query({ situation: {} })).rejects.toMatchObject({ code: "E_VALIDATION", message: "situation must be a non-empty object" });
    await expect(ada.record({ situation: { a: "b" }, outcome: "x" })).rejects.toMatchObject({ code: "E_PAYMENT", httpStatus: 402 });
    await expect(ada.status()).rejects.toBeInstanceOf(ApiError);
    await ada.veto({ situation: { a: "b" }, outcome: "x" });
    expect(minted()).toBe(2);
  });

  it("refuses when the org's gateway is off", async () => {
    const { gw } = gateway({ baseUrl: "", token: "", gateway: false });
    const ada = new AdaClient(gw, fetcher([]).impl);
    await expect(ada.facts({ situation: { a: "b" } })).rejects.toMatchObject({ code: "E_ENTITLEMENT" });
  });
});
