/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/ada.ts — ADA, the org's graded precedent (his order, 2026-10-01).
 *
 * Record what worked and what failed, in any JSON shape, and ask: the answer
 * comes with the precedents behind it and a fact tree saying why. Every call
 * is one of the gateway's ada_* tools over its REST door
 * (`<gateway>/mcp-rest/tools/call`) on the member's own gateway key, so it is
 * metered and budgeted exactly like the same tool from Claude Code or the
 * CLI. Talking to Ada in plain language is the `ada-1.0` model instead.
 */

import { ApiError, ConnectError } from "../core/errors.js";
import type { GatewayClient } from "./gateway.js";

/** Any JSON shape: objects nest, arrays are sets, scalars are symbols. */
export type AdaData = string | number | boolean | null | AdaData[] | { [key: string]: AdaData };
export type AdaSituation = { [key: string]: AdaData };
/** Mirrors the situation: a number weighs a key; an object weighs inside it, its own weight under "*". */
export type AdaWeights = { [key: string]: number | AdaWeights };

export interface AdaReceipt { id: string; sim: number; outcome: string; hash: string; author: string }

export interface AdaAnswer {
  space: string;
  sufficient: boolean;
  confidence: number;
  support: number;
  count: number;
  top: string | null;
  outcomes: Record<string, number>;
  receipts: AdaReceipt[];
  veto_match: number;
  /** Safe to act: sufficient, confident, and not vetoed. */
  act: boolean;
  reason: "reflex" | "insufficient" | "uncalibrated" | "low_confidence" | "vetoed";
  lifted: boolean;
  /** Three or more precedents agree; below that, a cited reminder. */
  calibrated: boolean;
}

export interface AdaFact {
  key: string;
  weight: number;
  score: number;
  share: number;
  sim: number;
  status: "both" | "query_only" | "record_only";
  query?: AdaData;
  record?: AdaData;
  children?: AdaFact[];
}

export interface AdaFactTree {
  id: string;
  outcome: string;
  probability: number;
  score: number;
  sim: number;
  author: string;
  ts: number;
  hash: string;
  tree: AdaFact;
}

export interface AdaFacts { space: string; wins: AdaFactTree[]; vetoes: AdaFactTree[] }
export interface AdaRecorded { space: string; store: "wins" | "vetoes"; id: string; size: number }
export interface AdaCheck { space: string; outcome: string; win_match: number; veto_match: number }
export interface AdaCalibrated { space: string; tau: number; size: number }
export interface AdaSpace { space: string; wins: number; vetoes: number; tau: number | null; calibrated: boolean }

export interface AdaAsk { space?: string; situation: AdaSituation; weights?: AdaWeights }
export interface AdaGrade { space?: string; situation: AdaSituation; outcome: string }

interface ToolResult { content?: { type: string; text?: string }[]; isError?: boolean }

export class AdaClient {
  #gw: { baseUrl: string; token: string } | null = null;

  constructor(
    private readonly gateway: GatewayClient,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  /** What worked in situations like this one, and whether it is safe to act. */
  query(input: AdaAsk): Promise<AdaAnswer> {
    return this.#call("ada_query", input);
  }

  /** Why: the nearest wins and vetoes as fact trees, with citations and probabilities. */
  facts(input: AdaAsk & { top?: number }): Promise<AdaFacts> {
    return this.#call("ada_facts", input);
  }

  /** A graded win: this outcome worked here. Only once the outcome is known. */
  record(input: AdaGrade): Promise<AdaRecorded> {
    return this.#call("ada_record", input);
  }

  /** A graded failure: this outcome failed, or was rejected, here. */
  veto(input: AdaGrade): Promise<AdaRecorded> {
    return this.#call("ada_veto", input);
  }

  /** How close the nearest win and the nearest failure of THIS outcome are. */
  check(input: AdaGrade & { weights?: AdaWeights }): Promise<AdaCheck> {
    return this.#call("ada_check", input);
  }

  /** Fit a space's probabilities to its own record (10+ wins). */
  calibrate(input: { space?: string; weights?: AdaWeights } = {}): Promise<AdaCalibrated> {
    return this.#call("ada_calibrate", input);
  }

  /** The org's spaces, their sizes and calibration. */
  async status(space?: string): Promise<AdaSpace[]> {
    const r = await this.#call<{ spaces: AdaSpace[] }>("ada_status", space ? { space } : {});
    return r.spaces;
  }

  async #call<T>(name: string, args: object): Promise<T> {
    const gw = await this.#credential();
    let res: Response;
    try {
      res = await this.fetchImpl(`${gw.baseUrl.replace(/\/+$/, "")}/mcp-rest/tools/call`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${gw.token}` },
        body: JSON.stringify({ name, arguments: args }),
      });
    } catch (e) {
      throw new ConnectError(`Ada is unreachable: ${(e as Error).message}`, e);
    }
    const body = (await res.json().catch(() => null)) as (ToolResult & { detail?: unknown }) | null;
    if (!res.ok) {
      if (res.status === 401) this.#gw = null;
      throw new ApiError({ code: res.status === 402 ? "E_PAYMENT" : "E_ADA", httpStatus: res.status, message: describe(body?.detail) || `Ada answered ${res.status}` });
    }
    const text = body?.content?.find((c) => c.type === "text")?.text ?? "";
    if (body?.isError) throw new ApiError({ code: "E_VALIDATION", httpStatus: 400, message: text || "Ada refused the call" });
    return JSON.parse(text) as T;
  }

  async #credential(): Promise<{ baseUrl: string; token: string }> {
    if (this.#gw) return this.#gw;
    const t = await this.gateway.token();
    if (!t.baseUrl || !t.token || t.gateway === false) {
      throw new ApiError({ code: "E_ENTITLEMENT", httpStatus: 403, message: "the gateway is off for this organization, so Ada is too" });
    }
    this.#gw = { baseUrl: t.baseUrl, token: t.token };
    return this.#gw;
  }
}

function describe(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const d = detail as { error?: unknown; message?: unknown };
    return String(d.message ?? d.error ?? "");
  }
  return "";
}
