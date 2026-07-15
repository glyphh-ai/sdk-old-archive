/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/hosting.ts — deploy a published app to a metered `<slug>.glyphh.app` origin.
 * `deploy` returns a Deployment that progresses queued → building → live; `destroy`
 * tears it down. Hosting is metered and reaped when idle.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Deployment, DeployInput } from "../contract/hosting.js";

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
}
