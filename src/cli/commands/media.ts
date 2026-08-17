/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/media.ts — the media library + generation from the CLI. `generate`
 * starts the job and WAITS (generation is seconds-to-minutes); `--no-wait`
 * prints the job to poll yourself.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { basename, extname } from "node:path";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

const MIMES: Record<string, string> = {
  ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif",
  ".mp4": "video/mp4", ".webm": "video/webm", ".mov": "video/quicktime",
  ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav", ".ogg": "audio/ogg",
  ".txt": "text/plain", ".md": "text/markdown",
};
const KIND_BY_MIME = (mime: string): "image" | "video" | "audio" | "script" =>
  mime.startsWith("image/") ? "image" : mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : "script";

export function registerMedia(reg: CommandRegistry): void {
  reg.register({
    path: "media list",
    summary: "the org's media library (newest first)",
    usage: "media list [--kind image|video|audio|voice|avatar|recording|script] [--q <text>]",
    covers: ["media.list"],
    async run(ctx, args) {
      const kind = flagStr(args, "kind");
      ctx.printJson(await ctx.client.media.list(kind as never, flagStr(args, "q")));
    },
  });

  reg.register({
    path: "media get",
    summary: "one asset's metadata",
    usage: "media get <id>",
    covers: ["media.get"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: media get <id>");
      ctx.printJson(await ctx.client.media.get(id));
    },
  });

  reg.register({
    path: "media download",
    summary: "download an asset's bytes",
    usage: "media download <id> --out <path>",
    covers: ["media.bytes"],
    async run(ctx, args) {
      const id = args.positional[0];
      const out = flagStr(args, "out");
      if (!id || !out) throw new Error("usage: media download <id> --out <path>");
      const bytes = await ctx.client.media.bytes(id);
      writeFileSync(out, Buffer.from(bytes));
      ctx.printJson({ wrote: out, bytes: bytes.byteLength });
    },
  });

  reg.register({
    path: "media url",
    summary: "a direct-playable (presigned) URL for an asset",
    usage: "media url <id>",
    covers: ["media.playbackUrl"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: media url <id>");
      ctx.printJson(await ctx.client.media.playbackUrl(id));
    },
  });

  reg.register({
    path: "media upload",
    summary: "upload a local file into the library (presigned when possible)",
    usage: "media upload <path> [--title <t>] [--kind <k>]",
    covers: ["media.uploadTicket", "media.putBytes", "media.finalize"],
    async run(ctx, args) {
      const path = args.positional[0];
      if (!path) throw new Error("usage: media upload <path> [--title <t>] [--kind <k>]");
      const mime = MIMES[extname(path).toLowerCase()];
      if (!mime) throw new Error(`unsupported file type "${extname(path)}"`);
      const bytes = readFileSync(path);
      const kind = (flagStr(args, "kind") as never) ?? KIND_BY_MIME(mime);
      const ticket = await ctx.client.media.uploadTicket({
        kind, mime,
        title: flagStr(args, "title") ?? basename(path),
        sizeBytes: bytes.byteLength,
      });
      if (ticket.url) {
        const res = await fetch(ticket.url, { method: "PUT", headers: { "content-type": mime }, body: new Uint8Array(bytes) });
        if (!res.ok) throw new Error(`presigned upload failed: ${res.status}`);
      } else {
        await ctx.client.media.putBytes(ticket.asset.id, new Uint8Array(bytes));
      }
      ctx.printJson(await ctx.client.media.finalize(ticket.asset.id));
    },
  });

  reg.register({
    path: "media generate",
    summary: "generate with any media model (image/video/speech/music/sfx) — costs credits",
    usage: "media generate <model> <prompt…> [--size 1024x1024|16:9] [--seconds <n>] [--voice <id>] [--image-url <u>] [--title <t>] [--no-wait]",
    covers: ["media.generate", "media.waitForJob"],
    async run(ctx, args) {
      const [model, ...rest] = args.positional;
      const prompt = rest.join(" ").trim();
      if (!model || !prompt) throw new Error("usage: media generate <model> <prompt…>");
      const size = flagStr(args, "size");
      const seconds = flagStr(args, "seconds");
      const voice = flagStr(args, "voice");
      const imageUrl = flagStr(args, "image-url");
      const title = flagStr(args, "title");
      const started = await ctx.client.media.generate({
        model, prompt,
        ...(title ? { title } : {}),
        options: {
          ...(size ? { size } : {}),
          ...(seconds ? { seconds: Number(seconds) } : {}),
          ...(voice ? { voice } : {}),
          ...(imageUrl ? { imageUrl } : {}),
        },
      });
      if (args.flags["no-wait"]) { ctx.printJson(started); return; }
      ctx.printJson(await ctx.client.media.waitForJob(started.job.id));
    },
  });

  reg.register({
    path: "media jobs",
    summary: "recent generation jobs (status, model, credits charged)",
    usage: "media jobs [--id <jobId>]",
    covers: ["media.jobs", "media.job"],
    async run(ctx, args) {
      const id = flagStr(args, "id");
      ctx.printJson(id ? await ctx.client.media.job(id) : await ctx.client.media.jobs());
    },
  });

  reg.register({
    path: "media delete",
    summary: "delete an asset (bytes + row)",
    usage: "media delete <id>",
    covers: ["media.delete"],
    async run(ctx, args) {
      const id = args.positional[0];
      if (!id) throw new Error("usage: media delete <id>");
      await ctx.client.media.delete(id);
      ctx.printJson({ deleted: id });
    },
  });
}
