/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/loops.ts — the org's agent-loop library. Members list/read; org_admins
 * build/edit/delete. `--definition` takes a JSON string (the opaque builder graph).
 */

import type { CommandRegistry } from "../registry.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";
import type { CreateLoopInput, UpdateLoopInput } from "../../contract/loops.js";

/** Parse a --definition JSON flag, or undefined when absent. */
function definition(args: CliArgs): unknown {
  const raw = flagStr(args, "definition");
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("--definition must be valid JSON");
  }
}

export function registerLoops(reg: CommandRegistry): void {
  reg.register({
    path: "loops list",
    summary: "list the org's agent loops (+ built-in Default)",
    covers: ["loops.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.loops.list());
    },
  });

  reg.register({
    path: "loops get",
    summary: "a loop's detail (+ definition)",
    usage: "loops get <id>",
    covers: ["loops.get"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: loops get <id>");
      ctx.printJson(await ctx.client.loops.get(id));
    },
  });

  reg.register({
    path: "loops create",
    summary: "build a loop (org_admin)",
    usage: "loops create <name> [--description <d>] [--definition <json>]",
    covers: ["loops.create"],
    async run(ctx, args) {
      const name = args.positional[0];
      if (!name) throw new Error("usage: loops create <name> [--description ..] [--definition <json>]");
      const input: CreateLoopInput = { name };
      const desc = flagStr(args, "description"); if (desc !== undefined) input.description = desc;
      const def = definition(args); if (def !== undefined) input.definition = def;
      ctx.printJson(await ctx.client.loops.create(input));
    },
  });

  reg.register({
    path: "loops update",
    summary: "edit a loop (org_admin)",
    usage: "loops update <id> [--name <n>] [--description <d>] [--definition <json>]",
    covers: ["loops.update"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: loops update <id> [--name ..] [--description ..] [--definition <json>]");
      const patch: UpdateLoopInput = {};
      const name = flagStr(args, "name"); if (name !== undefined) patch.name = name;
      const desc = flagStr(args, "description"); if (desc !== undefined) patch.description = desc;
      const def = definition(args); if (def !== undefined) patch.definition = def;
      ctx.printJson(await ctx.client.loops.update(id, patch));
    },
  });

  reg.register({
    path: "loops delete",
    summary: "delete a loop (org_admin)",
    usage: "loops delete <id>",
    covers: ["loops.remove"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: loops delete <id>");
      await ctx.client.loops.remove(id);
      ctx.print("deleted ✓");
    },
  });
}
