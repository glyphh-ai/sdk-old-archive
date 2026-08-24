/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/billing.ts — plans and the org's subscription state. A plan is a flat
 * monthly price for a memory-quality tier: the generation model (the Anthropic
 * Fable → Haiku ladder), the embeddings model (a non-Anthropic vendor), a turn
 * quota per month, and a per-turn output-token cap. Counters enforce the quota;
 * they never bill — there are no credits anywhere. Money is USD cents.
 */

export interface Plan {
  tier: string;
  displayName: string;
  monthlyUsdCents: number;
  /** The TRUE active Stripe price amount (cents) for this tier, when resolvable —
   *  falls back to monthlyUsdCents. Prefer this for display. */
  activeUsdCents?: number;
  /** Provider-qualified generation model id ('vendor::model'). */
  model: string;
  /** Provider-qualified embeddings model id ('vendor::model'). */
  embeddingsModel: string;
  turnsPerMonth: number;
  outputTokensPerTurn: number;
  maxSeats: number;
  sso: boolean;
  /** May the org override the provider key (BYOK, org_settings) — enterprise only. */
  byok: boolean;
  /** True for the caller org's own PROVISIONED per-org (enterprise) plan — a real invoiced
   *  price, shown as the current plan rather than the "contact sales" card. */
  bespoke?: boolean;
}

export interface Subscription {
  tier: string;
  billingStatus: string; // trial | active | past_due | canceled | none
  seats: number;
  maxSeats: number;
  /** The org's current RUNTIME IMAGE + its recurring price (USD cents/mo). Null
   *  when the bound key resolves to no catalog row in the org's region. */
  runtimeImage?: { key: string; region: string; monthlyUsdCents: number } | null;
}

/** A Stripe-hosted URL (Checkout or Customer Portal). */
export interface HostedUrl {
  url: string;
}

/** The outcome of a change-plan call. */
export interface PlanChange {
  tier: string;
  billingStatus: string;
  /** 'upgrade' (invoiced now) | 'downgrade' (next renewal) | 'checkout' (free→paid). */
  effect: "upgrade" | "downgrade" | "checkout";
  /** Present only when effect === 'checkout': the hosted Checkout url to open. */
  url?: string;
}

/** One normalized Stripe invoice (money in USD cents; times in unix seconds). */
export interface Invoice {
  id: string;
  number: string | null;
  amountDue: number;
  amountPaid: number;
  status: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  created: number;
  periodStart: number | null;
  periodEnd: number | null;
}

/** Client-side billing config — the PUBLIC Stripe key (pk_*), or null when
 *  the server has none (clients then fall back to hosted checkout). */
export interface BillingConfig {
  publishableKey: string | null;
}
