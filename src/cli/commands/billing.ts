/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/billing.ts — plans, subscription status, credit balance, and the Stripe
 * checkout/portal handoff (prints the URL to open).
 */

import type { CommandRegistry } from "../registry.js";

export function registerBilling(reg: CommandRegistry): void {
  reg.register({
    path: "billing plans",
    summary: "list plans (tier, price, monthly credits, seats)",
    covers: ["billing.plans"],
    async run(ctx) {
      ctx.printJson(await ctx.client.billing.plans());
    },
  });

  reg.register({
    path: "billing status",
    summary: "the org's subscription state",
    covers: ["billing.status"],
    async run(ctx) {
      ctx.printJson(await ctx.client.billing.status());
    },
  });

  reg.register({
    path: "billing balance",
    summary: "the org's credit balance",
    covers: ["billing.balance"],
    async run(ctx) {
      ctx.print(`${(await ctx.client.billing.balance()).credits} credits`);
    },
  });

  reg.register({
    path: "billing subscribe",
    summary: "start a checkout for a tier (prints the Stripe URL)",
    usage: "billing subscribe <basic|pro>",
    covers: ["billing.subscribe"],
    async run(ctx, args) {
      const tier = args.positional[0];
      if (!tier) throw new Error("usage: billing subscribe <basic|pro>");
      ctx.print((await ctx.client.billing.subscribe(tier)).url);
    },
  });

  reg.register({
    path: "billing portal",
    summary: "open the Stripe customer portal (prints the URL)",
    covers: ["billing.portal"],
    async run(ctx) {
      ctx.print((await ctx.client.billing.portal()).url);
    },
  });
}
