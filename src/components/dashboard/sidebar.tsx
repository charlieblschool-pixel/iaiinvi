"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  User,
  Boxes,
  History,
  SquareCheck,
  ChartBar,
  CreditCard,
  Settings,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

const items = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/activity", label: "Activity Log", icon: History },
  { href: "/dashboard/reorder", label: "Reorder Approvals", icon: SquareCheck },
  { href: "/dashboard/reports", label: "Reports", icon: ChartBar },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

export function Sidebar({
  orgName,
  mobileOpen,
  onNavigate,
}: {
  orgName: string;
  mobileOpen: boolean;
  onNavigate: () => void;
}) {
  const pathname = usePathname();

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={onNavigate}
          className="fixed inset-0 z-40 bg-black/60 lg:hidden"
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 -translate-x-full flex-col border-r border-border-hairline bg-surface px-4 py-6 transition-transform duration-200 lg:static lg:h-screen lg:translate-x-0 lg:bg-surface/60",
          mobileOpen && "translate-x-0",
        )}
      >
        <Link href="/dashboard/overview" className="px-2" onClick={onNavigate}>
          <Logo />
        </Link>
        <p className="mt-1 truncate px-2 text-xs text-foreground-muted">
          {orgName}
        </p>

        <nav className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-brand-dim text-foreground"
                    : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" strokeWidth={2} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
