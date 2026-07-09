import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db/client";
import { PLATFORM_DEFS } from "@/lib/connectors/registry";
import { PLATFORM_IDS, type PlatformId } from "@/lib/connectors/types";
import { Badge, Card, CardHeader } from "@/components/ui/primitives";
import { AccountAvatar } from "@/components/dashboard/AccountAvatar";
import { ModeChip } from "@/components/dashboard/PlatformBadge";
import {
  AccountRowActions,
  AddAccountForm,
  CredentialForm,
} from "@/components/connections/ConnectionForms";

export const dynamic = "force-dynamic";

export default async function PlatformWizardPage({
  params,
}: {
  params: Promise<{ platformId: string }>;
}) {
  const { platformId } = await params;
  if (!PLATFORM_IDS.includes(platformId as PlatformId)) notFound();
  const pid = platformId as PlatformId;
  const caps = PLATFORM_DEFS[pid].capabilities;

  const db = await getDb();
  const accounts = await db.query.accounts.findMany({
    where: (a, { eq }) => eq(a.platformId, pid),
    with: { credential: true },
    orderBy: (a, { asc }) => asc(a.sortOrder),
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5 fade-up">
      <div>
        <Link href="/connections" className="text-xs text-muted hover:text-ink">
          ← Connections
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          {caps.displayName}
        </h1>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <Badge
            tone={
              caps.access.costTier === "free"
                ? "success"
                : caps.access.costTier === "paid"
                  ? "warning"
                  : caps.access.costTier === "unavailable"
                    ? "danger"
                    : "info"
            }
          >
            {caps.access.costTier === "unavailable"
              ? "No public API"
              : `${caps.access.costTier} API`}
          </Badge>
          <Badge tone={caps.canPublish ? "success" : "warning"}>
            {caps.canPublish ? "Auto-posting" : "Manual posting"}
          </Badge>
          <Badge tone={caps.canFetchAccountStats ? "success" : "neutral"}>
            {caps.canFetchAccountStats ? "Full analytics" : "Limited analytics"}
          </Badge>
        </div>
      </div>

      <Card className="p-4 md:p-5">
        <h2 className="text-sm font-semibold">The honest version</h2>
        <p className="mt-1 text-xs text-muted">{caps.access.approval}</p>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-xs text-muted">
          {caps.access.notes.map((n, i) => (
            <li key={i}>{n}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <CardHeader
          title="Setup steps"
          subtitle="Exact clicks — budget a few minutes"
        />
        <ol className="space-y-0 divide-y divide-border">
          {caps.wizardSteps.map((step, i) => (
            <li key={i} className="flex gap-3 px-4 py-3 md:px-5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent-strong">
                {i + 1}
              </span>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Card>

      <Card>
        <CardHeader
          title={`Your ${caps.displayName} accounts`}
          subtitle={
            accounts.length
              ? "Test, connect, or remove accounts"
              : "Add your first account — it works instantly with demo data"
          }
        />
        <div className="space-y-4 p-4 md:p-5">
          {accounts.map((a) => (
            <div key={a.id} className="rounded-2xl border border-border bg-surface-2 p-3">
              <div className="flex items-center gap-3">
                <AccountAvatar name={a.displayName} color={a.avatarColor} size={32} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{a.handle}</p>
                  <ModeChip mode={a.mode} />
                </div>
                <Link
                  href={`/accounts/${a.id}`}
                  className="text-xs font-medium text-accent-strong hover:underline"
                >
                  Analytics →
                </Link>
              </div>
              <div className="mt-3">
                <AccountRowActions accountId={a.id} canDelete />
              </div>
              {caps.auth.credentialFields.length > 0 && (
                <details className="mt-3 border-t border-border pt-3">
                  <summary className="cursor-pointer text-xs font-medium text-muted">
                    API credentials {a.credential ? "(saved)" : "(not set)"}
                  </summary>
                  <div className="mt-3">
                    <CredentialForm
                      accountId={a.id}
                      fields={caps.auth.credentialFields}
                      hasCredentials={Boolean(a.credential)}
                    />
                  </div>
                </details>
              )}
            </div>
          ))}

          <div className={accounts.length ? "border-t border-border pt-4" : ""}>
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-faint">
              Add {accounts.length ? "another" : "an"} account
            </h3>
            <AddAccountForm platformId={pid} />
          </div>
        </div>
      </Card>

      {pid === "snapchat" && (
        <Card className="p-4 md:p-5">
          <h2 className="text-sm font-semibold">Recording Snapchat stats</h2>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Open the account&apos;s analytics page and use <strong>Add stats</strong>{" "}
            for quick entries, or import a CSV export. Composing a post that
            includes Snapchat creates a &ldquo;post manually&rdquo; checklist item in the
            queue with your caption and media ready to copy.
          </p>
        </Card>
      )}
    </div>
  );
}
