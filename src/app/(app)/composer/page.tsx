import { getLibraryAssets } from "@/lib/db/library-queries";
import {
  getComposerAccounts,
  getDraftInitial,
} from "@/lib/db/composer-queries";
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
    getComposerAccounts(),
    getLibraryAssets(),
  ]);

  let initial: ComposerInitial = {};
  if (draft) {
    initial = (await getDraftInitial(draft)) ?? {};
  } else if (media) {
    initial = { mediaIds: assets.some((a) => a.id === media) ? [media] : [] };
  }

  return (
    <div className="fade-up">
      <h1 className="mb-1 text-xl font-semibold tracking-tight md:text-2xl">
        Compose
      </h1>
      <p className="mb-6 text-xs text-muted md:text-sm">
        One post, every platform — Branch adapts the caption and checks each
        network&apos;s rules before anything goes out.
      </p>
      <ComposerClient accounts={accounts} assets={assets} initial={initial} />
    </div>
  );
}
