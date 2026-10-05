/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * app-spec/validate.ts — the ONE validator for Glyphh app bundles.
 *
 * This is the authority every surface shares. The desktop runs it before a
 * local install, an external builder (Claude Code, CI, anything speaking the
 * SDK) runs it before shipping, and the server runs the same rules again at
 * publish — because the server trusts no client, and nothing unsafe for a
 * user or against policy may publish.
 *
 * Two severities, deliberately:
 *
 *   ERRORS — the SDK shape (a bundle the platform cannot represent) and the
 *   SECURITY lines (remote code references, a worker reaching for network or
 *   node, an app exposing agent.run as a tool). These block a ship anywhere.
 *
 *   WARNINGS — advice: capability cross-references, cron shapes, connector
 *   grounding. The runtime refuses these at call time on its own, so a lint
 *   that guesses wrong must never block a ship — it informs the builder.
 *
 * Pure functions, no fs, no Electron — runnable in any JS environment, which
 * is the point: the spec is only portable if its enforcement is.
 *
 * SCOPE: this validates the LOCAL app bundle (built dist/ + manifest +
 * optional worker) that renders inside the desktop's CSP sandbox. HOSTED apps
 * (published and deployed to a *.glyphh.app origin) are real server projects
 * — network is legitimate there — and are validated by the control plane's
 * publish manifest instead.
 */

/** A bundle as text: archive path → file content. */
export type AppBundle = Record<string, string>;

/** The complete capability surface a worker may call through glyphh.call. */
export const KNOWN_CAPABILITIES: ReadonlySet<string> = new Set([
  "contacts.search", "messages.send",
  "db.exec", "cron.schedule", "cron.cancel", "cron.list", "notify.send",
  "connector.status", "connector.tools", "connector.call",
  "llm.embed", "llm.chunk", "llm.complete", "agent.run",
  "vector.upsert", "vector.search", "vector.delete",
  "graph.cypher", "secrets.get", "secrets.list",
  "web.fetch", "web.read",
]);

/** Worker sandbox boundary: no direct network, no node. Every side effect goes
 *  through glyphh.call — the sandbox also blocks these at runtime; refusing at
 *  validation keeps a broken worker from shipping at all. */
const FORBIDDEN_WORKER = /\bfetch\s*\(|\brequire\s*\(|\bimport\s+[\w{*'"]|\bnew\s+WebSocket|\bXMLHttpRequest\b|\bprocess\.(env|platform|exit|cwd)/;

export interface AppManifestTool { name: string; capability?: string; handler?: string; description?: string; inputSchema?: unknown }

/** Where an app's data lives — the AUTHOR declares it in the manifest, the
 *  member never picks (his verdict, 2026-10-05: "an app is a row in the db"):
 *    cloud    — one store, in the cloud; the app is reachable from anywhere.
 *    local    — one store on the member's desktop; the data never leaves the
 *               machine. The marketplace shows a "Local data" badge, and a
 *               local app cannot install from the web without a connected desktop.
 *    per-home — a store in each home the member has (desktop + cloud), each
 *               scoped to that home's documents (the house apps' shape). */
export type AppDataKind = "cloud" | "local" | "per-home";
export const APP_DATA_KINDS: ReadonlySet<string> = new Set<AppDataKind>(["cloud", "local", "per-home"]);
export const DEFAULT_APP_DATA: AppDataKind = "cloud";

export interface ParsedAppManifest {
  name: string;
  slug: string;
  entry: string;
  worker?: string | undefined;
  capabilities: string[];
  connectors: string[];
  tools: AppManifestTool[];
  /** Absent in the file → "cloud". A value outside APP_DATA_KINDS survives
   *  parsing so validateAppBundle can name it in an error. */
  data: AppDataKind;
  [k: string]: unknown;
}

export interface AppValidationResult {
  ok: boolean;
  errors: string[];
  warnings: string[];
  manifest: ParsedAppManifest | null;
}

/** Parse + normalize a manifest, or null when it cannot be one at all:
 *  valid JSON, kind "glyphh-app", name + slug + entry, slug not reserved. */
export function parseAppManifest(json: string): ParsedAppManifest | null {
  let m: Record<string, unknown>;
  try { m = JSON.parse(json) as Record<string, unknown>; } catch { return null; }
  if (m?.kind !== "glyphh-app") return null;
  if (!m.name || !m.slug || !m.entry) return null;
  m.slug = String(m.slug).toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  if ((m.slug as string).startsWith("_")) return null;
  m.capabilities = Array.isArray(m.capabilities) ? m.capabilities.map(String) : [];
  m.connectors = Array.isArray(m.connectors)
    ? [...new Set((m.connectors as unknown[]).map((c) => String(c).trim().toLowerCase()).filter((c) => /^[a-z0-9_-]+$/.test(c)))]
    : [];
  m.worker = typeof m.worker === "string" && m.worker.trim() ? m.worker.trim() : undefined;
  m.tools = Array.isArray(m.tools)
    ? (m.tools as AppManifestTool[]).filter((t) => t && typeof t.name === "string"
        && (typeof t.capability === "string") !== (typeof t.handler === "string"))
    : [];
  m.data = m.data === undefined || m.data === null ? DEFAULT_APP_DATA : String(m.data).trim().toLowerCase();
  return m as unknown as ParsedAppManifest;
}

// ── Security lint: remote code references in built assets ────────────────────
//
// Absolute http(s):// or protocol-relative // references in a CODE-loading
// position: script/iframe src, <link> href, CSS @import, ES import specifiers.
// The desktop CSP blocks these at runtime; refusing them at validation keeps a
// bundle from shipping them at all. Plain <a href> links are NOT flagged.
const REMOTE_ASSET_RES: RegExp[] = [
  /\bsrc\s*=\s*["']\s*(?:https?:)?\/\/[^"']+/i,
  /<link\b[^>]*\bhref\s*=\s*["']\s*(?:https?:)?\/\/[^"']+/i,
  /@import\s+(?:url\()?\s*["']?\s*(?:https?:)?\/\/[^"')]+/i,
  /\bimport\s+[^;]*from\s*["']\s*(?:https?:)?\/\/[^"']+/i,
  /\bimport\s*\(\s*["']\s*(?:https?:)?\/\/[^"']+/i,
];

/** Scan text assets for remote code references. Empty result = clean. */
export function lintRemoteAssets(files: AppBundle): string[] {
  const errors: string[] = [];
  for (const [name, content] of Object.entries(files)) {
    if (!/\.(html?|css|m?js|jsx|ts|tsx)$/i.test(name)) continue;
    for (const re of REMOTE_ASSET_RES) {
      const m = re.exec(content);
      if (m) {
        errors.push(`${name}: remote asset reference not allowed — bundle it at build time instead ("${m[0].slice(0, 80)}…")`);
        break;
      }
    }
  }
  return errors;
}

// ── Advice lints (warnings — the runtime enforces these itself) ─────────────

export function extractConnectorCalls(worker: string): Array<{ connector: string; tool: string }> {
  const out: Array<{ connector: string; tool: string }> = [];
  const re = /connector\.call/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(worker))) {
    const win = worker.slice(m.index, m.index + 500);
    const conn = win.match(/connector\s*:\s*["'`]([^"'`]+)["'`]/);
    const tool = win.match(/tool\s*:\s*["'`]([^"'`]+)["'`]/);
    if (conn && tool) out.push({ connector: conn[1]!, tool: tool[1]! });
  }
  return out;
}

/** glyphh.call targets must be host capabilities — calling the worker's own
 *  handler through glyphh.call errors at runtime. */
export function checkCallTargets(worker: string): string[] {
  const notes: string[] = [];
  const handlers = new Set<string>();
  for (const m of worker.matchAll(/glyphh\.handle\(\s*["'`]([^"'`]+)["'`]/g)) handlers.add(m[1]!);
  for (const m of worker.matchAll(/glyphh\.call\(\s*["'`]([^"'`]+)["'`]/g)) {
    const target = m[1]!;
    if (KNOWN_CAPABILITIES.has(target)) continue;
    if (handlers.has(target)) {
      notes.push(`glyphh.call("${target}") targets the worker's own handler — call the function directly; glyphh.call is for host capabilities only`);
    } else {
      notes.push(`glyphh.call("${target}") is not a capability. The COMPLETE capability list: ${[...KNOWN_CAPABILITIES].join(", ")}. For web content use web.read {url} or web.fetch {url}. Workers never call fetch directly.`);
    }
  }
  return [...new Set(notes)];
}

/** cron.schedule expressions must be 5 space-separated fields — HH:MM-style
 *  strings never fire. */
const CRON_FIELD = /^(\*|[0-9*,/-]+)$/;
export function checkCronExpressions(worker: string): string[] {
  const notes: string[] = [];
  if (!worker.includes("cron.schedule")) return notes;
  for (const m of worker.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)) {
    const raw = m[2]!;
    const fields = raw.trim().split(/\s+/);
    const stars = fields.filter((f) => f === "*").length;
    if (fields.length < 4 || stars < 2) continue; // not cron-intended
    if (raw.includes("${")) {
      if (/^\$\{[^}]*\}\s+\*\s+\*\s+\*\s+\*$/.test(raw.trim())) {
        notes.push(`cron template "${raw.trim()}" puts one variable in the minute field — if it holds HH:MM the job never fires; split into minute and hour ("\${mm} \${hh} * * *")`);
      } else if (raw.includes(":") || fields.length !== 5) {
        notes.push(`cron built from a template ("${raw.slice(0, 40)}") — must resolve to 5 space-separated fields (minute hour dom month dow), never HH:MM`);
      }
      continue;
    }
    if (fields.length !== 5 || raw.includes(":") || !fields.every((f) => CRON_FIELD.test(f))) {
      notes.push(`invalid cron expression "${raw}" — needs 5 fields (minute hour dom month dow), e.g. "0 8 * * *" for daily 8am`);
    }
  }
  return notes;
}

// ── The validator ────────────────────────────────────────────────────────────

/**
 * Validate a local app bundle. `lookup(slug)` optionally grounds connector
 * calls against a live tool catalog (null = unknown slug → warning only).
 */
export function validateAppBundle(
  bundle: AppBundle,
  lookup?: (slug: string) => string[] | null,
): AppValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const manifestRaw = bundle["manifest.json"] ?? bundle["glyphh.app.json"];
  if (!manifestRaw) return { ok: false, errors: ["no manifest.json (or glyphh.app.json) in the bundle"], warnings, manifest: null };
  const m = parseAppManifest(manifestRaw);
  if (!m) return { ok: false, errors: ['manifest rejected — must be valid JSON with kind "glyphh-app", name, slug, entry (slug lowercase, no leading underscore)'], warnings, manifest: null };

  // ── SECURITY (errors — block a ship anywhere) ─────────────────────────────
  errors.push(...lintRemoteAssets(bundle));

  if (m.worker && !bundle[m.worker]) errors.push(`worker "${m.worker}" declared but its code is missing from the bundle`);
  const workerCode = m.worker ? bundle[m.worker] : undefined;
  if (workerCode && FORBIDDEN_WORKER.test(workerCode)) {
    errors.push("worker uses forbidden APIs (network/node). Workers have NO direct network access — use the web.read {url} capability (clean page text, host-mediated) or web.fetch {url} (raw), connector.call for account APIs, llm.complete for knowledge. Declare them in manifest capabilities.");
  }

  const recursive = m.tools.find((t) => t.capability === "agent.run");
  if (recursive) errors.push(`tool "${recursive.name}" cannot expose agent.run as a tool — an app must not run the agent that runs apps`);

  if (!APP_DATA_KINDS.has(m.data)) {
    errors.push(`manifest "data" must be one of ${[...APP_DATA_KINDS].map((k) => `"${k}"`).join(", ")} (got "${m.data}") — where the app's data lives is the author's call, cloud when omitted`);
  }

  // ── ADVICE (warnings — the runtime refuses these on its own) ──────────────
  const unknown = m.capabilities.filter((c) => !KNOWN_CAPABILITIES.has(c));
  if (unknown.length) warnings.push(`unknown capabilities (ignored at runtime): ${unknown.join(", ")}`);

  const badTool = m.tools.find((t) => t.capability && !m.capabilities.includes(t.capability));
  if (badTool) warnings.push(`tool "${badTool.name}" names capability "${badTool.capability}" that is not in the manifest's capabilities — it will be refused at runtime`);

  const handlerTool = m.tools.find((t) => t.handler);
  if (handlerTool && !m.worker) warnings.push(`tool "${handlerTool.name}" uses a handler but no worker is declared — it cannot run`);

  if (m.capabilities.some((c) => c.startsWith("connector.")) && !m.connectors.length) {
    warnings.push("connector.* capabilities with an empty `connectors` list — connector calls will be refused");
  }

  if (workerCode) {
    warnings.push(...checkCallTargets(workerCode));
    warnings.push(...checkCronExpressions(workerCode));
  }

  if (workerCode && lookup) {
    for (const { connector, tool } of extractConnectorCalls(workerCode)) {
      if (!m.connectors.includes(connector)) {
        warnings.push(`connector.call uses "${connector}" but it's not in the manifest connectors list`);
        continue;
      }
      const names = lookup(connector);
      if (!names) { warnings.push(`no live catalog for "${connector}" — tool "${tool}" unverified`); continue; }
      if (!names.includes(tool)) {
        warnings.push(`connector.call tool "${tool}" doesn't exist for "${connector}" (real ones e.g. ${names.slice(0, 3).join(", ")})`);
      }
    }
  }

  if (!bundle[m.entry]) warnings.push(`entry "${m.entry}" absent from the bundle`);
  return { ok: errors.length === 0, errors, warnings, manifest: m };
}
