/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/admin.ts — Glyphh platform administration (super_admin only; the server
 * enforces the role — a non-super_admin call surfaces as ForbiddenError). The admin CONSOLE that
 * backs the platform admin pages — org + user management, plan pricing, runtime
 * image SKUs, usage rollups, support, and the audit log. Console shapes are snake_case (see contract/admin.ts).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  AdminStats, AdminOrgsPage, AdminOrgListItem, AdminOrgDetail, AdminOrgPatch, AdminCreateOrg,
  AdminUsersPage, AdminUser, AdminUserPatch,
  AdminPlan, AdminPlanUpdate, AdminPlanCreate, AdminOrgPlanInput, AdminOrgPlanPatch, AdminPlanPrice,
  AuditPage, AuditQuery, AdminUsageByUser, AdminUsageDay, AdminDailyQuery, AdminListQuery,
  AdminUsageByRuntime, AdminRuntimeUsageQuery, RuntimeMode,
} from "../contract/admin.js";
import type { EffectiveContext } from "../contract/membership.js";
import type { RuntimeImage, AdminRuntimeImageCreate, AdminRuntimeImageUpdate } from "../contract/runtime-images.js";
import type {
  AdminSupportPage, AdminSupportThread, AdminSupportTicket, AdminSupportQuery, SupportUnread,
} from "../contract/support.js";

/** Append defined params to a path as a query string. */
function withQuery(path: string, params: Record<string, string | number | undefined>): string {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") qs.set(k, String(v));
  const s = qs.toString();
  return s ? `${path}?${s}` : path;
}

export class AdminClient {
  constructor(private readonly http: AuthedHttp) {}

  // ── dashboard ─────────────────────────────────────────────────────────────
  stats(): Promise<AdminStats> {
    return this.http.get<AdminStats>("/api/admin/stats");
  }

  // ── orgs ─────────────────────────────────────────────────────────────────────
  orgs(query: AdminListQuery = {}): Promise<AdminOrgsPage> {
    return this.http.get<AdminOrgsPage>(withQuery("/api/admin/orgs", { q: query.q, page: query.page, limit: query.limit }));
  }
  /** Create a brand-new organization (standalone; base role provisioned). */
  createOrg(input: AdminCreateOrg): Promise<AdminOrgListItem> {
    return this.http.post<AdminOrgListItem>("/api/admin/orgs", input);
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
  /** Create a NEW global tier; Stripe prices attach afterward via addPlanPrice. */
  createPlan(input: AdminPlanCreate): Promise<{ plan: AdminPlan }> {
    return this.http.post<{ plan: AdminPlan }>("/api/admin/plans", input);
  }

  /** Create/replace an org's bespoke (enterprise) plan — custom seat cap + per-seat price + allowance. */
  setOrgPlan(orgId: string, input: AdminOrgPlanInput): Promise<{ plan: AdminPlan }> {
    return this.http.post<{ plan: AdminPlan }>(`/api/admin/orgs/${encodeURIComponent(orgId)}/plan`, input);
  }
  /** Edit an org's bespoke plan (must already exist). */
  updateOrgPlan(orgId: string, patch: AdminOrgPlanPatch): Promise<{ plan: AdminPlan }> {
    return this.http.patch<{ plan: AdminPlan }>(`/api/admin/orgs/${encodeURIComponent(orgId)}/plan`, patch);
  }
  /** Remove an org's bespoke plan, reverting it to its global tier. */
  removeOrgPlan(orgId: string): Promise<{ ok: boolean }> {
    return this.http.del<{ ok: boolean }>(`/api/admin/orgs/${encodeURIComponent(orgId)}/plan`);
  }
  /** DELETE an organization + everything it owns (typed-name confirmed).
   *  Sole-org members are deleted with it; multi-org members lose the
   *  membership. Refused while Stripe billing is live or a platform admin
   *  is a member. */
  deleteOrg(orgId: string, confirmName: string): Promise<{ orgId: string; name: string; usersDeleted: number; membersDetached: number }> {
    return this.http.post(`/api/admin/orgs/${encodeURIComponent(orgId)}/delete`, { confirmName });
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

  // ── runtime image catalog (§7b — the model-catalog treatment) ─────────────────
  /** Every catalog image, every region, active + inactive. */
  runtimeImages(): Promise<{ images: RuntimeImage[] }> {
    return this.http.get<{ images: RuntimeImage[] }>("/api/admin/runtime-images");
  }
  /** Add a SKU to a region's catalog. */
  createRuntimeImage(input: AdminRuntimeImageCreate): Promise<{ image: RuntimeImage }> {
    return this.http.post<{ image: RuntimeImage }>("/api/admin/runtime-images", input);
  }
  /** Re-price / re-size / retire a region's SKU (audited). */
  updateRuntimeImage(region: string, key: string, patch: AdminRuntimeImageUpdate): Promise<{ image: RuntimeImage }> {
    return this.http.put<{ image: RuntimeImage }>(
      `/api/admin/runtime-images/${encodeURIComponent(region)}/${encodeURIComponent(key)}`, patch,
    );
  }
  /** Remove a SKU from a region's catalog (audited). Bound orgs keep serving off
   *  their realized route; only the price stops resolving. */
  deleteRuntimeImage(region: string, key: string): Promise<{ ok: boolean }> {
    return this.http.del<{ ok: boolean }>(
      `/api/admin/runtime-images/${encodeURIComponent(region)}/${encodeURIComponent(key)}`,
    );
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
  usageByUser(days?: number, filters: { region?: string; mode?: RuntimeMode } = {}): Promise<{ users: AdminUsageByUser[] }> {
    return this.http.get<{ users: AdminUsageByUser[] }>(
      withQuery("/api/admin/usage/by-user", { days, region: filters.region, mode: filters.mode }),
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
  /** Usage + billing broken down by WHERE it ran: region × shared|dedicated × tier. */
  usageByRuntime(query: AdminRuntimeUsageQuery): Promise<{ runtimes: AdminUsageByRuntime[] }> {
    return this.http.get<{ runtimes: AdminUsageByRuntime[] }>(
      withQuery("/api/admin/usage/by-runtime", {
        from: query.from, to: query.to, region: query.region, mode: query.mode, tier: query.tier,
      }),
    );
  }

  // ── audit ────────────────────────────────────────────────────────────────────
  audit(query: AuditQuery = {}): Promise<AuditPage> {
    return this.http.get<AuditPage>(
      withQuery("/api/admin/audit", { action: query.action, actor: query.actor, days: query.days, page: query.page, limit: query.limit }),
    );
  }

  // ── support console (super_admin) ──────────────────────────────────────────────
  /** Browse every org's tickets (search + status filter + pagination). Shapes are snake_case. */
  supportTickets(query: AdminSupportQuery = {}): Promise<AdminSupportPage> {
    return this.http.get<AdminSupportPage>(
      withQuery("/api/admin/support/tickets", { q: query.q, status: query.status, page: query.page, limit: query.limit }),
    );
  }
  /** One ticket + its full thread (any org). */
  supportTicket(id: string): Promise<AdminSupportThread> {
    return this.http.get<AdminSupportThread>(`/api/admin/support/tickets/${encodeURIComponent(id)}`);
  }
  /** Append an admin reply (moves the ticket → 'pending'); returns the updated thread. */
  supportReply(id: string, body: string): Promise<AdminSupportThread> {
    return this.http.post<AdminSupportThread>(`/api/admin/support/tickets/${encodeURIComponent(id)}/messages`, { body });
  }
  /** Set a ticket's status (audited: open|pending|resolved|closed). */
  setSupportStatus(id: string, status: string): Promise<AdminSupportTicket> {
    return this.http.patch<AdminSupportTicket>(`/api/admin/support/tickets/${encodeURIComponent(id)}`, { status });
  }
  /** Mark a ticket read by the admin (clears its attention flag; never reorders the list). */
  markSupportRead(id: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/admin/support/tickets/${encodeURIComponent(id)}/read`);
  }
  /** Count of tickets needing admin attention (open|pending AND unread-for-admin). */
  supportUnreadCount(): Promise<SupportUnread> {
    return this.http.get<SupportUnread>("/api/admin/support/unread");
  }
}
