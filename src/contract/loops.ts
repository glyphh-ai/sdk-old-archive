/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/loops.ts — the org's LOOP library. A loop is a program: a manifest
 * declaring what it may reach, and a `.js` file that drives it.
 *
 * The program is a mostly-deterministic state machine — it decides when to read and
 * write memory, which skills to call in what order, and where an agent turn belongs
 * — so a team can encode "my web development loop" instead of re-prompting its way
 * there each time. The control plane stores and governs loops; they RUN on the
 * client, where the working folder, apps, and layouts are. Model turns inside a loop
 * still go out through the gateway like every other model call.
 *
 * Members pick a loop; org_admins build them. The built-in "Default" loop (id and
 * slug `default`, `builtIn: true`) is the general catch-all and is immutable.
 */

/**
 * WHAT a loop may reach.
 *
 * `roles` is the model-slot map: the program refers to roles by name and the
 * manifest binds each to a catalog model, so the same loop can run on different
 * models without touching its code. A binding is not a grant — the caller's
 * workspace allow-list still decides at run time.
 */
export interface LoopManifest {
  /** Manifest shape version, for forward migration. */
  version?: number;
  /** Role name → catalog model id (`provider::model`). */
  roles?: Record<string, string>;
  /** Skill slugs the loop may call. */
  skills?: string[];
  /** Connection slugs the loop may use. */
  connections?: string[];
  /** Whether the loop reads from / writes to memory. */
  memory?: { read?: boolean; write?: boolean };
  /** Layout the workspace re-orients to while this loop is active. Desktop only —
   *  a CLI run has no layout and ignores it. */
  layout?: string;
}

export interface LoopSummary {
  id: string;
  /** Stable per-org handle — how a loop is named outside the UI. */
  slug: string;
  name: string;
  description: string;
  builtIn: boolean;
  updatedAt: string;
}

export interface Loop extends LoopSummary {
  manifest: LoopManifest;
  /** The loop program. Empty for a loop that has not been written yet. */
  code: string;
}

export interface CreateLoopInput {
  slug: string;
  name: string;
  description?: string;
  manifest?: LoopManifest;
  code?: string;
}

export interface UpdateLoopInput {
  slug?: string;
  name?: string;
  description?: string;
  manifest?: LoopManifest;
  code?: string;
}
