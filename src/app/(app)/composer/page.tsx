import { ArcRings } from "@/components/hud/ArcRings";
import { getLibraryAssets } from "@/lib/db/library-queries";
import {
  getBestHours,
  getComposerAccounts,
  getDraftInitial,
} from "@/lib/db/composer-queries";
import { brandScope, getActiveBrandId } from "@/lib/brands";
import {
  ComposerClient,
  type ComposerInitial,
} from "@/components/composer/ComposerClient";

export const dynamic = "force-dynamic";

export default async function ComposerPage({
  searchParams,
}: {
  searchParams: Promise<{ draft?: string; media?: string }>;
}) {
  const { draft, media } = await searchParams;
  const [accounts, assets] = await Promise.all([
    getComposerAccounts(brandScope(await getActiveBrandId())),
    getLibraryAssets(),
  ]);
  const bestHours = await getBestHours(accounts.map((a) => a.id));

  let initial: ComposerInitial = {};
  if (draft) {
    initial = (await getDraftInitial(draft)) ?? {};
  } else if (media) {
    initial = { mediaIds: assets.some((a) => a.id === media) ? [media] : [] };
  }

  return (
    <div className="fade-up">
      <div className="mb-6 flex items-center gap-3">
        <ArcRings className="h-9 w-9 md:h-10 md:w-10" />
        <div>
          <h1 className="text-xl font-semibold tracking-tight md:text-2xl">
            Compose
          </h1>
          <p className="mt-0.5 text-xs text-muted md:text-sm">
            One post, every platform — Branch adapts the caption and checks
            each network&apos;s rules before anything goes out.
          </p>
        </div>
      </div>
      <ComposerClient
        accounts={accounts}
        assets={assets}
        initial={initial}
        bestHours={bestHours}
      />
    </div>
  );
}
