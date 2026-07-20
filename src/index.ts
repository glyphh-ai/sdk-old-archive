/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The public surface of @glyphh/client. This slice ships the control-plane (auth)
 * half; the rotor streaming transport (session/turn/reconnect) exports here next.
 */

export { createClient } from "./client.js";
export type { Client, ClientOptions, OpenSessionOptions } from "./client.js";
export type { AuthedHttp } from "./core/authed-http.js";

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
export { WorkspacesClient } from "./resources/workspaces.js";
export type { Workspace, WorkspaceInput, EffectiveGrants, Grant } from "./contract/workspace.js";
export { BillingClient } from "./resources/billing.js";
export type { Plan, Subscription, Balance, HostedUrl } from "./contract/billing.js";
export { CatalogClient } from "./resources/catalog.js";
export { ProvidersClient } from "./resources/providers.js";
export { AdminClient } from "./resources/admin.js";
export type {
  Provider,
  Model,
  ProviderKind,
  EnableProviderInput,
  ProviderCreate,
  ModelCreate,
  ModelPricing,
  HfRepo,
  HfRecommended,
  HfSearchResult,
  HfQuant,
} from "./contract/catalog.js";
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
  AdminModel,
  AdminModelUpdate,
  AdminPlanPrice,
  AuditEntry,
  AuditPage,
  AuditQuery,
  AdminUsageByUser,
  AdminUsageDay,
  AdminDailyQuery,
  AdminListQuery,
} from "./contract/admin.js";
export { MarketingClient } from "./resources/marketing.js";
export type {
  MarketingLink,
  MarketingClick,
  ClicksByDay,
  MarketingLinksPage,
  MarketingStats,
  CreateLinkInput,
  UpdateLinkInput,
  LinksQuery,
  MarketingStatsQuery,
} from "./contract/marketing.js";
export { LoopsClient } from "./resources/loops.js";
export type { Loop, LoopSummary, LoopManifest, LoopRole, ResolvedLoopRole, CreateLoopInput, UpdateLoopInput } from "./contract/loops.js";
export { ConnectionsClient } from "./resources/connections.js";
export type {
  Connection,
  ConnectionKind,
  CustomMcpInput,
  ConnectLink,
  ConnectorApp,
  ConnectorTool,
  ResolvedConnection,
  RunToolResult,
  PersonalConnection,
  PersonalConnectSession,
  OrgMcpConnection,
  OrgMcpInput,
  OrgMcpPatch,
  OrgMcpCreateResult,
  OrgPipedreamConnection,
  McpOAuthStart,
} from "./contract/connections.js";
export { UsageClient } from "./resources/usage.js";
export type { UsageSummary, UsageDay, UsageDailyQuery, UsageByModelRow, UsageByModelQuery } from "./contract/usage.js";
export { ApiKeysClient } from "./resources/api-keys.js";
export type { ApiKey, ApiKeyInput, CreatedApiKey } from "./contract/api-keys.js";
export { SessionsClient } from "./resources/sessions.js";
export type {
  RuntimeSession,
  CreateSessionInput,
  ProvisionedSession,
  SessionLocus,
  SessionStatus,
  ModelSwitchInput,
  ModelSwitchResult,
  ModelSwitchSurface,
} from "./contract/runtime.js";
export { GitClient } from "./resources/git.js";
export type { GitConnection, GitConnectLink, Repo } from "./contract/git.js";
export { AppsClient } from "./resources/apps.js";
export type {
  AppManifest,
  AppListing,
  AppVisibility,
  PublishAppInput,
  InstalledApp,
  AppKind,
  AppLauncherConfig,
  AppVariant,
  OrgApp,
  PanelApp,
  AppSecretKey,
  CreateAppEntryInput,
  UpdateAppEntryInput,
  AppRelease,
  AppUsageDay,
  AppAuditEntry,
} from "./contract/apps.js";
export { HostingClient } from "./resources/hosting.js";
export type { Deployment, DeployStatus, DeployInput } from "./contract/hosting.js";
export { LibraryClient } from "./resources/library.js";
export type { LibraryItem, LibraryKind, LibraryScope, SaveLibraryItemInput } from "./contract/library.js";
export { RelayClient } from "./resources/relay.js";
export type {
  RelayPolicy,
  RelayDevice,
  RelayDeviceStatus,
  RelayStatus,
  EnableRelayInput,
} from "./contract/relay.js";
export { RotorConfigClient } from "./resources/rotor-config.js";
export type { RotorRole, RotorCatalogEntry } from "./contract/rotors.js";
export { OrgModelsClient } from "./resources/org-models.js";
export { ModelsClient } from "./resources/models.js";
export { AgentsClient } from "./resources/agents.js";
export type {
  Agent,
  AgentSummary,
  AgentScope,
  AgentSelections,
  AgentTask,
  AgentTaskKind,
  LiveAgent,
  GuardrailsPolicy as AgentGuardrailsPolicy,
  CreateAgentInput,
  UpdateAgentInput,
  CreateAgentTaskInput,
  UpdateAgentTaskInput,
} from "./contract/agents.js";
export { SkillsClient } from "./resources/skills.js";
export type {
  Skill,
  SkillSummary,
  SkillManifest,
  SkillIO,
  CreateSkillInput,
  UpdateSkillInput,
} from "./contract/skills.js";
export { GatewayClient } from "./resources/gateway.js";
export type {
  GatewayMessage,
  GatewayCompletionInput,
  GatewayChoice,
  GatewayUsage,
  GatewayCompletion,
  MessageTool,
  MessageTurn,
  MessageTurnInput,
  ToolUse,
} from "./contract/gateway.js";
export type {
  OrgModel,
  AvailableModel,
  ModelSource,
  ModelAuditQuery,
  ModelAuditEntry,
  ModelAuditPage,
} from "./contract/models.js";
export type {
  ModelTransport,
  RoleBinding,
  RotorBinding,
  SetBindingInput,
  ResolvedModel,
  RotorRegistry,
} from "./contract/bindings.js";
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
  GuardrailsPolicy,
  Guardrails,
} from "./contract/org.js";
