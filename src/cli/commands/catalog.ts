/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/catalog.ts — the provider/model catalog (read), org provider enablement,
 * and the super_admin catalog/pricing admin.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { ProviderKind, Modality, RateUnit } from "../../contract/catalog.js";

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
    summary: "list models (+ vendor list price, $/1M tokens)",
    covers: ["catalog.models"],
    async run(ctx) {
      ctx.printJson(await ctx.client.catalog.models());
    },
  });

  reg.register({
    path: "catalog voices",
    summary: "a TTS provider's available voices",
    usage: "catalog voices <providerSlug>",
    covers: ["catalog.voices"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: catalog voices <providerSlug>");
      ctx.printJson(await ctx.client.catalog.voices(slug));
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
    path: "providers clear-key",
    summary: "remove the org's BYOK key but keep the provider enabled",
    usage: "providers clear-key <slug>",
    covers: ["providers.clearKey"],
    async run(ctx, args) {
      const slug = args.positional[0];
      if (!slug) throw new Error("usage: providers clear-key <slug>");
      await ctx.client.providers.clearKey(slug);
      ctx.print("key removed ✓ (provider stays enabled — platform proxy key applies)");
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
    summary: "release a model (super_admin); --in/--out are the vendor's list price in dollars per unit",
    usage: "admin model <id> --provider <slug> --name <name> [--in <usd/unit>] [--out <usd/unit>] [--kind ...] [--modality chat|image|video|speech|transcription] [--rate-unit mtok|image|second|mchar|minute]",
    covers: ["admin.createModel"],
    async run(ctx, args) {
      const id = args.positional[0];
      const providerSlug = flagStr(args, "provider");
      const name = flagStr(args, "name");
      const inRaw = flagStr(args, "in");
      const outRaw = flagStr(args, "out");
      const input = inRaw === undefined ? undefined : Number(inRaw);
      const output = outRaw === undefined ? undefined : Number(outRaw);
      if (!id || !providerSlug || !name || Number.isNaN(input) || Number.isNaN(output)) {
        throw new Error("usage: admin model <id> --provider <slug> --name <name> [--in <usd>] [--out <usd>]");
      }
      const modality = flagStr(args, "modality") as Modality | undefined;
      const rateUnit = flagStr(args, "rate-unit") as RateUnit | undefined;
      ctx.printJson(
        await ctx.client.admin.createModel({
          id, providerSlug, name, kind: kind(flagStr(args, "kind")),
          ...(modality ? { modality } : {}), ...(rateUnit ? { rateUnit } : {}),
          ...(input !== undefined ? { inputUsdPerMTok: input } : {}),
          ...(output !== undefined ? { outputUsdPerMTok: output } : {}),
        }),
      );
    },
  });

}
