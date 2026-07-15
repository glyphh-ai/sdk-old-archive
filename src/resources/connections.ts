/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/connections.ts — the org's connectors (Pipedream accounts + custom MCP
 * servers). Install/remove are org_admin (server-enforced); MCP headers are
 * write-only. The Pipedream connect-link needs the server's Pipedream config.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Connection, CustomMcpInput, ConnectLink } from "../contract/connections.js";

export class ConnectionsClient {
  constructor(private readonly http: AuthedHttp) {}

  list(): Promise<Connection[]> {
    return this.http.get<Connection[]>("/api/connections");
  }

  /** Install a custom MCP server (org_admin). `headers` are sent once, then encrypted. */
  installCustomMcp(input: CustomMcpInput): Promise<Connection> {
    return this.http.post<Connection>("/api/connections/mcp", input);
  }

  removeCustomMcp(slug: string): Promise<void> {
    return this.http.del<void>(`/api/connections/mcp/${encodeURIComponent(slug)}`);
  }

  /** Get a Pipedream connect-link URL to OAuth an account (needs Pipedream config). */
  pipedreamConnectLink(): Promise<ConnectLink> {
    return this.http.post<ConnectLink>("/api/connections/pipedream/connect");
  }
}
