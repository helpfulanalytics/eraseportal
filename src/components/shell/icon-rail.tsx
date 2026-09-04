"use client";

import {
  CheckSquareIcon,
  InboxIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  SettingsIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { BrandMark } from "@/components/brand-mark";
import { useOrgSlug } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

/** Lucide icons and the hand-rolled glyphs below share this shape. */
type Glyph = LucideIcon | ((props: { className?: string }) => React.ReactElement);

interface RailItem {
  key: string;
  href: string;
  icon: Glyph;
  label: string;
  /** Match on prefix rather than equality for sections with child routes. */
  match?: (pathname: string) => boolean;
}

/** Lucide has no house glyph matching the outline weight used here. */
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

export function IconRail({
  onToggleSidebar,
  sidebarOpen,
  inboxOpen,
  onToggleInbox,
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
  inboxOpen: boolean;
  onToggleInbox: () => void;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const orgSlug = useOrgSlug();
  const orgHome = `/w/${orgSlug}`;

  const items: RailItem[] = [
    {
      key: "home",
      href: orgHome,
      icon: HomeGlyph,
      label: "Home",
      // Exact match only, like every other rail entry (Tasks, Settings)
      // below. It used to stay lit for any folder or conversation page too,
      // so it never visibly turned off while browsing — the one signal that
      // could show "you've left home" never fired, which is what made
      // clicking Home not feel like arriving anywhere. The sidebar tree
      // already shows exactly which folder/conversation is open; the rail
      // doesn't need to duplicate that.
      match: (p) => p === orgHome,
    },
    {
      key: "tasks",
      href: `${orgHome}/tasks`,
      icon: CheckSquareIcon,
      label: "Tasks",
      match: (p) => p.startsWith(`${orgHome}/tasks`),
    },
  ];

  return (
    <nav
      aria-label="Primary"
      className="relative z-30 flex w-rail shrink-0 flex-col items-center gap-1 py-3"
    >
      <Link
        href={orgHome}
        aria-label="Workspace home"
        className="mb-3 flex size-10 items-center justify-center rounded-full text-k-black-84 transition-colors hover:bg-k-black-04"
      >
        <BrandMark size={28} />
      </Link>

      {items.map((item) => {
        const active = item.match ? item.match(pathname) : pathname === item.href;
        return (
          <RailButton
            key={item.key}
            as={Link}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={active}
          />
        );
      })}

      {/*
        Inbox is the one rail entry that isn't a destination. It swaps the left
        panel and leaves the page alone, so it's a button with `aria-expanded`
        rather than a link with `aria-current` — pressing it never changes the
        URL, and the conversation you open from it lands in the card beside it.
      */}
      <RailButton
        icon={InboxIcon}
        label="Inbox"
        active={inboxOpen}
        aria-expanded={inboxOpen}
        onClick={onToggleInbox}
      />

      <div className="relative">
        <RailButton
          icon={MoreHorizontalIcon}
          label="More"
          active={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        />
        {moreOpen ? (
          <MorePanel orgHome={orgHome} onClose={() => setMoreOpen(false)} />
        ) : null}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={
            inboxOpen
              ? "Close inbox"
              : sidebarOpen
                ? "Collapse sidebar"
                : "Expand sidebar"
          }
          aria-pressed={sidebarOpen || inboxOpen}
          className="flex size-9 items-center justify-center rounded-lg text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <PanelLeftIcon className="size-[18px]" strokeWidth={1.6} />
        </button>
        <RailButton
          as={Link}
          href={`${orgHome}/settings`}
          icon={SettingsIcon}
          label="Settings"
          active={pathname.startsWith(`${orgHome}/settings`)}
        />
      </div>
    </nav>
  );
}

/**
 * Rail entry: icon in a rounded-square pill with the label stacked beneath.
 * The pill sits behind the icon only — the label never takes the fill.
 */
function RailButton({
  as: Comp = "button",
  icon: Icon,
  label,
  active,
  ...props
}: {
  as?: React.ElementType;
  icon: Glyph;
  label: string;
  active?: boolean;
} & React.ComponentPropsWithoutRef<"button"> &
  Record<string, unknown>) {
  return (
    <Comp
      {...props}
      {...(Comp === "button"
        ? { type: "button" }
        : // `aria-current="page"` is a claim about the URL, so only a rail
          // entry that navigates gets to make it. The Inbox toggle says
          // `aria-expanded` instead, which is what it actually does.
          { "aria-current": active ? "page" : undefined })}
      className="group flex w-14 flex-col items-center gap-0.5 py-0.5"
    >
      <span
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-colors",
          active
            ? "bg-k-black-08 text-k-black-84"
            : "text-k-black-56 group-hover:bg-k-black-04 group-hover:text-k-black-84",
        )}
      >
        <Icon className="size-[18px]" strokeWidth={1.6} />
      </span>
      <span
        className={cn(
          "text-2xs leading-none transition-colors",
          active ? "text-k-black-84" : "text-k-black-56",
        )}
      >
        {label}
      </span>
    </Comp>
  );
}

/** `More` opens a titled panel with its own close affordance, not a menu. */
function MorePanel({ orgHome, onClose }: { orgHome: string; onClose: () => void }) {
  return (
    <div className="absolute bottom-0 left-[calc(100%+4px)] z-50 w-80 rounded-2xl bg-background p-2 shadow-popover">
      <div className="flex items-center justify-between px-2 py-1">
        <span className="font-medium text-md text-k-black-84">More</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="More settings"
            className="flex size-6 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <SettingsIcon className="size-3.5" strokeWidth={1.6} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex size-6 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-3.5" strokeWidth={1.6} />
          </button>
        </div>
      </div>
      <div className="mx-2 my-1 h-px bg-k-black-06" />
      <Link
        href={`${orgHome}/templates`}
        onClick={onClose}
        className="flex w-full items-center gap-2.5 rounded-lg px-2 py-2 text-left transition-colors hover:bg-k-black-03"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-k-black-04 text-k-black-64">
          <LayoutTemplateIcon className="size-4" strokeWidth={1.6} />
        </span>
        <span className="min-w-0">
          <span className="block text-k-black-84 text-md">Templates</span>
          <span className="block text-k-black-40 text-sm">
            Create folders in a snap
          </span>
        </span>
      </Link>
    </div>
  );
}
