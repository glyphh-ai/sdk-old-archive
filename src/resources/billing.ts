/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/billing.ts — plans, the org's subscription, and the Stripe-hosted
 * checkout/portal handoff. Subscribe/portal are org_admin (server-enforced) and
 * require the server's Stripe config (else a not-found error). Flat plan prices
 * only — there is no credit surface.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Plan, Subscription, HostedUrl, PlanChange, Invoice, BillingConfig } from "../contract/billing.js";

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

  /** Start a Stripe Checkout for `tier` — returns the hosted URL to open. */
  subscribe(tier: string): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/subscribe", { tier });
  }

  /** Move the org's plan to `tier` (proration applied server-side); free orgs get a Checkout url. */
  changePlan(tier: string): Promise<PlanChange> {
    return this.http.post<PlanChange>("/api/billing/change-plan", { tier });
  }

  /** The public Stripe key for Embedded Checkout (null → hosted fallback). */
  config(): Promise<BillingConfig> {
    return this.http.get<BillingConfig>("/api/billing/config");
  }

  /** Recent Stripe invoices for the org. */
  invoices(): Promise<Invoice[]> {
    return this.http.get<Invoice[]>("/api/billing/invoices");
  }

  /** Open the Stripe Customer Portal (self-serve plan/payment management). */
  portal(): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/portal");
  }
}
