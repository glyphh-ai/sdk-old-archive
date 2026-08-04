/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/profile.ts — the caller's own editable profile (name + timezone). Acts
 * on the authenticated principal only; there is no id — a user can only read/edit
 * themselves. Email is identity (changed elsewhere) and role is read-only.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { SelfProfile, SelfProfileUpdate } from "../contract/user.js";

export class ProfileClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The caller's editable profile. */
  get(): Promise<SelfProfile> {
    return this.http.get<SelfProfile>("/api/user/me");
  }

  /** Update the caller's name and/or timezone. */
  /** The caller's full preference map (theme, UI + layout state) — org→user
   *  tenant content, stored in the stator. */
  prefs(): Promise<Record<string, unknown>> {
    return this.http.get<{ prefs: Record<string, unknown> }>("/api/me/prefs").then((r) => r.prefs);
  }

  /** Upsert preference keys; a `null` value DELETES that key. Returns the full map. */
  setPrefs(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
    return this.http.patch<{ prefs: Record<string, unknown> }>("/api/me/prefs", { prefs: patch }).then((r) => r.prefs);
  }

  update(patch: SelfProfileUpdate): Promise<SelfProfile> {
    return this.http.patch<SelfProfile>("/api/user/me", patch);
  }
}
