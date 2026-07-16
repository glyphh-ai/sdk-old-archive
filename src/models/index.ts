/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * @glyphh/client/models — local model management (Node-only). Hardware detection, the
 * installable open-weight catalog + sizing, and the per-model `llama-server` singleton.
 * The user's own compute — free to Glyphh. Import from `@glyphh/client/models`; not for
 * browser/RN bundles.
 */

export { detectHardware, type Hardware } from "./hardware.js";
export { LOCAL_MODELS, findLocalModel, recommendModel, type LocalModelSpec } from "./catalog.js";
export {
  ensureLocalModel,
  localModelStatus,
  stopLocalModel,
  type LocalModelServer,
  type ModelManagerOptions,
} from "./manager.js";
