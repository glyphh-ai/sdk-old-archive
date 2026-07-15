/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/hosting.ts — app HOSTING. A published app can be deployed to a metered
 * `<slug>.glyphh.app` origin (fly under the hood). Deploy → build → live, with a
 * lifecycle reaper for idle/destroyed deployments. Hosting options are super_admin
 * governed; a member deploys within what their org is entitled to.
 */

export type DeployStatus = "queued" | "building" | "live" | "error" | "destroyed";

export interface Deployment {
  id: string;
  appSlug: string;
  /** The public origin once live, e.g. https://my-app.glyphh.app. Null until live. */
  url: string | null;
  status: DeployStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeployInput {
  /** Slug of a published app to deploy. */
  appSlug: string;
}
