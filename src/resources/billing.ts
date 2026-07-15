/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/billing.ts — plans, the org's subscription + credit balance, and the
 * Stripe-hosted checkout/portal handoff. Subscribe/portal are org_admin (server-
 * enforced) and require the server's Stripe config (else a not-found error).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Plan, Subscription, Balance, HostedUrl } from "../contract/billing.js";

export class BillingClient {
  constructor(private readonly http: AuthedHttp) {}

  plans(): Promise<Plan[]> {
    return this.http.get<Plan[]>("/api/billing/plans");
  }

  status(): Promise<Subscription> {
    return this.http.get<Subscription>("/api/billing/status");
  }

  balance(): Promise<Balance> {
    return this.http.get<Balance>("/api/billing/balance");
  }

  /** Start a Stripe Checkout for `tier` — returns the hosted URL to open. */
  subscribe(tier: string): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/subscribe", { tier });
  }

  /** Open the Stripe Customer Portal (self-serve plan/payment management). */
  portal(): Promise<HostedUrl> {
    return this.http.post<HostedUrl>("/api/billing/portal");
  }
}
