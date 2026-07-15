/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * auth-client.ts — the typed sign-in surface every client renders on top of. Each
 * method calls the control plane, adopts the returned opaque session into the
 * refresh manager, and returns the stored session. All four methods converge to
 * one session type, so the UI differs only in which button was tapped.
 */

import type { HttpClient } from "../core/http.js";
import type { RefreshManager } from "./refresh-manager.js";
import type { AppleName, IssuedSession, MagicLinkStart, OrgSsoParams, OrgSsoStart, StoredSession } from "../contract/auth.js";

export class AuthClient {
  constructor(
    private readonly http: HttpClient,
    private readonly refresh: RefreshManager,
  ) {}

  async #adopt(issued: IssuedSession): Promise<StoredSession> {
    return this.refresh.adopt(issued);
  }

  // ── email magic link (passwordless) ─────────────────────────────────────────
  startEmailLink(email: string, opts: { redirectUri?: string; machineId?: string } = {}): Promise<MagicLinkStart> {
    return this.http.post<MagicLinkStart>("/api/auth/magic/start", { email, ...opts });
  }
  async verifyEmailLink(token: string, machineId?: string): Promise<StoredSession> {
    const issued = await this.http.post<IssuedSession>("/api/auth/magic/verify", { token, ...(machineId ? { machineId } : {}) });
    return this.#adopt(issued);
  }

  // ── native social ───────────────────────────────────────────────────────────
  async google(idToken: string, machineId?: string): Promise<StoredSession> {
    const issued = await this.http.post<IssuedSession>("/api/auth/google", { idToken, ...(machineId ? { machineId } : {}) });
    return this.#adopt(issued);
  }
  async apple(identityToken: string, opts: { fullName?: AppleName; machineId?: string } = {}): Promise<StoredSession> {
    const issued = await this.http.post<IssuedSession>("/api/auth/apple", { identityToken, ...opts });
    return this.#adopt(issued);
  }

  // ── organization OAuth/SSO (WorkOS, browser handoff) ────────────────────────
  /** Returns the WorkOS authorization URL to open in a system browser. */
  startOrgSso(params: OrgSsoParams): Promise<OrgSsoStart> {
    return this.http.post<OrgSsoStart>("/api/auth/org/start", params);
  }
  /** Trade the one-time code (from the app's deep-link callback) for a session. */
  async exchange(code: string, machineId?: string): Promise<StoredSession> {
    const issued = await this.http.post<IssuedSession>("/api/auth/exchange", { code, ...(machineId ? { machineId } : {}) });
    return this.#adopt(issued);
  }

  // ── session ─────────────────────────────────────────────────────────────────
  signOut(): Promise<void> {
    return this.refresh.signOut();
  }
}
