/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * loop/messages.ts — the Messages API over plain fetch. The loop needs one
 * call: stream a turn, hand text deltas out as they land, and return the
 * assembled message (content blocks, stop reason, usage). No vendor package:
 * the SDK stays dependency-free and the same code runs in the desktop's main
 * process and the CLI.
 *
 * The wire is the gateway's Anthropic-shaped edge (`${baseUrl}/v1/messages`)
 * with the member's own key, so allow-lists, budgets and prompt caching apply.
 */

export type TextBlock = { type: "text"; text: string };
export type ToolUseBlock = { type: "tool_use"; id: string; name: string; input: unknown };
export type OtherBlock = { type: string; [k: string]: unknown };
export type ContentBlock = TextBlock | ToolUseBlock | OtherBlock;
export type ToolResultBlock = { type: "tool_result"; tool_use_id: string; content: string; is_error?: boolean };
export type TextParam = { type: "text"; text: string; cache_control?: { type: "ephemeral" } };
export interface MessageParam { role: "user" | "assistant"; content: string | Array<ContentBlock | ToolResultBlock> }
export interface ToolSpec { name: string; description: string; input_schema: Record<string, unknown> }

export interface MessageUsage { input_tokens: number; output_tokens: number; cache_read_input_tokens: number }
export interface AssembledMessage { content: ContentBlock[]; stop_reason: string | null; usage: MessageUsage }

export interface MessagesBody {
  model: string;
  max_tokens: number;
  system?: string | TextParam[];
  messages: MessageParam[];
  tools?: ToolSpec[];
}

export type FetchLike = (input: string, init: RequestInit) => Promise<Response>;

export interface StreamMessageOptions {
  baseUrl: string;
  token: string;
  body: MessagesBody;
  signal?: AbortSignal;
  fetch?: FetchLike;
  /** Streamed text as it arrives. */
  onText?: (delta: string) => void;
  /** Per-request timeout (default 10 minutes — a long tool-heavy turn). */
  timeoutMs?: number;
}

export const isTextBlock = (b: ContentBlock): b is TextBlock => b.type === "text" && typeof (b as TextBlock).text === "string";
export const isToolUseBlock = (b: ContentBlock): b is ToolUseBlock => b.type === "tool_use" && typeof (b as ToolUseBlock).name === "string";

interface SseEvent { event: string; data: string }

/** Split an SSE byte stream into events. Handles CRLF and multi-line data. */
export async function* sseEvents(body: ReadableStream<Uint8Array>): AsyncGenerator<SseEvent> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  const parse = (raw: string): SseEvent | null => {
    let event = "message";
    const data: string[] = [];
    for (const line of raw.split("\n")) {
      if (line.startsWith("event:")) event = line.slice(6).trim();
      else if (line.startsWith("data:")) data.push(line.slice(5).replace(/^ /, ""));
    }
    return data.length ? { event, data: data.join("\n") } : null;
  };
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true }).replace(/\r\n/g, "\n");
      let at: number;
      while ((at = buf.indexOf("\n\n")) >= 0) {
        const raw = buf.slice(0, at);
        buf = buf.slice(at + 2);
        const ev = parse(raw);
        if (ev) yield ev;
      }
    }
    const tail = parse(buf);
    if (tail) yield tail;
  } finally {
    reader.releaseLock();
  }
}

/** Assemble a streamed Messages response from its events. Exported for tests. */
export async function assembleStream(events: AsyncIterable<SseEvent>, onText?: (delta: string) => void): Promise<AssembledMessage> {
  const blocks: ContentBlock[] = [];
  const partialJson: string[] = [];
  const usage: MessageUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0 };
  let stop: string | null = null;
  for await (const ev of events) {
    let j: Record<string, unknown>;
    try { j = JSON.parse(ev.data) as Record<string, unknown>; } catch { continue; }
    const type = String(j.type ?? ev.event);
    if (type === "message_start") {
      const u = ((j.message as Record<string, unknown> | undefined)?.usage ?? {}) as Record<string, unknown>;
      usage.input_tokens = Number(u.input_tokens ?? 0) || 0;
      usage.cache_read_input_tokens = Number(u.cache_read_input_tokens ?? 0) || 0;
      usage.output_tokens = Number(u.output_tokens ?? 0) || 0;
    } else if (type === "content_block_start") {
      const idx = Number(j.index ?? blocks.length);
      const cb = (j.content_block ?? { type: "text", text: "" }) as ContentBlock;
      blocks[idx] = isToolUseBlock(cb) ? { ...cb, input: {} } : isTextBlock(cb) ? { type: "text", text: cb.text } : cb;
      partialJson[idx] = "";
    } else if (type === "content_block_delta") {
      const idx = Number(j.index ?? 0);
      const d = (j.delta ?? {}) as Record<string, unknown>;
      const cur = blocks[idx];
      if (d.type === "text_delta" && typeof d.text === "string") {
        if (cur && isTextBlock(cur)) cur.text += d.text;
        else blocks[idx] = { type: "text", text: d.text };
        onText?.(d.text);
      } else if (d.type === "input_json_delta" && typeof d.partial_json === "string") {
        partialJson[idx] = (partialJson[idx] ?? "") + d.partial_json;
      }
    } else if (type === "content_block_stop") {
      const idx = Number(j.index ?? 0);
      const cur = blocks[idx];
      const raw = partialJson[idx] ?? "";
      if (cur && isToolUseBlock(cur) && raw.trim()) {
        try { cur.input = JSON.parse(raw); } catch { cur.input = {}; }
      }
    } else if (type === "message_delta") {
      const d = (j.delta ?? {}) as Record<string, unknown>;
      if (typeof d.stop_reason === "string") stop = d.stop_reason;
      const u = (j.usage ?? {}) as Record<string, unknown>;
      if (u.output_tokens !== undefined) usage.output_tokens = Number(u.output_tokens) || usage.output_tokens;
      if (u.input_tokens !== undefined) usage.input_tokens = Number(u.input_tokens) || usage.input_tokens;
    } else if (type === "error") {
      const e = (j.error ?? {}) as Record<string, unknown>;
      throw new Error(String(e.message ?? e.type ?? "the model returned an error"));
    }
  }
  return { content: blocks.filter((b): b is ContentBlock => !!b), stop_reason: stop, usage };
}

/** One buffered (non-streamed) response body as an assembled message. */
function fromJson(j: Record<string, unknown>): AssembledMessage {
  const u = (j.usage ?? {}) as Record<string, unknown>;
  return {
    content: Array.isArray(j.content) ? (j.content as ContentBlock[]) : [],
    stop_reason: typeof j.stop_reason === "string" ? j.stop_reason : null,
    usage: {
      input_tokens: Number(u.input_tokens ?? 0) || 0,
      output_tokens: Number(u.output_tokens ?? 0) || 0,
      cache_read_input_tokens: Number(u.cache_read_input_tokens ?? 0) || 0,
    },
  };
}

function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; clear: () => void } {
  const ctl = new AbortController();
  const onAbort = (): void => ctl.abort(signal?.reason);
  if (signal?.aborted) ctl.abort(signal.reason);
  else signal?.addEventListener("abort", onAbort, { once: true });
  const timer = setTimeout(() => ctl.abort(new Error("the model did not answer in time")), ms);
  return { signal: ctl.signal, clear: () => { clearTimeout(timer); signal?.removeEventListener("abort", onAbort); } };
}

/** Stream one turn and return the assembled message. Throws on a non-2xx with
 *  the gateway's own words (`gateway 402: budget exceeded`), so a budget wall or
 *  an allow-list refusal reads as itself in the transcript. */
export async function streamMessage(opts: StreamMessageOptions): Promise<AssembledMessage> {
  const doFetch: FetchLike = opts.fetch ?? ((u, i) => fetch(u, i));
  const t = withTimeout(opts.signal, opts.timeoutMs ?? 600_000);
  try {
    const res = await doFetch(`${opts.baseUrl.replace(/\/+$/, "")}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "text/event-stream",
        authorization: `Bearer ${opts.token}`,
        "x-api-key": opts.token,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({ ...opts.body, stream: true }),
      signal: t.signal,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      let said = text.slice(0, 400);
      try { const j = JSON.parse(text) as { error?: { message?: string } | string; message?: string }; said = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? said; } catch { /* plain text */ }
      throw new Error(`gateway ${res.status}: ${said || res.statusText}`);
    }
    const ctype = res.headers.get("content-type") ?? "";
    if (!ctype.includes("text/event-stream")) {
      const j = (await res.json()) as Record<string, unknown>;
      const m = fromJson(j);
      for (const b of m.content) if (isTextBlock(b) && b.text) opts.onText?.(b.text);
      return m;
    }
    if (!res.body) throw new Error("the gateway returned no body");
    return await assembleStream(sseEvents(res.body), opts.onText);
  } finally {
    t.clear();
  }
}
