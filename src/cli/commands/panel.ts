/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/panel.ts — server-brokered panels. `open` provisions a streamed browser panel
 * and prints `{ panelId, wsUrl, token }` (the token is shown once — connect the WS with
 * it); `nav` navigates it; `close` tears it down (only third-party URLs stream — Glyphh-
 * origin panels render in a local iframe). `terminal` opens the featherweight sibling: a
 * pty over WS (xterm.js renders locally); `terminal-close` kills the pty.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { PanelOpenInput, TerminalOpenInput } from "../../contract/panel.js";

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
    path: "panel terminal",
    summary: "open a terminal panel — a pty over WS (token shown once)",
    usage: "panel terminal [--session <id>] [--cols <n> --rows <n>] [--cwd <path>]",
    covers: ["panel.openTerminal"],
    async run(ctx, args) {
      const input: TerminalOpenInput = {};
      const session = flagStr(args, "session");
      if (session) input.sessionId = session;
      const cols = Number(flagStr(args, "cols"));
      const rows = Number(flagStr(args, "rows"));
      if (Number.isFinite(cols) && cols > 0) input.cols = cols;
      if (Number.isFinite(rows) && rows > 0) input.rows = rows;
      const cwd = flagStr(args, "cwd");
      if (cwd) input.cwd = cwd;
      ctx.printJson(await ctx.client.panel.openTerminal(input));
    },
  });

  reg.register({
    path: "panel terminal-close",
    summary: "close (kill the pty of) a terminal panel",
    usage: "panel terminal-close <panelId>",
    covers: ["panel.closeTerminal"],
    async run(ctx, args) {
      const panelId = args.positional[0];
      if (!panelId) throw new Error("usage: panel terminal-close <panelId>");
      await ctx.client.panel.closeTerminal(panelId);
      ctx.printJson({ closed: panelId });
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
