/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * authed-http.ts — a thin wrapper that attaches the session bearer to each request,
 * so resource clients (org, members, …) don't repeat the token dance. `token()`
 * refreshes as needed and throws if signed out.
 */

import type { HttpClient } from "./http.js";
import type { TokenProvider } from "../auth/credential-provider.js";

export class AuthedHttp {
  constructor(
    private readonly http: HttpClient,
    private readonly token: TokenProvider,
  ) {}

  async get<T>(path: string): Promise<T> {
    return this.http.get<T>(path, { bearer: await this.token() });
  }
  async post<T>(path: string, body?: unknown): Promise<T> {
    return this.http.post<T>(path, body, { bearer: await this.token() });
  }
  async patch<T>(path: string, body?: unknown): Promise<T> {
    return this.http.patch<T>(path, body, { bearer: await this.token() });
  }
  async del<T>(path: string): Promise<T> {
    return this.http.del<T>(path, { bearer: await this.token() });
  }
}
