/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/usage.ts — usage rollups (credits consumed/saved) at the user, workspace,
 * and org level.
 */

import type { CommandRegistry } from "../registry.js";

export function registerUsage(reg: CommandRegistry): void {
  reg.register({
    path: "usage mine",
    summary: "your usage (credits consumed/saved)",
    covers: ["usage.mine"],
    async run(ctx) {
      ctx.printJson(await ctx.client.usage.mine());
    },
  });

  reg.register({
    path: "usage workspace",
    summary: "a workspace's usage rollup",
    usage: "usage workspace <workspaceId>",
    covers: ["usage.workspace"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: usage workspace <workspaceId>");
      ctx.printJson(await ctx.client.usage.workspace(id));
    },
  });

  reg.register({
    path: "usage org",
    summary: "the org usage rollup (org_admin)",
    covers: ["usage.org"],
    async run(ctx) {
      ctx.printJson(await ctx.client.usage.org());
    },
  });
}
