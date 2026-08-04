/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/panel.ts — server-brokered browser panels. `open` provisions a streamed
 * browser panel and prints `{ panelId, wsUrl, token }` (the token is shown once — connect
 * the WS with it); `nav` navigates an open panel; `close` tears it down. Only third-party
 * URLs use this path — Glyphh-origin panels render in a local iframe.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { PanelOpenInput } from "../../contract/panel.js";

export function registerPanel(reg: CommandRegistry): void {
  reg.register({
    path: "panel open",
    summary: "open a streamed browser panel (token shown once)",
    usage: "panel open <url> [--width <n> --height <n>] [--dpr <n>]",
    covers: ["panel.openBrowser"],
    async run(ctx, args) {
      const url = args.positional[0];
      if (!url) throw new Error("usage: panel open <url> [--width <n> --height <n>] [--dpr <n>]");
      const input: PanelOpenInput = { url };
      const width = Number(flagStr(args, "width"));
      const height = Number(flagStr(args, "height"));
      if (Number.isFinite(width) && Number.isFinite(height) && width > 0 && height > 0) {
        input.viewport = { width, height };
      }
      const dpr = Number(flagStr(args, "dpr"));
      if (Number.isFinite(dpr) && dpr > 0) input.deviceScaleFactor = dpr;
      ctx.printJson(await ctx.client.panel.openBrowser(input));
    },
  });

  reg.register({
    path: "panel nav",
    summary: "navigate an open browser panel",
    usage: "panel nav <panelId> <url>",
    covers: ["panel.nav"],
    async run(ctx, args) {
      const [panelId, url] = args.positional;
      if (!panelId || !url) throw new Error("usage: panel nav <panelId> <url>");
      ctx.printJson(await ctx.client.panel.nav(panelId, url));
    },
  });

  reg.register({
    path: "panel close",
    summary: "close (tear down) a browser panel",
    usage: "panel close <panelId>",
    covers: ["panel.close"],
    async run(ctx, args) {
      const panelId = args.positional[0];
      if (!panelId) throw new Error("usage: panel close <panelId>");
      await ctx.client.panel.close(panelId);
      ctx.printJson({ closed: panelId });
    },
  });
}
