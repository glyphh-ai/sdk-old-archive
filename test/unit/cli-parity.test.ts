/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * CLI parity — the enforcement that keeps the SDK the primary client: every public
 * Client method must be covered by at least one CLI command. If someone adds an SDK
 * method without a command, this FAILS the build.
 */

import { describe, it, expect } from "vitest";
import { createClient } from "../../src/index.js";
import { buildRegistry } from "../../src/cli/index.js";
import { sdkSurface } from "../../src/cli/surface.js";

describe("CLI ↔ SDK parity", () => {
  it("every public Client method has a covering command", () => {
    const surface = sdkSurface(createClient({ url: "http://127.0.0.1:3001" }));
    const covered = buildRegistry().covered();
    const missing = surface.filter((m) => !covered.has(m));
    expect(missing, `SDK methods with no CLI command: ${missing.join(", ")}`).toEqual([]);
  });

  it("no command covers a method that no longer exists", () => {
    const surface = new Set(sdkSurface(createClient({ url: "http://127.0.0.1:3001" })));
    const stale = [...buildRegistry().covered()].filter((m) => !surface.has(m));
    expect(stale, `commands covering removed methods: ${stale.join(", ")}`).toEqual([]);
  });
});
