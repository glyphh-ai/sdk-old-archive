/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The public surface of @glyphh/client. This slice ships the control-plane (auth)
 * half; the rotor streaming transport (session/turn/reconnect) exports here next.
 */

export { createClient } from "./client.js";
export type { Client, ClientOptions, OpenSessionOptions } from "./client.js";

export { Session } from "./session/session.js";
export type { SessionConfig } from "./session/session.js";
export { SseTransport } from "./transport/sse-transport.js";
export type { Transport, TurnRequest } from "./transport/transport.js";
export type { Run, RunOptions } from "./transport/run.js";
export { WIRE_VERSION, isWireEvent } from "./protocol/events.js";
export type { WireEvent, WireEventKind, TurnEvent, LifecycleEvent, RunResult } from "./protocol/events.js";

export { AuthClient } from "./auth/auth-client.js";
export { InMemoryTokenStore } from "./auth/token-store.js";
export type { TokenStore } from "./auth/token-store.js";
export { sessionTokenProvider, staticTokenProvider } from "./auth/credential-provider.js";
export type { TokenProvider } from "./auth/credential-provider.js";

export {
  SdkError, ConnectError, ApiError, AuthError, ForbiddenError, ValidationError,
  ProtocolError, UnsupportedError, RUNTIME_ERROR_CODES,
} from "./core/errors.js";
export type { RuntimeErrorCode } from "./core/errors.js";
export { createLogger } from "./core/logger.js";
export type { Logger, LogSink, LogEntry, LogLevel, LogFields, LoggerOptions } from "./core/logger.js";

export type {
  Identity,
  IssuedSession,
  StoredSession,
  MagicLinkStart,
  OrgSsoStart,
  OrgSsoParams,
  AppleName,
} from "./contract/auth.js";

export { OrgClient } from "./resources/org.js";
export { MembersClient } from "./resources/members.js";
export { InvitesClient } from "./resources/invites.js";
export { WorkspacesClient } from "./resources/workspaces.js";
export type { Workspace, WorkspaceInput, EffectiveGrants, Grant } from "./contract/workspace.js";
export { BillingClient } from "./resources/billing.js";
export type { Plan, Subscription, Balance, HostedUrl } from "./contract/billing.js";
export type {
  Org,
  OrgUpdate,
  Address,
  BillingContact,
  Member,
  MemberRole,
  Invite,
  CreatedInvite,
  InvitePreview,
} from "./contract/org.js";
