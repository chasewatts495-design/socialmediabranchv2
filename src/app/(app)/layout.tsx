import type { ReactNode } from "react";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { TopBar } from "@/components/shell/TopBar";
import { getActiveBrandId, listBrands } from "@/lib/brands";
import { getNotifications } from "@/lib/notifications";
import { ensureSeeded } from "@/lib/db/ensure-seeded";

export default async function AppLayout({ children }: { children: ReactNode }) {
  await ensureSeeded();
  const [brands, activeBrandId, notifications] = await Promise.all([
    listBrands(),
    getActiveBrandId(),
    getNotifications(),
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
    </div>
  );
}
