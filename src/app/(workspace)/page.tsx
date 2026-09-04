import {
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
} from "lucide-react";
import { CreateMenu, type Creatable } from "@/components/kitchen/create-menu";
import {
  DashboardProjectGrid,
  type DashboardCardItem,
} from "@/components/kitchen/dashboard-project-grid";
import { getClients, getCurrentUser, getFolders, getOrganizations } from "@/lib/kitchen-data";
import { formatRelativeTime } from "@/lib/kitchen-format";

/**
 * Each card now creates the thing it names, opening the same panel the
 * sidebar's `+` uses with that type preselected.
 *
 * They previously linked to seeded ids — `/boards/brd_9f2c4a71e08d` and
 * friends — which 404'd the moment the workspace was reset. A card that
 * creates is both the intent and the only version that can't go stale.
 *
 * Folder/Board/Embed/Document are admin-only (see `requireAdmin` in
 * actions.ts) — a client sees only the Conversation card, matching what
 * they're actually allowed to create.
 */
const ADMIN_CREATE_ACTIONS: Array<{
  icon: React.ElementType;
  label: string;
  hint: string;
  creates: Creatable;
}> = [
  { icon: FolderIcon, label: "New Folder", hint: "Organize everything", creates: "folder" },
  { icon: LayoutTemplateIcon, label: "Board", hint: "Track projects", creates: "board" },
  { icon: MessageSquareIcon, label: "Conversation", hint: "Discuss anything", creates: "conversation" },
  { icon: LinkIcon, label: "Embed", hint: "Add third-party apps", creates: "embed" },
  { icon: FileTextIcon, label: "Document", hint: "Curate content", creates: "document" },
];

const CLIENT_CREATE_ACTIONS: Array<{
  icon: React.ElementType;
  label: string;
  hint: string;
  creates: Creatable;
}> = [
  { icon: MessageSquareIcon, label: "Conversation", hint: "Discuss anything", creates: "conversation" },
];

export default async function WorkspaceHomePage() {
  const me = await getCurrentUser();
  const isAdmin = me?.kind === "member";

  const [folders, organizations, clients] = await Promise.all([
    getFolders(
      isAdmin ? undefined : { organizationId: me?.organizationId },
    ),
    isAdmin ? getOrganizations() : Promise.resolve([]),
    isAdmin ? getClients() : Promise.resolve([]),
  ]);

  const createActions = isAdmin ? ADMIN_CREATE_ACTIONS : CLIENT_CREATE_ACTIONS;
  const slugByOrgId = new Map(organizations.map((o) => [o.id, o.slug]));
  const foldersWithOrgSlug = folders.map((f) => ({
    id: f.id,
    name: f.name,
    organizationSlug: f.organizationId ? slugByOrgId.get(f.organizationId) : undefined,
  }));

  const dashboardItems: DashboardCardItem[] = isAdmin
    ? organizations.map((org) => {
        const orgFolders = folders.filter((f) => f.organizationId === org.id);
        const folderCount = orgFolders.length;
        const clientCount = clients.filter((c) => c.organizationId === org.id).length;
        const lastActivityAt = orgFolders
          .map((f) => f.updatedAt)
          .filter((iso): iso is string => Boolean(iso))
          .sort()
          .at(-1);
        return {
          id: org.id,
          href: `/w/${org.slug}`,
          title: org.name,
          subtitle: org.domain,
          meta: `${folderCount} folder${folderCount === 1 ? "" : "s"} · ${clientCount} client${clientCount === 1 ? "" : "s"}`,
          activityLabel: lastActivityAt
            ? `Updated ${formatRelativeTime(lastActivityAt)}`
            : undefined,
          orgId: org.id,
        };
      })
    : // A client only reaches this branch if they somehow have no
      // organizationId — layout.tsx redirects every other client straight
      // to `/w/[orgSlug]` before this page renders at all. `getFolders`
      // returns nothing for a missing organizationId, so this is always [].
      [];

  return (
    <div className="px-14 py-12">
      <h1 className="font-semibold text-k-black-84 text-title">
        <span aria-hidden="true">👋</span> Welcome, {me?.name}!
      </h1>
      <p className="mt-1.5 text-k-black-40 text-md">
        {isAdmin
          ? "Every client engagement you're running, in one place."
          : "Your workspace — jump into a folder to see what's going on."}
      </p>

      <div className="mt-8">
        <DashboardProjectGrid isAdmin={isAdmin} items={dashboardItems} />
      </div>

      <section className="mt-12">
        <SectionHeading>Create</SectionHeading>
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {createActions.map((action) => (
            <li key={action.label}>
              <CreateMenu
                initial={action.creates}
                folders={foldersWithOrgSlug}
                organizations={organizations}
                triggerClassName="flex h-auto w-full flex-col items-start gap-2 rounded-xl border border-k-black-08 px-4 py-4 text-left transition-colors hover:border-k-black-12 hover:bg-k-black-02"
              >
                <action.icon
                  className="size-[18px] text-k-black-84"
                  strokeWidth={1.6}
                />
                <span className="mt-1 block font-medium text-k-black-84 text-md">
                  {action.label}
                </span>
                <span className="block text-k-black-40 text-md">
                  {action.hint}
                </span>
              </CreateMenu>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-4">
      <span className="shrink-0 text-k-black-40 text-md">{children}</span>
      <span className="h-px flex-1 bg-k-black-06" />
    </div>
  );
}
