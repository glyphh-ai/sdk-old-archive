/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/marketplace.ts — marketplace DEVELOPER PROFILES + their reviews.
 * One profile per org OR per user; developers carry stars exactly like apps
 * (install-gated, one review per person, respond/report/moderate). App-side
 * marketplace listings themselves are the hub's (`client.libraryMarket`).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { LibraryListing, LibraryShareRequest } from "../contract/marketplace.js";


/**
 * The LIBRARY marketplace (skills + loops, his order 2026-09-02): browse,
 * free install (copies the snapshot into your library), the org admin's
 * share-approval queue, and the platform review desk.
 */
export class LibraryMarketClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Approved public listings (+ your org's shared items under `org`). */
  browse(kind?: "skill" | "loop"): Promise<{
    listings: LibraryListing[];
    org: Array<{ kind: "skill" | "loop"; slug: string; name: string; description: string }>;
  }> {
    return this.http.get(`/api/marketplace/library${kind ? `?kind=${kind}` : ""}`) as Promise<{
      listings: LibraryListing[];
      org: Array<{ kind: "skill" | "loop"; slug: string; name: string; description: string }>;
    }>;
  }

  /** Install FREE: copies the listing into your library as a personal item. */
  install(listingId: string): Promise<{ ok: boolean; kind: string; slug: string }> {
    return this.http.post<{ ok: boolean; kind: string; slug: string }>(
      `/api/marketplace/library/${encodeURIComponent(listingId)}/install`, {},
    );
  }

  /** Drop the seat — the copied item stays yours to keep or delete. */
  uninstall(listingId: string): Promise<void> {
    return this.http.del<void>(`/api/marketplace/library/${encodeURIComponent(listingId)}/install`);
  }

  /** ORG ADMIN: open share submissions awaiting a ruling. */
  pendingShares(): Promise<{ pending: LibraryShareRequest[] }> {
    return this.http.get<{ pending: LibraryShareRequest[] }>("/api/org/library/pending");
  }

  /** ORG ADMIN: rule on a share (approval flips the item org-wide). Self-review is refused. */
  reviewShare(id: string, action: "approve" | "reject"): Promise<void> {
    return this.http.post<void>(`/api/org/library/shares/${encodeURIComponent(id)}/review`, { action });
  }

  /** PLATFORM ADMIN: the review desk's queue, full content, oldest first. */
  reviewQueue(): Promise<{ queue: Array<LibraryListing & { prompt: string; code: string; submittedBy: string | null }> }> {
    return this.http.get("/api/admin/library/queue") as Promise<{ queue: Array<LibraryListing & { prompt: string; code: string; submittedBy: string | null }> }>;
  }

  /** PLATFORM ADMIN: rule on a listing. Approval lists it, free forever. */
  reviewListing(id: string, action: "begin" | "approve" | "reject", notes?: string): Promise<void> {
    return this.http.post<void>(`/api/admin/library/${encodeURIComponent(id)}/review`, { action, ...(notes ? { notes } : {}) });
  }
}
