import { beforeAll, describe, expect, it, vi } from "vitest";
import type { Mock } from "vitest";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { migrate } from "drizzle-orm/pglite/migrator";
import { and, eq } from "drizzle-orm";
import * as schema from "@/lib/db/schema";
import type { Db } from "@/lib/db/client";

const holder: { db?: Db } = {};
vi.mock("@/lib/db/client", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/db/client")>();
  return { ...mod, getDb: async () => holder.db! };
});
// Server actions call revalidatePath, which needs a request scope.
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
// F2 asserts WHAT the runner asks of syncAccount, so stub it.
vi.mock("@/lib/scheduler/jobs", async (importOriginal) => {
  const mod = await importOriginal<typeof import("@/lib/scheduler/jobs")>();
  return {
    ...mod,
    syncAccount: vi.fn(async () => ({ ok: true, upserted: 0 })),
  };
});

process.env.APP_ENCRYPTION_KEY = "wave1-test-key";

import { savePostAction } from "@/server/actions/posts";
import { runDueWork } from "@/lib/scheduler/runner";
import { syncAccount } from "@/lib/scheduler/jobs";
import { clearDemoData, runSeed, DEMO_BRAND_ID } from "@/lib/db/seed";
import { linkDiscoveredAccount } from "@/lib/oauth/link-account";
import { LiveHttpError } from "@/lib/connectors/live/http";
import { OAuthHttpError } from "@/lib/oauth/providers/http";
import { decryptSecret } from "@/lib/crypto/secretbox";

const uuid = () => crypto.randomUUID();
let db: Db;

beforeAll(async () => {
  const pglite = new PGlite();
  const d = drizzle(pglite, { schema });
  await migrate(d, { migrationsFolder: path.join(process.cwd(), "drizzle") });
  db = d as unknown as Db;
  holder.db = db;
});

describe("F4: error messages never carry query strings", () => {
  it("LiveHttpError strips tokens riding the URL", () => {
    const err = new LiveHttpError(
      400,
      "bad",
      "https://graph.facebook.com/v23.0/pg1/feed?access_token=SUPERSECRET&message=x",
    );
    expect(err.message).not.toContain("SUPERSECRET");
    expect(err.message).toContain("graph.facebook.com/v23.0/pg1/feed");
  });

  it("OAuthHttpError strips client secrets riding the URL", () => {
    const err = new OAuthHttpError(
      400,
      "bad",
      "https://graph.facebook.com/oauth/access_token?client_secret=TOPSECRET&code=c",
    );
    expect(err.message).not.toContain("TOPSECRET");
  });
});

describe("F1: editing a scheduled post cancels its stale publish jobs", () => {
  it("re-saving as draft leaves no pending publish job", async () => {
    await db
      .insert(schema.platforms)
      .values({ id: "facebook", displayName: "Facebook", sortOrder: 0 })
      .onConflictDoNothing();
    const accountId = uuid();
    await db.insert(schema.accounts).values({
      id: accountId,
      platformId: "facebook",
      handle: "@edit-test",
      displayName: "Edit Test",
      mode: "demo",
    });

    const scheduled = await savePostAction({
      postId: null,
      caption: "scheduled once",
      mediaIds: [],
      targets: [{ accountId, caption: "v", meta: {}, scheduledAt: null }],
      mode: "schedule",
      scheduledAt: new Date(Date.now() + 3_600_000).toISOString(),
    });
    expect(scheduled.ok).toBe(true);
    const postId = scheduled.postId!;
    const pendingBefore = await db
      .select()
      .from(schema.scheduleJobs)
      .where(
        and(
          eq(schema.scheduleJobs.refId, postId),
          eq(schema.scheduleJobs.status, "pending"),
        ),
      );
    expect(pendingBefore).toHaveLength(1);

    // Pull it back to a draft — the old release must not fire.
    const redraft = await savePostAction({
      postId,
      caption: "actually hold on",
      mediaIds: [],
      targets: [{ accountId, caption: "v", meta: {}, scheduledAt: null }],
      mode: "draft",
      scheduledAt: null,
    });
    expect(redraft.ok).toBe(true);
    const pendingAfter = await db
      .select()
      .from(schema.scheduleJobs)
      .where(
        and(
          eq(schema.scheduleJobs.refId, postId),
          eq(schema.scheduleJobs.status, "pending"),
        ),
      );
    expect(pendingAfter).toHaveLength(0);
  });
});

describe("F2: first live sync backfills 90 days", () => {
  it("runner asks for 90d with no api history, 3d afterwards", async () => {
    const accountId = uuid();
    await db.insert(schema.accounts).values({
      id: accountId,
      platformId: "facebook",
      handle: "@fresh-live",
      displayName: "Fresh Live",
      mode: "live",
    });
    await db.insert(schema.scheduleJobs).values({
      id: uuid(),
      kind: "sync_stats",
      refId: accountId,
      runAt: new Date(Date.now() - 1000),
    });
    await runDueWork(db);
    const firstCall = (syncAccount as unknown as Mock).mock.calls.at(-1);
    expect(firstCall?.[1]).toBe(accountId);
    expect(firstCall?.[2]).toEqual({ sinceDays: 90 });

    // With api-sourced history on file, the daily sync stays incremental.
    await db.insert(schema.metricSnapshots).values({
      id: uuid(),
      accountId,
      date: "2026-07-09",
      followers: 10,
      source: "api",
    });
    await db.insert(schema.scheduleJobs).values({
      id: uuid(),
      kind: "sync_stats",
      refId: accountId,
      runAt: new Date(Date.now() - 1000),
    });
    await runDueWork(db);
    const secondCall = (syncAccount as unknown as Mock).mock.calls.at(-1);
    expect(secondCall?.[2]).toEqual({ sinceDays: 3 });
  });
});

describe("F5: accounts are matched by external identity, not handle", () => {
  const payloadFor = (externalId: string) => ({
    platformId: "facebook" as const,
    externalId,
    handle: "Aurora Page", // both pages share the display name
    displayName: "Aurora Page",
    credentialPayload: { accessToken: `at-${externalId}`, pageToken: `pt-${externalId}` },
    scopes: ["pages_manage_posts"],
  });

  it("two same-named pages become two accounts; reconnect reuses by id", async () => {
    const first = await linkDiscoveredAccount(db, payloadFor("page-A"), {
      brandId: null,
    });
    const second = await linkDiscoveredAccount(db, payloadFor("page-B"), {
      brandId: null,
    });
    expect(second).not.toBe(first);

    // Reconnecting page-A lands on the ORIGINAL row, tokens refreshed.
    const again = await linkDiscoveredAccount(db, payloadFor("page-A"), {
      brandId: null,
    });
    expect(again).toBe(first);

    const cred = await db.query.credentials.findFirst({
      where: (c, { eq: e }) => e(c.accountId, first),
    });
    const payload = JSON.parse(decryptSecret(cred!.encryptedPayload));
    expect(payload.externalId).toBe("page-A");
  });

  it("reauth refuses to rebind a different identity", async () => {
    const original = await linkDiscoveredAccount(db, payloadFor("page-C"), {
      brandId: null,
    });
    // Owner clicks reconnect on page-C but logs into page-D's identity.
    const linked = await linkDiscoveredAccount(db, payloadFor("page-D"), {
      brandId: null,
      reauthAccountId: original,
    });
    expect(linked).not.toBe(original);
    const cred = await db.query.credentials.findFirst({
      where: (c, { eq: e }) => e(c.accountId, original),
    });
    const payload = JSON.parse(decryptSecret(cred!.encryptedPayload));
    expect(payload.externalId).toBe("page-C"); // untouched
  });
});

describe("F6: seed lifecycle never touches owner data", () => {
  it("re-seed sweep spares user accounts and posts using demo media", async () => {
    const pglite = new PGlite();
    const fresh = drizzle(pglite, { schema }) as unknown as Db;
    await migrate(fresh as never, {
      migrationsFolder: path.join(process.cwd(), "drizzle"),
    });
    await runSeed(fresh);

    // Owner adds their own account (demo mode, demo brand — worst case)…
    const userAccount = uuid();
    await fresh.insert(schema.accounts).values({
      id: userAccount,
      platformId: "facebook",
      brandId: DEMO_BRAND_ID,
      handle: "@my-real-page",
      displayName: "My Real Page",
      mode: "demo",
    });
    // …and writes a post attached to a demo media asset.
    const demoAsset = await fresh.query.mediaAssets.findFirst({
      where: (m, { eq: e }) => e(m.source, "demo"),
    });
    const userPost = uuid();
    await fresh.insert(schema.posts).values({
      id: userPost,
      caption: "my own post",
      status: "draft",
    });
    await fresh.insert(schema.postMedia).values({
      postId: userPost,
      mediaAssetId: demoAsset!.id,
    });

    // The upgrade sweep must neither crash (FK) nor delete owner rows.
    await clearDemoData(fresh);

    const survivingAccount = await fresh.query.accounts.findFirst({
      where: (a, { eq: e }) => e(a.id, userAccount),
    });
    expect(survivingAccount).toBeTruthy();
    const survivingPost = await fresh.query.posts.findFirst({
      where: (p, { eq: e }) => e(p.id, userPost),
    });
    expect(survivingPost).toBeTruthy();

    // All seeded accounts are gone, so a re-seed can't duplicate.
    const remaining = await fresh
      .select({ id: schema.accounts.id })
      .from(schema.accounts);
    expect(remaining).toHaveLength(1);
    // And a second seed runs cleanly on the swept database.
    await runSeed(fresh);
    const reseeded = await fresh
      .select({ id: schema.accounts.id })
      .from(schema.accounts);
    expect(reseeded.length).toBe(11); // 10 seeded + the owner's
  });
});
