/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * @glyphh/sdk/runtime — the Node-only attach host: a machine's outbound socket to
 * the relay, shared by the CLI's remote control and the desktop. Import from
 * `@glyphh/sdk/runtime`; do not pull into a browser/RN bundle.
 */

export { startAttachHost, type AttachHost, type AttachHostOptions, type AttachHandler } from "./attach.js";
