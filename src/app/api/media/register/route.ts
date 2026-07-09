import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getDb } from "@/lib/db/client";
import { mediaAssets } from "@/lib/db/schema";

const uuid = () => crypto.randomUUID();

const schema = z.object({
  url: z.url(),
  pathname: z.string().min(1),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  sizeBytes: z.number().int().nonnegative(),
  width: z.number().int().positive().nullish(),
  height: z.number().int().positive().nullish(),
  durationSec: z.number().int().positive().nullish(),
  thumbnailUrl: z.url().nullish(),
});

/** Registers a blob that the browser uploaded directly to Vercel Blob. */
export async function POST(req: NextRequest) {
  const parsed = schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }
  const d = parsed.data;
  const db = await getDb();
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      id: uuid(),
      filename: d.filename,
      storageKey: d.pathname,
      url: d.url,
      mimeType: d.mimeType,
      sizeBytes: d.sizeBytes,
      width: d.width ?? null,
      height: d.height ?? null,
      durationSec: d.durationSec ?? null,
      thumbnailUrl: d.thumbnailUrl ?? null,
      source: "upload",
    })
    .returning();
  return NextResponse.json({ asset });
}
