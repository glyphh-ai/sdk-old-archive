/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/admin.ts — Glyphh platform administration (super_admin only; the server
 * enforces the role — a non-super_admin call surfaces as ForbiddenError). Two halves:
 * the catalog release (providers/models + pricing) and the full admin CONSOLE that
 * backs the platform admin pages — org + user management, plan/model pricing, usage
 * rollups, and the audit log. Console shapes are snake_case (see contract/admin.ts).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Provider, Model, ProviderCreate, ModelCreate } from "../contract/catalog.js";
import type { AdminOrgsPage, AdminOrgListItem, AdminOrgDetail, AdminOrgPatch, AdminCreateOrg, AdminUsersPage, AdminPlan, AdminPlanUpdate, AdminPlanCreate, AdminProviderKey, AdminModel, AdminModelUpdate, AdminPlanPrice, AuditPage, AuditQuery, AdminUsageByUser, AdminUsageDay, AdminDailyQuery, AdminListQuery, AdminUsageByRuntime, AdminRuntimeUsageQuery, RuntimeMode, AdminRevenue } from "../contract/admin.js";
import type { EffectiveContext } from "../contract/membership.js";
import type { AdminSupportPage, AdminSupportQuery } from "../contract/support.js";

/** Append defined params to a path as a query string. */
function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export class AdminClient {
  constructor(private readonly http: AuthedHttp) {}

  // ── catalog release ─────────────────────────────────────────────────────────
  createProvider(input: ProviderCreate): Promise<Provider> {
    return this.http.post<Provider>("/api/admin/providers", input);
  }
  createModel(input: ModelCreate): Promise<Model> {
    return this.http.post<Model>("/api/admin/models", input);
  }


  // ── orgs ─────────────────────────────────────────────────────────────────────
  orgs(query: AdminListQuery = {}): Promise<AdminOrgsPage> {
    return this.http.get<AdminOrgsPage>(withQuery("/api/admin/orgs", { q: query.q, page: query.page, limit: query.limit, parent: query.parent }));
  }
  /** Create a brand-new organization (standalone; base workspace + the free plan's pool). */
  createOrg(input: AdminCreateOrg): Promise<AdminOrgListItem> {
    return this.http.post<AdminOrgListItem>("/api/admin/orgs", input);
  }
  org(id: string): Promise<AdminOrgDetail> {
    return this.http.get<AdminOrgDetail>(`/api/admin/orgs/${encodeURIComponent(id)}`);
  }
  updateOrg(id: string, patch: AdminOrgPatch): Promise<AdminOrgDetail> {
    return this.http.patch<AdminOrgDetail>(`/api/admin/orgs/${encodeURIComponent(id)}`, patch);
  }
  /** Add dollars to an org's budget (an admin grant; never expires).
   *  Returns the budget's new remaining dollars. */
  grantFunds(id: string, usd: number, note?: string): Promise<{ remainingUsd: number }> {
    return this.http.post<{ remainingUsd: number }>(`/api/admin/orgs/${encodeURIComponent(id)}/funds`, note ? { usd, note } : { usd });
  }
  /** Mint a seat-gated invite INTO `id` on the org's behalf (the super-admin Members tab). */
  inviteOrgMember(id: string, email: string, role?: "org_admin" | "admin" | "user"): Promise<{ acceptUrl: string }> {
    return this.http.post<{ acceptUrl: string }>(`/api/admin/orgs/${encodeURIComponent(id)}/members/invite`, role ? { email, role } : { email });
  }
  /** Remove a member from `id` on the org's behalf; their owned apps pass to an org admin. */
  removeOrgMember(id: string, userId: string): Promise<{ ok: boolean }> {
    return this.http.del<{ ok: boolean }>(`/api/admin/orgs/${encodeURIComponent(id)}/members/${encodeURIComponent(userId)}`);
  }


  // ── plans + models pricing ────────────────────────────────────────────────────
  plans(): Promise<{ plans: AdminPlan[] }> {
    return this.http.get<{ plans: AdminPlan[] }>("/api/admin/plans");
  }
  updatePlan(tier: string, patch: AdminPlanUpdate): Promise<{ plan: AdminPlan }> {
    return this.http.put<{ plan: AdminPlan }>(`/api/admin/plans/${encodeURIComponent(tier)}`, patch);
  }
  /** Create a NEW global tier; Stripe prices attach afterward via addPlanPrice. */
  createPlan(input: AdminPlanCreate): Promise<{ plan: AdminPlan }> {
    return this.http.post<{ plan: AdminPlan }>("/api/admin/plans", input);
  }

  // ── platform provider keys — encrypted in the DB, several per provider ──────
  /** The console's provider list: catalog rows + active-key counts (no secrets). */
  providers(): Promise<{ providers: Array<Record<string, unknown> & { slug: string; activeKeys: number }> }> {
    return this.http.get<{ providers: Array<Record<string, unknown> & { slug: string; activeKeys: number }> }>("/api/admin/providers");
  }
  providerKeys(slug: string): Promise<{ keys: AdminProviderKey[] }> {
    return this.http.get<{ keys: AdminProviderKey[] }>(`/api/admin/providers/${encodeURIComponent(slug)}/keys`);
  }
  /** Append a key (active immediately). Rotation = add new, deactivate old. */
  addProviderKey(slug: string, key: string, label?: string): Promise<{ key: AdminProviderKey }> {
    return this.http.post<{ key: AdminProviderKey }>(`/api/admin/providers/${encodeURIComponent(slug)}/keys`, { key, ...(label ? { label } : {}) });
  }
  setProviderKeyActive(id: string, active: boolean): Promise<{ key: AdminProviderKey }> {
    return this.http.post<{ key: AdminProviderKey }>(`/api/admin/providers/keys/${encodeURIComponent(id)}/active`, { active });
  }
  removeProviderKey(id: string): Promise<void> {
    return this.http.del<void>(`/api/admin/providers/keys/${encodeURIComponent(id)}`);
  }
  models(): Promise<{ models: AdminModel[] }> {
    return this.http.get<{ models: AdminModel[] }>("/api/admin/models");
  }
  updateModel(provider: string, model: string, patch: AdminModelUpdate): Promise<{ model: AdminModel }> {
    return this.http.put<{ model: AdminModel }>(`/api/admin/models/${encodeURIComponent(provider)}/${encodeURIComponent(model)}`, patch);
  }


  // ── plan price history (super_admin) ──────────────────────────────────────────
  /** A plan tier's Stripe price history (newest first), active flag included. */
  planPrices(tier: string): Promise<AdminPlanPrice[]> {
    return this.http.get<AdminPlanPrice[]>(`/api/admin/plans/${encodeURIComponent(tier)}/prices`);
  }
  /** Append a Stripe price to a tier's history (audited); the first becomes active. */
  addPlanPrice(tier: string, stripePriceId: string): Promise<AdminPlanPrice> {
    return this.http.post<AdminPlanPrice>(`/api/admin/plans/${encodeURIComponent(tier)}/prices`, { stripePriceId });
  }
  /** Mark a price the active one for NEW checkouts of its tier (audited). */
  activatePlanPrice(id: string): Promise<AdminPlanPrice> {
    return this.http.patch<AdminPlanPrice>(`/api/admin/plans/prices/${encodeURIComponent(id)}/activate`);
  }
  /** Remove a price from a tier's history (audited). */
  removePlanPrice(id: string): Promise<void> {
    return this.http.del<void>(`/api/admin/plans/prices/${encodeURIComponent(id)}`);
  }



  // ── impersonation (platform admin reaches into an org they don't belong to) ───
  /** Start impersonating `orgId` on this session; returns the new effective scope. */
  impersonate(orgId: string): Promise<EffectiveContext> {
    return this.http.post<EffectiveContext>("/api/admin/impersonate", { orgId });
  }
  /** Stop impersonating; the session falls back to the caller's real scope. */
  stopImpersonate(): Promise<EffectiveContext> {
    return this.http.del<EffectiveContext>("/api/admin/impersonate");
  }

  // ── usage ────────────────────────────────────────────────────────────────────
  usageByUser(days?: number, filters: { region?: string; mode?: RuntimeMode; orgId?: string } = {}): Promise<{ users: AdminUsageByUser[] }> {
    return this.http.get<{ users: AdminUsageByUser[] }>(
      withQuery("/api/admin/usage/by-user", { days, region: filters.region, mode: filters.mode, orgId: filters.orgId }),
    );
  }
  usageDaily(query: AdminDailyQuery): Promise<{ days: AdminUsageDay[] }> {
    return this.http.get<{ days: AdminUsageDay[] }>(
      withQuery("/api/admin/usage/daily", {
        from: query.from, to: query.to, tz: query.tz, orgId: query.orgId, userId: query.userId,
        region: query.region, mode: query.mode,
      }),
    );
  }
  /** REAL revenue for a window: Stripe collected cash. */
  revenue(query: { from: string; to: string; orgId?: string }): Promise<AdminRevenue> {
    return this.http.get<AdminRevenue>(withQuery("/api/admin/revenue", { from: query.from, to: query.to, orgId: query.orgId }));
  }
  /** Usage + billing broken down by WHERE it ran: region × shared|dedicated × tier. */
  usageByRuntime(query: AdminRuntimeUsageQuery): Promise<{ runtimes: AdminUsageByRuntime[] }> {
    return this.http.get<{ runtimes: AdminUsageByRuntime[] }>(
      withQuery("/api/admin/usage/by-runtime", {
        from: query.from, to: query.to, region: query.region, mode: query.mode, tier: query.tier, orgId: query.orgId,
      }),
    );
  }


}
