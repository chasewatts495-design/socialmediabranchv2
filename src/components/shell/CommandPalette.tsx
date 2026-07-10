"use client";

/**
 * ⌘K command palette — the HUD's "voice". Fuzzy-searches pages, brands,
 * and accounts, and runs quick actions (switch brand, sync an account,
 * clear notifications) without leaving the keyboard. Mounted once in the
 * app layout; the search buttons in the shell dispatch a window event to
 * open it. Bottom-sheet on mobile, centered on desktop.
 */

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { switchBrandAction } from "@/server/actions/brands";
import { syncNowAction } from "@/server/actions/accounts";
import { markNotificationsReadAction } from "@/server/actions/notifications";
import { PLATFORM_LABELS } from "@/lib/metrics/colors";
import type { PlatformId } from "@/lib/connectors/types";
import { cn } from "@/components/ui/cn";

export const OPEN_PALETTE_EVENT = "branch:open-palette";

export interface PaletteAccount {
  id: string;
  handle: string;
  platformId: PlatformId;
}

export interface PaletteBrand {
  id: string;
  name: string;
}

interface Command {
  key: string;
  title: string;
  hint: string;
  run: () => void | Promise<void>;
}

/** Subsequence fuzzy score: higher = better, null = no match. */
function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  if (!q) return 0;
  let qi = 0;
  let score = 0;
  let streak = 0;
  for (let ti = 0; ti < t.length && qi < q.length; ti++) {
    if (t[ti] === q[qi]) {
      qi++;
      streak++;
      score += 2 + streak; // consecutive hits weigh more
      if (ti === 0 || t[ti - 1] === " ") score += 4; // word starts
    } else {
      streak = 0;
    }
  }
  return qi === q.length ? score : null;
}

export function CommandPalette({
  accounts,
  brands,
}: {
  accounts: PaletteAccount[];
  brands: PaletteBrand[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setActive(0);
  }, []);

  const commands = useMemo<Command[]>(() => {
    const go = (href: string) => () => {
      close();
      router.push(href);
    };
    const out: Command[] = [
      ...NAV_ITEMS.map((n) => ({
        key: `nav:${n.href}`,
        title: n.label,
        hint: "Go to",
        run: go(n.href),
      })),
      {
        key: "action:new-post",
        title: "New post",
        hint: "Compose",
        run: go("/composer"),
      },
      {
        key: "action:queue",
        title: "Open the queue",
        hint: "Calendar",
        run: go("/calendar?tab=queue"),
      },
      {
        key: "action:recycling",
        title: "Recycling rules",
        hint: "Calendar",
        run: go("/calendar?tab=recycle"),
      },
      {
        key: "action:read",
        title: "Mark notifications read",
        hint: "Action",
        run: () => {
          close();
          startTransition(async () => {
            await markNotificationsReadAction();
            router.refresh();
          });
        },
      },
      ...brands.map((b) => ({
        key: `brand:${b.id}`,
        title: `Switch to ${b.name}`,
        hint: "Brand",
        run: () => {
          close();
          startTransition(async () => {
            await switchBrandAction(b.id);
            router.refresh();
          });
        },
      })),
      {
        key: "brand:all",
        title: "Switch to all brands",
        hint: "Brand",
        run: () => {
          close();
          startTransition(async () => {
            await switchBrandAction("all");
            router.refresh();
          });
        },
      },
      ...accounts.flatMap((a) => [
        {
          key: `acct:${a.id}`,
          title: `${a.handle} analytics`,
          hint: PLATFORM_LABELS[a.platformId],
          run: go(`/accounts/${a.id}`),
        },
        {
          key: `sync:${a.id}`,
          title: `Sync ${a.handle} now`,
          hint: "Action",
          run: () => {
            close();
            startTransition(async () => {
              await syncNowAction(a.id);
              router.refresh();
            });
          },
        },
      ]),
    ];
    return out;
  }, [accounts, brands, close, router]);

  const results = useMemo(() => {
    const scored = commands
      .map((c) => ({ c, score: fuzzyScore(query, `${c.title} ${c.hint}`) }))
      .filter((r): r is { c: Command; score: number } => r.score !== null)
      .sort((a, b) => b.score - a.score);
    return scored.slice(0, 12).map((r) => r.c);
  }, [commands, query]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") close();
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener(OPEN_PALETTE_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(OPEN_PALETTE_EVENT, onOpen);
    };
  }, [close]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center md:items-start md:pt-[15vh]"
      role="dialog"
      aria-modal="true"
      aria-label="Command palette"
    >
      <div className="absolute inset-0 bg-black/40" onClick={close} aria-hidden />
      <div
        data-testid="command-palette"
        className="brand-pop relative z-10 w-full max-w-xl rounded-t-2xl border border-border bg-surface shadow-2xl md:mx-4 md:rounded-2xl"
      >
        <div className="hud-hairline flex items-center gap-2 border-b border-border px-4 py-3">
          <span className="text-accent-strong">✦</span>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActive(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setActive((a) => Math.min(a + 1, results.length - 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setActive((a) => Math.max(a - 1, 0));
              } else if (e.key === "Enter" && results[active]) {
                e.preventDefault();
                void results[active].run();
              }
            }}
            placeholder="Type a command — pages, brands, accounts…"
            data-testid="command-input"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-faint"
          />
          <kbd className="hidden rounded border border-border px-1.5 py-0.5 text-[10px] text-faint md:block">
            esc
          </kbd>
        </div>
        <ul ref={listRef} className="max-h-72 overflow-y-auto p-1.5">
          {results.map((c, i) => (
            <li key={c.key}>
              <button
                type="button"
                onClick={() => void c.run()}
                onPointerEnter={() => setActive(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition",
                  i === active ? "bg-accent-soft text-ink" : "text-muted",
                )}
              >
                <span className="min-w-0 flex-1 truncate">{c.title}</span>
                <span className="shrink-0 text-[10px] uppercase tracking-wide text-faint">
                  {c.hint}
                </span>
              </button>
            </li>
          ))}
          {results.length === 0 && (
            <li className="px-3 py-8 text-center text-xs text-muted">
              Nothing matches — try a page, brand, or account name.
            </li>
          )}
        </ul>
        {pending && (
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted">
            Working…
          </p>
        )}
      </div>
    </div>
  );
}

/** Small trigger for the shell — opens the palette via a window event. */
export function PaletteButton({ compact = false }: { compact?: boolean }) {
  return (
    <button
      type="button"
      aria-label="Open command palette"
      data-testid="command-palette-button"
      onClick={() => window.dispatchEvent(new Event(OPEN_PALETTE_EVENT))}
      className="rounded-lg p-2 text-muted transition hover:bg-surface-2 hover:text-ink"
    >
      <svg
        viewBox="0 0 24 24"
        width={compact ? 20 : 18}
        height={compact ? 20 : 18}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      >
        <circle cx="11" cy="11" r="7" />
        <path strokeLinecap="round" d="m20 20-3.5-3.5" />
      </svg>
    </button>
  );
}
