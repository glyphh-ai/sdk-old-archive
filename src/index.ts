/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The public surface of @glyphh/client. This slice ships the control-plane (auth)
 * half; the rotor streaming transport (session/turn/reconnect) exports here next.
 */

export { createClient } from "./client.js";
export type { Client, ClientOptions } from "./client.js";

export { AuthClient } from "./auth/auth-client.js";
export { InMemoryTokenStore } from "./auth/token-store.js";
export type { TokenStore } from "./auth/token-store.js";
export { sessionTokenProvider, staticTokenProvider } from "./auth/credential-provider.js";
export type { TokenProvider } from "./auth/credential-provider.js";

export { SdkError, ConnectError, ApiError, AuthError, ForbiddenError, ValidationError } from "./core/errors.js";

export type {
  IssuedSession,
  StoredSession,
  MagicLinkStart,
  OrgSsoStart,
  OrgSsoParams,
  AppleName,
} from "./contract/auth.js";
