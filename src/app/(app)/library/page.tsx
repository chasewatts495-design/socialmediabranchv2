import Link from "next/link";
import { getDrafts, getLibraryAssets } from "@/lib/db/library-queries";
import { storageMode } from "@/lib/storage";
import { AssetGrid } from "@/components/library/AssetGrid";
import { UploadButton } from "@/components/library/UploadButton";
import { Card, CardHeader } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/relative-time";

export const dynamic = "force-dynamic";

export default async function LibraryPage() {
  const [assets, drafts] = await Promise.all([getLibraryAssets(), getDrafts()]);

  return (
    <div className="space-y-6 fade-up">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Library
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-sm">
            {assets.length} assets · reusable across every platform
          </p>
        </div>
        <UploadButton mode={storageMode()} />
      </div>

      <AssetGrid assets={assets} />

      <Card>
        <CardHeader
          title="Drafts"
          subtitle="Unfinished posts — pick up where you left off"
        />
        {drafts.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted">
            No drafts. Start one in the composer and save it for later.
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {drafts.map((d) => (
              <li key={d.id}>
                <Link
                  href={`/composer?draft=${d.id}`}
                  className="flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2/50 md:px-5"
                >
                  {d.thumbnailUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={d.thumbnailUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-cover"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-surface-3 text-xs text-faint">
                      Aa
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm">{d.caption}</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      {d.targetCount} account{d.targetCount === 1 ? "" : "s"} ·
                      edited {relativeTime(d.updatedAt)}
                    </p>
                  </div>
                  <span className="text-xs font-medium text-accent-strong">
                    Resume →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
