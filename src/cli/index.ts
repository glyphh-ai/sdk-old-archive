/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * cli/index.ts — assemble the command registry from every domain module. Each phase
 * adds one `registerX(reg)` line here; the parity test guarantees the surface stays
 * complete. Exposes `buildRegistry` for the bin, the REPL, and the parity test.
 */

import { CommandRegistry } from "./registry.js";
import { registerAuth } from "./commands/auth.js";
import { registerMeta } from "./commands/meta.js";
import { registerOrg } from "./commands/org.js";
import { registerMemberships } from "./commands/memberships.js";
import { registerWorkspaces } from "./commands/workspaces.js";
import { registerBilling } from "./commands/billing.js";
import { registerCatalog } from "./commands/catalog.js";
import { registerAdmin } from "./commands/admin.js";
import { registerLoops } from "./commands/loops.js";
import { registerUsage } from "./commands/usage.js";
import { registerApiKeys } from "./commands/api-keys.js";
import { registerSessions } from "./commands/sessions.js";
import { registerStator } from "./commands/stator.js";
import { registerRotorConfig } from "./commands/rotor-config.js";
import { registerModels } from "./commands/models.js";
import { registerProfile } from "./commands/profile.js";
import { registerSupport } from "./commands/support.js";
import { registerOAuth } from "./commands/oauth.js";
import { registerApi } from "./commands/api.js";
import { registerGateway } from "./commands/gateway.js";
import { registerRuntimeImages } from "./commands/runtime-images.js";

export function buildRegistry(): CommandRegistry {
  const reg = new CommandRegistry();
  registerAuth(reg);
  registerApi(reg);
  registerGateway(reg);
  registerMeta(reg);
  registerOrg(reg);
  registerMemberships(reg);
  registerWorkspaces(reg);
  registerBilling(reg);
  registerCatalog(reg);
  registerAdmin(reg);
  registerLoops(reg);
  registerUsage(reg);
  registerApiKeys(reg);
  registerSessions(reg);
  registerStator(reg);
  registerRotorConfig(reg);
  registerModels(reg);
  registerProfile(reg);
  registerSupport(reg);
  registerOAuth(reg);
  registerRuntimeImages(reg);
  return reg;
}

export { CommandRegistry } from "./registry.js";
export { dispatch, helpText } from "./dispatch.js";
export { buildContext } from "./context.js";
export type { CliContext } from "./context.js";
export type { Command } from "./registry.js";
export { sdkSurface } from "./surface.js";
