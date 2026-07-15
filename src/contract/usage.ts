/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/usage.ts — usage rollups. Everything flows user → workspace → org from
 * one append-only ledger, so a summary at any level is a sum of the same rows.
 * Credits are whole credits; `creditsSaved` is the shadow price of zero-cost usage
 * (local / open-weight / custom MCP).
 */

export interface UsageSummary {
  /** Credits consumed in the window. */
  credits: number;
  /** Shadow price of zero-cost usage ("credits saved"). */
  creditsSaved: number;
  /** Credit breakdown by source. */
  bySource: {
    fly: number;
    pipedream: number;
    provider: number;
  };
  /** Number of ledger events. */
  events: number;
}
