"use client";

/**
 * Carries the handful of workspace-wide values that client components need too
 * deep to receive as props: the people directory, the signed-in user, and the
 * workspace itself.
 *
 * Everything else is fetched in a server component and passed down. This
 * provider exists because `PersonAvatar` renders inside message lists, share
 * dialogs and page headers alike — threading `people` through every one of
 * those would be noise, and the directory is small enough to hydrate whole.
 *
 * It holds no fetching logic on purpose. The server layout does the reading;
 * this is a transport.
 */
import { createContext, use, useCallback, useEffect, useState, type ReactNode } from "react";
import type { Person, Workspace } from "@/lib/kitchen-types";
import { setupForegroundMessaging } from "@/lib/firebase/messaging";

interface WorkspaceContextValue {
  /**
   * Whatever's showing in the sidebar header. Inside an org's workspace this
   * is `{ id: organization.id, name: organization.name }` — there's no
   * separate global "workspace" concept anymore, an org's name and id just
   * fill this same shape.
   */
  workspace: Workspace;
  people: Record<string, Person>;
  /** Null before sign-in, and on routes that render outside a session. */
  currentUser: Person | null;
  /**
   * The `/w/{slug}` segment for the org currently being viewed — null on the
   * unscoped top-level pages (the dashboard, `/admin/new`). Link-builders
   * (`hrefFor` in sidebar.tsx, create-dialog redirects) prefix with this.
   */
  orgSlug?: string | null;
  /**
   * Board/conversation ids marked read this session, ahead of the server
   * round trip — see `clearUnread`. Kept in context rather than local to the
   * sidebar because the thing clearing it (a board or conversation page) and
   * the thing showing it (the sidebar) are siblings under `AppShell`, not
   * parent/child.
   */
  clearedUnreadIds: Set<string>;
  /**
   * Zeroes a sidebar unread badge immediately, without waiting on
   * `markBoardReadAction`/`markConversationReadAction`'s network round trip
   * (which still runs, persisting `lastReadAt` for future visits) — the
   * badge otherwise sits there for the second or so that request takes,
   * which reads as broken when the board/conversation is already open.
   */
  clearUnread: (id: string) => void;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  people,
  currentUser,
  orgSlug = null,
  children,
}: Omit<WorkspaceContextValue, "clearedUnreadIds" | "clearUnread"> & { children: ReactNode }) {
  const [clearedUnreadIds, setClearedUnreadIds] = useState<Set<string>>(new Set());
  const clearUnread = useCallback((id: string) => {
    setClearedUnreadIds((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
  }, []);

  useEffect(() => {
    // Attempt to set up foreground messaging if permission is granted.
    // It returns an unsubscribe function that we can return for cleanup.
    let unsubscribe: (() => void) | void;
    
    setupForegroundMessaging()
      .then((unsub) => {
        unsubscribe = unsub;
      })
      .catch((err) => console.error("Foreground messaging error:", err));
      
    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, []);

  return (
    <WorkspaceContext
      value={{ workspace, people, currentUser, orgSlug, clearedUnreadIds, clearUnread }}
    >
      {children}
    </WorkspaceContext>
  );
}

function useWorkspaceContext(): WorkspaceContextValue {
  const value = use(WorkspaceContext);
  if (!value) {
    throw new Error(
      "This component must render inside <WorkspaceProvider> — check that " +
        "its route lives under src/app/(workspace)/.",
    );
  }
  return value;
}

export function useWorkspace(): Workspace {
  return useWorkspaceContext().workspace;
}

export function usePeople(): Record<string, Person> {
  return useWorkspaceContext().people;
}

/** Client-side counterpart of the server's `getPerson`. */
export function usePerson(id: string | undefined): Person | undefined {
  const people = useWorkspaceContext().people;
  return id ? people[id] : undefined;
}

export function useCurrentUser(): Person | null {
  return useWorkspaceContext().currentUser;
}

export function useOrgSlug(): string | null {
  return useWorkspaceContext().orgSlug ?? null;
}

/**
 * `isUnreadCleared(id)` — true once `clearUnread(id)` has been called this
 * session, for a sidebar row to zero its own badge immediately. See
 * `clearUnread`'s doc comment on `WorkspaceContextValue`.
 */
export function useUnreadOverride(): {
  isUnreadCleared: (id: string) => boolean;
  clearUnread: (id: string) => void;
} {
  const { clearedUnreadIds, clearUnread } = useWorkspaceContext();
  return {
    isUnreadCleared: (id: string) => clearedUnreadIds.has(id),
    clearUnread,
  };
}
