"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/accounts";
import {
  assignAccountBrandAction,
  createBrandAction,
  deleteBrandAction,
  updateBrandAction,
} from "@/server/actions/brands";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/primitives";

export interface ManagedBrand {
  id: string;
  name: string;
  color: string;
  isDemo: boolean;
  accountCount: number;
}

export interface ManagedAccount {
  id: string;
  handle: string;
  platformId: string;
  brandId: string | null;
}

const inputCls =
  "rounded-xl border border-border bg-surface-2 px-3 py-2 text-sm outline-none placeholder:text-faint focus:border-accent";

function BrandRow({
  brand,
  brands,
}: {
  brand: ManagedBrand;
  brands: ManagedBrand[];
}) {
  const [editing, setEditing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [reassignTo, setReassignTo] = useState("");
  const [pending, start] = useTransition();
  const [state, action, savePending] = useActionState<ActionResult | null, FormData>(
    updateBrandAction.bind(null, brand.id),
    null,
  );

  const others = brands.filter((b) => b.id !== brand.id);

  return (
    <div className="rounded-2xl border border-border bg-surface-2 p-3">
      {editing ? (
        <form
          action={action}
          onSubmit={() => setEditing(false)}
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="color"
            name="color"
            defaultValue={brand.color}
            aria-label="Brand color"
            className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-surface"
          />
          <input
            name="name"
            defaultValue={brand.name}
            required
            className={cn(inputCls, "min-w-0 flex-1")}
          />
          <button
            type="submit"
            disabled={savePending}
            className="rounded-lg bg-accent px-3 py-2 text-xs font-semibold text-white hover:bg-accent-strong disabled:opacity-50"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => setEditing(false)}
            className="rounded-lg border border-border px-3 py-2 text-xs text-muted"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="h-3.5 w-3.5 shrink-0 rounded-full"
            style={{ background: brand.color }}
          />
          <span className="min-w-0 flex-1 truncate text-sm font-medium">
            {brand.name}
            {brand.isDemo && (
              <span className="ml-2 text-[11px] font-normal text-faint">
                demo
              </span>
            )}
          </span>
          <span className="text-[11px] text-faint">
            {brand.accountCount} account{brand.accountCount === 1 ? "" : "s"}
          </span>
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted hover:text-ink"
          >
            Edit
          </button>
          {deleting ? (
            <span className="flex w-full flex-wrap items-center gap-2 pt-1 sm:w-auto sm:pt-0">
              {brand.accountCount > 0 && (
                <select
                  value={reassignTo}
                  onChange={(e) => setReassignTo(e.target.value)}
                  aria-label="Move accounts to"
                  className={cn(inputCls, "py-1.5 text-xs")}
                >
                  <option value="">Accounts → no brand</option>
                  {others.map((b) => (
                    <option key={b.id} value={b.id}>
                      Accounts → {b.name}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                disabled={pending}
                onClick={() =>
                  start(async () => {
                    await deleteBrandAction(brand.id, reassignTo || undefined);
                    setDeleting(false);
                  })
                }
                className="rounded-lg bg-danger px-2.5 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                Confirm delete
              </button>
              <button
                type="button"
                onClick={() => setDeleting(false)}
                className="rounded-lg border border-border px-2.5 py-1.5 text-xs text-muted"
              >
                Keep
              </button>
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setDeleting(true)}
              className="rounded-lg border border-danger/40 px-2.5 py-1.5 text-xs text-danger hover:bg-danger-soft"
            >
              Delete
            </button>
          )}
        </div>
      )}
      {state && !state.ok && (
        <p className="mt-2 text-xs text-danger">{state.message}</p>
      )}
    </div>
  );
}

export function BrandManager({
  brands,
  accounts,
}: {
  brands: ManagedBrand[];
  accounts: ManagedAccount[];
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    createBrandAction,
    null,
  );
  const [assignPending, startAssign] = useTransition();

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {brands.map((b) => (
          <BrandRow key={b.id} brand={b} brands={brands} />
        ))}
        {brands.length === 0 && (
          <p className="rounded-2xl border border-dashed border-border p-4 text-sm text-muted">
            No brands yet — create your first one below.
          </p>
        )}
      </div>

      <form
        action={action}
        className="flex flex-wrap items-center gap-2 border-t border-border pt-4"
      >
        <input
          type="color"
          name="color"
          defaultValue="#b08a2e"
          aria-label="New brand color"
          className="h-9 w-9 cursor-pointer rounded-lg border border-border bg-surface"
        />
        <input
          name="name"
          required
          placeholder="New brand name"
          data-testid="new-brand-name"
          className={cn(inputCls, "min-w-0 flex-1")}
        />
        <button
          type="submit"
          disabled={pending}
          data-testid="create-brand"
          className="rounded-xl bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? <Spinner className="border-white/40 border-t-white" /> : "Create brand"}
        </button>
        {state && (
          <p
            className={cn(
              "w-full text-xs",
              state.ok ? "text-success" : "text-danger",
            )}
          >
            {state.message}
          </p>
        )}
      </form>

      {accounts.length > 0 && brands.length > 0 && (
        <div className="border-t border-border pt-4">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-faint">
            Which brand owns each account
          </p>
          <div className={cn("space-y-1.5", assignPending && "opacity-60")}>
            {accounts.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <span className="min-w-0 flex-1 truncate">
                  {a.handle}
                  <span className="ml-1.5 text-[11px] text-faint">
                    {a.platformId}
                  </span>
                </span>
                <select
                  value={a.brandId ?? ""}
                  aria-label={`Brand for ${a.handle}`}
                  onChange={(e) =>
                    startAssign(async () => {
                      await assignAccountBrandAction(
                        a.id,
                        e.target.value || null,
                      );
                    })
                  }
                  className={cn(inputCls, "py-1.5 text-xs")}
                >
                  <option value="">No brand</option>
                  {brands.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
