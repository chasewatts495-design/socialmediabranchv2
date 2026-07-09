"use client";

import { useActionState, useState, useTransition } from "react";
import type { CredentialField, PlatformId } from "@/lib/connectors/types";
import {
  addAccountAction,
  deleteAccountAction,
  saveCredentialsAction,
  testConnectionAction,
} from "@/server/actions/connections";
import type { ActionResult } from "@/server/actions/accounts";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/primitives";

export function AddAccountForm({ platformId }: { platformId: PlatformId }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    addAccountAction.bind(null, platformId),
    null,
  );
  return (
    <form action={action} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Handle / page name
          </span>
          <input
            name="handle"
            required
            placeholder="@yourbrand"
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
            data-testid="add-handle"
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-muted">
            Display name
          </span>
          <input
            name="displayName"
            required
            placeholder="Your Brand"
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 text-sm outline-none placeholder:text-faint focus:border-accent"
          />
        </label>
      </div>
      {state && (
        <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
        data-testid="add-account"
      >
        {pending ? <Spinner className="border-white/40 border-t-white" /> : "Add account"}
      </button>
    </form>
  );
}

export function CredentialForm({
  accountId,
  fields,
  hasCredentials,
}: {
  accountId: string;
  fields: CredentialField[];
  hasCredentials: boolean;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveCredentialsAction.bind(null, accountId),
    null,
  );
  return (
    <form action={action} className="space-y-3">
      {hasCredentials && (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
          Credentials on file (encrypted). Saving again overwrites them.
        </p>
      )}
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="mb-1 block text-xs font-medium text-muted">{f.label}</span>
          <input
            name={f.key}
            type={f.secret ? "password" : "text"}
            autoComplete="off"
            placeholder={f.secret ? "••••••••" : ""}
            className="w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-faint focus:border-accent"
          />
          {f.help && <span className="mt-1 block text-[11px] text-faint">{f.help}</span>}
        </label>
      ))}
      {state && (
        <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:bg-accent-strong disabled:opacity-50"
      >
        {pending ? <Spinner className="border-white/40 border-t-white" /> : "Save credentials"}
      </button>
    </form>
  );
}

export function AccountRowActions({
  accountId,
  canDelete,
}: {
  accountId: string;
  canDelete: boolean;
}) {
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await testConnectionAction(accountId);
            setMessage(res.message ?? null);
          })
        }
        className="rounded-lg border border-border bg-surface-2 px-3 py-1.5 text-xs font-medium hover:bg-surface-3 disabled:opacity-50"
      >
        Test connection
      </button>
      {canDelete &&
        (confirming ? (
          <span className="flex items-center gap-1.5">
            <button
              disabled={pending}
              onClick={() => start(() => deleteAccountAction(accountId))}
              className="rounded-lg bg-danger px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Confirm remove
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted"
            >
              Keep
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="rounded-lg border border-danger/40 px-3 py-1.5 text-xs font-medium text-danger hover:bg-danger-soft"
          >
            Remove
          </button>
        ))}
      {pending && <Spinner />}
      {message && <p className="w-full text-[11px] text-muted">{message}</p>}
    </div>
  );
}
