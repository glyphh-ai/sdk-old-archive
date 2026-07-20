/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * @glyphh/client/runtime — the Node-only local runtime: the per-machine supervisor,
 * the governed model bridge, and the RUNNER that executes loops and skills. Shared by
 * every local client (CLI, desktop). Import from `@glyphh/client/runtime`; do not pull
 * into a browser/RN bundle.
 */

export {
  ensureLocalRuntime,
  localRuntimeStatus,
  stopLocalRuntime,
  type LocalRuntime,
  type EnsureRuntimeOptions,
} from "./supervisor.js";
export type { RuntimeRecord } from "./discovery.js";

// The governed model bridge: resolve a rotor's role→model binding into rrotor's
// endpoint map, plus per-session model switching with an audit trail.
export {
  resolveModels,
  switchModel,
  sessionOverrides,
  clearSessionOverrides,
  type ModelEndpoint,
  type ResolvedModels,
  type ResolveModelsOptions,
  type SwitchModelOptions,
} from "./models.js";

// The loop/skill runner: one engine, one capability gate, one model egress.
export {
  runProgram,
  CapabilityError,
  type ProgramSource,
  type ProgramCapabilities,
  type RunProgramOptions,
  type RunnerHost,
  type RunResult,
  type RunUsage,
  type ProgressEvent,
  type ProgressType,
  type ProgressStatus,
} from "./runner.js";
