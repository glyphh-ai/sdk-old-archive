/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/releases.ts — the desktop builds and their downloads. A download URL
 * is signed and expires, so `releases url` asks for it fresh.
 */

import type { CommandRegistry } from "../registry.js";

export function registerReleases(reg: CommandRegistry): void {
  reg.register({
    path: "releases list",
    summary: "the desktop releases and their assets",
    covers: ["releases.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.releases.list());
    },
  });

  reg.register({
    path: "releases url",
    summary: "a signed, expiring download URL for one release asset",
    usage: "releases url <tag> <assetName>",
    covers: ["releases.assetUrl"],
    async run(ctx, args) {
      const [tag, name] = args.positional;
      if (!tag || !name) throw new Error("usage: releases url <tag> <assetName>");
      ctx.print((await ctx.client.releases.assetUrl(tag, name)).url);
    },
  });
}
