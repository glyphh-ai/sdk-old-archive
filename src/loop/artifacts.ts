/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * loop/artifacts.ts — `artifact_publish` and `artifact_read`, the loop's
 * ARTIFACT tools (his direction, 2026-10-05: artifacts like Claude's). A page,
 * a report or a file the model made becomes one of the member's Artifacts: a
 * file from the session's folder (confined to it like every file tool) or
 * inline content, posted to the Glyphh server on the credential the loop
 * already runs on. With an `id`, publish UPDATES that artifact in place (his
 * report, 2026-10-05: an edit made a second artifact, which was wrong), and
 * `artifact_read` hands the model the one in hand to edit. On the desktop
 * that is the member's bearer at /api/artifacts; in a worker it is the runtime
 * token at /api/harness/artifacts, which acts as the member the token names.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import type { LoopHost } from "./core.js";
import type { FetchLike } from "./messages.js";
import { insideFolder } from "./sandbox.js";
import type { BuiltinResult, ToolDef } from "./tools.js";

export const ARTIFACT_PUBLISH = "artifact_publish";
export const ARTIFACT_READ = "artifact_read";
export const ARTIFACT_SIZE_CAP = 25 * 1024 * 1024;
/** What artifact_read hands back inline at most; past it the text is cut and says so. */
export const ARTIFACT_READ_CAP = 1024 * 1024;
const NAME_MAX = 200;

export const ARTIFACT_PUBLISH_TOOL: ToolDef = {
  name: ARTIFACT_PUBLISH,
  description: "Publish a page, report or file to the user's Artifacts, where they can open it, share it and comment on it, or UPDATE one in place. "
    + "Use this whenever the user asks to publish, share, host, hand over or send them a page, report, document or file, and whenever you have made a page or a file they should keep: "
    + "pass the file's path (inside the working folder) or the content inline, and a name. "
    + "When an artifact is already in hand (the user is editing one, or one was published earlier in this conversation), read it with artifact_read and publish the edited whole with its id: "
    + "that replaces its content under the same id and link, keeping its comments. Never create a new artifact for an edit. "
    + "Never search for another publish, share or hosting tool: this is the one. "
    + "The mime type is inferred from the name's extension when absent. Returns the artifact's id and its view link; tell the user the link.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The id of the artifact in hand, to update it in place. Omit to create a new one." },
      path: { type: "string", description: "A file in the working folder to publish (25 MB at most). Give path or content, not both." },
      content: { type: "string", description: "The text to publish inline (an HTML page, markdown, CSV...). On an update, the whole new content." },
      name: { type: "string", description: "The artifact's name with its extension, e.g. report.html. Required to create; on an update it renames, omit to keep the name." },
      mime: { type: "string", description: "The media type; inferred from the name when absent (kept on an update)." },
    },
    required: [],
  },
};

export const ARTIFACT_READ_TOOL: ToolDef = {
  name: ARTIFACT_READ,
  description: "Read one of the user's Artifacts: its record (id, name, mime, size, access, link) and its text. "
    + "Use it before editing an artifact in hand, then publish the edited whole with artifact_publish and the same id; never create a new artifact for an edit. "
    + "Text is returned for text, HTML, markdown, JSON, SVG and the like; for a binary file only its size and type come back.",
  input_schema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The artifact's id." },
    },
    required: ["id"],
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

const TEXT_MIMES = new Set(["application/json", "application/xml", "application/yaml", "application/javascript", "application/xhtml+xml", "image/svg+xml"]);

/** Whether artifact_read decodes the bytes as UTF-8 text: text/*, JSON, XML, YAML, SVG, HTML and markdown among them. */
export function isTextMime(mime: string): boolean {
  const type = mime.split(";")[0]!.trim().toLowerCase();
  return type.startsWith("text/") || TEXT_MIMES.has(type) || type.endsWith("+json") || type.endsWith("+xml");
}

/** Where the loop publishes on this host: the worker's door takes its runtime token. */
export function publishPath(host: LoopHost): string {
  return host === "worker" ? "/api/harness/artifacts" : "/api/artifacts";
}

/** Where an artifact is read on this host: meta at the path, the bytes under /content. */
export function readPath(host: LoopHost, id: string): string {
  return `${publishPath(host)}/${encodeURIComponent(id)}`;
}

export interface PublishRequest { method: "POST" | "PUT"; path: string }

/** The request an id makes: on the member's door an update is a PUT at the artifact; the worker's door takes the id in the body. */
export function publishRequest(host: LoopHost, id: string | null): PublishRequest {
  if (id && host !== "worker") return { method: "PUT", path: readPath(host, id) };
  return { method: "POST", path: publishPath(host) };
}

export interface PublishBody { id?: string; name?: string; mime?: string; content?: string; text?: string }

/** The request body: inline text rides as `text`, file bytes as base64 `content`. A create always
 *  carries a name and a mime; an update carries only what changes. */
export function publishBody(name: string | null, mime: string | undefined, source: { text: string } | { bytes: Uint8Array }): PublishBody {
  const type = mime?.trim() || (name ? inferMime(name) : undefined);
  return {
    ...(name ? { name } : {}),
    ...(type ? { mime: type } : {}),
    ...("text" in source ? { text: source.text } : { content: Buffer.from(source.bytes).toString("base64") }),
  };
}

export interface PublishContext {
  workdir: string;
  /** A Code turn has a folder a path may name; a Work turn publishes inline content only. */
  hasFolder: boolean;
  wire: { baseUrl: string; token: string } | null;
  host: LoopHost;
  fetch?: FetchLike;
}

export type ReadContext = Pick<PublishContext, "wire" | "host" | "fetch">;

export interface Published { id: string; name: string; viewUrl: string; shareUrl?: string }

/** An artifact's record as the server answers it (the SDK contract's Artifact, the fields the model needs). */
export interface ArtifactMeta extends Published { mime: string; sizeBytes: number; access: string; updatedAt: string }

const str = (o: Record<string, unknown>, k: string): string => (typeof o[k] === "string" ? (o[k] as string) : "");

/** The input, read: the name checked (required unless updating), exactly one source, the bytes within the cap and inside the folder. */
async function sourceOf(o: Record<string, unknown>, ctx: PublishContext): Promise<{ id: string | null; name: string | null; body: PublishBody } | { error: string }> {
  const id = str(o, "id").trim() || null;
  const name = str(o, "name").replace(/\s+/g, " ").trim() || null;
  if (!id && !name) return { error: `name is required (1 to ${NAME_MAX} characters), with its extension; or give the id of the artifact to update` };
  if (name && name.length > NAME_MAX) return { error: `name is 1 to ${NAME_MAX} characters` };
  const file = str(o, "path");
  const inline = typeof o.content === "string" ? (o.content as string) : null;
  if ((file && inline !== null) || (!file && inline === null)) return { error: "give path (a file in the working folder) or content (inline text), one of them" };
  const mime = str(o, "mime") || (name && !path.extname(name) && file ? inferMime(file) : undefined);
  if (inline !== null) {
    if (Buffer.byteLength(inline, "utf8") > ARTIFACT_SIZE_CAP) return { error: "an artifact is 25 MB at most" };
    return { id, name, body: publishBody(name, mime, { text: inline }) };
  }
  if (!ctx.hasFolder) return { error: "this session has no folder: publish the content inline" };
  const target = await insideFolder(ctx.workdir, file);
  const stat = await fs.stat(target);
  if (!stat.isFile()) return { error: `${file} is not a file` };
  if (stat.size > ARTIFACT_SIZE_CAP) return { error: `${file} is ${Math.round(stat.size / (1024 * 1024))} MB; an artifact is 25 MB at most` };
  return { id, name, body: publishBody(name, mime, { bytes: await fs.readFile(target) }) };
}

type Answer<T> = { data?: T; error?: { message?: string }; detail?: string } | null;

async function call<T>(ctx: ReadContext, method: string, p: string, body: unknown, signal?: AbortSignal): Promise<{ res: Response; parsed: Answer<T> }> {
  const doFetch: FetchLike = ctx.fetch ?? ((u, i) => fetch(u, i));
  const res = await doFetch(`${ctx.wire!.baseUrl.replace(/\/+$/, "")}${p}`, {
    method,
    headers: { "content-type": "application/json", authorization: `Bearer ${ctx.wire!.token}` },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    ...(signal ? { signal } : {}),
  });
  const parsed = (await res.json().catch(() => null)) as Answer<T>;
  return { res, parsed };
}

const refusal = (res: Response, parsed: Answer<unknown>): string => `(${res.status}): ${parsed?.error?.message ?? parsed?.detail ?? "no answer"}`;

export async function runArtifactPublish(input: unknown, ctx: PublishContext, signal?: AbortSignal): Promise<BuiltinResult> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  if (!ctx.wire) return { text: "Publishing needs the Glyphh gateway, which is off for this run.", failed: true };
  try {
    const src = await sourceOf(o, ctx);
    if ("error" in src) return { text: src.error, failed: true };
    const req = publishRequest(ctx.host, src.id);
    const body: PublishBody = src.id && req.method === "POST" ? { id: src.id, ...src.body } : src.body;
    const { res, parsed } = await call<Published>(ctx, req.method, req.path, body, signal);
    const label = src.name ?? src.id ?? "";
    if (!res.ok || !parsed?.data?.id) {
      return { text: `${src.id ? "Updating" : "Publishing"} ${label} failed ${refusal(res, parsed)}`, failed: true };
    }
    const out: Published = { id: parsed.data.id, name: parsed.data.name, viewUrl: parsed.data.viewUrl, ...(parsed.data.shareUrl ? { shareUrl: parsed.data.shareUrl } : {}) };
    return { text: `${src.id ? "Updated" : "Published"} ${out.name} — ${out.viewUrl}\n${JSON.stringify(out)}`, failed: false };
  } catch (err) {
    return { text: err instanceof Error ? err.message : String(err), failed: true };
  }
}

/** The record and, for a text-like mime, the content decoded as UTF-8; a binary one is described by size and type. */
export async function runArtifactRead(input: unknown, ctx: ReadContext, signal?: AbortSignal): Promise<BuiltinResult> {
  const o = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const id = str(o, "id").trim();
  if (!id) return { text: "id is required: the artifact to read", failed: true };
  if (!ctx.wire) return { text: "Reading an artifact needs the Glyphh gateway, which is off for this run.", failed: true };
  try {
    const at = readPath(ctx.host, id);
    const { res, parsed } = await call<ArtifactMeta>(ctx, "GET", at, undefined, signal);
    if (!res.ok || !parsed?.data?.id) return { text: `Reading artifact ${id} failed ${refusal(res, parsed)}`, failed: true };
    const meta = parsed.data;
    if (!isTextMime(meta.mime)) {
      return { text: JSON.stringify({ meta, note: `${meta.name} is ${meta.mime}, ${meta.sizeBytes} bytes: no text to show. Publish new bytes from a file to replace it.` }), failed: false };
    }
    const doFetch: FetchLike = ctx.fetch ?? ((u, i) => fetch(u, i));
    const bytes = await doFetch(`${ctx.wire.baseUrl.replace(/\/+$/, "")}${at}/content`, { method: "GET", headers: { authorization: `Bearer ${ctx.wire.token}` }, ...(signal ? { signal } : {}) });
    if (!bytes.ok) return { text: `Reading the content of artifact ${id} failed (${bytes.status})`, failed: true };
    const raw = Buffer.from(await bytes.arrayBuffer());
    const cut = raw.length > ARTIFACT_READ_CAP;
    const text = raw.subarray(0, ARTIFACT_READ_CAP).toString("utf8");
    return { text: JSON.stringify({ meta, text, ...(cut ? { truncated: true, note: `the first ${ARTIFACT_READ_CAP} of ${raw.length} bytes; an update from this text would lose the rest` } : {}) }), failed: false };
  } catch (err) {
    return { text: err instanceof Error ? err.message : String(err), failed: true };
  }
}
