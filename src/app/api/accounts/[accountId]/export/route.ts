import { NextRequest, NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { metricSnapshots } from "@/lib/db/schema";

export const dynamic = "force-dynamic";

const COLUMNS = [
  "date",
  "followers",
  "following",
  "postCount",
  "impressions",
  "reach",
  "profileViews",
  "engagements",
  "likes",
  "comments",
  "shares",
  "saves",
  "videoViews",
  "watchTimeSec",
  "source",
] as const;

/**
 * GET → this account's full daily analytics history as CSV, in the same
 * column layout the import template uses (so an export can round-trip
 * back in). Sits behind the app-password middleware like every page.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const db = await getDb();

  const account = await db.query.accounts.findFirst({
    where: (a, { eq: e }) => e(a.id, accountId),
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const rows = await db
    .select()
    .from(metricSnapshots)
    .where(eq(metricSnapshots.accountId, accountId))
    .orderBy(asc(metricSnapshots.date));

  const lines = [
    COLUMNS.join(","),
    ...rows.map((r) =>
      COLUMNS.map((c) => {
        const v = r[c as keyof typeof r];
        return v === null || v === undefined ? "" : String(v);
      }).join(","),
    ),
  ];

  const handleSlug = account.handle.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(lines.join("\n") + "\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="branch-${account.platformId}-${handleSlug}-analytics.csv"`,
    },
  });
}
