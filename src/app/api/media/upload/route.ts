import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db/client";
import { mediaAssets } from "@/lib/db/schema";
import { getStorage } from "@/lib/storage";

const uuid = () => crypto.randomUUID();

const MAX_UPLOAD_BYTES = 200_000_000;

/**
 * Local-mode upload: multipart { file, width?, height?, durationSec?, thumbnail? }.
 * (In blob mode the browser uploads straight to Vercel Blob and then calls
 * /api/media/register — serverless functions can't take big bodies.)
 */
export async function POST(req: NextRequest) {
  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file." }, { status: 400 });
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "File exceeds 200MB." }, { status: 413 });
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return NextResponse.json(
      { error: "Only image or video files are supported." },
      { status: 415 },
    );
  }

  const storage = getStorage();
  const id = uuid();
  const ext = (file.name.split(".").pop() || (isImage ? "png" : "mp4")).toLowerCase();
  const key = `${id}.${ext}`;
  const { url } = await storage.save(
    key,
    new Uint8Array(await file.arrayBuffer()),
    file.type,
  );

  // Optional client-captured video poster frame (data URL).
  let thumbnailUrl: string | null = null;
  const thumb = form.get("thumbnail");
  if (typeof thumb === "string" && thumb.startsWith("data:image/")) {
    const b64 = thumb.split(",")[1] ?? "";
    if (b64) {
      const bytes = Uint8Array.from(Buffer.from(b64, "base64"));
      const saved = await storage.save(`${id}.thumb.jpg`, bytes, "image/jpeg");
      thumbnailUrl = saved.url;
    }
  }

  const num = (k: string) => {
    const v = form.get(k);
    const n = Number(v);
    return typeof v === "string" && v !== "" && Number.isFinite(n)
      ? Math.round(n)
      : null;
  };

  const db = await getDb();
  const [asset] = await db
    .insert(mediaAssets)
    .values({
      id,
      filename: file.name,
      storageKey: key,
      url,
      mimeType: file.type,
      sizeBytes: file.size,
      width: num("width"),
      height: num("height"),
      durationSec: num("durationSec"),
      thumbnailUrl,
      source: "upload",
    })
    .returning();

  return NextResponse.json({ asset });
}
