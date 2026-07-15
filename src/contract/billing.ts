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
  monthlyCredits: number;
  maxSeats: number;
  sso: boolean;
}

export interface Subscription {
  tier: string;
  billingStatus: string; // trial | active | past_due | canceled | none
  seats: number;
  maxSeats: number;
}

export interface Balance {
  /** Whole credits remaining across non-expired lots. */
  credits: number;
}

/** A Stripe-hosted URL (Checkout or Customer Portal). */
export interface HostedUrl {
  url: string;
}
