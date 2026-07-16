/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/support.ts — submit a support ticket. The server relays it to the
 * configured sink (Discord webhook), attaching the caller's email + plan. When
 * support is unconfigured server-side the call surfaces as NotFoundError.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { SupportTicketInput, SupportTicketAck } from "../contract/support.js";

export class SupportClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Submit a support ticket (subject + description). */
  ticket(input: SupportTicketInput): Promise<SupportTicketAck> {
    return this.http.post<SupportTicketAck>("/api/support/ticket", input);
  }
}
