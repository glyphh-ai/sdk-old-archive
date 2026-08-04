/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * contract/panel.ts — the SERVER-BROKERED BROWSER PANEL. `panel.openBrowser` asks the
 * control plane to launch a streamed browser panel in the panel pod and returns where to
 * reach it (`wsUrl`) plus a one-time, PANEL-scoped `token`. The client connects the WS
 * DIRECT to the pod with that token — the control plane does not proxy the stream (the
 * same shape as a runtime session: provision here, stream there). Only THIRD-PARTY URLs
 * take this path; Glyphh-origin panels render in a local iframe (architecture-engines-
 * memory.md §7/§7a). The pod validates the token by introspecting it, bound to `panelId`.
 */

export interface PanelViewport {
  width: number;
  height: number;
}

export interface PanelOpenInput {
  /** The initial page to open — an http(s) URL. */
  url: string;
  /** The pod renders at this viewport (default the pod's own). */
  viewport?: PanelViewport;
  /** Client devicePixelRatio (1–4) so the pod renders at physical resolution. */
  deviceScaleFactor?: number;
}

export interface OpenedPanel {
  /** The pod-minted panel id the scoped token is bound to. */
  panelId: string;
  /** The pod's PUBLIC ws endpoint the browser connects to DIRECT (with `token`). */
  wsUrl: string;
  /** The one-time, panel-scoped bearer the pod validates (query param or subprotocol). */
  token: string;
  /** The pod's panel wire version. */
  wire?: string;
  /** Seconds until `token` expires (re-open to refresh). */
  expiresIn?: number;
}

/**
 * A TERMINAL panel — the featherweight sibling of a browser panel. Instead of a
 * screencast it is a pty in the pod whose BYTES stream over the WS and are rendered by
 * xterm.js on the client (architecture-engines-memory.md §7). `panel.openTerminal` asks
 * the control plane to spawn the pty (in the session sandbox) and returns the same
 * `{ panelId, wsUrl, token, wire }` shape — the client connects the WS DIRECT to the pod
 * with the scoped `token`, then pipes pty output → term.write and keystrokes/resize back.
 */
export interface TerminalOpenInput {
  /** The originating runtime session (the pty's sandbox is keyed by it). */
  sessionId?: string;
  /** Initial terminal size (xterm cols × rows). Defaults 80×24 in the pod. */
  cols?: number;
  rows?: number;
  /** A working dir RELATIVE to the session sandbox — clamped so it cannot escape. */
  cwd?: string;
}

/** The opened terminal panel — same wire shape as {@link OpenedPanel}. */
export type OpenedTerminal = OpenedPanel;
