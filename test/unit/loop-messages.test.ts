/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The Messages wire over fetch: SSE events assemble into content blocks (text
 * and a tool_use with its JSON built from deltas), usage lands, a non-2xx
 * reads as the gateway's own words, and a JSON (non-streamed) body still works.
 */
import { describe, it, expect } from "vitest";
import { assembleStream, sseEvents, streamMessage } from "../../src/loop/messages.js";

const sse = (events: Array<[string, unknown]>): string =>
  events.map(([e, d]) => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`).join("");

const bodyOf = (text: string): ReadableStream<Uint8Array> => {
  const bytes = new TextEncoder().encode(text);
  // Two chunks split mid-event to prove the framing handles boundaries.
  const cut = Math.floor(bytes.length / 2);
  return new ReadableStream({
    start(ctl) { ctl.enqueue(bytes.slice(0, cut)); ctl.enqueue(bytes.slice(cut)); ctl.close(); },
  });
};

const TURN = sse([
  ["message_start", { type: "message_start", message: { usage: { input_tokens: 120, cache_read_input_tokens: 80 } } }],
  ["content_block_start", { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } }],
  ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "Let me " } }],
  ["content_block_delta", { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "look." } }],
  ["content_block_stop", { type: "content_block_stop", index: 0 }],
  ["content_block_start", { type: "content_block_start", index: 1, content_block: { type: "tool_use", id: "tu_1", name: "read_file", input: {} } }],
  ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "{\"pa" } }],
  ["content_block_delta", { type: "content_block_delta", index: 1, delta: { type: "input_json_delta", partial_json: "th\": \"a.txt\"}" } }],
  ["content_block_stop", { type: "content_block_stop", index: 1 }],
  ["message_delta", { type: "message_delta", delta: { stop_reason: "tool_use" }, usage: { output_tokens: 17 } }],
  ["message_stop", { type: "message_stop" }],
]);

describe("assembleStream", () => {
  it("builds text and tool_use blocks from deltas and carries usage + stop reason", async () => {
    const deltas: string[] = [];
    const m = await assembleStream(sseEvents(bodyOf(TURN)), (d) => deltas.push(d));
    expect(deltas).toEqual(["Let me ", "look."]);
    expect(m.content).toEqual([
      { type: "text", text: "Let me look." },
      { type: "tool_use", id: "tu_1", name: "read_file", input: { path: "a.txt" } },
    ]);
    expect(m.stop_reason).toBe("tool_use");
    expect(m.usage).toEqual({ input_tokens: 120, output_tokens: 17, cache_read_input_tokens: 80 });
  });

  it("an error event throws with the provider's message", async () => {
    const stream = bodyOf(sse([["error", { type: "error", error: { type: "overloaded_error", message: "Overloaded" } }]]));
    await expect(assembleStream(sseEvents(stream))).rejects.toThrow("Overloaded");
  });
});

describe("streamMessage", () => {
  const body = { model: "m", max_tokens: 10, messages: [{ role: "user" as const, content: "hi" }] };

  it("posts to /v1/messages with both auth headers and stream:true, and assembles the SSE reply", async () => {
    let seen: { url: string; init: RequestInit } | null = null;
    const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
      seen = { url, init };
      return new Response(bodyOf(TURN), { status: 200, headers: { "content-type": "text/event-stream" } });
    };
    const m = await streamMessage({ baseUrl: "https://gw.example/", token: "sk-x", body, fetch: fetchLike });
    expect(seen!.url).toBe("https://gw.example/v1/messages");
    const h = seen!.init.headers as Record<string, string>;
    expect(h.authorization).toBe("Bearer sk-x");
    expect(h["x-api-key"]).toBe("sk-x");
    expect(JSON.parse(String(seen!.init.body)).stream).toBe(true);
    expect(m.stop_reason).toBe("tool_use");
  });

  it("a non-2xx reads as the gateway's words", async () => {
    const fetchLike = async (): Promise<Response> => new Response(JSON.stringify({ error: { message: "Budget has been exceeded" } }), { status: 402 });
    await expect(streamMessage({ baseUrl: "https://gw", token: "t", body, fetch: fetchLike })).rejects.toThrow("gateway 402: Budget has been exceeded");
  });

  it("a JSON (unstreamed) body is accepted and its text handed out", async () => {
    const json = { content: [{ type: "text", text: "plain" }], stop_reason: "end_turn", usage: { input_tokens: 3, output_tokens: 1 } };
    const fetchLike = async (): Promise<Response> => new Response(JSON.stringify(json), { status: 200, headers: { "content-type": "application/json" } });
    const deltas: string[] = [];
    const m = await streamMessage({ baseUrl: "https://gw", token: "t", body, fetch: fetchLike, onText: (d) => deltas.push(d) });
    expect(deltas).toEqual(["plain"]);
    expect(m.stop_reason).toBe("end_turn");
    expect(m.usage.cache_read_input_tokens).toBe(0);
  });
});
