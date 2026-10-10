/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/office.ts — GLYPHH OFFICE · SLIDES: the org's shared, agent-authored
 * slide decks. `list`/`get` read the library; `save` uploads a local deck HTML
 * by name (create-or-overwrite); `delete` removes it for the whole org.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename } from "node:path";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerOffice(reg: CommandRegistry): void {





  // ── DOCS ────────────────────────────────────────────────────────────────────

  reg.register({
    path: "docs list",
    summary: "the org's documents (newest first)",
    usage: "docs list",
    covers: ["officeDocs.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.officeDocs.list());
    },
  });

  reg.register({
    path: "docs get",
    summary: "one document by name — metadata + markdown (--out writes the markdown)",
    usage: "docs get <file> [--out <path>]",
    covers: ["officeDocs.get"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: docs get <file> [--out <path>]");
      const doc = await ctx.client.officeDocs.get(file);
      const out = flagStr(args, "out");
      if (out) {
        writeFileSync(out, doc.markdown, "utf8");
        const { markdown: _md, ...meta } = doc;
        ctx.printJson({ ...meta, wrote: out });
        return;
      }
      ctx.printJson(doc);
    },
  });

  reg.register({
    path: "docs save",
    summary: "create/overwrite a document from a local markdown file",
    usage: "docs save <path> [--name <file>] [--folder <folderId>]",
    covers: ["officeDocs.put"],
    async run(ctx, args) {
      const path = args.positional[0];
      if (!path) throw new Error("usage: docs save <path> [--name <file>] [--folder <folderId>]");
      const name = flagStr(args, "name") ?? basename(path);
      const folder = flagStr(args, "folder");
      ctx.printJson(await ctx.client.officeDocs.put(name, readFileSync(path, "utf8"), folder === undefined ? undefined : folder || null));
    },
  });

  reg.register({
    path: "docs delete",
    summary: "delete a document for the whole org",
    usage: "docs delete <file>",
    covers: ["officeDocs.delete"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: docs delete <file>");
      await ctx.client.officeDocs.delete(file);
      ctx.printJson({ deleted: file });
    },
  });

  reg.register({
    path: "docs suggestions",
    summary: "a document's suggestions (--status pending|approved|rejected|stale)",
    usage: "docs suggestions <file> [--status <status>]",
    covers: ["officeDocs.suggestions"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: docs suggestions <file> [--status <status>]");
      ctx.printJson(await ctx.client.officeDocs.suggestions(file, flagStr(args, "status")));
    },
  });

  reg.register({
    path: "docs suggest",
    summary: "propose an edit (review-and-approve): replace --before with --after",
    usage: "docs suggest <file> --after <text> [--before <text>] [--section <name>] [--note <why>]",
    covers: ["officeDocs.suggest"],
    async run(ctx, args) {
      const file = args.positional[0];
      const after = flagStr(args, "after");
      if (!file || !after) throw new Error("usage: docs suggest <file> --after <text> [--before <text>] …");
      ctx.printJson(await ctx.client.officeDocs.suggest(file, {
        afterMd: after,
        beforeMd: flagStr(args, "before") ?? "",
        section: flagStr(args, "section") ?? "",
        note: flagStr(args, "note") ?? "",
        authorKind: "user",
      }));
    },
  });

  reg.register({
    path: "docs resolve",
    summary: "approve (applies) or reject a pending suggestion",
    usage: "docs resolve <id> <approve|reject>",
    covers: ["officeDocs.resolveSuggestion"],
    async run(ctx, args) {
      const [id, verdict] = args.positional;
      if (!id || !["approve", "reject"].includes(verdict ?? "")) throw new Error("usage: docs resolve <id> <approve|reject>");
      ctx.printJson(await ctx.client.officeDocs.resolveSuggestion(id, verdict === "approve"));
    },
  });

  reg.register({
    path: "docs templates",
    summary: "the code-defined document template catalog",
    usage: "docs templates",
    covers: ["officeDocs.templates"],
    async run(ctx) {
      ctx.printJson(await ctx.client.officeDocs.templates());
    },
  });

  // ── DRIVE ───────────────────────────────────────────────────────────────────






  // ── SHEETS ──────────────────────────────────────────────────────────────────

  reg.register({
    path: "sheets list",
    summary: "the org's workbooks (newest first)",
    usage: "sheets list",
    covers: ["officeSheets.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.officeSheets.list());
    },
  });

  reg.register({
    path: "sheets get",
    summary: "one workbook by name — metadata + the JSON workbook (--out writes it)",
    usage: "sheets get <file> [--out <path>]",
    covers: ["officeSheets.get"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: sheets get <file> [--out <path>]");
      const sheet = await ctx.client.officeSheets.get(file);
      const out = flagStr(args, "out");
      if (out) {
        writeFileSync(out, JSON.stringify(sheet.workbook, null, 2), "utf8");
        const { workbook: _wb, ...meta } = sheet;
        ctx.printJson({ ...meta, wrote: out });
        return;
      }
      ctx.printJson(sheet);
    },
  });

  reg.register({
    path: "sheets save",
    summary: "create/overwrite a workbook from a local JSON file",
    usage: "sheets save <path> [--name <file>] [--title <title>]",
    covers: ["officeSheets.put"],
    async run(ctx, args) {
      const path = args.positional[0];
      if (!path) throw new Error("usage: sheets save <path> [--name <file>] [--title <title>]");
      const name = flagStr(args, "name") ?? basename(path);
      const title = flagStr(args, "title") ?? name.replace(/\.json$/i, "");
      const workbook = JSON.parse(readFileSync(path, "utf8"));
      ctx.printJson(await ctx.client.officeSheets.put(name, title, workbook));
    },
  });

  reg.register({
    path: "sheets delete",
    summary: "delete a workbook for the whole org",
    usage: "sheets delete <file>",
    covers: ["officeSheets.delete"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: sheets delete <file>");
      await ctx.client.officeSheets.delete(file);
      ctx.printJson({ deleted: file });
    },
  });

}
