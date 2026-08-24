/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/app-servers.ts — the dedicated app-server surface: the image SKU picker,
 * the super-admin catalog CRUD, and the per-app deploy-to-server + custom-domain
 * operations (which live on `client.hosting`). One command per SDK method; `covers`
 * keeps the parity test honest.
 */

import type { CommandRegistry } from "../registry.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";
import type { AdminAppServerImageCreate, AdminAppServerImageUpdate } from "../../contract/app-servers.js";

function flagInt(args: CliArgs, name: string): number | undefined {
  const v = flagStr(args, name);
  if (v === undefined) return undefined;
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`--${name} must be a number`);
  return n;
}

function patchFromFlags(args: CliArgs): AdminAppServerImageUpdate {
  const patch: AdminAppServerImageUpdate = {};
  const desc = flagStr(args, "description");
  if (desc !== undefined) patch.description = desc;
  const dbTier = flagStr(args, "dbTier");
  if (dbTier !== undefined) patch.dbTier = dbTier;
  for (const k of ["ramMb", "diskGb", "monthlyCredits", "costPerSecondMicro", "monthlyUsdCents", "sort"] as const) {
    const n = flagInt(args, k);
    if (n !== undefined) patch[k] = n;
  }
  const active = flagStr(args, "active");
  if (active !== undefined) patch.active = active === "true";
  return patch;
}

export function registerAppServers(reg: CommandRegistry): void {
  // ── the org-facing size picker ──────────────────────────────────────────────
  reg.register({
    path: "app-servers list",
    summary: "the app-server sizes available to your org (its region's active SKUs)",
    covers: ["appServers.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.appServers.list());
    },
  });

  // ── deploy an app to its own dedicated server ───────────────────────────────
  reg.register({
    path: "app-servers deploy",
    summary: "deploy an app to its OWN dedicated server (org_admin)",
    usage: "app-servers deploy <appSlug> --image <key> [--release <id>]",
    covers: ["hosting.deployToServer"],
    async run(ctx, args) {
      const appSlug = args.positional[0];
      const imageKey = flagStr(args, "image");
      if (!appSlug || !imageKey) throw new Error("usage: app-servers deploy <appSlug> --image <key> [--release <id>]");
      const releaseId = flagStr(args, "release");
      ctx.printJson(await ctx.client.hosting.deployToServer(appSlug, releaseId ? { imageKey, releaseId } : { imageKey }));
    },
  });

  reg.register({
    path: "app-servers deployments",
    summary: "an app's dedicated-server deployments",
    usage: "app-servers deployments <appSlug>",
    covers: ["hosting.serverDeployments"],
    async run(ctx, args) {
      const appSlug = args.positional[0];
      if (!appSlug) throw new Error("usage: app-servers deployments <appSlug>");
      ctx.printJson(await ctx.client.hosting.serverDeployments(appSlug));
    },
  });

  reg.register({
    path: "app-servers destroy",
    summary: "tear down a dedicated server (machine + its Postgres)",
    usage: "app-servers destroy <appSlug> <deploymentId>",
    covers: ["hosting.destroyServer"],
    async run(ctx, args) {
      const [appSlug, deploymentId] = args.positional;
      if (!appSlug || !deploymentId) throw new Error("usage: app-servers destroy <appSlug> <deploymentId>");
      await ctx.client.hosting.destroyServer(appSlug, deploymentId);
      ctx.printJson({ destroyed: deploymentId });
    },
  });

  // ── custom domains ──────────────────────────────────────────────────────────
  reg.register({
    path: "domains add",
    summary: "point a custom domain at a dedicated server (returns DNS records to publish)",
    usage: "domains add <appSlug> <hostname> --deployment <id>",
    covers: ["hosting.addDomain"],
    async run(ctx, args) {
      const [appSlug, hostname] = args.positional;
      const deploymentId = flagStr(args, "deployment");
      if (!appSlug || !hostname || !deploymentId) throw new Error("usage: domains add <appSlug> <hostname> --deployment <id>");
      ctx.printJson(await ctx.client.hosting.addDomain(appSlug, { hostname, deploymentId }));
    },
  });

  reg.register({
    path: "domains list",
    summary: "an app's custom domains",
    usage: "domains list <appSlug>",
    covers: ["hosting.domains"],
    async run(ctx, args) {
      const appSlug = args.positional[0];
      if (!appSlug) throw new Error("usage: domains list <appSlug>");
      ctx.printJson(await ctx.client.hosting.domains(appSlug));
    },
  });

  reg.register({
    path: "domains remove",
    summary: "remove a custom domain (and its Cloudflare hostname)",
    usage: "domains remove <appSlug> <domainId>",
    covers: ["hosting.removeDomain"],
    async run(ctx, args) {
      const [appSlug, domainId] = args.positional;
      if (!appSlug || !domainId) throw new Error("usage: domains remove <appSlug> <domainId>");
      await ctx.client.hosting.removeDomain(appSlug, domainId);
      ctx.printJson({ removed: domainId });
    },
  });

  // ── super-admin catalog CRUD (the runtime-image treatment) ──────────────────
  reg.register({
    path: "admin app-servers list",
    summary: "every app-server SKU, every region (super_admin)",
    covers: ["admin.appServerImages"],
    async run(ctx) {
      ctx.printJson(await ctx.client.admin.appServerImages());
    },
  });

  reg.register({
    path: "admin app-servers create",
    summary: "add an app-server SKU to a region's catalog (super_admin)",
    usage: "admin app-servers create <region> <key> --description <s> --dbTier <s> --ramMb n --diskGb n --monthlyCredits n --costPerSecondMicro n [--monthlyUsdCents n] [--sort n]",
    covers: ["admin.createAppServerImage"],
    async run(ctx, args) {
      const [region, key] = args.positional;
      const description = flagStr(args, "description");
      const dbTier = flagStr(args, "dbTier");
      const ramMb = flagInt(args, "ramMb");
      const diskGb = flagInt(args, "diskGb");
      const monthlyCredits = flagInt(args, "monthlyCredits");
      const costPerSecondMicro = flagInt(args, "costPerSecondMicro");
      if (!region || !key || !description || !dbTier ||
          ramMb === undefined || diskGb === undefined || monthlyCredits === undefined || costPerSecondMicro === undefined) {
        throw new Error("usage: admin app-servers create <region> <key> --description <s> --dbTier <s> --ramMb n --diskGb n --monthlyCredits n --costPerSecondMicro n");
      }
      const input: AdminAppServerImageCreate = { key, region, description, dbTier, ramMb, diskGb, monthlyCredits, costPerSecondMicro };
      const usd = flagInt(args, "monthlyUsdCents");
      if (usd !== undefined) input.monthlyUsdCents = usd;
      const sort = flagInt(args, "sort");
      if (sort !== undefined) input.sort = sort;
      ctx.printJson(await ctx.client.admin.createAppServerImage(input));
    },
  });

  reg.register({
    path: "admin app-servers update",
    summary: "re-price / re-size / retire a region's app-server SKU (super_admin)",
    usage: "admin app-servers update <region> <key> [--description <s>] [--dbTier <s>] [--ramMb n] [--diskGb n] [--monthlyCredits n] [--costPerSecondMicro n] [--monthlyUsdCents n] [--active true|false] [--sort n]",
    covers: ["admin.updateAppServerImage"],
    async run(ctx, args) {
      const [region, key] = args.positional;
      if (!region || !key) throw new Error("usage: admin app-servers update <region> <key> [--flags]");
      const patch = patchFromFlags(args);
      if (Object.keys(patch).length === 0) throw new Error("nothing to update — pass at least one flag");
      ctx.printJson(await ctx.client.admin.updateAppServerImage(region, key, patch));
    },
  });

  reg.register({
    path: "admin app-servers delete",
    summary: "remove an app-server SKU from a region's catalog (super_admin)",
    usage: "admin app-servers delete <region> <key>",
    covers: ["admin.deleteAppServerImage"],
    async run(ctx, args) {
      const [region, key] = args.positional;
      if (!region || !key) throw new Error("usage: admin app-servers delete <region> <key>");
      await ctx.client.admin.deleteAppServerImage(region, key);
      ctx.print("deleted ✓");
    },
  });
}
