"use client";

import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_BADGE_COLORS, PLATFORM_LABELS } from "@/lib/metrics/colors";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import type { LibraryAsset } from "@/components/library/AssetGrid";

/** Stylized mock of how the post will look on the target platform. */
export function PlatformPreview({
  platformId,
  handle,
  displayName,
  avatarColor,
  caption,
  title,
  media,
}: {
  platformId: PlatformId;
  handle: string;
  displayName: string;
  avatarColor: string;
  caption: string;
  title?: string;
  media: LibraryAsset[];
}) {
  const first = media[0];
  const isVideoFirst = first?.mimeType.startsWith("video/");
  const captionFirst = platformId === "x" || platformId === "reddit" || platformId === "facebook";

  const mediaEl = first ? (
    <div className="relative overflow-hidden rounded-lg bg-bg">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={first.thumbnailUrl ?? first.url}
        alt=""
        className="max-h-64 w-full object-cover"
      />
      {isVideoFirst && (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/60 pl-1 text-xl text-white">
            ▶
          </span>
        </span>
      )}
      {media.length > 1 && (
        <span className="absolute top-2 right-2 rounded-md bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
          1/{media.length}
        </span>
      )}
    </div>
  ) : null;

  return (
    <div
      data-testid={`preview-${platformId}`}
      className="overflow-hidden rounded-2xl border border-border bg-surface-2"
    >
      <div
        className="h-1 w-full"
        style={{ background: PLATFORM_BADGE_COLORS[platformId] }}
      />
      <div className="p-3">
        <div className="flex items-center gap-2">
          <AccountAvatar name={displayName} color={avatarColor} size={32} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold">{handle}</p>
            <p className="text-[10px] text-faint">
              {PLATFORM_LABELS[platformId]} · just now
            </p>
          </div>
        </div>

        {title && (
          <p className="mt-2 text-sm font-semibold leading-snug">{title}</p>
        )}

        <div className="mt-2 space-y-2">
          {captionFirst ? (
            <>
              {caption && (
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  {caption}
                </p>
              )}
              {mediaEl}
            </>
          ) : (
            <>
              {mediaEl}
              {caption && (
                <p className="text-xs leading-relaxed whitespace-pre-wrap">
                  <span className="font-semibold">{handle}</span> {caption}
                </p>
              )}
            </>
          )}
        </div>

        <div className="mt-3 flex gap-4 text-[10px] text-faint">
          <span>♡ Like</span>
          <span>💬 Comment</span>
          <span>↗ Share</span>
        </div>
      </div>
    </div>
  );
}
