/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/office.ts — GLYPHH OFFICE, starting with SLIDES. Decks are org-shared,
 * agent-authored HTML slide documents in the org's R2 space; every surface
 * (desktop, web, pods) reads the same library. `put` is create-or-overwrite by
 * name — the suite has no edit surface, the agent re-authors and saves.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { OfficeDoc, OfficeDocMeta, OfficeSuggestion, CreateSuggestionInput, OfficeDocTemplate, OfficeSheet, OfficeSheetMeta, Workbook } from "../contract/office.js";


// ── DOCS — markdown documents with the review-and-approve edit flow ──────────


export class OfficeDocsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The org's documents, most recently touched first. */
  list(): Promise<OfficeDocMeta[]> {
    return this.http.get<OfficeDocMeta[]>("/api/office/docs");
  }

  /** One document by name — metadata plus the complete markdown source. */
  get(file: string): Promise<OfficeDoc> {
    return this.http.get<OfficeDoc>(`/api/office/docs/${encodeURIComponent(file)}`);
  }

  /** Create or overwrite by name. Omit folderId to keep the current Drive
   *  pointer; null files at the root. Title comes from the first H1. */
  put(file: string, markdown: string, folderId?: string | null): Promise<OfficeDocMeta> {
    const body: { markdown: string; folderId?: string | null } = { markdown };
    if (folderId !== undefined) body.folderId = folderId;
    return this.http.put<OfficeDocMeta>(`/api/office/docs/${encodeURIComponent(file)}`, body);
  }

  /** Delete a document for the whole org. */
  delete(file: string): Promise<void> {
    return this.http.del<void>(`/api/office/docs/${encodeURIComponent(file)}`);
  }

  /** A document's suggestions (optionally one status, e.g. "pending"). */
  suggestions(file: string, status?: string): Promise<OfficeSuggestion[]> {
    const qs = status ? `?status=${encodeURIComponent(status)}` : "";
    return this.http.get<OfficeSuggestion[]>(`/api/office/docs/${encodeURIComponent(file)}/suggestions${qs}`);
  }

  /** Propose an edit (review-and-approve): a targeted replacement with a note. */
  suggest(file: string, input: CreateSuggestionInput): Promise<OfficeSuggestion> {
    return this.http.post<OfficeSuggestion>(`/api/office/docs/${encodeURIComponent(file)}/suggestions`, input);
  }

  /** Approve (applies the change) or reject a pending suggestion. */
  resolveSuggestion(id: string, approve: boolean): Promise<OfficeSuggestion> {
    return this.http.post<OfficeSuggestion>(`/api/office/suggestions/${encodeURIComponent(id)}/resolve`, { approve });
  }

  /** The code-defined template catalog (resume, bill of sale, …). */
  templates(): Promise<OfficeDocTemplate[]> {
    return this.http.get<OfficeDocTemplate[]>("/api/office/doc-templates");
  }
}

// ── DRIVE — folders + the pointer view over every Office file ────────────────


// ── SHEETS — JSON workbooks; formula values arrive materialized ──────────────

export class OfficeSheetsClient {
  constructor(private readonly http: AuthedHttp) {}

  /** The org's workbooks, most recently touched first. */
  list(): Promise<OfficeSheetMeta[]> {
    return this.http.get<OfficeSheetMeta[]>("/api/office/sheets");
  }

  /** One workbook by name — metadata plus the full JSON workbook. */
  get(file: string): Promise<OfficeSheet> {
    return this.http.get<OfficeSheet>(`/api/office/sheets/${encodeURIComponent(file)}`);
  }

  /** Create or overwrite by name. Formula cells must carry their materialized
   *  values ({f, v}) — recompute before saving. */
  put(file: string, title: string, workbook: Workbook, folderId?: string | null): Promise<OfficeSheetMeta> {
    const body: { title: string; workbook: Workbook; folderId?: string | null } = { title, workbook };
    if (folderId !== undefined) body.folderId = folderId;
    return this.http.put<OfficeSheetMeta>(`/api/office/sheets/${encodeURIComponent(file)}`, body);
  }

  /** Delete a workbook for the whole org. */
  delete(file: string): Promise<void> {
    return this.http.del<void>(`/api/office/sheets/${encodeURIComponent(file)}`);
  }

}
