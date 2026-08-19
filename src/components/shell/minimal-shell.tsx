"use client";

/**
 * Chrome for the unscoped top-level pages — the dashboard (`/`) and the
 * project creator (`/admin/new`). Deliberately not `<AppShell>`: that
 * renders the full icon rail + folder-tree sidebar, whose static links
 * (My Tasks, Library, …) point into a specific org's workspace and have no
 * meaning before one's been picked. Just a logo and the account menu.
 */
import Link from "next/link";
import { BrandMark } from "@/components/brand-mark";
import { UserMenu } from "@/components/shell/user-menu";
import { useCurrentUser } from "@/components/workspace-provider";
import { canManageTeam } from "@/lib/permissions";

export function MinimalShell({ children }: { children: React.ReactNode }) {
  const currentUser = useCurrentUser();
  // Team is agency-wide, so it belongs on the unscoped chrome rather than in
  // an org's sidebar. Hidden for anyone `requireTeamPage` would bounce —
  // a link that only ever redirects is worse than no link.
  const showTeam = currentUser ? canManageTeam(currentUser) : false;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-k-page">
      <header className="flex h-[var(--k-topbar-height)] shrink-0 items-center gap-1 px-4">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-full text-k-black-84 transition-colors hover:bg-k-black-04"
          aria-label="Dashboard"
        >
          <BrandMark size={24} />
        </Link>
        {showTeam ? (
          <Link
            href="/team"
            className="flex h-8 items-center rounded-lg px-2.5 text-k-black-56 text-md transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            Team
          </Link>
        ) : null}
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
