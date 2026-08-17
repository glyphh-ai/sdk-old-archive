/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/design.ts — GLYPHH DESIGN wire shapes. A design system is the org's
 * brand kit as ONE structured JSON document (colors, fonts, type scale, styles,
 * assets, provenance) stored org-side in R2 — a CONTRACT every surface consumes:
 * Apps first (internal org apps and the apps users ship to customers), Slides
 * second. Addressed by its stable `file` name, like every Office library.
 */

export interface DesignColor { name: string; hex: string; role?: string }

export interface DesignFont {
  family: string;
  fallback?: string;
  weights?: number[];
  source?: "system" | "google" | "custom";
}

export interface DesignAsset {
  /** Slug id — also the R2 key suffix the bytes are served under. */
  id: string;
  kind: "logo" | "icon" | "image";
  title: string;
  contentType: string;
  sizeBytes: number;
}

export interface DesignSource {
  type: "image" | "site" | "prompt";
  ref: string;
  note?: string;
  extractedAt: string;
}

export interface DesignSystem {
  version: 1;
  name: string;
  brand?: { tagline?: string; tone?: string[] };
  colors: {
    primary: string;
    accent?: string;
    background: string;
    surface?: string;
    text: string;
    muted?: string;
    palette?: DesignColor[];
  };
  fonts: { display: DesignFont; body: DesignFont; mono?: DesignFont };
  type?: { baseSize?: number; scale?: number; headingWeight?: number; letterSpacing?: number };
  styles?: {
    radius?: number;
    borderWidth?: number;
    shadow?: "none" | "soft" | "medium" | "bold";
    density?: "compact" | "comfortable" | "spacious";
    gradient?: { from: string; to: string; angle?: number };
  };
  assets?: DesignAsset[];
  sources?: DesignSource[];
}

export interface DesignMeta {
  /** "<slug>.json" — unique per org; the stable name systems are addressed by. */
  file: string;
  title: string;
  sizeBytes: number;
  updatedAt: string;
}

/** One system in full: the metadata plus the complete document. */
export interface Design extends DesignMeta {
  document: DesignSystem;
}

export interface UploadDesignAssetInput {
  /** Slug id; defaults to a slug of the title. Re-uploading an id replaces it. */
  id?: string;
  kind: "logo" | "icon" | "image";
  title: string;
  /** image/png, image/jpeg, image/webp, image/gif, or image/svg+xml. */
  contentType: string;
  dataBase64: string;
}
