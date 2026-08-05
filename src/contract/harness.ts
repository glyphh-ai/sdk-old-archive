/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/harness.ts — the `glyphh.harness/v1` wire contract: the frame
 * vocabulary a hosted HARNESS SESSION POD streams for one interactive run.
 * Mirrored VERBATIM from the pod (rrotor `src/harness/frames.ts` +
 * `config.ts`) — the frames are the renderer's vocabulary (desktop channel
 * `glyphh-agent:${frame.type}`), so a web bridge dispatches them unchanged.
 *
 *   delta     streamed answer text; append
 *   tool      a tool began / finished (denied/failed/preview on done)
 *   progress  live token accounting
 *   credits   running metered price (pod v1 never emits it; vocabulary kept)
 *   approval  PAUSES the run — answer { id, allow } to resume (or the pod's
 *             approval timeout denies)
 *   ask       PAUSES the run — answer { id, answers } (or the pod's ask
 *             timeout resolves empty and the agent re-plans)
 *   setup     reserved (desktop model download/build UI); pod v1 never emits
 *   done      terminal; stopped=true when aborted
 *   error     terminal; human-readable
 *
 * On the wire every frame is enveloped with a monotonic `seq` (the replay
 * cursor), the `runId` it belongs to, and an `at` timestamp — the durable
 * reconnect contract (replay `?from=<seq>` is exclusive).
 */

/** One question the agent puts to the user (the desktop's `ask_user` shape). */
export interface HarnessAskQuestion {
  question: string;
  options?: string[];
}

/** The action taxonomy the pod's approval gate classifies tools into. */
export type HarnessActionKind = "read" | "edit" | "command" | "network" | "dangerous";

/** Session modes: `chat` runs tool-less; `cowork`/`code` get the sandbox toolset. */
export type HarnessMode = "chat" | "cowork" | "code";

/** Permission modes, verbatim from the desktop harness. */
export type HarnessPermission = "ask" | "plan" | "acceptEdits" | "auto" | "bypass";

/** A harness event frame, pre-envelope. Shapes mirror the pod's emit sites. */
export type HarnessFrame =
  | { type: "delta"; delta: string }
  | {
      type: "tool";
      phase: "start" | "done";
      name: string;
      thought?: string;
      title?: string;
      denied?: boolean;
      failed?: boolean;
      preview?: string;
    }
  | { type: "progress"; inTokens: number; outTokens: number }
  | { type: "credits"; creditsMicro: number }
  | { type: "approval"; id: string; kind: HarnessActionKind; title: string; detail: string }
  | { type: "ask"; id: string; questions: HarnessAskQuestion[] }
  | { type: "setup"; phase: string; [k: string]: unknown }
  | { type: "done"; stopped: boolean }
  | { type: "error"; error: string };

/** A frame as it rides the transport: enveloped with run identity + cursor. */
export type HarnessWireFrame = HarnessFrame & { seq: number; runId: string; at: number };

/** The pod's frame wire version (`POST /run` echoes it; major must match). */
export const HARNESS_WIRE_VERSION = "glyphh.harness/v1";

/** Terminal frame types — after one of these the run emits nothing further. */
export function isHarnessTerminal(frame: Pick<HarnessFrame, "type">): boolean {
  return frame.type === "done" || frame.type === "error";
}

/** True when a parsed wire message is an enveloped harness frame (vs a WS
 *  control message like `{type:"ready"}` — those carry no `seq`). */
export function isHarnessWireFrame(msg: unknown): msg is HarnessWireFrame {
  const m = msg as { seq?: unknown; type?: unknown } | null;
  return !!m && typeof m.seq === "number" && typeof m.type === "string";
}

/** A server-signed attachment the pod fetches once at run start. */
export interface HarnessAttachmentRef {
  name: string;
  url: string;
}

/** A prior turn replayed into the agent's context. */
export interface HarnessChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** The `POST /run` body (prompt required; the bearer defaults `runtimeToken`
 *  and the token's binding defaults `sessionId` — omit both normally). */
export interface HarnessRunBody {
  prompt: string;
  /** The CLIENT's thread id (`^[A-Za-z0-9_-]{1,64}$`) — scopes the recorded
   *  transcript; auth stays bound to the token's sessionId. */
  threadId?: string;
  mode?: HarnessMode;
  sessionId?: string;
  model?: string;
  system?: string;
  permission?: HarnessPermission;
  history?: HarnessChatTurn[];
  attachments?: HarnessAttachmentRef[];
  gatewayUrl?: string;
  maxTurns?: number;
}

/** The `POST /run` 200 ack. */
export interface HarnessRunAck {
  runId: string;
  sessionId: string;
  wire: string;
}

/** An answer to a parked `approval` (`allow`) or `ask` (`answers`) frame. */
export interface HarnessAnswer {
  allow?: boolean;
  answers?: string[];
}

/** The terminal result of a harness run. An `error` FRAME resolves here (the
 *  run finished, honestly, with an error) — only a transport-level failure
 *  (unreachable pod, reconnect exhausted, bad wire) rejects `done`. */
export interface HarnessRunResult {
  runId: string;
  /** True when the run was aborted (client stop or pod-side stop). */
  stopped: boolean;
  /** The full answer text (every `delta`, concatenated). */
  text: string;
  /** Present when the run terminated with an `error` frame. */
  error?: string;
}
