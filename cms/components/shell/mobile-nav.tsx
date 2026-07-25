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

const items = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/control", label: "Control", icon: ShieldCheck },
  { href: "/events", label: "Events", icon: CalendarRange },
  { href: "/content", label: "Content", icon: GalleryVerticalEnd },
  { href: "/social", label: "Social", icon: Waypoints },
  { href: "/ai", label: "AI Desk", icon: Brain },
  { href: "/settings", label: "Settings", icon: Settings2 },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-2 overflow-x-auto border-b border-[var(--fx-border-soft)] bg-[rgba(247,245,240,0.94)] px-4 py-3 backdrop-blur lg:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
          href={item.href}
          className={cn(
            "inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-medium whitespace-nowrap",
            active
              ? "border-[var(--fx-ops-ink)] bg-[var(--fx-ops-ink)] text-white shadow-[0_8px_18px_rgba(22,49,68,0.16)]"
              : "border-[var(--fx-border-soft)] bg-[rgba(255,255,255,0.82)] text-[var(--fx-text-soft)]"
          )}
        >
          <Icon className="size-3.5" />
          {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
