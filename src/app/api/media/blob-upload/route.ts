import { NextRequest, NextResponse } from "next/server";
import { handleUpload, type HandleUploadBody } from "@vercel/blob/client";

/**
 * Token exchange for direct browser → Vercel Blob uploads (bypasses the
 * ~4.5MB serverless request-body limit). The browser then registers the
 * finished upload via /api/media/register.
 */
export async function POST(req: NextRequest) {
  let body: HandleUploadBody;
  try {
    body = (await req.json()) as HandleUploadBody;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  try {
    const result = await handleUpload({
      body,
      request: req,
      onBeforeGenerateToken: async () => ({
        allowedContentTypes: ["image/*", "video/*"],
        maximumSizeInBytes: 500_000_000,
        addRandomSuffix: true,
      }),
      // Not reachable on localhost; the client calls /api/media/register.
      onUploadCompleted: async () => {},
    });
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload failed" },
      { status: 400 },
    );
  }
}
