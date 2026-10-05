/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/git.ts — GitHub connection surface. A user links GitHub via OAuth (the
 * `connect` link opens GitHub's consent screen; the callback lands server-side), after
 * which the control plane can list their repos and — at session-provision time — mint a
 * short-lived, repo-scoped installation clone token that is injected into the runtime
 * SERVER-SIDE and never returned to the client.
 */

export interface GitConnection {
  connected: boolean;
  /** GitHub login (username), when connected. */
  login: string | null;
  /** The GitHub App installation backing repo access, when present. */
  installationId: string | null;
  connectedAt: string | null;
  /** True while an install this member started waits for `git.complete` (ten
   *  minutes from the callback). Absent otherwise. */
  pending?: boolean;
  /** GitHub's settings page for THIS installation — where repositories
   *  change (an org's lives under the org). Present when connected. */
  installationUrl?: string;
}

/** `git.connect` returns a GitHub URL for the user to open; `state` guards the callback.
 *  The callback lands on `returnTo` with `?github=pending&link=<nonce>`: the SAME
 *  member's session then calls `git.complete(link)` to finish, which is what binds
 *  the installation to the person who started it (a handed-around install link
 *  never lands on someone else's account). */
export interface GitConnectLink {
  url: string;
  state: string;
}

/** `git.connect` input: where GitHub's callback sends the person back once the
 *  App is installed (`?github=connected` or `?github=error&reason=…` appended).
 *  Only our own https hosts and localhost are honored; anything else ends on
 *  the server's plain "connected" page. */
export interface GitConnectOptions {
  returnTo?: string;
}

export interface Repo {
  /** GitHub numeric id as a string. */
  id: string;
  /** `owner/name`. */
  fullName: string;
  private: boolean;
  defaultBranch: string;
  url: string;
}

/** One branch of a repo, as `git.branches` lists them: the default first. */
export interface Branch {
  name: string;
  default: boolean;
}
