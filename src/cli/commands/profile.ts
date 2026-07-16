/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/profile.ts — the caller's own profile (name + timezone). One command per
 * SDK method; `covers` keeps the parity test honest.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerProfile(reg: CommandRegistry): void {
  reg.register({
    path: "profile show",
    summary: "the caller's editable profile",
    covers: ["profile.get"],
    async run(ctx) {
      ctx.printJson(await ctx.client.profile.get());
    },
  });

  reg.register({
    path: "profile update",
    summary: "update your name and/or timezone",
    usage: "profile update [--firstName <s>] [--lastName <s>] [--name <s>] [--timezone <tz>]",
    covers: ["profile.update"],
    async run(ctx, args) {
      const patch: Record<string, string> = {};
      for (const k of ["firstName", "lastName", "name", "timezone"]) {
        const v = flagStr(args, k);
        if (v !== undefined) patch[k] = v;
      }
      if (Object.keys(patch).length === 0) throw new Error("usage: profile update [--firstName <s>] [--lastName <s>] [--name <s>] [--timezone <tz>]");
      ctx.printJson(await ctx.client.profile.update(patch));
    },
  });

  reg.register({
    path: "profile set-image",
    summary: "set (or clear) your avatar image URL",
    usage: "profile set-image <url|null>",
    covers: ["profile.update"],
    async run(ctx, args) {
      const url = args.positional[0];
      if (!url) throw new Error("usage: profile set-image <url|null>");
      ctx.printJson(await ctx.client.profile.update({ imageUrl: url === "null" ? null : url }));
    },
  });
}
