import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import {
  getCurrentUser,
  getNavTree,
  getPeople,
  getWorkspace,
} from "@/lib/kitchen-data";

/**
 * The one place workspace-wide data is read. Everything below either receives
 * it as props (the sidebar's folder tree) or reads it from context (the people
 * directory, the current user).
 *
 * This is also the auth gate: no session, no workspace. The `(auth)` routes
 * sit outside this group precisely so they can render without one.
 */
export default async function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  const currentUser = await getCurrentUser();
  if (!currentUser) redirect("/sign-in");

  // Fetched in parallel — none depend on each other, and this layout blocks
  // every route beneath it.
  const [workspace, people, navFolders] = await Promise.all([
    getWorkspace(),
    getPeople(),
    getNavTree(),
  ]);

  return (
    <WorkspaceProvider
      workspace={workspace}
      people={people}
      currentUser={currentUser}
    >
      <AppShell navFolders={navFolders}>{children}</AppShell>
    </WorkspaceProvider>
  );
}
