/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/ada.ts — the org's Ada models of graded precedent. A situation is any
 * JSON object: pass it inline or as `@file.json` (`@-` for stdin). Weights and
 * specs take the same forms.
 */

import { readFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { CliArgs } from "../args.js";
import type { AdaSituation, AdaWeights } from "../../resources/ada.js";

function readJson(raw: string, what: string): unknown {
  const text = raw.startsWith("@") ? readFileSync(raw === "@-" ? 0 : raw.slice(1), "utf8") : raw;
  try { return JSON.parse(text); } catch { throw new Error(`${what} must be valid JSON (inline or @file.json)`); }
}

function situationArg(raw: string | undefined, usage: string): AdaSituation {
  if (!raw) throw new Error(`usage: ${usage}`);
  const v = readJson(raw, "situation");
  if (!v || typeof v !== "object" || Array.isArray(v)) throw new Error("situation must be a JSON object");
  return v as AdaSituation;
}

function weightsFlag(args: CliArgs): AdaWeights | undefined {
  const raw = flagStr(args, "weights");
  return raw === undefined ? undefined : (readJson(raw, "--weights") as AdaWeights);
}

function intFlag(args: CliArgs, name: string): number | undefined {
  const raw = flagStr(args, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 0) throw new Error(`--${name} must be a non-negative integer`);
  return n;
}

export function registerAda(reg: CommandRegistry): void {
  reg.register({
    path: "ada models",
    summary: "the org's Ada models; with an id, that model and its record counts",
    usage: "ada models [modelId]",
    covers: ["ada.models"],
    async run(ctx, args) {
      ctx.printJson(await ctx.client.ada.models(args.positional[0]));
    },
  });

  reg.register({
    path: "ada create",
    summary: "create a model (org_admin); a spec types every role",
    usage: "ada create <name…> [--weights <json|@file>] [--spec <json|@file>]",
    covers: ["ada.createModel"],
    async run(ctx, args) {
      const name = args.positional.join(" ").trim();
      if (!name) throw new Error("usage: ada create <name…> [--weights <json|@file>] [--spec <json|@file>]");
      const weights = weightsFlag(args);
      const spec = flagStr(args, "spec");
      ctx.printJson(await ctx.client.ada.createModel({
        name,
        ...(weights ? { weights } : {}),
        ...(spec !== undefined ? { spec: readJson(spec, "--spec") as Record<string, unknown> } : {}),
      }));
    },
  });

  reg.register({
    path: "ada update",
    summary: "rename a model or set its default weights (org_admin); --weights null clears them",
    usage: "ada update <modelId> [--name <n>] [--weights <json|@file|null>]",
    covers: ["ada.updateModel"],
    async run(ctx, args) {
      const modelId = args.positional[0];
      if (!modelId) throw new Error("usage: ada update <modelId> [--name <n>] [--weights <json|@file|null>]");
      const change: { name?: string; weights?: AdaWeights | null } = {};
      const name = flagStr(args, "name");
      if (name !== undefined) change.name = name;
      if (flagStr(args, "weights") !== undefined) change.weights = weightsFlag(args) ?? null;
      if (Object.keys(change).length === 0) throw new Error("nothing to change: pass --name and/or --weights");
      ctx.printJson(await ctx.client.ada.updateModel(modelId, change));
    },
  });

  reg.register({
    path: "ada delete",
    summary: "delete a model and its records (org_admin)",
    usage: "ada delete <modelId>",
    covers: ["ada.deleteModel"],
    async run(ctx, args) {
      const modelId = args.positional[0];
      if (!modelId) throw new Error("usage: ada delete <modelId>");
      ctx.printJson(await ctx.client.ada.deleteModel(modelId));
    },
  });

  reg.register({
    path: "ada query",
    summary: "what worked in situations like this one, and whether it is safe to act",
    usage: "ada query <modelId> <situation json|@file> [--weights <json|@file>]",
    covers: ["ada.query"],
    async run(ctx, args) {
      const usage = "ada query <modelId> <situation json|@file> [--weights <json|@file>]";
      const [modelId, raw] = args.positional;
      if (!modelId) throw new Error(`usage: ${usage}`);
      const weights = weightsFlag(args);
      ctx.printJson(await ctx.client.ada.query({ modelId, situation: situationArg(raw, usage), ...(weights ? { weights } : {}) }));
    },
  });

  reg.register({
    path: "ada facts",
    summary: "why: the nearest wins and vetoes as fact trees",
    usage: "ada facts <modelId> <situation json|@file> [--weights <json|@file>] [--top <n>]",
    covers: ["ada.facts"],
    async run(ctx, args) {
      const usage = "ada facts <modelId> <situation json|@file> [--weights <json|@file>] [--top <n>]";
      const [modelId, raw] = args.positional;
      if (!modelId) throw new Error(`usage: ${usage}`);
      const weights = weightsFlag(args);
      const top = intFlag(args, "top");
      ctx.printJson(await ctx.client.ada.facts({
        modelId,
        situation: situationArg(raw, usage),
        ...(weights ? { weights } : {}),
        ...(top !== undefined ? { top } : {}),
      }));
    },
  });

  reg.register({
    path: "ada record",
    summary: "record a graded win: this outcome worked here",
    usage: "ada record <modelId> <outcome> <situation json|@file>",
    covers: ["ada.record"],
    async run(ctx, args) {
      const usage = "ada record <modelId> <outcome> <situation json|@file>";
      const [modelId, outcome, raw] = args.positional;
      if (!modelId || !outcome) throw new Error(`usage: ${usage}`);
      ctx.printJson(await ctx.client.ada.record({ modelId, outcome, situation: situationArg(raw, usage) }));
    },
  });

  reg.register({
    path: "ada veto",
    summary: "record a graded failure: this outcome failed, or was rejected, here",
    usage: "ada veto <modelId> <outcome> <situation json|@file>",
    covers: ["ada.veto"],
    async run(ctx, args) {
      const usage = "ada veto <modelId> <outcome> <situation json|@file>";
      const [modelId, outcome, raw] = args.positional;
      if (!modelId || !outcome) throw new Error(`usage: ${usage}`);
      ctx.printJson(await ctx.client.ada.veto({ modelId, outcome, situation: situationArg(raw, usage) }));
    },
  });

  reg.register({
    path: "ada check",
    summary: "how close the nearest win and nearest failure of this outcome are",
    usage: "ada check <modelId> <outcome> <situation json|@file> [--weights <json|@file>]",
    covers: ["ada.check"],
    async run(ctx, args) {
      const usage = "ada check <modelId> <outcome> <situation json|@file> [--weights <json|@file>]";
      const [modelId, outcome, raw] = args.positional;
      if (!modelId || !outcome) throw new Error(`usage: ${usage}`);
      const weights = weightsFlag(args);
      ctx.printJson(await ctx.client.ada.check({ modelId, outcome, situation: situationArg(raw, usage), ...(weights ? { weights } : {}) }));
    },
  });

  reg.register({
    path: "ada calibrate",
    summary: "fit a model's probabilities to its own records (10+ wins)",
    usage: "ada calibrate <modelId> [--weights <json|@file>]",
    covers: ["ada.calibrate"],
    async run(ctx, args) {
      const modelId = args.positional[0];
      if (!modelId) throw new Error("usage: ada calibrate <modelId> [--weights <json|@file>]");
      ctx.printJson(await ctx.client.ada.calibrate(modelId, weightsFlag(args)));
    },
  });

  reg.register({
    path: "ada records",
    summary: "a model's records, newest first",
    usage: "ada records <modelId> [--store wins|vetoes] [--offset <n>] [--limit <n>]",
    covers: ["ada.records"],
    async run(ctx, args) {
      const modelId = args.positional[0];
      if (!modelId) throw new Error("usage: ada records <modelId> [--store wins|vetoes] [--offset <n>] [--limit <n>]");
      const store = flagStr(args, "store");
      if (store !== undefined && store !== "wins" && store !== "vetoes") throw new Error("--store must be wins or vetoes");
      const offset = intFlag(args, "offset");
      const limit = intFlag(args, "limit");
      ctx.printJson(await ctx.client.ada.records(modelId, {
        ...(store ? { store } : {}),
        ...(offset !== undefined ? { offset } : {}),
        ...(limit !== undefined ? { limit } : {}),
      }));
    },
  });

  reg.register({
    path: "ada edit-record",
    summary: "correct a record (org_admin)",
    usage: "ada edit-record <modelId> <recordId> [--situation <json|@file>] [--outcome <o>]",
    covers: ["ada.editRecord"],
    async run(ctx, args) {
      const usage = "ada edit-record <modelId> <recordId> [--situation <json|@file>] [--outcome <o>]";
      const [modelId, recordId] = args.positional;
      if (!modelId || !recordId) throw new Error(`usage: ${usage}`);
      const change: { situation?: AdaSituation; outcome?: string } = {};
      const situation = flagStr(args, "situation");
      const outcome = flagStr(args, "outcome");
      if (situation !== undefined) change.situation = situationArg(situation, usage);
      if (outcome !== undefined) change.outcome = outcome;
      if (Object.keys(change).length === 0) throw new Error("nothing to change: pass --situation and/or --outcome");
      ctx.printJson(await ctx.client.ada.editRecord(modelId, recordId, change));
    },
  });

  reg.register({
    path: "ada delete-record",
    summary: "delete one record (org_admin)",
    usage: "ada delete-record <modelId> <recordId>",
    covers: ["ada.deleteRecord"],
    async run(ctx, args) {
      const [modelId, recordId] = args.positional;
      if (!modelId || !recordId) throw new Error("usage: ada delete-record <modelId> <recordId>");
      ctx.printJson(await ctx.client.ada.deleteRecord(modelId, recordId));
    },
  });
}
