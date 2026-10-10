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


  reg.register({
    path: "gateway my-keys",
    summary: "your own API keys, plus whether member minting is open to you",
    covers: ["gateway.myKeys"],
    async run(ctx) {
      ctx.printJson(await ctx.client.gateway.myKeys());
    },
  });

  reg.register({
    path: "gateway mint-key",
    summary: "mint a personal API key (shown once) — paid plan + org switch",
    usage: "gateway mint-key <name> [--days <n>]",
    covers: ["gateway.mintMyKey"],
    async run(ctx, args) {
      const name = args.positional[0];
      if (!name) throw new Error("usage: gateway mint-key <name> [--days <n>]");
      const days = typeof args.flags.days === "string" ? Number(args.flags.days) : undefined;
      ctx.printJson(await ctx.client.gateway.mintMyKey(name, days));
    },
  });

  reg.register({
    path: "gateway revoke-key",
    summary: "revoke one of YOUR keys",
    usage: "gateway revoke-key <id>",
    covers: ["gateway.revokeMyKey"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: gateway revoke-key <id>");
      await ctx.client.gateway.revokeMyKey(id);
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "gateway member-keys",
    summary: "read or flip the org's member-minting switch (org_admin)",
    usage: "gateway member-keys [on|off]",
    covers: ["gateway.memberKeysEnabled", "gateway.setMemberKeysEnabled"],
    async run(ctx, args) {
      const state = args.positional[0];
      if (state === "on" || state === "off") {
        ctx.printJson(await ctx.client.gateway.setMemberKeysEnabled(state === "on"));
      } else {
        ctx.printJson(await ctx.client.gateway.memberKeysEnabled());
      }
    },
  });
}
