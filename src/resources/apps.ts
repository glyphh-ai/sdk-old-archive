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
  UpdateListingInput, AppMediaKind, StoredAppMedia, AppReview, FlaggedAppReview,
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

  /** Edit a release's NOTES — the only mutable field on an immutable build. */
  updateReleaseNotes(slug: string, releaseId: string, notes: string | null): Promise<AppRelease> {
    return this.http.patch<AppRelease>(
      `/api/apps/${encodeURIComponent(slug)}/releases/${encodeURIComponent(releaseId)}`, { notes },
    );
  }

  /** Promote a built release to `live` — the version installers get. Rolling back is
   *  promoting an older release again; nothing is ever rebuilt. */
  promoteRelease(slug: string, releaseId: string): Promise<AppRelease> {
    return this.http.post<AppRelease>(
      `/api/apps/${encodeURIComponent(slug)}/releases/${encodeURIComponent(releaseId)}/promote`, {},
    );
  }

  // ── listing: the marketing record ──────────────────────────────────────────

  /** Edit the listing (tagline, category, website, support email). */
  updateListing(slug: string, patch: UpdateListingInput): Promise<{ ok: boolean }> {
    return this.http.patch<{ ok: boolean }>(`/api/apps/${encodeURIComponent(slug)}/listing`, patch);
  }

  /** Upload an icon, screenshot, or video. The server sniffs the real content type
   *  and refuses anything it will not serve. */
  uploadMedia(slug: string, kind: AppMediaKind, bytes: Uint8Array, caption?: string): Promise<StoredAppMedia> {
    const qs = new URLSearchParams({ kind });
    if (caption) qs.set("caption", caption);
    return this.http.post<StoredAppMedia>(`/api/apps/${encodeURIComponent(slug)}/media?${qs}`, bytes);
  }

  /** Detach media from the listing. The stored object is left in place. */
  removeMedia(slug: string, key: string): Promise<void> {
    return this.http.del<void>(`/api/apps/${encodeURIComponent(slug)}/media/${encodeURIComponent(key)}`);
  }

  /** List on the marketplace. Refused until the app has a tagline, category, icon. */
  list(slug: string): Promise<{ ok: boolean; listed: boolean }> {
    return this.http.post<{ ok: boolean; listed: boolean }>(`/api/apps/${encodeURIComponent(slug)}/list`, {});
  }

  /** Unlist. Existing installs keep working — this withdraws the card, not the app. */
  unlist(slug: string): Promise<{ ok: boolean; listed: boolean }> {
    return this.http.del<{ ok: boolean; listed: boolean }>(`/api/apps/${encodeURIComponent(slug)}/list`);
  }

  // ── reviews ────────────────────────────────────────────────────────────────

  /** An app's reviews, newest first. */
  reviews(slug: string, query: { limit?: number; offset?: number } = {}): Promise<{ reviews: AppReview[]; total: number }> {
    const qs = new URLSearchParams();
    if (query.limit) qs.set("limit", String(query.limit));
    if (query.offset) qs.set("offset", String(query.offset));
    const q = qs.toString();
    return this.http.get<{ reviews: AppReview[]; total: number }>(
      `/api/apps/${encodeURIComponent(slug)}/reviews${q ? `?${q}` : ""}`,
    );
  }

  /** Create or edit YOUR review. One per person: writing again edits what is there. */
  review(slug: string, input: { stars: number; body?: string }): Promise<AppReview> {
    return this.http.put<AppReview>(`/api/apps/${encodeURIComponent(slug)}/reviews`, input);
  }

  /** Delete your own review. */
  removeReview(slug: string): Promise<void> {
    return this.http.del<void>(`/api/apps/${encodeURIComponent(slug)}/reviews`);
  }

  /** Reply publicly to a review of an app you publish. */
  respondToReview(slug: string, reviewId: string, response: string): Promise<AppReview> {
    return this.http.post<AppReview>(
      `/api/apps/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/response`, { response },
    );
  }

  /** Flag a review for platform moderation. It stays visible until a ruling. */
  reportReview(slug: string, reviewId: string, reason: string): Promise<AppReview> {
    return this.http.post<AppReview>(
      `/api/apps/${encodeURIComponent(slug)}/reviews/${encodeURIComponent(reviewId)}/report`, { reason },
    );
  }

  // ── moderation (platform admin) ────────────────────────────────────────────

  /** The flagged-review queue, oldest report first. */
  async flaggedReviews(): Promise<FlaggedAppReview[]> {
    const { reviews } = await this.http.get<{ reviews: FlaggedAppReview[] }>("/api/admin/reviews/flagged");
    return reviews;
  }

  /** Settle a flagged review: restore it, or remove it from readers. */
  moderateReview(reviewId: string, action: "restore" | "remove"): Promise<AppReview> {
    return this.http.post<AppReview>(`/api/admin/reviews/${encodeURIComponent(reviewId)}/moderate`, { action });
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
