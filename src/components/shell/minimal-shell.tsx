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

export function MinimalShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-k-page">
      <header className="flex h-[var(--k-topbar-height)] shrink-0 items-center px-4">
        <Link
          href="/"
          className="flex size-8 items-center justify-center rounded-full text-k-black-84 transition-colors hover:bg-k-black-04"
          aria-label="Dashboard"
        >
          <BrandMark size={24} />
        </Link>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      <main className="min-h-0 flex-1 overflow-y-auto">{children}</main>
    </div>
  );
}
