import Link from "next/link";
import type { GoLiveState } from "@/lib/golive";
import { dismissGoLiveAction } from "@/server/actions/golive";
import { Card, CardHeader } from "@/components/ui/primitives";
import { cn } from "@/components/ui/cn";

/**
 * The path from demo to fully live, driven by real state. Auto-hides
 * once everything is done; dismissible any time.
 */
export function GoLiveChecklist({ state }: { state: GoLiveState }) {
  if (state.dismissed || state.doneCount === state.steps.length) return null;

  return (
    <Card data-testid="golive-checklist">
      <CardHeader
        title={`Go fully live — ${state.doneCount}/${state.steps.length} done`}
        subtitle="Each step links to the exact place to do it"
        action={
          <form action={dismissGoLiveAction}>
            <button
              type="submit"
              className="text-[11px] font-medium text-faint hover:text-muted"
            >
              Dismiss
            </button>
          </form>
        }
      />
      <ol className="grid gap-0 divide-y divide-border md:grid-cols-2 md:divide-y-0">
        {state.steps.map((step, i) => (
          <li key={step.key}>
            <Link
              href={step.href}
              className={cn(
                "flex items-start gap-3 px-4 py-3 transition hover:bg-surface-2 md:px-5",
                step.done && "opacity-60",
              )}
            >
              <span
                className={cn(
                  "mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold",
                  step.done
                    ? "border-accent bg-accent text-white"
                    : "border-border bg-surface text-muted",
                )}
              >
                {step.done ? "✓" : i + 1}
              </span>
              <span className="min-w-0">
                <span
                  className={cn(
                    "block text-sm font-medium",
                    step.done && "line-through decoration-accent/60",
                  )}
                >
                  {step.title}
                </span>
                <span className="mt-0.5 block text-xs text-muted">
                  {step.detail}
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </Card>
  );
}
