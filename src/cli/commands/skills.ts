/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/skills.ts — the org's skill library, read-only here. `skills pull` writes a skill's prompt, program and manifest out to files.
 */

import { writeFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";

export function registerSkills(reg: CommandRegistry): void {
  reg.register({
    path: "skills list",
    summary: "list the org's skills",
    covers: ["skills.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.skills.list());
    },
  });

  reg.register({
    path: "skills get",
    summary: "a skill's detail (manifest + prompt + program)",
    usage: "skills get <slug|id>",
    covers: ["skills.get"],
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: skills get <slug|id>");
      ctx.printJson(await ctx.client.skills.get(ref));
    },
  });

  reg.register({
    path: "skills pull",
    summary: "write a skill's prompt, program + manifest to disk",
    usage: "skills pull <slug|id> [--prompt <path>] [--code <path>] [--manifest <path>]",
    async run(ctx, args) {
      const ref = args.positional[0];
      if (!ref) throw new Error("usage: skills pull <slug|id> [--prompt <path>] [--code <path>] [--manifest <path>]");
      const skill = await ctx.client.skills.get(ref);
      const promptPath = flagStr(args, "prompt") ?? `${skill.slug}.skill.md`;
      const manifestPath = flagStr(args, "manifest") ?? `${skill.slug}.skill.json`;
      writeFileSync(promptPath, skill.prompt, "utf8");
      writeFileSync(manifestPath, `${JSON.stringify(skill.manifest, null, 2)}\n`, "utf8");
      const written = [promptPath, manifestPath];
      // Only write a program file when there is one — a prompt-only skill
      // shouldn't leave an empty .js behind.
      if (skill.code.trim()) {
        const codePath = flagStr(args, "code") ?? `${skill.slug}.skill.js`;
        writeFileSync(codePath, skill.code, "utf8");
        written.push(codePath);
      }
      ctx.print(written.join("\n"));
    },
  });



}
