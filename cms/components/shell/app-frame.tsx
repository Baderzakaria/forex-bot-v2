"use client";

import { usePathname } from "next/navigation";

import { MobileNav } from "@/components/shell/mobile-nav";
import { Sidebar } from "@/components/shell/sidebar";

export function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  if (pathname === "/sign-in") {
    return <main className="min-h-screen">{children}</main>;
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-[280px_1fr]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>
      <main className="min-h-screen">
        <MobileNav />
        {children}
      </main>
    </div>
  );
}
