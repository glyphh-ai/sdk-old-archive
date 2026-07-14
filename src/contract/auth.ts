/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/auth.ts — the auth wire shapes, shared as the single source of truth for
 * the request/response bodies the control plane exposes. Pure types, zero runtime.
 */

/** What every auth method returns from the server: an opaque session pair. */
export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  /** Seconds until the access token expires. */
  expiresIn: number;
}

/** The client-held session, with an absolute expiry stamped on receipt. */
export interface StoredSession {
  accessToken: string;
  refreshToken: string;
  /** ms epoch when the access token expires. */
  expiresAt: number;
}

export interface MagicLinkStart {
  sent: boolean;
  expiresInSeconds: number;
  /** Present only in non-prod server builds, to test without a mailbox. */
  devToken?: string;
  devUrl?: string;
}

export interface OrgSsoStart {
  authorizationUrl: string;
}

export interface AppleName {
  givenName?: string | null;
  familyName?: string | null;
}

export interface OrgSsoParams {
  email?: string;
  organizationId?: string;
  redirectUri: string;
  machineId?: string;
}
