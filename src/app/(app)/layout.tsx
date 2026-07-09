import type { ReactNode } from "react";
import { SidebarNav } from "@/components/shell/SidebarNav";
import { BottomTabBar } from "@/components/shell/BottomTabBar";
import { TopBar } from "@/components/shell/TopBar";

export default function AppLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <SidebarNav />
      <div className="md:pl-60">
        <TopBar />
        <main className="mx-auto w-full max-w-7xl px-4 pt-4 pb-28 md:px-8 md:pt-8 md:pb-12">
          {children}
        </main>
      </div>
      <BottomTabBar />
    </div>
  );
}
