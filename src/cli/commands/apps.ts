/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/apps.ts — the apps marketplace + hosting. `apps publish` takes a manifest
 * JSON file + a bundle URL; `deploy` hosts a published app at <slug>.glyphh.app.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import type { CommandRegistry } from "../registry.js";
import { flagStr, flagBool } from "../args.js";
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
    summary: "uninstall an app (data retained; --delete-data exports first, then graveyards)",
    usage: "apps uninstall <slug> [--delete-data]",
    covers: ["apps.uninstall"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps uninstall <slug> [--delete-data]");
      const deleteData = flagBool(args, "delete-data");
      const result = await ctx.client.apps.uninstall(slug, deleteData ? { deleteData: true } : {});
      ctx.printJson(result ?? { uninstalled: slug });
    },
  });

  // ── the scoped app-data surface (marketplace M8) ───────────────────────────
  reg.register({
    path: "apps data query",
    summary: "run a structured query against an installed app's own schema",
    usage: `apps data query <slug> --json '{"op":"select","table":"customers"}'`,
    covers: ["apps.dataQuery"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const json = flagStr(args, "json");
      if (!slug || !json) throw new Error(`usage: apps data query <slug> --json '{"op":"select","table":"…"}'`);
      ctx.printJson(await ctx.client.apps.dataQuery(slug, JSON.parse(json)));
    },
  });

  // ── embeddings + graph planes (app-runtime spec, 2026-08-20) ──────────────
  reg.register({
    path: "apps data embed",
    summary: "upsert embedding items into an app's embeddings plane",
    usage: `apps data embed <slug> --json '[{"ref":"doc-1","content":"…"}]'`,
    covers: ["apps.dataEmbed"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const json = flagStr(args, "json");
      if (!slug || !json) throw new Error(`usage: apps data embed <slug> --json '[{"ref":"…","content":"…"}]'`);
      ctx.printJson(await ctx.client.apps.dataEmbed(slug, JSON.parse(json)));
    },
  });
  reg.register({
    path: "apps data embed-search",
    summary: "similarity-search an app's embeddings plane",
    usage: "apps data embed-search <slug> <text> [--kind <k>] [--limit <n>]",
    covers: ["apps.dataEmbedSearch"],
    async run(ctx, args) {
      const [slug, ...rest] = args.positional;
      const text = rest.join(" ");
      if (!slug || !text) throw new Error("usage: apps data embed-search <slug> <text>");
      const kind = flagStr(args, "kind");
      const limit = flagStr(args, "limit");
      ctx.printJson(await ctx.client.apps.dataEmbedSearch(slug, { text, ...(kind ? { kind } : {}), ...(limit ? { limit: Number(limit) } : {}) }));
    },
  });
  reg.register({
    path: "apps data embed-remove",
    summary: "remove embedding refs from an app's embeddings plane",
    usage: "apps data embed-remove <slug> <kind> <ref…>",
    covers: ["apps.dataEmbedRemove"],
    async run(ctx, args) {
      const [slug, kind, ...refs] = args.positional;
      if (!slug || !kind || !refs.length) throw new Error("usage: apps data embed-remove <slug> <kind> <ref…>");
      ctx.printJson(await ctx.client.apps.dataEmbedRemove(slug, kind, refs));
    },
  });
  reg.register({
    path: "apps graph nodes",
    summary: "upsert nodes into an app's graph plane",
    usage: `apps graph nodes <slug> --json '[{"id":"a","kind":"person"}]'`,
    covers: ["apps.dataGraphNodes"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const json = flagStr(args, "json");
      if (!slug || !json) throw new Error(`usage: apps graph nodes <slug> --json '[{"id":"…"}]'`);
      ctx.printJson(await ctx.client.apps.dataGraphNodes(slug, JSON.parse(json)));
    },
  });
  reg.register({
    path: "apps graph edges",
    summary: "upsert edges into an app's graph plane",
    usage: `apps graph edges <slug> --json '[{"src":"a","dst":"b"}]'`,
    covers: ["apps.dataGraphEdges"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const json = flagStr(args, "json");
      if (!slug || !json) throw new Error(`usage: apps graph edges <slug> --json '[{"src":"…","dst":"…"}]'`);
      ctx.printJson(await ctx.client.apps.dataGraphEdges(slug, JSON.parse(json)));
    },
  });
  reg.register({
    path: "apps graph neighbors",
    summary: "breadth-limited neighborhood of a node in an app's graph",
    usage: "apps graph neighbors <slug> <id> [--depth <1-3>] [--kind <k>] [--limit <n>]",
    covers: ["apps.dataGraphNeighbors"],
    async run(ctx, args) {
      const [slug, id] = args.positional;
      if (!slug || !id) throw new Error("usage: apps graph neighbors <slug> <id>");
      const depth = flagStr(args, "depth"); const kind = flagStr(args, "kind"); const limit = flagStr(args, "limit");
      ctx.printJson(await ctx.client.apps.dataGraphNeighbors(slug, { id, ...(depth ? { depth: Number(depth) } : {}), ...(kind ? { kind } : {}), ...(limit ? { limit: Number(limit) } : {}) }));
    },
  });
  reg.register({
    path: "apps graph remove",
    summary: "remove nodes (edges follow) and/or edges from an app's graph",
    usage: `apps graph remove <slug> --json '{"nodes":["a"]}'`,
    covers: ["apps.dataGraphRemove"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const json = flagStr(args, "json");
      if (!slug || !json) throw new Error(`usage: apps graph remove <slug> --json '{"nodes":["…"]}'`);
      ctx.printJson(await ctx.client.apps.dataGraphRemove(slug, JSON.parse(json)));
    },
  });
  // ── review desk (platform admin) ──────────────────────────────────────────
  reg.register({
    path: "apps admin search",
    summary: "platform admin: search any app by slug/name/org",
    usage: "apps admin search <query>",
    covers: ["apps.adminSearch"],
    async run(ctx, args) {
      const q = args.positional.join(" ");
      if (!q) throw new Error("usage: apps admin search <query>");
      ctx.printJson(await ctx.client.apps.adminSearch(q));
    },
  });
  reg.register({
    path: "apps release source",
    summary: "platform admin: a submitted release's file tree",
    usage: "apps release source <releaseId>",
    covers: ["apps.releaseSourceTree"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: apps release source <releaseId>");
      ctx.printJson(await ctx.client.apps.releaseSourceTree(id));
    },
  });
  reg.register({
    path: "apps release file",
    summary: "platform admin: one file from a submitted release",
    usage: "apps release file <releaseId> <path>",
    covers: ["apps.releaseSourceFile"],
    async run(ctx, args) {
      const [id, path] = args.positional;
      if (!id || !path) throw new Error("usage: apps release file <releaseId> <path>");
      ctx.printJson(await ctx.client.apps.releaseSourceFile(id, path));
    },
  });
  reg.register({
    path: "apps release recommend",
    summary: "platform admin: store the review agent's recommendations on a release",
    usage: `apps release recommend <releaseId> --json '{"summary":"…","items":[…]}'`,
    covers: ["apps.submitReviewRecommendations"],
    async run(ctx, args) {
      const id = args.positional[0];
      const json = flagStr(args, "json");
      if (!id || !json) throw new Error(`usage: apps release recommend <releaseId> --json '{"summary":"…"}'`);
      ctx.printJson(await ctx.client.apps.submitReviewRecommendations(id, JSON.parse(json)));
    },
  });

  reg.register({
    path: "apps data export",
    summary: "the full JSON dump of an installed app's data",
    usage: "apps data export <slug> [--out <file.json>]",
    covers: ["apps.dataExport"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps data export <slug> [--out <file.json>]");
      const dump = await ctx.client.apps.dataExport(slug);
      const out = flagStr(args, "out");
      if (out) {
        writeFileSync(out, JSON.stringify(dump, null, 2));
        ctx.printJson({ wrote: out, tables: Object.keys(dump.tables).length });
      } else {
        ctx.printJson(dump);
      }
    },
  });

  reg.register({
    path: "apps data status",
    summary: "the org's app-data health (applied vs live schema version, disabled latch)",
    usage: "apps data status <slug>",
    covers: ["apps.dataStatus"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps data status <slug>");
      ctx.printJson(await ctx.client.apps.dataStatus(slug));
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
    summary: "add a web (url), native (path), or glyphh (built) app entry",
    usage: "apps add --kind web|native|glyphh --slug <s> --name <s> [--url <u>] [--ref <path>] [--access public|members] [--config '{json}']",
    covers: ["apps.createEntry"],
    async run(ctx, args) {
      const kind = flagStr(args, "kind") as "web" | "native" | "glyphh";
      const slug = flagStr(args, "slug");
      const name = flagStr(args, "name");
      if (!kind || !slug || !name) throw new Error("usage: apps add --kind web|native|glyphh --slug <s> --name <s>");
      const url = flagStr(args, "url");
      const nativeRef = flagStr(args, "ref");
      const configRaw = flagStr(args, "config");
      const access = flagStr(args, "access") as "public" | "members" | undefined;
      ctx.printJson(await ctx.client.apps.createEntry({
        kind, slug, name,
        ...(url ? { url } : {}),
        ...(nativeRef ? { nativeRef } : {}),
        ...(access ? { access } : {}),
        ...(configRaw ? { config: JSON.parse(configRaw) } : {}),
      }));
    },
  });

  reg.register({
    path: "apps edit",
    summary: "edit an entry — rename, re-point, retype web↔native, or set who can reach it",
    usage: "apps edit --slug <s> [--name <s>] [--url <u>] [--ref <path>] [--kind web|native] [--access public|members] [--config '{json}']",
    covers: ["apps.updateEntry"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps edit --slug <s> [--name] [--url] [--ref] [--kind] [--access]");
      const name = flagStr(args, "name");
      const url = flagStr(args, "url");
      const nativeRef = flagStr(args, "ref");
      const configRaw = flagStr(args, "config");
      const kind = flagStr(args, "kind") as "web" | "native" | undefined;
      const access = flagStr(args, "access") as "public" | "members" | undefined;
      ctx.printJson(await ctx.client.apps.updateEntry(slug, {
        ...(name ? { name } : {}), ...(url ? { url } : {}), ...(nativeRef ? { nativeRef } : {}),
        ...(kind ? { kind } : {}), ...(access ? { access } : {}),
        ...(configRaw ? { config: JSON.parse(configRaw) } : {}),
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
    path: "apps export",
    summary: "graduate an app to a standalone Supabase-backed repo (zip)",
    usage: "apps export --slug <s> [--out <file.zip>]",
    covers: ["apps.export"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps export --slug <s> [--out <file.zip>]");
      const bytes = await ctx.client.apps.export(slug);
      const out = flagStr(args, "out") || `${slug}.zip`;
      writeFileSync(out, Buffer.from(bytes));
      ctx.printJson({ exported: slug, file: out, bytes: bytes.byteLength });
    },
  });

  reg.register({
    path: "apps source",
    summary: "download the source archive the newest release was built from (zip)",
    usage: "apps source --slug <s> [--out <file.zip>]",
    covers: ["apps.source"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps source --slug <s> [--out <file.zip>]");
      const bytes = await ctx.client.apps.source(slug);
      const out = flagStr(args, "out") || `${slug}-source.zip`;
      writeFileSync(out, Buffer.from(bytes));
      ctx.printJson({ slug, file: out, bytes: bytes.byteLength });
    },
  });

  reg.register({
    path: "apps release rollback",
    summary: "re-promote one of YOUR prior-approved releases (restores graveyarded objects inside the 30-day window)",
    usage: "apps release rollback --slug <s> --release <id>",
    covers: ["apps.rollbackRelease"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      if (!slug || !release) throw new Error("usage: apps release rollback --slug <s> --release <id>");
      ctx.printJson(await ctx.client.apps.rollbackRelease(slug, release));
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
    summary: "upload a release's source archive and build it (deprecated transport — prefer `apps bundle upload`)",
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

  // ── bundle distribution rails (app-runtime-spec, "Distribution and execution
  //    home"): bundle bytes move by presigned URL, content-hashed per release. ──
  reg.register({
    path: "apps bundle upload",
    summary: "upload a release's .glyphh bundle by presigned URL (mint → PUT → finalize; 250MB cap)",
    usage: "apps bundle upload --slug <s> --release <id> --file <bundle.glyphh>",
    covers: ["apps.mintBundleUpload", "apps.finalizeBundle"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      const file = flagStr(args, "file");
      if (!slug || !release || !file) throw new Error("usage: apps bundle upload --slug <s> --release <id> --file <path>");
      const bundle = readFileSync(file);
      const sha256 = createHash("sha256").update(bundle).digest("hex");
      const ticket = await ctx.client.apps.mintBundleUpload(slug, release, { sizeBytes: bundle.byteLength });
      if (ticket.url) {
        const put = await fetch(ticket.url, {
          method: "PUT",
          headers: { "content-type": ticket.contentType },
          body: new Uint8Array(bundle),
        });
        if (!put.ok) throw new Error(`bundle PUT failed: ${put.status} ${await put.text().catch(() => "")}`);
        ctx.printJson(await ctx.client.apps.finalizeBundle(slug, release, { sha256 }));
        return;
      }
      // No object storage to presign against (local/dev) — the buffered fallback.
      ctx.printJson(await ctx.client.apps.uploadSource(slug, release, new Uint8Array(bundle)));
    },
  });

  reg.register({
    path: "apps bundle download-url",
    summary: "mint a presigned GET for an installed app's bundle (live release; publishers may name a dev one)",
    usage: "apps bundle download-url --slug <s> [--release <id>]",
    covers: ["apps.bundleDownloadUrl"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps bundle download-url --slug <s> [--release <id>]");
      const release = flagStr(args, "release");
      ctx.printJson(await ctx.client.apps.bundleDownloadUrl(slug, release ? { releaseId: release } : {}));
    },
  });

  // ── releases: notes + promotion ────────────────────────────────────────────
  reg.register({
    path: "apps release notes",
    summary: "edit a release's notes (the only mutable field on a build)",
    usage: "apps release notes --slug <s> --release <id> --notes <markdown>",
    covers: ["apps.updateReleaseNotes"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      if (!slug || !release) throw new Error("usage: apps release notes --slug <s> --release <id> --notes <text>");
      ctx.printJson(await ctx.client.apps.updateReleaseNotes(slug, release, flagStr(args, "notes") ?? null));
    },
  });

  reg.register({
    path: "apps release promote",
    summary: "promote a built release to live (rollback = promote an older one)",
    usage: "apps release promote --slug <s> --release <id>",
    covers: ["apps.promoteRelease"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      if (!slug || !release) throw new Error("usage: apps release promote --slug <s> --release <id>");
      ctx.printJson(await ctx.client.apps.promoteRelease(slug, release));
    },
  });

  // ── listing ────────────────────────────────────────────────────────────────
  reg.register({
    path: "apps listing set",
    summary: "edit the marketplace listing (tagline, category, website, support)",
    usage: "apps listing set --slug <s> [--tagline <t>] [--category <c>] [--website <u>] [--support <email>]",
    covers: ["apps.updateListing"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps listing set --slug <s> [--tagline] [--category] [--website] [--support]");
      const tagline = flagStr(args, "tagline");
      const category = flagStr(args, "category") as Parameters<typeof ctx.client.apps.updateListing>[1]["category"];
      const website = flagStr(args, "website");
      const supportEmail = flagStr(args, "support");
      ctx.printJson(await ctx.client.apps.updateListing(slug, {
        ...(tagline ? { tagline } : {}), ...(category ? { category } : {}),
        ...(website ? { website } : {}), ...(supportEmail ? { supportEmail } : {}),
      }));
    },
  });

  reg.register({
    path: "apps media add",
    summary: "upload an icon, screenshot, or video to the listing",
    usage: "apps media add --slug <s> --kind icon|screenshot|video --file <path> [--caption <c>]",
    covers: ["apps.uploadMedia"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const file = flagStr(args, "file");
      const kind = (flagStr(args, "kind") || "screenshot") as "icon" | "screenshot" | "video";
      if (!slug || !file) throw new Error("usage: apps media add --slug <s> --kind <k> --file <path>");
      const caption = flagStr(args, "caption");
      ctx.printJson(await ctx.client.apps.uploadMedia(slug, kind, readFileSync(file), caption));
    },
  });

  reg.register({
    path: "apps media remove",
    summary: "detach media from the listing",
    usage: "apps media remove --slug <s> --key <key>",
    covers: ["apps.removeMedia"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const key = flagStr(args, "key");
      if (!slug || !key) throw new Error("usage: apps media remove --slug <s> --key <key>");
      await ctx.client.apps.removeMedia(slug, key);
      ctx.printJson({ removed: key });
    },
  });

  reg.register({
    path: "apps list-publicly",
    summary: "list the app on the marketplace (needs a tagline, category, icon)",
    usage: "apps list-publicly --slug <s>",
    covers: ["apps.list"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps list-publicly --slug <s>");
      ctx.printJson(await ctx.client.apps.list(slug));
    },
  });

  reg.register({
    path: "apps unlist",
    summary: "withdraw the marketplace listing (installs keep working)",
    usage: "apps unlist --slug <s>",
    covers: ["apps.unlist"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps unlist --slug <s>");
      ctx.printJson(await ctx.client.apps.unlist(slug));
    },
  });

  // ── reviews ────────────────────────────────────────────────────────────────
  reg.register({
    path: "apps reviews",
    summary: "an app's reviews, newest first",
    usage: "apps reviews --slug <s> [--limit <n>] [--offset <n>]",
    covers: ["apps.reviews"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps reviews --slug <s>");
      const limit = Number(flagStr(args, "limit") || 0);
      const offset = Number(flagStr(args, "offset") || 0);
      ctx.printJson(await ctx.client.apps.reviews(slug, {
        ...(limit ? { limit } : {}), ...(offset ? { offset } : {}),
      }));
    },
  });

  reg.register({
    path: "apps review",
    summary: "rate an app you installed (writing again edits your review)",
    usage: "apps review --slug <s> --stars <1-5> [--body <text>]",
    covers: ["apps.review"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const stars = Number(flagStr(args, "stars"));
      if (!slug || !stars) throw new Error("usage: apps review --slug <s> --stars <1-5> [--body <text>]");
      const body = flagStr(args, "body");
      ctx.printJson(await ctx.client.apps.review(slug, { stars, ...(body ? { body } : {}) }));
    },
  });

  reg.register({
    path: "apps review remove",
    summary: "delete your own review",
    usage: "apps review remove --slug <s>",
    covers: ["apps.removeReview"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps review remove --slug <s>");
      await ctx.client.apps.removeReview(slug);
      ctx.printJson({ removed: slug });
    },
  });

  reg.register({
    path: "apps review respond",
    summary: "reply publicly to a review of an app you publish",
    usage: "apps review respond --slug <s> --review <id> --text <reply>",
    covers: ["apps.respondToReview"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const review = flagStr(args, "review");
      const text = flagStr(args, "text");
      if (!slug || !review || !text) throw new Error("usage: apps review respond --slug <s> --review <id> --text <reply>");
      ctx.printJson(await ctx.client.apps.respondToReview(slug, review, text));
    },
  });

  reg.register({
    path: "apps review report",
    summary: "flag a review for platform moderation (it stays visible meanwhile)",
    usage: "apps review report --slug <s> --review <id> --reason <why>",
    covers: ["apps.reportReview"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const review = flagStr(args, "review");
      const reason = flagStr(args, "reason");
      if (!slug || !review || !reason) throw new Error("usage: apps review report --slug <s> --review <id> --reason <why>");
      ctx.printJson(await ctx.client.apps.reportReview(slug, review, reason));
    },
  });

  reg.register({
    path: "apps reviews flagged",
    summary: "the flagged-review moderation queue (platform admin)",
    covers: ["apps.flaggedReviews"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.flaggedReviews());
    },
  });

  reg.register({
    path: "apps review moderate",
    summary: "restore or remove a flagged review (platform admin)",
    usage: "apps review moderate --review <id> --action restore|remove",
    covers: ["apps.moderateReview"],
    async run(ctx, args) {
      const review = flagStr(args, "review");
      const action = flagStr(args, "action") as "restore" | "remove";
      if (!review || (action !== "restore" && action !== "remove")) {
        throw new Error("usage: apps review moderate --review <id> --action restore|remove");
      }
      ctx.printJson(await ctx.client.apps.moderateReview(review, action));
    },
  });

  // ── comments: threaded feedback on a listing (M3) ───────────────────────────

  reg.register({
    path: "apps comments",
    summary: "an app's comment threads, newest thread first",
    usage: "apps comments --slug <s> [--limit <n>] [--offset <n>]",
    covers: ["apps.comments"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps comments --slug <s>");
      const limit = Number(flagStr(args, "limit") || 0);
      const offset = Number(flagStr(args, "offset") || 0);
      ctx.printJson(await ctx.client.apps.comments(slug, {
        ...(limit ? { limit } : {}), ...(offset ? { offset } : {}),
      }));
    },
  });

  reg.register({
    path: "apps comment",
    summary: "post a comment (or reply to a top-level comment; one level only)",
    usage: "apps comment --slug <s> --body <text> [--parent <commentId>]",
    covers: ["apps.comment"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const body = flagStr(args, "body");
      if (!slug || !body) throw new Error("usage: apps comment --slug <s> --body <text> [--parent <commentId>]");
      const parent = flagStr(args, "parent");
      ctx.printJson(await ctx.client.apps.comment(slug, body, parent || undefined));
    },
  });

  reg.register({
    path: "apps comment edit",
    summary: "edit your own comment",
    usage: "apps comment edit --slug <s> --comment <id> --body <text>",
    covers: ["apps.editComment"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const comment = flagStr(args, "comment");
      const body = flagStr(args, "body");
      if (!slug || !comment || !body) throw new Error("usage: apps comment edit --slug <s> --comment <id> --body <text>");
      ctx.printJson(await ctx.client.apps.editComment(slug, comment, body));
    },
  });

  reg.register({
    path: "apps comment remove",
    summary: "delete your own comment (an anchored one is tombstoned)",
    usage: "apps comment remove --slug <s> --comment <id>",
    covers: ["apps.removeComment"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const comment = flagStr(args, "comment");
      if (!slug || !comment) throw new Error("usage: apps comment remove --slug <s> --comment <id>");
      await ctx.client.apps.removeComment(slug, comment);
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "apps comment report",
    summary: "flag a comment for platform moderation (it stays visible until a ruling)",
    usage: "apps comment report --slug <s> --comment <id> --reason <why>",
    covers: ["apps.reportComment"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const comment = flagStr(args, "comment");
      const reason = flagStr(args, "reason");
      if (!slug || !comment || !reason) throw new Error("usage: apps comment report --slug <s> --comment <id> --reason <why>");
      ctx.printJson(await ctx.client.apps.reportComment(slug, comment, reason));
    },
  });

  reg.register({
    path: "apps comments flagged",
    summary: "the flagged-comment moderation queue (platform admin)",
    covers: ["apps.flaggedComments"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.flaggedComments());
    },
  });

  reg.register({
    path: "apps comment moderate",
    summary: "restore or remove a flagged comment (platform admin)",
    usage: "apps comment moderate --comment <id> --action restore|remove",
    covers: ["apps.moderateComment"],
    async run(ctx, args) {
      const comment = flagStr(args, "comment");
      const action = flagStr(args, "action") as "restore" | "remove";
      if (!comment || (action !== "restore" && action !== "remove")) {
        throw new Error("usage: apps comment moderate --comment <id> --action restore|remove");
      }
      ctx.printJson(await ctx.client.apps.moderateComment(comment, action));
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

  // ── the review pipeline (marketplace M1) ────────────────────────────────────

  reg.register({
    path: "apps release submit",
    summary: "submit a ready release for marketplace review",
    usage: "apps release submit --slug <s> --release <id>",
    covers: ["apps.submitRelease"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      const release = flagStr(args, "release");
      if (!slug || !release) throw new Error("usage: apps release submit --slug <s> --release <id>");
      ctx.printJson(await ctx.client.apps.submitRelease(slug, release));
    },
  });

  reg.register({
    path: "apps review-queue",
    summary: "the release review queue (platform admin)",
    covers: ["apps.reviewQueue"],
    async run(ctx) {
      ctx.printJson(await ctx.client.apps.reviewQueue());
    },
  });

  reg.register({
    path: "apps review-rule",
    summary: "rule on a queued release: begin | approve | reject (platform admin)",
    usage: "apps review-rule --release <id> --action begin|approve|reject [--notes <text>] [--force]",
    covers: ["apps.reviewRelease"],
    async run(ctx, args) {
      const release = flagStr(args, "release");
      const action = flagStr(args, "action") as "begin" | "approve" | "reject" | undefined;
      if (!release || !action) throw new Error("usage: apps review-rule --release <id> --action begin|approve|reject [--notes <text>] [--force]");
      // --force: approve DESPITE critical scan findings (audited server-side).
      ctx.printJson(await ctx.client.apps.reviewRelease(release, action, flagStr(args, "notes"), flagBool(args, "force")));
    },
  });

  reg.register({
    path: "apps release findings",
    summary: "the scan agents' report on a release (owner; --admin for any queued release)",
    usage: "apps release findings --release <id> [--slug <s>] [--admin]",
    covers: ["apps.releaseFindings", "apps.adminReleaseFindings"],
    async run(ctx, args) {
      const release = flagStr(args, "release");
      if (!release) throw new Error("usage: apps release findings --release <id> [--slug <s>] [--admin]");
      if (flagBool(args, "admin")) {
        ctx.printJson(await ctx.client.apps.adminReleaseFindings(release));
        return;
      }
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps release findings --release <id> --slug <s> (or --admin)");
      ctx.printJson(await ctx.client.apps.releaseFindings(slug, release));
    },
  });

  // ── pricing (credits-only) ──────────────────────────────────────────────────

  reg.register({
    path: "apps pricing set",
    summary: "set an app's monthly credit price + discount window",
    usage: "apps pricing set --slug <s> [--credits <n>] [--discount <pct>|clear] [--starts <iso>] [--ends <iso>]",
    covers: ["apps.setPricing"],
    async run(ctx, args) {
      const slug = flagStr(args, "slug");
      if (!slug) throw new Error("usage: apps pricing set --slug <s> [--credits <n>] [--discount <pct>|clear]");
      const credits = flagStr(args, "credits");
      const discount = flagStr(args, "discount");
      const starts = flagStr(args, "starts");
      const ends = flagStr(args, "ends");
      ctx.printJson(await ctx.client.apps.setPricing(slug, {
        ...(credits !== undefined ? { monthlyCredits: Number(credits) } : {}),
        ...(discount !== undefined ? { discountPercent: discount === "clear" ? null : Number(discount) } : {}),
        ...(starts !== undefined ? { discountStartsAt: starts } : {}),
        ...(ends !== undefined ? { discountEndsAt: ends } : {}),
      }));
    },
  });

  // ── malicious reports ───────────────────────────────────────────────────────

  reg.register({
    path: "apps report",
    summary: "report an app as malicious (lands in the platform triage queue)",
    usage: "apps report <slug> --reason <text> [--detail <text>]",
    covers: ["apps.report"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const reason = flagStr(args, "reason");
      if (!slug || !reason) throw new Error("usage: apps report <slug> --reason <text> [--detail <text>]");
      ctx.printJson(await ctx.client.apps.report(slug, reason, flagStr(args, "detail")));
    },
  });

  reg.register({
    path: "apps reports",
    summary: "the app-report triage queue (platform admin)",
    usage: "apps reports [--status open|reviewing|resolved|dismissed]",
    covers: ["apps.reports"],
    async run(ctx, args) {
      ctx.printJson(await ctx.client.apps.reports(
        flagStr(args, "status") as "open" | "reviewing" | "resolved" | "dismissed" | undefined,
      ));
    },
  });

  reg.register({
    path: "apps report-resolve",
    summary: "rule on an app report (platform admin)",
    usage: "apps report-resolve --id <reportId> --status reviewing|resolved|dismissed",
    covers: ["apps.resolveReport"],
    async run(ctx, args) {
      const id = flagStr(args, "id");
      const status = flagStr(args, "status") as "reviewing" | "resolved" | "dismissed" | undefined;
      if (!id || !status) throw new Error("usage: apps report-resolve --id <reportId> --status reviewing|resolved|dismissed");
      ctx.printJson(await ctx.client.apps.resolveReport(id, status));
    },
  });

  // ── suspension (platform admin) ─────────────────────────────────────────────

  reg.register({
    path: "apps suspend",
    summary: "suspend a listing — hidden from browse, uninstallable (platform admin)",
    usage: "apps suspend <slug>",
    covers: ["apps.suspend"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps suspend <slug>");
      ctx.printJson(await ctx.client.apps.suspend(slug));
    },
  });

  reg.register({
    path: "apps unsuspend",
    summary: "lift a listing suspension (platform admin)",
    usage: "apps unsuspend <slug>",
    covers: ["apps.unsuspend"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: apps unsuspend <slug>");
      ctx.printJson(await ctx.client.apps.unsuspend(slug));
    },
  });
}
