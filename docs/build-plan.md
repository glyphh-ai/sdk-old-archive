# Build Plan — the clean product (SDK + new server, co-developed)

Companion to `architecture.md`. This is the orchestrated, domain-by-domain path
that walks `@glyphh/client` (the SDK) and the new `server/` down one track
together, with the SDK's typed contract as the **single source of truth**.

> **Method for every domain (the vertical slice):**
> 1. **Contract** — define the SDK method surface + request/response types (pure
>    types, `@glyphh/client/contract`) *first*.
> 2. **Server** — migration (schema) → route → service, satisfying the contract.
> 3. **SDK** — implement the method(s) + typed errors over the internal `fetch`
>    client / transport.
> 4. **Test** — integration test against the **real new server** (ephemeral port,
>    ephemeral test DB); transport slices also test against a **real
>    `openrotor serve`**.
> 5. **Migrate** — move the consumer(s) onto the SDK method, **delete the old
>    code in the same slice** (no-dead-code-in-cutovers).
> 6. **Docs + coverage gate** — update docs; coverage threshold must pass.
>
> **Enterprise baseline on every slice:** `try/catch/finally` around all I/O;
> structured logging with token/secret redaction; typed error hierarchy;
> `AbortController` timeouts; backoff+jitter on retries; no telemetry.

---

## Part A — Foundations (once, before slice 1)

**A0. Repo moves & scaffold**
- Rename `server/` → `server-old/` (reference only; nothing new lands here).
- Scaffold new `server/` (clean): Node ≥20 + TS, **Express as a thin router** +
  `pg`, SQL migrations applied on boot, structured logger (ported from openrotor's
  `obs/logger`, + redaction + pluggable drains), zod env-config, self-describing
  error taxonomy, agent-operable ops surface (`/healthz` `/readyz` `/version`
  `/metrics` `/diag` + gated `/ops/*` + CLI). *(Chose Express over Fastify: one
  shared logger/drain/error format across SDK+server+runtime — what an operating
  agent needs to read all three uniformly — plus the vetted security middleware
  (helmet/rate-limit/cors) ports directly; Fastify's baked-in pino would compete
  with the shared logger.)* **DONE** — boots, tested (14 tests), lint+typecheck clean.
- Scaffold `sdk/` package `@glyphh/client`: dual ESM/CJS via **tsup**, `.d.ts`,
  export conditions `node`/`browser`/`react-native`, subpaths `./contract`,
  `./admin`, `./storage/{secure-store,keychain,file}`. vitest + eslint. Proprietary
  license header on every file.

**A1. Shared contract + core primitives**
- `@glyphh/client/contract` — pure-type module (zero runtime) both the SDK and the
  new server import. One source of truth for every request/response shape.
- SDK `core/`: structured logger (redaction), typed errors
  (`SdkError → ConnectError | AuthError(→ForbiddenError) | ProtocolError |
  UnsupportedError`; plus `RunError` as an outcome), backoff (exp+jitter cap 30s),
  abort/timeout helpers, the internal `fetch` client (base-URL join, header/bearer
  injection, error mapping).
- SDK `protocol/`: `WireEvent` union + `WIRE_VERSION`; re-export the `E_*`
  taxonomy from openrotor's `errors.ts`.

---

## Part B — Domain slices (sequenced by dependency)

Two tracks run in parallel and meet at slice 8:
- **Track 1 (identity & product):** slices 1–7, 9–11 — new server + SDK methods.
- **Track 2 (rotor transport):** the SDK's streaming half — targets openrotor,
  which already exists, so it needs no new server.

### Slice 1 — Auth & sessions  *(the keystone)*
- **Server:** `organizations` (min) + `users` + `sessions` + `refresh` tables;
  opaque access/refresh issuance; `/api/auth/{register,verify-code,
  complete-profile,login,email/start,email/verify,email/complete,oauth/google,
  oauth/apple,device-token,device-exchange}`; `/api/session/{,refresh,revoke}`;
  **`/api/auth/introspect`**; refresh-reuse detection. Port social-verify + WorkOS
  from server-old.
- **SDK:** `auth.*` methods; `TokenStore` + `InMemoryTokenStore`; `RefreshManager`
  (single-flight, proactive, 401-retry-once, rotation, reuse→signedOut);
  `CredentialProvider` → `token: () => Promise<string>`; static `yo_` provider.
- **openrotor:** `AuthVerifier` interface + `NoAuthVerifier` + `IntrospectionVerifier`;
  wire into `server.ts` guarding `/run`, `/runs/:id/*`, `/ws` upgrade; loopback
  exempt (`ROTOR_AUTH_MODE`). Rename `ROTOR_WORKSPACE` → `sandbox`.
- **Migrate:** mobile auth (`api/client.ts`, `session.ts`, `auth.ts`) → SDK; delete.
- **Tests:** login flows, rotation, single-flight, 401→refresh→retry, reuse→signedOut,
  introspection accept/reject, loopback exemption.

### Slice 2 — Org
- `organizations` full (tier, billing_status, stripe_customer_id, workos_org_id).
- SDK `client.org.get/update/settings` (admin-scoped; server enforces).

### Slice 3 — Users
- User CRUD within org, invites, status, machine binding, social identity link.
- SDK `client.users.*` + `client.admin.users.*`.

### Slice 4 — Workspaces  *(rename `org_roles` → `workspaces`)*
- Governance unit: allowed models/connections, rate limits, credits cap, base flag.
- SDK `client.workspaces.*`. Rename consistently across server + SDK + consumers.

### Slice 5 — Connections
- Governed MCP/custom connectors; **write-only encrypted headers**; server-executed
  remote URLs (custom-mcp-server-side). SDK `client.connections.*` (management only).

### Slice 6 — Models & provider keys (BYOK)
- Admin-curated per-org model catalog (HF GGUF open-weight + proxied).
- **Provider keys:** write-only management surface `client.providerKeys.set/list/
  rotate/delete`; server stores encrypted, never returns; runtime injects at run time.
- SDK `client.models.*`.

### Slice 7 — API keys
- `yo_` mcp_tokens: issue (raw once) / list / revoke; EXTERNAL vs CLIENT.
- SDK `client.admin.apiKeys.*`.

### Slice 8 — Rotor sessions, runs & transport  *(the two tracks meet)*
- **SDK transport (Track 2, buildable from A1 onward):** `Transport` interface;
  `SseTransport` (fetch + ReadableStream) and `WsTransport` (global WS / injected);
  `createClient` / `session()` / `session.turn()` (async-iterable events + terminal
  `done` promise + `runId` + `cancel`); **durable reconnect** (seq-dedupe, backoff,
  `reconnecting`/`reconnected`); HITL `resume`; `attach`; attachments/`sandbox`
  file stubs → `E_UNSUPPORTED`.
- **Server:** run/session history surface; sandbox file endpoints (list/read/upload).
- **Tests:** SSE+WS parity; kill-mid-run reconnect (no gap/dupe); HITL; attach-from-
  cursor; version-mismatch→ProtocolError — all against real `openrotor serve`.

### Slice 8b — Control plane: runtime provisioning  *(fly Machines)*
- **Server:** `Provisioner` interface (`provision/status/destroy/injectEnv/
  injectSecret`) + `FlyProvisioner` (fly Machines API). `instances` +
  `remote_sessions` tables. `POST /api/sessions/provision` — check auth +
  entitlement + workspace governance + credits → boot a per-session ephemeral fly
  Machine (region/size by tier) → inject introspection URL + session scope +
  **server-minted scoped git clone token** (from `github_user_tokens`) so the
  instance clones project data into its `sandbox` → return
  `{ runtimeUrl, runtimeToken, sessionId }`. Idle/end **reaper** (destroy machine).
- **Super-admin env provisioning:** `client.admin.environments.*` — manage fly
  orgs/apps/regions, capacity, base image, global secrets, quotas (super_admin only).
- **SDK:** `client.sessions.provision()` → hands `{ runtimeUrl, runtimeToken }` to
  the transport (slice 8) so `session.turn()` streams directly to the instance.
- **Runtime (openrotor):** boot-time git clone into `sandbox`; introspect
  `runtimeToken`; the `Provisioner` abstraction leaves room for `K8sProvisioner`.
- **Tests:** provision→stream→reap lifecycle against a **fly mock/dry-run
  provisioner**; entitlement/credit denial; clone-token scoping.

### Slice 8c — Usage metering  *(first-class across all three planes)*
- **Runtime → server push:** the runtime emits usage events (tokens, wall-time,
  tool calls, machine-seconds) to a control-plane ingest endpoint, authenticated
  with the instance's own service credential.
- **Server:** `usage_events` ingest + aggregation per user/org/workspace/session;
  rolls into billing + credits enforcement (a run is refused when credits are
  exhausted — workspace `credits_cap`).
- **SDK:** `client.usage.*` (read: current session, org rollups).
- **Tests:** ingest → aggregate → credit-cap enforcement → provision denial.

### Slice 9 — Billing
- Stripe customers, `plans`, entitlements, SSO gate (plans.sso). Webhooks.
- Entitlements gate provisioning (slice 8b) + credits meter (slice 8c).
- SDK `client.billing.*` (read) + admin actions.

### Slice 10 — SSO / SCIM (enterprise)
- WorkOS Admin Portal link; Directory Sync webhook (provision/deprovision).
- SDK `client.org.ssoPortal()` (admin-scoped).

### Slice 11 — Rotors  *(if in scope this phase)*
- Loop definitions, skills/agents, org-admin-owned + workspace-governed (rotors epic).
- SDK `client.rotors.*`.

---

## Part C — Close-out
- Migrate remaining consumers (desktop, CLI, web, platform) onto the SDK; delete
  their bespoke clients.
- Retire `server-old/`.
- Coverage to target; publish `@glyphh/client` to private npm.
- **Proof (the "tell"):** re-implement openrotor's dev CLI as a thin `@glyphh/client`
  consumer with a terminal renderer — desktop/mobile become the same work, reskinned.

---

## Open sub-decisions (non-blocking; defaults chosen)
- **New-server framework:** Fastify (recommended) vs Express-port. *Default: Fastify.*
- **Contract location:** `@glyphh/client/contract` pure-types subpath (recommended)
  vs a standalone `@glyphh/contract` package. *Default: subpath.*
- **Slice 11 (rotors)** in this phase or deferred. *Default: deferred to after C.*
