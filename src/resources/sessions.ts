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
