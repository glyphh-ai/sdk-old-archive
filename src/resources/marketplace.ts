/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/marketplace.ts — marketplace DEVELOPER PROFILES + their reviews.
 * One profile per org OR per user; developers carry stars exactly like apps
 * (install-gated, one review per person, respond/report/moderate). App-side
 * marketplace operations (pricing, releases, reports) live on `client.apps`.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  MarketplaceDeveloper, CreateDeveloperInput, UpdateDeveloperInput,
  DeveloperReview, FlaggedDeveloperReview,
} from "../contract/marketplace.js";

export class MarketplaceClient {
  constructor(private readonly http: AuthedHttp) {}

  // ── developer profiles ─────────────────────────────────────────────────────

  /** Create YOUR developer profile — your personal one, or your org's. One each. */
  createDeveloper(input: CreateDeveloperInput): Promise<MarketplaceDeveloper> {
    return this.http.post<MarketplaceDeveloper>("/api/marketplace/developers", input);
  }

  /** The caller's own profiles (personal + org), either nullable. */
  myDevelopers(): Promise<{ personal: MarketplaceDeveloper | null; org: MarketplaceDeveloper | null }> {
    return this.http.get<{ personal: MarketplaceDeveloper | null; org: MarketplaceDeveloper | null }>(
      "/api/marketplace/developers/me",
    );
  }

  /** One profile by handle — the public read. */
  developer(handle: string): Promise<MarketplaceDeveloper> {
    return this.http.get<MarketplaceDeveloper>(`/api/marketplace/developers/${encodeURIComponent(handle)}`);
  }

  /** Edit an owned profile. The handle itself is immutable. */
  updateDeveloper(handle: string, patch: UpdateDeveloperInput): Promise<MarketplaceDeveloper> {
    return this.http.patch<MarketplaceDeveloper>(`/api/marketplace/developers/${encodeURIComponent(handle)}`, patch);
  }

  /** Upload the profile's avatar (PNG/JPEG/GIF/WebP, ≤0.5MB; sniffed server-side). */
  uploadDeveloperAvatar(handle: string, bytes: Uint8Array): Promise<{ key: string; contentType: string; bytes: number }> {
    return this.http.post<{ key: string; contentType: string; bytes: number }>(
      `/api/marketplace/developers/${encodeURIComponent(handle)}/avatar`, bytes,
    );
  }

  // ── developer reviews (mirroring app reviews) ──────────────────────────────

  /** A developer's reviews, newest first. */
  developerReviews(handle: string, query: { limit?: number; offset?: number } = {}): Promise<{ reviews: DeveloperReview[]; total: number }> {
    const qs = new URLSearchParams();
    if (query.limit) qs.set("limit", String(query.limit));
    if (query.offset) qs.set("offset", String(query.offset));
    const q = qs.toString();
    return this.http.get<{ reviews: DeveloperReview[]; total: number }>(
      `/api/marketplace/developers/${encodeURIComponent(handle)}/reviews${q ? `?${q}` : ""}`,
    );
  }

  /** Create or edit YOUR review of a developer. One per person; requires your org
   *  to run at least one of their apps. */
  reviewDeveloper(handle: string, input: { stars: number; body?: string }): Promise<DeveloperReview> {
    return this.http.put<DeveloperReview>(`/api/marketplace/developers/${encodeURIComponent(handle)}/reviews`, input);
  }

  /** Delete your own review of a developer. */
  removeDeveloperReview(handle: string): Promise<void> {
    return this.http.del<void>(`/api/marketplace/developers/${encodeURIComponent(handle)}/reviews`);
  }

  /** Reply publicly to a review of YOUR profile — the refutation path. */
  respondToDeveloperReview(handle: string, reviewId: string, response: string): Promise<DeveloperReview> {
    return this.http.post<DeveloperReview>(
      `/api/marketplace/developers/${encodeURIComponent(handle)}/reviews/${encodeURIComponent(reviewId)}/response`,
      { response },
    );
  }

  /** Flag a review of YOUR profile for platform moderation. It stays visible
   *  until a ruling. */
  reportDeveloperReview(handle: string, reviewId: string, reason: string): Promise<DeveloperReview> {
    return this.http.post<DeveloperReview>(
      `/api/marketplace/developers/${encodeURIComponent(handle)}/reviews/${encodeURIComponent(reviewId)}/report`,
      { reason },
    );
  }

  // ── moderation (platform admin) ────────────────────────────────────────────

  /** The flagged developer-review queue, newest report first. */
  async flaggedDeveloperReviews(): Promise<FlaggedDeveloperReview[]> {
    const { reviews } = await this.http.get<{ reviews: FlaggedDeveloperReview[] }>(
      "/api/admin/developer-reviews/flagged",
    );
    return reviews;
  }

  /** Settle a flagged developer review: restore it, or remove it from readers. */
  moderateDeveloperReview(reviewId: string, action: "restore" | "remove"): Promise<DeveloperReview> {
    return this.http.post<DeveloperReview>(
      `/api/admin/developer-reviews/${encodeURIComponent(reviewId)}/moderate`, { action },
    );
  }
}
