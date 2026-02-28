"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  List,
  ArrowLeftRight,
  Upload,
  Settings,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/positions", label: "Positions", icon: List },
  { href: "/trade", label: "Trade", icon: ArrowLeftRight },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-56 flex-col border-r border-[var(--border)]">
      {/* Logo */}
      <div className="flex h-16 items-center px-5 border-b border-[var(--border)]">
        <h1 className="font-serif text-lg tracking-tight">
          <span className="text-[var(--accent)]">Portfolio</span>{" "}
          <span className="font-normal">Manager</span>
        </h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="small-caps px-3 pb-2 text-[0.625rem]">Navigation</p>
        {navItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-all duration-200",
                isActive
                  ? "text-[var(--accent)] font-medium border-l-2 border-[var(--accent)] bg-[var(--accent)]/5 rounded-l-none"
                  : "text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--muted)]/50"
              )}
              style={{ letterSpacing: "0.03em" }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="px-5 py-3 border-t border-[var(--border)]">
        <p className="small-caps text-[0.5625rem] text-[var(--muted-foreground)]/60">v1.0</p>
      </div>
    </aside>
  );
}
