/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/catalog.ts — the provider/model catalog. Glyphh (super_admin) releases
 * providers + models + credit pricing; an org enables a subset and may attach a BYOK
 * key (write-only — never returned). Workspaces filter within the org's catalog.
 * Pricing is exposed as whole credits per 1M tokens.
 */

export type ProviderKind = "proxied" | "open_weight";

export interface Provider {
  slug: string; // "anthropic", "openai", "openweights"
  name: string;
  kind: ProviderKind;
  /** OpenAI-compatible base for this provider (e.g. a Gemini or Groq host).
   *  Null = the built-in default. One converter, many addresses. */
  baseUrl: string | null;
  /** Is this provider enabled for the caller's org. */
  enabledForOrg: boolean;
  /** Does the org have a BYOK key set (never the key itself). */
  hasByokKey: boolean;
}

export interface Model {
  id: string; // "anthropic::claude-opus-4-8"
  providerSlug: string;
  name: string;
  kind: ProviderKind;
  inputCreditsPerMTok: number;
  outputCreditsPerMTok: number;
  /** Total tokens the model accepts. Null = unrecorded, not enforced. */
  contextWindow: number | null;
  /** Largest single completion. Null = unrecorded. */
  maxOutputTokens: number | null;
  active: boolean;
}

/** org_admin: enable a provider for the org, optionally with a BYOK key (write-only). */
export interface EnableProviderInput {
  slug: string;
  key?: string;
}

/** super_admin: release a provider into the platform catalog. */
export interface ProviderCreate {
  /** Omit to keep the stored address; null clears it to the default. */
  baseUrl?: string | null;
  slug: string;
  name: string;
  kind: ProviderKind;
}

/** super_admin: release a model + its credit pricing. */
export interface ModelCreate {
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  id: string;
  providerSlug: string;
  name: string;
  kind: ProviderKind;
  inputCreditsPerMTok: number;
  outputCreditsPerMTok: number;
}

/** super_admin: update a model's pricing / availability. */
export interface ModelPricing {
  contextWindow?: number | null;
  maxOutputTokens?: number | null;
  inputCreditsPerMTok?: number;
  outputCreditsPerMTok?: number;
  active?: boolean;
}

// ── Hugging Face open-weight search (proxied server-side) ─────────────────────
/** A GGUF repo hit from HF search. */
export interface HfRepo {
  repo: string;
  downloads: number;
}
/** A curated open-weight recommendation (shown when the search box is empty). */
export interface HfRecommended {
  repo: string;
  displayName: string;
  description: string;
}
/** The hf-search result: raw repo hits + curated recommendations. */
export interface HfSearchResult {
  repos: HfRepo[];
  recommended: HfRecommended[];
}
/** One downloadable GGUF quant within a repo. */
export interface HfQuant {
  file: string;
  url: string;
  sizeBytes: number;
  sha256: string;
  contextTokens: number;
  minRamGb: number;
}
