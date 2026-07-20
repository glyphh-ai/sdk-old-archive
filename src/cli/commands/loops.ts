/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/loops.ts — the org's loop library. Members list/read; org_admins
 * build/edit/delete.
 *
 * A loop is a manifest + a program, so authoring happens against FILES, not inline
 * JSON: `--code <path>` reads the program off disk and `--manifest <path>` its
 * manifest, which is how a loop is actually edited (in an editor, in a repo).
 * `loops pull` writes both back out so a stored loop round-trips.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";
import type { CreateLoopInput, UpdateLoopInput, LoopManifest } from "../../contract/loops.js";

/** Read a file flag's contents, or undefined when the flag is absent. */
function fileFlag(args: CliArgs, name: string): string | undefined {
  const path = flagStr(args, name);
  if (path === undefined) return undefined;
  try {
    return readFileSync(path, "utf8");
  } catch (err) {
    throw new Error(`--${name}: cannot read ${path} (${err instanceof Error ? err.message : String(err)})`);
  }
}

/** Read + parse the manifest file flag, or undefined when absent. */
function manifestFlag(args: CliArgs): LoopManifest | undefined {
  const raw = fileFlag(args, "manifest");
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as LoopManifest;
  } catch {
    throw new Error("--manifest must be a file containing valid JSON");
  }
}

export function registerLoops(reg: CommandRegistry): void {
  reg.register({
    path: "loops list",
    summary: "list the org's loops (+ built-in Default)",
    covers: ["loops.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.loops.list());
    },
  });

  reg.register({
    path: "loops get",
    summary: "a loop's detail (manifest + program)",
    usage: "loops get <slug|id>",
    covers: ["loops.get"],
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: loops get <slug|id>");
      ctx.printJson(await ctx.client.loops.get(ref));
    },
  });

  reg.register({
    path: "loops pull",
    summary: "write a loop's program + manifest to disk",
    usage: "loops pull <slug|id> [--code <path>] [--manifest <path>]",
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: loops pull <slug|id> [--code <path>] [--manifest <path>]");
      const loop = await ctx.client.loops.get(ref);
      const codePath = flagStr(args, "code") ?? `${loop.slug}.loop.js`;
      const manifestPath = flagStr(args, "manifest") ?? `${loop.slug}.loop.json`;
      writeFileSync(codePath, loop.code, "utf8");
      writeFileSync(manifestPath, `${JSON.stringify(loop.manifest, null, 2)}\n`, "utf8");
      ctx.print(`${codePath}\n${manifestPath}`);
    },
  });

  reg.register({
    path: "loops create",
    summary: "build a loop (org_admin)",
    usage: "loops create <slug> <name> [--description <d>] [--code <path>] [--manifest <path>]",
    covers: ["loops.create"],
    async run(ctx, args) {
      const [slug, name] = args.positional;
      if (!slug || !name) {
        throw new Error("usage: loops create <slug> <name> [--description ..] [--code <path>] [--manifest <path>]");
      }
      const input: CreateLoopInput = { slug, name };
      const desc = flagStr(args, "description"); if (desc !== undefined) input.description = desc;
      const code = fileFlag(args, "code"); if (code !== undefined) input.code = code;
      const manifest = manifestFlag(args); if (manifest !== undefined) input.manifest = manifest;
      ctx.printJson(await ctx.client.loops.create(input));
    },
  });

  reg.register({
    path: "loops update",
    summary: "edit a loop (org_admin)",
    usage: "loops update <slug|id> [--name <n>] [--description <d>] [--code <path>] [--manifest <path>]",
    covers: ["loops.update"],
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) {
        throw new Error("usage: loops update <slug|id> [--name ..] [--description ..] [--code <path>] [--manifest <path>]");
      }
      const patch: UpdateLoopInput = {};
      const name = flagStr(args, "name"); if (name !== undefined) patch.name = name;
      const desc = flagStr(args, "description"); if (desc !== undefined) patch.description = desc;
      const slug = flagStr(args, "slug"); if (slug !== undefined) patch.slug = slug;
      const code = fileFlag(args, "code"); if (code !== undefined) patch.code = code;
      const manifest = manifestFlag(args); if (manifest !== undefined) patch.manifest = manifest;
      if (Object.keys(patch).length === 0) throw new Error("nothing to update — pass at least one flag");
      ctx.printJson(await ctx.client.loops.update(ref, patch));
    },
  });

  reg.register({
    path: "loops delete",
    summary: "delete a loop (org_admin)",
    usage: "loops delete <slug|id>",
    covers: ["loops.remove"],
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: loops delete <slug|id>");
      await ctx.client.loops.remove(ref);
      ctx.print("deleted ✓");
    },
  });
}
