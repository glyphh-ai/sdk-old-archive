/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/gateway.ts — run one metered completion. The CLI face of the single
 * model egress: `glyphh complete <model> "<prompt>"`.
 */

import type { CommandRegistry } from "../registry.js";

export function registerGateway(reg: CommandRegistry): void {
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
