/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/panel.ts — CONTROL-plane browser panels (server-brokered streaming). The
 * control plane owns panel lifecycle: `openBrowser` provisions a streamed browser panel
 * and returns `{ panelId, wsUrl, token }`; the caller connects the WS DIRECT to the pod
 * with the token. `nav`/`close` are also brokered (the server verifies ownership + forwards
 * to the pod). Only THIRD-PARTY URLs use this; Glyphh-origin panels render locally.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { PanelOpenInput, OpenedPanel, TerminalOpenInput, OpenedTerminal } from "../contract/panel.js";

export class PanelClient {
  constructor(private readonly http: AuthedHttp) {}

  /** Open a streamed browser panel. The `token` is returned once — connect the WS with it. */
  openBrowser(input: PanelOpenInput): Promise<OpenedPanel> {
    return this.http.post<OpenedPanel>("/api/panel/browser", input);
  }

  /** Navigate an open panel to a new URL (ownership verified server-side). */
  nav(panelId: string, url: string): Promise<{ ok: boolean }> {
    return this.http.post<{ ok: boolean }>(`/api/panel/browser/${encodeURIComponent(panelId)}/nav`, { url });
  }

  /** Close (tear down) an open browser panel. */
  close(panelId: string): Promise<void> {
    return this.http.del<void>(`/api/panel/browser/${encodeURIComponent(panelId)}`);
  }

  /** Open a TERMINAL panel (a pty over WS). Same `{ panelId, wsUrl, token }` shape as a
   *  browser panel — connect the WS with the token, pipe pty bytes ↔ xterm.js. */
  openTerminal(input: TerminalOpenInput = {}): Promise<OpenedTerminal> {
    return this.http.post<OpenedTerminal>("/api/panel/terminal", input);
  }

  /** Close (kill the pty of) an open terminal panel. */
  closeTerminal(panelId: string): Promise<void> {
    return this.http.del<void>(`/api/panel/terminal/${encodeURIComponent(panelId)}`);
  }
}
