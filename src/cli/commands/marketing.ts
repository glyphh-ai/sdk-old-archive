/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/marketing.ts — trackable marketing links + click analytics (super_admin).
 * One command per SDK method; `covers` keeps the parity test honest.
 */

import type { CommandRegistry } from "../registry.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";

function flagNum(args: CliArgs, name: string): number | undefined {
  const v = flagStr(args, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function registerMarketing(reg: CommandRegistry): void {
  reg.register({
    path: "marketing links",
    summary: "list marketing links (super_admin)",
    usage: "marketing links [--q <search>] [--campaign <c>] [--page <n>] [--limit <n>]",
    covers: ["marketing.links"],
    async run(ctx, args) {
      ctx.printJson(await ctx.client.marketing.links({ q: flagStr(args, "q"), campaign: flagStr(args, "campaign"), page: flagNum(args, "page"), limit: flagNum(args, "limit") }));
    },
  });






  reg.register({
    path: "marketing link clicks",
    summary: "a link's raw click stream",
    usage: "marketing link clicks <id> [--page <n>] [--limit <n>]",
    covers: ["marketing.clicks"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: marketing link clicks <id> [--page ..] [--limit ..]");
      ctx.printJson(await ctx.client.marketing.clicks(id, flagNum(args, "page") ?? 1, flagNum(args, "limit") ?? 20));
    },
  });


  reg.register({
    path: "marketing stats",
    summary: "aggregate campaign overview",
    usage: "marketing stats [--campaign <c>] [--from <YYYY-MM-DD>] [--to <YYYY-MM-DD>]",
    covers: ["marketing.stats"],
    async run(ctx, args) {
      ctx.printJson(await ctx.client.marketing.stats({ campaign: flagStr(args, "campaign"), from: flagStr(args, "from"), to: flagStr(args, "to") }));
    },
  });
}
