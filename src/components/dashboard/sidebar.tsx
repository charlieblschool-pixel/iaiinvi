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
  ListChecks,
  Receipt,
} from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { cn } from "@/lib/cn";

type NavItem = {
  href: string;
  label: string;
  icon: typeof User;
  soon?: boolean;
  children?: { href: string; label: string; icon: typeof User }[];
};

const items: NavItem[] = [
  { href: "/dashboard/overview", label: "Overview", icon: LayoutDashboard },
  { href: "/dashboard/profile", label: "Profile", icon: User },
  { href: "/dashboard/inventory", label: "Inventory", icon: Boxes },
  { href: "/dashboard/activity", label: "Activity Log", icon: History },
  { href: "/dashboard/reorder", label: "Reorder Approvals", icon: SquareCheck, soon: true },
  {
    href: "/dashboard/reports",
    label: "Reports",
    icon: ChartBar,
    children: [
      { href: "/dashboard/reports/reorder", label: "Reorder list", icon: ListChecks },
      { href: "/dashboard/reports/tracked", label: "Sold & wasted", icon: Receipt },
    ],
  },
  { href: "/dashboard/billing", label: "Billing", icon: CreditCard },
  { href: "/dashboard/settings", label: "Settings", icon: Settings },
];

const linkClass = (active: boolean) =>
  cn(
    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all duration-200 active:scale-[0.98]",
    active
      ? "bg-brand-dim text-foreground shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      : "text-foreground-muted hover:bg-surface-raised hover:text-foreground",
  );

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
          "fixed inset-y-0 left-0 z-50 flex w-64 print:hidden shrink-0 -translate-x-full flex-col border-r border-border-hairline bg-surface px-4 py-6 transition-transform duration-200 lg:static lg:h-screen lg:translate-x-0 lg:bg-surface/60",
          mobileOpen && "translate-x-0",
        )}
      >
        <Link href="/dashboard/overview" className="px-2" onClick={onNavigate}>
          <Logo />
        </Link>
        <p className="mt-1 truncate px-2 text-xs text-foreground-muted">
          {orgName}
        </p>

        <nav aria-label="Main" className="mt-8 flex flex-1 flex-col gap-1">
          {items.map((item) => {
            const childActive = item.children?.some((c) => pathname.startsWith(c.href)) ?? false;
            const active = pathname.startsWith(item.href) && !childActive;
            const Icon = item.icon;
            return (
              <div key={item.href} className="flex flex-col gap-1">
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={linkClass(active)}
                >
                  <Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
                  <span className="flex-1">{item.label}</span>
                  {item.soon && (
                    <span className="rounded-full border border-status-warn/40 px-1.5 py-px text-[10px] font-medium uppercase tracking-wider text-status-warn">
                      Soon
                    </span>
                  )}
                </Link>
                {item.children?.map((child) => {
                  const ChildIcon = child.icon;
                  const isActive = pathname.startsWith(child.href);
                  return (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={onNavigate}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(linkClass(isActive), "ml-5 py-1.5 text-[13px]")}
                    >
                      <ChildIcon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                      {child.label}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </nav>
      </aside>
    </>
  );
}
