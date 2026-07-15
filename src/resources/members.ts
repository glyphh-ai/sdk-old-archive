/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/members.ts — org membership + seats. Invite/remove/role are org_admin
 * actions (server-enforced); a seat-full invite surfaces as an entitlement error.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { CreatedInvite, Member, MemberRole } from "../contract/org.js";

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

  setRole(userId: string, role: MemberRole): Promise<Member> {
    return this.http.patch<Member>(`/api/org/members/${encodeURIComponent(userId)}`, { role });
  }
}
