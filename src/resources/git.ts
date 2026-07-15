/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/git.ts — GitHub connection. `connect` returns a URL the user opens to grant
 * GitHub access (the callback lands server-side); once linked, `repos` lists their
 * repositories and a session created with a `repo` gets a repo-scoped clone token
 * injected into its runtime SERVER-SIDE — the token never reaches the client.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { GitConnection, GitConnectLink, Repo } from "../contract/git.js";

export class GitClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Begin linking GitHub — open the returned `url` to grant access. */
  connect(): Promise<GitConnectLink> {
    return this.http.post<GitConnectLink>("/api/git/connect", {});
  }

  /** Whether GitHub is linked, and as whom. */
  status(): Promise<GitConnection> {
    return this.http.get<GitConnection>("/api/git/status");
  }

  /** The connected account's repositories. */
  repos(): Promise<Repo[]> {
    return this.http.get<Repo[]>("/api/git/repos");
  }

  /** Unlink GitHub. */
  disconnect(): Promise<void> {
    return this.http.del<void>("/api/git/connection");
  }
}
