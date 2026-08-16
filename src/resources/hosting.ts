/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/hosting.ts — deploy a published app to a metered `<slug>.glyphh.app` origin.
 * `deploy` returns a Deployment that progresses queued → building → live; `destroy`
 * tears it down. Hosting is metered and reaped when idle.
 *
 * The last-mile surface promotes an app onto its OWN dedicated server (a Fly machine
 * sized by an app-server IMAGE, with its own Postgres) and points a CUSTOM DOMAIN at it:
 *   • `deployToServer` / `serverDeployments` / `destroyServer` — the dedicated deploy;
 *   • `addDomain` / `domains` / `removeDomain` — Cloudflare-for-SaaS custom hostnames,
 *     returning the DNS records the customer must publish.
 * These act on an app by slug, so they hang off the app path, not `/api/hosting`.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Deployment, DeployInput } from "../contract/hosting.js";
import type {
  ServerDeployment, DeployToServerInput, QueuedServerDeployment,
  CustomDomain, AddCustomDomainInput,
} from "../contract/app-servers.js";

export class HostingClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Deploy a published app. */
  deploy(input: DeployInput): Promise<Deployment> {
    return this.http.post<Deployment>("/api/hosting/deploy", input);
  }

  /** Your org's deployments. */
  list(): Promise<Deployment[]> {
    return this.http.get<Deployment[]>("/api/hosting/deployments");
  }

  /** One deployment's status by id. */
  status(id: string): Promise<Deployment> {
    return this.http.get<Deployment>(`/api/hosting/deployments/${encodeURIComponent(id)}`);
  }

  /** Tear down a deployment. */
  destroy(id: string): Promise<void> {
    return this.http.del<void>(`/api/hosting/deployments/${encodeURIComponent(id)}`);
  }

  // ── dedicated app servers (org_admin) ────────────────────────────────────────

  /** Deploy an app onto its OWN dedicated server (sized by an app-server image). Returns
   *  immediately with a queued handle; poll `serverDeployments` for progress. */
  deployToServer(appSlug: string, input: DeployToServerInput): Promise<QueuedServerDeployment> {
    return this.http.post<QueuedServerDeployment>(
      `/api/apps/${encodeURIComponent(appSlug)}/server-deployments`, input,
    );
  }

  /** The app's dedicated-server deployments, newest first. */
  serverDeployments(appSlug: string): Promise<ServerDeployment[]> {
    return this.http.get<ServerDeployment[]>(
      `/api/apps/${encodeURIComponent(appSlug)}/server-deployments`,
    );
  }

  /** Tear down a dedicated server (its machine and its Postgres). */
  destroyServer(appSlug: string, deploymentId: string): Promise<void> {
    return this.http.del<void>(
      `/api/apps/${encodeURIComponent(appSlug)}/server-deployments/${encodeURIComponent(deploymentId)}`,
    );
  }

  // ── custom domains (org_admin) ───────────────────────────────────────────────

  /** Point a custom domain at a dedicated server. The returned domain carries
   *  `dnsInstructions` — the exact records to publish to route + validate it. */
  addDomain(appSlug: string, input: AddCustomDomainInput): Promise<CustomDomain> {
    return this.http.post<CustomDomain>(
      `/api/apps/${encodeURIComponent(appSlug)}/custom-domains`, input,
    );
  }

  /** The app's custom domains. */
  domains(appSlug: string): Promise<CustomDomain[]> {
    return this.http.get<CustomDomain[]>(
      `/api/apps/${encodeURIComponent(appSlug)}/custom-domains`,
    );
  }

  /** Remove a custom domain (and its Cloudflare custom hostname). */
  removeDomain(appSlug: string, domainId: string): Promise<void> {
    return this.http.del<void>(
      `/api/apps/${encodeURIComponent(appSlug)}/custom-domains/${encodeURIComponent(domainId)}`,
    );
  }
}
