"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  CalendarRange,
  GalleryVerticalEnd,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Waypoints,
} from "lucide-react";

import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/control", label: "Control", icon: ShieldCheck },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/content", label: "Content", icon: GalleryVerticalEnd },
  { href: "/social", label: "Social", icon: Waypoints },
  { href: "/ai", label: "AI Desk", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-zinc-200 bg-white/95 backdrop-blur">
      <div className="flex items-center gap-3 border-b border-zinc-200 px-5 py-4">
        <div className="flex size-10 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-700">
          <LayoutDashboard className="size-5" />
        </div>
        <div>
          <div className="text-sm font-semibold text-zinc-950">Forex Bot CMS</div>
          <div className="text-xs text-zinc-500">light zinc control room</div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {navItems.map((item) => {
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2 text-sm transition",
                active
                  ? "bg-zinc-950 text-white"
                  : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950"
              )}
            >
              <Icon className="size-4" />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-200 p-4">
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-xs text-zinc-600">
          Parent bot API:
          <div className="mt-1 font-medium text-zinc-900">bot:8788 inside Docker</div>
        </div>
      </div>
    </aside>
  );
}
