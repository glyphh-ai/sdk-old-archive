/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/catalog.ts — the provider/model catalog (read), org provider enablement,
 * and the super_admin catalog/pricing admin.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { ProviderKind } from "../../contract/catalog.js";

function kind(v: string | undefined): ProviderKind {
  return v === "open_weight" ? "open_weight" : "proxied";
}

export function registerCatalog(reg: CommandRegistry): void {
  reg.register({
    path: "catalog providers",
    summary: "list providers (+ org enablement)",
    covers: ["catalog.providers"],
    async run(ctx) {
      ctx.printJson(await ctx.client.catalog.providers());
    },
  });

  reg.register({
    path: "catalog models",
    summary: "list models (+ credit pricing)",
    covers: ["catalog.models"],
    async run(ctx) {
      ctx.printJson(await ctx.client.catalog.models());
    },
  });

  reg.register({
    path: "providers enable",
    summary: "enable a provider for the org (optional BYOK key)",
    usage: "providers enable <slug> [--key <apiKey>]",
    covers: ["providers.enable"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: providers enable <slug> [--key <apiKey>]");
      ctx.printJson(await ctx.client.providers.enable(slug, flagStr(args, "key")));
    },
  });

  reg.register({
    path: "providers disable",
    summary: "disable a provider for the org",
    usage: "providers disable <slug>",
    covers: ["providers.disable"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: providers disable <slug>");
      await ctx.client.providers.disable(slug);
      ctx.print("disabled ✓");
    },
  });

  reg.register({
    path: "admin provider",
    summary: "release a provider (super_admin)",
    usage: "admin provider <slug> --name <name> [--kind proxied|open_weight]",
    covers: ["admin.createProvider"],
    async run(ctx, args) {
      const slug = args.positional[0];
      const name = flagStr(args, "name");
      if (!slug || !name) throw new Error("usage: admin provider <slug> --name <name> [--kind ...]");
      ctx.printJson(await ctx.client.admin.createProvider({ slug, name, kind: kind(flagStr(args, "kind")) }));
    },
  });

  reg.register({
    path: "admin model",
    summary: "release a model + pricing (super_admin)",
    usage: "admin model <id> --provider <slug> --name <name> --in <credits/MTok> --out <credits/MTok> [--kind ...]",
    covers: ["admin.createModel"],
    async run(ctx, args) {
      const id = args.positional[0];
      const providerSlug = flagStr(args, "provider");
      const name = flagStr(args, "name");
      const input = Number(flagStr(args, "in"));
      const output = Number(flagStr(args, "out"));
      if (!id || !providerSlug || !name || Number.isNaN(input) || Number.isNaN(output)) {
        throw new Error("usage: admin model <id> --provider <slug> --name <name> --in <n> --out <n>");
      }
      ctx.printJson(
        await ctx.client.admin.createModel({ id, providerSlug, name, kind: kind(flagStr(args, "kind")), inputCreditsPerMTok: input, outputCreditsPerMTok: output }),
      );
    },
  });

  reg.register({
    path: "admin pricing",
    summary: "update a model's pricing (super_admin)",
    usage: "admin pricing <modelId> [--in <n>] [--out <n>] [--active true|false]",
    covers: ["admin.setModelPricing"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: admin pricing <modelId> [--in n] [--out n] [--active true|false]");
      const pricing: { inputCreditsPerMTok?: number; outputCreditsPerMTok?: number; active?: boolean } = {};
      const inFlag = flagStr(args, "in");
      const outFlag = flagStr(args, "out");
      if (inFlag !== undefined) pricing.inputCreditsPerMTok = Number(inFlag);
      if (outFlag !== undefined) pricing.outputCreditsPerMTok = Number(outFlag);
      if ("active" in args.flags) pricing.active = String(args.flags.active) === "true";
      ctx.printJson(await ctx.client.admin.setModelPricing(id, pricing));
    },
  });
}
