"use client";

import { useActionState, useMemo, useState } from "react";
import Link from "next/link";
import {
  deleteAssetAction,
  updateAssetMetaAction,
} from "@/server/actions/media";
import type { ActionResult } from "@/server/actions/accounts";
import { cn } from "@/components/ui/cn";
import { Badge } from "@/components/ui/primitives";
import { IconX } from "@/components/ui/icons";

export interface LibraryAsset {
  id: string;
  url: string;
  thumbnailUrl: string | null;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  width: number | null;
  height: number | null;
  durationSec: number | null;
  altText: string | null;
  tags: string[];
  source: string;
  usedBy: number;
  createdAt: string;
}

type Filter = "all" | "image" | "video";

function AssetDrawer({
  asset,
  onClose,
}: {
  asset: LibraryAsset;
  onClose: () => void;
}) {
  const [metaState, metaAction, metaPending] = useActionState<
    ActionResult | null,
    FormData
  >(updateAssetMetaAction.bind(null, asset.id), null);
  const [deleteMsg, setDeleteMsg] = useState<string | null>(null);
  const isVideo = asset.mimeType.startsWith("video/");

  return (
    <div className="fixed inset-0 z-50 flex md:justify-end">
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative z-10 flex h-full w-full flex-col overflow-y-auto border-border bg-surface md:w-[420px] md:border-l">
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <p className="truncate text-sm font-semibold">{asset.filename}</p>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
            aria-label="Close"
          >
            <IconX width={18} height={18} />
          </button>
        </div>

        <div className="flex items-center justify-center bg-bg p-4">
          {isVideo ? (
            <video
              src={asset.url}
              poster={asset.thumbnailUrl ?? undefined}
              controls
              className="max-h-72 w-full rounded-xl"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.url}
              alt={asset.altText ?? ""}
              className="max-h-72 rounded-xl object-contain"
            />
          )}
        </div>

        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2 text-[11px] text-muted">
            <Badge>{isVideo ? "Video" : "Image"}</Badge>
            {asset.width && asset.height && (
              <Badge>
                {asset.width}×{asset.height}
              </Badge>
            )}
            {asset.durationSec && <Badge>{asset.durationSec}s</Badge>}
            <Badge>{Math.max(1, Math.round(asset.sizeBytes / 1024))} KB</Badge>
            <Badge tone={asset.usedBy > 0 ? "accent" : "neutral"}>
              {asset.usedBy > 0
                ? `Used in ${asset.usedBy} post${asset.usedBy === 1 ? "" : "s"}`
                : "Unused"}
            </Badge>
          </div>

          <form action={metaAction} className="space-y-3">
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Alt text
              </span>
              <input
                name="altText"
                defaultValue={asset.altText ?? ""}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="Describe the media for accessibility"
              />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs font-medium text-muted">
                Tags (comma-separated)
              </span>
              <input
                name="tags"
                defaultValue={asset.tags.join(", ")}
                className="w-full rounded-lg border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent"
                placeholder="product, summer, bts"
              />
            </label>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={metaPending}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
              >
                {metaPending ? "Saving…" : "Save"}
              </button>
              {metaState && (
                <span
                  className={cn(
                    "text-xs",
                    metaState.ok ? "text-success" : "text-danger",
                  )}
                >
                  {metaState.message}
                </span>
              )}
            </div>
          </form>

          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-4">
            <Link
              href={`/composer?media=${asset.id}`}
              className="rounded-xl bg-surface-3 px-4 py-2 text-sm font-medium transition hover:bg-border"
            >
              Use in Composer
            </Link>
            <button
              onClick={async () => {
                const res = await deleteAssetAction(asset.id);
                if (res.ok) {
                  onClose();
                } else {
                  setDeleteMsg(res.message ?? "Couldn't delete.");
                }
              }}
              className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft"
            >
              Delete
            </button>
            {deleteMsg && <p className="w-full text-xs text-danger">{deleteMsg}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AssetGrid({ assets }: { assets: LibraryAsset[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return assets.filter((a) => {
      if (filter === "image" && !a.mimeType.startsWith("image/")) return false;
      if (filter === "video" && !a.mimeType.startsWith("video/")) return false;
      if (!q) return true;
      return (
        a.filename.toLowerCase().includes(q) ||
        a.tags.some((t) => t.toLowerCase().includes(q)) ||
        (a.altText ?? "").toLowerCase().includes(q)
      );
    });
  }, [assets, query, filter]);

  const open = assets.find((a) => a.id === openId) ?? null;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files, tags…"
          className="w-full max-w-xs rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <div className="flex rounded-xl border border-border bg-surface-2 p-0.5">
          {(["all", "image", "video"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                "rounded-[10px] px-3 py-1.5 text-xs font-medium capitalize transition",
                filter === f ? "bg-accent text-white" : "text-muted hover:text-ink",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
          No media yet — upload images or videos to reuse them across posts.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {filtered.map((a) => (
            <button
              key={a.id}
              onClick={() => setOpenId(a.id)}
              className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-surface-2 text-left"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={a.thumbnailUrl ?? a.url}
                alt={a.altText ?? a.filename}
                className="h-full w-full object-cover transition group-hover:scale-105"
                loading="lazy"
              />
              {a.mimeType.startsWith("video/") && (
                <span className="absolute top-2 left-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] font-medium text-white">
                  ▶ {a.durationSec ? `${a.durationSec}s` : "video"}
                </span>
              )}
              {a.usedBy > 0 && (
                <span className="absolute right-2 bottom-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
                  ×{a.usedBy}
                </span>
              )}
            </button>
          ))}
        </div>
      )}

      {open && <AssetDrawer asset={open} onClose={() => setOpenId(null)} />}
    </div>
  );
}
