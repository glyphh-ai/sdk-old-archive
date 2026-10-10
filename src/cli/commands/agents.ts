/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/agents.ts — standing workers and their tasks.
 *
 * `agents live` is the runner's view: every live agent with its armed tasks and the
 * guardrails it actually runs under (org ceiling ∧ its own).
 */

import type { CommandRegistry } from "../registry.js";

export function registerAgents(reg: CommandRegistry): void {
  reg.register({
    path: "agents list",
    summary: "list agents you can see (your own + org-shared)",
    covers: ["agents.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.agents.list());
    },
  });






  reg.register({
    path: "agents tasks",
    summary: "an agent's tasks",
    usage: "agents tasks <slug|id>",
    covers: ["agents.tasks"],
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: agents tasks <slug|id>");
      ctx.printJson(await ctx.client.agents.tasks(ref));
    },
  });





  reg.register({
    path: "agents task-runs",
    summary: "a task's firing history, newest first",
    usage: "agents task-runs <agent> <taskId>",
    covers: ["agents.taskRuns"],
    async run(ctx, args) {
      const [agent, taskId] = args.positional;
      if (!agent || !taskId) throw new Error("usage: agents task-runs <agent> <taskId>");
      ctx.printJson(await ctx.client.agents.taskRuns(agent, taskId));
    },
  });
}
