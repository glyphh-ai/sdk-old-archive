/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/runtime-images.ts — the runtime IMAGE catalog (§7b): the SKUs an org's
 * runtime is provisioned FROM. `free` maps to the region's SHARED runtime; the
 * dedicated sizes map to per-org instances. Rows are per region; prices are flat
 * USD cents per month.
 */

export type RuntimeImageType = "shared" | "dedicated";

/** A catalog image (one region's row for a SKU key). */
export interface RuntimeImage {
  key: string;
  displayName: string;
  region: string;
  type: RuntimeImageType;
  ramMb: number;
  diskGb: number;
  /** Recurring rental in USD cents per month. */
  monthlyUsdCents: number;
  active: boolean;
  sort: number;
}

/** The org's current image + the route it is realized as. */
export interface OrgRuntimeImage {
  /** The bound SKU key ('free' by default, for every org). */
  key: string;
  /** The org's effective region (what the key resolves against). */
  region: string;
  /** The realized route's mode: 'shared' | 'dedicated'. */
  mode: string;
  /** The route's provisioning status ('ready' | 'migrating' | 'error'). */
  status: string;
  /** The resolved catalog image, or null when the bound key no longer exists in the
   *  org's region (a retired SKU — serving continues off the realized route). */
  image: RuntimeImage | null;
  /** PROVENANCE: the catalog row id the current route was provisioned FROM (stamped
   *  on every image transition). Null = last provisioned outside the image path. */
  provisionedImageId: string | null;
}

/** Super-admin create input. */
export interface AdminRuntimeImageCreate {
  key: string;
  region: string;
  displayName: string;
  type: RuntimeImageType;
  ramMb: number;
  diskGb: number;
  monthlyUsdCents?: number;
  active?: boolean;
  sort?: number;
}

/** Super-admin edit input (all optional; omitted fields keep their value). */
export interface AdminRuntimeImageUpdate {
  displayName?: string;
  ramMb?: number;
  diskGb?: number;
  monthlyUsdCents?: number;
  active?: boolean;
  sort?: number;
}
