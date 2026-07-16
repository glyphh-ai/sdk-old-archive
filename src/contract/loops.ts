/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/loops.ts — the org's agent-loop library. Members pick a loop in the
 * composer; org_admins build them. The built-in "Default" loop is always present
 * (id "default", builtIn true) and immutable. `definition` is the opaque builder
 * graph the client round-trips.
 */

export interface LoopSummary {
  id: string;
  name: string;
  description: string;
  builtIn: boolean;
}

export interface Loop extends LoopSummary {
  definition: unknown;
}

export interface CreateLoopInput {
  name: string;
  description?: string;
  definition?: unknown;
}

export interface UpdateLoopInput {
  name?: string;
  description?: string;
  definition?: unknown;
}
