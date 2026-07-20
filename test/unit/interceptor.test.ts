/**
 * The local Anthropic endpoint. It should forward faithfully, stream without
 * buffering, refuse unauthenticated local callers, and relay upstream statuses
 * rather than reinterpreting them.
 */

import { describe, it, expect, afterEach, vi } from "vitest";
import { startInterceptor, type Interceptor } from "../../src/runtime/interceptor.js";

let running: Interceptor | null = null;
afterEach(async () => {
  await running?.close();
  running = null;
});

/** A fake control plane that records what it was sent. */
function upstream(
  handler: (url: string, init: RequestInit) => Response | Promise<Response>,
): { fetch: typeof fetch; calls: Array<{ url: string; init: RequestInit }> } {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const impl = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return handler(String(url), init ?? {});
  }) as unknown as typeof fetch;
  return { fetch: impl, calls };
}

const jsonReply = () =>
  new Response(JSON.stringify({ type: "message", content: [{ type: "text", text: "hi" }] }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("interceptor", () => {
  it("forwards to the control plane with the caller's bearer", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({
      url: "https://api.example.com",
      token: async () => "tok-123",
      fetch: up.fetch,
    });

    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": running.apiKey },
      body: JSON.stringify({ model: "claude-sonnet-5", messages: [{ role: "user", content: "hi" }] }),
    });
    expect(res.status).toBe(200);

    expect(up.calls).toHaveLength(1);
    expect(up.calls[0]!.url).toBe("https://api.example.com/api/gateway/v1/messages");
    const headers = up.calls[0]!.init.headers as Record<string, string>;
    expect(headers.authorization).toBe("Bearer tok-123");
    // The body is relayed untouched — this is a relay, not a translator.
    expect(JSON.parse(String(up.calls[0]!.init.body))).toEqual({
      model: "claude-sonnet-5",
      messages: [{ role: "user", content: "hi" }],
    });
  });

  it("refuses a local caller without the process key", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    // Loopback is reachable by anything on the machine; the key is the gate.
    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}",
    });
    expect(res.status).toBe(401);
    expect(up.calls).toHaveLength(0);
  });

  it("accepts the key as a bearer as well as x-api-key", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${running.apiKey}` },
      body: "{}",
    });
    expect(res.status).toBe(200);
  });

  it("streams SSE frames through as they arrive", async () => {
    const frames = [
      'event: message_start\ndata: {"type":"message_start"}\n\n',
      'event: content_block_delta\ndata: {"type":"content_block_delta"}\n\n',
      'event: message_stop\ndata: {"type":"message_stop"}\n\n',
    ];
    const up = upstream(
      () =>
        new Response(
          new ReadableStream<Uint8Array>({
            start(controller) {
              const enc = new TextEncoder();
              for (const f of frames) controller.enqueue(enc.encode(f));
              controller.close();
            },
          }),
          { status: 200, headers: { "content-type": "text/event-stream" } },
        ),
    );
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": running.apiKey },
      body: JSON.stringify({ stream: true }),
    });
    expect(res.headers.get("content-type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toBe(frames.join(""));
  });

  it("relays an upstream status instead of reinterpreting it", async () => {
    // The Agent SDK reads 429/529 to decide whether to retry — flattening these
    // into a generic failure would break behaviour that already works.
    const up = upstream(
      () =>
        new Response(JSON.stringify({ type: "error", error: { type: "rate_limit_error" } }), {
          status: 429,
          headers: { "content-type": "application/json" },
        }),
    );
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": running.apiKey },
      body: "{}",
    });
    expect(res.status).toBe(429);
    expect((await res.json()).error.type).toBe("rate_limit_error");
  });

  it("passes anthropic version and beta headers through", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: {
        "x-api-key": running.apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "tools-2024-04-04",
      },
      body: "{}",
    });
    const headers = up.calls[0]!.init.headers as Record<string, string>;
    expect(headers["anthropic-version"]).toBe("2023-06-01");
    expect(headers["anthropic-beta"]).toBe("tools-2024-04-04");
  });

  it("takes a fresh token per request so a long run cannot outlive one", async () => {
    const up = upstream(() => jsonReply());
    let n = 0;
    running = await startInterceptor({
      url: "https://api.example.com",
      token: async () => `tok-${++n}`,
      fetch: up.fetch,
    });

    for (let i = 0; i < 2; i++) {
      await fetch(`${running.url}/v1/messages`, {
        method: "POST",
        headers: { "x-api-key": running.apiKey },
        body: "{}",
      });
    }
    expect((up.calls[0]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok-1");
    expect((up.calls[1]!.init.headers as Record<string, string>).authorization).toBe("Bearer tok-2");
  });

  it("404s a route that is not messages", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });

    const res = await fetch(`${running.url}/v1/complete`, {
      method: "POST",
      headers: { "x-api-key": running.apiKey },
      body: "{}",
    });
    expect(res.status).toBe(404);
    expect(up.calls).toHaveLength(0);
  });

  it("reports a transport failure as an api_error without crashing", async () => {
    const onError = vi.fn();
    const up = upstream(() => { throw new Error("network down"); });
    running = await startInterceptor({
      url: "https://api.example.com",
      token: async () => "t",
      fetch: up.fetch,
      onError,
    });

    const res = await fetch(`${running.url}/v1/messages`, {
      method: "POST",
      headers: { "x-api-key": running.apiKey },
      body: "{}",
    });
    expect(res.status).toBe(502);
    expect((await res.json()).error.type).toBe("api_error");
    expect(onError).toHaveBeenCalled();
  });

  it("binds loopback only", async () => {
    const up = upstream(() => jsonReply());
    running = await startInterceptor({ url: "https://api.example.com", token: async () => "t", fetch: up.fetch });
    expect(running.url).toMatch(/^http:\/\/127\.0\.0\.1:\d+$/);
  });
});
