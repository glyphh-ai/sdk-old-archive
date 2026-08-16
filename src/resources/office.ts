/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/office.ts — GLYPHH OFFICE, starting with SLIDES. Decks are org-shared,
 * agent-authored HTML slide documents in the org's R2 space; every surface
 * (desktop, web, pods) reads the same library. `put` is create-or-overwrite by
 * name — the suite has no edit surface, the agent re-authors and saves.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { OfficeSlide, OfficeSlideMeta } from "../contract/office.js";

export class OfficeSlidesClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The org's decks, most recently touched first. */
  list(): Promise<OfficeSlideMeta[]> {
    return this.http.get<OfficeSlideMeta[]>("/api/office/slides");
  }

  /** One deck by name — metadata plus the complete HTML document. */
  get(file: string): Promise<OfficeSlide> {
    return this.http.get<OfficeSlide>(`/api/office/slides/${encodeURIComponent(file)}`);
  }

  /** Create or overwrite a deck by name. The server validates the deck shape
   *  (needs <section class="slide"> pages) and extracts title + slide count. */
  put(file: string, html: string): Promise<OfficeSlideMeta> {
    return this.http.put<OfficeSlideMeta>(`/api/office/slides/${encodeURIComponent(file)}`, { html });
  }

  /** Delete a deck for the whole org — the stored document and its index row. */
  delete(file: string): Promise<void> {
    return this.http.del<void>(`/api/office/slides/${encodeURIComponent(file)}`);
  }
}
