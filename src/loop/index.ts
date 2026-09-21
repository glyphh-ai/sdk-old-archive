/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * loop/index.ts — `@glyphh/sdk/loop` (Node-only): THE GLYPHH LOOP, one agent
 * loop for every host. The desktop's Agent panel and the `glyphh` CLI both run
 * `GlyphhLoop`; a host supplies the gateway credential, the MCP servers it
 * lends, and a sink for the loop's events. Files and the shell are built in
 * (tools.ts), so the module needs a real machine, not a browser.
 */

export {
  GlyphhLoop,
  GATEWAY_OFF_MESSAGE, NO_MODEL_MESSAGE, BUSY_MESSAGE,
  type LoopDeps, type LoopEmit, type LoopEvent, type LoopGateway, type LoopMcpServer, type LoopTurn,
} from "./loop.js";
export {
  gate, toolKind, seedFromChat, shouldCompact, safeToolName, toolTitle, preview, systemPrompt,
  COMPACT_AT_TOKENS, MAX_TOOL_ROUNDS, MAX_TOKENS_OUT,
  type Gate, type LoopHost, type LoopMessage, type LoopPermission, type PromptExtras, type SeedTurn, type ToolKind,
} from "./core.js";
export { BUILTIN_TOOLS, runBuiltin, globToRegExp, type ToolDef } from "./tools.js";
export { streamMessage, assembleStream, sseEvents, type AssembledMessage, type ContentBlock, type MessageParam, type MessagesBody, type ToolSpec } from "./messages.js";
export { McpHttpClient, resultText, type McpCallResult, type McpToolInfo } from "./mcp.js";
