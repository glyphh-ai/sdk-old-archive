/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/apps.ts — the apps MARKETPLACE. Browse public + org apps, publish a built
 * static bundle (by manifest + bundle ref), and install into your org. Hosting a
 * published app lives on `client.hosting`.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { AppListing, InstalledApp, PublishAppInput, PanelApp,
  OrgApp, CreateAppEntryInput, UpdateAppEntryInput, AppVariant, AppRelease, AppAuditEntry, AppUsageDay, AppSecretKey,
} from "../contract/apps.js";

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

  // ── the Apps page: the org's own entries, all three kinds ────────────────────

  /** Every app the org owns or installed, with prod URL, variants, deploy state. */
  async mine(): Promise<OrgApp[]> {
    const { apps } = await this.http.get<{ apps: OrgApp[] }>("/api/apps/mine");
    return apps;
  }

  /** Add a web (url) or native (path/bundle id) entry. Hosted apps use publish. */
  createEntry(input: CreateAppEntryInput): Promise<{ id: string; slug: string }> {
    return this.http.post<{ id: string; slug: string }>("/api/apps/entries", input);
  }

  /** Edit a web/native entry (hosted fields change via publish, keeping the manifest true). */
  updateEntry(slug: string, patch: UpdateAppEntryInput): Promise<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`/api/apps/entries/${encodeURIComponent(slug)}`, patch);
  }

  /** Delete an app of any kind. Refused (409) while a live deployment exists. */
  removeEntry(slug: string): Promise<void> {
    return this.http.del<void>(`/api/apps/entries/${encodeURIComponent(slug)}`);
  }

  // ── variants: extra slug → url addresses (`crm-dev` → localhost:3001) ───────

  addVariant(appSlug: string, input: { slug: string; label?: string; url: string }): Promise<AppVariant> {
    return this.http.post<AppVariant>(`/api/apps/${encodeURIComponent(appSlug)}/variants`, input);
  }

  updateVariant(appSlug: string, id: string, patch: { label?: string; url?: string }): Promise<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(
      `/api/apps/${encodeURIComponent(appSlug)}/variants/${encodeURIComponent(id)}`, patch,
    );
  }

  removeVariant(appSlug: string, id: string): Promise<void> {
    return this.http.del<void>(`/api/apps/${encodeURIComponent(appSlug)}/variants/${encodeURIComponent(id)}`);
  }

  // ── releases: the build side of a hosted app ────────────────────────────────

  /** An app's builds, newest first (owner only). */
  async releases(slug: string): Promise<AppRelease[]> {
    const { releases } = await this.http.get<{ releases: AppRelease[] }>(
      `/api/apps/${encodeURIComponent(slug)}/releases`,
    );
    return releases;
  }

  /** Graduate to a standalone, Supabase-backed repo — the download as a zip
   *  (app source + Supabase runtime shim + migrations + README). "Own your code." */
  async export(slug: string): Promise<ArrayBuffer> {
    return this.http.getBytes(`/api/apps/${encodeURIComponent(slug)}/export`);
  }

  /** The app's built source archive as a zip (the files the newest release was
   *  built from). Powers the desktop .glyphh export and "keep a copy" flows. */
  async source(slug: string): Promise<ArrayBuffer> {
    return this.http.getBytes(`/api/apps/${encodeURIComponent(slug)}/source`);
  }

  /** Open a release. It stays `pending` until source arrives — see uploadSource. */
  createRelease(slug: string, input: { version?: string } = {}): Promise<AppRelease> {
    return this.http.post<AppRelease>(`/api/apps/${encodeURIComponent(slug)}/releases`, input);
  }

  /** Upload the source archive for a release; the build runs and the returned release
   *  is `ready` (with an image) or `failed` (with the compiler message). */
  uploadSource(slug: string, releaseId: string, archive: Uint8Array): Promise<AppRelease> {
    return this.http.put<AppRelease>(
      `/api/apps/${encodeURIComponent(slug)}/releases/${encodeURIComponent(releaseId)}/source`, archive,
    );
  }

  // ── observability: the card's usage trend + the Audit tab ───────────────────

  /** Daily credit burn attributable to one app (default 30 days). */
  async usage(slug: string, days = 30): Promise<AppUsageDay[]> {
    const { days: rows } = await this.http.get<{ days: AppUsageDay[] }>(
      `/api/apps/${encodeURIComponent(slug)}/usage?days=${days}`,
    );
    return rows;
  }

  /** The org-scoped app audit feed (app.* actions only). */
  audit(query: { page?: number; limit?: number } = {}): Promise<{ entries: AppAuditEntry[]; page: number; limit: number }> {
    const qs = new URLSearchParams();
    if (query.page) qs.set("page", String(query.page));
    if (query.limit) qs.set("limit", String(query.limit));
    const q = qs.toString();
    return this.http.get<{ entries: AppAuditEntry[]; page: number; limit: number }>(`/api/apps/audit${q ? `?${q}` : ""}`);
  }

  // ── config vars: write-only per-app secrets ─────────────────────────────────

  /** The KEYS set on an app — values are never returned by any read path. */
  async secrets(slug: string): Promise<AppSecretKey[]> {
    const { keys } = await this.http.get<{ keys: AppSecretKey[] }>(`/api/apps/${encodeURIComponent(slug)}/secrets`);
    return keys;
  }

  /** Set or overwrite one config var (UPPER_SNAKE_CASE). Encrypted at rest,
   *  injected as env at deploy. */
  setSecret(slug: string, key: string, value: string): Promise<{ ok: boolean; key: string }> {
    return this.http.put<{ ok: boolean; key: string }>(
      `/api/apps/${encodeURIComponent(slug)}/secrets/${encodeURIComponent(key)}`, { value },
    );
  }

  removeSecret(slug: string, key: string): Promise<void> {
    return this.http.del<void>(`/api/apps/${encodeURIComponent(slug)}/secrets/${encodeURIComponent(key)}`);
  }
}
