/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/role.ts — roles: named member groups inside an org, and the org's
 * governance link to glyphh models. A role carries MODEL GRANTS: which deployed
 * glyphh models its members can see, and which of each model's MCP tools they
 * may call.
 */

export interface Role {
  id: string;
  orgId: string;
  name: string;
  isBase: boolean;
}

export interface RoleInput {
  name: string;
}

/** One role → glyphh-model grant. `tools` is the callable-tool allowlist over
 *  the MCP tools the model exposes: null = every tool; an array = exactly
 *  those tool names. Models are addressed by slug. */
export interface ModelGrant {
  id: string;
  roleId: string;
  modelSlug: string;
  tools: string[] | null;
}

export interface ModelGrantInput {
  modelSlug: string;
  /** Omit or null = every tool the model exposes. */
  tools?: string[] | null;
}

/** One member of a role (identity joined server-side). */
export interface RoleMember {
  userId: string;
  email: string;
  name: string | null;
}

/** One INSTALLED glyphh model — the org catalog roles grant from. `tools` is
 *  the list of MCP tool names the model exposes. */
export interface InstalledModel {
  id: string;
  slug: string;
  displayName: string | null;
  tools: string[];
}

/** The org's model catalog + the allow-custom-models policy flag. */
export interface OrgModels {
  models: InstalledModel[];
  allowCustom: boolean;
}

export interface InstallModelInput {
  displayName?: string | null;
  tools?: string[];
}
