"use client";

import { useActionState, useState, useTransition } from "react";
import type { ActionResult } from "@/server/actions/accounts";
import {
  deleteOAuthAppAction,
  saveOAuthAppAction,
} from "@/server/actions/oauth-apps";
import { Badge, Spinner } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

const inputCls =
  "w-full rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-faint focus:border-accent";

function CopyField({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div>
      <p className="mb-1 text-xs font-medium text-muted">{label}</p>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 truncate rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs">
          {value}
        </code>
        <button
          type="button"
          onClick={async () => {
            await navigator.clipboard.writeText(value);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
          className="shrink-0 rounded-lg border border-border px-3 py-2 text-xs font-medium hover:bg-surface-2"
        >
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>
    </div>
  );
}

/**
 * The "developer app" step of a live connection: paste the app's Client
 * ID + Secret (stored encrypted), copy the exact redirect URI the
 * platform needs, then open the platform's own login window.
 */
export function OAuthConnectCard({
  provider,
  providerName,
  credsSource,
  redirectUri,
  connectHint,
}: {
  provider: string;
  providerName: string;
  credsSource: "settings" | "env" | null;
  redirectUri: string;
  connectHint?: string;
}) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveOAuthAppAction.bind(null, provider),
    null,
  );
  const [deleting, startDelete] = useTransition();
  const hasCreds = credsSource !== null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Badge tone={hasCreds ? "success" : "warning"}>
          {credsSource === "settings"
            ? "App keys saved"
            : credsSource === "env"
              ? "App keys from environment"
              : "App keys needed"}
        </Badge>
      </div>

      <CopyField
        label={`Redirect URI — paste this into your ${providerName} app settings`}
        value={redirectUri}
      />

      <form action={action} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Client ID {credsSource === "settings" && "(saved)"}
            </span>
            <input
              name="clientId"
              autoComplete="off"
              placeholder={hasCreds ? "••••••••" : "From your app's settings page"}
              className={inputCls}
              data-testid={`oauth-client-id-${provider}`}
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-muted">
              Client Secret {credsSource === "settings" && "(saved)"}
            </span>
            <input
              name="clientSecret"
              type="password"
              autoComplete="off"
              placeholder={hasCreds ? "••••••••" : "Kept encrypted at rest"}
              className={inputCls}
            />
          </label>
        </div>
        {state && (
          <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>
            {state.message}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-xl border border-border bg-surface-2 px-4 py-2.5 text-sm font-medium transition hover:bg-surface-3 disabled:opacity-50"
          >
            {pending ? <Spinner /> : hasCreds ? "Replace app keys" : "Save app keys"}
          </button>
          {credsSource === "settings" && (
            <button
              type="button"
              disabled={deleting}
              onClick={() => startDelete(() => void deleteOAuthAppAction(provider))}
              className="rounded-xl border border-danger/40 px-4 py-2.5 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
            >
              Remove
            </button>
          )}
        </div>
      </form>

      <div className="border-t border-border pt-4">
        {hasCreds ? (
          <a
            href={`/api/oauth/${provider}/start`}
            data-testid={`oauth-connect-${provider}`}
            className="inline-flex w-full items-center justify-center rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition hover:bg-accent-strong md:w-auto"
          >
            Connect with {providerName} →
          </a>
        ) : (
          <p className="text-xs text-muted">
            Save your app keys above, then the <strong>Connect</strong> button
            appears here — it opens {providerName}&apos;s own login page, so your
            password never touches Branch.
          </p>
        )}
        {connectHint && (
          <p className="mt-2 text-[11px] text-faint">{connectHint}</p>
        )}
      </div>
    </div>
  );
}
