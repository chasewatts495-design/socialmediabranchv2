"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { CalendarPost } from "@/lib/db/calendar-queries";
import type { PlatformId } from "@/lib/connectors/types";
import { PLATFORM_CHART_COLORS } from "@/lib/metrics/colors";
import { cancelScheduledAction, reschedulePostAction } from "@/server/actions/posts";
import { cn } from "@/components/ui/cn";
import { Badge, Spinner } from "@/components/ui/primitives";
import { IconX } from "@/components/ui/icons";

const STATUS_COLOR: Record<string, string> = {
  scheduled: "bg-info-soft text-info",
  published: "bg-success-soft text-success",
  partially_failed: "bg-warning-soft text-warning",
  failed: "bg-danger-soft text-danger",
  publishing: "bg-info-soft text-info",
  draft: "bg-surface-3 text-muted",
};

function PlatformDots({ platforms }: { platforms: PlatformId[] }) {
  return (
    <span className="flex -space-x-0.5">
      {platforms.slice(0, 4).map((p) => (
        <span
          key={p}
          className="h-1.5 w-1.5 rounded-full ring-1 ring-surface"
          style={{ background: PLATFORM_CHART_COLORS[p] }}
        />
      ))}
      {platforms.length > 4 && (
        <span className="pl-1 text-[9px] text-faint">+{platforms.length - 4}</span>
      )}
    </span>
  );
}

function PostModal({
  post,
  onClose,
}: {
  post: CalendarPost;
  onClose: () => void;
}) {
  const [pending, start] = useTransition();
  const at = new Date(post.at);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} aria-hidden />
      <div className="relative z-10 w-full max-w-md rounded-t-2xl border border-border bg-surface p-5 md:rounded-2xl fade-up">
        <div className="flex items-start justify-between gap-3">
          <span className="flex items-center gap-1.5">
            <Badge tone="neutral" className={STATUS_COLOR[post.status]}>
              {post.status.replace("_", " ")}
            </Badge>
            {post.recycled && <Badge tone="accent">↻ recycled</Badge>}
          </span>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
            aria-label="Close"
          >
            <IconX width={16} height={16} />
          </button>
        </div>
        <p className="mt-3 text-sm leading-relaxed">{post.caption || "(no caption)"}</p>
        <p className="mt-2 text-xs text-muted">
          {at.toLocaleString(undefined, {
            weekday: "short",
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          })}{" "}
          · {post.targetCount} account{post.targetCount === 1 ? "" : "s"}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {post.status === "scheduled" && (
            <>
              <Link
                href={`/composer?draft=${post.id}`}
                className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong"
              >
                Edit / reschedule
              </Link>
              <button
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await cancelScheduledAction(post.id);
                    onClose();
                  })
                }
                className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
              >
                {pending ? <Spinner /> : "Cancel schedule"}
              </button>
            </>
          )}
          {post.status !== "scheduled" && (
            <Link
              href="/calendar?tab=queue"
              className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-3"
            >
              View in queue
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export function CalendarClient({
  posts,
  monthISO, // first day of month, YYYY-MM-DD
}: {
  posts: CalendarPost[];
  monthISO: string;
}) {
  const [openPost, setOpenPost] = useState<CalendarPost | null>(null);
  const [dropDay, setDropDay] = useState<string | null>(null);
  const [dropMsg, setDropMsg] = useState<string | null>(null);
  const [dropping, startDrop] = useTransition();
  const router = useRouter();

  const monthStart = useMemo(() => new Date(`${monthISO}T00:00:00`), [monthISO]);
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarPost[]>();
    for (const p of posts) {
      const d = new Date(p.at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      map.set(key, [...(map.get(key) ?? []), p]);
    }
    return map;
  }, [posts]);

  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7; // Monday first
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const todayKey = (() => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
  })();

  const cells: { key: string; day: number }[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push({ key: `pad-${i}`, day: 0 });
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({
      key: `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`,
      day: d,
    });
  }

  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const fmtMonthParam = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold md:text-base">
          {monthStart.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex gap-1">
          <Link
            href={`/calendar?month=${fmtMonthParam(prev)}`}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3"
          >
            ←
          </Link>
          <Link
            href="/calendar"
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs hover:bg-surface-3"
          >
            Today
          </Link>
          <Link
            href={`/calendar?month=${fmtMonthParam(next)}`}
            className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-sm hover:bg-surface-3"
          >
            →
          </Link>
        </div>
      </div>

      {(dropping || dropMsg) && (
        <p className="mb-2 hidden text-xs text-muted md:block" data-testid="reschedule-status">
          {dropping ? "Rescheduling…" : dropMsg}
        </p>
      )}

      {/* Desktop month grid */}
      <div className="hidden md:block">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-2xl border border-border bg-border">
          {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
            <div key={d} className="bg-surface-2 px-2 py-1.5 text-center text-[10px] font-medium uppercase tracking-wide text-faint">
              {d}
            </div>
          ))}
          {cells.map((cell) =>
            cell.day === 0 ? (
              <div key={cell.key} className="min-h-24 bg-surface" />
            ) : (
              <div
                key={cell.key}
                onDragOver={(e) => {
                  if (e.dataTransfer.types.includes("text/branch-post")) {
                    e.preventDefault();
                    setDropDay(cell.key);
                  }
                }}
                onDragLeave={() => setDropDay((d) => (d === cell.key ? null : d))}
                onDrop={(e) => {
                  e.preventDefault();
                  setDropDay(null);
                  const postId = e.dataTransfer.getData("text/branch-post");
                  const srcDay = e.dataTransfer.getData("text/branch-src-day");
                  if (!postId || !srcDay || srcDay === cell.key) return;
                  // Day delta from the calendar the user is looking at —
                  // exact in every timezone.
                  const deltaDays = Math.round(
                    (new Date(`${cell.key}T12:00:00`).getTime() -
                      new Date(`${srcDay}T12:00:00`).getTime()) /
                      86_400_000,
                  );
                  startDrop(async () => {
                    const res = await reschedulePostAction(postId, deltaDays);
                    setDropMsg(res.message ?? null);
                    router.refresh();
                  });
                }}
                className={cn(
                  "min-h-24 bg-surface p-1.5",
                  cell.key === todayKey && "bg-accent-soft/30",
                  dropDay === cell.key && "bg-accent-soft outline-2 outline-accent/60 -outline-offset-2",
                )}
              >
                <p className={cn("mb-1 text-[11px]", cell.key === todayKey ? "font-bold text-accent-strong" : "text-faint")}>
                  {cell.day}
                </p>
                <div className="space-y-1">
                  {(byDay.get(cell.key) ?? []).slice(0, 3).map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setOpenPost(p)}
                      draggable={p.status === "scheduled"}
                      onDragStart={(e) => {
                        e.dataTransfer.setData("text/branch-post", p.id);
                        e.dataTransfer.setData("text/branch-src-day", cell.key);
                        e.dataTransfer.effectAllowed = "move";
                      }}
                      title={
                        p.status === "scheduled"
                          ? "Drag to another day to reschedule"
                          : undefined
                      }
                      className={cn(
                        "flex w-full items-center gap-1 truncate rounded-md px-1.5 py-1 text-left text-[10px] font-medium",
                        STATUS_COLOR[p.status] ?? "bg-surface-3 text-muted",
                        p.status === "scheduled" && "cursor-grab active:cursor-grabbing",
                      )}
                    >
                      <PlatformDots platforms={p.platforms} />
                      <span className="truncate">
                        {p.recycled && <span title="Recycled post">↻ </span>}
                        {new Date(p.at).toLocaleTimeString(undefined, {
                          hour: "numeric",
                          minute: "2-digit",
                        })}{" "}
                        {p.caption || "(post)"}
                      </span>
                    </button>
                  ))}
                  {(byDay.get(cell.key)?.length ?? 0) > 3 && (
                    <p className="px-1 text-[9px] text-faint">
                      +{byDay.get(cell.key)!.length - 3} more
                    </p>
                  )}
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Mobile agenda list */}
      <div className="md:hidden">
        {posts.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-12 text-center text-sm text-muted">
            Nothing this month.
          </p>
        ) : (
          <ul className="space-y-2">
            {[...byDay.entries()]
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([day, dayPosts]) => (
                <li key={day}>
                  <p className={cn("mb-1.5 mt-4 text-xs font-semibold", day === todayKey ? "text-accent-strong" : "text-muted")}>
                    {new Date(`${day}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                    {day === todayKey && " · today"}
                  </p>
                  <ul className="space-y-1.5">
                    {dayPosts.map((p) => (
                      <li key={p.id}>
                        <button
                          onClick={() => setOpenPost(p)}
                          className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface p-3 text-left"
                        >
                          <span
                            className={cn(
                              "rounded-lg px-2 py-1 text-[10px] font-semibold",
                              STATUS_COLOR[p.status],
                            )}
                          >
                            {new Date(p.at).toLocaleTimeString(undefined, {
                              hour: "numeric",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-sm">
                            {p.recycled && <span title="Recycled post">↻ </span>}
                            {p.caption || "(post)"}
                          </span>
                          <PlatformDots platforms={p.platforms} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
          </ul>
        )}
      </div>

      {openPost && <PostModal post={openPost} onClose={() => setOpenPost(null)} />}
    </div>
  );
}
