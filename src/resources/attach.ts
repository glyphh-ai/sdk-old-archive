/**
 * attach.ts — the cloud's REST view of the caller's attached desktop machine(s).
 *
 * The desktop opens an outbound WebSocket (/ws/attach) that the SDK does NOT
 * manage — that lives in the desktop main process. This client is the OTHER
 * side: status + dispatch, used by the platform UI and by the server-side agent
 * to drive the signed-in user's own machine. Self only; no attached machine →
 * dispatch rejects (E_FAILED_PRECONDITION).
 */

import type { AuthedHttp } from "../core/authed-http.js";

export interface AttachedMachine {
  app: string;
  version: string;
  capabilities: string[];
  since: number;
}

export interface AttachStatus {
  attached: boolean;
  machines: AttachedMachine[];
}

/** One entry in an attached machine's directory listing (`attach.fsList`). */
export interface FsEntry {
  /** Base name (no path). */
  name: string;
  /** Absolute path on the attached machine. */
  path: string;
  /** A directory the browser can descend into vs. a leaf file. */
  dir: boolean;
  /** True when the directory is itself a git working tree (a repo root). */
  git?: boolean;
}

/** The result of an `attach.fsList` walk: the listed directory + its children. */
export interface FsListing {
  /** The absolute path that was listed (the machine's root when none was asked for). */
  path: string;
  /** The parent path to walk back up to, or null at the machine root. */
  parent: string | null;
  entries: FsEntry[];
}

export class AttachClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Is the caller's desktop attached right now, and what can it do. */
  status(): Promise<AttachStatus> {
    return this.http.get<AttachStatus>("/api/attach/status");
  }

  /** Run a method ON the caller's own machine and return its result. */
  async dispatch<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    const { result } = await this.http.post<{ result: T }>("/api/attach/dispatch", { method, params: params ?? {} });
    return result;
  }

  /**
   * Browse the attached machine's OWN filesystem (self only), for picking a
   * folder to run a LOCAL session in. Omit `path` to start at the root the
   * desktop chooses to expose. Thin typed wrapper over `dispatch('fs.list')`;
   * a machine whose desktop build predates the `fs.list` handler rejects the
   * dispatch — callers should surface that as an honest "needs a desktop
   * update" state rather than an error.
   */
  fsList(path?: string): Promise<FsListing> {
    return this.dispatch<FsListing>("fs.list", path ? { path } : {});
  }
}
