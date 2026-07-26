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
import { createContext, use, type ReactNode } from "react";
import type { Person, Workspace } from "@/lib/kitchen-types";

interface WorkspaceContextValue {
  workspace: Workspace;
  people: Record<string, Person>;
  /** Null before sign-in, and on routes that render outside a session. */
  currentUser: Person | null;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({
  workspace,
  people,
  currentUser,
  children,
}: WorkspaceContextValue & { children: ReactNode }) {
  return (
    <WorkspaceContext
      value={{ workspace, people, currentUser }}
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
