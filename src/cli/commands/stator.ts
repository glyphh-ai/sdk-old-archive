/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/stator.ts — the org memory plane from the CLI: recall/write (the
 * runtime path) and the curation surface (browse/graph/forget/amend).
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerStator(reg: CommandRegistry): void {
  reg.register({
    path: "memory recall",
    summary: "directives + scored semantic hits + the entity's fact node",
    usage: "memory recall <query> [--thread <id>] [--entity <e>] [--k <n>]",
    covers: ["stator.recall"],
    async run(ctx, args) {
      const query = args.positional.join(" ").trim();
      const thread = flagStr(args, "thread");
      const entity = flagStr(args, "entity");
      const k = flagStr(args, "k");
      ctx.printJson(await ctx.client.stator.recall({
        ...(query ? { query } : {}),
        ...(thread ? { threadId: thread } : {}),
        ...(entity ? { entity } : {}),
        ...(k ? { topK: Number(k) } : {}),
      }));
    },
  });

  reg.register({
    path: "memory write",
    summary: "persist a turn, or absorb facts from text (--absorb)",
    usage: "memory write <text> [--absorb] [--thread <id>] [--speaker <s>] [--tier short|mid|long]",
    covers: ["stator.write"],
    async run(ctx, args) {
      const text = args.positional.join(" ").trim();
      if (!text) throw new Error("usage: memory write <text> [--absorb]");
      const thread = flagStr(args, "thread");
      const speaker = flagStr(args, "speaker");
      const tierFlag = flagStr(args, "tier");
      const tier = tierFlag === "short" || tierFlag === "mid" || tierFlag === "long" ? tierFlag : undefined;
      ctx.printJson(await ctx.client.stator.write({
        text,
        mode: args.flags["absorb"] ? "absorb" : "turn",
        ...(thread ? { threadId: thread } : {}),
        ...(speaker ? { speaker } : {}),
        ...(tier ? { tier } : {}),
      }));
    },
  });

  reg.register({
    path: "memory browse",
    summary: "the raw memory: facts (version chains), corpus turns, recency window",
    usage: "memory browse [--thread <id>]",
    covers: ["stator.browse"],
    async run(ctx, args) {
      ctx.printJson(await ctx.client.stator.browse(flagStr(args, "thread")));
    },
  });

  reg.register({
    path: "memory graph",
    summary: "the semantic space: nodes + 3D coords + banded similarity edges",
    usage: "memory graph [--max <n>] [--sem <f>] [--nmin <f>] [--nmax <f>]",
    covers: ["stator.graph"],
    async run(ctx, args) {
      const num = (k: string) => { const v = flagStr(args, k); return v ? Number(v) : undefined; };
      const max = num("max"), semMin = num("sem"), neuralMin = num("nmin"), neuralMax = num("nmax");
      ctx.printJson(await ctx.client.stator.graph({
        ...(max !== undefined ? { max } : {}),
        ...(semMin !== undefined ? { semMin } : {}),
        ...(neuralMin !== undefined ? { neuralMin } : {}),
        ...(neuralMax !== undefined ? { neuralMax } : {}),
      }));
    },
  });

  reg.register({
    path: "memory forget",
    summary: "delete facts by filter, or a corpus turn by exact text",
    usage: "memory forget [--entity <e>] [--role <r>] [--filler <f>] [--key <k>] [--turn <text>]",
    covers: ["stator.forget"],
    async run(ctx, args) {
      const entity = flagStr(args, "entity"), role = flagStr(args, "role"),
        filler = flagStr(args, "filler"), key = flagStr(args, "key"), turn = flagStr(args, "turn");
      const fact = entity || role || filler || key
        ? { ...(entity ? { entity } : {}), ...(role ? { role } : {}), ...(filler ? { filler } : {}), ...(key ? { key } : {}) }
        : undefined;
      if (!fact && !turn) throw new Error("usage: memory forget needs a fact filter and/or --turn <text>");
      ctx.printJson(await ctx.client.stator.forget({ ...(fact ? { fact } : {}), ...(turn ? { turnText: turn } : {}) }));
    },
  });

  reg.register({
    path: "memory amend",
    summary: "correct a fact (keyed = supersede the chain; keyless = replace)",
    usage: "memory amend <entity> <role> <filler> [--key <k>] [--tier short|mid|long]",
    covers: ["stator.amend"],
    async run(ctx, args) {
      const [entity, role, ...rest] = args.positional;
      const filler = rest.join(" ").trim();
      if (!entity || !role || !filler) throw new Error("usage: memory amend <entity> <role> <filler>");
      const key = flagStr(args, "key");
      const tierFlag = flagStr(args, "tier");
      const tier = tierFlag === "short" || tierFlag === "mid" || tierFlag === "long" ? tierFlag : undefined;
      ctx.printJson(await ctx.client.stator.amend({
        entity, role, filler,
        ...(key ? { key } : {}),
        ...(tier ? { tier } : {}),
      }));
    },
  });
}
