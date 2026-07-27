import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/proxy";
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

  if (!currentUser) {
    // Reached with a cookie that exists but doesn't verify — expired, revoked,
    // or minted for another project. The proxy waved it through on presence
    // alone, so this is where it actually gets rejected. Carry the destination
    // so the visitor resumes where they were aiming rather than at the
    // workspace root.
    const pathname = (await headers()).get(PATHNAME_HEADER);
    const next = pathname && pathname !== "/" ? `?next=${encodeURIComponent(pathname)}` : "";
    redirect(`/sign-in${next}`);
  }

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
