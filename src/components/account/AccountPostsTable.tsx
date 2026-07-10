"use client";

import { useMemo, useState } from "react";
import type { AccountPostRow } from "@/lib/db/account-queries";
import { formatCompact, formatPct } from "@/lib/metrics/engagement";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/components/ui/cn";
import { IconExternal } from "@/components/ui/icons";

type SortKey = "date" | "er" | "impressions" | "likes";

const SORTS: { key: SortKey; label: string }[] = [
  { key: "date", label: "Recent" },
  { key: "er", label: "Best ER" },
  { key: "impressions", label: "Most seen" },
  { key: "likes", label: "Most liked" },
];

function sortPosts(posts: AccountPostRow[], key: SortKey) {
  const arr = [...posts];
  switch (key) {
    case "er":
      return arr.sort(
        (a, b) => (b.metrics?.engagementRate ?? 0) - (a.metrics?.engagementRate ?? 0),
      );
    case "impressions":
      return arr.sort(
        (a, b) => (b.metrics?.impressions ?? 0) - (a.metrics?.impressions ?? 0),
      );
    case "likes":
      return arr.sort((a, b) => (b.metrics?.likes ?? 0) - (a.metrics?.likes ?? 0));
    default:
      return arr.sort((a, b) =>
        (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""),
      );
  }
}

export function AccountPostsTable({ posts }: { posts: AccountPostRow[] }) {
  const [sort, setSort] = useState<SortKey>("date");
  const sorted = useMemo(() => sortPosts(posts, sort), [posts, sort]);

  if (posts.length === 0) {
    return (
      <p className="px-4 py-8 text-center text-sm text-muted">
        No posts recorded for this account yet.
      </p>
    );
  }

  return (
    <div>
      <div className="flex gap-1 overflow-x-auto px-4 pt-3 md:px-5">
        {SORTS.map((s) => (
          <button
            key={s.key}
            onClick={() => setSort(s.key)}
            className={cn(
              "shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium transition",
              sort === s.key
                ? "bg-accent-soft text-accent-strong"
                : "text-muted hover:bg-surface-2",
            )}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Desktop table */}
      <table className="mt-2 hidden w-full text-sm md:table">
        <thead>
          <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-faint">
            <th className="px-5 py-2 font-medium">Post</th>
            <th className="px-3 py-2 font-medium">Published</th>
            <th className="px-3 py-2 text-right font-medium">Impressions</th>
            <th className="px-3 py-2 text-right font-medium">Likes</th>
            <th className="px-3 py-2 text-right font-medium">Comments</th>
            <th className="px-3 py-2 text-right font-medium">ER</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {sorted.map((p) => (
            <tr key={p.targetId} className="hover:bg-surface-2/50">
              <td className="max-w-[320px] px-5 py-2.5">
                <div className="flex items-center gap-3">
                  {p.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={p.thumbnailUrl}
                      alt=""
                      className="h-9 w-9 shrink-0 rounded-md object-cover"
                    />
                  ) : (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-3 text-[10px] text-faint">
                      Aa
                    </span>
                  )}
                  <span className="truncate">{p.caption}</span>
                </div>
              </td>
              <td className="whitespace-nowrap px-3 py-2.5 text-muted">
                {relativeTime(p.publishedAt)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {formatCompact(p.metrics?.impressions)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {formatCompact(p.metrics?.likes)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {formatCompact(p.metrics?.comments)}
              </td>
              <td className="px-3 py-2.5 text-right font-medium text-success">
                {formatPct(p.metrics?.engagementRate)}
              </td>
              <td className="px-3 py-2.5 text-right">
                {p.externalUrl && (
                  <a
                    href={p.externalUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex text-muted hover:text-ink"
                    aria-label="Open on platform"
                  >
                    <IconExternal width={16} height={16} />
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Mobile cards */}
      <ul className="divide-y divide-border md:hidden">
        {sorted.map((p) => (
          <li key={p.targetId} className="flex items-center gap-3 px-4 py-3">
            {p.thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={p.thumbnailUrl}
                alt=""
                className="h-11 w-11 shrink-0 rounded-lg object-cover"
              />
            ) : (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs text-faint">
                Aa
              </span>
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{p.caption}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                {relativeTime(p.publishedAt)} ·{" "}
                {formatCompact(p.metrics?.impressions)} impr. ·{" "}
                {formatCompact(p.metrics?.likes)} likes
              </p>
            </div>
            <span className="text-xs font-semibold text-success">
              {formatPct(p.metrics?.engagementRate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
