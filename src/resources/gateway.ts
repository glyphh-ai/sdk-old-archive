/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/gateway.ts — run a metered model turn.
 *
 * This is the only way a client reaches a model. Provider keys stay server-side
 * (write-only, decrypted for the upstream call alone), so the call ORIGINATES on
 * the server: that is what makes the workspace allow-list, spend logging, and
 * the model-governance audit true at execution time rather than advisory.
 *
 * `complete()` is the single-shot, text-in/text-out path — history folding,
 * summaries, one-shot tool calls. Streaming agent turns ride the session
 * transport, not this.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { GatewayToken } from "../contract/loops.js";
import type { GatewayCompletion, GatewayCompletionInput } from "../contract/gateway.js";


// ── gateway telemetry (org_admin) ────────────────────────────────────────────
// The org's slice of GlyphhRouter's spend log. Metadata only — the
// gateway never stores prompt or completion content, so none exists to read.

export interface GatewayDay {
  day: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  spendUsd: number;
  avgLatencyMs: number;
  p95LatencyMs: number;
}

export interface GatewayBreakdownRow {
  key: string;
  requests: number;
  promptTokens: number;
  completionTokens: number;
  spendUsd: number;
  avgLatencyMs: number;
}

export interface GatewayMetrics {
  configured: boolean;
  days: GatewayDay[];
  byModel: GatewayBreakdownRow[];
  byProvider: GatewayBreakdownRow[];
  /** Keyed by workspace (role) id — parsed from each key's alias. */
  byRole: GatewayBreakdownRow[];
}


export interface GatewayKey {
  id: string;
  name: string;
  workspaceId: string;
  tokenHint: string;
  expiresAt: string | null;
  revokedAt: string | null;
  createdBy: string | null;
  createdAt: string;
}

export interface MintedGatewayKey { key: GatewayKey; token: string }

export class GatewayClient {
  constructor(private readonly http: AuthedHttp) {}

  /**
   * THE TOKEN EXCHANGE — the caller's own gateway credential, for the
   * environment a CLI subprocess starts in. Everything it may reach comes
   * from the caller's ROLE, so there is nothing to pass and nothing to forge.
   *
   * IDEMPOTENT: the same credential every session. A client that minted per
   * launch would leave live keys nobody can account for and split its own
   * spend across them.
   *
   * Refuses with E_ENTITLEMENT when the plan doesn't carry the gateway, or
   * its trial window has closed.
   */
  token(): Promise<GatewayToken> {
    return this.http.post<GatewayToken>("/api/gateway/token", {});
  }

  // ── MEMBER SELF-SERVICE KEYS (his ruling, 2026-09-12): paid plan + the
  // org admin's members_mint_keys switch. The key is scoped by the member's
  // role exactly as the device token is. ─────────────────────────────────────

  /** The caller's own keys, plus whether the doors are open (`allowed`). */
  myKeys(): Promise<{ allowed: boolean; reason: string; keys: GatewayKey[] }> {
    return this.http.get<{ allowed: boolean; reason: string; keys: GatewayKey[] }>("/api/gateway/my-keys");
  }

  /** Mint a personal key (shown once). E_ENTITLEMENT when the doors are shut. */
  mintMyKey(name: string, days?: number): Promise<MintedGatewayKey> {
    return this.http.post<MintedGatewayKey>("/api/gateway/my-keys", { name, ...(days ? { days } : {}) });
  }

  /** Revoke one of the caller's OWN keys — anyone else's answers not-found. */
  revokeMyKey(id: string): Promise<void> {
    return this.http.del<void>(`/api/gateway/my-keys/${id}`);
  }

  /** The org switch for member minting (org_admin). */
  memberKeysEnabled(): Promise<{ enabled: boolean }> {
    return this.http.get<{ enabled: boolean }>("/api/org/gateway/member-keys");
  }

  /** Flip it (org_admin). */
  setMemberKeysEnabled(enabled: boolean): Promise<{ enabled: boolean }> {
    return this.http.put<{ enabled: boolean }>("/api/org/gateway/member-keys", { enabled });
  }

  /**
   * One metered completion. Refused (402) when the org's key is over budget — this
   * is a prepaid system with no arrears, and there is no free local fallback, so
   * callers should surface that rather than silently degrading.
   */
  complete(input: GatewayCompletionInput): Promise<GatewayCompletion> {
    const { maxTokens, service, runId, ...rest } = input;
    const headers: Record<string, string> = {};
    // Billing attribution: background work declares its SERVICE line
    // (enrichment, memory-rotor) and, when it belongs to a turn, the RUN id —
    // so the ledger never books it as an anonymous worker call.
    if (service) headers["x-glyphh-service"] = service;
    if (runId) headers["x-glyphh-run"] = runId;
    return this.http.post<GatewayCompletion>(
      "/api/gateway/v1/chat/completions",
      { ...rest, ...(maxTokens !== undefined ? { max_tokens: maxTokens } : {}) },
      // The gateway answers an OpenAI body verbatim, not the `{ data }` envelope.
      { raw: true, ...(Object.keys(headers).length ? { headers } : {}) },
    );
  }



  /** The completion's text, or "" — the common case for utility turns. */
  async text(input: GatewayCompletionInput): Promise<string> {
    const completion = await this.complete(input);
    return completion.choices?.[0]?.message?.content ?? "";
  }

  /** The org's gateway telemetry window (org_admin). `workspaceId` narrows to one role's traffic. */
  metrics(opts: { days?: 1 | 7 | 30 | 90; workspaceId?: string } = {}): Promise<GatewayMetrics> {
    const qs = new URLSearchParams();
    if (opts.days) qs.set("days", String(opts.days));
    if (opts.workspaceId) qs.set("workspaceId", opts.workspaceId);
    const s = qs.toString();
    return this.http.get<GatewayMetrics>(`/api/org/gateway/metrics${s ? `?${s}` : ""}`);
  }

  // ── the keys the gateway hands out (org_admin) ─────────────────────────────
  // Each key is bound to ONE role: the role fixes the model list and whose
  // vendor credential burns underneath. The token rides the mint response
  // ONCE; the registry stores name/hint/lifetime only.

  keys(): Promise<GatewayKey[]> {
    return this.http.get<GatewayKey[]>("/api/org/gateway/keys");
  }

  createKey(input: { name: string; workspaceId: string; days?: number }): Promise<MintedGatewayKey> {
    return this.http.post<MintedGatewayKey>("/api/org/gateway/keys", input);
  }

  revokeKey(id: string): Promise<void> {
    return this.http.del<void>(`/api/org/gateway/keys/${encodeURIComponent(id)}`);
  }
}
