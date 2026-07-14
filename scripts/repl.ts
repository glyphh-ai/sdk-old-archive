/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * repl.ts — an interactive harness that drives @glyphh/client against a running
 * control plane, so the auth flow can be exercised by hand. This IS the SDK's
 * proof: a thin consumer with no privileged access, just the public surface.
 *
 *   npm run repl            (defaults to http://127.0.0.1:3001)
 *   GLYPHH_SERVER_URL=… npm run repl
 *
 * Also accepts piped input:  printf 'magic me@x.com\ntoken\nrefresh\nquit\n' | npm run repl
 */

import * as readline from "node:readline";
import { createClient, type Client } from "../src/index.js";
import { InMemoryTokenStore } from "../src/index.js";
import { banner } from "./banner.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";
const serviceToken = process.env.SERVICE_TOKEN ?? "dev-only-service-token";
const store = new InMemoryTokenStore();
let client: Client = createClient({ url, tokenStore: store, onSignedOut: () => log("· signed out (session became unrecoverable)") });

function log(s: string): void {
  process.stdout.write(s + "\n");
}
function mask(t: string | null | undefined): string {
  return t ? `${t.slice(0, 12)}…${t.slice(-4)}` : "(none)";
}

const HELP = `
  magic <email>        full magic-link sign-in (dev returns the token)
  start <email>        just request a link (prints the dev token/url)
  verify <token>       verify a magic token → session
  google <idToken>     native Google sign-in (paste a real id token)
  apple <idToken>      native Apple sign-in
  org <email>          organization SSO — prints the authorization URL
  exchange <code>      trade a one-time code for a session
  token                print the current bearer (auto-refreshes)
  refresh              force a refresh (watch it rotate)
  session              show the stored session (masked)
  introspect           call /api/auth/introspect on the current token
  signout              revoke + clear
  health               GET /healthz + /readyz
  url <newUrl>         point at a different server
  help · quit
`;

async function run(line: string): Promise<void> {
  const [cmd, ...rest] = line.trim().split(/\s+/);
  const arg = rest.join(" ");
  switch (cmd) {
    case "":
      return;
    case "help":
      log(HELP);
      return;
    case "url":
      if (arg) {
        client = createClient({ url: arg, tokenStore: store });
        log(`· server → ${arg}`);
      } else log(`server: ${url}`);
      return;
    case "start": {
      const r = await client.auth.startEmailLink(arg);
      log(`· sent=${r.sent} expiresIn=${r.expiresInSeconds}s  devToken=${r.devToken ?? "(prod: check email)"}`);
      return;
    }
    case "magic": {
      const r = await client.auth.startEmailLink(arg);
      if (!r.devToken) {
        log("· link sent (prod server, no dev token). Use: verify <token>");
        return;
      }
      const s = await client.auth.verifyEmailLink(r.devToken);
      log(`· signed in ✓  access=${mask(s.accessToken)}  refresh=${mask(s.refreshToken)}`);
      return;
    }
    case "verify": {
      const s = await client.auth.verifyEmailLink(arg);
      log(`· signed in ✓  access=${mask(s.accessToken)}`);
      return;
    }
    case "google": {
      const s = await client.auth.google(arg);
      log(`· signed in ✓  access=${mask(s.accessToken)}`);
      return;
    }
    case "apple": {
      const s = await client.auth.apple(arg);
      log(`· signed in ✓  access=${mask(s.accessToken)}`);
      return;
    }
    case "org": {
      const r = await client.auth.startOrgSso({ email: arg, redirectUri: "glyphh://auth/callback" });
      log(`· open in a browser:\n  ${r.authorizationUrl}`);
      return;
    }
    case "exchange": {
      const s = await client.auth.exchange(arg);
      log(`· signed in ✓  access=${mask(s.accessToken)}`);
      return;
    }
    case "token": {
      const t = await client.token();
      log(`· bearer: ${mask(t)}`);
      return;
    }
    case "refresh": {
      const before = (await client.getSession())?.accessToken;
      const ok = await client.refresh();
      const after = (await client.getSession())?.accessToken;
      log(ok ? `· rotated  ${mask(before)} → ${mask(after)}` : "· not signed in");
      return;
    }
    case "session": {
      const s = await client.getSession();
      log(s ? `· access=${mask(s.accessToken)}  refresh=${mask(s.refreshToken)}  expiresAt=${new Date(s.expiresAt).toISOString()}` : "· (no session)");
      return;
    }
    case "introspect": {
      const s = await client.getSession();
      if (!s) return log("· (no session)");
      const res = await fetch(`${url}/api/auth/introspect`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${serviceToken}` },
        body: JSON.stringify({ token: s.accessToken }),
      });
      log(`· introspect: ${await res.text()}`);
      return;
    }
    case "signout":
      await client.auth.signOut();
      log("· signed out ✓");
      return;
    case "health": {
      const h = await fetch(`${url}/healthz`).then((r) => r.status);
      const rz = await fetch(`${url}/readyz`).then((r) => r.status);
      log(`· healthz=${h}  readyz=${rz}`);
      return;
    }
    case "quit":
    case "exit":
      process.exit(0);
      break;
    default:
      log(`? unknown command: ${cmd} (try 'help')`);
  }
}

async function main(): Promise<void> {
  log(banner(`glyphh client v0.1.0  ·  ${url}`));
  log(HELP);
  // terminal:true (in a TTY) turns on readline's line editing + arrow-key history;
  // `output` lets it render. The for-await loop still processes lines sequentially,
  // so `quit` can't race an in-flight command (and piped input works unchanged).
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: Boolean(process.stdin.isTTY),
    prompt: "glyphh> ",
    historySize: 200,
  });
  rl.prompt();
  for await (const line of rl) {
    try {
      await run(line);
    } catch (e) {
      const err = e as { name?: string; message?: string };
      log(`✗ ${err?.name ?? "Error"}: ${err?.message ?? String(e)}`);
    }
    rl.prompt();
  }
}

void main();
