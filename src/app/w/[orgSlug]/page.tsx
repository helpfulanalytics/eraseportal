import { Building2Icon, FolderIcon, PlusIcon, UsersIcon } from "lucide-react";
import Link from "next/link";
import { DataTable, type Column, type Row } from "@/components/kitchen/data-table";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { NewOrgClientButton } from "@/components/kitchen/admin-dialog-buttons";
import { CreateMenu } from "@/components/kitchen/create-menu";
import { type DashboardCardItem } from "@/components/kitchen/dashboard-project-grid";
import { FolderBoard } from "@/components/kitchen/folder-board";
import { requireOrgWorkspaceAccess } from "@/lib/access-guard";
import { getClients, getFolders } from "@/lib/kitchen-data";
import { formatRelativeTime } from "@/lib/kitchen-format";

/**
 * An org's workspace home. Admins get the management view (folder list,
 * client list, invite) that used to live at `/admin/[organizationId]`; a
 * client gets the same folder-card dashboard a member sees on the
 * cross-org `/` picker, just already scoped to the one org they have.
 */
export default async function OrgWorkspaceHomePage({
  params,
}: {
  params: Promise<{ orgSlug: string }>;
}) {
  const { orgSlug } = await params;
  const { organization, me } = await requireOrgWorkspaceAccess(orgSlug);

  const folders = await getFolders({ organizationId: organization.id });

  if (me.kind === "client") {
    const items: DashboardCardItem[] = folders.map((folder) => ({
      id: folder.id,
      href: `/w/${orgSlug}/folders/${folder.id}`,
      title: folder.name,
      subtitle: folder.description,
      meta: `${folder.itemIds.length} item${folder.itemIds.length === 1 ? "" : "s"}`,
      color: folder.color,
    }));

    return (
      <div className="px-14 py-12">
        <h1 className="font-semibold text-k-black-84 text-title">
          <span aria-hidden="true">👋</span> Welcome, {me.name}!
        </h1>
        <p className="mt-1.5 text-k-black-40 text-md">
          Your workspace — jump into a folder to see what&apos;s going on.
        </p>
        <div className="mt-8">
          <FolderBoard orgSlug={orgSlug} items={items} />
        </div>
      </div>
    );
  }

  const clients = (await getClients()).filter(
    (c) => c.organizationId === organization.id,
  );

  const folderItems: DashboardCardItem[] = folders.map((folder) => ({
    id: folder.id,
    href: `/w/${orgSlug}/folders/${folder.id}`,
    title: folder.name,
    subtitle: folder.description,
    meta: `${folder.itemIds.length} item${folder.itemIds.length === 1 ? "" : "s"}`,
    activityLabel: folder.updatedAt
      ? `Updated ${formatRelativeTime(folder.updatedAt)}`
      : undefined,
    color: folder.color,
  }));

  const clientColumns: Column[] = [
    { key: "name", label: "Name", sorted: "asc" },
    { key: "email", label: "Email", width: "260px" },
  ];
  const clientRows: Row[] = clients.map((client) => ({
    id: client.id,
    cells: {
      name: (
        <div className="flex min-w-0 items-center gap-3">
          <PersonAvatar personId={client.id} className="size-6" />
          <span className="truncate text-k-black-84 text-md">{client.name}</span>
        </div>
      ),
      email: <span className="truncate">{client.email}</span>,
    },
  }));

  return (
    <div className="px-12 py-10">
      <div className="flex items-center gap-2.5">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-k-black-06 text-k-black-64">
          <Building2Icon className="size-4" strokeWidth={1.7} />
        </span>
        <h1 className="min-w-0 truncate font-semibold text-k-black-84 text-title">
          {organization.name}
        </h1>
      </div>
      <p className="mt-1 text-k-black-40 text-md">{organization.domain}</p>
      <Link href="/" className="mt-2 inline-block text-k-blue text-md">
        ← All projects
      </Link>

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <FolderIcon className="size-4 text-k-black-56" strokeWidth={1.7} />
          <h2 className="font-medium text-k-black-84 text-section">Folders</h2>
        </div>
        <div className="mt-4">
          <FolderBoard
            orgSlug={orgSlug}
            items={folderItems}
            isAdmin
            createSlot={
              <CreateMenu
                initial="folder"
                organizations={[
                  { id: organization.id, name: organization.name, slug: orgSlug },
                ]}
                triggerClassName="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
              >
                <PlusIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
                New folder
              </CreateMenu>
            }
          />
        </div>
      </section>

      <section className="mt-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UsersIcon className="size-4 text-k-black-56" strokeWidth={1.7} />
            <h2 className="font-medium text-k-black-84 text-section">Clients</h2>
          </div>
          <NewOrgClientButton organizationId={organization.id} />
        </div>
        <DataTable
          className="mt-4"
          columns={clientColumns}
          rows={clientRows}
          empty="No clients yet. Add one to send them an invite."
        />
      </section>
    </div>
  );
}
