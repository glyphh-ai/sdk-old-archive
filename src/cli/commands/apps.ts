/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/apps.ts — the apps marketplace + hosting. `apps publish` takes a manifest
 * JSON file + a bundle URL; `deploy` hosts a published app at <slug>.glyphh.app.
 */

import { readFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { AppManifest, AppVisibility, PublishAppInput } from "../../contract/apps.js";

export function registerApps(reg: CommandRegistry): void {
  reg.register({
    path: "apps browse",
    summary: "browse the marketplace (public + your org)",
    covers: ["apps.browse"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.browse());
    },
  });

  reg.register({
    path: "apps get",
    summary: "one marketplace listing by slug",
    usage: "apps get <slug>",
    covers: ["apps.get"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps get <slug>");
      ctx.printJson(await ctx.client.apps.get(slug));
    },
  });

  reg.register({
    path: "apps publish",
    summary: "publish an app (manifest file + bundle url)",
    usage: "apps publish --manifest <file.json> --bundle <url> [--visibility public|org|unlisted]",
    covers: ["apps.publish"],
    async run(ctx, args) {
      const manifestPath = flagStr(args, "manifest");
      const bundleUrl = flagStr(args, "bundle");
      if (!manifestPath || !bundleUrl) {
        throw new Error("usage: apps publish --manifest <file.json> --bundle <url>");
      }
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AppManifest;
      const input: PublishAppInput = { manifest, bundleUrl };
      const visibility = flagStr(args, "visibility");
      if (visibility) input.visibility = visibility as AppVisibility;
      ctx.printJson(await ctx.client.apps.publish(input));
    },
  });

  reg.register({
    path: "apps install",
    summary: "install an app into your org",
    usage: "apps install <slug>",
    covers: ["apps.install"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps install <slug>");
      ctx.printJson(await ctx.client.apps.install(slug));
    },
  });

  reg.register({
    path: "apps installed",
    summary: "apps installed in your org",
    covers: ["apps.installed"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.installed());
    },
  });

  reg.register({
    path: "apps uninstall",
    summary: "uninstall an app from your org",
    usage: "apps uninstall <slug>",
    covers: ["apps.uninstall"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps uninstall <slug>");
      await ctx.client.apps.uninstall(slug);
      ctx.printJson({ uninstalled: slug });
    },
  });

  // ── hosting ────────────────────────────────────────────────────────────────
  reg.register({
    path: "deploy",
    summary: "deploy a published app to <slug>.glyphh.app",
    usage: "deploy <appSlug>",
    covers: ["hosting.deploy"],
    async run(ctx, args) {
      const appSlug = args.positional[0];
      if (!appSlug) throw new Error("usage: deploy <appSlug>");
      ctx.printJson(await ctx.client.hosting.deploy({ appSlug }));
    },
  });

  reg.register({
    path: "hosting list",
    summary: "your org's deployments",
    covers: ["hosting.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.hosting.list());
    },
  });

  reg.register({
    path: "hosting status",
    summary: "a deployment's status by id",
    usage: "hosting status <id>",
    covers: ["hosting.status"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: hosting status <id>");
      ctx.printJson(await ctx.client.hosting.status(id));
    },
  });

  reg.register({
    path: "hosting destroy",
    summary: "tear down a deployment",
    usage: "hosting destroy <id>",
    covers: ["hosting.destroy"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: hosting destroy <id>");
      await ctx.client.hosting.destroy(id);
      ctx.printJson({ destroyed: id });
    },
  });
}
