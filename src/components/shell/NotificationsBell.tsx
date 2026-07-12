"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { NotificationItem } from "@/lib/notifications";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { relativeTime } from "@/lib/relative-time";
import { cn } from "@/components/ui/cn";

function BellIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" {...props}>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2c0 .5-.2 1-.6 1.4L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9"
      />
    </svg>
  );
}

const LEVEL_DOT: Record<string, string> = {
  error: "bg-danger",
  warn: "bg-warning",
  info: "bg-accent",
};

export function NotificationsBell({
  items,
  unreadCount,
  compact = false,
}: {
  items: NotificationItem[];
  unreadCount: number;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-label={`Notifications${unreadCount ? ` (${unreadCount} unread)` : ""}`}
        aria-expanded={open}
        data-testid="notifications-bell"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "relative rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink",
          open && "bg-surface-2 text-ink",
        )}
      >
        <BellIcon width={compact ? 20 : 18} height={compact ? 20 : 18} />
        {unreadCount > 0 && (
          <span
            data-testid="notifications-badge"
            className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 text-[9px] font-bold text-white"
          >
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            "panel-unfold absolute z-50 mt-1.5 w-80 max-w-[calc(100vw-1.5rem)] rounded-xl border border-border bg-surface shadow-xl",
            compact ? "right-0" : "left-0",
          )}
          data-testid="notifications-panel"
        >
          <div className="flex items-center justify-between border-b border-border px-3 py-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-faint">
              Notifications
            </p>
            <button
              type="button"
              disabled={pending || unreadCount === 0}
              onClick={() =>
                start(async () => {
                  await markNotificationsReadAction();
                  router.refresh();
                })
              }
              className="text-[11px] font-medium text-accent-strong hover:underline disabled:opacity-40"
            >
              Mark all read
            </button>
          </div>
          <ul className="max-h-80 divide-y divide-border overflow-y-auto">
            {items.map((n) => {
              const body = (
                <div className="flex items-start gap-2.5 px-3 py-2.5">
                  <span
                    className={cn(
                      "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                      LEVEL_DOT[n.level] ?? "bg-faint",
                      !n.unread && "opacity-30",
                    )}
                  />
                  <span className="min-w-0 flex-1">
                    <span
                      className={cn(
                        "block truncate text-xs",
                        n.unread ? "font-semibold text-ink" : "text-muted",
                      )}
                    >
                      {n.title}
                    </span>
                    {n.detail && (
                      <span className="block truncate text-[11px] text-faint">
                        {n.detail}
                      </span>
                    )}
                    <span className="block text-[10px] text-faint">
                      {relativeTime(n.ts)}
                    </span>
                  </span>
                </div>
              );
              return (
                <li key={n.id}>
                  {n.href ? (
                    <Link
                      href={n.href}
                      onClick={() => setOpen(false)}
                      className="block transition hover:bg-surface-2"
                    >
                      {body}
                    </Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
            {items.length === 0 && (
              <li className="px-3 py-8 text-center text-xs text-muted">
                Nothing yet — publishes, failures, and recycles land here.
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
