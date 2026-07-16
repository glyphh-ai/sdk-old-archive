/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * @glyphh/client/runtime — the local runtime supervisor (Node-only). One runtime per
 * machine, shared by every local client (CLI, desktop), started transparently on first
 * use. Import from `@glyphh/client/runtime`; do not pull into a browser/RN bundle.
 */

export {
  ensureLocalRuntime,
  localRuntimeStatus,
  stopLocalRuntime,
  type LocalRuntime,
  type EnsureRuntimeOptions,
} from "./supervisor.js";
export type { RuntimeRecord } from "./discovery.js";

// The governed model bridge: resolve a rotor's role→model binding into openrotor's
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
