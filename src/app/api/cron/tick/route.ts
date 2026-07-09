import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { runDueWork } from "@/lib/scheduler/runner";
import { setSetting } from "@/lib/settings";

export const maxDuration = 60;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return process.env.NODE_ENV !== "production";
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

async function tick(req: NextRequest) {
  if (!authorized(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const db = await getDb();
  const result = await runDueWork(db, { limit: 10 });
  await setSetting("cron.lastTickAt", new Date().toISOString());
  return NextResponse.json(result);
}

/** Vercel Cron uses GET; external pingers can use either. */
export async function GET(req: NextRequest) {
  return tick(req);
}

export async function POST(req: NextRequest) {
  return tick(req);
}
