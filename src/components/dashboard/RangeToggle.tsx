"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/components/ui/cn";

const RANGES = [7, 30, 90];

export function RangeToggle({ current }: { current: number }) {
  const pathname = usePathname();
  return (
    <div className="flex rounded-xl border border-border bg-surface-2 p-0.5">
      {RANGES.map((r) => (
        <Link
          key={r}
          href={`${pathname}?range=${r}`}
          className={cn(
            "rounded-[10px] px-3 py-1.5 text-xs font-medium transition",
            current === r
              ? "bg-accent text-white"
              : "text-muted hover:text-ink",
          )}
        >
          {r}d
        </Link>
      ))}
    </div>
  );
}
