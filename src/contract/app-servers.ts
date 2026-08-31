/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/app-servers.ts — the last-mile DEDICATED app-server surface. A published app
 * can be deployed to its OWN Fly machine (sized by an app-server IMAGE SKU) with its own
 * dedicated Postgres, then reached on a CUSTOM DOMAIN. The catalog mirrors the runtime
 * images (per region; whole credits/month, micro-credit metering rate). Custom domains
 * ride Cloudflare for SaaS: Cloudflare mints the cert, and the API hands back the exact
 * DNS records the customer must publish to point their domain at the app.
 */

// ── the app-server IMAGE catalog (sm / md / lg) ────────────────────────────────

/** A catalog app-server image (one region's row for a SKU key). */
export interface AppServerImage {
  key: string;
  region: string;
  /** Buyer-facing copy for the size picker. */
  description: string;
  /** The dedicated-Postgres tier backing the server. */
  dbTier: string;
  ramMb: number;
  diskGb: number;
  /** Recurring rental in WHOLE credits per month. */
  monthlyCredits: number;
  /** Metering rate in MICRO-credits per second of runtime. */
  costPerSecondMicro: number;
  /** Cost basis in USD cents/month (admin margin input). */
  monthlyUsdCents: number;
  active: boolean;
  sort: number;
}

/** Super-admin create input. `monthlyCredits` is WHOLE credits/month. */
export interface AdminAppServerImageCreate {
  key: string;
  region: string;
  description: string;
  dbTier: string;
  ramMb: number;
  diskGb: number;
  monthlyCredits: number;
  costPerSecondMicro: number;
  monthlyUsdCents?: number;
  active?: boolean;
  sort?: number;
}

/** Super-admin edit input (all optional; omitted fields keep their value). */
export interface AdminAppServerImageUpdate {
  description?: string;
  dbTier?: string;
  ramMb?: number;
  diskGb?: number;
  monthlyCredits?: number;
  costPerSecondMicro?: number;
  monthlyUsdCents?: number;
  active?: boolean;
  sort?: number;
}

// ── deploying an app to a dedicated server ─────────────────────────────────────

export type ServerDeployStatus =
  | "queued" | "building" | "starting" | "live" | "stopped" | "error" | "destroyed";

/** One app-server deployment. Infra internals (machine id, DB refs) are never exposed. */
export interface ServerDeployment {
  id: string;
  appId: string;
  releaseId: string;
  imageKey: string;
  region: string;
  status: ServerDeployStatus;
  /** The dedicated origin once live; null before. */
  url: string | null;
  error: string | null;
  readyAt: string | null;
  provisionMs: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DeployToServerInput {
  /** The app-server image SKU (sm/md/lg) in the org's region. */
  imageKey: string;
  /** Deploy a specific build. Omitted → the newest ready release. */
  releaseId?: string;
}

/** The immediate answer to a deploy request: the queue handle to poll. */
export interface QueuedServerDeployment {
  deploymentId: string;
  status: "queued";
}

// ── custom domains ─────────────────────────────────────────────────────────────

export type CustomDomainStatus = "pending" | "verifying" | "active" | "error" | "removed";

/** One DNS record the customer must publish. */
export interface DnsRecord {
  type: "CNAME" | "A" | "AAAA" | "TXT";
  name: string;
  value: string;
}

/** The concrete records that point a hostname at the app + prove ownership. */
export interface DnsInstructions {
  hostname: string;
  isApex: boolean;
  records: DnsRecord[];
  /** Apex was requested but no anycast IPs are configured → use a subdomain. */
  apexUnsupported: boolean;
}

/** A custom domain bound to a dedicated app-server deployment — or, with
 *  target='app' (deploymentId null), to the app's HOSTED deployment (P2). */
export interface CustomDomain {
  id: string;
  appId: string;
  deploymentId: string | null;
  /** 'app-server' | 'app'. */
  target: string;
  hostname: string;
  status: CustomDomainStatus;
  /** Raw Cloudflare ownership/cert detail (debug). */
  verification: Record<string, unknown> | null;
  /** The records to publish (routing + ownership) — the "point your DNS here" surface. */
  dnsInstructions: DnsInstructions;
  error: string | null;
  verifiedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AddCustomDomainInput {
  /** The dedicated server to bind. OMIT to bind the domain to the APP's hosted
   *  deployment instead (target='app' — no server required). */
  deploymentId?: string;
  hostname: string;
}
