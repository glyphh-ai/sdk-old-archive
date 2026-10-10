/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/attach.ts — the attached desktop. `attach status` shows whether the
 * caller's Glyphh desktop is live; `attach dispatch <method> [json]` runs a
 * method on it (panels.list, rpa.click, loops.run, scrape.page, …). Self only —
 * it always targets the caller's own machine.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr, flagBool } from "../args.js";
import { printFrame } from "./harness.js";

const PERMISSIONS = ["ask", "plan", "acceptEdits", "auto", "bypass"] as const;
type Permission = (typeof PERMISSIONS)[number];

function asPermission(v: string | undefined): Permission | undefined {
  if (v === undefined) return undefined;
  if (!(PERMISSIONS as readonly string[]).includes(v)) throw new Error(`permission must be one of ${PERMISSIONS.join("|")}`);
  return v as Permission;
}

export function registerAttach(reg: CommandRegistry): void {
  reg.register({
    path: "attach status",
    summary: "whether your desktop is attached, and what it can do",
    covers: ["attach.status"],
    async run(ctx) {
      ctx.printJson(await ctx.client.attach.status());
    },
  });

  reg.register({
    path: "attach dispatch",
    summary: "run a method on your attached desktop",
    usage: "attach dispatch <method> [paramsJson]",
    covers: ["attach.dispatch"],
    async run(ctx, args) {
      const method = args.positional[0];
      if (!method) throw new Error("usage: attach dispatch <method> [paramsJson]");
      let params: Record<string, unknown> = {};
      if (args.positional[1]) {
        try { params = JSON.parse(args.positional[1]) as Record<string, unknown>; }
        catch { throw new Error("params must be valid JSON"); }
      }
      ctx.printJson(await ctx.client.attach.dispatch(method, params));
    },
  });

  reg.register({
    path: "attach fs-list",
    summary: "browse a folder on your attached desktop",
    usage: "attach fs-list [path]",
    covers: ["attach.fsList"],
    async run(ctx, args) {
      const path = args.positional[0];
      ctx.printJson(await ctx.client.attach.fsList(path));
    },
  });

  reg.register({
    path: "attach run",
    summary: "run a turn ON your attached desktop and stream its frames",
    usage: "attach run <prompt…> [--thread <id>] [--mode work|cowork|code] [--workdir <dir>] [--model <id>] [--loop <id>] [--permission <p>] [--machine <id>]",
    covers: ["attach.run"],
    async run(ctx, args) {
      const prompt = args.positional.join(" ").trim();
      if (!prompt) throw new Error("usage: attach run <prompt…> [--thread <id>] [--mode work|cowork|code] [--workdir <dir>] …");
      const mode = flagStr(args, "mode");
      if (mode !== undefined && mode !== "work" && mode !== "cowork" && mode !== "code") throw new Error("--mode must be work, cowork or code");
      const permission = asPermission(flagStr(args, "permission"));
      const opt = (flag: string, key: string): Record<string, string> => {
        const v = flagStr(args, flag);
        return v ? { [key]: v } : {};
      };
      const run = ctx.client.attach.run({
        prompt,
        ...(mode ? { mode } : {}),
        ...(permission ? { permission } : {}),
        ...opt("thread", "threadId"),
        ...opt("workdir", "workdir"),
        ...opt("model", "model"),
        ...opt("loop", "loop"),
        ...opt("machine", "machineId"),
      });
      process.once("SIGINT", () => { void run.stop(); });
      run.on((f) => printFrame(ctx, f));
      const result = await run.done;
      ctx.print("");
      ctx.print(`done: ${result.stopped ? "stopped" : result.error ? `error — ${result.error}` : "ok"} (${result.runId})`);
    },
  });

  reg.register({
    path: "attach answer",
    summary: "answer a parked approval or ask on a relayed run",
    usage: "attach answer <id> [--allow | --deny] [--answer <text>]…",
    covers: ["attach.answerRun"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: attach answer <id> [--allow | --deny] [--answer <text>]");
      const answer = flagStr(args, "answer");
      const allow = flagBool(args, "allow") ? true : flagBool(args, "deny") ? false : undefined;
      if (allow === undefined && answer === undefined) throw new Error("pass --allow, --deny, or --answer <text>");
      await ctx.client.attach.answerRun(id, { ...(allow !== undefined ? { allow } : {}), ...(answer !== undefined ? { answers: [answer] } : {}) });
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "attach stop",
    summary: "abort a relayed run",
    usage: "attach stop <runId>",
    covers: ["attach.stopRun"],
    async run(ctx, args) {
      const runId = args.positional[0];
      if (!runId) throw new Error("usage: attach stop <runId>");
      await ctx.client.attach.stopRun(runId);
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "attach permission",
    summary: "change a relayed run's permission mode mid-flight",
    usage: "attach permission <runId> <ask|plan|acceptEdits|auto|bypass>",
    covers: ["attach.setRunPermission"],
    async run(ctx, args) {
      const [runId, mode] = args.positional;
      const permission = asPermission(mode);
      if (!runId || !permission) throw new Error("usage: attach permission <runId> <ask|plan|acceptEdits|auto|bypass>");
      await ctx.client.attach.setRunPermission(runId, permission);
      ctx.printJson({ ok: true });
    },
  });
}
