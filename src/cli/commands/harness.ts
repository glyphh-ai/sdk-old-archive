/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/harness.ts — interactive turns, streamed as frames. `harness run`
 * targets a HARNESS pod (`glyphh.harness/v1`) directly, `harness api` goes
 * through the control-plane turn proxy, and `turn` is the one front door
 * (`client.run`): cloud by default, `--target desktop` relays to your machine.
 */

import type { CommandRegistry } from "../registry.js";
import type { CliContext } from "../context.js";
import type { CliArgs } from "../args.js";
import { flagStr } from "../args.js";
import type { HarnessClient } from "../../transport/harness.js";

/** Print one wire frame: text deltas inline, everything else as a marker line. */
export function printFrame(ctx: CliContext, frame: { type: string }): void {
  const f = frame as { type: string; [k: string]: unknown };
  if (f.type === "delta") process.stdout.write(String(f.delta ?? ""));
  else ctx.print(`  · ${f.type}${f.type === "tool" ? ` ${String(f.name)} (${String(f.phase)})` : ""}${typeof f.id === "string" && f.type !== "tool" ? ` [${f.id}]` : ""}`);
}

function modeFlag(args: CliArgs): "chat" | "cowork" | "code" | undefined {
  const mode = flagStr(args, "mode");
  return mode === "chat" || mode === "cowork" || mode === "code" ? mode : undefined;
}

async function streamHarness(ctx: CliContext, pod: HarnessClient, prompt: string, args: CliArgs): Promise<void> {
  const thread = flagStr(args, "thread");
  const mode = modeFlag(args);
  const run = pod.start({
    prompt,
    surface: "cli", // the window tools act where the caller is (HarnessSurface)
    ...(thread ? { threadId: thread } : {}),
    ...(mode ? { mode } : {}),
  });
  run.on((f) => printFrame(ctx, f));
  const ack = await run.whenStarted;
  const result = await run.done;
  ctx.print("");
  ctx.print(`done: ${result.stopped ? "stopped" : result.error ? `error — ${result.error}` : "ok"} (${ack.runId})`);
}

export function registerHarness(reg: CommandRegistry): void {
  reg.register({
    path: "harness run",
    summary: "stream a harness turn against a session pod",
    usage: "harness run <prompt> --url <podUrl> [--token <gy_rk_…>] [--thread <id>] [--mode chat|cowork|code]",
    covers: ["harness"],
    async run(ctx, args) {
      const prompt = args.positional[0];
      const url = flagStr(args, "url");
      if (!prompt || !url) throw new Error("usage: harness run <prompt> --url <podUrl> [--token <t>] [--thread <id>] [--mode <m>]");
      const token = flagStr(args, "token");
      await streamHarness(ctx, ctx.client.harness({ url, ...(token ? { token: async () => token } : {}) }), prompt, args);
    },
  });

  reg.register({
    path: "harness api",
    summary: "stream a harness turn through the control-plane turn proxy (region-routed)",
    usage: "harness api <prompt> [--thread <id>] [--mode chat|cowork|code]",
    covers: ["harnessViaApi"],
    async run(ctx, args) {
      const prompt = args.positional[0];
      if (!prompt) throw new Error("usage: harness api <prompt> [--thread <id>] [--mode <m>]");
      await streamHarness(ctx, ctx.client.harnessViaApi(), prompt, args);
    },
  });

  reg.register({
    path: "turn",
    summary: "run a turn through the one front door — cloud (default) or your attached desktop",
    usage: "turn <prompt…> [--target cloud|desktop] [--thread <id>] [--mode chat|work|cowork|code] [--model <id>] [--loop <id>] [--permission <p>] [--effort <e>] [--workdir <dir>] [--machine <id>] [--repo <owner/repo>] [--branch <b>] [--env <id>]",
    covers: ["run"],
    async run(ctx, args) {
      const prompt = args.positional.join(" ").trim();
      const target = flagStr(args, "target") ?? "cloud";
      if (!prompt || (target !== "cloud" && target !== "desktop")) {
        throw new Error("usage: turn <prompt…> [--target cloud|desktop] [--thread <id>] [--mode <m>] [--model <id>] …");
      }
      const mode = flagStr(args, "mode");
      if (mode !== undefined && mode !== "chat" && mode !== "work" && mode !== "cowork" && mode !== "code") throw new Error("--mode must be chat, work, cowork or code");
      const opt = (flag: string, key: string): Record<string, string> => {
        const v = flagStr(args, flag);
        return v ? { [key]: v } : {};
      };
      const run = ctx.client.run({
        target,
        prompt,
        surface: "cli",
        ...(mode ? { mode } : {}),
        ...opt("thread", "threadId"),
        ...opt("model", "model"),
        ...opt("loop", "loop"),
        ...opt("permission", "permission"),
        ...opt("effort", "effort"),
        ...opt("workdir", "workdir"),
        ...opt("machine", "machineId"),
        ...opt("repo", "repo"),
        ...opt("branch", "branch"),
        ...opt("env", "environmentId"),
      });
      process.once("SIGINT", () => { void run.stop(); });
      run.on((f) => printFrame(ctx, f));
      const result = await run.done;
      ctx.print("");
      ctx.print(`done: ${result.stopped ? "stopped" : result.error ? `error — ${result.error}` : "ok"} (${result.runId})`);
    },
  });
}
