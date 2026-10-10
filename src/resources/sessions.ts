/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/sessions.ts — CONTROL-plane runtime sessions. `create` provisions a rotor
 * runtime and returns `{ session, runtimeToken }`; hand `session.runtimeUrl` +
 * `runtimeToken` to `client.session()` to open the DATA-plane stream. `runtimeToken`
 * is returned once — the runtime authorizes each request by introspecting it here.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { CreateSessionInput, ProvisionedSession, RuntimeSession } from "../contract/runtime.js";
import type {
  SessionThread, SessionThreadMeta, PushThreadInput, PushThreadResult,
  ThreadTranscriptUrl, AppendThreadMessagesInput, AppendThreadMessagesResult,
} from "../contract/threads.js";

const THREADS = "/api/harness/threads";
const threadPath = (id: string): string => `${THREADS}/${encodeURIComponent(id)}`;

export class SessionsClient {
  constructor(private readonly http: AuthedHttp) {}

  /**
   * Mint a RUN-SCOPED session so a long agent run doesn't ride the caller's
   * short-lived access token (which expires mid-build and 401s the gateway).
   * Same user, same org, no new privilege — a visible, revocable device
   * (`run:<id>`). RELEASE it when the run ends: the TTL is a ceiling.
   */
  createRunSession(runId: string): Promise<{ accessToken: string; expiresIn: number }> {
    return this.http.post("/api/session/run", { runId });
  }
  releaseRunSession(runId: string): Promise<{ released: number }> {
    return this.http.del(`/api/session/run/${encodeURIComponent(runId)}`) as Promise<{ released: number }>;
  }

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

  // ── threads — the durable conversations the control plane keeps ─────────────
  // Served at /api/harness/threads (the server's own; no pod involved).

  /** The caller's threads — metadata only (never message bodies), newest-updated first. */
  threads(): Promise<SessionThreadMeta[]> {
    return this.http.get<SessionThreadMeta[]>(THREADS);
  }

  /** One thread with a PREVIEW of its messages (the last 20, in order) and its
   *  `transcriptUrl` when a transcript is stored. Owner-only; unknown → NotFoundError. */
  thread(id: string): Promise<SessionThread> {
    return this.http.get<SessionThread>(threadPath(id));
  }

  /** A fresh presigned GET of the thread's whole transcript. */
  transcriptUrl(id: string): Promise<ThreadTranscriptUrl> {
    return this.http.get<ThreadTranscriptUrl>(`${threadPath(id)}/transcript`);
  }

  /**
   * Append messages after the stored ones — the per-turn sync path, so a client
   * never re-sends the whole transcript. Applies only when `updatedAt` is
   * STRICTLY newer than the stored clock; a stale clock answers `applied:false`
   * with the thread as the server holds it (never a throw), as `pushThread` does.
   */
  appendMessages(id: string, body: AppendThreadMessagesInput): Promise<AppendThreadMessagesResult> {
    return this.http.post<AppendThreadMessagesResult>(`${threadPath(id)}/messages`, body);
  }

  /**
   * LWW upsert — the CLIENT CACHE SYNC path (drain your pendingPush here). Thread
   * ids are client-minted text (`c<ts36>` style — not uuids): an unknown id creates
   * the thread. The push applies only when `body.updatedAt` (epoch ms) is STRICTLY
   * newer than the server's copy; either way the result carries the server's
   * current state to reconcile against. A deleted thread stays deleted: a push
   * to it is a NotFoundError.
   */
  pushThread(id: string, body: PushThreadInput): Promise<PushThreadResult> {
    return this.http.put<PushThreadResult>(threadPath(id), body);
  }

  /** Tombstone a thread (owner-only) — messages purged; a stale push cannot resurrect it. */
  deleteThread(id: string): Promise<void> {
    return this.http.del<void>(threadPath(id));
  }

}
