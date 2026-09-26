"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/dashboard/sidebar";
import { Topbar } from "@/components/dashboard/topbar";
import { VerifyEmailBanner } from "@/components/dashboard/verify-email-banner";

export function DashboardChrome({
  orgName,
  userName,
  userEmail,
  emailVerified,
  children,
}: {
  orgName: string;
  userName: string;
  userEmail: string;
  emailVerified: boolean;
  children: React.ReactNode;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen">
      <Sidebar
        orgName={orgName}
        mobileOpen={mobileOpen}
        onNavigate={() => setMobileOpen(false)}
      />
      <div className="flex flex-1 flex-col lg:min-w-0">
        {!emailVerified && <VerifyEmailBanner />}
        <Topbar
          userName={userName}
          userEmail={userEmail}
          onMenuClick={() => setMobileOpen(true)}
        />
        <main className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-6 sm:px-8 sm:py-8">
          {/* Keyed on the URL so every tab change eases in instead of cutting. */}
          <div key={pathname} className="animate-page-in">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
