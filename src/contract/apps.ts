/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/apps.ts — the apps MARKETPLACE. An app is a self-contained static bundle
 * (a built Vite project; deps bundled at build, host CSP forbids runtime CDNs) described
 * by an {@link AppManifest}. Publishers push a version to the registry; consumers browse
 * and install into their org/workspace. Hosting (deploy to `<slug>.glyphh.app`) is a
 * separate concern — see `contract/hosting.ts`.
 */

/** App visibility in the marketplace. */
export type AppVisibility = "public" | "org" | "unlisted";

/** The validated app spec (ported from glyphh-app-spec). */
export interface AppManifest {
  /** Marketplace id + hosting subdomain; kebab-case. */
  slug: string;
  name: string;
  /** Semver. */
  version: string;
  description?: string;
  /** Entry document within the bundle (default `index.html`). */
  entry?: string;
  /** Capabilities the app requests (host-governed). */
  permissions?: string[];
  /** First-class MCP connector tool ids the app calls. */
  connectors?: string[];
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
  /** Where the built static bundle lives (object-store ref/URL). */
  bundleUrl: string;
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
