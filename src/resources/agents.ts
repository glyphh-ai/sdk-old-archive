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
import type {
  Agent, AgentSummary, LiveAgent, AgentTask,
  CreateAgentInput, UpdateAgentInput, CreateAgentTaskInput, UpdateAgentTaskInput,
} from "../contract/agents.js";

export class AgentsClient {
  constructor(private readonly http: AuthedHttp) {}

  async list(): Promise<AgentSummary[]> {
    const { agents } = await this.http.get<{ agents: AgentSummary[] }>("/api/agents");
    return agents;
  }

  /** Live agents with their enabled tasks — what a runner arms on start. */
  async live(): Promise<LiveAgent[]> {
    const { agents } = await this.http.get<{ agents: LiveAgent[] }>("/api/agents/live");
    return agents;
  }

  get(ref: string): Promise<Agent> {
    return this.http.get<Agent>(`/api/agents/${encodeURIComponent(ref)}`);
  }

  create(input: CreateAgentInput): Promise<Agent> {
    return this.http.post<Agent>("/api/agents", input);
  }

  update(ref: string, patch: UpdateAgentInput): Promise<Agent> {
    return this.http.patch<Agent>(`/api/agents/${encodeURIComponent(ref)}`, patch);
  }

  remove(ref: string): Promise<void> {
    return this.http.del<void>(`/api/agents/${encodeURIComponent(ref)}`);
  }

  // ── tasks ─────────────────────────────────────────────────────────────────

  async tasks(ref: string): Promise<AgentTask[]> {
    const { tasks } = await this.http.get<{ tasks: AgentTask[] }>(`/api/agents/${encodeURIComponent(ref)}/tasks`);
    return tasks;
  }

  addTask(ref: string, input: CreateAgentTaskInput): Promise<AgentTask> {
    return this.http.post<AgentTask>(`/api/agents/${encodeURIComponent(ref)}/tasks`, input);
  }

  updateTask(ref: string, taskId: string, patch: UpdateAgentTaskInput): Promise<AgentTask> {
    return this.http.patch<AgentTask>(
      `/api/agents/${encodeURIComponent(ref)}/tasks/${encodeURIComponent(taskId)}`, patch,
    );
  }

  removeTask(ref: string, taskId: string): Promise<void> {
    return this.http.del<void>(`/api/agents/${encodeURIComponent(ref)}/tasks/${encodeURIComponent(taskId)}`);
  }
}
