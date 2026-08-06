/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/harness-pod.ts — the machine's ONE LOCAL HARNESS POD: rrotor in
 * `ROTOR_MODE=harness`, auth OFF, loopback-bound (the pod's own bind law when
 * auth is off). This is the local seat of "one harness everywhere" — desktop
 * and CLI chat turns run here through the SDK's `HarnessClient` instead of an
 * embedded agent loop.
 *
 * It reuses the runtime supervisor (singleton lock/discovery/spawn) with a
 * SEPARATE state home (`~/.glyphh/harness/`) so the harness pod's discovery
 * record never collides with the rotor-mode runtime's.
 *
 * Launch command resolution (first match wins):
 *   1. `GLYPHH_LOCAL_ROTOR_CMD` — a full command, whitespace-split (dev:
 *      `node /path/to/rrotor/dist/cli.js`)
 *   2. `GLYPHH_ROTOR_BIN` — an executable
 *   3. `rrotor` on PATH (the published bin)
 */

import { homedir } from "node:os";
import { join } from "node:path";
import {
  ensureLocalRuntime,
  localRuntimeStatus,
  stopLocalRuntime,
  type EnsureRuntimeOptions,
  type LocalRuntime,
} from "./supervisor.js";

export interface LocalHarnessPodOptions
  extends Pick<EnsureRuntimeOptions, "startTimeoutMs" | "fetchImpl" | "spawnImpl" | "now"> {
  /** Harness state home (default `$GLYPHH_HOME/harness` or `~/.glyphh/harness`). */
  home?: string;
  /** Launch command override (whitespace-split; first token is the executable).
   *  Defaults to `$GLYPHH_LOCAL_ROTOR_CMD`, then `$GLYPHH_ROTOR_BIN`, then `rrotor`. */
  cmd?: string;
}

function harnessHome(opts: LocalHarnessPodOptions): string {
  return opts.home ?? join(process.env.GLYPHH_HOME ?? join(homedir(), ".glyphh"), "harness");
}

/** Resolve `{bin, preArgs}` from an override string or the environment. */
export function resolveHarnessCommand(cmd?: string): { bin: string; preArgs: string[] } {
  const raw = cmd ?? process.env.GLYPHH_LOCAL_ROTOR_CMD;
  if (raw?.trim()) {
    const [bin, ...preArgs] = raw.trim().split(/\s+/);
    return { bin: bin!, preArgs };
  }
  return { bin: process.env.GLYPHH_ROTOR_BIN ?? "rrotor", preArgs: [] };
}

function supervisorOptions(opts: LocalHarnessPodOptions): EnsureRuntimeOptions {
  const home = harnessHome(opts);
  const { bin, preArgs } = resolveHarnessCommand(opts.cmd);
  return {
    home,
    bin,
    preArgs,
    env: {
      ROTOR_MODE: "harness",
      // Auth OFF is the local contract — the pod loopback-binds itself and the
      // caller's control-plane token rides each run's `runtimeToken`. Clear any
      // ambient introspection config so an inherited env can't flip it on.
      ROTOR_AUTH_INTROSPECT_URL: undefined,
      ROTOR_AUTH_SERVICE_TOKEN: undefined,
      // Sandboxes + agent config dirs under the harness home, not tmp.
      HARNESS_HOME: join(home, "state"),
    },
    ...(opts.startTimeoutMs !== undefined ? { startTimeoutMs: opts.startTimeoutMs } : {}),
    ...(opts.fetchImpl ? { fetchImpl: opts.fetchImpl } : {}),
    ...(opts.spawnImpl ? { spawnImpl: opts.spawnImpl } : {}),
    ...(opts.now ? { now: opts.now } : {}),
  };
}

/**
 * Return the machine's one local harness pod, starting it (once, atomically)
 * if needed. Safe to call concurrently from multiple processes; the returned
 * `url` is the `HarnessClient` base URL (loopback, no bearer needed).
 */
export async function ensureLocalHarnessPod(opts: LocalHarnessPodOptions = {}): Promise<LocalRuntime> {
  return ensureLocalRuntime(supervisorOptions(opts));
}

/** The current local harness pod, or null if none is running. */
export async function localHarnessPodStatus(opts: LocalHarnessPodOptions = {}): Promise<LocalRuntime | null> {
  return localRuntimeStatus(supervisorOptions(opts));
}

/** Stop the local harness pod (if any) and clear its record. */
export async function stopLocalHarnessPod(opts: LocalHarnessPodOptions = {}): Promise<boolean> {
  return stopLocalRuntime(supervisorOptions(opts));
}
