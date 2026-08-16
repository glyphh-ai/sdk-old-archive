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
  reg.register({
    path: "slides list",
    summary: "the org's slide decks (newest first)",
    usage: "slides list",
    covers: ["officeSlides.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.officeSlides.list());
    },
  });

  reg.register({
    path: "slides get",
    summary: "one deck by name — metadata + HTML (--out writes the HTML to a file)",
    usage: "slides get <file> [--out <path>]",
    covers: ["officeSlides.get"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: slides get <file> [--out <path>]");
      const deck = await ctx.client.officeSlides.get(file);
      const out = flagStr(args, "out");
      if (out) {
        writeFileSync(out, deck.html, "utf8");
        const { html: _html, ...meta } = deck;
        ctx.printJson({ ...meta, wrote: out });
        return;
      }
      ctx.printJson(deck);
    },
  });

  reg.register({
    path: "slides save",
    summary: "create/overwrite a deck from a local HTML file",
    usage: "slides save <path> [--name <file>]",
    covers: ["officeSlides.put"],
    async run(ctx, args) {
      const path = args.positional[0];
      if (!path) throw new Error("usage: slides save <path> [--name <file>]");
      const name = flagStr(args, "name") ?? basename(path);
      ctx.printJson(await ctx.client.officeSlides.put(name, readFileSync(path, "utf8")));
    },
  });

  reg.register({
    path: "slides delete",
    summary: "delete a deck for the whole org",
    usage: "slides delete <file>",
    covers: ["officeSlides.delete"],
    async run(ctx, args) {
      const file = args.positional[0];
      if (!file) throw new Error("usage: slides delete <file>");
      await ctx.client.officeSlides.delete(file);
      ctx.printJson({ deleted: file });
    },
  });
}
