/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/loops.ts — the org's LOOP library: a manifest + a `.js` program per
 * loop. Any member lists/reads; only an org_admin creates/edits/deletes
 * (server-enforced). The built-in "Default" loop is read-only — editing or deleting
 * it surfaces as a ForbiddenError.
 *
 * `get`/`update`/`remove` accept a slug or an id: the UI holds ids, the CLI and a
 * loop's own references use slugs.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Loop, LoopSummary, CreateLoopInput, UpdateLoopInput } from "../contract/loops.js";

export class LoopsClient {
  constructor(private readonly http: AuthedHttp) {}

  list(): Promise<{ loops: LoopSummary[] }> {
    return this.http.get<{ loops: LoopSummary[] }>("/api/loops");
  }
  get(ref: string): Promise<Loop> {
    return this.http.get<Loop>(`/api/loops/${encodeURIComponent(ref)}`);
  }
  create(input: CreateLoopInput): Promise<Loop> {
    return this.http.post<Loop>("/api/loops", input);
  }
  update(id: string, patch: UpdateLoopInput): Promise<Loop> {
    return this.http.patch<Loop>(`/api/loops/${encodeURIComponent(id)}`, patch);
  }
  remove(id: string): Promise<void> {
    return this.http.del<void>(`/api/loops/${encodeURIComponent(id)}`);
  }
}
