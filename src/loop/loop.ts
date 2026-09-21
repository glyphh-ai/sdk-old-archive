/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * loop/loop.ts — THE GLYPHH LOOP: our own agent loop, a supported loop beside
 * claude/codex/gemini, on ANY model the gateway serves. ONE engine, several
 * hosts: the desktop's Agent panel and the `glyphh` CLI both run this class;
 * only the host seams differ (who supplies the gateway credential, which MCP
 * servers to lend, how events are rendered).
 *
 * It exists only on the gateway lane: the Messages calls go to the gateway on
 * the member's own key, so the org's allow-list, budgets and per-org prompt
 * caching apply and every turn lands in Usage. No vendor login.
 *
 * Tools: the built-ins (files + shell, tools.ts) and whatever MCP servers the
 * host lends (the desktop's local server, the gateway's connection tools).
 * Permission is Glyphh's one vocabulary projected onto tool kinds (core.ts);
 * an ask parks the run until `respondApproval`. Prompt caching marks the
 * system prompt; a long conversation is compacted by the model itself.
 *
 * State is process memory: a chat's messages live here for the process's life
 * and re-seed from the host's stored turns (nothing of ours on disk).
 */

import { homedir } from "node:os";
import {
  gate, toolKind, seedFromChat, shouldCompact, safeToolName, toolTitle, preview, systemPrompt,
  MAX_TOKENS_OUT, MAX_TOOL_ROUNDS, type LoopHost, type LoopPermission, type SeedTurn,
} from "./core.js";
import { BUILTIN_TOOLS, runBuiltin } from "./tools.js";
import { McpHttpClient, resultText } from "./mcp.js";
import {
  streamMessage, isTextBlock, isToolUseBlock,
  type ContentBlock, type FetchLike, type MessageParam, type TextParam, type ToolResultBlock, type ToolSpec,
} from "./messages.js";

// ── the host contract ────────────────────────────────────────────────────────

export interface LoopGateway { baseUrl: string; token: string }

export interface LoopMcpServer {
  /** A short name for the client handshake and logs. */
  name: string;
  url: string;
  headers?: Record<string, string>;
  /** The word the tool descriptions fall back to ("Glyphh tool x", "connection tool y"). */
  tag: string;
}

export interface LoopDeps {
  /** The member's gateway credential, or null when the org's gateway lane is off. */
  gateway: () => Promise<LoopGateway | null>;
  /** MCP servers to lend this process's runs (resolved once per chat). */
  mcpServers?: () => Promise<LoopMcpServer[]>;
  /** Re-point the Messages base URL for a chat (the desktop's memory bridge). Null = as given. */
  baseUrlFor?: (gateway: LoopGateway, scope: { folder: string; workspace?: string }) => Promise<string | null>;
  host?: LoopHost;
  fetch?: FetchLike;
  /** A warning sink for a lent server that would not connect (never fatal). */
  warn?: (message: string) => void;
}

export type LoopEvent =
  | { type: "setup"; phase: "ready"; model: string; loop: "glyphh" }
  | { type: "delta"; delta: string }
  | { type: "tool"; phase: "start"; name: string; title: string }
  | { type: "tool"; phase: "done"; name: string; title: string; failed: boolean; preview: string }
  | { type: "progress"; inTokens: number; outTokens: number; cacheReadTokens: number }
  | { type: "approval"; id: string; kind: "command" | "edit" | "tool"; title: string; detail: string }
  | { type: "permission"; permission: LoopPermission }
  | { type: "done"; stopped: boolean }
  | { type: "error"; error: string };

export type LoopEmit = (event: LoopEvent & { runId: string }) => void;

export interface LoopTurn {
  chatId: string;
  /** The user's message. Empty re-runs nothing new (a continuation). */
  text: string;
  /** The bare model id. The host resolves it (its picker, the org's default). */
  model: string;
  permission?: LoopPermission;
  workdir?: string;
  workspace?: string;
  /** The chat's stored turns, to seed a conversation this process has not seen. */
  history?: SeedTurn[];
}

interface McpTool { client: McpHttpClient; realName: string }

interface LoopChat {
  chatId: string;
  messages: MessageParam[];
  model: string;
  permission: LoopPermission;
  workdir: string;
  runId: string;
  emit: LoopEmit;
  abort: AbortController | null;
  running: boolean;
  nextApproval: number;
  approvals: Map<string, (allow: boolean) => void>;
  usage: { inTokens: number; outTokens: number; cacheRead: number };
  mcp: Map<string, McpTool>;
  clients: McpHttpClient[];
  tools: ToolSpec[] | null;
  hasLocalMcp: boolean;
  hasGateway: boolean;
}

export const GATEWAY_OFF_MESSAGE = "The Glyphh loop runs on the gateway. Your organization's gateway lane is off; an org admin turns it on under Settings → Organization.";
export const NO_MODEL_MESSAGE = "Pick a model for the Glyphh loop: any model your organization runs on the gateway.";
export const BUSY_MESSAGE = "The Glyphh loop is still working on the last message. Stop it or wait for it to finish.";

export class GlyphhLoop {
  private readonly chats = new Map<string, LoopChat>();

  constructor(private readonly deps: LoopDeps) {}

  has(chatId: string): boolean { return this.chats.has(chatId); }

  /** An approval id this loop minted (`<chatId>:g<n>`). */
  static isApproval(id: string): boolean { return /:g\d+$/.test(id); }

  private send(c: LoopChat, ev: LoopEvent): void {
    try { c.emit({ runId: c.runId, ...ev }); } catch { /* the host's sink is gone */ }
  }

  // ── tools ──────────────────────────────────────────────────────────────────

  private async lentTools(c: LoopChat): Promise<ToolSpec[]> {
    const defs: ToolSpec[] = [];
    const servers = this.deps.mcpServers ? await this.deps.mcpServers().catch(() => [] as LoopMcpServer[]) : [];
    for (const s of servers) {
      const client = new McpHttpClient({ url: s.url, ...(s.headers ? { headers: s.headers } : {}), name: s.name, ...(this.deps.fetch ? { fetch: this.deps.fetch } : {}) });
      try {
        await client.connect();
        const listed = await client.listTools();
        c.clients.push(client);
        for (const t of listed) {
          const name = safeToolName(t.name);
          if (defs.some((d) => d.name === name) || BUILTIN_TOOLS.some((b) => b.name === name)) continue;
          c.mcp.set(name, { client, realName: t.name });
          defs.push({ name, description: (t.description ?? `${s.tag} tool ${t.name}`).slice(0, 1000), input_schema: t.inputSchema ?? { type: "object", properties: {} } });
        }
        if (s.tag === "Glyphh") c.hasLocalMcp = true;
      } catch (err) {
        this.deps.warn?.(`[glyphh-loop] ${s.name} unavailable: ${err instanceof Error ? err.message : String(err)}`);
        void client.close();
      }
    }
    c.hasGateway = c.mcp.has("mcp_tool_search");
    return defs;
  }

  private async toolset(c: LoopChat): Promise<ToolSpec[]> {
    if (c.tools) return c.tools;
    const builtins: ToolSpec[] = BUILTIN_TOOLS.map((t) => ({ name: t.name, description: t.description, input_schema: t.input_schema }));
    c.tools = [...builtins, ...(await this.lentTools(c))];
    return c.tools;
  }

  private async runTool(c: LoopChat, name: string, input: unknown, signal: AbortSignal): Promise<{ text: string; failed: boolean }> {
    if (BUILTIN_TOOLS.some((b) => b.name === name)) return runBuiltin(name, input, c.workdir, signal);
    const m = c.mcp.get(name);
    if (!m) return { text: `unknown tool ${name}`, failed: true };
    try {
      const r = await m.client.callTool(m.realName, (input && typeof input === "object" ? input : {}) as Record<string, unknown>, signal);
      return { text: resultText(r), failed: r.isError };
    } catch (err) {
      return { text: err instanceof Error ? err.message : String(err), failed: true };
    }
  }

  /** Park the run on an approval; the host's answer resolves it. */
  private askPermission(c: LoopChat, kind: "command" | "edit" | "tool", title: string, detail: string): Promise<boolean> {
    const id = `${c.chatId}:g${c.nextApproval++}`;
    return new Promise((resolve) => {
      c.approvals.set(id, resolve);
      this.send(c, { type: "approval", id, kind, title, detail: detail.slice(0, 2000) });
    });
  }

  // ── the loop ───────────────────────────────────────────────────────────────

  private chatFor(t: LoopTurn, emit: LoopEmit): LoopChat {
    let c = this.chats.get(t.chatId);
    if (!c) {
      const seeded = seedFromChat(t.history ?? [], t.text).map((m): MessageParam => ({ role: m.role, content: m.content }));
      c = {
        chatId: t.chatId, messages: seeded, model: "", permission: t.permission ?? "ask", workdir: t.workdir || homedir(), runId: "", emit,
        abort: null, running: false, nextApproval: 1, approvals: new Map(), usage: { inTokens: 0, outTokens: 0, cacheRead: 0 }, mcp: new Map(), clients: [], tools: null,
        hasLocalMcp: false, hasGateway: false,
      };
      this.chats.set(t.chatId, c);
    }
    c.emit = emit;
    if (t.permission) c.permission = t.permission;
    if (t.workdir) c.workdir = t.workdir;
    return c;
  }

  private async compact(c: LoopChat, wire: { baseUrl: string; token: string }, signal: AbortSignal): Promise<void> {
    const transcript = c.messages.map((m) => `${m.role}: ${typeof m.content === "string" ? m.content : JSON.stringify(m.content).slice(0, 4000)}`).join("\n\n");
    const res = await streamMessage({
      ...wire, signal, ...(this.deps.fetch ? { fetch: this.deps.fetch } : {}),
      body: {
        model: c.model, max_tokens: 2000,
        system: "Summarize this conversation for the assistant that will continue it: goals, decisions, files touched, open threads, and anything the user asked to remember. Terse, factual, no preamble.",
        messages: [{ role: "user", content: transcript.slice(-400_000) }],
      },
    });
    const summary = res.content.filter(isTextBlock).map((b) => b.text).join("\n");
    c.messages = [{ role: "user", content: `Summary of the conversation so far:\n\n${summary}` }, { role: "assistant", content: "Understood. I have the context and will continue from here." }];
    this.send(c, { type: "delta", delta: "\n\n(compacted the earlier conversation)\n\n" });
  }

  /** One turn. Resolves when the run has settled (done or error emitted). */
  async run(t: LoopTurn, emit: LoopEmit): Promise<{ runId: string }> {
    const c = this.chatFor(t, emit);
    c.runId = `${t.chatId}:${Date.now()}`;
    const fail = (error: string): { runId: string } => {
      this.send(c, { type: "error", error });
      this.send(c, { type: "done", stopped: true });
      return { runId: c.runId };
    };
    if (c.running) return fail(BUSY_MESSAGE);
    const creds = await this.deps.gateway().catch(() => null);
    if (!creds) return fail(GATEWAY_OFF_MESSAGE);
    const model = (t.model ?? "").trim();
    if (!model) return fail(NO_MODEL_MESSAGE);
    c.model = model;
    c.running = true;
    c.abort = new AbortController();
    const signal = c.abort.signal;
    const scope = { folder: c.workdir, ...(t.workspace ? { workspace: t.workspace } : {}) };
    const baseUrl = (this.deps.baseUrlFor ? await this.deps.baseUrlFor(creds, scope).catch(() => null) : null) ?? creds.baseUrl;
    const wire = { baseUrl, token: creds.token };
    this.send(c, { type: "setup", phase: "ready", model, loop: "glyphh" });
    if (t.text) c.messages.push({ role: "user", content: t.text });
    try {
      const tools = await this.toolset(c);
      const system: TextParam[] = [{ type: "text", text: systemPrompt(c.workdir, { hasLocalMcp: c.hasLocalMcp, hasGateway: c.hasGateway, ...(this.deps.host ? { host: this.deps.host } : {}) }), cache_control: { type: "ephemeral" } }];
      for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
        if (signal.aborted) break;
        const final = await streamMessage({
          ...wire, signal, ...(this.deps.fetch ? { fetch: this.deps.fetch } : {}),
          body: { model, max_tokens: MAX_TOKENS_OUT, system, messages: c.messages, tools },
          onText: (delta) => this.send(c, { type: "delta", delta }),
        });
        c.usage.inTokens += final.usage.input_tokens;
        c.usage.outTokens += final.usage.output_tokens;
        c.usage.cacheRead += final.usage.cache_read_input_tokens;
        this.send(c, { type: "progress", inTokens: c.usage.inTokens, outTokens: c.usage.outTokens, cacheReadTokens: c.usage.cacheRead });
        c.messages.push({ role: "assistant", content: final.content as ContentBlock[] });
        const uses = final.content.filter(isToolUseBlock);
        if (final.stop_reason !== "tool_use" || !uses.length) break;
        const results: ToolResultBlock[] = [];
        for (const use of uses) {
          if (signal.aborted) break;
          const kind = toolKind(use.name);
          const title = toolTitle(use.name, use.input);
          let verdict = gate(c.permission, kind);
          if (verdict === "ask") {
            const askKind = kind === "exec" ? "command" : kind === "edit" ? "edit" : "tool";
            verdict = (await this.askPermission(c, askKind, title, JSON.stringify(use.input ?? {}, null, 2))) ? "allow" : "deny";
          }
          if (verdict === "deny") {
            this.send(c, { type: "tool", phase: "done", name: use.name, title, failed: true, preview: "not permitted in this mode" });
            results.push({ type: "tool_result", tool_use_id: use.id, is_error: true, content: c.permission === "plan" ? "Not run: plan mode reads only. Describe the change instead." : "The user declined this step." });
            continue;
          }
          this.send(c, { type: "tool", phase: "start", name: use.name, title });
          const r = await this.runTool(c, use.name, use.input, signal);
          this.send(c, { type: "tool", phase: "done", name: use.name, title, failed: r.failed, preview: preview(r.text) });
          results.push({ type: "tool_result", tool_use_id: use.id, is_error: r.failed, content: r.text.slice(0, 200_000) });
        }
        c.messages.push({ role: "user", content: results });
        if (shouldCompact(final.usage.input_tokens)) await this.compact(c, wire, signal);
      }
      this.send(c, { type: "done", stopped: signal.aborted });
    } catch (err) {
      const said = err instanceof Error ? err.message : String(err);
      if (!signal.aborted) this.send(c, { type: "error", error: said });
      this.send(c, { type: "done", stopped: true });
    } finally {
      c.running = false;
      c.abort = null;
      for (const resolve of c.approvals.values()) resolve(false);
      c.approvals.clear();
    }
    return { runId: c.runId };
  }

  stop(chatId: string): boolean {
    const c = this.chats.get(chatId);
    if (!c || !c.running) return false;
    c.abort?.abort();
    return true;
  }

  setPermission(chatId: string, permission: LoopPermission): boolean {
    const c = this.chats.get(chatId);
    if (!c) return false;
    c.permission = permission;
    this.send(c, { type: "permission", permission });
    return true;
  }

  respondApproval(id: string, allow: boolean): boolean {
    const chatId = id.split(":")[0] ?? "";
    const c = this.chats.get(chatId);
    const resolve = c?.approvals.get(id);
    if (!c || !resolve) return false;
    c.approvals.delete(id);
    resolve(allow);
    return true;
  }

  /** Drop one chat (its MCP sessions closed). */
  forget(chatId: string): void {
    const c = this.chats.get(chatId);
    if (!c) return;
    c.abort?.abort();
    for (const cl of c.clients) void cl.close();
    this.chats.delete(chatId);
  }

  /** Sign-out: nothing of the last member's conversations stays in memory. */
  forgetAll(): void {
    for (const id of [...this.chats.keys()]) this.forget(id);
  }
}
