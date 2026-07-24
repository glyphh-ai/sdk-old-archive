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

/** What an app IS: a URL you open, a program on your machine, or one you built. */
export type AppKind = "web" | "native" | "glyphh";

/** Kind-shaped launcher config — HOW the desktop opens the app, mirroring its form:
 *  web {browser, openAs} · native {archetype, windowMode, shell, profile, cwd,
 *  initCommands, args, folder} · glyphh {the bundle contract, plus the owner's
 *  mcpApproved + guardrails}. */
export type AppLauncherConfig = Record<string, unknown>;
export type AppSize = "small" | "medium" | "large";
export type AppAccess = "public" | "members";

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
  /** Connections the app calls, each with the identity it acts as. */
  connections?: { slug: string; actAs?: "org" | "invoker" }[];
  /** Secret NAMES only — values are set out of band, injected as env at deploy. */
  secrets?: string[];
  /** Custom hostnames, in addition to <slug>.glyphh.app. */
  domains?: string[];
  /** Optional second process from the same image (background work / agents). */
  processes?: { worker?: string };
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
  /** Credits if the app ran 24/7 for 30 days at its size — the ceiling, not a bill. */
  worstCaseMonthlyCredits: number;
  /** The marketplace listing record (media, rating, listed state). */
  listing: AppListingRecord;
  createdAt: string;
  updatedAt: string;
}

/** One config var KEY set on an app. Values are write-only and never returned. */
export interface AppSecretKey {
  key: string;
  updatedAt: string;
}

/** Create a web or native entry (hosted apps arrive via publish, not here). */
export interface CreateAppEntryInput {
  kind: "web" | "native" | "glyphh";
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
}

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

/** A marketplace listing (the latest published version of an app). */
export interface AppListing {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  publisherOrgId: string;
  visibility: AppVisibility;
  installs: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublishAppInput {
  manifest: AppManifest;
  visibility?: AppVisibility;
}

/** An app installed into the caller's org. */
export interface InstalledApp {
  id: string;
  slug: string;
  name: string;
  version: string;
  installedAt: string;
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
  tagline: string | null;
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

/** The full marketplace detail for one app — listing media + markdown body +
 *  the connections it requires, with connected status for the caller's org. */
export interface AppMarketplaceDetail {
  slug: string;
  name: string;
  version: string;
  description: string | null;
  owned: boolean;
  installs: number;
  listing: AppListingRecord;
  requiredConnections: { slug: string; actAs: string; connected: boolean }[];
}
