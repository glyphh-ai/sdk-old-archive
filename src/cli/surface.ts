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

/** Every public method path a CLI must cover, derived from a real Client instance. */
export function sdkSurface(client: Client): string[] {
  const paths: string[] = [];
  for (const [key, value] of Object.entries(client)) {
    if (typeof value === "function") paths.push(key);
  }
  for (const method of methodsOf(client.auth)) paths.push(`auth.${method}`);
  return paths.sort();
}
