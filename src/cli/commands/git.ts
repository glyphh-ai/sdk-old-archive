/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/git.ts — link GitHub and list repos. `git connect` prints a URL to open;
 * once linked, `git repos` lists repositories and sessions created with a repo get a
 * scoped clone token injected server-side.
 */

import type { CommandRegistry } from "../registry.js";

export function registerGit(reg: CommandRegistry): void {
  reg.register({
    path: "git connect",
    summary: "link GitHub (prints a URL to open)",
    covers: ["git.connect"],
    async run(ctx) {
      ctx.printJson(await ctx.client.git.connect());
    },
  });

  reg.register({
    path: "git status",
    summary: "whether GitHub is linked, and as whom",
    covers: ["git.status"],
    async run(ctx) {
      ctx.printJson(await ctx.client.git.status());
    },
  });

  reg.register({
    path: "git repos",
    summary: "list the connected account's repositories",
    covers: ["git.repos"],
    async run(ctx) {
      ctx.printJson(await ctx.client.git.repos());
    },
  });

  reg.register({
    path: "git disconnect",
    summary: "unlink GitHub",
    covers: ["git.disconnect"],
    async run(ctx) {
      await ctx.client.git.disconnect();
      ctx.printJson({ disconnected: true });
    },
  });
}
