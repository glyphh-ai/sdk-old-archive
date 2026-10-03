/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/ada.ts — ADA (his order, 2026-10-01): the org's models of graded
 * precedent. Record what worked and what failed, in any JSON shape, and ask:
 * the answer comes with the records behind it and a fact tree saying why.
 *
 * Every call names a `modelId`. A model's config lives on the server; its
 * records live with Glyphh on the Ada runtime, where the kernel runs. A model
 * is either this organization's own or one Glyphh shares with every
 * organization, read only.
 *
 * Model calls go to the gateway's POST /ada on the member's own gateway key,
 * so each is metered and budgeted like the same ada_* tool from Claude Code
 * or the CLI. Talking to Ada in plain language is the `ada-1.0` model instead.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import { ApiError, ConnectError } from "../core/errors.js";
import type { GatewayClient } from "./gateway.js";

/** Any JSON shape: objects nest, arrays are sets, scalars are symbols. */
export type AdaData = string | number | boolean | null | AdaData[] | { [key: string]: AdaData };
export type AdaSituation = { [key: string]: AdaData };
/** Mirrors the situation: a number weighs a key; an object weighs inside it, its own weight under "*". */
export type AdaWeights = { [key: string]: number | AdaWeights };

export interface AdaModel {
  model_id: string;
  name: string;
  /** This organization's own model. */
  own: boolean;
  /** Glyphh shares it with every organization, read only. */
  shared: boolean;
  /** The version a shared model was loaded at; null for the organization's own. */
  version: string | null;
  /** Where a shared model was loaded from; null for the organization's own. */
  source: string | null;
  weights: AdaWeights | null;
  tau: number | null;
  calibrated: boolean;
  data_version: number;
  created_at: string;
  updated_at: string;
  /** Present when one model is asked for: its record counts. */
  wins?: number;
  vetoes?: number;
}

export interface AdaReceipt { id: string; sim: number; outcome: string; hash: string; author: string }

export interface AdaAnswer {
  model_id: string;
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
  /** Three or more records agree; below that, a cited reminder. */
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

export interface AdaRecord { seq: number; id: string; store: "wins" | "vetoes"; situation: AdaSituation; outcome: string; author: string; ts: number }
export interface AdaFacts { model_id: string; wins: AdaFactTree[]; vetoes: AdaFactTree[] }
export interface AdaRecorded { model_id: string; store: "wins" | "vetoes"; id: string; size: number }
export interface AdaCheck { model_id: string; outcome: string; win_match: number; veto_match: number }
export interface AdaCalibrated { model_id: string; tau: number; size: number }
export interface AdaRecords { model_id: string; records: AdaRecord[]; total: number }

export interface AdaAsk { modelId: string; situation: AdaSituation; weights?: AdaWeights }
export interface AdaGrade { modelId: string; situation: AdaSituation; outcome: string }
export interface AdaNewModel { name: string; weights?: AdaWeights; spec?: Record<string, unknown> }

export class AdaClient {
  #gw: { baseUrl: string; token: string } | null = null;

  constructor(
    _http: AuthedHttp,
    private readonly gateway: GatewayClient,
    private readonly fetchImpl: typeof fetch = (...a) => fetch(...a),
  ) {}

  /** What worked in situations like this one, and whether it is safe to act. */
  query({ modelId, ...rest }: AdaAsk): Promise<AdaAnswer> {
    return this.#op("query", { model_id: modelId, ...rest });
  }

  /** Why: the nearest wins and vetoes as fact trees, with citations and probabilities. */
  facts({ modelId, ...rest }: AdaAsk & { top?: number }): Promise<AdaFacts> {
    return this.#op("facts", { model_id: modelId, ...rest });
  }

  /** A graded win: this outcome worked here. Only once the outcome is known. */
  record({ modelId, ...rest }: AdaGrade): Promise<AdaRecorded> {
    return this.#op("record", { model_id: modelId, ...rest });
  }

  /** A graded failure: this outcome failed, or was rejected, here. */
  veto({ modelId, ...rest }: AdaGrade): Promise<AdaRecorded> {
    return this.#op("veto", { model_id: modelId, ...rest });
  }

  /** How close the nearest win and the nearest failure of THIS outcome are. */
  check({ modelId, ...rest }: AdaGrade & { weights?: AdaWeights }): Promise<AdaCheck> {
    return this.#op("check", { model_id: modelId, ...rest });
  }

  /** Fit a model's probabilities to its own records (10+ wins); saved with the model. */
  calibrate(modelId: string, weights?: AdaWeights): Promise<AdaCalibrated> {
    return this.#op("calibrate", { model_id: modelId, ...(weights ? { weights } : {}) });
  }

  /** The org's models; with an id, that model and its record counts. */
  async models(modelId?: string): Promise<AdaModel[]> {
    return (await this.#op<{ models: AdaModel[] }>("models", modelId ? { model_id: modelId } : {})).models;
  }

  /** Create a model (org admins); with a `spec`, every role is typed and anything that does not fit is refused. */
  createModel(model: AdaNewModel): Promise<AdaModel> {
    return this.#op("create_model", model);
  }

  /** Rename a model or set its default weights (org admins); `weights: null` clears them. */
  updateModel(modelId: string, change: { name?: string; weights?: AdaWeights | null }): Promise<AdaModel> {
    return this.#op("update_model", { model_id: modelId, ...change });
  }

  /** Delete a model and its records (org admins). */
  deleteModel(modelId: string): Promise<{ model_id: string; deleted: true; records: number }> {
    return this.#op("delete_model", { model_id: modelId });
  }

  /** A model's records, newest first. */
  records(modelId: string, opts: { store?: "wins" | "vetoes"; offset?: number; limit?: number } = {}): Promise<AdaRecords> {
    return this.#op("records", { model_id: modelId, ...opts });
  }

  /** Correct a record (org admins). */
  editRecord(modelId: string, recordId: string, change: { situation?: AdaSituation; outcome?: string }): Promise<{ updated: true }> {
    return this.#op("edit_record", { model_id: modelId, record_id: recordId, ...change });
  }

  /** Delete one record (org admins). */
  deleteRecord(modelId: string, recordId: string): Promise<{ deleted: true }> {
    return this.#op("delete_record", { model_id: modelId, record_id: recordId });
  }

  async #op<T>(op: string, args: object): Promise<T> {
    const gw = await this.#credential();
    let res: Response;
    try {
      res = await this.fetchImpl(`${gw.baseUrl.replace(/\/+$/, "")}/ada`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${gw.token}` },
        body: JSON.stringify({ op, ...args }),
      });
    } catch (e) {
      throw new ConnectError(`Ada is unreachable: ${(e as Error).message}`, e);
    }
    const body = (await res.json().catch(() => null)) as { data?: T; error?: unknown; detail?: unknown } | null;
    if (res.ok && body && "data" in body) return body.data as T;
    if (res.status === 401) this.#gw = null;
    throw new ApiError({
      code: res.status === 402 ? "E_PAYMENT" : errorCode(body?.error) ?? "E_ADA",
      httpStatus: res.status,
      message: describe(body?.error) || describe(body?.detail) || `Ada answered ${res.status}`,
    });
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

function errorCode(error: unknown): string | undefined {
  return error && typeof error === "object" && typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : undefined;
}

function describe(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (detail && typeof detail === "object") {
    const d = detail as { error?: unknown; message?: unknown };
    return String(d.message ?? d.error ?? "");
  }
  return "";
}
