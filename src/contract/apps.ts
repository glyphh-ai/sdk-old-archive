/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/apps.ts — apps as OPENABLE ENTRIES. To a user an app is a thing they open;
 * three kinds share one list:
 *   hosted — a Next.js project Glyphh builds and hosts; prod URL = the live deployment
 *   web    — SaaS the user works in (Gmail, Notion); the url IS the app
 *   native — an OS-level app only the DESKTOP can launch (a path / bundle id)
 * Any app can carry VARIANTS — extra slug → url addresses (`crm-dev` → localhost:3001)
 * so a dev build is `.dip`-addressable exactly like prod. Dev vs prod is two addresses
 * on one app, never two apps.
 */

/** App visibility in the marketplace. */
export type AppVisibility = "public" | "org" | "unlisted";

/** What an app IS: a URL you open, a program on your machine, one you built, or a
 *  desktop WORK PANEL (installs locally on the user's machine — never hosted). */
export type AppKind = "web" | "native" | "glyphh" | "workpanel";

/** Kind-shaped launcher config — HOW the desktop opens the app, mirroring its form:
 *  web {browser, openAs} · native {archetype, windowMode, shell, profile, cwd,
 *  initCommands, args, folder} · glyphh {the bundle contract, plus the owner's
 *  mcpApproved + guardrails}. */
export type AppLauncherConfig = Record<string, unknown>;
export type AppSize = "small" | "medium" | "large";
export type AppAccess = "public" | "members" | "org-idp";

/** WHERE an app's worker + schedules run (app-runtime-spec, "Distribution and
 *  execution home"): exactly ONE execution home per (org, app) — `local` is a
 *  desktop rrotor, `regional` the org's regional rrotor pod. Panels render
 *  anywhere; only the headless side has a home. Defaults to `local` today. */
export type AppExecutionHome = "local" | "regional";

/** The v3 manifest a HOSTED app is published with. Zero infrastructure choices:
 *  Postgres + pgvector are provisioned for every app, so nothing declares them. */
export interface AppManifest {
  /** Marketplace id + hosting subdomain; kebab-case. */
  slug: string;
  name: string;
  /** Semver. */
  version: string;
  description?: string;
  /** The ONLY infrastructure knob; defaults to small. */
  size?: AppSize;
  /** Who may reach the running app; defaults to members. */
  access?: AppAccess;
  /** org-idp binding: the WorkOS Organization the app authenticates against (null clears). */
  workosOrgId?: string | null;
  /** Connections the app calls, each with the identity it acts as. */
  connections?: { slug: string; actAs?: "org" | "invoker" }[];
  /** Secret NAMES only — values are set out of band, injected as env at deploy. */
  secrets?: string[];
  /** Custom hostnames, in addition to <slug>.glyphh.app. */
  domains?: string[];
  /** Optional second process from the same image (background work / agents). */
  processes?: { worker?: string };
  /** The DECLARATIVE app schema (marketplace M8): tables/columns/indexes as
   *  data. The developer never writes SQL — the platform diffs releases and
   *  generates every DDL statement, per org, lazily. */
  schema?: AppSchemaDoc;
  /** Pinned per release; MUST increase whenever `schema` changes. */
  schemaVersion?: number;
}

// ── the declarative app schema (marketplace M8) ──────────────────────────────

/** The closed set of column types an app schema may declare. */
export type AppColumnType =
  | "text" | "integer" | "bigint" | "boolean" | "numeric" | "timestamptz" | "jsonb" | "uuid";

export interface AppSchemaColumn {
  /** lowercase snake_case, letter-first, ≤ 40 chars; reserved prefixes
   *  (pg_, gy_, glyphh_, grave_) refused. */
  name: string;
  type: AppColumnType;
  /** Defaults to true. Primary-key columns must declare false. */
  nullable?: boolean;
  /** Literals only — plus `now()` on timestamptz and `gen_random_uuid()` on uuid. */
  default?: string | number | boolean;
  primaryKey?: boolean;
}

export interface AppSchemaIndex {
  name: string;
  columns: string[];
  unique?: boolean;
}

/** FKs may only reference tables in the SAME document (the app's own schema),
 *  and must reference the target table's primary key. */
export interface AppSchemaForeignKey {
  columns: string[];
  references: { table: string; columns: string[] };
}

export interface AppSchemaTable {
  name: string;
  columns: AppSchemaColumn[];
  /** btree only. */
  indexes?: AppSchemaIndex[];
  foreignKeys?: AppSchemaForeignKey[];
}

/** The whole declared schema — ≤ 30 tables, ≤ 60 columns/table, ≤ 20 indexes/table. */
export interface AppSchemaDoc {
  tables: AppSchemaTable[];
}

/** One structured, parameterized query against the app's OWN schema — the seam
 *  panels/app tools use. No raw SQL: declared tables/columns only, bounded. */
// ── embeddings + graph planes (app-runtime spec, 2026-08-20) ────────────────
export interface AppEmbedItem { ref: string; content: string; kind?: string; meta?: Record<string, unknown> }
export interface AppEmbedHit { kind: string; ref: string; content: string; meta: Record<string, unknown>; score: number }
export interface AppGraphNode { id: string; kind?: string; props?: Record<string, unknown> }
export interface AppGraphEdge { src: string; dst: string; kind?: string; props?: Record<string, unknown> }
export interface AppGraphNeighbor { id: string; kind: string; props: Record<string, unknown>; depth: number }

export interface AppDataQuery {
  op: "select" | "insert" | "update" | "delete";
  table: string;
  /** Projection (select) / RETURNING list (mutations). Declared columns only. */
  columns?: string[];
  /** insert/update payload, keyed by declared column. */
  values?: Record<string, unknown>;
  /** Equality (`{col: v}`) or `{col: {op, value}}` with eq/neq/lt/lte/gt/gte/
   *  like/in. update/delete REQUIRE a where. */
  where?: Record<string, unknown>;
  orderBy?: { column: string; dir?: "asc" | "desc" };
  /** Select cap: 200 (default 50). */
  limit?: number;
  offset?: number;
}

export interface AppDataQueryResult {
  rows: unknown[];
  rowCount: number;
}

/** The org's app-data health — the exposed install status (marketplace M8). */
export interface AppDataStatus {
  /** The live release's pinned schema version; null when no live schema. */
  schemaVersion: number | null;
  /** What this org has actually been migrated to (0 = never provisioned). */
  appliedVersion: number;
  /** `disabled` = the last migration failed for THIS org (disable-never-delete). */
  status: "ready" | "disabled" | "unprovisioned";
  error: string | null;
  schemaName: string;
  updatedAt: string | null;
}

/** The pre-deletion JSON dump (data-API row shapes) an uninstall returns. */
export interface AppDataExport {
  slug: string;
  schemaVersion: number;
  exportedAt: string;
  tables: Record<string, unknown[]>;
}

/** What `uninstall(slug, { deleteData: true })` returns: export-first, then the
 *  whole app schema is graveyarded (reaped ~30 days later — never immediate). */
export interface UninstallAppResult {
  ok: boolean;
  dataDeleted: boolean;
  export: AppDataExport | null;
}

/** An extra slug → url address on one app (`crm-dev` → http://localhost:3001). */
export interface AppVariant {
  id: string;
  slug: string;
  label: string;
  url: string;
}

/** One card on the Apps page: the entry, its live prod URL, and its addresses. */
export interface OrgApp {
  id: string;
  slug: string;
  name: string;
  kind: AppKind;
  version: string;
  description: string | null;
  access: string;
  /** org-idp binding: the WorkOS Organization the app authenticates against, or null. */
  workosOrgId: string | null;
  size: string;
  /** web → its url; a BUILT app with a live deployment → its brand origin
   *  (https://&lt;slug&gt;.glyphh.app); native, or not deployed → null. */
  prodUrl: string | null;
  /** native only: the path / bundle id the desktop launches. */
  nativeRef: string | null;
  deployed: boolean;
  /** Kind-shaped launcher config (validated server-side per kind). */
  config: AppLauncherConfig;
  variants: AppVariant[];
  /** Manifest-declared connections, each flagged connected or still required. */
  requiredConnections: { slug: string; actAs: string; connected: boolean }[];
  /** True when the caller's org PUBLISHED this app — gates the publish-side UI.
   *  An installed (not owned) app is read-only: releases + connections only. */
  owned: boolean;
  /** The newest live release's version, or null. The desktop compares it to the
   *  installed version to offer an auto-update. */
  latestVersion: string | null;
  /** The ONE place this app's worker + schedules run. A desktop must NOT arm
   *  the app's cron or start its worker when this reads `regional`. */
  executionHome: AppExecutionHome;
  /** Credits if the app ran 24/7 for 30 days at its size — the ceiling, not a bill. */
  worstCaseMonthlyCredits: number;
  /** The marketplace listing record (media, rating, listed state). */
  listing: AppListingRecord;
  createdAt: string;
  updatedAt: string;
  /** Secret NAMES the manifest declares — what the app needs configured. */
  secretNames?: string[];
}

/** One config var KEY set on an app. Values are write-only and never returned. */
export interface AppSecretKey {
  key: string;
  updatedAt: string;
}

/** Create a web, native, or workpanel entry (hosted apps arrive via publish, not
 *  here). A workpanel requires `config.workbench` (its view) and forbids `url`. */
export interface CreateAppEntryInput {
  kind: AppKind;
  slug: string;
  name: string;
  url?: string;
  nativeRef?: string;
  description?: string;
  config?: AppLauncherConfig;
  /** Who may reach it once deployed. Omitted → `members`: a published app is
   *  private until its owner decides otherwise. */
  access?: AppAccess;
}

export interface UpdateAppEntryInput {
  name?: string;
  /** Rename the dev-facing slug (his order, 2026-09-02). The public address
   *  (public_slug) stays sticky, so a rename never moves a live URL. */
  slug?: string;
  url?: string;
  nativeRef?: string;
  description?: string;
  /** Replaces the whole config when present. */
  config?: AppLauncherConfig;
  /** Retype a LAUNCHER (web ↔ native). A built app's kind comes from its bundle
   *  and the server refuses to change it. */
  kind?: "web" | "native";
  /** Who may reach it once deployed — enforced at the edge on every request. */
  access?: AppAccess;
  /** org-idp binding: the WorkOS Organization (null clears). */
  workosOrgId?: string | null;
  /** Move the app's ONE execution home (worker + schedules) between the desktop
   *  (`local`) and the org's regional pod (`regional`). Panels are unaffected. */
  executionHome?: AppExecutionHome;
}

/** The marketplace review pipeline — every release starts `draft`; the owner
 *  submits; only a platform admin rules, and approval is what goes live. */
export type AppReleaseReviewStatus = "draft" | "submitted" | "in_review" | "approved" | "rejected";

/** One immutable build of a hosted app. */
export interface AppRelease {
  id: string;
  version: string;
  status: "pending" | "uploading" | "building" | "ready" | "failed";
  error: string | null;
  imageRef: string | null;
  createdAt: string;
  updatedAt: string;
  /** Release notes (markdown) — what changed, in the author's words. */
  notes: string | null;
  /** `dev` until promoted; `live` is what installers get. */
  channel: "dev" | "live";
  promotedAt: string | null;
  reviewStatus: AppReleaseReviewStatus;
  /** The reviewer's ruling — why a rejection happened. */
  reviewNotes: string | null;
  submittedAt: string | null;
  reviewedAt: string | null;
  /** The ORG approval ladder (app co-working): null until submitted to the
   *  org admins; approval lifts a private app into the org catalog. */
  orgReview?: "submitted" | "approved" | "rejected" | null;
  /** The declarative schema version this release pins (marketplace M8); null
   *  when the app declares no schema. */
  schemaVersion: number | null;
  /** sha-256 (hex) of the release's stored `.glyphh` bundle — recorded when the
   *  upload finalizes (app-runtime-spec, distribution); null until then. */
  bundleSha256: string | null;
  /** Actual stored bundle size in bytes; null until the bundle lands. */
  bundleSizeBytes: number | null;  /** The review agent's recommendations — present only after a platform admin
   *  sent them back with a rejection (the marketplace review policy). */
  reviewRecommendations?: { summary: string; items: Array<{ severity: string; area: string; note: string }>; author: string; createdAt: string } | null;
}

/**
 * A minted presigned bundle upload (app-runtime-spec, "Distribution and
 * execution home"): PUT the `.glyphh` bytes to `url` with exactly
 * `contentType`, then call finalize. `url` is null when the platform runs
 * without object storage (local/dev) — fall back to `uploadSource`.
 */
export interface AppBundleUploadTicket {
  url: string | null;
  /** The content type the presigned PUT is signed for — send exactly this. */
  contentType: string;
  /** The hard bundle cap (250MB) — bundles are code, never data. */
  maxBytes: number;
  release: AppRelease;
}

/** A minted presigned bundle download. `url` is null when the platform runs
 *  without object storage (local/dev) — fall back to `source()`. */
export interface AppBundleDownload {
  url: string | null;
  releaseId: string;
  version: string;
  /** Verify the fetched bytes against this before executing them. */
  sha256: string | null;
  sizeBytes: number | null;
}

/** One release waiting in the platform-admin review queue. */
/** One static-scan finding attached to a release (marketplace M5). */
export interface ReleaseScanFinding {
  id: string;
  scanner: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string | null;
  createdAt: string;
}

/** Finding counts by severity — what the review queue shows per release.
 *  A critical blocks approve unless the admin forces. */
export interface ScanFindingCounts {
  info: number;
  warn: number;
  critical: number;
}

export interface AppReviewQueueRelease extends AppRelease {
  appSlug: string;
  appName: string;
  publisherOrgId: string;
  findings: ScanFindingCounts;
}

/** One row of the org-scoped app audit feed. */
export interface AppAuditEntry {
  id: string;
  action: string;
  actorEmail: string | null;
  metadata: unknown;
  createdAt: string;
}

/** One day of an app's credit burn (micro-credits; 1 credit = 1e6). */
export interface AppUsageDay {
  day: string;
  creditsMicro: number;
}

/** Credits-only pricing on a listing: a monthly price + an optional discount window. */
export interface AppPricing {
  /** Whole credits per month; 0 = free. */
  monthlyCredits: number;
  discountPercent: number | null;
  discountStartsAt: string | null;
  discountEndsAt: string | null;
  /** What an installer pays TODAY — the discount applied when its window is open. */
  effectiveMonthlyCredits: number;
}

/** Set an owned app's pricing. `discountPercent: null` clears the whole discount. */
export interface UpdateAppPricingInput {
  monthlyCredits?: number;
  discountPercent?: number | null;
  discountStartsAt?: string | null;
  discountEndsAt?: string | null;
}

/** A marketplace listing (the latest published version of an app). */
export interface AppListing {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  publisherOrgId: string;
  visibility: AppVisibility;
  installs: number;
  kind: AppKind;
  /** A house row (builtin work panels): untouchable by any non-platform-admin path. */
  builtin: boolean;
  /** The platform kill switch: hidden from browse, uninstallable. */
  suspended: boolean;
  pricing: AppPricing;
  createdAt: string;
  updatedAt: string;
  hasIngest?: boolean;
}

export interface PublishAppInput {
  manifest: AppManifest;
  visibility?: AppVisibility;
}

/** An app installed into the caller's org. */
/** The subscription's health on an installed priced app (marketplace M4).
 *  Null for a free app (nothing to renew); `lapsed` means the org's access is
 *  gone until re-paid — clients gate on exactly this. */
export type AppEntitlementStatus = "active" | "canceled" | "lapsed";

export interface InstalledApp {
  id: string;
  slug: string;
  name: string;
  version: string;
  installedAt: string;
  entitlementStatus: AppEntitlementStatus | null;
  /** The org's app-data health (marketplace M8): null = no schema / never
   *  provisioned; `disabled` = this org's schema migration failed and the data
   *  surface refuses until a fixed release ships. */
  dataStatus: "ready" | "disabled" | null;
}

/**
 * A deployed panel app — the projection of a hosting deployment the dashboard's
 * "apps deployed" count reads (a live deployment carries its public `url`).
 */
export interface PanelApp {
  id: string;
  appSlug: string;
  url: string | null;
  status: "queued" | "building" | "live" | "error" | "destroyed";
  createdAt: string;
  updatedAt: string;
  system: boolean;
}

/** The marketplace listing — how an app is presented, distinct from what it is. */
export interface AppListingRecord {
  /** The storefront title (the app's name, editable). */
  title: string;
  tagline: string | null;
  /** Long-form markdown pitch. */
  body: string | null;
  category: string | null;
  iconUrl: string | null;
  screenshots: { url: string; caption: string }[];
  videoUrl: string | null;
  website: string | null;
  supportEmail: string | null;
  ratingAvg: number;
  ratingCount: number;
  /** Null until the app is listed publicly — listing is its own act. */
  listedAt: string | null;
}

export type AppCategory =
  | "productivity" | "communication" | "developer" | "ai"
  | "marketing" | "finance" | "design" | "data";

export interface UpdateListingInput {
  tagline?: string;
  category?: AppCategory;
  website?: string;
  supportEmail?: string;
}

export type AppMediaKind = "icon" | "screenshot" | "video";

export interface StoredAppMedia {
  key: string;
  contentType: string;
  bytes: number;
}

/** One installer's review. `ownerResponse` is the author's public reply — the only
 *  thing an author can do to a review besides report it for moderation. */
export interface AppReview {
  id: string;
  stars: number;
  body: string | null;
  version: string | null;
  status: "published" | "flagged" | "removed";
  authorName: string | null;
  ownerResponse: string | null;
  ownerRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A flagged review as the moderation queue sees it. */
export interface FlaggedAppReview extends AppReview {
  appSlug: string;
  reportReason: string | null;
  reportedAt: string | null;
}

/** One comment on a listing (threaded feedback, M3). A removed comment's body
 *  is withheld — it survives only as a thread anchor ("[removed]"). */
export interface AppComment {
  id: string;
  parentId: string | null;
  body: string | null;
  status: "published" | "flagged" | "removed";
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A top-level comment with its (one level of) replies, oldest reply first. */
export interface AppCommentThread extends AppComment {
  replies: AppComment[];
}

/** A flagged comment as the moderation queue sees it. */
export interface FlaggedAppComment extends AppComment {
  appSlug: string;
  reportReason: string | null;
  reportedAt: string | null;
}

/** The publisher's developer card, joined onto the marketplace detail
 *  ("Support by <developer>" — support falls to the developer, never Glyphh). */
export interface AppDeveloperCard {
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  supportEmail: string | null;
  ratingAvg: number;
  ratingCount: number;
}

/** The full marketplace detail for one app — listing media + markdown body +
 *  the connections it requires, with connected status for the caller's org. */
export interface AppMarketplaceDetail {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  owned: boolean;
  installs: number;
  kind: AppKind;
  builtin: boolean;
  suspended: boolean;
  pricing: AppPricing;
  /** The publisher's marketplace profile, when they have one. */
  developer: AppDeveloperCard | null;
  /** PLATFORM ADMINS ONLY: true when the app has an open malicious report.
   *  Absent for everyone else. */
  reported?: boolean;
  listing: AppListingRecord;
  requiredConnections: { slug: string; actAs: string; connected: boolean }[];
}

/** One app-level malicious report as the triage queue renders it. */
export interface AppReport {
  id: string;
  appSlug: string | null;
  appName: string | null;
  reason: string;
  detail: string | null;
  status: "open" | "reviewing" | "resolved" | "dismissed";
  createdAt: string;
  resolvedAt: string | null;
}
