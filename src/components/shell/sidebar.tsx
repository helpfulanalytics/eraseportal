"use client";

import {
  ArchiveIcon,
  ChevronDownIcon,
  CircleCheckIcon,
  FolderIcon,
  MessageSquareIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreateFolderButton } from "@/components/kitchen/create-inline";
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

export function Sidebar({ folders }: { folders: NavFolder[] }) {
  const pathname = usePathname();
  const workspace = useWorkspace();

  return (
    <div className="flex h-full w-sidebar shrink-0 flex-col overflow-y-auto border-k-black-06 border-r bg-background">
      <div className="flex items-center gap-1 px-4 pt-4 pb-3">
        <h2 className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-section">
          {workspace.name}
        </h2>
        <CreateFolderButton />
        <button
          type="button"
          aria-label="Workspace menu"
          className="flex size-6 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <ChevronDownIcon className="size-4" strokeWidth={1.7} />
        </button>
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
          const children = folder.conversations;
          return (
            <li key={folder.id}>
              <SidebarRow href={href} active={pathname === href}>
                <FolderIcon
                  className="size-4 shrink-0 fill-k-yellow text-k-yellow"
                  strokeWidth={1.5}
                />
                <span className="truncate">{folder.name}</span>
              </SidebarRow>

              {children.length > 0 ? (
                <ul className="flex flex-col gap-px">
                  {children.map((conv) => {
                    const convHref = `/conversations/${conv.id}`;
                    return (
                      <li key={conv.id}>
                        <SidebarRow
                          href={convHref}
                          active={pathname === convHref}
                          className="pl-7"
                        >
                          <MessageSquareIcon
                            className="size-4 shrink-0 text-k-black-56"
                            strokeWidth={1.6}
                          />
                          <span className="truncate">{conv.name}</span>
                        </SidebarRow>
                      </li>
                    );
                  })}
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
