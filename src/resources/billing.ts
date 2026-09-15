/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/billing.ts — plans, the org's subscription + credit balance, and the
 * Stripe-hosted checkout/portal handoff. Subscribe/portal are org_admin (server-
 * enforced) and require the server's Stripe config (else a not-found error).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  Plan, Subscription, Balance, HostedUrl,
  CreditsBreakdown, AutotopupConfig, AutotopupInput, PlanChange, Invoice, TopupInput, TopupCheckout, BillingConfig,
} from "../contract/billing.js";

export class BillingClient {
  constructor(private readonly http: AuthedHttp) {}

  plans(): Promise<Plan[]> {
    return this.http.get<Plan[]>("/api/billing/plans");
  }

  status(): Promise<Subscription> {
    return this.http.get<Subscription>("/api/billing/status");
  }

  /** Force a reconcile from Stripe (self-heals a missed webhook) and return the
   *  refreshed subscription status. */
  reconcile(): Promise<Subscription> {
    return this.http.post<Subscription>("/api/billing/reconcile");
  }

  balance(): Promise<Balance> {
    return this.http.get<Balance>("/api/billing/balance");
  }

  /** The org's credit breakdown (balance/allowance/grants/purchases, micro-credits). */
  credits(): Promise<CreditsBreakdown> {
    return this.http.get<CreditsBreakdown>("/api/billing/credits");
  }

  /** Start a Stripe Checkout for `tier` — returns the hosted URL to open. */
  subscribe(tier: string): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/subscribe", { tier });
  }

  /** Move the org's plan to `tier` (proration applied server-side); free orgs get a Checkout url. */
  changePlan(tier: string): Promise<PlanChange> {
    return this.http.post<PlanChange>("/api/billing/change-plan", { tier });
  }

  /** Buy a credit top-up — returns the hosted Checkout URL to open. `credits` is micro-credits. */
  topup(input: TopupInput): Promise<TopupCheckout> {
    return this.http.post<TopupCheckout>("/api/billing/topup", input);
  }

  /** The public Stripe key for Embedded Checkout (null → hosted fallback). */
  config(): Promise<BillingConfig> {
    return this.http.get<BillingConfig>("/api/billing/config");
  }

  /** Read the org's auto-top-up rule. */
  autotopup(): Promise<AutotopupConfig> {
    return this.http.get<AutotopupConfig>("/api/billing/autotopup");
  }

  /** Configure the org's auto-top-up rule (upsert). */
  setAutotopup(input: AutotopupInput): Promise<AutotopupConfig> {
    return this.http.post<AutotopupConfig>("/api/billing/autotopup", input);
  }

  /** Recent Stripe invoices for the org. */
  invoices(): Promise<Invoice[]> {
    return this.http.get<Invoice[]>("/api/billing/invoices");
  }

  /** The org's card on file (brand + last4), or null when none is saved. */
  paymentMethod(): Promise<{ brand: string; last4: string; expMonth: number; expYear: number } | null> {
    return this.http.get<{ card: { brand: string; last4: string; expMonth: number; expYear: number } | null }>("/api/billing/payment-method").then((r) => r.card);
  }

  /** Open the Stripe Customer Portal (self-serve plan/payment management). */
  portal(): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/portal");
  }
}
