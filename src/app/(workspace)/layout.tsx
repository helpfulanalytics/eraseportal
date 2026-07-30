import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { PATHNAME_HEADER } from "@/proxy";
import { MinimalShell } from "@/components/shell/minimal-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import {
  getCurrentUser,
  getOrganization,
  getPeople,
  getWorkspace,
} from "@/lib/kitchen-data";

/**
 * The gate for the *unscoped* pages only — the dashboard (`/`) and the
 * project creator (`/admin/new`). Every org-scoped page (folders, boards,
 * conversations, tasks, settings, …) lives under `src/app/w/[orgSlug]/` with
 * its own layout instead; a client never actually renders anything under
 * this one — they're redirected straight to their org's workspace below,
 * since a client only ever has one org and there's nothing to pick.
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

  if (currentUser.kind === "client" && currentUser.organizationId) {
    const organization = await getOrganization(currentUser.organizationId);
    if (organization) redirect(`/w/${organization.slug}`);
  }

  // Fetched in parallel. No folder tree here — there's no "current org" on
  // these pages, so a tree would have nothing meaningful to scope to.
  const [workspace, people] = await Promise.all([getWorkspace(), getPeople()]);

  return (
    <WorkspaceProvider workspace={workspace} people={people} currentUser={currentUser}>
      <MinimalShell>{children}</MinimalShell>
    </WorkspaceProvider>
  );
}
