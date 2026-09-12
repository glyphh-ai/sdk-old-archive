/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * cli/commands/org-loops.ts — the ORG's loop support list.
 *
 * Which CLIs this org will run at all. It binds on every plan: this is the
 * org → user configuration, not something a tier buys. The ROLE layer that
 * narrows it further (and only on a governance plan) rides workspaces.
 */

import type { CommandRegistry } from "../registry.js";

export function registerOrgLoops(reg: CommandRegistry): void {
  reg.register({
    path: "org loops list",
    summary: "the org's loop support list, with each vendor's enabled state",
    covers: ["orgLoops.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.orgLoops.list());
    },
  });

  reg.register({
    path: "org loops set",
    summary: "enable or disable one loop for the org",
    usage: "org loops set <cli> <on|off>",
    covers: ["orgLoops.setEnabled"],
    async run(ctx, args) {
      const [cli, state] = args.positional;
      if (!cli || (state !== "on" && state !== "off")) {
        throw new Error("usage: org loops set <cli> <on|off>");
      }
      ctx.printJson(await ctx.client.orgLoops.setEnabled(cli, state === "on"));
    },
  });
}
