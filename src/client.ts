/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * client.ts — `createClient` wires the pieces into the object every consumer holds:
 * an HTTP client over injectable `fetch`, a token store, the refresh manager, and
 * the auth surface. The rotor `session()`/`turn()` transport attaches here in a
 * later slice; this slice ships the control-plane (auth) half.
 */

import { HttpClient, type FetchLike } from "./core/http.js";
import { InMemoryTokenStore, type TokenStore } from "./auth/token-store.js";
import { RefreshManager } from "./auth/refresh-manager.js";
import { AuthClient } from "./auth/auth-client.js";
import { sessionTokenProvider, staticTokenProvider, type TokenProvider } from "./auth/credential-provider.js";
import { createLogger, type LoggerOptions } from "./core/logger.js";
import { SseTransport } from "./transport/sse-transport.js";
import { Session, type SessionConfig } from "./session/session.js";
import type { StoredSession } from "./contract/auth.js";

export interface ClientOptions {
  /** Control-plane base URL, e.g. https://api.glyphh.ai (or http://127.0.0.1:3001). */
  url: string;
  /** Injectable fetch — pass the platform's fetch in RN/tests. Defaults to global. */
  fetch?: FetchLike;
  /** Where the session lives. Defaults to in-memory; pass a platform adapter to persist. */
  tokenStore?: TokenStore;
  /** Refresh this many ms before access-token expiry (default 60s). */
  refreshMarginMs?: number;
  /** Fired once when the session becomes unrecoverable — flip the UI to signed-out. */
  onSignedOut?: () => void;
  /** A `yo_` API key for headless use — bypasses the interactive session entirely. */
  apiKey?: string;
  /** Request timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Optional observability. No telemetry by default — silent unless you pass a sink. */
  log?: LoggerOptions;
}

/** Options for opening a rotor session (the data plane). */
export interface OpenSessionOptions extends SessionConfig {
  /** Runtime base URL (a provisioned `*.fly.dev`, or the client url for loopback). */
  url?: string;
  /** Runtime bearer. Defaults to the client's session token. */
  token?: TokenProvider;
  /** Injectable fetch for the runtime stream (defaults to the client's). */
  fetch?: FetchLike;
}

export interface Client {
  /** The sign-in surface (magic link, Google, Apple, org SSO, sign out). */
  auth: AuthClient;
  /** The bearer supplier for authenticated calls / the rotor transport. */
  token: TokenProvider;
  /** Force a session refresh (rotation). Resolves false if signed out. */
  refresh(): Promise<boolean>;
  /** The current stored session, or null if signed out. */
  getSession(): Promise<StoredSession | null>;
  /** Open a rotor session on the runtime (streaming turns, durable reconnect). */
  session(opts: OpenSessionOptions): Session;
}

export function createClient(opts: ClientOptions): Client {
  const logger = createLogger(opts.log ?? {});
  const http = new HttpClient({
    baseUrl: opts.url,
    logger,
    ...(opts.fetch ? { fetchImpl: opts.fetch } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });
  const store = opts.tokenStore ?? new InMemoryTokenStore();
  const refresh = new RefreshManager(http, store, {
    logger,
    ...(opts.refreshMarginMs !== undefined ? { refreshMarginMs: opts.refreshMarginMs } : {}),
    ...(opts.onSignedOut ? { onSignedOut: opts.onSignedOut } : {}),
  });
  const auth = new AuthClient(http, refresh);
  const token: TokenProvider = opts.apiKey ? staticTokenProvider(opts.apiKey) : sessionTokenProvider(refresh);
  return {
    auth,
    token,
    refresh: async () => (await refresh.refresh()) !== null,
    getSession: () => store.load(),
    session: (sopts: OpenSessionOptions): Session => {
      // The runtime bearer is a SEPARATE credential (the provisioned runtimeToken),
      // not the control-plane session token — and loopback needs none. Only attach
      // one if the caller supplies it.
      const transport = new SseTransport({
        baseUrl: sopts.url ?? opts.url,
        ...(sopts.token ? { token: sopts.token } : {}),
        ...(sopts.fetch ?? opts.fetch ? { fetchImpl: sopts.fetch ?? opts.fetch } : {}),
      });
      return new Session(transport, { ...sopts, run: { logger, ...(sopts.run ?? {}) } });
    },
  };
}
