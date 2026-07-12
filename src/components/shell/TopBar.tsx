"use client";

import Link from "next/link";
import { IconPlug, IconRadar, IconSettings } from "@/components/ui/icons";
import { BrandSwitcher, type BrandOption } from "./BrandSwitcher";
import { NotificationsBell } from "./NotificationsBell";
import { PaletteButton } from "./CommandPalette";
import type { NotificationsData } from "@/lib/notifications";

/** Mobile-only top bar: brand switcher + shortcuts that don't fit the tab bar. */
export function TopBar({
  brands,
  activeBrandId,
  notifications,
}: {
  brands: BrandOption[];
  activeBrandId: string;
  notifications: NotificationsData;
}) {
  return (
    <header className="sticky top-0 z-20 flex items-center gap-2 border-b border-border bg-bg/90 px-4 py-3 backdrop-blur md:hidden">
      <Link href="/" className="flex shrink-0 items-center" aria-label="Home">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-sm font-bold text-white">
          B
        </span>
      </Link>
      <div className="min-w-0 flex-1 max-w-56">
        <BrandSwitcher brands={brands} activeBrandId={activeBrandId} compact />
      </div>
      <div className="flex shrink-0 items-center gap-0.5">
        <PaletteButton compact />
        <NotificationsBell
          items={notifications.items}
          unreadCount={notifications.unreadCount}
          compact
        />
        <Link
          href="/trends"
          aria-label="Trend Radar"
          className="rounded-lg p-2 text-muted hover:bg-surface-2 hover:text-ink"
        >
          <IconRadar width={20} height={20} />
        </Link>
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
