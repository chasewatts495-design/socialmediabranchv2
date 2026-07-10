import type { ReactNode } from "react";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { TopBar } from "@/components/shell/TopBar";
import { CommandPalette } from "@/components/shell/CommandPalette";
import { getActiveBrandId, listBrands } from "@/lib/brands";
import { getNotifications } from "@/lib/notifications";
import { getDb } from "@/lib/db/client";
import { ensureSeeded } from "@/lib/db/ensure-seeded";
import type { PlatformId } from "@/lib/connectors/types";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const db = await getDb();
  const [brands, activeBrandId, notifications, paletteAccounts] =
    await Promise.all([
      listBrands(),
      getActiveBrandId(),
      getNotifications(),
      db.query.accounts.findMany({
        columns: { id: true, handle: true, platformId: true },
        orderBy: (a, { asc }) => asc(a.sortOrder),
      }),
    ]);
  const brandOptions = brands.map((b) => ({
    id: b.id,
    name: b.name,
    color: b.color,
    accountCount: b.accountCount,
  }));

  return (
    <div className="min-h-dvh">
      <SidebarNav
        brands={brandOptions}
        activeBrandId={activeBrandId}
        notifications={notifications}
      />
      <div className="md:pl-60">
        <TopBar
          brands={brandOptions}
          activeBrandId={activeBrandId}
          notifications={notifications}
        />
        <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>
      <BottomTabBar />
      <CommandPalette
        accounts={paletteAccounts.map((a) => ({
          id: a.id,
          handle: a.handle,
          platformId: a.platformId as PlatformId,
        }))}
        brands={brandOptions.map((b) => ({ id: b.id, name: b.name }))}
      />
    </div>
  );
}
