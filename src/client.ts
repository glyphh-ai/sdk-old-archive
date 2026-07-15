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
import { AuthedHttp } from "./core/authed-http.js";
import { SseTransport } from "./transport/sse-transport.js";
import { Session, type SessionConfig } from "./session/session.js";
import { OrgClient } from "./resources/org.js";
import { MembersClient } from "./resources/members.js";
import { InvitesClient } from "./resources/invites.js";
import { WorkspacesClient } from "./resources/workspaces.js";
import { BillingClient } from "./resources/billing.js";
import { CatalogClient } from "./resources/catalog.js";
import { ProvidersClient } from "./resources/providers.js";
import { AdminClient } from "./resources/admin.js";
import { ConnectionsClient } from "./resources/connections.js";
import { UsageClient } from "./resources/usage.js";
import { ApiKeysClient } from "./resources/api-keys.js";
import { SessionsClient } from "./resources/sessions.js";
import { GitClient } from "./resources/git.js";
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
  /** The caller's organization (read + org_admin update). */
  org: OrgClient;
  /** Org membership + seats (list, invite, remove, set role). */
  members: MembersClient;
  /** Accept an org invite. */
  invites: InvitesClient;
  /** Workspaces — governance (models/connections/apps/limits) + member assignment. */
  workspaces: WorkspacesClient;
  /** Billing — plans, subscription, credit balance, Stripe checkout/portal. */
  billing: BillingClient;
  /** The provider/model catalog (read). */
  catalog: CatalogClient;
  /** Org provider enablement + BYOK (org_admin). */
  providers: ProvidersClient;
  /** Glyphh platform administration (super_admin). */
  admin: AdminClient;
  /** Connectors — Pipedream accounts + custom MCP servers (org_admin manages). */
  connections: ConnectionsClient;
  /** Usage rollups — credits consumed/saved by user, workspace, org. */
  usage: UsageClient;
  /** User-scoped `gy_ak_` API keys for headless SDK/CLI use + the desktop relay. */
  apiKeys: ApiKeysClient;
  /** Control-plane runtime sessions — provision/list/get/deprovision (data plane is `session()`). */
  sessions: SessionsClient;
  /** GitHub connection — link, list repos; sessions with a repo get a scoped clone token. */
  git: GitClient;
  /** The bearer supplier for authenticated calls / the rotor transport. */
  token: TokenProvider;
  /** Force a session refresh (rotation). Resolves false if signed out. */
  refresh(): Promise<boolean>;
  /** The current stored session, or null if signed out. */
  getSession(): Promise<StoredSession | null>;
  /** The authenticated principal (who am I). Requires a session. */
  me(): Promise<Identity>;
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
  const authed = new AuthedHttp(http, token);
  return {
    auth,
    org: new OrgClient(authed),
    members: new MembersClient(authed),
    invites: new InvitesClient(http, authed),
    workspaces: new WorkspacesClient(authed),
    billing: new BillingClient(authed),
    catalog: new CatalogClient(authed),
    providers: new ProvidersClient(authed),
    admin: new AdminClient(authed),
    connections: new ConnectionsClient(authed),
    usage: new UsageClient(authed),
    apiKeys: new ApiKeysClient(authed),
    sessions: new SessionsClient(authed),
    git: new GitClient(authed),
    token,
    refresh: async () => (await refresh.refresh()) !== null,
    getSession: () => store.load(),
    me: async () => http.get<Identity>("/api/auth/me", { bearer: await token() }),
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
