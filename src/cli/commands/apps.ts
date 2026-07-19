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
      if (!manifestPath) throw new Error("usage: apps publish --manifest <file.json>");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as AppManifest;
      // No bundle: source is uploaded per-release (`apps upload-source`), not at publish.
      const input: PublishAppInput = { manifest };
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
    path: "apps deployed",
    summary: "your deployed panel apps (dashboard count)",
    covers: ["apps.deployed"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.deployed());
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
  // ── the Apps page surface: entries, variants, releases, usage, audit ─────────
  reg.register({
    path: "apps mine",
    summary: "your org's apps — all kinds, with prod URL, variants, deploy state",
    covers: ["apps.mine"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.mine());
    },
  });

  reg.register({
    path: "apps add",
    summary: "add a web (url) or native (path) app entry",
    usage: "apps add --kind web|native --slug <s> --name <s> [--url <u>] [--ref <path>]",
    covers: ["apps.createEntry"],
    async run(ctx, args) {
      const kind = flagStr(args, "kind") as "web" | "native";
      const slug = flagStr(args, "slug");
      const name = flagStr(args, "name");
      if (!kind || !slug || !name) throw new Error("usage: apps add --kind web|native --slug <s> --name <s>");
      const url = flagStr(args, "url");
      const nativeRef = flagStr(args, "ref");
      ctx.printJson(await ctx.client.apps.createEntry({
        kind, slug, name,
        ...(url ? { url } : {}),
        ...(nativeRef ? { nativeRef } : {}),
      }));
    },
  });

  reg.register({
    path: "apps edit",
    summary: "edit a web/native entry",
    usage: "apps edit --slug <s> [--name <s>] [--url <u>] [--ref <path>]",
    covers: ["apps.updateEntry"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps edit --slug <s> [--name] [--url] [--ref]");
      const name = flagStr(args, "name");
      const url = flagStr(args, "url");
      const nativeRef = flagStr(args, "ref");
      ctx.printJson(await ctx.client.apps.updateEntry(slug, {
        ...(name ? { name } : {}), ...(url ? { url } : {}), ...(nativeRef ? { nativeRef } : {}),
      }));
    },
  });

  reg.register({
    path: "apps remove",
    summary: "delete an app (refused while a deployment is live)",
    usage: "apps remove --slug <s>",
    covers: ["apps.removeEntry"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps remove --slug <s>");
      await ctx.client.apps.removeEntry(slug);
      ctx.printJson({ ok: true, slug });
    },
  });

  reg.register({
    path: "apps variant add",
    summary: "add a slug → url address (e.g. crm-dev → localhost:3001)",
    usage: "apps variant add --app <slug> --slug <s> --url <u> [--label dev]",
    covers: ["apps.addVariant"],
    async run(ctx, args) {
      const app = flagStr(args, "app");
      const slug = flagStr(args, "slug");
      const url = flagStr(args, "url");
      if (!app || !slug || !url) throw new Error("usage: apps variant add --app <slug> --slug <s> --url <u>");
      const label = flagStr(args, "label");
      ctx.printJson(await ctx.client.apps.addVariant(app, { slug, url, ...(label ? { label } : {}) }));
    },
  });

  reg.register({
    path: "apps variant edit",
    summary: "update a variant's url or label",
    usage: "apps variant edit --app <slug> --id <id> [--url <u>] [--label <s>]",
    covers: ["apps.updateVariant"],
    async run(ctx, args) {
      const app = flagStr(args, "app");
      const id = flagStr(args, "id");
      if (!app || !id) throw new Error("usage: apps variant edit --app <slug> --id <id>");
      const url = flagStr(args, "url");
      const label = flagStr(args, "label");
      ctx.printJson(await ctx.client.apps.updateVariant(app, id, {
        ...(url ? { url } : {}), ...(label ? { label } : {}),
      }));
    },
  });

  reg.register({
    path: "apps variant remove",
    summary: "remove a variant address",
    usage: "apps variant remove --app <slug> --id <id>",
    covers: ["apps.removeVariant"],
    async run(ctx, args) {
      const app = flagStr(args, "app");
      const id = flagStr(args, "id");
      if (!app || !id) throw new Error("usage: apps variant remove --app <slug> --id <id>");
      await ctx.client.apps.removeVariant(app, id);
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "apps releases",
    summary: "a hosted app's builds, newest first",
    usage: "apps releases --slug <s>",
    covers: ["apps.releases"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps releases --slug <s>");
      ctx.printJson(await ctx.client.apps.releases(slug));
    },
  });

  reg.register({
    path: "apps release new",
    summary: "open a release (pending until source is uploaded)",
    usage: "apps release new --slug <s> [--version <semver>]",
    covers: ["apps.createRelease"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps release new --slug <s>");
      const version = flagStr(args, "version");
      ctx.printJson(await ctx.client.apps.createRelease(slug, version ? { version } : {}));
    },
  });

  reg.register({
    path: "apps upload-source",
    summary: "upload a release's source archive and build it",
    usage: "apps upload-source --slug <s> --release <id> --file <archive.tar.gz>",
    covers: ["apps.uploadSource"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      const file = flagStr(args, "file");
      if (!slug || !release || !file) throw new Error("usage: apps upload-source --slug <s> --release <id> --file <path>");
      const archive = new Uint8Array(readFileSync(file));
      ctx.printJson(await ctx.client.apps.uploadSource(slug, release, archive));
    },
  });

  reg.register({
    path: "apps usage",
    summary: "an app's daily credit burn (default 30 days)",
    usage: "apps usage --slug <s> [--days 30]",
    covers: ["apps.usage"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps usage --slug <s>");
      const days = flagStr(args, "days");
      ctx.printJson(await ctx.client.apps.usage(slug, days ? Number(days) : 30));
    },
  });

  reg.register({
    path: "apps audit",
    summary: "the org's app audit feed (app.* actions)",
    usage: "apps audit [--page 1] [--limit 50]",
    covers: ["apps.audit"],
    async run(ctx, args) {
      const page = flagStr(args, "page");
      const limit = flagStr(args, "limit");
      ctx.printJson(await ctx.client.apps.audit({
        ...(page ? { page: Number(page) } : {}), ...(limit ? { limit: Number(limit) } : {}),
      }));
    },
  });
  reg.register({
    path: "apps secrets",
    summary: "the config-var KEYS set on an app (values are write-only)",
    usage: "apps secrets --slug <s>",
    covers: ["apps.secrets"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps secrets --slug <s>");
      ctx.printJson(await ctx.client.apps.secrets(slug));
    },
  });

  reg.register({
    path: "apps secret set",
    summary: "set a config var (encrypted; injected as env at deploy)",
    usage: "apps secret set --slug <s> --key STRIPE_SECRET_KEY --value <v>",
    covers: ["apps.setSecret"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const key = flagStr(args, "key");
      const value = flagStr(args, "value");
      if (!slug || !key || !value) throw new Error("usage: apps secret set --slug <s> --key <K> --value <v>");
      ctx.printJson(await ctx.client.apps.setSecret(slug, key, value));
    },
  });

  reg.register({
    path: "apps secret remove",
    summary: "remove a config var",
    usage: "apps secret remove --slug <s> --key <K>",
    covers: ["apps.removeSecret"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const key = flagStr(args, "key");
      if (!slug || !key) throw new Error("usage: apps secret remove --slug <s> --key <K>");
      await ctx.client.apps.removeSecret(slug, key);
      ctx.printJson({ ok: true, key });
    },
  });
}
