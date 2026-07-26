"use client";

import {
  CheckSquareIcon,
  InboxIcon,
  LayoutTemplateIcon,
  type LucideIcon,
  MoreHorizontalIcon,
  PanelLeftIcon,
  SettingsIcon,
  UsersIcon,
  XIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
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

const ITEMS: RailItem[] = [
  {
    key: "home",
    href: "/",
    icon: HomeGlyph,
    label: "Home",
    match: (p) => p === "/" || p.startsWith("/folders") || p.startsWith("/conversations"),
  },
  { key: "inbox", href: "/inbox", icon: InboxIcon, label: "Inbox" },
  { key: "clients", href: "/clients", icon: UsersIcon, label: "Clients" },
  {
    key: "tasks",
    href: "/tasks",
    icon: CheckSquareIcon,
    label: "Tasks",
    match: (p) => p.startsWith("/tasks"),
  },
];

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
}: {
  onToggleSidebar: () => void;
  sidebarOpen: boolean;
}) {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  return (
    <nav
      aria-label="Primary"
      className="relative z-30 flex w-rail shrink-0 flex-col items-center gap-1 py-3"
    >
      <Link
        href="/"
        aria-label="Workspace home"
        className="mb-3 flex size-10 items-center justify-center rounded-full text-k-black-84 transition-colors hover:bg-k-black-04"
      >
        <ChefHatGlyph className="size-7" />
      </Link>

      {ITEMS.map((item) => {
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

      <div className="relative">
        <RailButton
          icon={MoreHorizontalIcon}
          label="More"
          active={moreOpen}
          onClick={() => setMoreOpen((v) => !v)}
        />
        {moreOpen ? (
          <MorePanel onClose={() => setMoreOpen(false)} />
        ) : null}
      </div>

      <div className="mt-auto flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          aria-pressed={sidebarOpen}
          className="flex size-9 items-center justify-center rounded-lg text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <PanelLeftIcon className="size-[18px]" strokeWidth={1.6} />
        </button>
        <RailButton
          as={Link}
          href="/settings"
          icon={SettingsIcon}
          label="Settings"
          active={pathname.startsWith("/settings")}
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
      {...(Comp === "button" ? { type: "button" } : {})}
      aria-current={active ? "page" : undefined}
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
function MorePanel({ onClose }: { onClose: () => void }) {
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
        href="/templates"
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

function ChefHatGlyph({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 32 32"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M8.5 19.5a5.5 5.5 0 0 1-1.2-10.9 5.2 5.2 0 0 1 9.7-2.6 5.2 5.2 0 0 1 9.7 2.6 5.5 5.5 0 0 1-1.2 10.9" />
      <path d="M8.5 19.5v4.8c0 .8.7 1.5 1.5 1.5h12c.8 0 1.5-.7 1.5-1.5v-4.8z" />
      <path d="M8.5 22.3h15" />
    </svg>
  );
}
