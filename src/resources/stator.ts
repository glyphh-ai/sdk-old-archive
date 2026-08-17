/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/stator.ts — the org memory plane. recall/write are the runtime
 * path; browse/graph/forget/amend are the curation surface (the Memory panel).
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type {
  StatorRecallInput, StatorRecallResult, StatorWriteInput,
  StatorBrowseResult, StatorGraphInput, StatorGraphResult,
  StatorForgetInput, StatorAmendInput,
} from "../contract/stator.js";

export class StatorClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Standing directives + semantic hits (scored) + the entity's fact node. */
  recall(input: StatorRecallInput = {}): Promise<StatorRecallResult> {
    return this.http.post<StatorRecallResult>("/api/stator/recall", input, { raw: true });
  }

  /** Persist a turn (recency + similarity corpus) or absorb facts from text. */
  write(input: StatorWriteInput): Promise<{ written: number; mode: string }> {
    return this.http.post<{ written: number; mode: string }>("/api/stator/write", input, { raw: true });
  }

  /** The raw memory: every fact (version chains included), the corpus, the window. */
  browse(threadId?: string): Promise<StatorBrowseResult> {
    return this.http.post<StatorBrowseResult>("/api/stator/browse", threadId ? { threadId } : {}, { raw: true });
  }

  /** The semantic space as data: nodes, 3D PCA coords, banded similarity edges. */
  graph(input: StatorGraphInput = {}): Promise<StatorGraphResult> {
    return this.http.post<StatorGraphResult>("/api/stator/graph", input, { raw: true });
  }

  /** Targeted deletes: a fact filter (≥1 field) and/or an exact turn text. */
  forget(input: StatorForgetInput): Promise<{ deleted: number }> {
    return this.http.post<{ deleted: number }>("/api/stator/forget", input, { raw: true });
  }

  /** Correct a fact — keyed amends supersede the chain, keyless replace. */
  amend(input: StatorAmendInput): Promise<{ written: number }> {
    return this.http.post<{ written: number }>("/api/stator/amend", input, { raw: true });
  }
}
