/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/loops.ts — LOOPS: the CLI pre-configs, governed by vendor.
 *
 * A loop is a CLI — claude, codex, gemini, copilot, cursor. Its configuration
 * is LOCAL to a machine, so the org and role layers key on the VENDOR, which
 * is stable everywhere the member signs in.
 *
 * The former loop LIBRARY (a program with role slots) is now contract/tasks.ts.
 */

/** A loop: one CLI the caller may actually drive, after org + role narrowing. */
export interface Loop {
  cli: string;
  name: string;
  /** The catalog provider its models come from — the picker filters on it. */
  provider: string;
  /** The role's default model for this loop; "" = the CLI's own. */
  model: string;
  /** EXACTLY ONE loop in a response carries this — clients rely on it rather
   *  than inventing their own fallback. */
  isDefault: boolean;
  /** This loop routes semantically: the picker shows Auto, plus whatever the
   *  role exempts. Per-loop, so a coding loop can keep its model while a
   *  summarising one is auto-routed. */
  forceAuto: boolean;
}

/** A row of the ORG's CLI-loop support list. Binds on every plan — it is the
 *  org → user configuration, not something a tier buys. */
export interface OrgLoop {
  cli: string;
  name: string;
  provider: string;
  enabled: boolean;
}

/** What a role grants for ONE loop: its default model, whether it is the
 *  role's default loop, and whether it routes semantically. */
export interface LoopGrant {
  cli: string;
  model: string;
  isDefault?: boolean;
  forceAuto?: boolean;
}

/** The member's own gateway credential — what a CLI subprocess runs inside. */
export interface GatewayToken {
  /** Point the CLI's *_BASE_URL at this. */
  baseUrl: string;
  /** The minted key for the CLI's key variable. */
  token: string;
  expiresAt: string | null;
  /** The models this credential may reach, per the caller's role. */
  models: string[];
}
