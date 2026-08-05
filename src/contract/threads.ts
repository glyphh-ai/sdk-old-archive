/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/threads.ts — SESSION THREADS: the durable conversations stored in the
 * org's regional stator (`/api/sessions/threads`). One set across every surface —
 * web, desktop, CLI — synced Last-Write-Wins: `updatedAt` is the clock, a push
 * applies only when STRICTLY newer than the server's copy, and a delete is a
 * tombstone (a stale push can never resurrect it). Thread ids are CLIENT-MINTED
 * uuids, so a client can create threads offline and drain them up later
 * (`sessions.pushThread` is that cache-sync path).
 */

/** One message as stored — `content` is whatever the client/rotor shaped (a string
 *  or structured blocks); the server never interprets it. */
export interface SessionThreadMessage {
  id: string;
  role: string;
  content: unknown;
  createdAt: string;
}

/** The list projection — metadata only, never message bodies. */
export interface SessionThreadMeta {
  id: string;
  title: string;
  /** The session mode the thread ran in (chat|cowork|code — client vocabulary). */
  mode: string;
  /** Which surface created it (web|desktop|cli|mobile). */
  source: string;
  createdAt: string;
  updatedAt: string;
  messageCount: number;
}

/** One thread with its messages (the server caps reads at the LAST 500, in order). */
export interface SessionThread extends SessionThreadMeta {
  messages: SessionThreadMessage[];
}

/** A message in a push — `id`/`createdAt` are optional (server fills them). */
export interface PushThreadMessage {
  id?: string;
  role: string;
  content: unknown;
  createdAt?: string;
}

/** The LWW push body. `updatedAt` is the client's clock for THIS state of the
 *  thread; omitted metadata fields keep their stored values, and `messages` — when
 *  present — REPLACES the thread's whole message set (max 500). */
export interface PushThreadInput {
  title?: string;
  mode?: string;
  source?: string;
  messages?: PushThreadMessage[];
  updatedAt: string;
}

/** The push verdict: whether the LWW clock let the write apply, plus the thread as
 *  the server now holds it — reconcile the local cache against this either way. */
export interface PushThreadResult {
  applied: boolean;
  thread: SessionThreadMeta;
}
