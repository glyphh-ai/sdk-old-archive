/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/billing.ts — plans, the org's subscription state, and its prepaid credit
 * balance. Credits are exposed as whole-credit numbers (the server keeps micro-credit
 * precision internally). Money is USD cents.
 */

export interface Plan {
  tier: string;
  displayName: string;
  monthlyUsdCents: number;
  /** The TRUE active Stripe price amount (cents) for this tier, when resolvable —
   *  falls back to monthlyUsdCents. Prefer this for display. */
  activeUsdCents?: number;
  monthlyCredits: number;
  maxSeats: number;
  sso: boolean;
  /** True for the caller org's own PROVISIONED per-org (enterprise) plan — a real invoiced
   *  price + allowance, shown as the current plan rather than the "contact sales" card. */
  bespoke?: boolean;
}

export interface Subscription {
  tier: string;
  billingStatus: string; // trial | active | past_due | canceled | none
  seats: number;
  maxSeats: number;
  /** The org's current RUNTIME IMAGE (§7b) + its recurring price in whole credits/mo —
   *  the data hook recurring image billing consumes. Null when the bound key resolves
   *  to no catalog row in the org's region. */
  runtimeImage?: { key: string; region: string; monthlyCredits: number } | null;
}

export interface Balance {
  /** Whole credits remaining across non-expired lots. */
  credits: number;
}

/** A Stripe-hosted URL (Checkout or Customer Portal). */
export interface HostedUrl {
  url: string;
}

/**
 * The org's credit balance broken down by lot kind, in MICRO-credits (1 credit = 1e6)
 * so the values compare directly against the auto-top-up threshold.
 *   balance   — every non-expired lot (grants + purchases + admin)
 *   allowance — the plan's per-seat monthly allowance
 *   grants    — the expiring subscription/free grant lots
 *   purchases — the non-expiring top-up lots
 */
export interface CreditsBreakdown {
  balance: number;
  allowance: number;
  grants: number;
  purchases: number;
}

/** The org's auto-top-up rule (micro-credits). */
export interface AutotopupConfig {
  enabled: boolean;
  thresholdCredits: number; // fire an auto-top-up at/below this balance (micro-credits)
  topupCredits: number; // micro-credits to purchase per fire
}

/** The input to configure auto-top-up. */
export interface AutotopupInput {
  enabled: boolean;
  thresholdCredits: number;
  topupCredits: number;
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

/** The input to buy a credit top-up (micro-credits). */
export interface TopupInput {
  credits: number;
}
