/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/connections.ts — connectors: list, install/remove a custom MCP server,
 * and get a Pipedream connect-link.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerConnections(reg: CommandRegistry): void {
  reg.register({
    path: "connections list",
    summary: "list the org's connections",
    covers: ["connections.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.connections.list());
    },
  });

  reg.register({
    path: "connections mcp add",
    summary: "install a custom MCP server (org_admin)",
    usage: "connections mcp add <slug> --name <name> --url <url> [--header 'K: V' ...]",
    covers: ["connections.installCustomMcp"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const name = flagStr(args, "name");
      const url = flagStr(args, "url");
      if (!slug || !name || !url) throw new Error("usage: connections mcp add <slug> --name <name> --url <url>");
      // --header may repeat via comma: "K1: V1,K2: V2"
      const headerFlag = flagStr(args, "header");
      const headers: Record<string, string> = {};
      if (headerFlag) {
        for (const pair of headerFlag.split(",")) {
          const idx = pair.indexOf(":");
          if (idx !== -1) headers[pair.slice(0, idx).trim()] = pair.slice(idx + 1).trim();
        }
      }
      ctx.printJson(await ctx.client.connections.installCustomMcp({ slug, name, url, ...(Object.keys(headers).length ? { headers } : {}) }));
    },
  });

  reg.register({
    path: "connections mcp remove",
    summary: "remove a custom MCP server",
    usage: "connections mcp remove <slug>",
    covers: ["connections.removeCustomMcp"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: connections mcp remove <slug>");
      await ctx.client.connections.removeCustomMcp(slug);
      ctx.print("removed ✓");
    },
  });

  reg.register({
    path: "connections pipedream",
    summary: "get a Pipedream connect-link (prints the URL)",
    covers: ["connections.pipedreamConnectLink"],
    async run(ctx) {
      ctx.print((await ctx.client.connections.pipedreamConnectLink()).url);
    },
  });
}
