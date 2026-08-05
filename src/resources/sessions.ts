/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/sessions.ts — CONTROL-plane runtime sessions. `create` provisions a rotor
 * runtime and returns `{ session, runtimeToken }`; hand `session.runtimeUrl` +
 * `runtimeToken` to `client.session()` to open the DATA-plane stream. `runtimeToken`
 * is returned once — the runtime authorizes each request by introspecting it here.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { CreateSessionInput, ProvisionedSession, RuntimeSession, ModelSwitchInput, ModelSwitchResult } from "../contract/runtime.js";
import type { SessionThread, SessionThreadMeta, PushThreadInput, PushThreadResult } from "../contract/threads.js";

export class SessionsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Provision a runtime. The `runtimeToken` in the reply is shown ONCE — store it. */
  create(input: CreateSessionInput): Promise<ProvisionedSession> {
    return this.http.post<ProvisionedSession>("/api/sessions", input);
  }

  /** The caller's runtime sessions. */
  list(): Promise<RuntimeSession[]> {
    return this.http.get<RuntimeSession[]>("/api/sessions");
  }

  /** One session by id (owner). */
  get(id: string): Promise<RuntimeSession> {
    return this.http.get<RuntimeSession>(`/api/sessions/${encodeURIComponent(id)}`);
  }

  /** Deprovision + stop a session. */
  delete(id: string): Promise<void> {
    return this.http.del<void>(`/api/sessions/${encodeURIComponent(id)}`);
  }

  // ── threads — the durable conversations in the regional stator ──────────────

  /** The caller's threads — metadata only (never message bodies), newest-updated first. */
  threads(): Promise<SessionThreadMeta[]> {
    return this.http.get<SessionThreadMeta[]>("/api/sessions/threads");
  }

  /** One thread with its messages (the server returns the LAST 500, in order). Owner-only. */
  thread(id: string): Promise<SessionThread> {
    return this.http.get<SessionThread>(`/api/sessions/threads/${encodeURIComponent(id)}`);
  }

  /**
   * LWW upsert — the CLIENT CACHE SYNC path (drain your pendingPush here). Thread
   * ids are client-minted uuids: an unknown id creates the thread. The push applies
   * only when `body.updatedAt` is STRICTLY newer than the server's copy; either way
   * the result carries the server's current state to reconcile against.
   */
  pushThread(id: string, body: PushThreadInput): Promise<PushThreadResult> {
    return this.http.put<PushThreadResult>(`/api/sessions/threads/${encodeURIComponent(id)}`, body);
  }

  /** Tombstone a thread (owner-only) — messages purged; a stale push cannot resurrect it. */
  deleteThread(id: string): Promise<void> {
    return this.http.del<void>(`/api/sessions/threads/${encodeURIComponent(id)}`);
  }

  /**
   * Record a mid-stream model switch for traceability (the model-governance audit).
   * The runtime calls this on a role→model change so the whole switch is auditable.
   * Session-agnostic: `sessionId` is a free-form string — a provisioned session id
   * for hosted runs, or an ephemeral client id for LOCAL (embedded) runs that have
   * no provisioned session — so a local opus→haiku switch still audits.
   */
  recordModelSwitch(input: ModelSwitchInput): Promise<ModelSwitchResult> {
    return this.http.post<ModelSwitchResult>("/api/models/switch", input);
  }
}
