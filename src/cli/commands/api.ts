/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/api.ts — raw authenticated requests against the control plane, the CLI
 * face of the `client.http` escape hatch. For endpoints no typed command covers
 * yet; the response prints as JSON verbatim.
 */

import { readFileSync, writeFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import type { CliContext } from "../context.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";

const METHODS = ["get", "post", "patch", "put", "del"] as const;
type Method = (typeof METHODS)[number] | "stream";
const ALL = [...METHODS, "stream"] as const;

function parseBody(raw: string | undefined, ctx: CliContext): unknown {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    ctx.print("body must be valid JSON");
    throw new Error("invalid --body JSON");
  }
}

export function registerApi(reg: CommandRegistry): void {
  reg.register({
    path: "api",
    summary: "raw authenticated request: api <get|post|patch|put|del|stream> </api/path> [json-body]",
    usage: "api <get|post|patch|put|del|stream> </api/path> [<json-body>]",
    covers: [...METHODS.map((m) => `http.${m}`), "http.stream", "http.getBytes"],
    async run(ctx: CliContext, args: CliArgs) {
      const [methodRaw, path, body] = args.positional;
      const method = methodRaw?.toLowerCase() as Method | undefined;
      if (!method || !(ALL as readonly string[]).includes(method) || !path?.startsWith("/")) {
        return ctx.print("usage: api <get|post|patch|put|del|stream> </api/path> [<json-body>]");
      }
      // `stream` prints the raw body as it arrives — the shape agent turns use.
      if (method === "stream") {
        const upstream = await ctx.client.http.stream(path, parseBody(body, ctx) ?? {});
        ctx.print(await upstream.text());
        return;
      }
      const parsed = parseBody(body, ctx);
      const result =
        method === "get" || method === "del"
          ? await ctx.client.http[method](path)
          : await ctx.client.http[method](path, parsed);
      ctx.printJson(result);
    },
  });

  reg.register({
    path: "api post-binary",
    summary: "raw authenticated POST of a file's bytes → JSON",
    usage: "api post-binary </api/path> <file> --type <mime>",
    covers: ["http.postBinary"],
    async run(ctx, args) {
      const [path, file] = args.positional;
      const type = flagStr(args, "type");
      if (!path?.startsWith("/") || !file || !type) throw new Error("usage: api post-binary </api/path> <file> --type <mime>");
      ctx.printJson(await ctx.client.http.postBinary(path, new Uint8Array(readFileSync(file)), type));
    },
  });

  reg.register({
    path: "api post-for-bytes",
    summary: "raw authenticated JSON POST whose response bytes are written to --out",
    usage: "api post-for-bytes </api/path> [<json-body>] --out <file>",
    covers: ["http.postForBytes"],
    async run(ctx, args) {
      const [path, body] = args.positional;
      const out = flagStr(args, "out");
      if (!path?.startsWith("/") || !out) throw new Error("usage: api post-for-bytes </api/path> [<json-body>] --out <file>");
      const bytes = await ctx.client.http.postForBytes(path, parseBody(body, ctx) ?? {});
      writeFileSync(out, new Uint8Array(bytes));
      ctx.print(`wrote ${bytes.byteLength} bytes → ${out}`);
    },
  });
}
