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
