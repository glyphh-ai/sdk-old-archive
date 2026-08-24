/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/roles.ts — roles: list/create/update/delete + the role's glyphh
 * model grants. Mutations are org_admin (server-enforced); the base role can't
 * be deleted. Member assignment lives on `members.assignRole`.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Role, RoleInput, ModelGrant, ModelGrantInput, RoleMember, InstalledModel, OrgModels, InstallModelInput } from "../contract/role.js";

export class RolesClient {
  constructor(private readonly http: AuthedHttp) {}

  list(): Promise<Role[]> {
    return this.http.get<Role[]>("/api/roles");
  }

  create(input: RoleInput): Promise<Role> {
    return this.http.post<Role>("/api/roles", input);
  }

  update(id: string, input: RoleInput): Promise<Role> {
    return this.http.patch<Role>(`/api/roles/${encodeURIComponent(id)}`, input);
  }

  delete(id: string): Promise<void> {
    return this.http.del<void>(`/api/roles/${encodeURIComponent(id)}`);
  }

  /** The role's glyphh model grants. */
  modelGrants(roleId: string): Promise<ModelGrant[]> {
    return this.http.get<ModelGrant[]>(`/api/roles/${encodeURIComponent(roleId)}/models`);
  }

  /** Grant a model to the role (upsert by model slug). */
  setModelGrant(roleId: string, input: ModelGrantInput): Promise<ModelGrant> {
    return this.http.put<ModelGrant>(`/api/roles/${encodeURIComponent(roleId)}/models/${encodeURIComponent(input.modelSlug)}`, {
      tools: input.tools ?? null,
    });
  }

  /** Revoke a model from the role. */
  removeModelGrant(roleId: string, modelSlug: string): Promise<void> {
    return this.http.del<void>(`/api/roles/${encodeURIComponent(roleId)}/models/${encodeURIComponent(modelSlug)}`);
  }

  /** The role's members (a member can hold several roles). */
  members(roleId: string): Promise<RoleMember[]> {
    return this.http.get<RoleMember[]>(`/api/roles/${encodeURIComponent(roleId)}/members`);
  }

  /** Add an org member to the role. */
  addMember(roleId: string, userId: string): Promise<void> {
    return this.http.put<void>(`/api/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(userId)}`);
  }

  /** Remove a member from the role. */
  removeMember(roleId: string, userId: string): Promise<void> {
    return this.http.del<void>(`/api/roles/${encodeURIComponent(roleId)}/members/${encodeURIComponent(userId)}`);
  }

  // ── the org's installed models (the catalog roles grant FROM) ──────────────

  /** Installed models + the allow-custom policy. */
  orgModels(): Promise<OrgModels> {
    return this.http.get<OrgModels>("/api/org/models");
  }

  /** Install (or update) a model in the org's catalog (org_admin). */
  installModel(slug: string, input: InstallModelInput = {}): Promise<InstalledModel> {
    return this.http.put<InstalledModel>(`/api/org/models/${encodeURIComponent(slug)}`, input);
  }

  /** Uninstall a model — its role grants are revoked with it (org_admin). */
  uninstallModel(slug: string): Promise<void> {
    return this.http.del<void>(`/api/org/models/${encodeURIComponent(slug)}`);
  }

  /** Allow or restrict CUSTOM models for this org (org_admin). */
  setModelsPolicy(allowCustom: boolean): Promise<{ allowCustom: boolean }> {
    return this.http.put<{ allowCustom: boolean }>("/api/org/models-policy", { allowCustom });
  }
}
