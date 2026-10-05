/**
 * The app bundle validator — the one contract every builder and the server
 * share. The tests pin the SEVERITY BOUNDARY above all: security blocks a
 * ship, advice never does, because a lint that guesses wrong must not stand
 * between a working app and its user.
 */

import { describe, it, expect } from "vitest";
import { validateAppBundle, parseAppManifest, lintRemoteAssets } from "../../src/app-spec/validate.js";

const MANIFEST = JSON.stringify({
  kind: "glyphh-app", name: "Fence Scout", slug: "fence-scout", entry: "index.html",
  capabilities: ["db.exec", "notify.send"],
});

function bundle(overrides: Record<string, string> = {}): Record<string, string> {
  return { "manifest.json": MANIFEST, "index.html": "<html><body>hi</body></html>", ...overrides };
}

describe("shape (errors)", () => {
  it("accepts a minimal valid bundle", () => {
    const v = validateAppBundle(bundle());
    expect(v.ok).toBe(true);
    expect(v.manifest?.slug).toBe("fence-scout");
  });

  it("accepts glyphh.app.json as the manifest name — the Vite-project layout", () => {
    const v = validateAppBundle({ "glyphh.app.json": MANIFEST, "index.html": "<p/>" });
    expect(v.ok).toBe(true);
  });

  it("rejects a manifest missing kind/name/slug/entry", () => {
    for (const bad of [
      "{not json",
      JSON.stringify({ name: "x", slug: "x", entry: "index.html" }),          // no kind
      JSON.stringify({ kind: "glyphh-app", slug: "x", entry: "index.html" }), // no name
      JSON.stringify({ kind: "glyphh-app", name: "x", slug: "_x", entry: "i" }), // reserved slug
    ]) {
      expect(validateAppBundle({ "manifest.json": bad }).ok).toBe(false);
    }
  });

  it("normalizes the slug rather than rejecting fixable input", () => {
    const m = parseAppManifest(JSON.stringify({ kind: "glyphh-app", name: "X", slug: "My App!", entry: "i.html" }));
    expect(m?.slug).toBe("my-app-");
  });
});

describe("data — where the app's data lives (the author's call)", () => {
  const withData = (data: unknown): string => JSON.stringify({ kind: "glyphh-app", name: "X", slug: "x", entry: "index.html", data });

  it("absent means cloud", () => {
    const v = validateAppBundle(bundle());
    expect(v.ok).toBe(true);
    expect(v.manifest?.data).toBe("cloud");
    expect(parseAppManifest(withData(null))?.data).toBe("cloud");
  });

  it("accepts cloud, local and per-home", () => {
    for (const data of ["cloud", "local", "per-home"]) {
      const v = validateAppBundle({ "manifest.json": withData(data), "index.html": "<p/>" });
      expect(v.ok).toBe(true);
      expect(v.manifest?.data).toBe(data);
    }
    expect(parseAppManifest(withData(" Local "))?.data).toBe("local");
  });

  it("an unknown value is an error, not advice", () => {
    for (const data of ["org", "desktop", 7, true]) {
      const v = validateAppBundle({ "manifest.json": withData(data), "index.html": "<p/>" });
      expect(v.ok).toBe(false);
      expect(v.errors.join(" ")).toContain('"data"');
      expect(v.manifest?.data).toBe(String(data).toLowerCase());
    }
  });
});

describe("security (errors — block a ship anywhere)", () => {
  it("refuses remote code references in built assets", () => {
    const v = validateAppBundle(bundle({ "index.html": `<script src="https://cdn.example.com/x.js"></script>` }));
    expect(v.ok).toBe(false);
    expect(v.errors[0]).toContain("remote asset");
  });

  it("plain <a href> links are not code — they pass", () => {
    expect(lintRemoteAssets({ "index.html": `<a href="https://example.com">docs</a>` })).toEqual([]);
  });

  it("refuses a worker that reaches for network or node", () => {
    const m = JSON.stringify({ kind: "glyphh-app", name: "X", slug: "x", entry: "index.html", worker: "worker.js" });
    const v = validateAppBundle({ "manifest.json": m, "index.html": "<p/>", "worker.js": `const r = await fetch("https://x.example");` });
    expect(v.ok).toBe(false);
    expect(v.errors.join(" ")).toContain("forbidden APIs");
  });

  it("refuses exposing agent.run as a tool", () => {
    const m = JSON.stringify({
      kind: "glyphh-app", name: "X", slug: "x", entry: "index.html",
      capabilities: ["agent.run"], tools: [{ name: "loop", capability: "agent.run" }],
    });
    const v = validateAppBundle({ "manifest.json": m, "index.html": "<p/>" });
    expect(v.ok).toBe(false);
  });

  it("refuses a declared worker whose file is missing", () => {
    const m = JSON.stringify({ kind: "glyphh-app", name: "X", slug: "x", entry: "index.html", worker: "worker.js" });
    expect(validateAppBundle({ "manifest.json": m, "index.html": "<p/>" }).ok).toBe(false);
  });
});

describe("advice (warnings — never block)", () => {
  it("unknown capabilities, bad tool xrefs, and absent entries warn but ship", () => {
    const m = JSON.stringify({
      kind: "glyphh-app", name: "X", slug: "x", entry: "missing.html",
      capabilities: ["db.exec", "made.up"],
      tools: [{ name: "t", capability: "notify.send" }], // not in capabilities
    });
    const v = validateAppBundle({ "manifest.json": m, "index.html": "<p/>" });
    expect(v.ok).toBe(true);
    expect(v.warnings.length).toBeGreaterThanOrEqual(3);
    expect(v.warnings.join(" ")).toContain("made.up");
  });

  it("bad cron shapes and self-call targets warn but ship", () => {
    const m = JSON.stringify({ kind: "glyphh-app", name: "X", slug: "x", entry: "index.html", worker: "worker.js" });
    const worker = `
      glyphh.handle("scan", async () => 1);
      await glyphh.call("cron.schedule", { expr: "08:00 * * *" });
      await glyphh.call("scan", {});
    `;
    const v = validateAppBundle({ "manifest.json": m, "index.html": "<p/>", "worker.js": worker });
    expect(v.ok).toBe(true);
    expect(v.warnings.join(" ")).toContain("cron");
    expect(v.warnings.join(" ")).toContain("own handler");
  });

  it("grounds connector calls against a live catalog when given one", () => {
    const m = JSON.stringify({
      kind: "glyphh-app", name: "X", slug: "x", entry: "index.html", worker: "worker.js",
      capabilities: ["connector.call"], connectors: ["gmail"],
    });
    const worker = `await glyphh.call("connector.call", { connector: "gmail", tool: "Send Emailz" });`;
    const v = validateAppBundle(
      { "manifest.json": m, "index.html": "<p/>", "worker.js": worker },
      (slug) => (slug === "gmail" ? ["Send Email", "Modify Labels"] : null),
    );
    expect(v.ok).toBe(true);
    expect(v.warnings.join(" ")).toContain("doesn't exist");
  });
});
