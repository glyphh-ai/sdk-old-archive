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
}

export function createClient(opts: ClientOptions): Client {
  const http = new HttpClient({
    baseUrl: opts.url,
    ...(opts.fetch ? { fetchImpl: opts.fetch } : {}),
    ...(opts.timeoutMs !== undefined ? { timeoutMs: opts.timeoutMs } : {}),
  });
  const store = opts.tokenStore ?? new InMemoryTokenStore();
  const refresh = new RefreshManager(http, store, {
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
  };
}
