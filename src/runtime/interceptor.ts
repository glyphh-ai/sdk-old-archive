/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/interceptor.ts — the local Anthropic endpoint an agent loop is pointed at.
 * Node-only; imported by the desktop's main process and the CLI.
 *
 * WHY THIS EXISTS. The Claude Agent SDK runs its loop in a subprocess that speaks
 * the Anthropic Messages API over HTTP, addressed by `ANTHROPIC_BASE_URL`. It cannot
 * be handed a function — it needs a real listener. This is that listener, and it is
 * the ONLY thing it does: accept a request on loopback, hand it to the SDK client,
 * and stream the reply back byte for byte. It holds no URL, no token, and no fetch;
 * everything outbound goes through `client.gateway.messages()`.
 *
 * It is deliberately NOT a router, a translator, or a policy layer. Everything that
 * decides anything — which models a caller may use, whose key pays, what a turn
 * costs, when to refuse — lives server-side where the keys and the ledger are. An
 * earlier desktop version of this file made those decisions locally and drifted out
 * of sync with the server until every model call failed; keeping this dumb is the
 * fix, not an accident.
 *
 * SECURITY. It binds 127.0.0.1 on an ephemeral port and mints a per-process bearer
 * that the caller must present as `x-api-key`/`authorization`. Any local process can
 * reach a loopback port, so without that check the machine's other software could
 * spend the user's credits through it.
 */

import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomBytes } from "node:crypto";
import type { AddressInfo } from "node:net";
import type { Client } from "../client.js";

export interface InterceptorOptions {
  /**
   * The SDK client. The interceptor holds NO url, no token, and no fetch of its
   * own — it forwards through `client.gateway.messages()`, so the base URL, the
   * bearer, and token refresh all stay where they already live. Nothing here
   * addresses the control plane directly.
   */
  client: Client;
  /** Called when a forwarded turn fails, for logs/telemetry. Never throws. */
  onError?: (error: Error) => void;
}

export interface Interceptor {
  /** Base URL to hand the Agent SDK as ANTHROPIC_BASE_URL. */
  url: string;
  /** The value the Agent SDK must send as ANTHROPIC_API_KEY. */
  apiKey: string;
  close(): Promise<void>;
}

/** Read a request body without assuming a parser is installed. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk: string) => { data += chunk; });
    req.on("end", () => resolve(data));
    req.on("error", reject);
  });
}

function send(res: ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  res.writeHead(status, { "content-type": "application/json" });
  res.end(payload);
}

/**
 * Start the local Anthropic endpoint. Resolves once it is listening.
 *
 * The returned `url`/`apiKey` go straight into the agent subprocess's environment;
 * nothing else should hold them.
 */
export async function startInterceptor(opts: InterceptorOptions): Promise<Interceptor> {
  // Per-process, never persisted: a restart invalidates it, which is what we want.
  const apiKey = `glyphh-local-${randomBytes(24).toString("hex")}`;

  const server: Server = createServer((req, res) => {
    void handle(req, res).catch((err: unknown) => {
      const error = err instanceof Error ? err : new Error(String(err));
      try { opts.onError?.(error); } catch { /* a listener must not break the relay */ }
      if (!res.headersSent) {
        send(res, 502, { type: "error", error: { type: "api_error", message: error.message } });
      } else {
        res.end();
      }
    });
  });

  async function handle(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // Loopback is not authentication: gate on the per-process key.
    const presented = String(req.headers["x-api-key"] ?? "")
      || String(req.headers["authorization"] ?? "").replace(/^Bearer\s+/i, "");
    if (presented !== apiKey) {
      send(res, 401, { type: "error", error: { type: "authentication_error", message: "bad local key" } });
      return;
    }

    const path = (req.url ?? "").split("?")[0];
    if (req.method !== "POST" || !path?.startsWith("/v1/messages")) {
      send(res, 404, { type: "error", error: { type: "not_found_error", message: `no route for ${req.method} ${path}` } });
      return;
    }

    const body = await readBody(req);

    // Through the SDK: it owns the route, the base URL, and a bearer refreshed
    // per call, so a long agent run cannot outlive the token it started with.
    // Version + beta headers are the caller's to choose; pass them through so a
    // feature the agent opts into is not silently dropped here.
    const upstream = await opts.client.gateway.messages(body, {
      headers: {
        ...(req.headers["anthropic-version"] ? { "anthropic-version": String(req.headers["anthropic-version"]) } : {}),
        ...(req.headers["anthropic-beta"] ? { "anthropic-beta": String(req.headers["anthropic-beta"]) } : {}),
      },
    });

    // Status and body are relayed as-is. The Agent SDK reads upstream statuses to
    // decide whether to retry, so translating them into something friendlier would
    // break behaviour that already works.
    res.writeHead(upstream.status, {
      "content-type": upstream.headers.get("content-type") ?? "application/json",
      ...(upstream.headers.get("content-type")?.includes("event-stream")
        ? { "cache-control": "no-cache", connection: "keep-alive" }
        : {}),
    });

    if (!upstream.body) {
      res.end(await upstream.text());
      return;
    }

    const reader = upstream.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
    res.end();
  }

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      server.removeListener("error", reject);
      resolve();
    });
  });

  const { port } = server.address() as AddressInfo;
  return {
    url: `http://127.0.0.1:${port}`,
    apiKey,
    close: () =>
      new Promise<void>((resolve) => {
        server.close(() => resolve());
        // Sockets held open by a live stream would keep the process alive.
        server.closeAllConnections?.();
      }),
  };
}
