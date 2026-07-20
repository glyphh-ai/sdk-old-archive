/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/gateway.ts — run one metered completion. The CLI face of the single
 * model egress: `glyphh complete <model> "<prompt>"`.
 */

import type { CommandRegistry } from "../registry.js";

export function registerGateway(reg: CommandRegistry): void {
  reg.register({
    path: "messages",
    summary: "one Anthropic Messages turn, printed raw (what an agent loop rides)",
    usage: 'messages <model> "<prompt>" [--max <tokens>] [--stream]',
    covers: ["gateway.messages"],
    async run(ctx, args) {
      const [model, prompt] = args.positional;
      if (!model || !prompt) return ctx.print('usage: messages <model> "<prompt>" [--max <tokens>] [--stream]');
      const upstream = await ctx.client.gateway.messages({
        model,
        max_tokens: args.flags.max ? Number(args.flags.max) : 1024,
        ...(args.flags.stream ? { stream: true } : {}),
        messages: [{ role: "user", content: prompt }],
      });
      // Raw on purpose: SSE frames or the JSON body, exactly as the loop sees them.
      ctx.print(await upstream.text());
    },
  });

  reg.register({
    path: "complete",
    summary: "one metered completion on a model you're allowed to use",
    usage: 'complete <model> "<prompt>" [--system "<text>"] [--max <tokens>] [--json]',
    covers: ["gateway.complete", "gateway.text"],
    async run(ctx, args) {
      const [model, prompt] = args.positional;
      if (!model || !prompt) {
        return ctx.print('usage: complete <model> "<prompt>" [--system "<text>"] [--max <tokens>] [--json]');
      }
      const system = args.flags.system ? String(args.flags.system) : undefined;
      const max = args.flags.max ? Number(args.flags.max) : undefined;
      const messages = [
        ...(system ? [{ role: "system", content: system }] : []),
        { role: "user", content: prompt },
      ];
      const input = { model, messages, ...(max ? { maxTokens: max } : {}) };
      if (args.flags.json) {
        ctx.printJson(await ctx.client.gateway.complete(input));
        return;
      }
      ctx.print(await ctx.client.gateway.text(input));
    },
  });
}
