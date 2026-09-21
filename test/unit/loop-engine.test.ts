/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * The Glyphh loop end to end over a scripted gateway: a tool round runs a
 * built-in against a real temp folder, a shell step PARKS on an approval and
 * the answer resumes it, plan mode denies, the gateway-off and no-model
 * refusals read as themselves, stop aborts, and a lent MCP server's tools join
 * the toolset and are called by their real names.
 */
import { describe, it, expect } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { GlyphhLoop, GATEWAY_OFF_MESSAGE, NO_MODEL_MESSAGE, type LoopEvent } from "../../src/loop/loop.js";

type Reply = { text?: string; tool?: { id: string; name: string; input: unknown }; stop: "end_turn" | "tool_use" };

/** SSE for one model reply. */
function sseReply(r: Reply): string {
  const ev = (e: string, d: unknown): string => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
  let out = ev("message_start", { type: "message_start", message: { usage: { input_tokens: 10 } } });
  let idx = 0;
  if (r.text) {
    out += ev("content_block_start", { type: "content_block_start", index: idx, content_block: { type: "text", text: "" } });
    out += ev("content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "text_delta", text: r.text } });
    out += ev("content_block_stop", { type: "content_block_stop", index: idx });
    idx++;
  }
  if (r.tool) {
    out += ev("content_block_start", { type: "content_block_start", index: idx, content_block: { type: "tool_use", id: r.tool.id, name: r.tool.name, input: {} } });
    out += ev("content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: JSON.stringify(r.tool.input) } });
    out += ev("content_block_stop", { type: "content_block_stop", index: idx });
  }
  out += ev("message_delta", { type: "message_delta", delta: { stop_reason: r.stop }, usage: { output_tokens: 5 } });
  out += ev("message_stop", { type: "message_stop" });
  return out;
}

/** A scripted gateway (+ optional MCP server): replies in order; records bodies. */
function fakeWire(replies: Reply[], mcp?: { tools: Array<{ name: string; description: string }>; call: (name: string, args: unknown) => string }) {
  const bodies: Array<Record<string, unknown>> = [];
  const mcpCalls: Array<{ name: string; args: unknown }> = [];
  const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
    if (url.endsWith("/v1/messages")) {
      bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
      const r = replies.shift();
      if (!r) return new Response(JSON.stringify({ error: { message: "script exhausted" } }), { status: 500 });
      return new Response(sseReply(r), { status: 200, headers: { "content-type": "text/event-stream" } });
    }
    if (url.endsWith("/mcp") && mcp) {
      const req = JSON.parse(String(init.body)) as { id?: number; method: string; params?: { name?: string; arguments?: unknown } };
      if (req.method === "notifications/initialized") return new Response(null, { status: 202 });
      const result = req.method === "initialize" ? { protocolVersion: "2025-03-26", capabilities: {}, serverInfo: { name: "fake" } }
        : req.method === "tools/list" ? { tools: mcp.tools.map((t) => ({ ...t, inputSchema: { type: "object", properties: {} } })) }
        : req.method === "tools/call" ? (mcpCalls.push({ name: req.params?.name ?? "", args: req.params?.arguments }), { content: [{ type: "text", text: mcp.call(req.params?.name ?? "", req.params?.arguments) }] })
        : {};
      return new Response(JSON.stringify({ jsonrpc: "2.0", id: req.id, result }), { status: 200, headers: { "content-type": "application/json", "mcp-session-id": "s1" } });
    }
    return new Response("not found", { status: 404 });
  };
  return { fetchLike, bodies, mcpCalls };
}

const gateway = async () => ({ baseUrl: "https://gw", token: "k" });

async function collect(loop: GlyphhLoop, turn: Parameters<GlyphhLoop["run"]>[0], onEvent?: (ev: LoopEvent, loop: GlyphhLoop) => void): Promise<LoopEvent[]> {
  const events: LoopEvent[] = [];
  await loop.run(turn, (ev) => { events.push(ev); onEvent?.(ev, loop); });
  return events;
}

describe("GlyphhLoop", () => {
  it("refuses without a gateway credential, and without a model, in its own words", async () => {
    const off = new GlyphhLoop({ gateway: async () => null });
    const e1 = await collect(off, { chatId: "c1", text: "hi", model: "m" });
    expect(e1.map((e) => e.type)).toEqual(["error", "done"]);
    expect((e1[0] as { error: string }).error).toBe(GATEWAY_OFF_MESSAGE);
    const on = new GlyphhLoop({ gateway });
    const e2 = await collect(on, { chatId: "c2", text: "hi", model: "" });
    expect((e2[0] as { error: string }).error).toBe(NO_MODEL_MESSAGE);
  });

  it("runs a tool round against the working folder and streams the answer", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-"));
    writeFileSync(join(dir, "a.txt"), "alpha\n");
    const wire = fakeWire([
      { text: "Reading.", tool: { id: "t1", name: "read_file", input: { path: "a.txt" } }, stop: "tool_use" },
      { text: "It says alpha.", stop: "end_turn" },
    ]);
    const loop = new GlyphhLoop({ gateway, fetch: wire.fetchLike, host: "terminal" });
    const events = await collect(loop, { chatId: "c", text: "what is in a.txt?", model: "claude-x", workdir: dir, permission: "ask" });
    const types = events.map((e) => e.type);
    expect(types[0]).toBe("setup");
    expect(types).toContain("delta");
    expect(events.filter((e) => e.type === "tool")).toEqual([
      { type: "tool", phase: "start", name: "read_file", title: "read_file a.txt", runId: expect.any(String) },
      { type: "tool", phase: "done", name: "read_file", title: "read_file a.txt", failed: false, preview: "alpha", runId: expect.any(String) },
    ]);
    expect(events[events.length - 1]).toEqual({ type: "done", stopped: false, runId: expect.any(String) });
    // The second request carried the tool result and the cached system prompt.
    const second = wire.bodies[1]!;
    const msgs = second.messages as Array<{ role: string; content: unknown }>;
    expect(msgs[msgs.length - 1]).toEqual({ role: "user", content: [{ type: "tool_result", tool_use_id: "t1", is_error: false, content: "alpha\n" }] });
    expect((second.system as Array<{ cache_control?: unknown; text: string }>)[0]!.cache_control).toEqual({ type: "ephemeral" });
    expect((second.system as Array<{ text: string }>)[0]!.text).toContain("terminal");
    expect(second.model).toBe("claude-x");
    expect(loop.has("c")).toBe(true);
  });

  it("a shell step PARKS on an approval; the answer resumes it; a denial is a tool_result the model sees", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-"));
    const wire = fakeWire([
      { tool: { id: "t1", name: "bash", input: { command: "echo hi" } }, stop: "tool_use" },
      { tool: { id: "t2", name: "bash", input: { command: "echo no" } }, stop: "tool_use" },
      { text: "done", stop: "end_turn" },
    ]);
    const loop = new GlyphhLoop({ gateway, fetch: wire.fetchLike });
    let asked = 0;
    const events = await collect(loop, { chatId: "c", text: "run", model: "m", workdir: dir, permission: "ask" }, (ev, l) => {
      if (ev.type === "approval") {
        asked++;
        expect(GlyphhLoop.isApproval(ev.id)).toBe(true);
        expect(ev.kind).toBe("command");
        // allow the first, deny the second — answered on a later tick like a UI would
        setTimeout(() => l.respondApproval(ev.id, asked === 1), 0);
      }
    });
    expect(asked).toBe(2);
    const dones = events.filter((e): e is Extract<LoopEvent, { type: "tool"; phase: "done" }> => e.type === "tool" && e.phase === "done");
    expect(dones[0]!.failed).toBe(false);
    expect(dones[0]!.preview).toContain("hi");
    expect(dones[1]!.failed).toBe(true);
    expect(dones[1]!.preview).toBe("not permitted in this mode");
    const third = wire.bodies[2]!.messages as Array<{ content: unknown }>;
    expect(third[third.length - 1]!.content).toEqual([{ type: "tool_result", tool_use_id: "t2", is_error: true, content: "The user declined this step." }]);
  });

  it("plan mode denies edits without asking, and reads freely", async () => {
    const dir = mkdtempSync(join(tmpdir(), "gl-"));
    const wire = fakeWire([
      { tool: { id: "t1", name: "write_file", input: { path: "x", content: "y" } }, stop: "tool_use" },
      { tool: { id: "t2", name: "list_dir", input: {} }, stop: "tool_use" },
      { text: "ok", stop: "end_turn" },
    ]);
    const loop = new GlyphhLoop({ gateway, fetch: wire.fetchLike });
    const events = await collect(loop, { chatId: "c", text: "go", model: "m", workdir: dir, permission: "plan" });
    expect(events.some((e) => e.type === "approval")).toBe(false);
    const dones = events.filter((e): e is Extract<LoopEvent, { type: "tool"; phase: "done" }> => e.type === "tool" && e.phase === "done");
    expect(dones.map((d) => [d.name, d.failed])).toEqual([["write_file", true], ["list_dir", false]]);
  });

  it("stop() aborts a running turn and settles it as stopped", async () => {
    const wire = fakeWire([{ text: "…", stop: "end_turn" }]);
    const slow = async (url: string, init: RequestInit): Promise<Response> => {
      await new Promise((r, j) => { const t = setTimeout(r, 200); init.signal?.addEventListener("abort", () => { clearTimeout(t); j(new Error("aborted")); }); });
      return wire.fetchLike(url, init);
    };
    const loop = new GlyphhLoop({ gateway, fetch: slow });
    const events: LoopEvent[] = [];
    const p = loop.run({ chatId: "c", text: "hi", model: "m" }, (ev) => events.push(ev));
    await new Promise((r) => setTimeout(r, 20));
    expect(loop.stop("c")).toBe(true);
    await p;
    expect(events[events.length - 1]).toEqual({ type: "done", stopped: true, runId: expect.any(String) });
    expect(events.some((e) => e.type === "error")).toBe(false);
  });

  it("lends MCP servers: their tools join the toolset under safe names and are called by their real names", async () => {
    const wire = fakeWire(
      [{ tool: { id: "t1", name: "mcp_tool_search", input: { query: "gmail" } }, stop: "tool_use" }, { text: "found", stop: "end_turn" }],
      { tools: [{ name: "mcp_tool_search", description: "find a tool" }, { name: "weird/name", description: "x" }], call: (name, args) => `${name}:${JSON.stringify(args)}` },
    );
    const loop = new GlyphhLoop({
      gateway, fetch: wire.fetchLike,
      mcpServers: async () => [{ name: "gateway", url: "https://gw/mcp", headers: { authorization: "Bearer k" }, tag: "connection" }],
    });
    // auto: a connected tool would otherwise park on an approval (the ask path is covered above)
    const events = await collect(loop, { chatId: "c", text: "find gmail", model: "m", permission: "auto" });
    const tools = (wire.bodies[0]!.tools as Array<{ name: string }>).map((t) => t.name);
    expect(tools).toContain("read_file");
    expect(tools).toContain("mcp_tool_search");
    expect(tools).toContain("weird_name");
    expect(wire.mcpCalls).toEqual([{ name: "mcp_tool_search", args: { query: "gmail" } }]);
    const done = events.find((e) => e.type === "tool" && e.phase === "done") as { preview: string };
    expect(done.preview).toContain("mcp_tool_search:");
    expect((wire.bodies[0]!.system as Array<{ text: string }>)[0]!.text).toContain("mcp_tool_search finds");
  });

  it("toolNames lists the toolset after a turn, and compactNow folds the conversation into a summary", async () => {
    const wire = fakeWire([
      { text: "hi there", stop: "end_turn" },
      { text: "SUMMARY: greeted", stop: "end_turn" },
    ]);
    const loop = new GlyphhLoop({ gateway, fetch: wire.fetchLike });
    expect(loop.toolNames("c")).toEqual([]);
    expect((await loop.compactNow("c")).ok).toBe(false);
    await collect(loop, { chatId: "c", text: "hello", model: "m" });
    expect(loop.toolNames("c")).toContain("bash");
    const events: LoopEvent[] = [];
    const r = await loop.compactNow("c", (ev) => events.push(ev));
    expect(r).toEqual({ ok: true });
    expect(events.some((e) => e.type === "delta" && e.delta.includes("compacted"))).toBe(true);
    // The summary request went to the gateway with the chat's model.
    expect(wire.bodies[1]!.model).toBe("m");
    expect(String((wire.bodies[1]!.messages as Array<{ content: string }>)[0]!.content)).toContain("user: hello");
  });

  it("a busy chat refuses a second turn; forgetAll drops every chat", async () => {
    const wire = fakeWire([{ text: "…", stop: "end_turn" }]);
    const slow = async (url: string, init: RequestInit): Promise<Response> => { await new Promise((r) => setTimeout(r, 50)); return wire.fetchLike(url, init); };
    const loop = new GlyphhLoop({ gateway, fetch: slow });
    const first = loop.run({ chatId: "c", text: "one", model: "m" }, () => undefined);
    await new Promise((r) => setTimeout(r, 5));
    const second: LoopEvent[] = [];
    await loop.run({ chatId: "c", text: "two", model: "m" }, (ev) => second.push(ev));
    expect(second[0]!.type).toBe("error");
    await first;
    loop.forgetAll();
    expect(loop.has("c")).toBe(false);
  });
});
