/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/org.ts — the accounts wire shapes (orgs, members, invites). Pure types,
 * the single source of truth both the SDK and the control plane implement.
 */

export interface Address {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export interface BillingContact {
  name: string;
  email: string;
  phone?: string;
}

export interface Org {
  id: string;
  name: string;
  slug: string;
  tier: string;
  maxSeats: number;
  seatsUsed: number;
  address: Address | null;
  billingAddress: Address | null;
  billingSameAsAddress: boolean;
  billingContact: BillingContact | null;
  workosOrgId: string | null;
}

export interface OrgUpdate {
  name?: string;
  address?: Address | null;
  billingAddress?: Address | null;
  billingSameAsAddress?: boolean;
  billingContact?: BillingContact | null;
}

/**
 * Org-wide runtime guardrails (org_admin). All fields optional non-negative
 * integers; the runtime enforces them under its own floor (a policy only tightens).
 */
export interface GuardrailsPolicy {
  maxInputTokens?: number;
  maxOutputTokens?: number;
  windowSeconds?: number;
  windowTokens?: number;
  windowCalls?: number;
  maxConcurrent?: number;
}

/** The guardrails wire envelope — a policy, or null when the org set none. */
export interface Guardrails {
  guardrails_policy: GuardrailsPolicy | null;
}

export type MemberRole = "org_admin" | "user";

/** The system role a member may be SET to (org_admin is granted via invite, not here). */
export type MemberSystemRole = "org_admin" | "admin" | "user";

export interface Member {
  userId: string;
  email: string;
  name: string | null;
  role: string;
}

/** `members.updateProfile` — set a member's display name from a first/last pair. */
export interface MemberProfileUpdate {
  firstName?: string;
  lastName?: string;
}

export interface Invite {
  id: string;
  email: string;
  role: MemberRole;
  expiresAt: string;
  invitedBy: string | null;
}

/** `members.invite` returns the invite + the raw token (shown once). */
export interface CreatedInvite {
  invite: Invite;
  token: string;
}

/** `invites.peek(token)` — the unauthenticated accept-page view. */
export interface InvitePreview {
  email: string;
  orgName: string;
  role: MemberRole;
}
