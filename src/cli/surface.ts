/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * surface.ts — reflect the SDK's public method paths from a live Client, so the
 * parity test can assert every one has a CLI command. Top-level function members
 * become `name`; the `auth` sub-client's prototype methods become `auth.<name>`.
 */

import type { Client } from "../client.js";

const SKIP = new Set(["constructor"]);

function methodsOf(obj: object): string[] {
  const proto = Object.getPrototypeOf(obj) as object | null;
  const names = proto ? Object.getOwnPropertyNames(proto) : [];
  return names.filter((n) => !SKIP.has(n) && typeof (obj as Record<string, unknown>)[n] === "function");
}

/**
 * Every public method path a CLI must cover, derived from a real Client instance:
 * top-level functions become `name`; each sub-client (auth, org, members, …) object
 * contributes `name.method`. Adding a resource client therefore auto-extends what
 * the parity test enforces.
 */
export function sdkSurface(client: Client): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(client)) {
    if (typeof value === "function") {
      paths.push(key);
    } else if (value && typeof value === "object") {
      for (const method of methodsOf(value)) paths.push(`${key}.${method}`);
    }
  }
  return paths.sort();
}
