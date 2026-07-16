/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/models.ts — MODEL GOVERNANCE. `models available` shows the caller's
 * effective set; `org models` + `org models set[-all]` manage the org's SUPPORTED
 * set (org_admin); `org model-audit` reads the model-governance audit slice.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { ModelAuditQuery } from "../../contract/models.js";

export function registerModels(reg: CommandRegistry): void {
  reg.register({
    path: "models available",
    summary: "the models you may actually use (catalog ∩ org-supported ∩ workspace)",
    covers: ["models.available"],
    async run(ctx) {
      ctx.printJson(await ctx.client.models.available());
    },
  });

  reg.register({
    path: "org models",
    summary: "the whole catalog + this org's support flag (org_admin)",
    covers: ["orgModels.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.orgModels.list());
    },
  });

  reg.register({
    path: "org models set",
    summary: "toggle support for one model (org_admin)",
    usage: "org models set <modelId> <true|false>",
    covers: ["orgModels.setSupported"],
    async run(ctx, args) {
      const id = args.positional[0];
      const flag = args.positional[1];
      if (!id || (flag !== "true" && flag !== "false")) {
        throw new Error("usage: org models set <modelId> <true|false>");
      }
      ctx.printJson(await ctx.client.orgModels.setSupported(id, flag === "true"));
    },
  });

  reg.register({
    path: "org models set-all",
    summary: "set the FULL supported set at once (org_admin)",
    usage: "org models set-all <modelId> [<modelId> …]",
    covers: ["orgModels.setSupportedBulk"],
    async run(ctx, args) {
      if (args.positional.length === 0) throw new Error("usage: org models set-all <modelId> [<modelId> …]");
      ctx.printJson(await ctx.client.orgModels.setSupportedBulk(args.positional));
    },
  });

  reg.register({
    path: "org model-audit",
    summary: "the org's model-governance audit slice (org_admin)",
    usage: "org model-audit [--action <model.*>] [--actor <email>] [--days <n>] [--page <n>] [--limit <n>]",
    covers: ["orgModels.audit"],
    async run(ctx, args) {
      const q: ModelAuditQuery = {};
      const action = flagStr(args, "action");
      const actor = flagStr(args, "actor");
      const days = flagStr(args, "days");
      const page = flagStr(args, "page");
      const limit = flagStr(args, "limit");
      if (action) q.action = action;
      if (actor) q.actor = actor;
      if (days) q.days = Number(days);
      if (page) q.page = Number(page);
      if (limit) q.limit = Number(limit);
      ctx.printJson(await ctx.client.orgModels.audit(q));
    },
  });
}
