import { desc } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { activityLog } from "@/lib/db/schema";
import { getSetting } from "@/lib/settings";
import { listBrands } from "@/lib/brands";
import { DEFAULT_MODEL, getAiUsageThisMonth } from "@/lib/ai/client";
import { storageMode } from "@/lib/storage";
import { Card, CardHeader, Badge } from "@/components/ui/primitives";
import {
  AnthropicKeyForm,
  DemoControls,
  ModelPicker,
} from "@/components/settings/SettingsForms";
import { BrandManager } from "@/components/settings/BrandManager";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const db = await getDb();
  const [apiKey, model, simulateFailures, lastTick, usage, activity, brands, accountRows] =
    await Promise.all([
      getSetting("anthropic.apiKey"),
      getSetting("ai.model"),
      getSetting("demo.simulateFailures"),
      getSetting("cron.lastTickAt"),
      getAiUsageThisMonth(),
      db.select().from(activityLog).orderBy(desc(activityLog.ts)).limit(15),
      listBrands(),
      db.query.accounts.findMany({ orderBy: (a, { asc }) => asc(a.sortOrder) }),
    ]);

  const keyMasked = apiKey
    ? `sk-ant-…${apiKey.slice(-4)}`
    : null;
  // eslint-disable-next-line react-hooks/purity -- server component; wall-clock staleness is intended
  const tickAge = lastTick ? Date.now() - new Date(lastTick).getTime() : null;
  const tickStale = tickAge === null || tickAge > 15 * 60_000;

  return (
    <div className="mx-auto max-w-3xl space-y-5 fade-up">
      <div>
        <h1 className="text-xl font-semibold tracking-tight md:text-2xl">Settings</h1>
      </div>

      <Card>
        <CardHeader
          title="AI Strategist"
          subtitle="Your Anthropic API key powers the full Claude strategist"
        />
        <div className="space-y-5 p-4 md:p-5">
          <AnthropicKeyForm keyMasked={keyMasked} />
          <div className="border-t border-border pt-4">
            <p className="mb-2 text-sm font-medium">Model</p>
            <ModelPicker current={model ?? DEFAULT_MODEL} />
          </div>
          <div className="border-t border-border pt-4 text-xs text-muted">
            <p className="font-medium text-ink">Usage this month</p>
            {usage ? (
              <p className="mt-1">
                {usage.input.toLocaleString()} input +{" "}
                {usage.output.toLocaleString()} output tokens
                <span className="text-faint">
                  {" "}
                  (billed to your Anthropic account — a typical report costs a
                  few cents)
                </span>
              </p>
            ) : (
              <p className="mt-1">No Claude usage yet this month.</p>
            )}
          </div>
        </div>
      </Card>

      <Card id="brands">
        <CardHeader
          title="Brands"
          subtitle="Group accounts by brand and switch between them from the sidebar"
        />
        <div className="p-4 md:p-5">
          <BrandManager
            brands={brands.map((b) => ({
              id: b.id,
              name: b.name,
              color: b.color,
              isDemo: b.isDemo,
              accountCount: b.accountCount,
            }))}
            accounts={accountRows.map((a) => ({
              id: a.id,
              handle: a.handle,
              platformId: a.platformId,
              brandId: a.brandId,
            }))}
          />
        </div>
      </Card>

      <Card>
        <CardHeader title="Demo data" />
        <div className="p-4 md:p-5">
          <DemoControls simulateFailures={simulateFailures === "true"} />
        </div>
      </Card>

      <Card>
        <CardHeader
          title="System"
          subtitle="Background work, storage, and security status"
        />
        <div className="divide-y divide-border text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div>
              <p className="font-medium">Scheduled work (cron)</p>
              <p className="text-xs text-muted">
                {lastTick
                  ? `Last tick ${relativeTime(lastTick)}`
                  : "No tick recorded yet"}
              </p>
            </div>
            <Badge tone={tickStale ? "warning" : "success"}>
              {tickStale ? "Stale — check cron/pinger" : "Healthy"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div>
              <p className="font-medium">Media storage</p>
              <p className="text-xs text-muted">
                {storageMode() === "blob"
                  ? "Vercel Blob (cloud)"
                  : "Local disk (.data/uploads)"}
              </p>
            </div>
            <Badge>{storageMode()}</Badge>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3 md:px-5">
            <div>
              <p className="font-medium">App password</p>
              <p className="text-xs text-muted">
                Managed via the APP_PASSWORD environment variable
                {process.env.APP_PASSWORD ? "" : " — currently disabled (no password set)"}
              </p>
            </div>
            <Badge tone={process.env.APP_PASSWORD ? "success" : "warning"}>
              {process.env.APP_PASSWORD ? "Enabled" : "Off"}
            </Badge>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader title="Activity log" subtitle="Recent system events" />
        <ul className="divide-y divide-border">
          {activity.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2.5 md:px-5">
              <Badge
                tone={
                  a.level === "error" ? "danger" : a.level === "warn" ? "warning" : "neutral"
                }
              >
                {a.level}
              </Badge>
              <span className="flex-1 truncate text-xs">{a.event}</span>
              <span className="text-[11px] text-faint">{relativeTime(a.ts)}</span>
            </li>
          ))}
          {activity.length === 0 && (
            <li className="px-4 py-6 text-center text-sm text-muted">No events yet.</li>
          )}
        </ul>
      </Card>
    </div>
  );
}
