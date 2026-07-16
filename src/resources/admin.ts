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
import type { Provider, Model, ProviderCreate, ModelCreate, ModelPricing } from "../contract/catalog.js";
import type {
  AdminStats, AdminOrgsPage, AdminOrgDetail, AdminOrgPatch,
  AdminUsersPage, AdminUser, AdminUserPatch,
  AdminPlan, AdminPlanUpdate, AdminModel, AdminModelUpdate,
  AuditPage, AuditQuery, AdminUsageByUser, AdminUsageDay, AdminDailyQuery, AdminListQuery,
} from "../contract/admin.js";

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
  setModelPricing(id: string, pricing: ModelPricing): Promise<Model> {
    return this.http.patch<Model>(`/api/admin/models/${encodeURIComponent(id)}`, pricing);
  }

  // ── dashboard ─────────────────────────────────────────────────────────────
  stats(): Promise<AdminStats> {
    return this.http.get<AdminStats>("/api/admin/stats");
  }

  // ── orgs ─────────────────────────────────────────────────────────────────────
  orgs(query: AdminListQuery = {}): Promise<AdminOrgsPage> {
    return this.http.get<AdminOrgsPage>(withQuery("/api/admin/orgs", { q: query.q, page: query.page, limit: query.limit }));
  }
  org(id: string): Promise<AdminOrgDetail> {
    return this.http.get<AdminOrgDetail>(`/api/admin/orgs/${encodeURIComponent(id)}`);
  }
  updateOrg(id: string, patch: AdminOrgPatch): Promise<AdminOrgDetail> {
    return this.http.patch<AdminOrgDetail>(`/api/admin/orgs/${encodeURIComponent(id)}`, patch);
  }
  lockOrg(id: string, reason?: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/admin/orgs/${encodeURIComponent(id)}/lock`, reason ? { reason } : {});
  }
  unlockOrg(id: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/admin/orgs/${encodeURIComponent(id)}/unlock`);
  }
  /** Grant whole credits to an org (never expires). Returns the new balance (micro). */
  grantCredits(id: string, credits: number, note?: string): Promise<{ balance: number }> {
    return this.http.post<{ balance: number }>(`/api/admin/orgs/${encodeURIComponent(id)}/credits`, note ? { credits, note } : { credits });
  }

  // ── users ──────────────────────────────────────────────────────────────────
  users(query: AdminListQuery = {}): Promise<AdminUsersPage> {
    return this.http.get<AdminUsersPage>(withQuery("/api/admin/users", { q: query.q, page: query.page, limit: query.limit }));
  }
  user(id: string): Promise<AdminUser> {
    return this.http.get<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`);
  }
  updateUser(id: string, patch: AdminUserPatch): Promise<AdminUser> {
    return this.http.patch<AdminUser>(`/api/admin/users/${encodeURIComponent(id)}`, patch);
  }
  disableUser(id: string, reason?: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/disable`, reason ? { reason } : {});
  }
  enableUser(id: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/admin/users/${encodeURIComponent(id)}/enable`);
  }

  // ── plans + models pricing ────────────────────────────────────────────────────
  plans(): Promise<{ plans: AdminPlan[] }> {
    return this.http.get<{ plans: AdminPlan[] }>("/api/admin/plans");
  }
  updatePlan(tier: string, patch: AdminPlanUpdate): Promise<{ plan: AdminPlan }> {
    return this.http.put<{ plan: AdminPlan }>(`/api/admin/plans/${encodeURIComponent(tier)}`, patch);
  }
  models(): Promise<{ models: AdminModel[] }> {
    return this.http.get<{ models: AdminModel[] }>("/api/admin/models");
  }
  updateModel(provider: string, model: string, patch: AdminModelUpdate): Promise<{ model: AdminModel }> {
    return this.http.put<{ model: AdminModel }>(`/api/admin/models/${encodeURIComponent(provider)}/${encodeURIComponent(model)}`, patch);
  }

  // ── usage ────────────────────────────────────────────────────────────────────
  usageByUser(days?: number): Promise<{ users: AdminUsageByUser[] }> {
    return this.http.get<{ users: AdminUsageByUser[] }>(withQuery("/api/admin/usage/by-user", { days }));
  }
  usageDaily(query: AdminDailyQuery): Promise<{ days: AdminUsageDay[] }> {
    return this.http.get<{ days: AdminUsageDay[] }>(
      withQuery("/api/admin/usage/daily", { from: query.from, to: query.to, tz: query.tz, orgId: query.orgId, userId: query.userId }),
    );
  }

  // ── audit ────────────────────────────────────────────────────────────────────
  audit(query: AuditQuery = {}): Promise<AuditPage> {
    return this.http.get<AuditPage>(
      withQuery("/api/admin/audit", { action: query.action, actor: query.actor, days: query.days, page: query.page, limit: query.limit }),
    );
  }
}
