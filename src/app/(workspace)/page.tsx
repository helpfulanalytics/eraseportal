import {
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { CreateMenu, type Creatable } from "@/components/kitchen/create-menu";
import { getCurrentUser, getFolders } from "@/lib/kitchen-data";

/**
 * Each card now creates the thing it names, opening the same panel the
 * sidebar's `+` uses with that type preselected.
 *
 * They previously linked to seeded ids — `/boards/brd_9f2c4a71e08d` and
 * friends — which 404'd the moment the workspace was reset. A card that
 * creates is both the intent and the only version that can't go stale.
 */
const CREATE_ACTIONS: Array<{
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
  { icon: UserIcon, label: "Client", hint: "Invite clients", creates: "client" },
];

export default async function WorkspaceHomePage() {
  const [me, folders] = await Promise.all([getCurrentUser(), getFolders()]);

  return (
    <div className="px-14 py-12">
      <h1 className="font-semibold text-k-black-84 text-title">
        <span aria-hidden="true">👋</span> Welcome, {me?.name}!
      </h1>

      <section className="mt-12">
        <SectionHeading>Recent Folders</SectionHeading>
        <ul className="mt-5 flex flex-wrap gap-6">
          {folders.map((folder) => (
            <li key={folder.id}>
              <Link href={`/folders/${folder.id}`} className="group block w-46">
                <span className="flex h-46 w-46 items-center justify-center rounded-xl bg-k-black-04-solid transition-colors group-hover:bg-k-black-06-solid">
                  <FolderIcon
                    className="size-20 fill-k-yellow text-k-yellow"
                    strokeWidth={1.2}
                  />
                </span>
                <span className="mt-3 block truncate text-k-black-84 text-md">
                  {folder.name}
                </span>
                <span className="block text-k-black-40 text-md">
                  {folder.itemIds.length} items
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-12">
        <SectionHeading>Create</SectionHeading>
        <ul className="mt-5 grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-4">
          {CREATE_ACTIONS.map((action) => (
            <li key={action.label}>
              <CreateMenu
                initial={action.creates}
                folders={folders}
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
