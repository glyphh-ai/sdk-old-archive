/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/marketplace.ts — marketplace DEVELOPER PROFILES + their reviews. One
 * profile per org OR per user (the apps publisher XOR, mirrored): a handle, a
 * display name, an avatar, links, a support contact — and stars, because
 * developers are rated exactly like apps.
 */







// ── the developer program + payout ledger (marketplace M7) ────────────────────









// ── Library marketplace (skills + loops, his order 2026-09-02) ───────────────

/** A skills/loops marketplace listing — a content snapshot frozen at publish,
 *  platform-reviewed like an app release. Always free to install. */
export interface LibraryListing {
  id: string;
  kind: "skill" | "loop";
  slug: string;
  name: string;
  description: string;
  manifest: Record<string, unknown>;
  reviewStatus: "submitted" | "in_review" | "approved" | "rejected";
  reviewNotes: string | null;
  submittedAt: string;
  listedAt: string | null;
  suspended: boolean;
  installs: number;
  /** Whether the CALLER holds an install seat. */
  installed: boolean;
}

/** An open org-share submission awaiting an org admin's ruling. */
export interface LibraryShareRequest {
  id: string;
  kind: "skill" | "loop";
  slug: string;
  name: string;
  requestedBy: string;
  submittedAt: string;
}
