"use client";

import { Menu } from "lucide-react";
import { signOut } from "next-auth/react";

export function Topbar({
  userName,
  userEmail,
  onMenuClick,
}: {
  userName: string;
  userEmail: string;
  onMenuClick: () => void;
}) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-border-hairline px-4 sm:px-8">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="-ml-1 rounded-lg p-2 text-foreground-muted hover:bg-surface-raised hover:text-foreground lg:hidden"
      >
        <Menu className="h-5 w-5" />
      </button>
      <div className="flex flex-1 items-center justify-end gap-4">
        <div className="text-right">
          <p className="text-sm font-medium leading-tight">{userName}</p>
          <p className="hidden text-xs leading-tight text-foreground-muted sm:block">
            {userEmail}
          </p>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/" })}
          className="text-sm text-foreground-muted transition-colors hover:text-foreground"
        >
          Log out
        </button>
      </div>
    </header>
  );
}
