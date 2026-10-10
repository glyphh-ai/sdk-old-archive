/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/sessions.ts — control-plane runtime sessions. `create` provisions a rotor
 * runtime and prints `{ session, runtimeToken }` (token shown once); the REPL can then
 * open a data-plane stream to `session.runtimeUrl` with that token.
 */

import { readFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { PushThreadInput, SessionThreadMessage } from "../../contract/threads.js";

export function registerSessions(reg: CommandRegistry): void {





  // ── threads: the durable conversations in the regional stator (LWW sync) ────

  reg.register({
    path: "threads list",
    summary: "your threads (metadata only, newest-updated first)",
    covers: ["sessions.threads"],
    async run(ctx) {
      ctx.printJson(await ctx.client.sessions.threads());
    },
  });

  reg.register({
    path: "threads get",
    summary: "one thread with its message preview (last 20) and transcriptUrl",
    usage: "threads get <id>",
    covers: ["sessions.thread"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: threads get <id>");
      ctx.printJson(await ctx.client.sessions.thread(id));
    },
  });

  reg.register({
    path: "threads push",
    summary: "LWW-push a thread (cache sync — an unknown id creates it)",
    usage: "threads push <id> [--file <body.json>] [--title <t>] [--mode <m>] [--source <json>] [--updated-at <epoch-ms>]",
    covers: ["sessions.pushThread"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: threads push <id> [--file <body.json>] [--title …]");
      // A full body (incl. messages) comes from --file; flags override its metadata.
      const file = flagStr(args, "file");
      const body: PushThreadInput = file
        ? (JSON.parse(readFileSync(file, "utf8")) as PushThreadInput)
        : { updatedAt: Date.now() };
      const title = flagStr(args, "title");
      if (title !== undefined) body.title = title;
      const mode = flagStr(args, "mode");
      if (mode !== undefined) body.mode = mode;
      const source = flagStr(args, "source");
      if (source !== undefined) body.source = JSON.parse(source);
      const updatedAt = flagStr(args, "updated-at");
      if (updatedAt !== undefined) {
        const ms = Number(updatedAt);
        if (!Number.isSafeInteger(ms) || ms < 0) throw new Error("--updated-at must be epoch milliseconds");
        body.updatedAt = ms;
      }
      if (typeof body.updatedAt !== "number") body.updatedAt = Date.now();
      ctx.printJson(await ctx.client.sessions.pushThread(id, body));
    },
  });

  reg.register({
    path: "threads transcript",
    summary: "a presigned URL of a thread's whole transcript",
    usage: "threads transcript <id>",
    covers: ["sessions.transcriptUrl"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: threads transcript <id>");
      ctx.printJson(await ctx.client.sessions.transcriptUrl(id));
    },
  });

  reg.register({
    path: "threads append",
    summary: "append messages to a thread (LWW — a stale clock answers applied:false)",
    usage: "threads append <id> --messages <json|@file> [--updated-at <epoch-ms>]",
    covers: ["sessions.appendMessages"],
    async run(ctx, args) {
      const id = args.positional[0];
      const raw = flagStr(args, "messages");
      if (!id || raw === undefined) throw new Error("usage: threads append <id> --messages <json|@file> [--updated-at <epoch-ms>]");
      const messages = JSON.parse(raw.startsWith("@") ? readFileSync(raw.slice(1), "utf8") : raw) as SessionThreadMessage[];
      if (!Array.isArray(messages)) throw new Error("--messages must be a JSON array of messages");
      let updatedAt = Date.now();
      const flag = flagStr(args, "updated-at");
      if (flag !== undefined) {
        updatedAt = Number(flag);
        if (!Number.isSafeInteger(updatedAt) || updatedAt < 0) throw new Error("--updated-at must be epoch milliseconds");
      }
      ctx.printJson(await ctx.client.sessions.appendMessages(id, { messages, updatedAt }));
    },
  });

  reg.register({
    path: "threads delete",
    summary: "tombstone a thread (messages purged; stale pushes cannot revive it)",
    usage: "threads delete <id>",
    covers: ["sessions.deleteThread"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: threads delete <id>");
      await ctx.client.sessions.deleteThread(id);
      ctx.printJson({ deleted: id });
    },
  });
}
