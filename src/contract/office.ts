/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/office.ts — GLYPHH OFFICE wire shapes, starting with SLIDES. A deck is
 * ONE self-contained HTML document (1920×1080 self-scaling stage, <section
 * class="slide"> pages, built-in nav) stored org-side in R2; decks are org-SHARED
 * agent-authored documents, addressed by their stable `file` name.
 */

export interface OfficeSlideMeta {
  /** "<slug>.html" — unique per org; the stable name decks are addressed by. */
  file: string;
  title: string;
  /** <section class="slide"> count. */
  slides: number;
  sizeBytes: number;
  updatedAt: string;
}

/** One deck in full: the metadata plus the complete HTML document. */
export interface OfficeSlide extends OfficeSlideMeta {
  html: string;
}

// ── DOCS ──────────────────────────────────────────────────────────────────────

export interface OfficeDocMeta {
  /** "<slug>.md" — unique per org; the stable name docs are addressed by. */
  file: string;
  title: string;
  sizeBytes: number;
  /** Drive pointer (null = root). */
  folderId: string | null;
  updatedAt: string;
}

/** One document in full: the metadata plus the complete markdown source. */
export interface OfficeDoc extends OfficeDocMeta {
  markdown: string;
}

/** A proposed edit — review-and-approve. Approve applies the replacement
 *  server-side; a document that moved on resolves "stale", never wrong. */
export interface OfficeSuggestion {
  id: string;
  file: string;
  section: string;
  beforeMd: string;
  afterMd: string;
  note: string;
  authorKind: "agent" | "user";
  status: "pending" | "approved" | "rejected" | "stale";
  createdAt: string;
}

export interface CreateSuggestionInput {
  section?: string;
  /** Exact text to replace; "" (or omitted) appends to the end. */
  beforeMd?: string;
  afterMd: string;
  note?: string;
  authorKind?: "agent" | "user";
}

/** A code-defined document template (served read-only to every org). */
export interface OfficeDocTemplate {
  slug: string;
  name: string;
  category: string;
  description: string;
  markdown: string;
}

// ── DRIVE ─────────────────────────────────────────────────────────────────────

export interface OfficeFolder {
  id: string;
  name: string;
  parentId: string | null;
  updatedAt: string;
}

/** One Drive entry — a POINTER at an Office object, never a copy. */
export interface OfficeDriveFile {
  kind: "slides" | "docs" | "sheets";
  file: string;
  title: string;
  sizeBytes: number;
  folderId: string | null;
  updatedAt: string;
}

export interface OfficeDriveListing {
  folders: OfficeFolder[];
  files: OfficeDriveFile[];
}

// ── SHEETS ────────────────────────────────────────────────────────────────────

/** A cell: a value, or a formula with its MATERIALIZED value ({f, v}) — the
 *  engine runs client/agent-side; stored workbooks always carry values. */
export type SheetCell = string | number | null | { f: string; v?: string | number | null };
export interface SheetColumn {
  name: string;
  type?: "text" | "number" | "date" | "currency";
  /** An AI column: the prompt the agent materializes values from. */
  aiPrompt?: string;
}
export interface Worksheet { name: string; columns: SheetColumn[]; rows: SheetCell[][] }
export interface Workbook { sheets: Worksheet[] }

export interface OfficeSheetMeta {
  /** "<slug>.json" — unique per org; the stable name workbooks are addressed by. */
  file: string;
  title: string;
  sheets: number;
  totalRows: number;
  sizeBytes: number;
  folderId: string | null;
  updatedAt: string;
}

export interface OfficeSheet extends OfficeSheetMeta {
  workbook: Workbook;
}
