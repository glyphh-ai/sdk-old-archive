/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/members.ts — org membership + seats. Invite/remove/role are org_admin
 * actions (server-enforced); a seat-full invite surfaces as an entitlement error.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { CreatedInvite, Member, MemberRole, MemberSystemRole, MemberProfileUpdate } from "../contract/org.js";

export class MembersClient {
  constructor(private readonly http: AuthedHttp) {}

  list(): Promise<Member[]> {
    return this.http.get<Member[]>("/api/org/members");
  }

  invite(email: string, role: MemberRole = "user"): Promise<CreatedInvite> {
    return this.http.post<CreatedInvite>("/api/org/members/invite", { email, role });
  }

  remove(userId: string): Promise<void> {
    return this.http.del<void>(`/api/org/members/${encodeURIComponent(userId)}`);
  }

  /** Set a member's display name from a first/last pair (org_admin). */
  updateProfile(userId: string, patch: MemberProfileUpdate): Promise<Member> {
    return this.http.patch<Member>(`/api/org/members/${encodeURIComponent(userId)}`, patch);
  }

  /** Set a member's system role — user | admin | org_admin (org_admin). */
  setRole(userId: string, role: MemberSystemRole): Promise<Member> {
    return this.http.patch<Member>(`/api/org/members/${encodeURIComponent(userId)}/role`, { role });
  }

  }
