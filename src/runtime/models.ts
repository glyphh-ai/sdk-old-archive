/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * runtime/models.ts — the governed SDK↔rrotor MODEL bridge (Node-only). Resolves a
 * rotor's role→model binding (enforced server-side by `rotorConfig.registry`) into the
 * endpoint map rrotor injects: gateway roles get the metering gateway url + the caller's
 * bearer (`metered:true`); local roles get an on-device `llama-server` url (`metered:false`).
 * Plus per-session model SWITCHING with an audit trail — an in-process override store the
 * next `resolveModels` layers on, so opus→haiku→opus is both live and fully auditable.
 *
 * The gateway is untouched: it already meters proxied calls WITH the model server-side, so
 * credit attribution needs no change here. Local models are the user's own compute — free.
 */

import type { Client } from "../client.js";
import type { ResolvedModel, RotorRegistry } from "../contract/bindings.js";
import type { ModelSwitchSurface } from "../contract/runtime.js";
import { ensureLocalModel } from "../models/manager.js";

/**
 * A runtime-agnostic model endpoint. Structurally matches rrotor's `ModelEndpoint`
 * (its `BasicModelsOptions.registry` value) — the CLI passes `{ registry }` straight to
 * `runInProcess({ models })`. Defined here so the SDK never imports rrotor.
 */
export interface ModelEndpoint {
  /** OpenAI-compatible chat-completions base url. */
  url: string;
  /** The provider model id to send (catalog id stripped of its `provider::` prefix). */
  model?: string;
  /** Per-request headers — the caller's bearer for gateway roles. */
  headers?: Record<string, string>;
  /** Metered (gateway/hosted) vs free (local). */
  metered?: boolean;
}

/** The registry shape rrotor consumes: `Record<role, ModelEndpoint>`. */
export interface ResolvedModels {
  registry: Record<string, ModelEndpoint>;
}

export interface ResolveModelsOptions {
  /** The rotor whose role→model binding to resolve. */
  rotorSlug: string;
  /** The caller's bearer, attached to gateway (metered) endpoints. */
  token: string;
  /**
   * Per-role model overrides layered on the resolved set before endpoints are built —
   * an overridden role resolves to that catalog model id instead. Pass a session's
   * current overrides (see {@link sessionOverrides}) to reflect live model switches.
   */
  overrides?: Record<string, string>;
}

/** Strip a catalog id's `provider::` prefix down to the bare model id. */
function bareId(modelId: string): string {
  const i = modelId.indexOf("::");
  return i === -1 ? modelId : modelId.slice(i + 2);
}

/**
 * Build one endpoint for a role. Gateway → the metering url + bearer + metered; local →
 * the on-device `llama-server` (downloaded + served on demand) + free. The model id is
 * always reduced to its bare form (the gateway normalizes providers; llama wants the bare id).
 */
async function buildEndpoint(
  transport: ResolvedModel["transport"],
  url: string | null,
  modelId: string,
  token: string,
): Promise<ModelEndpoint | undefined> {
  const model = bareId(modelId);
  if (transport === "gateway") {
    if (!url) return undefined; // a gateway role with no url is unresolvable
    return { url, model, headers: { authorization: `Bearer ${token}` }, metered: true };
  }
  // local: serve on-device (download once, run the singleton) and address it locally.
  const server = await ensureLocalModel(model);
  return { url: server.url, model, metered: false };
}

/** Resolve one role's endpoint, applying an optional override. */
async function endpointForRole(
  m: ResolvedModel,
  all: readonly ResolvedModel[],
  overrideId: string | undefined,
  token: string,
): Promise<ModelEndpoint | undefined> {
  if (overrideId === undefined) return buildEndpoint(m.transport, m.url, m.model, token);
  // Overridden: re-run endpoint construction for the new model. Look up its transport/url
  // from the registry — if the override model is already resolved for another role, adopt
  // that role's transport + url; otherwise keep this role's (opus→haiku: both gateway).
  const twin = all.find((r) => bareId(r.model) === bareId(overrideId));
  const transport = twin ? twin.transport : m.transport;
  const url = twin ? twin.url : m.url;
  return buildEndpoint(transport, url, overrideId, token);
}

/**
 * Resolve `rotorSlug`'s governed role→model binding into the endpoint map rrotor injects.
 * Governance is enforced server-side by `rotorConfig.registry` (org-supported ∩ workspace-
 * allowed). Returns `undefined` when nothing is bound (the rotor then streams its basic-tier
 * stub) or the control plane can't resolve the rotor.
 */
export async function resolveModels(
  client: Client,
  opts: ResolveModelsOptions,
): Promise<ResolvedModels | undefined> {
  const { rotorSlug, token, overrides } = opts;
  let resolved: RotorRegistry;
  try {
    resolved = await client.rotorConfig.registry(rotorSlug);
  } catch {
    return undefined; // control plane doesn't know this rotor / not reachable
  }
  if (!resolved.models.length) return undefined;

  const registry: Record<string, ModelEndpoint> = {};
  for (const m of resolved.models) {
    const ep = await endpointForRole(m, resolved.models, overrides?.[m.role], token);
    if (ep) registry[m.role] = ep;
  }
  return Object.keys(registry).length ? { registry } : undefined;
}

// ── Per-session model switching + audit ──────────────────────────────────────
//
// The runtime is one process, so overrides live in a simple in-memory map and need not
// persist. Keyed sessionId → rotorSlug → { role: catalog modelId }.

const overridesStore = new Map<string, Map<string, Record<string, string>>>();

/** A snapshot of a session+rotor's current overrides — pass into `resolveModels`. */
export function sessionOverrides(sessionId: string, rotorSlug: string): Record<string, string> {
  return { ...(overridesStore.get(sessionId)?.get(rotorSlug) ?? {}) };
}

/** Drop every override for a session (e.g. on session end). */
export function clearSessionOverrides(sessionId: string): void {
  overridesStore.delete(sessionId);
}

export interface SwitchModelOptions {
  sessionId: string;
  /** The rotor whose role is being re-bound. */
  rotorSlug: string;
  /** The role to switch (e.g. "planner"). */
  role: string;
  /** The catalog model id to switch TO. */
  to: string;
  /** The model id being switched FROM, if known (for the audit trail). */
  from?: string;
  /** The surface the switch was driven from. */
  surface: ModelSwitchSurface;
}

/**
 * Switch a role's model for a session: (a) record it via `sessions.recordModelSwitch` so the
 * whole change lands in the model-governance audit, then (b) update the in-process override so
 * the NEXT `resolveModels(client, { ..., overrides: sessionOverrides(sessionId, rotorSlug) })`
 * reflects it. Each call audits again (opus→haiku→opus is three audited switches).
 */
export async function switchModel(client: Client, opts: SwitchModelOptions): Promise<void> {
  const { sessionId, rotorSlug, role, to, from, surface } = opts;
  // (a) Audit first — the governance trail must record every change, ordered.
  await client.sessions.recordModelSwitch({
    sessionId,
    rotorSlug,
    role,
    to,
    surface,
    ...(from !== undefined ? { from } : {}),
  });
  // (b) Update the in-memory override so the next resolve reflects it.
  let byRotor = overridesStore.get(sessionId);
  if (!byRotor) {
    byRotor = new Map();
    overridesStore.set(sessionId, byRotor);
  }
  const current = byRotor.get(rotorSlug) ?? {};
  current[role] = to;
  byRotor.set(rotorSlug, current);
}
