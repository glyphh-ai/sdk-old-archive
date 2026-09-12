/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * cli/commands/loops.ts — LOOPS: the CLIs a member may drive.
 *
 * The former `loops` commands (a program library with role slots) are now
 * `tasks` — see commands/tasks.ts. This file is the governed CLI list.
 */

import type { CommandRegistry } from "../registry.js";

export function registerLoops(reg: CommandRegistry): void {
  reg.register({
    path: "loops list",
    summary: "the loops you may drive — the org's CLI list, narrowed by your role",
    covers: ["loops.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.loops.list());
    },
  });
}
