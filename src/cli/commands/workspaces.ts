/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/workspaces.ts — governance commands. Flags map to WorkspaceInput; each
 * command covers one WorkspacesClient method for parity.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr, type CliArgs } from "../args.js";
import type { WorkspaceInput } from "../../contract/workspace.js";

function csv(v: string | undefined): string[] | undefined {
  return v === undefined ? undefined : v.split(",").map((s) => s.trim()).filter(Boolean);
}
function numOrNull(v: string | undefined): number | null | undefined {
  if (v === undefined) return undefined;
  return v === "null" ? null : Number(v);
}

/** Build a WorkspaceInput from the common flags (a subset; more can be added). */
function inputFromFlags(args: CliArgs): WorkspaceInput {
  const input: WorkspaceInput = {};
  const name = flagStr(args, "name");
  if (name) input.name = name;
  if ("limit-models" in args.flags) input.limitModels = Boolean(args.flags["limit-models"]);
  const models = csv(flagStr(args, "allowed-models"));
  if (models) input.allowedModels = models;
  if ("limit-connections" in args.flags) input.limitConnections = Boolean(args.flags["limit-connections"]);
  const conns = csv(flagStr(args, "allowed-connections"));
  if (conns) input.allowedConnections = conns;
  if ("allow-custom-mcp" in args.flags) input.allowCustomMcp = Boolean(args.flags["allow-custom-mcp"]);
  const cap = numOrNull(flagStr(args, "credits-cap"));
  if (cap !== undefined) input.creditsCap = cap;
  return input;
}

export function registerWorkspaces(reg: CommandRegistry): void {
  reg.register({
    path: "ws list",
    summary: "list workspaces",
    covers: ["workspaces.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.workspaces.list());
    },
  });

  reg.register({
    path: "ws create",
    summary: "create a workspace",
    usage: "ws create --name <name> [--limit-models --allowed-models a,b] [--allow-custom-mcp]",
    covers: ["workspaces.create"],
    async run(ctx, args) {
      if (!flagStr(args, "name")) throw new Error("usage: ws create --name <name>");
      ctx.printJson(await ctx.client.workspaces.create(inputFromFlags(args)));
    },
  });

  reg.register({
    path: "ws update",
    summary: "update a workspace's governance",
    usage: "ws update <id> [--name ..] [--limit-models] [--allowed-models a,b] [--credits-cap N|null]",
    covers: ["workspaces.update"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: ws update <id> [flags]");
      ctx.printJson(await ctx.client.workspaces.update(id, inputFromFlags(args)));
    },
  });

  reg.register({
    path: "ws delete",
    summary: "delete a workspace (not the base)",
    usage: "ws delete <id>",
    covers: ["workspaces.delete"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: ws delete <id>");
      await ctx.client.workspaces.delete(id);
      ctx.print("deleted ✓");
    },
  });

  reg.register({
    path: "ws assign",
    summary: "assign a member to a workspace",
    usage: "ws assign <userId> <workspaceId>",
    covers: ["workspaces.assign"],
    async run(ctx, args) {
      const [userId, workspaceId] = args.positional;
      if (!userId || !workspaceId) throw new Error("usage: ws assign <userId> <workspaceId>");
      await ctx.client.workspaces.assign(userId, workspaceId);
      ctx.print("assigned ✓");
    },
  });

  reg.register({
    path: "ws grants",
    summary: "the caller's effective grants",
    covers: ["workspaces.grants"],
    async run(ctx) {
      ctx.printJson(await ctx.client.workspaces.grants());
    },
  });
}
