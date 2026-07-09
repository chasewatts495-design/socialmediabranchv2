import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db/client";
import { activityLog, metricSnapshots } from "@/lib/db/schema";
import { CSV_TEMPLATE, parseStatsCsv } from "@/lib/connectors/manual/csv";

const uuid = () => crypto.randomUUID();

/** GET → downloadable CSV template. */
export async function GET() {
  return new NextResponse(CSV_TEMPLATE, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": 'attachment; filename="branch-stats-template.csv"',
    },
  });
}

/** POST multipart {file} → upsert metric snapshots for this account. */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ accountId: string }> },
) {
  const { accountId } = await params;
  const db = await getDb();

  const account = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.id, accountId),
  });
  if (!account) {
    return NextResponse.json({ error: "Account not found" }, { status: 404 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a CSV file as 'file'." }, { status: 400 });
  }
  const text = await file.text();
  const { rows, errors } = parseStatsCsv(text);

  for (const r of rows) {
    await db
      .insert(metricSnapshots)
      .values({
        id: uuid(),
        accountId,
        date: r.date,
        followers: r.followers,
        impressions: r.impressions,
        reach: r.reach,
        engagements: r.engagements,
        likes: r.likes,
        comments: r.comments,
        shares: r.shares,
        saves: r.saves,
        videoViews: r.video_views,
        source: "csv",
      })
      .onConflictDoUpdate({
        target: [metricSnapshots.accountId, metricSnapshots.date],
        set: {
          followers: r.followers,
          impressions: r.impressions,
          reach: r.reach,
          engagements: r.engagements,
          likes: r.likes,
          comments: r.comments,
          shares: r.shares,
          saves: r.saves,
          videoViews: r.video_views,
          source: "csv",
        },
      });
  }

  await db.insert(activityLog).values({
    id: uuid(),
    event: "stats.csv_import",
    accountId,
    detail: { imported: rows.length, rejected: errors.length },
  });

  revalidatePath(`/accounts/${accountId}`);
  revalidatePath("/");
  return NextResponse.json({ imported: rows.length, errors });
}
