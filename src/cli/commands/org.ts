/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/org.ts — accounts commands (org profile, members, seats, invites). One
 * command per SDK method; `covers` keeps the parity test honest.
 */

import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { MemberRole } from "../../contract/org.js";

function asRole(v: string | undefined): MemberRole {
  return v === "org_admin" ? "org_admin" : "user";
}

export function registerOrg(reg: CommandRegistry): void {
  reg.register({
    path: "org show",
    summary: "the caller's organization",
    covers: ["org.get"],
    async run(ctx) {
      ctx.printJson(await ctx.client.org.get());
    },
  });

  reg.register({
    path: "org update",
    summary: "update the org (name; org_admin only)",
    usage: "org update --name <name>",
    covers: ["org.update"],
    async run(ctx, args) {
      const name = flagStr(args, "name");
      if (!name) throw new Error("usage: org update --name <name>");
      ctx.printJson(await ctx.client.org.update({ name }));
    },
  });

  reg.register({
    path: "members list",
    summary: "list org members",
    covers: ["members.list"],
    async run(ctx) {
      ctx.printJson(await ctx.client.members.list());
    },
  });

  reg.register({
    path: "members invite",
    summary: "invite a member (org_admin; fills a seat)",
    usage: "members invite <email> [--role org_admin|user]",
    covers: ["members.invite"],
    async run(ctx, args) {
      const email = args.positional[0];
      if (!email) throw new Error("usage: members invite <email> [--role user|org_admin]");
      const created = await ctx.client.members.invite(email, asRole(flagStr(args, "role")));
      ctx.print(`invited ${email} — token: ${created.token}`);
    },
  });

  reg.register({
    path: "members remove",
    summary: "remove a member (frees the seat)",
    usage: "members remove <userId>",
    covers: ["members.remove"],
    async run(ctx, args) {
      const userId = args.positional[0];
      if (!userId) throw new Error("usage: members remove <userId>");
      await ctx.client.members.remove(userId);
      ctx.print("removed ✓");
    },
  });

  reg.register({
    path: "members role",
    summary: "set a member's role",
    usage: "members role <userId> <org_admin|user>",
    covers: ["members.setRole"],
    async run(ctx, args) {
      const [userId, role] = args.positional;
      if (!userId || !role) throw new Error("usage: members role <userId> <org_admin|user>");
      ctx.printJson(await ctx.client.members.setRole(userId, asRole(role)));
    },
  });

  reg.register({
    path: "invite peek",
    summary: "preview an invite token (public)",
    usage: "invite peek <token>",
    covers: ["invites.peek"],
    async run(ctx, args) {
      const token = args.positional[0];
      if (!token) throw new Error("usage: invite peek <token>");
      ctx.printJson(await ctx.client.invites.peek(token));
    },
  });

  reg.register({
    path: "invite accept",
    summary: "accept an invite (joins the org)",
    usage: "invite accept <token>",
    covers: ["invites.accept"],
    async run(ctx, args) {
      const token = args.positional[0];
      if (!token) throw new Error("usage: invite accept <token>");
      ctx.printJson(await ctx.client.invites.accept(token));
    },
  });
}
