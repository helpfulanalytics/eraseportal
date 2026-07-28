"use client";

import {
  ArchiveIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  UserIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreateMenu } from "@/components/kitchen/create-menu";
import { useWorkspace } from "@/components/workspace-provider";
import type { NavFolder } from "@/lib/kitchen-types";
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

const LINKS = [
  { href: "/", icon: HomeGlyph, label: "Home", exact: true },
  { href: "/tasks/me", icon: CircleCheckIcon, label: "My Tasks" },
  { href: "/library", icon: ArchiveIcon, label: "Library" },
];

type NavItem = NavFolder["items"][number];

/**
 * Route for a sidebar item, by kind. A near-duplicate of `itemHref` in
 * kitchen-format.ts, which exists because that one takes a full `FolderItem`
 * (folderId, createdAt, authorId — fields the sidebar never fetches). Keeping
 * this one deliberately slim rather than widening `NavFolder.items` to match
 * `FolderItem` just to reuse one switch statement.
 */
function hrefFor(item: NavItem): string {
  switch (item.kind) {
    case "conversation":
      return `/conversations/${item.id}`;
    case "board":
      return `/boards/${item.id}`;
    case "document":
      return `/documents/${item.id}`;
    case "embed":
      return `/embeds/${item.id}`;
  }
}

/**
 * Link is stored as an embed whose provider says "Link" — see `createEmbed`
 * in kitchen-data.ts — so distinguishing the two icons means reading
 * `meta.provider`, not `kind`.
 */
function iconFor(item: NavItem) {
  switch (item.kind) {
    case "conversation":
      return MessageSquareIcon;
    case "board":
      return LayoutTemplateIcon;
    case "document":
      return FileTextIcon;
    case "embed":
      return item.meta.type === "embed" && item.meta.provider === "Link"
        ? ExternalLinkIcon
        : LinkIcon;
  }
}

export function Sidebar({ folders }: { folders: NavFolder[] }) {
  const pathname = usePathname();
  const workspace = useWorkspace();

  return (
    <div className="flex h-full w-sidebar shrink-0 flex-col overflow-y-auto border-k-black-06 border-r bg-background">
      <div className="flex items-center gap-1 px-4 pt-4 pb-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-section">
          {workspace.name}
        </h2>
        <CreateMenu folders={folders} />
      </div>

      <ul className="flex flex-col gap-px px-2">
        {LINKS.map((link) => {
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
        {folders.map((folder) => {
          const href = `/folders/${folder.id}`;
          return (
            <li key={folder.id}>
              <SidebarRow href={href} active={pathname === href}>
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
              </SidebarRow>

              {folder.items.length > 0 || folder.clients.length > 0 ? (
                <ul className="flex flex-col gap-px">
                  {folder.items.map((item) => {
                    const itemHref = hrefFor(item);
                    const Icon = iconFor(item);
                    return (
                      <li key={item.id}>
                        <SidebarRow
                          href={itemHref}
                          active={pathname === itemHref}
                          className="pl-7"
                        >
                          <Icon
                            className={cn("size-4 shrink-0", !item.color && "text-k-black-56")}
                            style={item.color ? { color: item.color } : undefined}
                            strokeWidth={1.6}
                          />
                          <span className="truncate">{item.name}</span>
                        </SidebarRow>
                      </li>
                    );
                  })}
                  {/* No per-client page exists yet — every client row lands
                      on the workspace-wide list, same as clicking a client
                      row anywhere else in the app. */}
                  {folder.clients.map((client) => (
                    <li key={`client:${client.id}`}>
                      <SidebarRow
                        href="/clients"
                        active={pathname === "/clients"}
                        className="pl-7"
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
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
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
