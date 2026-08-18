/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/marketplace.ts — marketplace DEVELOPER PROFILES + their reviews. One
 * profile per org OR per user (the apps publisher XOR, mirrored): a handle, a
 * display name, an avatar, links, a support contact — and stars, because
 * developers are rated exactly like apps.
 */

export type DeveloperScope = "org" | "personal";

/** A developer profile as the marketplace renders it. */
export interface MarketplaceDeveloper {
  handle: string;
  displayName: string;
  scope: DeveloperScope;
  avatarUrl: string | null;
  bio: string | null;
  website: string | null;
  links: Record<string, string>;
  supportEmail: string | null;
  /** The profile's own DIRECT stars (developer reviews). */
  ratingAvg: number;
  ratingCount: number;
  /** The COMPUTED across-their-apps rollup, shown beside the direct rating. */
  apps: { ratingAvg: number; ratingCount: number; count: number };
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeveloperInput {
  scope: DeveloperScope;
  /** Kebab-case, globally unique, immutable once created. */
  handle: string;
  displayName: string;
  bio?: string;
  website?: string;
  links?: Record<string, string>;
  supportEmail?: string;
}

export interface UpdateDeveloperInput {
  displayName?: string;
  bio?: string | null;
  website?: string | null;
  links?: Record<string, string>;
  supportEmail?: string | null;
}

/** One review of a developer — the AppReview shape, mirrored. */
export interface DeveloperReview {
  id: string;
  stars: number;
  body: string | null;
  status: "published" | "flagged" | "removed";
  authorName: string | null;
  ownerResponse: string | null;
  ownerRespondedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** A flagged developer review as the moderation queue sees it. */
export interface FlaggedDeveloperReview extends DeveloperReview {
  developerHandle: string;
  reportReason: string | null;
  reportedAt: string | null;
}
