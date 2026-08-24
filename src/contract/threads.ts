/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/threads.ts — SESSION THREADS: the durable conversations stored in the
 * org's regional stator (`/api/sessions/threads`). One set across every surface —
 * web, desktop, CLI — synced Last-Write-Wins: `updatedAt` (EPOCH MILLISECONDS,
 * the app's `Date.now()` clock) is the stamp, a push applies only when STRICTLY
 * newer than the server's copy, and a delete is a tombstone (a stale push can
 * never resurrect it). Thread ids are CLIENT-MINTED text (`c<ts36>` style from
 * the app's newChat — NOT uuids; ≤64 chars of `[A-Za-z0-9_-]`), so a client can
 * create threads offline and drain them up later (`sessions.pushThread` is that
 * cache-sync path). Messages are the app's CodeMsg objects, stored and returned
 * VERBATIM — the server never reshapes them.
 */

/** A message is the app's CodeMsg VERBATIM — `role` anchors it; `text`, `at`
 *  (epoch ms) and the optional `kind`/`attachments`/`decline`/`connect` fields
 *  pass through untouched. Capped at 64KB serialized, 500 per thread push/read. */
export interface SessionThreadMessage {
  role: string;
  [key: string]: unknown;
}

/** The list projection — metadata only, never message bodies. */
export interface SessionThreadMeta {
  /** Client-minted id (`c<ts36>` style — not a uuid). */
  id: string;
  title: string;
  /** The session mode the thread ran in (chat|cowork|code — client vocabulary). */
  mode: string;
  /** The app's structured source descriptor, verbatim (null when never set). */
  source: unknown;
  /** Epoch milliseconds. */
  createdAt: number;
  /** Epoch milliseconds — the LWW clock. */
  updatedAt: number;
  messageCount: number;
}

/** One thread with its messages (the server caps reads at the LAST 500, in order). */
export interface SessionThread extends SessionThreadMeta {
  messages: SessionThreadMessage[];
}

/** The LWW push body. `updatedAt` is the client's epoch-ms clock for THIS state of
 *  the thread; omitted metadata fields keep their stored values, and `messages` —
 *  when present — REPLACES the thread's whole message set (max 500, verbatim). */
export interface PushThreadInput {
  title?: string;
  mode?: string;
  /** Stored verbatim as jsonb. */
  source?: unknown;
  messages?: SessionThreadMessage[];
  /** Epoch milliseconds. */
  updatedAt: number;
}

/** The push verdict: whether the LWW clock let the write apply, plus the thread as
 *  the server now holds it — reconcile the local cache against this either way. */
export interface PushThreadResult {
  applied: boolean;
  thread: SessionThreadMeta;
}
