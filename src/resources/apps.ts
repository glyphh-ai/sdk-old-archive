/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/apps.ts — the apps MARKETPLACE. Browse public + org apps, publish a built
 * static bundle (by manifest + bundle ref), and install into your org. Hosting a
 * published app lives on `client.hosting`.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { AppListing, InstalledApp, PublishAppInput, PanelApp } from "../contract/apps.js";

export class AppsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Browse the marketplace — public apps plus your org's own. */
  browse(): Promise<AppListing[]> {
    return this.http.get<AppListing[]>("/api/apps");
  }

  /** One listing by slug. */
  get(slug: string): Promise<AppListing> {
    return this.http.get<AppListing>(`/api/apps/${encodeURIComponent(slug)}`);
  }

  /** Publish (or republish a new version of) an app your org owns. */
  publish(input: PublishAppInput): Promise<AppListing> {
    return this.http.post<AppListing>("/api/apps", input);
  }

  /** Install an app into your org. */
  install(slug: string): Promise<InstalledApp> {
    return this.http.post<InstalledApp>(`/api/apps/${encodeURIComponent(slug)}/install`, {});
  }

  /** The apps installed in your org. */
  installed(): Promise<InstalledApp[]> {
    return this.http.get<InstalledApp[]>("/api/apps/installed");
  }

  /** Uninstall an app from your org. */
  uninstall(slug: string): Promise<void> {
    return this.http.del<void>(`/api/apps/${encodeURIComponent(slug)}/install`);
  }

  /** The caller's deployed panel apps (backs the dashboard's "apps deployed" count). */
  deployed(): Promise<PanelApp[]> {
    return this.http.get<PanelApp[]>("/api/panel-apps");
  }
}
