/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/ada.ts — Ada memory. `remember` encodes + stores; `recall` returns the
 * top matches ranked by the deterministic HDC fusion. Scope (org → user) is taken
 * from the caller's auth; inputs carry only the container + payload.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  AdaRememberInput,
  AdaRemembered,
  AdaRecallInput,
  AdaRecallHit,
} from "../contract/ada.js";

export class AdaClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Encode + store a memory for the caller (org → user); returns its id + token count. */
  remember(input: AdaRememberInput): Promise<AdaRemembered> {
    return this.http.post<AdaRemembered>("/api/ada/remember", input);
  }

  /** Recall the top-k memories for a query, ranked by HDC fusion. */
  async recall(input: AdaRecallInput): Promise<AdaRecallHit[]> {
    const { hits } = await this.http.post<{ hits: AdaRecallHit[] }>("/api/ada/recall", input);
    return hits;
  }
}
