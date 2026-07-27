/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/anthropic-openai.ts — Anthropic Messages ⇄ OpenAI chat-completions,
 * MIRRORED from the server's gateway/translate/openai.ts (keep in sync). The
 * interceptor's LOCAL branch needs the same translation the gateway does —
 * llama-server speaks OpenAI chat-completions — but must work fully offline,
 * so the converter lives in the SDK too rather than importing across repos.
 */
/** Anthropic content blocks we read. Unknown block types pass through as text. */
interface AnthropicBlock {
  type: string;
  text?: string;
  id?: string;
  name?: string;
  input?: unknown;
  tool_use_id?: string;
  content?: unknown;
}

interface AnthropicMessage {
  role: string;
  content: string | AnthropicBlock[];
}

export interface AnthropicRequest {
  model: string;
  messages: AnthropicMessage[];
  system?: string | AnthropicBlock[];
  max_tokens?: number;
  temperature?: number;
  top_p?: number;
  stream?: boolean;
  tools?: Array<{ name: string; description?: string; input_schema?: unknown }>;
  tool_choice?: { type: string; name?: string };
}

interface OpenAIMessage {
  role: string;
  content: string | null;
  tool_calls?: Array<{ id: string; type: "function"; function: { name: string; arguments: string } }>;
  tool_call_id?: string;
}

/** Flatten Anthropic content to the plain text OpenAI wants for a `tool` message. */
function textOf(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (typeof b === "string" ? b : ((b as AnthropicBlock)?.text ?? JSON.stringify(b))))
      .join("");
  }
  return content == null ? "" : JSON.stringify(content);
}

/**
 * Anthropic request → OpenAI request.
 *
 * One Anthropic message can become SEVERAL OpenAI messages: an assistant turn that
 * both spoke and called two tools is one message with a content block list on one
 * side, and an assistant message plus two tool messages on the other.
 */
export function toOpenAIRequest(req: AnthropicRequest, model: string): Record<string, unknown> {
  const messages: OpenAIMessage[] = [];

  // Anthropic keeps `system` top-level; OpenAI wants it as the first message.
  if (req.system) {
    const system = textOf(req.system);
    if (system) messages.push({ role: "system", content: system });
  }

  for (const m of req.messages) {
    if (typeof m.content === "string") {
      messages.push({ role: m.role, content: m.content });
      continue;
    }
    const blocks = m.content ?? [];
    const text = blocks.filter((b) => b.type === "text").map((b) => b.text ?? "").join("");
    const toolUses = blocks.filter((b) => b.type === "tool_use");
    const toolResults = blocks.filter((b) => b.type === "tool_result");

    // A tool RESULT is its own OpenAI message, keyed to the call it answers.
    for (const r of toolResults) {
      messages.push({ role: "tool", tool_call_id: r.tool_use_id ?? "", content: textOf(r.content) });
    }

    if (toolUses.length) {
      messages.push({
        role: "assistant",
        // OpenAI wants null, not "", when an assistant turn is only tool calls.
        content: text || null,
        tool_calls: toolUses.map((u) => ({
          id: u.id ?? "",
          type: "function" as const,
          // Anthropic carries structured input; OpenAI wants it stringified.
          function: { name: u.name ?? "", arguments: JSON.stringify(u.input ?? {}) },
        })),
      });
    } else if (text || !toolResults.length) {
      messages.push({ role: m.role, content: text });
    }
  }

  const out: Record<string, unknown> = { model, messages };
  if (req.max_tokens !== undefined) out.max_tokens = req.max_tokens;
  if (req.temperature !== undefined) out.temperature = req.temperature;
  if (req.top_p !== undefined) out.top_p = req.top_p;
  if (req.stream) {
    out.stream = true;
    // Without this OpenAI omits usage from the stream entirely and the turn bills
    // as zero. Metering depends on it.
    out.stream_options = { include_usage: true };
  }
  if (req.tools?.length) {
    out.tools = req.tools.map((t) => ({
      type: "function",
      function: {
        name: t.name,
        ...(t.description ? { description: t.description } : {}),
        parameters: t.input_schema ?? { type: "object", properties: {} },
      },
    }));
  }
  if (req.tool_choice) {
    out.tool_choice =
      req.tool_choice.type === "any" ? "required"
        : req.tool_choice.type === "tool" && req.tool_choice.name
          ? { type: "function", function: { name: req.tool_choice.name } }
          : "auto";
  }
  return out;
}

/** OpenAI finish reasons → Anthropic stop reasons. */
function stopReason(finish: string | null | undefined): string {
  switch (finish) {
    case "length": return "max_tokens";
    case "tool_calls":
    case "function_call": return "tool_use";
    case "content_filter": return "stop_sequence";
    default: return "end_turn";
  }
}

interface OpenAICompletion {
  id?: string;
  model?: string;
  choices?: Array<{
    message?: { content?: string | null; tool_calls?: Array<{ id?: string; function?: { name?: string; arguments?: string } }> };
    finish_reason?: string | null;
  }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

/** Parse tool arguments, falling back to an empty object — a malformed fragment
 *  should not take down the whole turn. */
function parseArgs(raw: string | undefined): unknown {
  if (!raw) return {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/** OpenAI completion → Anthropic message. */
export function toAnthropicResponse(completion: OpenAICompletion, model: string): Record<string, unknown> {
  const choice = completion.choices?.[0];
  const content: AnthropicBlock[] = [];
  if (choice?.message?.content) content.push({ type: "text", text: choice.message.content });
  for (const call of choice?.message?.tool_calls ?? []) {
    content.push({
      type: "tool_use",
      id: call.id ?? `toolu_${Math.random().toString(36).slice(2)}`,
      name: call.function?.name ?? "",
      input: parseArgs(call.function?.arguments),
    });
  }
  return {
    id: completion.id ?? `msg_${Date.now().toString(36)}`,
    type: "message",
    role: "assistant",
    model,
    content,
    stop_reason: stopReason(choice?.finish_reason),
    stop_sequence: null,
    usage: {
      input_tokens: Math.max(0, Math.trunc(completion.usage?.prompt_tokens ?? 0)),
      output_tokens: Math.max(0, Math.trunc(completion.usage?.completion_tokens ?? 0)),
    },
  };
}

function frame(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

/**
 * A stateful OpenAI-SSE → Anthropic-SSE translator.
 *
 * Feed it raw chunks; it returns the Anthropic frames to write. State is required
 * because the two protocols disagree about structure: OpenAI emits a flat sequence
 * of deltas and lets the consumer infer boundaries, while Anthropic demands explicit
 * indexed blocks. So we open a block the first time content of a kind appears and
 * close every open block before finishing.
 */
export function createStreamTranslator(model: string) {
  let buffer = "";
  let started = false;
  let textOpen = false;
  /** OpenAI tool-call index → the Anthropic block index we opened for it. */
  const toolBlocks = new Map<number, number>();
  let nextIndex = 0;
  let finish: string | null = null;
  let inputTokens = 0;
  let outputTokens = 0;
  let done = false;

  function start(): string {
    started = true;
    return frame("message_start", {
      type: "message_start",
      message: {
        id: `msg_${Date.now().toString(36)}`,
        type: "message",
        role: "assistant",
        model,
        content: [],
        stop_reason: null,
        stop_sequence: null,
        usage: { input_tokens: inputTokens, output_tokens: 0 },
      },
    });
  }

  return {
    /** Translate one raw chunk into zero or more Anthropic frames. */
    feed(chunk: string): string {
      let out = "";
      buffer += chunk;
      let nl: number;
      while ((nl = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (!line.startsWith("data:")) continue;
        const payload = line.slice(5).trim();
        if (!payload) continue;
        if (payload === "[DONE]") { done = true; continue; }

        let event: OpenAICompletion & {
          choices?: Array<{
            delta?: { content?: string | null; tool_calls?: Array<{ index?: number; id?: string; function?: { name?: string; arguments?: string } }> };
            finish_reason?: string | null;
          }>;
        };
        try {
          event = JSON.parse(payload);
        } catch {
          continue; // keep-alive or a split frame — the next chunk completes it
        }

        // Usage arrives on its own final chunk (stream_options.include_usage).
        if (event.usage) {
          inputTokens = Math.max(inputTokens, Math.trunc(event.usage.prompt_tokens ?? 0));
          outputTokens = Math.max(outputTokens, Math.trunc(event.usage.completion_tokens ?? 0));
        }

        const choice = event.choices?.[0];
        if (!choice) continue;
        if (!started) out += start();

        const delta = choice.delta;
        if (delta?.content) {
          if (!textOpen) {
            textOpen = true;
            out += frame("content_block_start", {
              type: "content_block_start", index: nextIndex, content_block: { type: "text", text: "" },
            });
            nextIndex += 1;
          }
          out += frame("content_block_delta", {
            type: "content_block_delta", index: nextIndex - 1,
            delta: { type: "text_delta", text: delta.content },
          });
        }

        for (const call of delta?.tool_calls ?? []) {
          const key = call.index ?? 0;
          let index = toolBlocks.get(key);
          if (index === undefined) {
            // A tool call's name arrives once, on its first fragment; the
            // arguments then stream in as raw JSON pieces.
            index = nextIndex++;
            toolBlocks.set(key, index);
            out += frame("content_block_start", {
              type: "content_block_start", index,
              content_block: { type: "tool_use", id: call.id ?? `toolu_${key}`, name: call.function?.name ?? "", input: {} },
            });
          }
          if (call.function?.arguments) {
            out += frame("content_block_delta", {
              type: "content_block_delta", index,
              delta: { type: "input_json_delta", partial_json: call.function.arguments },
            });
          }
        }

        if (choice.finish_reason) finish = choice.finish_reason;
      }
      return out;
    },

    /** Close every open block and finish the message. Idempotent. */
    end(): string {
      if (!started) return "";
      let out = "";
      if (textOpen) {
        out += frame("content_block_stop", { type: "content_block_stop", index: 0 });
        textOpen = false;
      }
      for (const index of toolBlocks.values()) {
        out += frame("content_block_stop", { type: "content_block_stop", index });
      }
      toolBlocks.clear();
      out += frame("message_delta", {
        type: "message_delta",
        delta: { stop_reason: stopReason(finish), stop_sequence: null },
        usage: { output_tokens: outputTokens },
      });
      out += frame("message_stop", { type: "message_stop" });
      return out;
    },

    usage(): { inputTokens: number; outputTokens: number; cacheWriteTokens: number; cacheReadTokens: number } {
      // OpenAI-spec providers fold cached tokens into prompt_tokens — there is
      // no separate cache accounting to bill, so both counts are zero here.
      return { inputTokens, outputTokens, cacheWriteTokens: 0, cacheReadTokens: 0 };
    },

    sawDone(): boolean {
      return done;
    },
  };
}
