/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/sessions.ts — control-plane runtime sessions. `create` provisions a rotor
 * runtime and prints `{ session, runtimeToken }` (token shown once); the REPL can then
 * open a data-plane stream to `session.runtimeUrl` with that token.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { CreateSessionInput, SessionLocus, ModelSwitchSurface } from "../../contract/runtime.js";

export function registerSessions(reg: CommandRegistry): void {
  reg.register({
    path: "sessions create",
    summary: "provision a runtime session (token shown once)",
    usage: "sessions create <rotor> [--locus remote|local|relay] [--workspace <id>] [--repo <r> --branch <b> --path <p>]",
    covers: ["sessions.create"],
    async run(ctx, args) {
      const rotor = args.positional[0];
      if (!rotor) throw new Error("usage: sessions create <rotor> [--locus …] [--repo …]");
      const input: CreateSessionInput = { rotor };
      const locus = flagStr(args, "locus");
      if (locus) input.locus = locus as SessionLocus;
      const workspace = flagStr(args, "workspace");
      if (workspace) input.workspaceId = workspace;
      const repo = flagStr(args, "repo");
      if (repo) input.repo = repo;
      const branch = flagStr(args, "branch");
      if (branch) input.branch = branch;
      const path = flagStr(args, "path");
      if (path) input.path = path;
      ctx.printJson(await ctx.client.sessions.create(input));
    },
  });

  reg.register({
    path: "sessions list",
    summary: "your runtime sessions",
    covers: ["sessions.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.sessions.list());
    },
  });

  reg.register({
    path: "sessions get",
    summary: "one runtime session by id",
    usage: "sessions get <id>",
    covers: ["sessions.get"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: sessions get <id>");
      ctx.printJson(await ctx.client.sessions.get(id));
    },
  });

  reg.register({
    path: "sessions model-switch",
    summary: "record a mid-stream model switch (traceability audit)",
    usage: "sessions model-switch <sessionId> --to <modelId> --surface cli|desktop|mobile|platform [--rotor <slug>] [--role <role>] [--from <modelId>]",
    covers: ["sessions.recordModelSwitch"],
    async run(ctx, args) {
      const sessionId = args.positional[0];
      const to = flagStr(args, "to");
      const surface = flagStr(args, "surface");
      if (!sessionId || !to || !surface) {
        throw new Error("usage: sessions model-switch <sessionId> --to <modelId> --surface cli|desktop|mobile|platform");
      }
      const rotorSlug = flagStr(args, "rotor");
      const role = flagStr(args, "role");
      const from = flagStr(args, "from");
      ctx.printJson(
        await ctx.client.sessions.recordModelSwitch({
          sessionId,
          to,
          surface: surface as ModelSwitchSurface,
          ...(rotorSlug ? { rotorSlug } : {}),
          ...(role ? { role } : {}),
          ...(from ? { from } : {}),
        }),
      );
    },
  });

  reg.register({
    path: "sessions delete",
    summary: "deprovision + stop a runtime session",
    usage: "sessions delete <id>",
    covers: ["sessions.delete"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: sessions delete <id>");
      await ctx.client.sessions.delete(id);
      ctx.printJson({ stopped: id });
    },
  });
}
