/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/hosting.ts — app HOSTING. A built app can be deployed to a metered
 * `<slug>.glyphh.app` origin: its bundle is served from durable storage, behind the
 * edge that enforces the app's `access`. Deploy → build → live, with a lifecycle
 * reaper for idle/destroyed deployments. Hosting options are super_admin governed;
 * a member deploys within what their org is entitled to.
 */

export type DeployStatus = "queued" | "building" | "live" | "error" | "destroyed";

export interface Deployment {
  id: string;
  appSlug: string;
  /** The address a PERSON visits, e.g. https://my-app.glyphh.app — null until live.
   *  Never the internal origin the edge proxies to; that one refuses direct traffic. */
  url: string | null;
  status: DeployStatus;
  createdAt: string;
  updatedAt: string;
}

export interface DeployInput {
  /** Slug of a published app to deploy. */
  appSlug: string;
}
