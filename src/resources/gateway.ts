/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/gateway.ts — run a metered model turn.
 *
 * This is the only way a client reaches a model. Provider keys stay server-side
 * (write-only, decrypted for the upstream call alone), so the call ORIGINATES on
 * the server: that is what makes the workspace allow-list, credit accounting, and
 * the model-governance audit true at execution time rather than advisory.
 *
 * `complete()` is the single-shot, text-in/text-out path — history folding,
 * summaries, one-shot tool calls. Streaming agent turns ride the session
 * transport, not this.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { GatewayCompletion, GatewayCompletionInput } from "../contract/gateway.js";

export class GatewayClient {
  constructor(private readonly http: AuthedHttp) {}

  /**
   * One metered completion. Refused (402) when the org is out of credits — this
   * is a prepaid system with no arrears, and there is no free local fallback, so
   * callers should surface that rather than silently degrading.
   */
  complete(input: GatewayCompletionInput): Promise<GatewayCompletion> {
    const { maxTokens, ...rest } = input;
    return this.http.post<GatewayCompletion>(
      "/api/gateway/v1/chat/completions",
      { ...rest, ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}) },
      // The gateway answers an OpenAI body verbatim, not the `{ data }` envelope.
      { raw: true },
    );
  }

  /**
   * An Anthropic Messages turn, returned as the RAW streaming response.
   *
   * This is what an agent loop rides: the body (SSE or JSON) is relayed to the
   * caller untouched, and the status is theirs to read — an Agent SDK uses 429/529
   * to decide when to retry, so reinterpreting them here would break it.
   *
   * The caller supplies the Anthropic-shaped body; the SDK supplies the path, the
   * base URL, and the bearer. Nothing addresses the control plane directly.
   */
  messages(
    body: unknown,
    opts: { headers?: Record<string, string>; signal?: AbortSignal } = {},
  ): Promise<Response> {
    return this.http.stream("/api/gateway/v1/messages", body, opts);
  }

  /** The completion's text, or "" — the common case for utility turns. */
  async text(input: GatewayCompletionInput): Promise<string> {
    const completion = await this.complete(input);
    return completion.choices?.[0]?.message?.content ?? "";
  }
}
