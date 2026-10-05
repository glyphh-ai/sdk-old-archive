/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * artifact_publish + artifact_read (his direction, 2026-10-05: artifacts like
 * Claude's; his report the same day: an edit made a second artifact). The pure
 * parts (the mime from the name, the door per host, the body shape, the request
 * an id makes), the folder confinement and the size cap, the POST / PUT / GETs
 * made on the loop's credential, and the belt both sit on in both spaces.
 */
import { describe, it, expect } from "vitest";
import { mkdirSync, mkdtempSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  ARTIFACT_PUBLISH, ARTIFACT_PUBLISH_TOOL, ARTIFACT_READ, ARTIFACT_READ_CAP, ARTIFACT_READ_TOOL, ARTIFACT_SIZE_CAP, inferMime, isTextMime, publishBody, publishPath, publishRequest, readPath,
  runArtifactPublish, runArtifactRead, type PublishContext,
} from "../../src/loop/artifacts.js";
import { gate, toolKind } from "../../src/loop/core.js";
import { GlyphhLoop, type LoopEvent } from "../../src/loop/loop.js";

const fresh = () => {
  const root = mkdtempSync(join(tmpdir(), "gl-art-"));
  const folder = join(root, "project");
  const outside = join(root, "outside");
  mkdirSync(folder); mkdirSync(outside);
  writeFileSync(join(folder, "report.html"), "<h1>Q3</h1>");
  writeFileSync(join(outside, "secret.txt"), "secret\n");
  return { root, folder, outside };
};

type Hit = { method: string; url: string; headers: Record<string, string>; body: Record<string, unknown> | null };

/** A server that answers a publish with the meta, and records what arrived. */
function server(status = 201, answer?: unknown) {
  const hits: Hit[] = [];
  const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    hits.push({ method: init.method ?? "GET", url, headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)), body });
    const data = answer ?? { data: { id: "a1", name: body.name ?? "report.html", mime: body.mime ?? "text/html", access: "private", viewUrl: "https://app.test/a/a1" } };
    return new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json" } });
  };
  return { hits, fetchLike };
}

const META = { id: "a1", name: "report.html", mime: "text/html", sizeBytes: 11, access: "private", viewUrl: "https://app.test/a/a1", updatedAt: "2026-10-05T10:00:00Z" };

/** A server holding one artifact: its meta at the artifact's path, its bytes under /content; records every request. */
function holding(meta: Record<string, unknown> = META, bytes = "<h1>Q3</h1>", status = 200) {
  const hits: Hit[] = [];
  const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
    hits.push({ method: init.method ?? "GET", url, headers: Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>)), body: init.body ? JSON.parse(String(init.body)) as Record<string, unknown> : null });
    if (status !== 200) return new Response(JSON.stringify({ error: { code: "E_NOT_FOUND", message: `no artifact ${meta.id}` } }), { status, headers: { "content-type": "application/json" } });
    if (url.endsWith("/content")) return new Response(bytes, { status: 200, headers: { "content-type": String(meta.mime) } });
    return new Response(JSON.stringify({ data: meta }), { status: 200, headers: { "content-type": "application/json" } });
  };
  return { hits, fetchLike };
}

const ctx = (over: Partial<PublishContext> & { workdir: string }): PublishContext => ({
  hasFolder: true, wire: { baseUrl: "https://gw/", token: "sk-member" }, host: "desktop", ...over,
});

describe("artifact_publish — the pure parts", () => {
  it("infers the mime from the name's extension, octet-stream otherwise", () => {
    expect(inferMime("report.html")).toBe("text/html");
    expect(inferMime("Notes.MD")).toBe("text/markdown");
    expect(inferMime("data.csv")).toBe("text/csv");
    expect(inferMime("chart.svg")).toBe("image/svg+xml");
    expect(inferMime("deck.pdf")).toBe("application/pdf");
    expect(inferMime("mystery")).toBe("application/octet-stream");
    expect(inferMime("archive.tar.xyz")).toBe("application/octet-stream");
  });

  it("publishes through the member's door on the desktop and the terminal, the worker's door in a pod", () => {
    expect(publishPath("desktop")).toBe("/api/artifacts");
    expect(publishPath("terminal")).toBe("/api/artifacts");
    expect(publishPath("worker")).toBe("/api/harness/artifacts");
  });

  it("shapes the body: inline text as text, bytes as base64 content, a stated mime winning; an update without a name carries neither name nor mime", () => {
    expect(publishBody("a.html", undefined, { text: "<p>x</p>" })).toEqual({ name: "a.html", mime: "text/html", text: "<p>x</p>" });
    expect(publishBody("a.bin", " image/png ", { bytes: new Uint8Array([1, 2, 3]) })).toEqual({ name: "a.bin", mime: "image/png", content: "AQID" });
    expect(publishBody("a.bin", "", { bytes: new Uint8Array([]) })).toEqual({ name: "a.bin", mime: "application/octet-stream", content: "" });
    expect(publishBody(null, undefined, { text: "v2" })).toEqual({ text: "v2" });
    expect(publishBody(null, "text/plain", { text: "v2" })).toEqual({ mime: "text/plain", text: "v2" });
  });

  it("an id makes a PUT at the artifact on the member's door, a POST carrying the id on the worker's; reads sit at the same paths", () => {
    expect(publishRequest("desktop", null)).toEqual({ method: "POST", path: "/api/artifacts" });
    expect(publishRequest("desktop", "a1")).toEqual({ method: "PUT", path: "/api/artifacts/a1" });
    expect(publishRequest("terminal", "a/1")).toEqual({ method: "PUT", path: "/api/artifacts/a%2F1" });
    expect(publishRequest("worker", null)).toEqual({ method: "POST", path: "/api/harness/artifacts" });
    expect(publishRequest("worker", "a1")).toEqual({ method: "POST", path: "/api/harness/artifacts" });
    expect(readPath("desktop", "a1")).toBe("/api/artifacts/a1");
    expect(readPath("worker", "a1")).toBe("/api/harness/artifacts/a1");
  });

  it("decodes text, HTML, markdown, JSON, SVG and XML as text; images, PDFs and archives are binary", () => {
    for (const m of ["text/html", "text/plain; charset=utf-8", "text/markdown", "text/csv", "application/json", "image/svg+xml", "application/xml", "application/yaml", "application/ld+json"]) expect(isTextMime(m), m).toBe(true);
    for (const m of ["image/png", "application/pdf", "application/zip", "application/octet-stream", "video/mp4"]) expect(isTextMime(m), m).toBe(false);
  });

  it("publish is an EDIT for the permission gate (free under acceptEdits and auto, asked under ask, denied in plan); read is a READ, free everywhere", () => {
    expect(toolKind(ARTIFACT_PUBLISH)).toBe("edit");
    expect(gate("acceptEdits", toolKind(ARTIFACT_PUBLISH))).toBe("allow");
    expect(gate("ask", toolKind(ARTIFACT_PUBLISH))).toBe("ask");
    expect(gate("plan", toolKind(ARTIFACT_PUBLISH))).toBe("deny");
    expect(toolKind(ARTIFACT_READ)).toBe("read");
    expect(gate("plan", toolKind(ARTIFACT_READ))).toBe("allow");
    expect(gate("ask", toolKind(ARTIFACT_READ))).toBe("allow");
  });

  it("tells the model when to reach for it, never to look for another, and that an edit is read + publish with the id, never a new artifact", () => {
    expect(ARTIFACT_PUBLISH_TOOL.name).toBe("artifact_publish");
    expect(ARTIFACT_PUBLISH_TOOL.description).toMatch(/publish, share, host, hand over/);
    expect(ARTIFACT_PUBLISH_TOOL.description).toMatch(/Never search for another publish/);
    expect(ARTIFACT_PUBLISH_TOOL.description).toMatch(/read it with artifact_read and publish the edited whole with its id/);
    expect(ARTIFACT_PUBLISH_TOOL.description).toMatch(/Never create a new artifact for an edit/);
    expect(ARTIFACT_PUBLISH_TOOL.input_schema.required).toEqual([]);
    expect(Object.keys(ARTIFACT_PUBLISH_TOOL.input_schema.properties).sort()).toEqual(["content", "id", "mime", "name", "path"]);
    expect(ARTIFACT_READ_TOOL.name).toBe("artifact_read");
    expect(ARTIFACT_READ_TOOL.description).toMatch(/artifact_publish and the same id; never create a new artifact for an edit/);
    expect(ARTIFACT_READ_TOOL.input_schema.required).toEqual(["id"]);
    expect(Object.keys(ARTIFACT_READ_TOOL.input_schema.properties)).toEqual(["id"]);
  });
});

describe("artifact_publish — running it", () => {
  it("reads a file from the folder and POSTs it base64 on the loop's bearer; the answer names the link", async () => {
    const { folder } = fresh();
    const s = server();
    const r = await runArtifactPublish({ path: "report.html", name: "Q3 report.html" }, ctx({ workdir: folder, fetch: s.fetchLike }));
    expect(r.failed).toBe(false);
    expect(r.text.split("\n")[0]).toBe("Published Q3 report.html — https://app.test/a/a1");
    expect(JSON.parse(r.text.split("\n")[1]!)).toEqual({ id: "a1", name: "Q3 report.html", viewUrl: "https://app.test/a/a1" });
    expect(s.hits).toHaveLength(1);
    expect(s.hits[0]!.url).toBe("https://gw/api/artifacts");
    expect(s.hits[0]!.headers).toEqual({ "content-type": "application/json", authorization: "Bearer sk-member" });
    expect(s.hits[0]!.body).toEqual({ name: "Q3 report.html", mime: "text/html", content: Buffer.from("<h1>Q3</h1>").toString("base64") });
  });

  it("in a worker it goes through the harness door on the runtime token, and a share link rides back when there is one", async () => {
    const { folder } = fresh();
    const s = server(201, { data: { id: "a2", name: "x.md", viewUrl: "https://app.test/a/a2", shareUrl: "https://app.test/a/a2?t=tok" } });
    const r = await runArtifactPublish({ content: "# hi", name: "x.md" }, ctx({ workdir: folder, host: "worker", wire: { baseUrl: "https://api.test", token: "gy_rk_x" }, fetch: s.fetchLike }));
    expect(r.failed).toBe(false);
    expect(s.hits[0]!.url).toBe("https://api.test/api/harness/artifacts");
    expect(s.hits[0]!.headers.authorization).toBe("Bearer gy_rk_x");
    expect(s.hits[0]!.body).toEqual({ name: "x.md", mime: "text/markdown", text: "# hi" });
    expect(JSON.parse(r.text.split("\n")[1]!)).toEqual({ id: "a2", name: "x.md", viewUrl: "https://app.test/a/a2", shareUrl: "https://app.test/a/a2?t=tok" });
  });

  it("with an id it UPDATES in place: a PUT at the artifact on the member's door, only what changes in the body, and the answer says Updated", async () => {
    const { folder } = fresh();
    const s = server(200, { data: { id: "a1", name: "report.html", viewUrl: "https://app.test/a/a1" } });
    const r = await runArtifactPublish({ id: "a1", content: "<h1>Q3 v2</h1>" }, ctx({ workdir: folder, fetch: s.fetchLike }));
    expect(r.failed).toBe(false);
    expect(r.text.split("\n")[0]).toBe("Updated report.html — https://app.test/a/a1");
    expect(JSON.parse(r.text.split("\n")[1]!)).toEqual({ id: "a1", name: "report.html", viewUrl: "https://app.test/a/a1" });
    expect(s.hits).toEqual([{ method: "PUT", url: "https://gw/api/artifacts/a1", headers: { "content-type": "application/json", authorization: "Bearer sk-member" }, body: { text: "<h1>Q3 v2</h1>" } }]);
    const renamed = await runArtifactPublish({ id: "a1", path: "report.html", name: "Q3 final.html", mime: "text/html" }, ctx({ workdir: folder, fetch: s.fetchLike }));
    expect(renamed.failed).toBe(false);
    expect(s.hits[1]).toMatchObject({ method: "PUT", url: "https://gw/api/artifacts/a1", body: { name: "Q3 final.html", mime: "text/html", content: Buffer.from("<h1>Q3</h1>").toString("base64") } });
  });

  it("in a worker an update is a POST through the harness door with the id in the body", async () => {
    const { folder } = fresh();
    const s = server(200, { data: { id: "a2", name: "x.md", viewUrl: "https://app.test/a/a2" } });
    const r = await runArtifactPublish({ id: "a2", content: "# v2" }, ctx({ workdir: folder, host: "worker", wire: { baseUrl: "https://api.test", token: "gy_rk_x" }, fetch: s.fetchLike }));
    expect(r.failed).toBe(false);
    expect(r.text.split("\n")[0]).toBe("Updated x.md — https://app.test/a/a2");
    expect(s.hits).toEqual([{ method: "POST", url: "https://api.test/api/harness/artifacts", headers: { "content-type": "application/json", authorization: "Bearer gy_rk_x" }, body: { id: "a2", text: "# v2" } }]);
  });

  it("an update the server refuses (not the owner, gone) comes back in the server's words, and an update still needs a source", async () => {
    const { folder } = fresh();
    const refused = server(403, { error: { code: "E_FORBIDDEN", message: "only the artifact's owner may change it" } });
    const r = await runArtifactPublish({ id: "a1", content: "x" }, ctx({ workdir: folder, fetch: refused.fetchLike }));
    expect(r).toEqual({ failed: true, text: "Updating a1 failed (403): only the artifact's owner may change it" });
    const s = server();
    expect(await runArtifactPublish({ id: "a1" }, ctx({ workdir: folder, fetch: s.fetchLike }))).toMatchObject({ failed: true, text: expect.stringMatching(/one of them/) });
    expect(s.hits).toEqual([]);
  });

  it("stays inside the folder: .., an absolute path and a symlink out are refused before any request", async () => {
    const { folder, outside } = fresh();
    symlinkSync(outside, join(folder, "link"));
    const s = server();
    for (const p of ["../outside/secret.txt", join(outside, "secret.txt"), "link/secret.txt"]) {
      const r = await runArtifactPublish({ path: p, name: "s.txt" }, ctx({ workdir: folder, fetch: s.fetchLike }));
      expect(r.failed).toBe(true);
      expect(r.text).toMatch(/outside this session's folder/);
    }
    expect(s.hits).toEqual([]);
  });

  it("a Work turn has no folder to read from, so a path is refused and inline content is the way", async () => {
    const { folder } = fresh();
    const s = server();
    const byPath = await runArtifactPublish({ path: "report.html", name: "r.html" }, ctx({ workdir: folder, hasFolder: false, fetch: s.fetchLike }));
    expect(byPath).toMatchObject({ failed: true, text: expect.stringMatching(/no folder/) });
    const inline = await runArtifactPublish({ content: "<p>x</p>", name: "r.html" }, ctx({ workdir: folder, hasFolder: false, fetch: s.fetchLike }));
    expect(inline.failed).toBe(false);
    expect(s.hits).toHaveLength(1);
  });

  it("refuses a bad input in words: no name, both sources, neither, a folder, a missing file, over 25 MB", async () => {
    const { folder } = fresh();
    mkdirSync(join(folder, "dir"));
    writeFileSync(join(folder, "big.bin"), Buffer.alloc(ARTIFACT_SIZE_CAP + 1));
    const s = server();
    const c = ctx({ workdir: folder, fetch: s.fetchLike });
    expect(await runArtifactPublish({ path: "report.html" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/name is required/) });
    expect(await runArtifactPublish({ path: "report.html", name: "x".repeat(201) }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/200 characters/) });
    expect(await runArtifactPublish({ path: "report.html", content: "x", name: "a.html" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/one of them/) });
    expect(await runArtifactPublish({ name: "a.html" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/one of them/) });
    expect(await runArtifactPublish({ path: "dir", name: "a.html" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/not a file/) });
    expect((await runArtifactPublish({ path: "nope.html", name: "a.html" }, c)).failed).toBe(true);
    expect(await runArtifactPublish({ path: "big.bin", name: "big.bin" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/25 MB at most/) });
    expect(await runArtifactPublish({ content: "x".repeat(ARTIFACT_SIZE_CAP + 1), name: "big.txt" }, c)).toMatchObject({ failed: true, text: expect.stringMatching(/25 MB at most/) });
    expect(s.hits).toEqual([]);
  });

  it("without the gateway it says so; a server refusal comes back as the server's words", async () => {
    const { folder } = fresh();
    const off = await runArtifactPublish({ content: "x", name: "a.txt" }, ctx({ workdir: folder, wire: null }));
    expect(off).toMatchObject({ failed: true, text: expect.stringMatching(/gateway/) });
    const refused = server(412, { error: { code: "E_FAILED_PRECONDITION", message: "artifacts need object storage (R2_*) on this server" } });
    const r = await runArtifactPublish({ content: "x", name: "a.txt" }, ctx({ workdir: folder, fetch: refused.fetchLike }));
    expect(r.failed).toBe(true);
    expect(r.text).toBe("Publishing a.txt failed (412): artifacts need object storage (R2_*) on this server");
  });
});

describe("artifact_read — running it", () => {
  it("reads the meta then the bytes on the loop's bearer and hands back { meta, text } for a text mime", async () => {
    const s = holding();
    const r = await runArtifactRead({ id: "a1" }, { wire: { baseUrl: "https://gw/", token: "sk-member" }, host: "desktop", fetch: s.fetchLike });
    expect(r.failed).toBe(false);
    expect(JSON.parse(r.text)).toEqual({ meta: META, text: "<h1>Q3</h1>" });
    expect(s.hits.map((h) => [h.method, h.url, h.headers.authorization])).toEqual([
      ["GET", "https://gw/api/artifacts/a1", "Bearer sk-member"],
      ["GET", "https://gw/api/artifacts/a1/content", "Bearer sk-member"],
    ]);
  });

  it("in a worker it reads through the harness door on the runtime token", async () => {
    const s = holding({ ...META, mime: "application/json" }, '{"a":1}');
    const r = await runArtifactRead({ id: "a1" }, { wire: { baseUrl: "https://api.test", token: "gy_rk_x" }, host: "worker", fetch: s.fetchLike });
    expect(JSON.parse(r.text).text).toBe('{"a":1}');
    expect(s.hits.map((h) => [h.url, h.headers.authorization])).toEqual([
      ["https://api.test/api/harness/artifacts/a1", "Bearer gy_rk_x"],
      ["https://api.test/api/harness/artifacts/a1/content", "Bearer gy_rk_x"],
    ]);
  });

  it("a binary artifact comes back as its meta and a note with size and type, the bytes never fetched", async () => {
    const png = { ...META, name: "chart.png", mime: "image/png", sizeBytes: 4096 };
    const s = holding(png, "\x89PNG");
    const r = await runArtifactRead({ id: "a1" }, { wire: { baseUrl: "https://gw", token: "t" }, host: "desktop", fetch: s.fetchLike });
    expect(r.failed).toBe(false);
    expect(JSON.parse(r.text)).toEqual({ meta: png, note: "chart.png is image/png, 4096 bytes: no text to show. Publish new bytes from a file to replace it." });
    expect(s.hits).toHaveLength(1);
  });

  it("cuts a text past the read cap and says so, so an update from it is known to be partial", async () => {
    const s = holding(META, "x".repeat(ARTIFACT_READ_CAP + 5));
    const out = JSON.parse((await runArtifactRead({ id: "a1" }, { wire: { baseUrl: "https://gw", token: "t" }, host: "desktop", fetch: s.fetchLike })).text) as { text: string; truncated: boolean; note: string };
    expect(out.text).toHaveLength(ARTIFACT_READ_CAP);
    expect(out.truncated).toBe(true);
    expect(out.note).toMatch(/would lose the rest/);
  });

  it("refuses without an id or the gateway, and a missing artifact comes back in the server's words", async () => {
    const s = holding(META, "", 404);
    const wire = { baseUrl: "https://gw", token: "t" };
    expect(await runArtifactRead({}, { wire, host: "desktop", fetch: s.fetchLike })).toMatchObject({ failed: true, text: expect.stringMatching(/id is required/) });
    expect(await runArtifactRead({ id: "a1" }, { wire: null, host: "desktop", fetch: s.fetchLike })).toMatchObject({ failed: true, text: expect.stringMatching(/gateway/) });
    expect(s.hits).toEqual([]);
    expect(await runArtifactRead({ id: "a1" }, { wire, host: "desktop", fetch: s.fetchLike })).toEqual({ failed: true, text: "Reading artifact a1 failed (404): no artifact a1" });
  });
});

/** One scripted model reply as SSE: text and/or one tool call. */
function reply(r: { text?: string; tool?: { id: string; name: string; input: unknown }; stop: "end_turn" | "tool_use" }): string {
  const ev = (e: string, d: unknown): string => `event: ${e}\ndata: ${JSON.stringify(d)}\n\n`;
  let out = ev("message_start", { type: "message_start", message: { usage: { input_tokens: 10 } } });
  let idx = 0;
  if (r.text) {
    out += ev("content_block_start", { type: "content_block_start", index: idx, content_block: { type: "text", text: "" } });
    out += ev("content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "text_delta", text: r.text } });
    out += ev("content_block_stop", { type: "content_block_stop", index: idx });
    idx++;
  }
  if (r.tool) {
    out += ev("content_block_start", { type: "content_block_start", index: idx, content_block: { type: "tool_use", id: r.tool.id, name: r.tool.name, input: {} } });
    out += ev("content_block_delta", { type: "content_block_delta", index: idx, delta: { type: "input_json_delta", partial_json: JSON.stringify(r.tool.input) } });
    out += ev("content_block_stop", { type: "content_block_stop", index: idx });
  }
  out += ev("message_delta", { type: "message_delta", delta: { stop_reason: r.stop }, usage: { output_tokens: 5 } });
  return out + ev("message_stop", { type: "message_stop" });
}

describe("artifact_publish — on the belt", () => {
  const plainShell = (sh: string, cmd: string) => ({ file: sh, args: ["-lc", cmd], sandboxed: false });

  function world(replies: string[]) {
    const bodies: Array<Record<string, unknown>> = [];
    const published: Hit[] = [];
    let page = "<h1>Q3</h1>";
    const fetchLike = async (url: string, init: RequestInit): Promise<Response> => {
      const headers = Object.fromEntries(Object.entries((init.headers ?? {}) as Record<string, string>));
      if (url.endsWith("/v1/messages")) {
        bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
        return new Response(replies.shift() ?? "", { status: 200, headers: { "content-type": "text/event-stream" } });
      }
      if (url.endsWith("/api/artifacts")) {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        published.push({ method: "POST", url, headers, body });
        return new Response(JSON.stringify({ data: { id: "a9", name: body.name, viewUrl: "https://app.test/a/a9" } }), { status: 201, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/api/artifacts/a9") && init.method === "PUT") {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        published.push({ method: "PUT", url, headers, body });
        page = String(body.text);
        return new Response(JSON.stringify({ data: { id: "a9", name: "report.html", viewUrl: "https://app.test/a/a9" } }), { status: 200, headers: { "content-type": "application/json" } });
      }
      if (url.endsWith("/api/artifacts/a9")) return new Response(JSON.stringify({ data: { ...META, id: "a9", sizeBytes: page.length } }), { status: 200, headers: { "content-type": "application/json" } });
      if (url.endsWith("/api/artifacts/a9/content")) return new Response(page, { status: 200, headers: { "content-type": "text/html" } });
      return new Response("not found", { status: 404 });
    };
    return { bodies, published, fetchLike };
  }

  it("is offered in BOTH spaces, and a Code turn publishes a file from the folder on the member's gateway key", async () => {
    const { folder } = fresh();
    const w = world([
      reply({ tool: { id: "t1", name: "artifact_publish", input: { path: "report.html", name: "report.html" } }, stop: "tool_use" }),
      reply({ text: "Published.", stop: "end_turn" }),
      reply({ text: "Hello.", stop: "end_turn" }),
    ]);
    const loop = new GlyphhLoop({ shell: plainShell, gateway: async () => ({ baseUrl: "https://gw", token: "sk-member" }), fetch: w.fetchLike });
    const events: LoopEvent[] = [];
    await loop.run({ chatId: "code", text: "publish the report", model: "m", workdir: folder, space: "code", permission: "acceptEdits" }, (ev) => { events.push(ev); });
    const names = (w.bodies[0]!.tools as Array<{ name: string }>).map((t) => t.name);
    expect(names).toContain("artifact_publish");
    expect(names).toContain("artifact_read");
    expect(names).toContain("bash");
    expect(w.published).toHaveLength(1);
    expect(w.published[0]!.headers.authorization).toBe("Bearer sk-member");
    expect(w.published[0]!.body).toEqual({ name: "report.html", mime: "text/html", content: Buffer.from("<h1>Q3</h1>").toString("base64") });
    const done = events.find((e) => e.type === "tool" && e.phase === "done") as { failed: boolean; preview: string };
    expect(done.failed).toBe(false);
    expect(done.preview).toContain("Published report.html — https://app.test/a/a9");
    const result = (w.bodies[1]!.messages as Array<{ content: unknown }>).at(-1)!.content as Array<{ is_error: boolean; content: string }>;
    expect(result[0]!.is_error).toBe(false);
    expect(result[0]!.content).toContain("https://app.test/a/a9");

    await loop.run({ chatId: "work", text: "hi", model: "m", space: "work" }, () => undefined);
    const work = (w.bodies[2]!.tools as Array<{ name: string }>).map((t) => t.name);
    expect(work).toContain("artifact_publish");
    expect(work).toContain("artifact_read");
    expect(work).not.toContain("bash");
  });

  it("an edit in a Work turn: the model reads the artifact in hand, then publishes with its id, and nothing new is created", async () => {
    const w = world([
      reply({ tool: { id: "t1", name: "artifact_read", input: { id: "a9" } }, stop: "tool_use" }),
      reply({ tool: { id: "t2", name: "artifact_publish", input: { id: "a9", content: "<h1>Q3 revised</h1>" } }, stop: "tool_use" }),
      reply({ text: "Updated.", stop: "end_turn" }),
    ]);
    const loop = new GlyphhLoop({ shell: plainShell, gateway: async () => ({ baseUrl: "https://gw", token: "sk-member" }), fetch: w.fetchLike });
    const events: LoopEvent[] = [];
    await loop.run({ chatId: "work", text: "fix the title of the report", model: "m", space: "work", permission: "acceptEdits" }, (ev) => { events.push(ev); });
    const read = (w.bodies[1]!.messages as Array<{ content: unknown }>).at(-1)!.content as Array<{ is_error: boolean; content: string }>;
    expect(read[0]!.is_error).toBe(false);
    expect(JSON.parse(read[0]!.content)).toMatchObject({ meta: { id: "a9", name: "report.html" }, text: "<h1>Q3</h1>" });
    expect(w.published).toEqual([{ method: "PUT", url: "https://gw/api/artifacts/a9", headers: { "content-type": "application/json", authorization: "Bearer sk-member" }, body: { text: "<h1>Q3 revised</h1>" } }]);
    const done = events.filter((e) => e.type === "tool" && e.phase === "done") as Array<{ failed: boolean; preview: string }>;
    expect(done.map((d) => d.failed)).toEqual([false, false]);
    expect(done[1]!.preview).toContain("Updated report.html — https://app.test/a/a9");
  });
});
