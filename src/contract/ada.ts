/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/ada.ts — Ada memory types. The org → user scope comes from the caller's
 * auth, so inputs carry only the namespace (container) + payload, never an owner id.
 */

export interface AdaRememberInput {
  /** Memory namespace within the org→user scope — a session or project id. */
  container: string;
  content: string;
  metadata?: Record<string, unknown>;
}

export interface AdaRemembered {
  id: string;
  /** Token count of the stored content (what the encode meter bills against). */
  tokens: number;
}

export interface AdaRecallInput {
  container: string;
  query: string;
  /** Max results (default 5, server-capped). */
  k?: number;
}

export interface AdaRecallHit {
  id: string;
  content: string;
  /** Fused recall score (HDC content + structural overlap), higher = closer. */
  score: number;
}
