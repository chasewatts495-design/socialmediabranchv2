"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav";
import { cn } from "@/components/ui/cn";
import {
  IconCalendar,
  IconCompose,
  IconHome,
  IconLibrary,
  IconPlug,
  IconSettings,
  IconSparkles,
} from "@/components/ui/icons";

const ICONS = {
  home: IconHome,
  calendar: IconCalendar,
  compose: IconCompose,
  library: IconLibrary,
  sparkles: IconSparkles,
  plug: IconPlug,
  settings: IconSettings,
};

export function SidebarNav() {
  const pathname = usePathname();

  return (
    <aside
      data-testid="sidebar-nav"
      className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-surface md:flex"
    >
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-lg font-bold text-white">
          B
        </div>
        <div>
          <p className="text-sm font-semibold leading-tight">Branch</p>
          <p className="text-[11px] text-faint">Social command center</p>
        </div>
      </div>

      <nav className="mt-2 flex-1 space-y-1 px-3">
        {NAV_ITEMS.map((item) => {
          const Icon = ICONS[item.icon];
          const active =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                active
                  ? "bg-accent-soft font-medium text-accent-strong"
                  : "text-muted hover:bg-surface-2 hover:text-ink",
              )}
            >
              <Icon width={18} height={18} />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 text-[11px] text-faint">
        Demo data until accounts are connected
      </div>
    </aside>
  );
}
