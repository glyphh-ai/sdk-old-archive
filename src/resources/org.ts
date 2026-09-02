/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/org.ts — the caller's organization. Read + (org_admin) update. Authz is
 * server-side; a non-admin update surfaces as a ForbiddenError.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Org, OrgUpdate, Guardrails, GuardrailsPolicy, OrgInfra, OrgInfraChoice, OrgDomain, EdgeTrafficReport } from "../contract/org.js";

export class OrgClient {
  constructor(private readonly http: AuthedHttp) {}

  get(): Promise<Org> {
    return this.http.get<Org>("/api/org");
  }

  /** Upload the org's image (PNG/JPEG/GIF/WebP, ≤0.5MB; sniffed server-side).
   *  org_admin only. The refreshed org (with imageUrl) comes from get(). */
  uploadImage(bytes: Uint8Array): Promise<{ key: string; contentType: string; bytes: number }> {
    return this.http.post<{ key: string; contentType: string; bytes: number }>("/api/org/image", bytes);
  }

  /** ORG ADMIN: marketplace apps blocked for this org (installs refuse). */
  appBlocks(): Promise<{ blocks: Array<{ appId: string; slug: string; name: string; createdAt: string }> }> {
    return this.http.get("/api/org/app-blocks") as Promise<{ blocks: Array<{ appId: string; slug: string; name: string; createdAt: string }> }>;
  }
  blockApp(ref: string): Promise<{ ok: boolean; blocked: boolean; slug: string }> {
    return this.http.put<{ ok: boolean; blocked: boolean; slug: string }>(`/api/org/app-blocks/${encodeURIComponent(ref)}`, {});
  }
  unblockApp(ref: string): Promise<{ ok: boolean; blocked: boolean; slug: string }> {
    return this.http.del<{ ok: boolean; blocked: boolean; slug: string }>(`/api/org/app-blocks/${encodeURIComponent(ref)}`);
  }

  update(patch: OrgUpdate): Promise<Org> {
    return this.http.patch<Org>("/api/org", patch);
  }

  /** The org's runtime infra + the one-time region-choice state (any member). */
  infra(): Promise<OrgInfra> {
    return this.http.get<OrgInfra>("/api/org/infra");
  }

  /** Make the one-time region/tier choice (org_admin; idempotent — flips
   *  `regionChosen`, provisioning/moving the org's runtime as needed). */
  chooseInfra(choice: OrgInfraChoice): Promise<OrgInfra> {
    return this.http.post<OrgInfra>("/api/org/infra", choice);
  }

  /** The org-wide runtime guardrails policy (org_admin). */
  guardrails(): Promise<Guardrails> {
    return this.http.get<Guardrails>("/api/org/guardrails");
  }

  /** Replace the org guardrails policy wholesale; pass null to clear it (org_admin). */
  setGuardrails(policy: GuardrailsPolicy | null): Promise<Guardrails> {
    return this.http.patch<Guardrails>("/api/org/guardrails", { guardrails_policy: policy });
  }

  // ── org white-label domains (org_admin) ─────────────────────────────────

  /** The org's custom domains (docs/custom-domains.md): verify one, and every
   *  published app answers at `<slug>.<domain>`. */
  async domains(): Promise<OrgDomain[]> {
    const { domains } = await this.http.get<{ domains: OrgDomain[] }>("/api/org/domains");
    return domains;
  }

  /** Apex-edge traffic for the org's hostnames: per-day series + per-host totals. */
  domainsTraffic(days = 30): Promise<EdgeTrafficReport> {
    return this.http.get<EdgeTrafficReport>(`/api/org/domains/traffic?days=${Math.max(1, Math.min(90, days))}`);
  }

  /** Claim a domain — returns the DNS records (TXT + wildcard CNAME) to publish. */
  addDomain(domain: string): Promise<OrgDomain> {
    return this.http.post<OrgDomain>("/api/org/domains", { domain });
  }

  /** Check the ownership TXT; on success the domain goes active and per-app
   *  hostnames start registering. Throws E_FAILED_PRECONDITION while DNS lags. */
  verifyDomain(id: string): Promise<OrgDomain> {
    return this.http.post<OrgDomain>(`/api/org/domains/${encodeURIComponent(id)}/verify`, {});
  }

  /** Remove a domain — tears down its per-app hostnames; the edge stops at once. */
  removeDomain(id: string): Promise<void> {
    return this.http.del<void>(`/api/org/domains/${encodeURIComponent(id)}`);
  }

  /** Point the domain's BARE apex at a flagship app (null clears it). */
  setDomainApexApp(id: string, appId: string | null): Promise<OrgDomain> {
    return this.http.post<OrgDomain>(`/api/org/domains/${encodeURIComponent(id)}/apex-app`, { appId });
  }

  /** Flip the org-wide wildcard (opt-in). ON exposes every published app at
   *  `<slug>.<domain>`; OFF tears down the swept subdomains (apex + explicit
   *  per-app hostnames untouched). Off by default — see the footgun warning. */
  setDomainWildcard(id: string, wildcard: boolean): Promise<OrgDomain> {
    return this.http.post<OrgDomain>(`/api/org/domains/${encodeURIComponent(id)}/wildcard`, { wildcard });
  }
}
