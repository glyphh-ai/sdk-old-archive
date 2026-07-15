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
}
