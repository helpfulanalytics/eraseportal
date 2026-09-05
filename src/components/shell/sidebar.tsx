"use client";

import {
  ArchiveIcon,
  Building2Icon,
  CheckIcon,
  CircleCheckIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  FolderIcon,
  ImageIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  ShapesIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { reorderFolderItemsAction } from "@/app/(workspace)/actions";
import { useTransition } from "react";

import { CreateMenu } from "@/components/kitchen/create-menu";
import { UnreadBadge } from "@/components/kitchen/unread-badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useCurrentUser,
  useOrgSlug,
  useUnreadOverride,
  useWorkspace,
} from "@/components/workspace-provider";
import type { NavFolder, Organization } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

function HomeGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
    </svg>
  );
}

type NavItem = NavFolder["items"][number];

/**
 * Route for a sidebar item, by kind. A near-duplicate of `itemHref` in
 * kitchen-format.ts, which exists because that one takes a full `FolderItem`
 * (folderId, createdAt, authorId — fields the sidebar never fetches). Keeping
 * this one deliberately slim rather than widening `NavFolder.items` to match
 * `FolderItem` just to reuse one switch statement.
 *
 * A file has no page of its own — same as everywhere else it appears in the
 * app — so its row links to the folder it's in, `folderHref`, rather than
 * inventing a destination that doesn't exist. Clicking it lands you next to
 * it in the folder's own list, where the real preview dialog lives.
 */
function hrefFor(item: NavItem, orgSlug: string, folderHref: string): string {
  switch (item.kind) {
    case "conversation":
      return `/w/${orgSlug}/conversations/${item.id}`;
    case "board":
      return `/w/${orgSlug}/boards/${item.id}`;
    case "document":
      return `/w/${orgSlug}/documents/${item.id}`;
    case "embed":
      return `/w/${orgSlug}/embeds/${item.id}`;
    case "file":
      return folderHref;
  }
}

/**
 * Link is stored as an embed whose provider says "Link" — see `createEmbed`
 * in kitchen-data.ts — so distinguishing the two icons means reading
 * `meta.provider`, not `kind`. A canvas document is the same shape of
 * exception: same `kind`, different `meta.docKind`. A file's icon reads
 * `meta.mime` the same way `ItemThumb` does, so an uploaded image gets the
 * image glyph rather than the generic file one.
 */
function iconFor(item: NavItem) {
  switch (item.kind) {
    case "conversation":
      return MessageSquareIcon;
    case "board":
      return LayoutTemplateIcon;
    case "document":
      return item.meta.type === "document" && item.meta.docKind === "canvas"
        ? ShapesIcon
        : FileTextIcon;
    case "embed":
      return item.meta.type === "embed" && item.meta.provider === "Link"
        ? ExternalLinkIcon
        : LinkIcon;
    case "file":
      return item.meta.type === "file" && item.meta.mime?.startsWith("image/")
        ? ImageIcon
        : FileIcon;
  }
}

export function Sidebar({
  folders,
  organizations,
}: {
  folders: NavFolder[];
  /** Every org, for the switcher below. Empty for a client, who only ever has the one. */
  organizations: Organization[];
}) {
  const pathname = usePathname();
  const workspace = useWorkspace();
  const currentUser = useCurrentUser();
  const orgSlug = useOrgSlug();
  const isAdmin = currentUser?.kind === "member";

  const links = [
    { href: `/w/${orgSlug}`, icon: HomeGlyph, label: "Home", exact: true },
    { href: `/w/${orgSlug}/tasks/me`, icon: CircleCheckIcon, label: "My Tasks" },
    { href: `/w/${orgSlug}/library`, icon: ArchiveIcon, label: "Library" },
  ];

  return (
    <div className="flex h-full w-sidebar shrink-0 flex-col overflow-y-auto border-k-black-06 border-r bg-background">
      <div className="flex items-center gap-1 px-4 pt-4 pb-3">
        {isAdmin && organizations.length > 1 ? (
          <OrgSwitcher organizations={organizations} currentOrgId={workspace.id} />
        ) : (
          <h2 className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-section">
            {workspace.name}
          </h2>
        )}
        {/* Clients start conversations from inside a folder (see that
        page's own Create menu) — everything this one offers is admin-only. */}
        {isAdmin ? <CreateMenu folders={folders} /> : null}
      </div>

      <ul className="flex flex-col gap-px px-2">
        {links.map((link) => {
          const active = link.exact
            ? pathname === link.href
            : pathname.startsWith(link.href);
          return (
            <li key={link.href}>
              <SidebarRow href={link.href} active={active}>
                <link.icon className="size-4 shrink-0 text-k-black-56" />
                <span className="truncate">{link.label}</span>
              </SidebarRow>
            </li>
          );
        })}
      </ul>

      <div className="px-4 pt-5 pb-1.5 text-k-black-40 text-sm">Folders</div>

      <ul className="flex flex-col gap-px px-2 pb-4">
        {folders.map((folder) => (
          <CollapsibleFolder 
            key={folder.id} 
            folder={folder} 
            orgSlug={orgSlug ?? ""} 
            pathname={pathname} 
          />
        ))}
      </ul>
    </div>
  );
}

/**
 * The sidebar header, when there's more than one org to switch between: a
 * dropdown instead of a plain heading, so getting to another org is one
 * click here rather than back out to "All organizations" and in again.
 * Member-only and only rendered when `organizations.length > 1` — see
 * `Sidebar` above; a client's own org, or a workspace with just the one,
 * gets the plain heading it always had.
 */
function OrgSwitcher({
  organizations,
  currentOrgId,
}: {
  organizations: Organization[];
  currentOrgId: string;
}) {
  const current = organizations.find((org) => org.id === currentOrgId);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="flex min-w-0 flex-1 items-center gap-1 rounded-md py-0.5 pr-1 text-left transition-colors hover:bg-k-black-04">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-section">
          {current?.name ?? "Select project"}
        </h2>
        <ChevronsUpDownIcon
          className="size-3.5 shrink-0 text-k-black-24"
          strokeWidth={1.8}
        />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        {organizations.map((org) => (
          <DropdownMenuItem key={org.id} render={<Link href={`/w/${org.slug}`} />}>
            <Building2Icon className="size-3.5 shrink-0 text-k-black-40" strokeWidth={1.7} />
            <span className="min-w-0 flex-1 truncate">{org.name}</span>
            {org.id === currentOrgId ? (
              <CheckIcon className="size-3.5 shrink-0" strokeWidth={2} />
            ) : null}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function SidebarRow({
  href,
  active,
  className,
  children,
}: {
  href: string;
  active: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-2 rounded-lg px-2 py-1.5 text-k-black-84 text-md transition-colors",
        active ? "bg-k-black-06" : "hover:bg-k-black-03",
        className,
      )}
    >
      {children}
    </Link>
  );
}

function CollapsibleFolder({
  folder: initialFolder,
  orgSlug,
  pathname,
}: {
  folder: NavFolder;
  orgSlug: string;
  pathname: string;
}) {
  const [folder, setFolder] = useState(initialFolder);
  const { isUnreadCleared } = useUnreadOverride();
  const [, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setFolder((prev) => {
        const oldIndex = prev.items.findIndex((i) => i.id === active.id);
        const newIndex = prev.items.findIndex((i) => i.id === over.id);
        const nextItems = arrayMove(prev.items, oldIndex, newIndex);
        
        startTransition(() => {
          reorderFolderItemsAction(prev.id, nextItems.map((i) => i.id)).catch(() => {});
        });

        return { ...prev, items: nextItems };
      });
    }
  };

  const href = `/w/${orgSlug}/folders/${folder.id}`;
  const hasChildren = folder.items.length > 0 || folder.clients.length > 0;
  
  const [isOpen, setIsOpen] = useState(() => {
    if (pathname === href) return true;
    if (folder.items.some((item) => pathname === hrefFor(item, orgSlug, href))) return true;
    return true; // Default open
  });

  return (
    <li>
      <div
        className={cn(
          "flex items-center gap-1 rounded-lg pr-2 py-1 text-k-black-84 text-md transition-colors",
          pathname === href ? "bg-k-black-06" : "hover:bg-k-black-03"
        )}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className="flex size-5 shrink-0 items-center justify-center rounded text-k-black-40 hover:bg-k-black-06 hover:text-k-black-84"
          >
            <ChevronRightIcon
              className={cn("size-3.5 transition-transform", isOpen && "rotate-90")}
              strokeWidth={2}
            />
          </button>
        ) : (
          <div className="size-5 shrink-0" />
        )}
        <Link href={href} className="flex min-w-0 flex-1 items-center gap-2 truncate py-0.5">
          <FolderIcon
            className={cn("size-4 shrink-0", !folder.color && "fill-k-yellow text-k-yellow")}
            style={
              folder.color
                ? { color: folder.color, fill: folder.color }
                : undefined
            }
            strokeWidth={1.5}
          />
          <span className="truncate">{folder.name}</span>
        </Link>
      </div>

      {hasChildren && isOpen && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={folder.items.map(i => i.id)} strategy={verticalListSortingStrategy}>
            <ul className="flex flex-col gap-px pt-0.5">
              {folder.items.map((item) => {
                const itemHref = hrefFor(item, orgSlug, href);
                const Icon = iconFor(item);
                // A file's href is its folder's — every file in the folder
                // would otherwise light up together the moment you're on
                // that page, the same reason the client rows below are
                // never "active".
                const active = item.kind !== "file" && pathname === itemHref;
                return (
                  <SortableSidebarItem key={item.id} id={item.id}>
                    <SidebarRow
                      href={itemHref}
                      active={active}
                      className="pl-8"
                    >
                      <Icon
                        className={cn("size-4 shrink-0", !item.color && "text-k-black-56")}
                        style={item.color ? { color: item.color } : undefined}
                        strokeWidth={1.6}
                      />
                      <span className="min-w-0 flex-1 truncate">{item.name}</span>
                      <UnreadBadge
                        count={isUnreadCleared(item.id) ? 0 : item.unreadCount}
                      />
                    </SidebarRow>
                  </SortableSidebarItem>
                );
              })}
              {folder.clients.map((client) => (
                <li key={`client:${client.id}`}>
                  <SidebarRow
                    href={`/w/${orgSlug}/settings?tab=clients`}
                    active={false}
                    className="pl-8"
                  >
                    <UserIcon
                      className="size-4 shrink-0"
                      style={{ color: client.color }}
                      strokeWidth={1.6}
                    />
                    <span className="truncate">{client.name}</span>
                  </SidebarRow>
                </li>
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </li>
  );
}

function SortableSidebarItem({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: "relative" as any,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      {children}
    </li>
  );
}
