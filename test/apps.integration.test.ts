/**
 * @license Proprietary — © Glyphh. All rights reserved.
 *
 * Apps ↔ live control plane. Publish a static-bundle app, see it in browse, install +
 * uninstall it, then deploy it to a `<slug>.glyphh.app` origin (LocalHostingDriver in
 * dev) and tear it down. Needs the server on :3001.
 */

import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { createClient, type Client } from "../src/index.js";

const url = process.env.GLYPHH_SERVER_URL ?? "http://127.0.0.1:3001";

async function signIn(): Promise<Client> {
  const client = createClient({ url });
  const start = await client.auth.startEmailLink(`apps-${randomUUID()}@example.com`);
  await client.auth.verifyEmailLink(start.devToken!);
  return client;
}

describe("@glyphh/client — apps + hosting", () => {
  it("publish → browse → install → uninstall", async () => {
    const client = await signIn();
    const slug = `demo-${randomUUID().slice(0, 8)}`;

    const listing = await client.apps.publish({
      manifest: { slug, name: "Demo", version: "1.0.0", description: "a demo app" },
      bundleUrl: "https://bundles.glyphh.app/demo.tgz",
      visibility: "org",
    });
    expect(listing.slug).toBe(slug);
    expect(listing.version).toBe("1.0.0");

    const browse = await client.apps.browse();
    expect(browse.some((a) => a.slug === slug)).toBe(true);

    const installed = await client.apps.install(slug);
    expect(installed.slug).toBe(slug);
    expect((await client.apps.installed()).some((a) => a.slug === slug)).toBe(true);

    await client.apps.uninstall(slug);
    expect((await client.apps.installed()).some((a) => a.slug === slug)).toBe(false);
  });

  it("deploys a published app and tears it down", async () => {
    const client = await signIn();
    const slug = `host-${randomUUID().slice(0, 8)}`;
    await client.apps.publish({
      manifest: { slug, name: "Host Me", version: "0.1.0" },
      bundleUrl: "https://bundles.glyphh.app/host.tgz",
    });

    const dep = await client.hosting.deploy({ appSlug: slug });
    expect(dep.status).toBe("live");
    expect(dep.url).toBe(`https://${slug}.glyphh.app`);

    const got = await client.hosting.status(dep.id);
    expect(got.id).toBe(dep.id);
    expect((await client.hosting.list()).some((d) => d.id === dep.id)).toBe(true);

    await client.hosting.destroy(dep.id);
    expect((await client.hosting.status(dep.id)).status).toBe("destroyed");
  });

  it("rejects a malformed manifest", async () => {
    const client = await signIn();
    await expect(
      client.apps.publish({
        manifest: { slug: "Not Kebab!", name: "Bad", version: "not-semver" },
        bundleUrl: "https://bundles.glyphh.app/bad.tgz",
      }),
    ).rejects.toMatchObject({ code: "E_VALIDATION" });
  });
});
