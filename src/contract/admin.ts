/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/admin.ts — the super_admin platform-console wire shapes. These mirror
 * the server's admin endpoints, which back the admin pages that read snake_case
 * fields directly, so (unlike the camelCase billing/catalog contracts) the admin
 * shapes are snake_case — the SDK is a faithful typed passthrough. Credits are
 * micro-credits here (the pages divide by 1e6); the daily token buckets are
 * camelCase to match the chart series the Usage page consumes.
 */

export interface AdminStats {
  users: { total: number; active: number };
  orgCount: number;
}

// ── orgs ─────────────────────────────────────────────────────────────────────
export interface AdminOrgListItem {
  id: string;
  name: string;
  tier: string;
  billing_status: string;
  member_count: number;
}
export interface AdminOrgsPage {
  orgs: AdminOrgListItem[];
  total: number;
}
export interface AdminOrgMember {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: string;
  status: string;
}
export interface AdminOrgDetail extends AdminOrgListItem {
  max_seats: number;
  created_at: string;
  credits: { balance: number }; // micro-credits
  members: AdminOrgMember[];
}
export interface AdminOrgPatch {
  name?: string;
  tier?: string;
  billingStatus?: string;
}
/** Create a brand-new org from the console (name required, tier defaults to free). */
export interface AdminCreateOrg {
  name: string;
  tier?: string;
}

// ── users ────────────────────────────────────────────────────────────────────
export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: string;
  status: string;
  org_id: string | null;
  org_name: string | null;
  tier: string | null;
  billing_status: string | null;
  created_at: string;
}
export interface AdminUsersPage {
  users: AdminUser[];
  total: number;
}
export interface AdminUserPatch {
  firstName?: string;
  lastName?: string;
  email?: string;
  role?: string;
  status?: string;
  tier?: string;
  billingStatus?: string;
}

// ── plans / models pricing ────────────────────────────────────────────────────
export interface AdminPlan {
  tier: string;
  display_name: string;
  monthly_usd_cents: number; // per-seat price
  included_credits: number; // micro-credits per seat per month
  max_seats: number;
  active: boolean;
  /** NULL for a global catalog plan; the org id for a bespoke per-org plan. */
  org_id: string | null;
  /** The bespoke plan's org name (null for global plans). */
  org_name: string | null;
}
export interface AdminPlanUpdate {
  display_name?: string;
  monthly_usd_cents?: number;
  included_credits?: number;
  max_seats?: number;
  active?: boolean;
}

/**
 * A per-org bespoke (enterprise) plan. Unlike the snake_case global-plan shapes above,
 * the org-plan write payloads are camelCase — they mirror the server's org-plan
 * endpoints (which take camelCase directly). `monthlyCredits` is the per-seat
 * micro-credit allowance; `monthlyUsdCents` is the per-seat price.
 */
export interface AdminOrgPlanInput {
  maxSeats: number;
  monthlyUsdCents: number;
  monthlyCredits: number;
  displayName: string;
  /** The specific Stripe price the org is billed on (enterprise is provisioned/invoiced). */
  stripePriceId?: string;
}
/** Partial edit of an org's bespoke plan (every field optional). */
export interface AdminOrgPlanPatch {
  maxSeats?: number;
  monthlyUsdCents?: number;
  monthlyCredits?: number;
  displayName?: string;
  stripePriceId?: string;
}
export interface AdminModel {
  provider: string;
  model: string;
  display_name: string;
  /** Short @-mention name; null = not mentionable. */
  alias: string | null;
  input_credits_per_mtok: number | null; // micro-credits/MTok; null = not per-token priced
  output_credits_per_mtok: number | null;
  /** Total tokens the model holds; what the gateway fits requests to. Null = unrecorded. */
  context_window: number | null;
  /** Largest single completion. Null = unrecorded. */
  max_output_tokens: number | null;
  active: boolean;
}
export interface AdminModelUpdate {
  display_name?: string;
  /** Short @-mention name; null clears it, omit keeps it. */
  alias?: string | null;
  active?: boolean;
  input_credits_per_mtok?: number | null;
  output_credits_per_mtok?: number | null;
  context_window?: number | null;
  max_output_tokens?: number | null;
}

/**
 * One entry of a plan's Stripe price history (super_admin). Unlike the other admin
 * shapes this is camelCase — it mirrors the billing wire contract, where the price
 * history is served alongside the checkout surface. `createdAt` is an ISO timestamp.
 */
export interface AdminPlanPrice {
  id: string;
  stripePriceId: string;
  active: boolean;
  createdAt: string;
}

// ── audit ────────────────────────────────────────────────────────────────────
export interface AuditEntry {
  id: string;
  action: string;
  actor_id: string | null;
  actor_email: string | null;
  target_id: string | null;
  target_email: string | null;
  metadata: unknown;
  created_at: string;
}
export interface AuditPage {
  entries: AuditEntry[];
  total: number;
}
export interface AuditQuery {
  action?: string | undefined;
  actor?: string | undefined;
  days?: number | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}

// ── usage ────────────────────────────────────────────────────────────────────
export interface AdminUsageByUser {
  userId: string;
  email: string;
  name: string;
  requests: number;
  credits: number; // micro-credits
  tokens: number;
}
export interface AdminUsageDay {
  day: string; // YYYY-MM-DD
  credits: number; // micro-credits
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
}
export interface AdminDailyQuery {
  from: string; // YYYY-MM-DD
  to: string; // YYYY-MM-DD
  tz?: string | undefined;
  orgId?: string | undefined;
  userId?: string | undefined;
}

/** Common list query for the paginated/searchable admin tables. */
export interface AdminListQuery {
  q?: string | undefined;
  page?: number | undefined;
  limit?: number | undefined;
}
