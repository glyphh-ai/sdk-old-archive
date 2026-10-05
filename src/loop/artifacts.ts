/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * loop/artifacts.ts — `artifact_publish`, the loop's PUBLISH tool (his direction,
 * 2026-10-05: artifacts like Claude's). A page, a report or a file the model
 * made becomes one of the member's Artifacts: a file from the session's folder
 * (confined to it like every file tool) or inline content, posted to the Glyphh
 * server on the credential the loop already runs on. On the desktop that is the
 * member's bearer at /api/artifacts; in a worker it is the runtime token at
 * /api/harness/artifacts, which publishes as the member the token names.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoopHost } from "./core.js";
import type { FetchLike } from "./messages.js";
import { insideFolder } from "./sandbox.js";
import type { BuiltinResult, ToolDef } from "./tools.js";

export const ARTIFACT_PUBLISH = "artifact_publish";
export const ARTIFACT_SIZE_CAP = 25 * 1024 * 1024;
const NAME_MAX = 200;

export const ARTIFACT_PUBLISH_TOOL: ToolDef = {
  name: ARTIFACT_PUBLISH,
  description: "Publish a page, report or file to the user's Artifacts, where they can open it, share it and comment on it. "
    + "Use this whenever the user asks to publish, share, host, hand over or send them a page, report, document or file, and whenever you have made a page or a file they should keep: "
    + "pass the file's path (inside the working folder) or the content inline, and a name. Never search for another publish, share or hosting tool: this is the one. "
    + "The mime type is inferred from the name's extension when absent. Returns the artifact's id and its view link; tell the user the link.",
  input_schema: {
    type: "object",
    properties: {
      path: { type: "string", description: "A file in the working folder to publish (25 MB at most). Give path or content, not both." },
      content: { type: "string", description: "The text to publish inline (an HTML page, markdown, CSV...)." },
      name: { type: "string", description: "The artifact's name with its extension, e.g. report.html." },
      mime: { type: "string", description: "The media type; inferred from the name when absent." },
    },
    required: ["name"],
  },
};

const MIMES: Record<string, string> = {
  html: "text/html", htm: "text/html", css: "text/css", js: "text/javascript", mjs: "text/javascript", json: "application/json",
  md: "text/markdown", markdown: "text/markdown", txt: "text/plain", csv: "text/csv", tsv: "text/tab-separated-values",
  xml: "application/xml", yaml: "application/yaml", yml: "application/yaml", svg: "image/svg+xml", png: "image/png",
  jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", pdf: "application/pdf", zip: "application/zip",
  ts: "text/plain", py: "text/plain", sh: "text/plain", docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  mp4: "video/mp4", mp3: "audio/mpeg", wav: "audio/wav",
};

/** The media type the name's extension says, else octet-stream. */
export function inferMime(name: string): string {
  const ext = path.extname(name).slice(1).toLowerCase();
  return MIMES[ext] ?? "application/octet-stream";
}

/** Where the loop publishes on this host: the worker's door takes its runtime token. */
export function publishPath(host: LoopHost): string {
  return host === "worker" ? "/api/harness/artifacts" : "/api/artifacts";
}

export interface PublishBody { name: string; mime: string; content?: string; text?: string }

/** The request body: inline text rides as `text`, file bytes as base64 `content`. */
export function publishBody(name: string, mime: string | undefined, source: { text: string } | { bytes: Uint8Array }): PublishBody {
  const type = mime?.trim() || inferMime(name);
  return "text" in source
    ? { name, mime: type, text: source.text }
    : { name, mime: type, content: Buffer.from(source.bytes).toString("base64") };
}

export interface PublishContext {
  workdir: string;
  /** A Code turn has a folder a path may name; a Work turn publishes inline content only. */
  hasFolder: boolean;
  wire: { baseUrl: string; token: string } | null;
  host: LoopHost;
  fetch?: FetchLike;
}

export interface Published { id: string; name: string; viewUrl: string; shareUrl?: string }

const str = (o: Record<string, unknown>, k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");

/** The input, read: the name checked, exactly one source, the bytes within the cap and inside the folder. */
async function sourceOf(o: Record<string, unknown>, ctx: PublishContext): Promise<{ name: string; body: PublishBody } | { error: string }> {
  const name = str(o, "name").replace(/\s+/g, " ").trim();
  if (!name || name.length > NAME_MAX) return { error: `name is required (1 to ${NAME_MAX} characters), with its extension` };
  const file = str(o, "path");
  const inline = typeof o.content === "string" ? (o.content as string) : null;
  if ((file && inline !== null) || (!file && inline === null)) return { error: "give path (a file in the working folder) or content (inline text), one of them" };
  const mime = str(o, "mime") || (path.extname(name) ? undefined : file ? inferMime(file) : undefined);
  if (inline !== null) {
    if (Buffer.byteLength(inline, "utf8") > ARTIFACT_SIZE_CAP) return { error: "an artifact is 25 MB at most" };
    return { name, body: publishBody(name, mime, { text: inline }) };
  }
  if (!ctx.hasFolder) return { error: "this session has no folder: publish the content inline" };
  const target = await insideFolder(ctx.workdir, file);
  const stat = await fs.stat(target);
  if (!stat.isFile()) return { error: `${file} is not a file` };
  if (stat.size > ARTIFACT_SIZE_CAP) return { error: `${file} is ${Math.round(stat.size / (1024 * 1024))} MB; an artifact is 25 MB at most` };
  return { name, body: publishBody(name, mime, { bytes: await fs.readFile(target) }) };
}

export async function runArtifactPublish(input: unknown, ctx: PublishContext, signal?: AbortSignal): Promise<BuiltinResult> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (!ctx.wire) return { text: "Publishing needs the Glyphh gateway, which is off for this run.", failed: true };
  try {
    const src = await sourceOf(o, ctx);
    if ("error" in src) return { text: src.error, failed: true };
    const doFetch: FetchLike = ctx.fetch ?? ((u, i) => fetch(u, i));
    const res = await doFetch(`${ctx.wire.baseUrl.replace(/\/+$/, "")}${publishPath(ctx.host)}`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${ctx.wire.token}` },
      body: JSON.stringify(src.body),
      ...(signal ? { signal } : {}),
    });
    const parsed = (await res.json().catch(() => null)) as { data?: Published; error?: { message?: string }; detail?: string } | null;
    if (!res.ok || !parsed?.data?.id) {
      return { text: `Publishing ${src.name} failed (${res.status}): ${parsed?.error?.message ?? parsed?.detail ?? "no answer"}`, failed: true };
    }
    const out: Published = { id: parsed.data.id, name: parsed.data.name, viewUrl: parsed.data.viewUrl, ...(parsed.data.shareUrl ? { shareUrl: parsed.data.shareUrl } : {}) };
    return { text: `Published ${out.name} — ${out.viewUrl}\n${JSON.stringify(out)}`, failed: false };
  } catch (err) {
    return { text: err instanceof Error ? err.message : String(err), failed: true };
  }
}
