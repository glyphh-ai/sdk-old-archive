/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/connections.ts — connectors the runtime calls. Two kinds: Pipedream
 * OAuth accounts and custom MCP servers (a remote URL + auth headers). Credentials
 * (headers / OAuth tokens) are server-held, encrypted, write-only — never returned.
 * Workspaces filter which connections members may use (`allowedConnections`).
 */

export type ConnectionKind = "pipedream" | "custom_mcp";

export interface Connection {
  slug: string;
  name: string;
  kind: ConnectionKind;
  scope: "org" | "user";
  enabled: boolean;
  /** True when server-side credentials are set (the values are never returned). */
  hasCredentials: boolean;
}

/** org_admin installs a custom MCP server. `headers` are write-only (encrypted at rest). */
export interface CustomMcpInput {
  slug: string;
  name: string;
  url: string;
  headers?: Record<string, string>;
}

/** A Pipedream connect-link URL to open (OAuth an account). */
export interface ConnectLink {
  url: string;
}

/** One connectable app from the connector catalog (the "Add Connection" picker). */
export interface ConnectorApp {
  id: string;
  name: string;
  icon: string | null;
}
