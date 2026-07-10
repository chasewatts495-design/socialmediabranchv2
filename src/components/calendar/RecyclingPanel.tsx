"use client";

/**
 * Per-account content-recycling controls: turn auto-reposting on, set the
 * cadence and no-repeat window, and see what's eligible to run next.
 */

import { useState, useTransition } from "react";
import type { RecyclingAccountRow } from "@/lib/db/calendar-queries";
import {
  recycleNowAction,
  saveRecycleRuleAction,
  type RecycleRuleInput,
} from "@/server/actions/recycle";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { Card, Spinner } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import { relativeTime } from "@/lib/relative-time";

const selectCls =
  "rounded-lg border border-border bg-surface-2 px-2 py-1.5 text-xs outline-none focus:border-accent";

const CADENCES: [number, string][] = [
  [24, "Daily"],
  [48, "Every 2 days"],
  [72, "Every 3 days"],
  [168, "Weekly"],
  [336, "Every 2 weeks"],
];

const NO_REPEAT: [number, string][] = [
  [14, "2 weeks"],
  [30, "30 days"],
  [60, "60 days"],
  [90, "90 days"],
];

function RecyclingCard({ row }: { row: RecyclingAccountRow }) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [rule, setRule] = useState<RecycleRuleInput>({
    enabled: row.rule?.enabled ?? false,
    everyHours: row.rule?.everyHours ?? 72,
    noRepeatDays: row.rule?.noRepeatDays ?? 30,
    windowStartHour: row.rule?.windowStartHour ?? 9,
    windowEndHour: row.rule?.windowEndHour ?? 21,
    freshenCaption: row.rule?.freshenCaption ?? false,
  });

  const save = (patch: Partial<RecycleRuleInput>) => {
    const next = { ...rule, ...patch };
    setRule(next);
    setMessage(null);
    start(async () => {
      const res = await saveRecycleRuleAction(row.accountId, next);
      setMessage(res.message ?? null);
    });
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-3">
        <AccountAvatar name={row.displayName} color={row.avatarColor} size={32} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{row.handle}</p>
          <PlatformBadge platformId={row.platformId} />
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={rule.enabled}
          aria-label={`Recycling for ${row.handle}`}
          data-testid={`recycle-toggle-${row.accountId.slice(0, 4)}`}
          disabled={pending || !row.postingEnabled}
          onClick={() => save({ enabled: !rule.enabled })}
          className={cn(
            "relative h-6 w-11 shrink-0 rounded-full transition-colors",
            rule.enabled ? "bg-accent" : "bg-surface-3",
            (pending || !row.postingEnabled) && "opacity-60",
          )}
        >
          <span
            className={cn(
              "absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform duration-150",
              rule.enabled && "translate-x-5",
            )}
          />
        </button>
      </div>

      {!row.postingEnabled && (
        <p className="mt-2 text-[11px] text-warning">
          Posting is off for this account — enable it in Connections first.
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
        <select
          value={rule.everyHours}
          disabled={pending}
          aria-label="Cadence"
          onChange={(e) => save({ everyHours: Number(e.target.value) })}
          className={selectCls}
        >
          {CADENCES.map(([v, label]) => (
            <option key={v} value={v}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={rule.noRepeatDays}
          disabled={pending}
          aria-label="No-repeat window"
          onChange={(e) => save({ noRepeatDays: Number(e.target.value) })}
          className={selectCls}
        >
          {NO_REPEAT.map(([v, label]) => (
            <option key={v} value={v}>
              No repeats for {label}
            </option>
          ))}
        </select>
        <span className="flex items-center gap-1">
          between
          <select
            value={rule.windowStartHour}
            disabled={pending}
            aria-label="Window start hour"
            onChange={(e) => save({ windowStartHour: Number(e.target.value) })}
            className={selectCls}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h} value={h}>
                {h}:00
              </option>
            ))}
          </select>
          and
          <select
            value={rule.windowEndHour}
            disabled={pending}
            aria-label="Window end hour"
            onChange={(e) => save({ windowEndHour: Number(e.target.value) })}
            className={selectCls}
          >
            {Array.from({ length: 24 }, (_, h) => (
              <option key={h + 1} value={h + 1}>
                {h + 1}:00
              </option>
            ))}
          </select>
          UTC
        </span>
        <label className="flex cursor-pointer items-center gap-1.5">
          <input
            type="checkbox"
            checked={rule.freshenCaption}
            disabled={pending}
            onChange={(e) => save({ freshenCaption: e.target.checked })}
            className="accent-[#8f6f22]"
          />
          Freshen captions
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3">
        <p className="text-[11px] text-faint">
          {row.pool.eligibleCount} post
          {row.pool.eligibleCount === 1 ? "" : "s"} eligible
          {row.rule?.lastPickedAt &&
            ` · last recycled ${relativeTime(row.rule.lastPickedAt)}`}
        </p>
        <button
          type="button"
          disabled={pending || !rule.enabled || row.pool.eligibleCount === 0}
          data-testid={`recycle-now-${row.accountId.slice(0, 4)}`}
          onClick={() =>
            start(async () => {
              const res = await recycleNowAction(row.accountId);
              setMessage(res.message ?? null);
            })
          }
          className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-surface-3 disabled:opacity-50"
        >
          {pending ? <Spinner /> : "Recycle one now"}
        </button>
      </div>

      {row.pool.sampleCaptions.length > 0 && (
        <div className="mt-2 space-y-1">
          {row.pool.sampleCaptions.map((c, i) => (
            <p key={i} className="truncate text-[11px] text-faint">
              ↻ {c}
            </p>
          ))}
        </div>
      )}

      {message && <p className="mt-2 text-[11px] text-muted">{message}</p>}
    </Card>
  );
}

export function RecyclingPanel({ rows }: { rows: RecyclingAccountRow[] }) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-muted md:text-sm">
        Recycling randomly re-posts content that already worked — each account
        picks from its own published posts, skips anything that ran recently,
        and schedules the rerun at a random time inside your posting window.
        Recycled posts wear a ↻ badge on the calendar.
      </p>
      <div className="reveal-group grid gap-3 md:grid-cols-2" data-testid="recycling-list">
        {rows.map((row) => (
          <RecyclingCard key={row.accountId} row={row} />
        ))}
        {rows.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-6 text-sm text-muted">
            No accounts in this brand yet.
          </p>
        )}
      </div>
    </div>
  );
}
