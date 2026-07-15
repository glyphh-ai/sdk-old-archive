/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/api-keys.ts — user-scoped API keys (`gy_ak_…`). A key authenticates headless
 * SDK/CLI use and the desktop relay as its owning user. Only the SHA-256 hash is
 * stored; the raw token is shown once. The platform lists keys by org → user.
 */

export interface ApiKey {
  id: string;
  label: string;
  /** A non-secret display prefix, e.g. "gy_ak_ab12…". The full token is never returned. */
  prefix: string;
  userId: string;
  userEmail: string;
  createdAt: string;
  expiresAt: string | null;
  lastUsedAt: string | null;
}

/** `apiKeys.create` returns the key metadata + the raw token (shown once). */
export interface CreatedApiKey {
  key: ApiKey;
  token: string;
}

export interface ApiKeyInput {
  label: string;
  /** Optional expiry; omit for a non-expiring key. */
  expiresInDays?: number;
}
