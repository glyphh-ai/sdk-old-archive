/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * app-spec/spec.ts — the build spec handed to whatever is BUILDING a Glyphh
 * app: the desktop's own agent, Claude Code, a CI job, anything speaking the
 * SDK. One authoritative text, so every builder reads the same contract the
 * validator (validate.ts) and the server enforce.
 */

export const GLYPHH_APP_SPEC = `## Building a Glyphh app

A Glyphh app is a REAL project you build in a working folder, then ship. Build
it however makes the best app — Vite + React + TypeScript + Tailwind is the
recommended stack. Use any npm libraries you want (three.js, framer-motion,
chart.js, d3, …) — they are bundled at build time. Make it genuinely beautiful.

There are two ways an app runs:
- LOCAL (panel app): installed into the Glyphh desktop and rendered in a
  sandboxed panel. Inside the desktop, update_app() is THE ONLY ship path.
  (External builders — CI, other tools — package the bundle and install
  through the SDK instead.)
- HOSTED: published to the org and deployed to its own https://<slug>.glyphh.app
  origin (client.apps.publish → releases → deploy). Hosted apps are real server
  projects and may use the network like any web app.

### Project layout (working folder root)
- glyphh.app.json   — the manifest (see below)
- package.json      — your deps + a "build" script
- vite.config.ts    — MUST set \`base: './'\` so built asset paths are relative
- index.html + src/ — your app (React/TS/Tailwind/whatever)
- worker.js         — OPTIONAL headless tool logic (only if the app exposes handler-backed tools)

### The build → ship flow (local)
1. Scaffold the project and write your code.
2. npm install && npm run build — Vite emits dist/.
3. Ship: update_app() — it packages dist/ + glyphh.app.json + worker.js
   (NEVER src/ or node_modules) and installs in one call.
Re-run build + update_app after any change, or the installed app runs the old
code. NEVER ship via a CLI, npx, or any login/device-auth flow — your session
is already authenticated; an agent must never initiate authentication.

### glyphh.app.json
STRICT JSON. REQUIRED: "kind": "glyphh-app", "name", "slug" (lowercase
[a-z0-9_-], no leading underscore), "entry": "index.html".
Recommended: "description", "version" (semver), "icon" (emoji), "category",
"keywords", "about".
Optional: "worker": "worker.js", "window": {width,height}, "capabilities": [...],
"connectors": [...] (connection slugs), "tools": [...],
"data": "cloud" | "local" | "per-home" (where the app's data lives, see below).
Each tool: { "name", "description", "handler" XOR "capability", "inputSchema" }.
Exactly one of handler|capability per tool. Every capability a tool names must
be in the top-level capabilities list; connector.* capabilities need a
non-empty connectors list; NEVER expose agent.run as a tool.

### Where the app's data lives — "data" (the AUTHOR declares it, never the user)
An app is a row in the db. The user never picks where an app's data lives:
you, the author, declare it in the manifest. Omitted = "cloud".
- "cloud" — one store, in the cloud; the app is reachable from anywhere.
- "local" — one store on the member's desktop; the data never leaves the
  machine. The marketplace shows a "Local data" badge, and a local app cannot
  install from the web without a connected desktop.
- "per-home" — a store in each home the member has (desktop + cloud), each
  scoped to that home's documents (the house apps' shape).
Anything else is a validation error.

### Security lines (LOCAL apps — validated at ship AND enforced at runtime)
- NO runtime network from the UI: no remote <script>/<link>, no CDN, no fetch
  to outside origins. Everything is bundled into dist/ at build time. The
  panel's CSP (script-src 'self' file:, connect-src 'none') enforces this; the
  validator refuses a bundle that ships remote references at all.
- The UI reaches the host ONLY through window.glyphh.call(method, args). All
  data access, connectors, and storage go through declared capabilities.
- worker.js is sandboxed: NO fetch / require / import / network / node. Its
  whole world is the SDK: glyphh.handle("name", async (args) => result) to
  register a tool/cron handler; await glyphh.call(cap, args) →
  {ok,result}|{ok:false,error}; glyphh.app.slug. State lives in db.exec.
These are policy, not style: the platform will not install or publish a bundle
that crosses them.

### Version control (the workspace is a real repo)
Initialize git before building (.gitignore: node_modules/, dist/, .env). Work
on a branch, commit in small meaningful steps after green builds, and never
commit node_modules/ or dist/.`;
