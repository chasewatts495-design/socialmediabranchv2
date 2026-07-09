"use client";

import { useActionState, useState, useTransition } from "react";
import {
  deleteAnthropicKeyAction,
  saveAnthropicKeyAction,
  setAiModelAction,
  testAnthropicKeyAction,
} from "@/server/actions/ai";
import {
  reseedDemoDataAction,
  toggleSimulateFailuresAction,
} from "@/server/actions/settings";
import type { ActionResult } from "@/server/actions/accounts";
import { AI_MODELS } from "@/lib/ai/models";
import { cn } from "@/components/ui/cn";
import { Spinner } from "@/components/ui/primitives";

export function AnthropicKeyForm({ keyMasked }: { keyMasked: string | null }) {
  const [state, action, pending] = useActionState<ActionResult | null, FormData>(
    saveAnthropicKeyAction,
    null,
  );
  const [testResult, setTestResult] = useState<string | null>(null);
  const [busy, start] = useTransition();

  return (
    <div className="space-y-3">
      {keyMasked ? (
        <p className="rounded-lg bg-success-soft px-3 py-2 text-xs text-success">
          Key on file: <span className="font-mono">{keyMasked}</span> (encrypted at rest)
        </p>
      ) : (
        <p className="rounded-lg bg-info-soft px-3 py-2 text-xs text-info">
          No key yet — the strategist runs in demo mode. Create one at{" "}
          <span className="font-mono">console.anthropic.com</span> → API keys.
        </p>
      )}
      <form action={action} className="flex flex-wrap items-center gap-2">
        <input
          name="apiKey"
          type="password"
          autoComplete="off"
          placeholder="sk-ant-…"
          className="min-w-64 flex-1 rounded-xl border border-border bg-surface-2 px-3 py-2.5 font-mono text-sm outline-none placeholder:text-faint focus:border-accent"
        />
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-strong disabled:opacity-50"
        >
          {pending ? <Spinner className="border-white/40 border-t-white" /> : "Save key"}
        </button>
      </form>
      <div className="flex flex-wrap items-center gap-2">
        <button
          disabled={busy || !keyMasked}
          onClick={() =>
            start(async () => {
              const res = await testAnthropicKeyAction();
              setTestResult(res.message ?? null);
            })
          }
          className="rounded-xl border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:bg-surface-3 disabled:opacity-50"
        >
          Test key
        </button>
        {keyMasked && (
          <button
            disabled={busy}
            onClick={() => start(() => deleteAnthropicKeyAction())}
            className="rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft disabled:opacity-50"
          >
            Remove key
          </button>
        )}
        {busy && <Spinner />}
      </div>
      {state && (
        <p className={cn("text-xs", state.ok ? "text-success" : "text-danger")}>
          {state.message}
        </p>
      )}
      {testResult && <p className="text-xs text-muted">{testResult}</p>}
    </div>
  );
}

export function ModelPicker({ current }: { current: string }) {
  const [busy, start] = useTransition();
  return (
    <div className="space-y-2">
      {AI_MODELS.map((m) => (
        <button
          key={m.id}
          disabled={busy}
          onClick={() => start(() => setAiModelAction(m.id))}
          className={cn(
            "flex w-full items-center gap-3 rounded-xl border p-3 text-left text-sm transition",
            current === m.id
              ? "border-accent bg-accent-soft/40"
              : "border-border bg-surface-2 hover:border-faint",
          )}
        >
          <span
            className={cn(
              "h-3.5 w-3.5 rounded-full border-2",
              current === m.id ? "border-accent bg-accent" : "border-faint",
            )}
          />
          <span className="flex-1">{m.label}</span>
          <span className="font-mono text-[11px] text-faint">{m.id}</span>
        </button>
      ))}
    </div>
  );
}

export function DemoControls({ simulateFailures }: { simulateFailures: boolean }) {
  const [busy, start] = useTransition();
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Simulate publish failures</p>
          <p className="text-xs text-muted">
            ~1 in 6 demo publishes fails with a retryable error so you can see
            the queue's retry flow.
          </p>
        </div>
        <button
          disabled={busy}
          onClick={() => start(() => toggleSimulateFailuresAction())}
          aria-pressed={simulateFailures}
          className={cn(
            "relative h-7 w-12 shrink-0 rounded-full transition",
            simulateFailures ? "bg-accent" : "bg-surface-3",
          )}
        >
          <span
            className={cn(
              "absolute top-1 h-5 w-5 rounded-full bg-white transition-all",
              simulateFailures ? "left-6" : "left-1",
            )}
          />
        </button>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border pt-4">
        <div>
          <p className="text-sm font-medium">Re-seed demo data</p>
          <p className="text-xs text-muted">
            Wipes all demo/manual accounts (including manually entered stats)
            and regenerates fresh sample data. Your uploaded media stays.
          </p>
        </div>
        {confirming ? (
          <span className="flex shrink-0 items-center gap-1.5">
            <button
              disabled={busy}
              onClick={() =>
                start(async () => {
                  await reseedDemoDataAction();
                  setConfirming(false);
                })
              }
              className="rounded-lg bg-danger px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {busy ? <Spinner className="border-white/40 border-t-white" /> : "Yes, re-seed"}
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="rounded-lg border border-border px-3 py-2 text-xs text-muted"
            >
              Cancel
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="shrink-0 rounded-xl border border-danger/40 px-4 py-2 text-sm font-medium text-danger hover:bg-danger-soft"
          >
            Re-seed…
          </button>
        )}
      </div>
    </div>
  );
}
