import Link from "next/link";
import { loadPendingSelection } from "@/server/actions/oauth-apps";
import { AccountPicker } from "@/components/connections/AccountPicker";
import { Card, CardHeader } from "@/components/ui/primitives";

export const dynamic = "force-dynamic";

/** After a Meta login, one authorization can carry several Pages and
 * Instagram profiles — the owner picks which become Branch accounts. */
export default async function SelectAccountsPage({
  searchParams,
}: {
  searchParams: Promise<{ nonce?: string }>;
}) {
  const { nonce } = await searchParams;
  const pending = nonce ? await loadPendingSelection(nonce) : null;

  return (
    <div className="mx-auto max-w-xl space-y-5 fade-up">
      <div>
        <Link href="/connections" className="text-xs text-muted hover:text-ink">
          ← Connections
        </Link>
        <h1 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">
          Choose accounts
        </h1>
      </div>

      {!pending ? (
        <Card className="p-5">
          <p className="text-sm text-muted">
            This connection link expired or was already used. Head back to the
            wizard and hit <strong>Connect</strong> again.
          </p>
        </Card>
      ) : (
        <Card>
          <CardHeader
            title="Your login found these"
            subtitle="Each one you pick becomes a live Branch account"
          />
          <div className="p-4 md:p-5">
            <AccountPicker
              nonce={nonce!}
              accounts={pending.accounts.map((a) => ({
                key: `${a.platformId}:${a.externalId}`,
                platformId: a.platformId,
                handle: a.handle,
                displayName: a.displayName,
              }))}
            />
          </div>
        </Card>
      )}
    </div>
  );
}
