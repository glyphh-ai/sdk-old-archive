/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/attach.ts — the ATTACH HOST (Node-only): the machine's outbound
 * connection to the cloud, generalized from the desktop's attach-client so ANY
 * host can offer machine capabilities — the desktop app, and the CLI on
 * machines without one.
 *
 * The host opens one authenticated WebSocket to the server's /ws/attach and
 * keeps it alive with backoff. The cloud dispatches `req` frames down it; the
 * host executes each via its HANDLER TABLE and replies. Nothing dials in: this
 * side initiates, authenticates with the signed-in user's own token (as a
 * query parameter — Node's native WebSocket cannot set upgrade headers), and
 * sign-out stops it.
 */

import type { Client } from "../client.js";

export type AttachHandler = (params: unknown) => Promise<unknown>;

export interface AttachHostOptions {
  /** The SDK client — supplies the server url is derived from and the token. */
  client: Client;
  /** The server base url (http/https) the socket attaches to. */
  server: string;
  /** Host identity sent in the hello frame (e.g. "glyphh-cli"). */
  app: string;
  version?: string;
  /** The capability table: method name → executor. Sent as `capabilities`. */
  handlers: Record<string, AttachHandler>;
}

export interface AttachHost {
  /** True while the outbound socket is open. */
  attached(): boolean;
  /** Tear down (sign-out / quit). Idempotent. */
  stop(): void;
}

const MAX_BACKOFF = 30_000;

/**
 * Start the attach host. Resolves immediately — connection and reconnection
 * run in the background (backoff-capped) for the life of the host.
 */
export function startAttachHost(opts: AttachHostOptions): AttachHost {
  let ws: WebSocket | null = null;
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  let backoff = 1000;
  let stopped = false;

  const wsUrl = async (): Promise<string> => {
    const base = opts.server.replace(/^http/, "ws").replace(/\/+$/, "");
    const token = await opts.client.token();
    return `${base}/ws/attach?token=${encodeURIComponent(token)}`;
  };

  const scheduleReconnect = (): void => {
    if (stopped || reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      void connect();
    }, backoff);
    backoff = Math.min(backoff * 2, MAX_BACKOFF);
  };

  const connect = async (): Promise<void> => {
    if (stopped || ws) return;
    let url: string;
    try {
      url = await wsUrl();
    } catch {
      scheduleReconnect(); // signed out / token unavailable — retry later
      return;
    }
    const socket = new WebSocket(url);
    ws = socket;

    socket.addEventListener("open", () => {
      backoff = 1000;
      socket.send(
        JSON.stringify({
          t: "hello",
          app: opts.app,
          version: opts.version ?? "0",
          capabilities: Object.keys(opts.handlers),
        }),
      );
    });

    socket.addEventListener("message", (ev: MessageEvent) => {
      let frame: { t?: string; id?: string; method?: string; params?: unknown };
      try {
        frame = JSON.parse(String(ev.data));
      } catch {
        return;
      }
      if (frame.t === "ping") {
        try {
          socket.send(JSON.stringify({ t: "pong" }));
        } catch {
          /* noop */
        }
        return;
      }
      if (frame.t !== "req" || typeof frame.id !== "string" || typeof frame.method !== "string") return;
      const { id, method, params } = frame;
      const handler = opts.handlers[method];
      void (async () => {
        try {
          if (!handler) throw new Error(`unknown method: ${method}`);
          const result = await handler(params ?? {});
          socket.send(JSON.stringify({ t: "res", id, ok: true, result }));
        } catch (err) {
          socket.send(JSON.stringify({ t: "res", id, ok: false, error: err instanceof Error ? err.message : String(err) }));
        }
      })();
    });

    const drop = (): void => {
      if (ws === socket) ws = null;
      scheduleReconnect();
    };
    socket.addEventListener("close", drop);
    socket.addEventListener("error", () => {
      try {
        socket.close();
      } catch {
        /* noop */
      }
      drop();
    });
  };

  void connect();

  return {
    attached: () => ws?.readyState === WebSocket.OPEN,
    stop: () => {
      stopped = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          /* noop */
        }
        ws = null;
      }
    },
  };
}
