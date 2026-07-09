"use client";

import { useActionState, useState } from "react";
import {
  addManualStatAction,
  type ActionResult,
} from "@/server/actions/accounts";
import { cn } from "@/components/ui/cn";

const FIELDS = [
  { key: "followers", label: "Followers" },
  { key: "impressions", label: "Views / impressions" },
  { key: "reach", label: "Reach" },
  { key: "engagements", label: "Engagements" },
  { key: "likes", label: "Likes" },
  { key: "comments", label: "Comments" },
  { key: "shares", label: "Shares" },
  { key: "videoViews", label: "Video views" },
];

export function ManualStatsForm({ accountId }: { accountId: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(
    addManualStatAction.bind(null, accountId),
    null,
  );

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          "rounded-xl px-4 py-2 text-sm font-medium transition",
          open
            ? "bg-surface-3 text-ink"
            : "bg-accent text-white hover:bg-accent-strong",
        )}
      >
        {open ? "Close" : "Add stats"}
      </button>

      {open && (
        <form
          action={formAction}
          className="mt-4 rounded-2xl border border-border bg-surface-2 p-4 fade-up"
        >
          <p className="mb-3 text-xs text-muted">
            Copy the numbers from the platform's own insights screen. Existing
            entries for the same date are overwritten.
          </p>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <label className="col-span-2 block md:col-span-4">
              <span className="mb-1 block text-xs font-medium text-muted">Date</span>
              <input
                type="date"
                name="date"
                required
                defaultValue={new Date().toISOString().slice(0, 10)}
                className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
              />
            </label>
            {FIELDS.map((f) => (
              <label key={f.key} className="block">
                <span className="mb-1 block text-xs font-medium text-muted">
                  {f.label}
                </span>
                <input
                  type="number"
                  name={f.key}
                  min={0}
                  inputMode="numeric"
                  className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm outline-none focus:border-accent"
                />
              </label>
            ))}
          </div>
          {state && (
            <p
              className={cn(
                "mt-3 text-xs",
                state.ok ? "text-success" : "text-danger",
              )}
            >
              {state.message}
            </p>
          )}
          <button
            type="submit"
            disabled={pending}
            className="mt-4 rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
          >
            {pending ? "Saving…" : "Save stats"}
          </button>
        </form>
      )}
    </div>
  );
}
