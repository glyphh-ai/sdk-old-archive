/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * cli/index.ts — assemble the command registry from every domain module. Each phase
 * adds one `registerX(reg)` line here; the parity test guarantees the surface stays
 * complete. Exposes `buildRegistry` for the bin, the REPL, and the parity test.
 */

import { CommandRegistry } from "./registry.js";
import { registerAuth } from "./commands/auth.js";
import { registerSession } from "./commands/session.js";
import { registerRotor } from "./commands/rotor.js";
import { registerMeta } from "./commands/meta.js";
import { registerOrg } from "./commands/org.js";
import { registerWorkspaces } from "./commands/workspaces.js";
import { registerBilling } from "./commands/billing.js";
import { registerCatalog } from "./commands/catalog.js";
import { registerConnections } from "./commands/connections.js";
import { registerUsage } from "./commands/usage.js";
import { registerApiKeys } from "./commands/api-keys.js";
import { registerSessions } from "./commands/sessions.js";
import { registerGit } from "./commands/git.js";
import { registerApps } from "./commands/apps.js";
import { registerLibrary } from "./commands/library.js";

export function buildRegistry(): CommandRegistry {
  const reg = new CommandRegistry();
  registerAuth(reg);
  registerSession(reg);
  registerRotor(reg);
  registerMeta(reg);
  registerOrg(reg);
  registerWorkspaces(reg);
  registerBilling(reg);
  registerCatalog(reg);
  registerConnections(reg);
  registerUsage(reg);
  registerApiKeys(reg);
  registerSessions(reg);
  registerGit(reg);
  registerApps(reg);
  registerLibrary(reg);
  return reg;
}

export { CommandRegistry } from "./registry.js";
export { dispatch, helpText } from "./dispatch.js";
export { buildContext } from "./context.js";
export type { CliContext } from "./context.js";
export type { Command } from "./registry.js";
export { sdkSurface } from "./surface.js";
