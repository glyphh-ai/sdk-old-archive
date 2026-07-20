/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * resources/skills.ts — the org's skill library. Any member lists/reads; only an
 * org_admin creates/edits/deletes (server-enforced).
 *
 * `get`/`update`/`remove` accept a slug or an id — the UI holds ids, loops and the
 * CLI use slugs.
 */

import type { AuthedHttp } from "../core/authed-http.js";
import type { Skill, SkillSummary, CreateSkillInput, UpdateSkillInput } from "../contract/skills.js";

export class SkillsClient {
  constructor(private readonly http: AuthedHttp) {}

  async list(): Promise<SkillSummary[]> {
    const { skills } = await this.http.get<{ skills: SkillSummary[] }>("/api/skills");
    return skills;
  }

  /** Every scheduled skill, in full — what a runner arms on start. */
  async scheduled(): Promise<Skill[]> {
    const { skills } = await this.http.get<{ skills: Skill[] }>("/api/skills/scheduled");
    return skills;
  }

  get(ref: string): Promise<Skill> {
    return this.http.get<Skill>(`/api/skills/${encodeURIComponent(ref)}`);
  }

  create(input: CreateSkillInput): Promise<Skill> {
    return this.http.post<Skill>("/api/skills", input);
  }

  update(ref: string, patch: UpdateSkillInput): Promise<Skill> {
    return this.http.patch<Skill>(`/api/skills/${encodeURIComponent(ref)}`, patch);
  }

  remove(ref: string): Promise<void> {
    return this.http.del<void>(`/api/skills/${encodeURIComponent(ref)}`);
  }
}
