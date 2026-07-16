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
    path: "billing credits",
    summary: "the org's credit breakdown (balance/allowance/grants/purchases, micro-credits)",
    covers: ["billing.credits"],
    async run(ctx) {
      ctx.printJson(await ctx.client.billing.credits());
    },
  });

  reg.register({
    path: "billing invoices",
    summary: "recent Stripe invoices for the org",
    covers: ["billing.invoices"],
    async run(ctx) {
      ctx.printJson(await ctx.client.billing.invoices());
    },
  });

  reg.register({
    path: "billing change-plan",
    summary: "move the org's plan (proration applied); prints the change (or a Checkout URL)",
    usage: "billing change-plan <basic|pro>",
    covers: ["billing.changePlan"],
    async run(ctx, args) {
      const tier = args.positional[0];
      if (!tier) throw new Error("usage: billing change-plan <basic|pro>");
      ctx.printJson(await ctx.client.billing.changePlan(tier));
    },
  });

  reg.register({
    path: "billing topup",
    summary: "buy a credit top-up (micro-credits); prints the Stripe Checkout URL",
    usage: "billing topup <micro-credits>",
    covers: ["billing.topup"],
    async run(ctx, args) {
      const credits = Number(args.positional[0]);
      if (!Number.isFinite(credits) || credits <= 0) throw new Error("usage: billing topup <micro-credits>");
      ctx.print((await ctx.client.billing.topup({ credits })).url);
    },
  });

  reg.register({
    path: "billing autotopup",
    summary: "the org's auto-top-up rule",
    covers: ["billing.autotopup"],
    async run(ctx) {
      ctx.printJson(await ctx.client.billing.autotopup());
    },
  });

  reg.register({
    path: "billing autotopup set",
    summary: "configure auto-top-up (micro-credits)",
    usage: "billing autotopup set <on|off> <thresholdMicro> <topupMicro>",
    covers: ["billing.setAutotopup"],
    async run(ctx, args) {
      const [state, threshold, topup] = args.positional;
      if (!state || (state !== "on" && state !== "off")) throw new Error("usage: billing autotopup set <on|off> <thresholdMicro> <topupMicro>");
      const enabled = state === "on";
      const thresholdCredits = Number(threshold ?? 0);
      const topupCredits = Number(topup ?? 0);
      if (enabled && (!(thresholdCredits > 0) || !(topupCredits > 0))) {
        throw new Error("thresholdMicro and topupMicro must be positive when enabling");
      }
      ctx.printJson(await ctx.client.billing.setAutotopup({ enabled, thresholdCredits, topupCredits }));
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
