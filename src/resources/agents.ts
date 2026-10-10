/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/agents.ts — standing workers and the tasks they fire.
 *
 * Any member lists/reads what they can see (their own plus the org's shared);
 * writes need ownership, and sharing org-wide needs org_admin. `get`/`update`/
 * `remove` accept a slug or an id.
 *
 * `live()` is the runner's arming call: every live agent the caller can see, with
 * its ENABLED tasks and resolved guardrails, in one round trip.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { AgentSummary, AgentTask, AgentTaskRun } from "../contract/agents.js";

export class AgentsClient {
  constructor(private readonly http: AuthedHttp) {}

  async list(): Promise<AgentSummary[]> {
    const { agents } = await this.http.get<{ agents: AgentSummary[] }>("/api/agents");
    return agents;
  }






  // ── tasks ─────────────────────────────────────────────────────────────────

  async tasks(ref: string): Promise<AgentTask[]> {
    const { tasks } = await this.http.get<{ tasks: AgentTask[] }>(`/api/agents/${encodeURIComponent(ref)}/tasks`);
    return tasks;
  }




  /** A task's firing history, newest first. */
  async taskRuns(ref: string, taskId: string): Promise<AgentTaskRun[]> {
    const { runs } = await this.http.get<{ runs: AgentTaskRun[] }>(`/api/agents/${encodeURIComponent(ref)}/tasks/${encodeURIComponent(taskId)}/runs`);
    return runs;
  }

}
