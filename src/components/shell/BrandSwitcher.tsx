"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/components/ui/cn";
import { switchBrandAction } from "@/server/actions/brands";

export interface BrandOption {
  id: string;
  name: string;
  color: string;
  accountCount: number;
}

export function BrandSwitcher({
  brands,
  activeBrandId,
  compact = false,
}: {
  brands: BrandOption[];
  activeBrandId: string; // brand id or "all"
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
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

  const active = brands.find((b) => b.id === activeBrandId);
  const label = active ? active.name : "All brands";
  const dotColor = active?.color;

  const choose = (id: string) => {
    setOpen(false);
    if (id === activeBrandId) return;
    startTransition(async () => {
      await switchBrandAction(id);
      router.refresh();
    });
  };

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        data-testid="brand-switcher"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center gap-2 rounded-xl border border-border bg-surface-2 text-left transition hover:border-accent/50",
          compact ? "px-2.5 py-1.5" : "px-3 py-2",
          pending && "opacity-60",
        )}
      >
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={
            dotColor
              ? { background: dotColor }
              : {
                  background:
                    "conic-gradient(from 0deg, #b08a2e, #8f6f22, #d4b458, #b08a2e)",
                }
          }
        />
        <span
          className={cn(
            "min-w-0 flex-1 truncate font-medium",
            compact ? "text-xs" : "text-sm",
          )}
        >
          {label}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          aria-hidden
          className={cn(
            "shrink-0 text-faint transition-transform duration-150",
            open && "rotate-180",
          )}
        >
          <path
            d="M2.5 4.5 6 8l3.5-3.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute left-0 right-0 z-50 mt-1.5 min-w-52 origin-top rounded-xl border border-border bg-surface p-1 shadow-xl brand-pop"
        >
          <button
            type="button"
            role="option"
            aria-selected={activeBrandId === "all"}
            data-testid="brand-option-all"
            onClick={() => choose("all")}
            className={cn(
              "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2",
              activeBrandId === "all" && "bg-accent-soft font-medium",
            )}
          >
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{
                background:
                  "conic-gradient(from 0deg, #b08a2e, #8f6f22, #d4b458, #b08a2e)",
              }}
            />
            <span className="flex-1">All brands</span>
            <span className="text-[11px] text-faint">
              {brands.reduce((n, b) => n + b.accountCount, 0)}
            </span>
          </button>
          {brands.map((b) => (
            <button
              key={b.id}
              type="button"
              role="option"
              aria-selected={activeBrandId === b.id}
              data-testid={`brand-option-${b.id}`}
              onClick={() => choose(b.id)}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-sm transition hover:bg-surface-2",
                activeBrandId === b.id && "bg-accent-soft font-medium",
              )}
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: b.color }}
              />
              <span className="min-w-0 flex-1 truncate">{b.name}</span>
              <span className="text-[11px] text-faint">{b.accountCount}</span>
            </button>
          ))}
          <div className="mt-1 border-t border-border pt-1">
            <Link
              href="/settings#brands"
              onClick={() => setOpen(false)}
              className="block rounded-lg px-2.5 py-2 text-sm text-muted transition hover:bg-surface-2 hover:text-ink"
            >
              Manage brands…
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
