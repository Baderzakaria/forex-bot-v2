"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Brain,
  CalendarRange,
  CreditCard,
  GalleryVerticalEnd,
  LayoutDashboard,
  Settings2,
  ShieldCheck,
  Users,
  Waypoints,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/control", label: "Control", icon: ShieldCheck },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/content", label: "Content", icon: GalleryVerticalEnd },
  { href: "/social", label: "Social", icon: Waypoints },
  { href: "/ai", label: "AI Desk", icon: Brain },
  { href: "/members", label: "Members", icon: Users },
  { href: "/payments", label: "Payments", icon: CreditCard },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-full w-full flex-col border-r border-[color:rgba(255,255,255,0.08)] bg-[var(--fx-ops-ink)] text-[var(--fx-white)] backdrop-blur">
      <div className="border-b border-[color:rgba(255,255,255,0.08)] px-5 py-5">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-[18px] bg-[var(--fx-sage)] text-[var(--fx-ops-ink)] shadow-[0_10px_24px_rgba(0,0,0,0.16)]">
            <LayoutDashboard className="size-5" />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold tracking-[-0.02em] text-white">
              Forex Control Room
            </div>
            <div className="text-xs text-white/65">CMS / Telegram ops</div>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          <Badge className="border-white/10 bg-white/10 text-white">Live</Badge>
          <span className="text-xs text-white/60">Warm canvas, dark rail, guarded send flow</span>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4">
        {navItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-[18px] border px-3 py-2.5 text-sm transition",
                active
                  ? "border-white/10 bg-white/10 text-white shadow-[0_10px_24px_rgba(0,0,0,0.16)]"
                  : "border-transparent text-white/72 hover:border-white/10 hover:bg-white/6 hover:text-white"
              )}
            >
              <Icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {active ? (
                <span className="rounded-full bg-[var(--fx-sage)] px-2 py-0.5 text-[11px] font-semibold text-[var(--fx-ops-ink)]">
                  Active
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-[color:rgba(255,255,255,0.08)] p-4">
        <div className="rounded-[22px] border border-white/10 bg-white/[0.06] px-4 py-4 text-xs text-white/72 shadow-[0_14px_28px_rgba(0,0,0,0.12)]">
          <div className="flex items-center justify-between gap-3">
            <div className="uppercase tracking-[0.18em] text-white/45">Ops status</div>
            <div className="flex gap-2">
              <Badge className="border-white/10 bg-white/10 text-white">Live</Badge>
              <Badge className="border-white/10 bg-[var(--fx-sage)] text-[var(--fx-ops-ink)]">Safe send</Badge>
            </div>
          </div>
          <div className="mt-3 text-sm font-medium text-white">Railway · bot + CMS</div>
          <div className="mt-1 text-white/58">
            Test-send and publish stay available while the queue is under review.
          </div>
        </div>
      </div>
    </aside>
  );
}
