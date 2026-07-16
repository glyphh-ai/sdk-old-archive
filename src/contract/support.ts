/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/support.ts — the SUPPORT ticket wire shapes. A ticket is a subject +
 * description; the reporter's email and plan are attached server-side. The server
 * relays it to a configured sink (Discord webhook) and returns an ack.
 */

export interface SupportTicketInput {
  subject: string;
  description: string;
}

export interface SupportTicketAck {
  ok: boolean;
}
