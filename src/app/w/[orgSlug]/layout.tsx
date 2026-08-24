import type { ReactNode } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { WorkspaceProvider } from "@/components/workspace-provider";
import { requireOrgWorkspaceAccess } from "@/lib/access-guard";
import { getNavTree, getOrganizations, getPeople } from "@/lib/kitchen-data";

/**
 * The gate and data root for one organization's workspace — every folder,
 * board, conversation, task, etc. a person can reach lives under this
 * segment. `requireOrgWorkspaceAccess` 404s a client whose own org doesn't
 * match `orgSlug`, so the URL itself can't be used to browse into another
 * org's data.
 *
 * The org fills the same `{ id, name }` shape the sidebar always rendered as
 * "the workspace" — there's no separate global workspace concept inside
 * here, just this org.
 */
export default async function OrgWorkspaceLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization, me } = await requireOrgWorkspaceAccess(orgSlug);

  // A client only ever has the one org, so the switcher — and the list it'd
  // need — is member-only; skipping the fetch for a client isn't an
  // optimisation worth the extra branch, it's just not fetching data nobody
  // can use, same as `/w/[orgSlug]/page.tsx` already does for "All organizations".
  const [people, navFolders, organizations] = await Promise.all([
    getPeople(),
    getNavTree({ organizationId: organization.id }),
    me.kind === "member" ? getOrganizations() : Promise.resolve([]),
  ]);

  return (
    <WorkspaceProvider
      workspace={{ id: organization.id, name: organization.name }}
      people={people}
      currentUser={me}
      orgSlug={orgSlug}
    >
      <AppShell navFolders={navFolders} organizations={organizations}>
        {children}
      </AppShell>
    </WorkspaceProvider>
  );
}
