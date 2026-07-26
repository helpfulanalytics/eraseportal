"use client";

import { useSyncExternalStore } from "react";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { GlobalSearch } from "@/components/shell/global-search";
import { IconRail } from "@/components/shell/icon-rail";
import { Sidebar } from "@/components/shell/sidebar";
import { CURRENT_USER_ID } from "@/lib/kitchen-data";

const SIDEBAR_KEY = "workspace:sidebar-open";

/*
 * The sidebar preference lives in localStorage, which React can't read during
 * SSR. Exposing it as an external store lets the server render the default
 * (open) and the client swap to the stored value on hydration without a
 * mismatch — reading it in an effect would instead cause a cascading render.
 */
const listeners = new Set<() => void>();
let cached: boolean | null = null;

function readSidebar(): boolean {
  if (cached === null) {
    cached = window.localStorage.getItem(SIDEBAR_KEY) !== "false";
  }
  return cached;
}

function subscribeSidebar(onChange: () => void) {
  listeners.add(onChange);
  return () => {
    listeners.delete(onChange);
  };
}

function toggleSidebar() {
  cached = !readSidebar();
  window.localStorage.setItem(SIDEBAR_KEY, String(cached));
  for (const listener of listeners) listener();
}

/**
 * Shell geometry: fixed icon rail, collapsible sidebar, and a white card
 * floating inset on the grey page. See docs/kitchen-scan.md §2.
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const sidebarOpen = useSyncExternalStore(
    subscribeSidebar,
    readSidebar,
    () => true,
  );

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-k-page">
      <header className="relative flex h-[var(--k-topbar-height)] shrink-0 items-center px-3">
        <div className="-translate-x-1/2 absolute left-1/2">
          <GlobalSearch />
        </div>
        <div className="ml-auto">
          <PersonAvatar personId={CURRENT_USER_ID} className="size-7" />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 pb-[var(--k-card-inset)]">
        <IconRail onToggleSidebar={toggleSidebar} sidebarOpen={sidebarOpen} />

        <div className="mr-[var(--k-card-inset)] flex min-w-0 flex-1 overflow-hidden rounded-2xl bg-background shadow-[0_0_0_0.5px_var(--k-black-08)]">
          {sidebarOpen ? <Sidebar /> : null}
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
