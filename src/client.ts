/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * client.ts — `createClient` wires the pieces into the object every consumer holds:
 * an HTTP client over injectable `fetch`, a token store, the refresh manager, and
 * the auth surface. This is the control-plane client: licensing, org/membership,
 * billing, runtime provisioning, memory (stator) and the metered gateway.
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
import { WorkspacesClient } from "./resources/workspaces.js";
import { BillingClient } from "./resources/billing.js";
import { CatalogClient } from "./resources/catalog.js";
import { ProvidersClient } from "./resources/providers.js";
import { AdminClient } from "./resources/admin.js";
import { LoopsClient } from "./resources/loops.js";
import { UsageClient } from "./resources/usage.js";
import { ApiKeysClient } from "./resources/api-keys.js";
import { SessionsClient } from "./resources/sessions.js";
import { StatorClient } from "./resources/stator.js";
import { RotorConfigClient } from "./resources/rotor-config.js";
import { GatewayClient } from "./resources/gateway.js";
import { OrgModelsClient } from "./resources/org-models.js";
import { ModelsClient } from "./resources/models.js";
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
  /** A `gy_wk_` APP WORKER SERVICE TOKEN — the credential an rrotor pod's headless
   *  app worker sends as its bearer. Ignored when `apiKey` is set. */
  workerToken?: string;
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
  /** Glyphh as an OAuth authorization server: consent + authorized connections. */
  oauth: OAuthClient;
  /** The caller's organization (read + org_admin update). */
  org: OrgClient;
  /** Org membership + seats (list, invite, remove, set role). */
  members: MembersClient;
  /** The caller's own memberships + the session's active-org scope (the org-switcher). */
  memberships: MembershipsClient;
  /** Accept an org invite. */
  invites: InvitesClient;
  /** Workspaces — governance (models/connections/apps/limits) + member assignment. */
  workspaces: WorkspacesClient;
  /** Billing — plans, subscription, credit balance, Stripe checkout/portal. */
  billing: BillingClient;
  /** Runtime image SKUs (§7b) — the org's picker, current image, and change requests. */
  runtimeImages: RuntimeImagesClient;
  /** The provider/model catalog (read). */
  catalog: CatalogClient;
  /** Org provider enablement + BYOK (org_admin). */
  providers: ProvidersClient;
  /** Glyphh platform administration (super_admin). */
  admin: AdminClient;
  /** The org's agent-loop library (members read; org_admin builds). */
  loops: LoopsClient;
  /** Usage rollups — credits consumed/saved by user, workspace, org. */
  usage: UsageClient;
  /** User-scoped `gy_ak_` API keys for headless SDK/CLI use + the desktop relay. */
  apiKeys: ApiKeysClient;
  /** Control-plane runtime sessions — provision/list/get/deprovision. */
  sessions: SessionsClient;
  /** The org MEMORY PLANE — recall/write for runtimes; browse/graph/forget/amend for curation (the Memory panel). */
  stator: StatorClient;
  /** Rotor catalog + role→model bindings + the resolved runtime registry. */
  rotorConfig: RotorConfigClient;
  /** The org's SUPPORTED model set + model-governance audit (org_admin). */
  orgModels: OrgModelsClient;
  /** The caller's EFFECTIVE model set — what they may actually use right now. */
  models: ModelsClient;
  /** The metered model call — the one egress for model traffic. */
  gateway: GatewayClient;
  /** The bearer supplier for authenticated calls / the rotor transport. */
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
  // Static credentials (an API key, or an app worker token) have no session to
  // refresh; anything else rides the interactive session.
  const staticCred = opts.apiKey ?? opts.workerToken;
  const token: TokenProvider = staticCred ? staticTokenProvider(staticCred) : sessionTokenProvider(refresh);
  // Session clients recover a mid-call 401 with one forced refresh (a dead
  // refresh signs out); a static credential has nothing to refresh.
  const authed = new AuthedHttp(http, token, staticCred ? undefined : () => refresh.onUnauthorized());
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
    workspaces: new WorkspacesClient(authed),
    billing: new BillingClient(authed),
    runtimeImages: new RuntimeImagesClient(authed),
    catalog: new CatalogClient(authed),
    providers: new ProvidersClient(authed),
    admin: new AdminClient(authed),
    loops: new LoopsClient(authed),
    usage: new UsageClient(authed),
    apiKeys: new ApiKeysClient(authed),
    sessions: new SessionsClient(authed),
    stator: new StatorClient(authed),
    rotorConfig: new RotorConfigClient(authed),
    orgModels: new OrgModelsClient(authed),
    models: new ModelsClient(authed),
    gateway: new GatewayClient(authed),
    token,
    refresh: async () => (await refresh.refresh()) !== null,
    getSession: () => store.load(),
    me: async () => http.get<Identity>("/api/auth/me", { bearer: await token() }),
  };
}
