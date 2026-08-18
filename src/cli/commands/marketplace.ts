/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * commands/marketplace.ts — marketplace developer profiles + developer reviews.
 * Mirrors the apps review verbs: developers carry stars exactly like apps.
 */

import { readFileSync } from "node:fs";
import type { CommandRegistry } from "../registry.js";
import { flagStr } from "../args.js";
import type { CreateDeveloperInput, UpdateDeveloperInput } from "../../contract/marketplace.js";

export function registerMarketplace(reg: CommandRegistry): void {
  reg.register({
    path: "marketplace developer create",
    summary: "create your developer profile (personal or your org's)",
    usage: "marketplace developer create --scope personal|org --handle <h> --name <display> [--bio <text>] [--website <url>] [--support-email <email>]",
    covers: ["marketplace.createDeveloper"],
    async run(ctx, args) {
      const scope = flagStr(args, "scope") as CreateDeveloperInput["scope"] | undefined;
      const handle = flagStr(args, "handle");
      const displayName = flagStr(args, "name");
      if (!scope || !handle || !displayName) {
        throw new Error("usage: marketplace developer create --scope personal|org --handle <h> --name <display>");
      }
      const input: CreateDeveloperInput = { scope, handle, displayName };
      const bio = flagStr(args, "bio");
      const website = flagStr(args, "website");
      const supportEmail = flagStr(args, "support-email");
      if (bio) input.bio = bio;
      if (website) input.website = website;
      if (supportEmail) input.supportEmail = supportEmail;
      ctx.printJson(await ctx.client.marketplace.createDeveloper(input));
    },
  });

  reg.register({
    path: "marketplace developer me",
    summary: "your own developer profiles (personal + org)",
    covers: ["marketplace.myDevelopers"],
    async run(ctx) {
      ctx.printJson(await ctx.client.marketplace.myDevelopers());
    },
  });

  reg.register({
    path: "marketplace developer get",
    summary: "one developer profile by handle",
    usage: "marketplace developer get <handle>",
    covers: ["marketplace.developer"],
    async run(ctx, args) {
      const handle = args.positional[0];
      if (!handle) throw new Error("usage: marketplace developer get <handle>");
      ctx.printJson(await ctx.client.marketplace.developer(handle));
    },
  });

  reg.register({
    path: "marketplace developer edit",
    summary: "edit your developer profile (the handle is immutable)",
    usage: "marketplace developer edit <handle> [--name <display>] [--bio <text>] [--website <url>] [--support-email <email>]",
    covers: ["marketplace.updateDeveloper"],
    async run(ctx, args) {
      const handle = args.positional[0];
      if (!handle) throw new Error("usage: marketplace developer edit <handle> [--name …]");
      const patch: UpdateDeveloperInput = {};
      const displayName = flagStr(args, "name");
      const bio = flagStr(args, "bio");
      const website = flagStr(args, "website");
      const supportEmail = flagStr(args, "support-email");
      if (displayName) patch.displayName = displayName;
      if (bio !== undefined) patch.bio = bio;
      if (website !== undefined) patch.website = website;
      if (supportEmail !== undefined) patch.supportEmail = supportEmail;
      ctx.printJson(await ctx.client.marketplace.updateDeveloper(handle, patch));
    },
  });

  reg.register({
    path: "marketplace developer avatar",
    summary: "upload your profile's avatar (PNG/JPEG/GIF/WebP, ≤0.5MB)",
    usage: "marketplace developer avatar <handle> --file <path>",
    covers: ["marketplace.uploadDeveloperAvatar"],
    async run(ctx, args) {
      const handle = args.positional[0];
      const file = flagStr(args, "file");
      if (!handle || !file) throw new Error("usage: marketplace developer avatar <handle> --file <path>");
      const bytes = new Uint8Array(readFileSync(file));
      ctx.printJson(await ctx.client.marketplace.uploadDeveloperAvatar(handle, bytes));
    },
  });

  // ── developer reviews (mirroring app reviews) ───────────────────────────────

  reg.register({
    path: "marketplace developer reviews",
    summary: "a developer's reviews, newest first",
    usage: "marketplace developer reviews <handle> [--limit <n>] [--offset <n>]",
    covers: ["marketplace.developerReviews"],
    async run(ctx, args) {
      const handle = args.positional[0];
      if (!handle) throw new Error("usage: marketplace developer reviews <handle>");
      const limit = flagStr(args, "limit");
      const offset = flagStr(args, "offset");
      ctx.printJson(await ctx.client.marketplace.developerReviews(handle, {
        ...(limit ? { limit: Number(limit) } : {}),
        ...(offset ? { offset: Number(offset) } : {}),
      }));
    },
  });

  reg.register({
    path: "marketplace developer review",
    summary: "create or edit YOUR review of a developer (1–5 stars)",
    usage: "marketplace developer review <handle> --stars <1-5> [--body <text>]",
    covers: ["marketplace.reviewDeveloper"],
    async run(ctx, args) {
      const handle = args.positional[0];
      const stars = flagStr(args, "stars");
      if (!handle || !stars) throw new Error("usage: marketplace developer review <handle> --stars <1-5> [--body <text>]");
      const body = flagStr(args, "body");
      ctx.printJson(await ctx.client.marketplace.reviewDeveloper(handle, {
        stars: Number(stars), ...(body ? { body } : {}),
      }));
    },
  });

  reg.register({
    path: "marketplace developer review-remove",
    summary: "delete your own review of a developer",
    usage: "marketplace developer review-remove <handle>",
    covers: ["marketplace.removeDeveloperReview"],
    async run(ctx, args) {
      const handle = args.positional[0];
      if (!handle) throw new Error("usage: marketplace developer review-remove <handle>");
      await ctx.client.marketplace.removeDeveloperReview(handle);
      ctx.printJson({ ok: true });
    },
  });

  reg.register({
    path: "marketplace developer review-respond",
    summary: "reply publicly to a review of your profile",
    usage: "marketplace developer review-respond <handle> --review <id> --response <text>",
    covers: ["marketplace.respondToDeveloperReview"],
    async run(ctx, args) {
      const handle = args.positional[0];
      const review = flagStr(args, "review");
      const response = flagStr(args, "response");
      if (!handle || !review || !response) {
        throw new Error("usage: marketplace developer review-respond <handle> --review <id> --response <text>");
      }
      ctx.printJson(await ctx.client.marketplace.respondToDeveloperReview(handle, review, response));
    },
  });

  reg.register({
    path: "marketplace developer review-report",
    summary: "flag a review of your profile for platform moderation",
    usage: "marketplace developer review-report <handle> --review <id> --reason <text>",
    covers: ["marketplace.reportDeveloperReview"],
    async run(ctx, args) {
      const handle = args.positional[0];
      const review = flagStr(args, "review");
      const reason = flagStr(args, "reason");
      if (!handle || !review || !reason) {
        throw new Error("usage: marketplace developer review-report <handle> --review <id> --reason <text>");
      }
      ctx.printJson(await ctx.client.marketplace.reportDeveloperReview(handle, review, reason));
    },
  });

  reg.register({
    path: "marketplace developer reviews-flagged",
    summary: "the flagged developer-review queue (platform admin)",
    covers: ["marketplace.flaggedDeveloperReviews"],
    async run(ctx) {
      ctx.printJson(await ctx.client.marketplace.flaggedDeveloperReviews());
    },
  });

  reg.register({
    path: "marketplace developer review-moderate",
    summary: "settle a flagged developer review: restore | remove (platform admin)",
    usage: "marketplace developer review-moderate --review <id> --action restore|remove",
    covers: ["marketplace.moderateDeveloperReview"],
    async run(ctx, args) {
      const review = flagStr(args, "review");
      const action = flagStr(args, "action") as "restore" | "remove" | undefined;
      if (!review || !action) {
        throw new Error("usage: marketplace developer review-moderate --review <id> --action restore|remove");
      }
      ctx.printJson(await ctx.client.marketplace.moderateDeveloperReview(review, action));
    },
  });
}
