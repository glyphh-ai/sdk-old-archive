/**
 * The built-in Default loop, run through the real runner.
 *
 * The source is READ from the server's base-loop.ts rather than copied here, so
 * the program under test is the one that actually ships. If that path moves this
 * fails loudly, which is right — a copy that silently drifts from the shipped
 * loop would test nothing.
 *
 * What matters is that it works on ANY model: a large window and a tiny one both
 * have to complete a turn, so these pin the budgeting rather than the prose.
 */

import { describe, it, expect, vi, beforeAll } from "vitest";
import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { runProgram } from "../../src/runtime/runner.js";
import type { Client } from "../../src/client.js";

let BASE_LOOP = "";
beforeAll(() => {
  const here = dirname(fileURLToPath(import.meta.url));
  const file = join(here, "../../../server/src/domains/loops/base-loop.ts");
  const raw = readFileSync(file, "utf8");
  const match = /export const BASE_LOOP_SOURCE = `([\s\S]*)`;\s*$/.exec(raw);
  if (!match) throw new Error("could not extract BASE_LOOP_SOURCE — has base-loop.ts changed shape?");
  // Undo the escaping the server file needs to hold a template literal.
  BASE_LOOP = match[1]!.replace(/\\`/g, "`").replace(/\\\$/g, "$");
});

/** A client whose turns are scripted, so a loop's control flow is what is tested. */
function clientWith(turns: Array<Partial<{ text: string; toolUses: unknown[]; stopReason: string }>>, window: number | null = 200000) {
  let i = 0;
  const seen: Array<Record<string, unknown>> = [];
  const client = {
    gateway: {
      turn: vi.fn(async (input: Record<string, unknown>) => {
        seen.push(input);
        const t = turns[Math.min(i++, turns.length - 1)] ?? {};
        return {
          text: t.text ?? "done",
          toolUses: t.toolUses ?? [],
          stopReason: t.stopReason ?? "end_turn",
          usage: { inputTokens: 1, outputTokens: 1 },
          content: [{ type: "text", text: t.text ?? "done" }],
        };
      }),
    },
    models: {
      available: vi.fn(async () => [
        {
          id: "anthropic::claude-sonnet-5", name: "Sonnet", providerSlug: "anthropic", kind: "proxied",
          inputCreditsPerMTok: 3, outputCreditsPerMTok: 15, source: "proxy",
          contextWindow: window, maxOutputTokens: 64000,
        },
      ]),
    },
    connections: { runTool: vi.fn(async () => ({ result: { ret: "tool result" } })) },
    skills: { get: vi.fn() },
  } as unknown as Client;
  return { client, seen };
}

const caps = { roles: { default: "anthropic::claude-sonnet-5" }, connections: ["gmail"] };

/** A tool set big enough that a small window cannot hold all of it. */
const manyTools = Array.from({ length: 40 }, (_, i) => ({
  name: `gmail.tool_${i}`,
  description: "x".repeat(400),
  input_schema: { type: "object", properties: { a: { type: "string" }, b: { type: "string" } } },
}));

describe("base loop", () => {
  it("answers a plain prompt in one turn", async () => {
    const { client } = clientWith([{ text: "the answer" }]);
    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "what is 2+2" },
    });
    expect(res.error).toBeUndefined();
    expect(res.output).toBe("the answer");
  });

  it("refuses to start without a prompt rather than calling a model", async () => {
    const { client } = clientWith([{ text: "x" }]);
    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: {},
    });
    expect(res.output).toContain("Nothing to do");
    expect(client.gateway.turn).not.toHaveBeenCalled();
  });

  it("runs a tool the model asked for and feeds the result back", async () => {
    const { client, seen } = clientWith([
      { text: "checking", toolUses: [{ id: "t1", name: "gmail.send", input: { to: "y" } }], stopReason: "tool_use" },
      { text: "sent it" },
    ]);
    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "email y", tools: [{ name: "gmail.send", input_schema: { type: "object" } }] },
    });
    expect(res.error).toBeUndefined();
    expect(res.output).toBe("sent it");
    expect(client.connections.runTool).toHaveBeenCalledWith({ slug: "gmail", tool: "send", props: { to: "y" } });

    // The assistant's own blocks went back verbatim, then the tool_result —
    // without both, the model cannot pair a result with its call.
    const second = seen[1]!.messages as Array<{ role: string; content: unknown }>;
    expect(second[1]!.role).toBe("assistant");
    const results = second[2]!.content as Array<Record<string, unknown>>;
    expect(results[0]).toEqual({ type: "tool_result", tool_use_id: "t1", content: "tool result" });
  });

  it("hands a failing tool back to the model instead of crashing the run", async () => {
    const { client, seen } = clientWith([
      { text: "trying", toolUses: [{ id: "t1", name: "gmail.send", input: {} }], stopReason: "tool_use" },
      { text: "recovered" },
    ]);
    (client.connections.runTool as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("mailbox full"));

    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "email y", tools: [{ name: "gmail.send" }] },
    });
    expect(res.error).toBeUndefined();
    expect(res.output).toBe("recovered");
    const results = (seen[1]!.messages as Array<{ content: unknown }>)[2]!.content as Array<{ content: string }>;
    // A failed tool is information the model can act on.
    expect(results[0]!.content).toContain("mailbox full");
  });

  it("trims the tool surface to fit a small model", async () => {
    const { client: big, seen: bigSeen } = clientWith([{ text: "ok" }], 200_000);
    await runProgram(big, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "hi", tools: manyTools },
    });
    const { client: small, seen: smallSeen } = clientWith([{ text: "ok" }], 8_000);
    const res = await runProgram(small, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "hi", tools: manyTools },
    });

    expect(res.error).toBeUndefined();
    const bigTools = (bigSeen[0]!.tools as unknown[]).length;
    const smallTools = ((smallSeen[0]!.tools as unknown[]) ?? []).length;
    // Same program, same request: the small model simply gets fewer tools rather
    // than an oversized prompt and a provider error.
    expect(bigTools).toBe(manyTools.length);
    expect(smallTools).toBeLessThan(bigTools);
  });

  it("carries on when the catalog records no window", async () => {
    const { client, seen } = clientWith([{ text: "ok" }], null);
    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "hi", tools: manyTools },
    });
    // Unknown is not "assume the worst" — nothing is trimmed.
    expect(res.error).toBeUndefined();
    expect((seen[0]!.tools as unknown[]).length).toBe(manyTools.length);
  });

  it("stops after a bounded number of tool rounds", async () => {
    // A model that never stops calling tools is a runaway bill, not progress.
    const { client } = clientWith([
      { text: "again", toolUses: [{ id: "t", name: "gmail.send", input: {} }], stopReason: "tool_use" },
    ]);
    const res = await runProgram(client, {
      program: { slug: "default", code: BASE_LOOP },
      capabilities: caps,
      input: { prompt: "loop forever", tools: [{ name: "gmail.send" }], maxTurns: 3 },
    });
    expect(res.output).toContain("Stopped after 3 tool rounds");
    expect(client.gateway.turn).toHaveBeenCalledTimes(3);
  });
});
