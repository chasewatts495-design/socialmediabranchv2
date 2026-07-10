"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { upload } from "@vercel/blob/client";
import { IconUpload } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/primitives";

interface Probe {
  width: number | null;
  height: number | null;
  durationSec: number | null;
  thumbnailDataUrl: string | null;
}

async function probeImage(file: File): Promise<Probe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      resolve({
        width: img.naturalWidth,
        height: img.naturalHeight,
        durationSec: null,
        thumbnailDataUrl: null,
      });
      URL.revokeObjectURL(url);
    };
    img.onerror = () => {
      resolve({ width: null, height: null, durationSec: null, thumbnailDataUrl: null });
      URL.revokeObjectURL(url);
    };
    img.src = url;
  });
}

async function probeVideo(file: File): Promise<Probe> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    const done = (p: Probe) => {
      URL.revokeObjectURL(url);
      resolve(p);
    };
    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2);
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d")?.drawImage(video, 0, 0);
        done({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSec: Math.round(video.duration),
          thumbnailDataUrl: canvas.toDataURL("image/jpeg", 0.7),
        });
      } catch {
        done({
          width: video.videoWidth,
          height: video.videoHeight,
          durationSec: Math.round(video.duration),
          thumbnailDataUrl: null,
        });
      }
    };
    video.onerror = () =>
      done({ width: null, height: null, durationSec: null, thumbnailDataUrl: null });
    video.src = url;
  });
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  const res = await fetch(dataUrl);
  return res.blob();
}

export function UploadButton({ mode }: { mode: "local" | "blob" }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const probe = file.type.startsWith("video/")
        ? await probeVideo(file)
        : await probeImage(file);

      if (mode === "blob") {
        const blob = await upload(file.name, file, {
          access: "public",
          handleUploadUrl: "/api/media/blob-upload",
        });
        let thumbnailUrl: string | null = null;
        if (probe.thumbnailDataUrl) {
          const t = await upload(
            `${file.name}.thumb.jpg`,
            await dataUrlToBlob(probe.thumbnailDataUrl),
            { access: "public", handleUploadUrl: "/api/media/blob-upload" },
          );
          thumbnailUrl = t.url;
        }
        const res = await fetch("/api/media/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: blob.url,
            pathname: blob.pathname,
            filename: file.name,
            mimeType: file.type || blob.contentType || "application/octet-stream",
            sizeBytes: file.size,
            width: probe.width,
            height: probe.height,
            durationSec: probe.durationSec,
            thumbnailUrl,
          }),
        });
        if (!res.ok) throw new Error("register failed");
      } else {
        const fd = new FormData();
        fd.append("file", file);
        if (probe.width) fd.append("width", String(probe.width));
        if (probe.height) fd.append("height", String(probe.height));
        if (probe.durationSec) fd.append("durationSec", String(probe.durationSec));
        if (probe.thumbnailDataUrl) fd.append("thumbnail", probe.thumbnailDataUrl);
        const res = await fetch("/api/media/upload", { method: "POST", body: fd });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? "upload failed");
        }
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*,video/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void handleFile(f);
        }}
      />
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="flex items-center gap-2 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-60"
      >
        {busy ? <Spinner className="border-white/40 border-t-white" /> : <IconUpload width={16} height={16} />}
        {busy ? "Uploading…" : "Upload media"}
      </button>
      {error && <p className="mt-2 text-xs text-danger">{error}</p>}
    </div>
  );
}
