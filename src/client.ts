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
import { HarnessClient, type HarnessRunOptions } from "./transport/harness.js";
import { Session, type SessionConfig } from "./session/session.js";
import { OrgClient } from "./resources/org.js";
import { MembersClient } from "./resources/members.js";
import { MembershipsClient } from "./resources/memberships.js";
import { InvitesClient } from "./resources/invites.js";
import { WorkspacesClient } from "./resources/workspaces.js";
import { BillingClient } from "./resources/billing.js";
import { CatalogClient } from "./resources/catalog.js";
import { ProvidersClient } from "./resources/providers.js";
import { AdminClient } from "./resources/admin.js";
import { MarketingClient } from "./resources/marketing.js";
import { LoopsClient } from "./resources/loops.js";
import { ConnectionsClient } from "./resources/connections.js";
import { UsageClient } from "./resources/usage.js";
import { ApiKeysClient } from "./resources/api-keys.js";
import { SessionsClient } from "./resources/sessions.js";
import { FilesClient } from "./resources/files.js";
import { GitClient } from "./resources/git.js";
import { AppsClient } from "./resources/apps.js";
import { HostingClient } from "./resources/hosting.js";
import { LibraryClient } from "./resources/library.js";
import { RelayClient } from "./resources/relay.js";
import { AttachClient } from "./resources/attach.js";
import { RotorConfigClient } from "./resources/rotor-config.js";
import { GatewayClient } from "./resources/gateway.js";
import { GuestClient } from "./resources/guest.js";
import { SkillsClient } from "./resources/skills.js";
import { AgentsClient } from "./resources/agents.js";
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

/** Options for opening a HARNESS pod (the `glyphh.harness/v1` data plane). */
export interface OpenHarnessOptions {
  /** The pod's base URL (the provisioned session's `runtimeUrl`). */
  url: string;
  /** Runtime bearer — the session's `gy_rk_` runtime token (NOT the
   *  control-plane session token). Loopback/auth-off pods need none. */
  token?: TokenProvider;
  /** Injectable fetch for the pod (defaults to the client's). */
  fetch?: FetchLike;
  /** Reconnect/poll/WS knobs for this pod's runs. */
  run?: HarnessRunOptions;
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
  /** Marketing link tracking + click analytics (super_admin). */
  marketing: MarketingClient;
  /** The org's agent-loop library (members read; org_admin builds). */
  loops: LoopsClient;
  /** Connectors — Pipedream accounts + custom MCP servers (org_admin manages). */
  connections: ConnectionsClient;
  /** Usage rollups — credits consumed/saved by user, workspace, org. */
  usage: UsageClient;
  /** User-scoped `gy_ak_` API keys for headless SDK/CLI use + the desktop relay. */
  apiKeys: ApiKeysClient;
  /** Control-plane runtime sessions — provision/list/get/deprovision (data plane is `session()`). */
  sessions: SessionsClient;
  /** Saved FILE ARTIFACTS — the explicit deliverables an agent saves for the user (list/get/create/delete). */
  files: FilesClient;
  /** GitHub connection — link, list repos; sessions with a repo get a scoped clone token. */
  git: GitClient;
  /** The apps marketplace — browse, publish, install. */
  apps: AppsClient;
  /** App hosting — deploy a published app to `<slug>.glyphh.app`. */
  hosting: HostingClient;
  /** Rotor-loop library (personal + org). */
  rotors: LibraryClient;
  /** Skill library — manifest + prompt + optional program (org_admin builds). */
  skills: SkillsClient;
  /** Standing workers: an agent runs a loop and fires scheduled tasks. */
  agents: AgentsClient;
  /** Workbench layout library (personal + org). */
  layouts: LibraryClient;
  /** Drip (scheduled prompt) library (personal + org). */
  drips: LibraryClient;
  /** Saved message-session library (personal + org). */
  messageSessions: LibraryClient;
  /** Drive-my-desktop relay — org policy + per-device opt-in (same-user, revocable). */
  relay: RelayClient;
  /** Attached-desktop control — status + dispatch a method to the caller's own live machine. */
  attach: AttachClient;
  /** Rotor catalog + role→model bindings + the resolved runtime registry. */
  rotorConfig: RotorConfigClient;
  /** The org's SUPPORTED model set + model-governance audit (org_admin). */
  orgModels: OrgModelsClient;
  /** The caller's EFFECTIVE model set — what they may actually use right now. */
  models: ModelsClient;
  /** The metered model call — the one egress for model traffic. */
  gateway: GatewayClient;
  /** The anonymous (no-account) chat surface — mint a guest token + chat via the gateway. */
  guest: GuestClient;
  /** App-icon resolution — the server's cached icon for a domain, as a URL an
   *  <img>/texture loads directly (public endpoint, no bearer). */
  icons: { urlFor(domain: string): string };
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
  /** Open a HARNESS pod (`glyphh.harness/v1`) — interactive chat/cowork/code
   *  turns streamed as agent frames, durable across reconnects. */
  harness(opts: OpenHarnessOptions): HarnessClient;
  /** THE SINGLE FRONT DOOR for interactive turns: a HarnessClient bound to the
   *  control-plane turn proxy (`/api/harness`), which region-routes to the org's
   *  regional rrotor + stator. No pod URL, no provisioning — the caller's session
   *  token authenticates and the server picks the region. Every surface should run
   *  turns through this (docs/turn-proxy.md). */
  harnessViaApi(): HarnessClient;
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
  const token: TokenProvider = opts.apiKey ? staticTokenProvider(opts.apiKey) : sessionTokenProvider(refresh);
  // Session clients recover a mid-call 401 with one forced refresh (a dead
  // refresh signs out); a static API key has nothing to refresh.
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
    workspaces: new WorkspacesClient(authed),
    billing: new BillingClient(authed),
    runtimeImages: new RuntimeImagesClient(authed),
    catalog: new CatalogClient(authed),
    providers: new ProvidersClient(authed),
    admin: new AdminClient(authed),
    marketing: new MarketingClient(authed),
    loops: new LoopsClient(authed),
    connections: new ConnectionsClient(authed),
    usage: new UsageClient(authed),
    apiKeys: new ApiKeysClient(authed),
    sessions: new SessionsClient(authed),
    files: new FilesClient(authed),
    git: new GitClient(authed),
    apps: new AppsClient(authed),
    hosting: new HostingClient(authed),
    rotors: new LibraryClient(authed, "rotor"),
    skills: new SkillsClient(authed),
    agents: new AgentsClient(authed),
    layouts: new LibraryClient(authed, "layout"),
    drips: new LibraryClient(authed, "drip"),
    messageSessions: new LibraryClient(authed, "message_session"),
    relay: new RelayClient(authed),
    attach: new AttachClient(authed),
    rotorConfig: new RotorConfigClient(authed),
    orgModels: new OrgModelsClient(authed),
    models: new ModelsClient(authed),
    gateway: new GatewayClient(authed),
    // The guest surface rides the UNAUTHENTICATED transport — a guest token is not a
    // session bearer, it is carried per-call.
    guest: new GuestClient(http),
    icons: {
      // v=2: cache-shape bump — clients that pinned the (formerly cacheable)
      // 404s bypass those entries instead of replaying them for an hour.
      urlFor: (domain: string): string =>
        `${opts.url.replace(/\/$/, "")}/api/icons?domain=${encodeURIComponent(domain.trim().toLowerCase())}&v=2`,
    },
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
    harness: (hopts: OpenHarnessOptions): HarnessClient =>
      // Like `session()`: the pod bearer is the provisioned runtimeToken, a
      // SEPARATE credential — only attach one if the caller supplies it.
      new HarnessClient({
        baseUrl: hopts.url,
        ...(hopts.token ? { token: hopts.token } : {}),
        ...(hopts.fetch ?? opts.fetch ? { fetchImpl: hopts.fetch ?? opts.fetch } : {}),
        run: { logger, ...(hopts.run ?? {}) },
      }),
    harnessViaApi: (): HarnessClient =>
      // The single front door: bind to the control-plane proxy, authenticated by
      // the user's OWN session token (not a pod runtimeToken). The server
      // region-routes and forwards the bearer; the rrotor introspects + owner-scopes.
      new HarnessClient({
        baseUrl: `${opts.url.replace(/\/+$/, "")}/api/harness`,
        token,
        ...(opts.fetch ? { fetchImpl: opts.fetch } : {}),
        run: { logger },
      }),
  };
}
