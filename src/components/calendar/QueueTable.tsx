"use client";

import { useState, useTransition } from "react";
import type { QueueRow } from "@/lib/db/calendar-queries";
import {
  markManualPublishedAction,
  retryTargetAction,
  skipTargetAction,
} from "@/server/actions/posts";
import { Badge, Spinner } from "@/components/ui/primitives";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/components/ui/cn";

const STATUS_TONE: Record<string, "info" | "warning" | "danger" | "neutral" | "success"> = {
  queued: "info",
  publishing: "info",
  failed: "danger",
  manual_required: "warning",
  skipped: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  queued: "Queued",
  publishing: "Publishing…",
  failed: "Failed",
  manual_required: "Post manually",
  skipped: "Skipped",
};

function RowActions({ row }: { row: QueueRow }) {
  const [pending, start] = useTransition();
  const [url, setUrl] = useState("");
  const [showUrl, setShowUrl] = useState(false);

  if (pending) return <Spinner />;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {(row.status === "failed" || row.status === "skipped") && (
        <button
          onClick={() => start(() => retryTargetAction(row.targetId))}
          className="rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-white hover:bg-accent-strong"
          data-testid="retry-target"
        >
          Retry
        </button>
      )}
      {row.status === "manual_required" &&
        (showUrl ? (
          <span className="flex items-center gap-1.5">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="Link (optional)"
              className="w-36 rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent"
            />
            <button
              onClick={() =>
                start(() => markManualPublishedAction(row.targetId, url || undefined))
              }
              className="rounded-lg bg-success/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-success"
            >
              Done
            </button>
          </span>
        ) : (
          <button
            onClick={() => setShowUrl(true)}
            className="rounded-lg bg-warning/90 px-3 py-1.5 text-xs font-semibold text-black hover:bg-warning"
            data-testid="mark-published"
          >
            Mark published
          </button>
        ))}
      {(row.status === "failed" || row.status === "queued") && (
        <button
          onClick={() => start(() => skipTargetAction(row.targetId))}
          className="rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-muted hover:bg-surface-3"
        >
          Skip
        </button>
      )}
    </div>
  );
}

export function QueueTable({ rows }: { rows: QueueRow[] }) {
  if (rows.length === 0) {
    return (
      <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
        Queue is clear — scheduled and in-flight posts appear here.
      </p>
    );
  }

  return (
    <ul className="space-y-2" data-testid="queue-list">
      {rows.map((row) => (
        <li
          key={row.targetId}
          className={cn(
            "rounded-2xl border bg-surface p-3 md:p-4",
            row.status === "failed" ? "border-danger/40" : "border-border",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm">{row.caption || "(no caption)"}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-muted">
                <PlatformBadge platformId={row.platformId} />
                <span>{row.accountHandle}</span>
                {row.scheduledAt && row.postStatus === "scheduled" && (
                  <span>· scheduled {relativeTime(row.scheduledAt)}</span>
                )}
                {row.lastAttemptAt && (
                  <span>· attempt {row.attemptCount} ({relativeTime(row.lastAttemptAt)})</span>
                )}
              </div>
              {row.errorMessage && (
                <p
                  className={cn(
                    "mt-1.5 text-xs",
                    row.status === "failed" ? "text-danger" : "text-warning",
                  )}
                >
                  {row.errorMessage}
                </p>
              )}
            </div>
            <Badge tone={STATUS_TONE[row.status] ?? "neutral"}>
              {STATUS_LABEL[row.status] ?? row.status}
            </Badge>
            <RowActions row={row} />
          </div>
        </li>
      ))}
    </ul>
  );
}
