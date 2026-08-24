/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * client.ts — `createClient` wires the pieces into the object every consumer holds:
 * an HTTP client over injectable `fetch`, a token store, the refresh manager, and
 * the typed control-plane resource clients. The control plane is the licensing and
 * deployment arm — customers, orgs, plans (turn quotas), the MCP OAuth server, and
 * usage accounting. Turns, memory, and generation live in the runtime; the SDK
 * never touches them.
 */

import { HttpClient, type FetchLike } from "./core/http.js";
import { InMemoryTokenStore, type TokenStore } from "./auth/token-store.js";
import { RefreshManager } from "./auth/refresh-manager.js";
import { AuthClient } from "./auth/auth-client.js";
import { sessionTokenProvider, staticTokenProvider, type TokenProvider } from "./auth/credential-provider.js";
import { createLogger, type LoggerOptions } from "./core/logger.js";
import { AuthedHttp } from "./core/authed-http.js";
import { OrgClient } from "./resources/org.js";
import { MembersClient } from "./resources/members.js";
import { MembershipsClient } from "./resources/memberships.js";
import { InvitesClient } from "./resources/invites.js";
import { RolesClient } from "./resources/roles.js";
import { BillingClient } from "./resources/billing.js";
import { AdminClient } from "./resources/admin.js";
import { UsageClient } from "./resources/usage.js";
import { ApiKeysClient } from "./resources/api-keys.js";
import { ProfileClient } from "./resources/profile.js";
import { SupportClient } from "./resources/support.js";
import { OAuthClient } from "./resources/oauth.js";
import { RuntimeImagesClient } from "./resources/runtime-images.js";
import type { Identity, StoredSession } from "./contract/auth.js";

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
  /** A `gy_ak_` API key for headless use — bypasses the interactive session entirely. */
  apiKey?: string;
  /** Request timeout in ms (default 30s). */
  timeoutMs?: number;
  /** Optional observability. No telemetry by default — silent unless you pass a sink. */
  log?: LoggerOptions;
}

export interface Client {
  /**
   * Escape hatch: authenticated raw HTTP against the control plane (bearer +
   * refresh handled). For endpoints a typed resource client doesn't cover yet —
   * prefer the typed clients; migrate callers off this as coverage lands.
   */
  http: AuthedHttp;
  /** The sign-in surface (magic link, Google, Apple, org SSO, sign out). */
  auth: AuthClient;
  /** The caller's own editable profile (name + timezone). */
  profile: ProfileClient;
  /** Submit support tickets (relayed to the configured sink). */
  support: SupportClient;
  /** Glyphh as an OAuth authorization server: consent + authorized clients. */
  oauth: OAuthClient;
  /** The caller's organization (read + org_admin update). */
  org: OrgClient;
  /** Org membership + seats (list, invite, remove, set role). */
  members: MembersClient;
  /** The caller's own memberships + the session's active-org scope (the org-switcher). */
  memberships: MembershipsClient;
  /** Accept an org invite. */
  invites: InvitesClient;
  /** Roles — named member groups + their glyphh model grants. */
  roles: RolesClient;
  /** Billing — plans (turn quotas), subscription, Stripe checkout/portal. */
  billing: BillingClient;
  /** Runtime image SKUs — the org's picker, current image, and change requests. */
  runtimeImages: RuntimeImagesClient;
  /** Glyphh platform administration (super_admin). */
  admin: AdminClient;
  /** Usage rollups — turns + tokens by user and org. */
  usage: UsageClient;
  /** User-scoped `gy_ak_` API keys for headless SDK use. */
  apiKeys: ApiKeysClient;
  /** The bearer supplier for authenticated calls. */
  token: TokenProvider;
  /** Force a session refresh (rotation). Resolves false if signed out. */
  refresh(): Promise<boolean>;
  /** The current stored session, or null if signed out. */
  getSession(): Promise<StoredSession | null>;
  /** The authenticated principal (who am I). Requires a session. */
  me(): Promise<Identity>;
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
  // An API key has no session to refresh; anything else rides the interactive session.
  const token: TokenProvider = opts.apiKey ? staticTokenProvider(opts.apiKey) : sessionTokenProvider(refresh);
  // Session clients recover a mid-call 401 with one forced refresh (a dead
  // refresh signs out); a static credential has nothing to refresh.
  const authed = new AuthedHttp(http, token, opts.apiKey ? undefined : () => refresh.onUnauthorized());
  // `authed` is built first: the device grant's APPROVE leg is performed BY the
  // signed-in user, so AuthClient needs an authenticated transport for it.
  const auth = new AuthClient(http, refresh, authed);
  return {
    http: authed,
    auth,
    profile: new ProfileClient(authed),
    support: new SupportClient(authed),
    oauth: new OAuthClient(authed),
    org: new OrgClient(authed),
    members: new MembersClient(authed),
    memberships: new MembershipsClient(authed),
    invites: new InvitesClient(http, authed),
    roles: new RolesClient(authed),
    billing: new BillingClient(authed),
    runtimeImages: new RuntimeImagesClient(authed),
    admin: new AdminClient(authed),
    usage: new UsageClient(authed),
    apiKeys: new ApiKeysClient(authed),
    token,
    refresh: async () => (await refresh.refresh()) !== null,
    getSession: () => store.load(),
    me: async () => http.get<Identity>("/api/auth/me", { bearer: await token() }),
  };
}
