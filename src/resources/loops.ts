/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/loops.ts — LOOPS: the CLI pre-configs a member may drive.
 *
 * The former loop LIBRARY moved to resources/tasks.ts — those became TASKS.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Loop } from "../contract/loops.js";

export class LoopsClient {
  constructor(private readonly http: AuthedHttp) {}

  /**
   * The loops the caller may actually drive — the vendor catalog narrowed by
   * the org's support list, then by the caller's role (governance plans only).
   * Exactly one comes back flagged default, so no client invents a fallback.
   */
  list(): Promise<Loop[]> {
    return this.http.get<Loop[]>("/api/loops/available");
  }
}
