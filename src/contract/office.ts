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
