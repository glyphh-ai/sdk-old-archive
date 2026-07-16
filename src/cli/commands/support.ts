/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/support.ts — submit a support ticket. One command per SDK method.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerSupport(reg: CommandRegistry): void {
  reg.register({
    path: "support ticket",
    summary: "submit a support ticket",
    usage: "support ticket --subject <s> --description <s>",
    covers: ["support.ticket"],
    async run(ctx, args) {
      const subject = flagStr(args, "subject");
      const description = flagStr(args, "description");
      if (!subject || !description) throw new Error("usage: support ticket --subject <s> --description <s>");
      ctx.printJson(await ctx.client.support.ticket({ subject, description }));
    },
  });
}
