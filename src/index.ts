/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The public surface of @glyphh/sdk — the control-plane client: auth, orgs,
 * plans (turn quotas), the MCP OAuth server surface, runtime image SKUs, and
 * usage accounting. Turns, memory, and generation live in the runtime.
 */

export { createClient } from "./client.js";
export type { Client, ClientOptions } from "./client.js";
export type { AuthedHttp } from "./core/authed-http.js";

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
export { createTtlCache } from "./core/cache.js";
export type { TtlCache, TtlCacheOptions } from "./core/cache.js";
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
  DeviceAuthStart,
  DevicePrompt,
  DevicePoll,
  DevicePollStatus,
  DeviceLoginOptions,
} from "./contract/auth.js";

export { OrgClient } from "./resources/org.js";
export { MembersClient } from "./resources/members.js";
export { MembershipsClient } from "./resources/memberships.js";
export type { Membership, EffectiveContext } from "./contract/membership.js";
export { InvitesClient } from "./resources/invites.js";
export { RolesClient } from "./resources/roles.js";
export type { Role, RoleInput, ModelGrant, ModelGrantInput, RoleMember, InstalledModel, OrgModels, InstallModelInput } from "./contract/role.js";
export { BillingClient } from "./resources/billing.js";
export type { Plan, Subscription, HostedUrl } from "./contract/billing.js";
export { RuntimeImagesClient } from "./resources/runtime-images.js";
export type {
  RuntimeImage, RuntimeImageType, OrgRuntimeImage,
  AdminRuntimeImageCreate, AdminRuntimeImageUpdate,
} from "./contract/runtime-images.js";
export { AdminClient } from "./resources/admin.js";
export type {
  AdminStats,
  AdminOrgListItem,
  AdminOrgsPage,
  AdminOrgMember,
  AdminOrgDetail,
  AdminOrgPatch,
  AdminUser,
  AdminUsersPage,
  AdminUserPatch,
  AdminPlan,
  AdminPlanUpdate,
  AdminPlanPrice,
  AuditEntry,
  AuditPage,
  AuditQuery,
  AdminUsageByUser,
  AdminUsageDay,
  AdminUsageByRuntime,
  AdminRuntimeUsageQuery,
  RuntimeMode,
  AdminDailyQuery,
  AdminListQuery,
} from "./contract/admin.js";
export { UsageClient } from "./resources/usage.js";
export type { UsageSummary, UsageDay, UsageDailyQuery, UsageByModelRow, UsageByModelQuery } from "./contract/usage.js";
export { ApiKeysClient } from "./resources/api-keys.js";
export type { ApiKey, ApiKeyInput, CreatedApiKey } from "./contract/api-keys.js";
export { ProfileClient } from "./resources/profile.js";
export { SupportClient } from "./resources/support.js";
export { OAuthClient } from "./resources/oauth.js";
export type {
  SupportTicketInput,
  SupportTicketAck,
  SupportTicketStatus,
  SupportUnread,
  SupportMessage,
  SupportTicket,
  SupportThread,
  SupportTicketCreate,
  AdminSupportMessage,
  AdminSupportTicket,
  AdminSupportThread,
  AdminSupportPage,
  AdminSupportQuery,
} from "./contract/support.js";
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
