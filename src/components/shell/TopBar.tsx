"use client";

import Link from "next/link";
import { IconPlug, IconSettings } from "@/components/ui/icons";

/** Mobile-only top bar: brand + shortcuts that don't fit the tab bar. */
export function TopBar() {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          B
        </span>
        <span className="text-sm font-semibold">Branch</span>
      </Link>
      <div className="flex items-center gap-1">
        <Link
          href="/connections"
          aria-label="Connections"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <IconPlug width={20} height={20} />
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <IconSettings width={20} height={20} />
        </Link>
      </div>
    </header>
  );
}
