"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { cn } from "@/components/ui/cn";

/** Mobile: segmented Chat|Reports. Desktop: side-by-side columns. */
export function StrategistTabs({
  chat,
  reports,
}: {
  chat: ReactNode;
  reports: ReactNode;
}) {
  const [tab, setTab] = useState<"chat" | "reports">("chat");

  return (
    <div>
      <div className="mb-4 flex rounded-xl border border-border bg-surface-2 p-0.5 lg:hidden">
        {(
          [
            ["chat", "Chat"],
            ["reports", "Reports & Ad Builder"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              "flex-1 rounded-[10px] px-3 py-2 text-sm font-medium transition",
              tab === key ? "bg-accent text-white" : "text-muted",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
        <div
          className={cn(
            "rounded-2xl border border-border bg-surface",
            tab !== "chat" && "hidden lg:block",
          )}
        >
          {chat}
        </div>
        <div className={cn(tab !== "reports" && "hidden lg:block")}>{reports}</div>
      </div>
    </div>
  );
}
