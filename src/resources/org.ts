/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/org.ts — the caller's organization. Read + (org_admin) update. Authz is
 * server-side; a non-admin update surfaces as a ForbiddenError.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Org, OrgUpdate, Guardrails, GuardrailsPolicy } from "../contract/org.js";

export class OrgClient {
  constructor(private readonly http: AuthedHttp) {}

  get(): Promise<Org> {
    return this.http.get<Org>("/api/org");
  }

  update(patch: OrgUpdate): Promise<Org> {
    return this.http.patch<Org>("/api/org", patch);
  }

  /** The org-wide runtime guardrails policy (org_admin). */
  guardrails(): Promise<Guardrails> {
    return this.http.get<Guardrails>("/api/org/guardrails");
  }

  /** Replace the org guardrails policy wholesale; pass null to clear it (org_admin). */
  setGuardrails(policy: GuardrailsPolicy | null): Promise<Guardrails> {
    return this.http.patch<Guardrails>("/api/org/guardrails", { guardrails_policy: policy });
  }
}
