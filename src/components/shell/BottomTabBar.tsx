"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";
import {
  IconCalendar,
  IconCompose,
  IconHome,
  IconLibrary,
  IconSparkles,
} from "@/components/ui/icons";

const TABS = [
  { href: "/", label: "Home", Icon: IconHome },
  { href: "/calendar", label: "Calendar", Icon: IconCalendar },
  { href: "/composer", label: "Compose", Icon: IconCompose, primary: true },
  { href: "/library", label: "Library", Icon: IconLibrary },
  { href: "/strategist", label: "AI", Icon: IconSparkles },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-testid="bottom-tab-bar"
      className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="grid grid-cols-5">
        {TABS.map(({ href, label, Icon, primary }) => {
          const active =
            href === "/" ? pathname === "/" : pathname.startsWith(href);
          if (primary) {
            return (
              <Link
                key={href}
                href={href}
                aria-label={label}
                className="flex items-center justify-center py-2"
              >
                <span
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-2xl text-white shadow-lg transition",
                    active ? "bg-accent-strong" : "bg-accent",
                  )}
                >
                  <Icon width={22} height={22} />
                </span>
              </Link>
            );
          }
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-14 flex-col items-center justify-center gap-0.5 text-[10px]",
                active ? "text-accent-strong" : "text-muted",
              )}
            >
              <Icon width={20} height={20} />
              {label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
