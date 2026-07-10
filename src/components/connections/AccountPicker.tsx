"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { linkSelectedAccountsAction } from "@/server/actions/oauth-apps";
import { PlatformBadge } from "@/components/dashboard/PlatformBadge";
import { Spinner } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";
import { IconCheck } from "@/components/ui/icons";
import type { PlatformId } from "@/lib/connectors/types";

export interface PickerAccount {
  key: string;
  platformId: PlatformId;
  handle: string;
  displayName: string;
}

export function AccountPicker({
  nonce,
  accounts,
}: {
  nonce: string;
  accounts: PickerAccount[];
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>(accounts.map((a) => a.key));
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const toggle = (key: string) =>
    setSelected((s) =>
      s.includes(key) ? s.filter((k) => k !== key) : [...s, key],
    );

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        {accounts.map((a) => {
          const checked = selected.includes(a.key);
          return (
            <button
              key={a.key}
              type="button"
              onClick={() => toggle(a.key)}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition",
                checked
                  ? "border-accent bg-accent-soft/40"
                  : "border-border bg-surface hover:border-faint",
              )}
            >
              <span
                className={cn(
                  "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border text-white",
                  checked ? "border-accent bg-accent" : "border-faint",
                )}
              >
                {checked && <IconCheck width={12} height={12} />}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">
                  {a.handle}
                </span>
                <PlatformBadge platformId={a.platformId} />
              </span>
            </button>
          );
        })}
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
      <button
        type="button"
        disabled={pending || selected.length === 0}
        data-testid="link-selected"
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await linkSelectedAccountsAction(nonce, selected);
            if (!res.ok) setError(res.message ?? "Something went wrong.");
            else router.push("/connections?connected=multi");
          })
        }
        className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? (
          <Spinner className="border-white/40 border-t-white" />
        ) : (
          `Connect ${selected.length} account${selected.length === 1 ? "" : "s"}`
        )}
      </button>
    </div>
  );
}
