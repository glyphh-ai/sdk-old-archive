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
import type { Loop, LoopSummary, CreateLoopInput, UpdateLoopInput, ResolvedLoopRole, AvailableLoop } from "../contract/loops.js";

export class LoopsClient {
  constructor(private readonly http: AuthedHttp) {}

  /**
   * The CLI LOOPS the caller may actually use — the vendor catalog narrowed
   * by the org's support list, then by the caller's role (governance plans
   * only). Exactly one comes back flagged default.
   *
   * Distinct from the loop LIBRARY methods below: this is which CLI a member
   * may drive, not which program they may run.
   */
  available(): Promise<AvailableLoop[]> {
    return this.http.get<AvailableLoop[]>("/api/loops/available");
  }

  list(): Promise<{ loops: LoopSummary[] }> {
    return this.http.get<{ loops: LoopSummary[] }>("/api/loops");
  }
  get(ref: string): Promise<Loop> {
    return this.http.get<Loop>(`/api/loops/${encodeURIComponent(ref)}`);
  }
  /**
   * Everything a model picker needs, in one call: the slots this loop declares,
   * what each is for, what it resolves to now, and every model the caller could
   * choose. Pass `selections` to preview a choice before saving it.
   *
   * The dropdown and the run agree by construction, because both read this.
   */
  async roles(
    ref: string,
    selections: Record<string, string> = {},
    opts: { context?: "local" | "cloud" } = {},
  ): Promise<ResolvedLoopRole[]> {
    const qs = Object.entries(selections).map(([role, model]) => `select=${encodeURIComponent(`${role}:${model}`)}`);
    // context=cloud resolves for a CLOUD session — the server excludes on-device
    // models, whose weights only exist on the caller's machine.
    if (opts.context === "cloud") qs.push("context=cloud");
    const { roles } = await this.http.get<{ roles: ResolvedLoopRole[] }>(
      `/api/loops/${encodeURIComponent(ref)}/roles${qs.length ? `?${qs.join("&")}` : ""}`,
    );
    return roles;
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

  /** Submit MY personal loop to the org admin for org-wide sharing. */
  share(ref: string): Promise<{ id: string; status: string }> {
    return this.http.post<{ id: string; status: string }>(`/api/loops/${encodeURIComponent(ref)}/share`, {});
  }

  /** Publish an ORG-shared loop to the marketplace (org_admin; platform-reviewed, always free). */
  publish(ref: string): Promise<{ id: string; reviewStatus: string }> {
    return this.http.post<{ id: string; reviewStatus: string }>(`/api/loops/${encodeURIComponent(ref)}/publish`, {});
  }
}
