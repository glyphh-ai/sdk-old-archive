/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * errors.ts — the SDK error hierarchy. Two layers, both typed:
 *   ConnectError  — never reached the server (network / timeout / abort).
 *   ApiError      — the server returned a typed error envelope; carries the control
 *                   plane's taxonomy code + remediation so callers branch on a
 *                   stable code without depending on the server package.
 *     AuthError       — 401; the caller must (re)authenticate.
 *     ForbiddenError  — 403; authenticated but not permitted (authz is server-side).
 *     ValidationError — 400; bad request shape.
 * Transport/protocol errors (ProtocolError, UnsupportedError) join when the rotor
 * streaming layer lands.
 */

export class SdkError extends Error {
  readonly code: string;
  override readonly cause?: unknown;
  constructor(code: string, message: string, cause?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.cause = cause;
  }
}

/** The request never got a response (offline, DNS, TLS, timeout, aborted). */
export class ConnectError extends SdkError {
  constructor(message: string, cause?: unknown) {
    super("E_CONNECT", message, cause);
  }
}

/** The server responded with a typed error envelope. */
export class ApiError extends SdkError {
  readonly httpStatus: number;
  readonly remediation: string | undefined;
  readonly requestId: string | undefined;
  readonly retryable: boolean;
  constructor(opts: { code: string; message: string; httpStatus: number; remediation?: string; requestId?: string; retryable?: boolean }) {
    super(opts.code, opts.message);
    this.httpStatus = opts.httpStatus;
    this.remediation = opts.remediation;
    this.requestId = opts.requestId;
    this.retryable = opts.retryable ?? false;
  }
}

export class AuthError extends ApiError {}
export class ForbiddenError extends AuthError {}
export class ValidationError extends ApiError {}

/** Build the most specific ApiError subclass for a server error envelope. */
export function apiErrorFor(opts: { code: string; message: string; httpStatus: number; remediation?: string; requestId?: string; retryable?: boolean }): ApiError {
  if (opts.httpStatus === 401) return new AuthError(opts);
  if (opts.httpStatus === 403) return new ForbiddenError(opts);
  if (opts.httpStatus === 400) return new ValidationError(opts);
  return new ApiError(opts);
}
