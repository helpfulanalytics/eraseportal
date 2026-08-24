"use client";

import { useSyncExternalStore } from "react";
import { GlobalSearch } from "@/components/shell/global-search";
import { IconRail } from "@/components/shell/icon-rail";
import { InboxSidebar } from "@/components/shell/inbox-sidebar";
import { Sidebar } from "@/components/shell/sidebar";
import { UserMenu } from "@/components/shell/user-menu";
import { useOrgSlug } from "@/components/workspace-provider";
import type { NavFolder, Organization } from "@/lib/kitchen-types";

const SIDEBAR_KEY = "workspace:sidebar-open";
const INBOX_KEY = "workspace:inbox-open";

/*
 * Both shell preferences live in localStorage, which React can't read during
 * SSR. Exposing them as external stores lets the server render the defaults
 * (sidebar open, inbox closed) and the client swap to the stored values on
 * hydration without a mismatch — reading them in an effect would instead
 * cause a cascading render.
 *
 * They're kept here, above the router, so the Inbox survives navigation:
 * clicking a message opens the conversation in the card next door without the
 * panel unmounting, which is the behaviour that makes it an inbox rather than
 * a page you keep going back to.
 */
function makeFlagStore(key: string, fallback: boolean) {
  const listeners = new Set<() => void>();
  let cached: boolean | null = null;

  function read(): boolean {
    if (cached === null) {
      const stored = window.localStorage.getItem(key);
      cached = stored === null ? fallback : stored === "true";
    }
    return cached;
  }

  return {
    read,
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      return () => {
        listeners.delete(onChange);
      };
    },
    set(next: boolean) {
      cached = next;
      window.localStorage.setItem(key, String(next));
      for (const listener of listeners) listener();
    },
    toggle() {
      this.set(!read());
    },
  };
}

const sidebarStore = makeFlagStore(SIDEBAR_KEY, true);
const inboxStore = makeFlagStore(INBOX_KEY, false);

/**
 * Shell geometry: fixed icon rail, one left panel, and a white card floating
 * inset on the grey page. See docs/kitchen-scan.md §2.
 *
 * The left panel is *either* the folder tree *or* the Inbox, never both —
 * the rail's Inbox button swaps between them. They're drawn differently on
 * purpose: the folder tree lives inside the page card (it navigates within
 * the thing you're looking at), while the Inbox is a card of its own with a
 * gap beside it (it's a separate surface you work down while the page next to
 * it changes).
 */
export function AppShell({
  children,
  navFolders,
  organizations,
}: {
  children: React.ReactNode;
  navFolders: NavFolder[];
  /** Every org, for the sidebar's switcher. Empty for a client — see the org layout. */
  organizations: Organization[];
}) {
  const orgSlug = useOrgSlug();
  const sidebarOpen = useSyncExternalStore(
    sidebarStore.subscribe,
    sidebarStore.read,
    () => true,
  );
  const inboxOpen = useSyncExternalStore(
    inboxStore.subscribe,
    inboxStore.read,
    () => false,
  );

  // The Inbox replaces the folder tree rather than joining it. Two panels
  // would leave the page card about 400px wide on a laptop, and the rail
  // already says which one you're in.
  const showInbox = inboxOpen && Boolean(orgSlug);
  const showFolders = sidebarOpen && !showInbox;

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-k-page">
      <header className="relative flex h-[var(--k-topbar-height)] shrink-0 items-center px-3">
        <div className="-translate-x-1/2 absolute left-1/2">
          <GlobalSearch />
        </div>
        <div className="ml-auto">
          <UserMenu />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 pb-[var(--k-card-inset)]">
        <IconRail
          onToggleSidebar={() =>
            // Collapsing while the Inbox is up should put the folder tree
            // away, not toggle a panel nobody can see.
            showInbox ? inboxStore.set(false) : sidebarStore.toggle()
          }
          sidebarOpen={showFolders}
          inboxOpen={showInbox}
          onToggleInbox={() => inboxStore.toggle()}
        />

        {showInbox && orgSlug ? (
          <InboxSidebar orgSlug={orgSlug} onClose={() => inboxStore.set(false)} />
        ) : null}

        <div className="mr-[var(--k-card-inset)] flex min-w-0 flex-1 overflow-hidden rounded-2xl bg-background shadow-[0_0_0_0.5px_var(--k-black-08)]">
          {showFolders ? (
            <Sidebar folders={navFolders} organizations={organizations} />
          ) : null}
          <main className="min-w-0 flex-1 overflow-y-auto">{children}</main>
        </div>
      </div>
    </div>
  );
}
