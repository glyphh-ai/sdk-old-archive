/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * http.ts — the SDK's one HTTP client, built on injectable `fetch` so it runs on
 * Node, the browser, and React Native/Hermes unchanged. It owns: base-URL join,
 * JSON encode/decode, bearer injection, an AbortController timeout, response
 * envelope unwrapping (`{ data }`), and mapping the server's typed error envelope
 * to the SDK error hierarchy. Reconnect/refresh policy lives above it.
 */

import { ConnectError, apiErrorFor } from "./errors.js";

export type FetchLike = typeof fetch;

export interface HttpOptions {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}

export interface RequestOptions {
  /** Bearer token to attach (access token or a static API key). */
  bearer?: string | undefined;
  signal?: AbortSignal | undefined;
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string; remediation?: string; requestId?: string; retryable?: boolean };
}

export class HttpClient {
  private readonly baseUrl: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;

  constructor(opts: HttpOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    // Bind to preserve the global's `this` (some runtimes require it).
    this.fetchImpl = opts.fetchImpl ?? ((...args) => fetch(...args));
    this.timeoutMs = opts.timeoutMs ?? 30_000;
  }

  get<T>(path: string, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("GET", path, undefined, opts);
  }
  post<T>(path: string, body?: unknown, opts: RequestOptions = {}): Promise<T> {
    return this.request<T>("POST", path, body, opts);
  }

  private async request<T>(method: string, path: string, body: unknown, opts: RequestOptions): Promise<T> {
    const url = `${this.baseUrl}${path}`;
    const headers: Record<string, string> = { accept: "application/json" };
    if (body !== undefined) headers["content-type"] = "application/json";
    if (opts.bearer) headers["authorization"] = `Bearer ${opts.bearer}`;

    // Timeout via AbortController, composed with any caller-supplied signal.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    const onAbort = () => controller.abort();
    opts.signal?.addEventListener("abort", onAbort);

    const init: RequestInit = { method, headers, signal: controller.signal };
    if (body !== undefined) init.body = JSON.stringify(body);

    let res: Response;
    try {
      res = await this.fetchImpl(url, init);
    } catch (e) {
      throw new ConnectError(`request to ${path} failed`, e);
    } finally {
      clearTimeout(timer);
      opts.signal?.removeEventListener("abort", onAbort);
    }

    const text = await res.text().catch(() => "");
    const json = text ? safeParse(text) : undefined;

    if (!res.ok) {
      const env = (json ?? {}) as ErrorEnvelope;
      throw apiErrorFor({
        code: env.error?.code ?? "E_INTERNAL",
        message: env.error?.message ?? `HTTP ${res.status}`,
        httpStatus: res.status,
        ...(env.error?.remediation !== undefined ? { remediation: env.error.remediation } : {}),
        ...(env.error?.requestId !== undefined ? { requestId: env.error.requestId } : {}),
        ...(env.error?.retryable !== undefined ? { retryable: env.error.retryable } : {}),
      });
    }
    // Success envelope is `{ data }`; 204/no-body returns undefined.
    return (json as { data?: T } | undefined)?.data as T;
  }
}

function safeParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
}
