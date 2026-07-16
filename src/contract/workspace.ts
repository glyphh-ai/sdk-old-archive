/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/workspace.ts — workspace governance (the ex-`org_roles` layer). A user
 * belongs to one workspace; the workspace grants/filters what its members may use.
 *
 * Flag semantics (per product): each `limit<X>` is an explicit toggle —
 *   limit<X> = false → ALL of X are granted (the `allowed<X>` list is ignored);
 *   limit<X> = true  → only the `allowed<X>` list is granted.
 */

/**
 * Per-connection TOOL grants, keyed by connection slug → the granted tool names.
 * Layers UNDER the connection gate (a connection must first be allowed): an absent
 * slug ⇒ ALL of that connection's tools; a present slug ⇒ only the listed tools
 * (an empty array ⇒ none).
 */
export type ConnectionToolGrants = Record<string, string[]>;

export interface Workspace {
  id: string;
  orgId: string;
  name: string;
  /** The one undeletable workspace per org; unassigned members fall back to it. */
  isBase: boolean;

  limitProviders: boolean;
  allowedProviders: string[];
  limitModels: boolean;
  allowedModels: string[];
  limitConnections: boolean;
  allowedConnections: string[];
  /** Per-connection tool scoping. Absent slug ⇒ all tools; present ⇒ only listed. */
  allowedConnectionTools: ConnectionToolGrants;
  limitApps: boolean;
  allowedApps: string[];
  limitAppHosting: boolean;
  allowedHosting: string[];

  allowCustomMcp: boolean;

  creditsCap: number | null;
  capPeriodDays: number | null;
  rateLimitCalls: number | null;
  rateLimitWindowSeconds: number | null;
}

/** Create/update payload — every field optional; base-role restrictions apply server-side. */
export interface WorkspaceInput {
  name?: string;
  limitProviders?: boolean;
  allowedProviders?: string[];
  limitModels?: boolean;
  allowedModels?: string[];
  limitConnections?: boolean;
  allowedConnections?: string[];
  allowedConnectionTools?: ConnectionToolGrants;
  limitApps?: boolean;
  allowedApps?: string[];
  limitAppHosting?: boolean;
  allowedHosting?: string[];
  allowCustomMcp?: boolean;
  creditsCap?: number | null;
  capPeriodDays?: number | null;
  rateLimitCalls?: number | null;
  rateLimitWindowSeconds?: number | null;
}

/** A resolved grant: "all" (unlimited) or the exact allow-list. */
export type Grant = "all" | string[];

/** The effective governance for a member — what the runtime enforces. */
export interface EffectiveGrants {
  providers: Grant;
  models: Grant;
  connections: Grant;
  apps: Grant;
  hosting: Grant;
  allowCustomMcp: boolean;
  creditsCap: number | null;
  capPeriodDays: number | null;
  rateLimitCalls: number | null;
  rateLimitWindowSeconds: number | null;
}
