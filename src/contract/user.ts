/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/user.ts — the SELF-PROFILE wire shapes. The caller's own editable
 * account view (name + timezone; email is identity and role is read-only). Distinct
 * from `Identity` (contract/auth.ts), which is the minimal authenticated principal.
 */

export interface SelfProfile {
  id: string;
  email: string;
  name: string | null;
  firstName: string;
  lastName: string;
  timezone: string;
  role: string;
}

/** The editable fields. `name` (when given) wins; otherwise first/last are joined. */
export interface SelfProfileUpdate {
  firstName?: string;
  lastName?: string;
  name?: string;
  timezone?: string;
}
