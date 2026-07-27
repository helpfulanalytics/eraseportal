"use client";

/**
 * Kitchen's Create panel — the `+ ⌄` control in the sidebar and on a folder
 * header.
 *
 * Ported from a capture of the real thing: a titled panel with a close
 * affordance, one row per creatable type with an icon medallion and a
 * one-line description, and a "More" footer. It is not a plain menu, which is
 * why the standard menu item styling is overridden rather than reused.
 *
 * Every row opens a dialog. This file only decides *which* — the fields and
 * the writing live in `create-folder-dialog.tsx` (Folder, which also has a
 * description and an access group) and `create-item-dialog.tsx` (everything
 * else). Keeping the panel free of form state is what lets the same component
 * serve both the dropdown and the home page's cards.
 *
 * Two rows map onto types the domain model doesn't have: Link is stored as an
 * embed whose provider says "Link", and Proposal or Contract as a document.
 * Both are noted where they're written.
 */
import { useState } from "react";
import {
  ChevronDownIcon,
  ChevronRightIcon,
  ExternalLinkIcon,
  FileTextIcon,
  FolderIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  PlusIcon,
  ReceiptTextIcon,
  UserIcon,
  XIcon,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { CreateFolderDialog } from "@/components/kitchen/create-folder-dialog";
import {
  CreateItemDialog,
  type ItemType,
} from "@/components/kitchen/create-item-dialog";
import { cn } from "@/lib/utils";

export type Creatable = "folder" | ItemType;

const ROWS: Array<{
  key: Creatable;
  icon: React.ElementType;
  label: string;
  hint: string;
  /** Lives inside a folder, so one has to exist before it can be made. */
  inFolder: boolean;
}> = [
  { key: "folder", icon: FolderIcon, label: "Folder", hint: "Organize everything", inFolder: false },
  { key: "board", icon: LayoutTemplateIcon, label: "Board", hint: "Track and manage projects", inFolder: true },
  { key: "conversation", icon: MessageSquareIcon, label: "Conversation", hint: "Discuss anything with clients", inFolder: true },
  { key: "embed", icon: LinkIcon, label: "Embed", hint: "Add third-party apps", inFolder: true },
  { key: "link", icon: ExternalLinkIcon, label: "Link", hint: "Share external resources", inFolder: true },
  { key: "document", icon: FileTextIcon, label: "Document", hint: "Curate content", inFolder: true },
  { key: "proposal", icon: ReceiptTextIcon, label: "Proposal or Contract", hint: "Prepare offers for clients", inFolder: true },
  { key: "client", icon: UserIcon, label: "Client", hint: "Invite clients to your workspace", inFolder: false },
];

/** Dialog title for a type — "Create Board", "Create Proposal or Contract". */
const TITLE = Object.fromEntries(ROWS.map((r) => [r.key, r.label])) as Record<
  Creatable,
  string
>;

export function CreateMenu({
  folderId,
  folders = [],
  triggerClassName,
  initial,
  children,
}: {
  /** Set when opened from a folder — the dialogs then skip their picker. */
  folderId?: string;
  /**
   * Choices for the dialogs' folder picker. Only id and name are read, so
   * callers pass whatever folder shape they already have.
   */
  folders?: Array<{ id: string; name: string }>;
  triggerClassName?: string;
  /**
   * Skip the panel and open one type's dialog straight away. The home page's
   * Create cards use this — the card itself is the choice, so a dropdown in
   * between would be a step that asks nothing.
   */
  initial?: Creatable;
  /** Replaces the default `+ ⌄` trigger content. */
  children?: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<Creatable | null>(null);

  const choose = (key: Creatable) => {
    setOpen(false);
    setDialog(key);
  };

  // A folder-scoped type needs somewhere to go. With no folder in context and
  // none in the workspace, the row stays visible but inert rather than opening
  // a dialog whose picker would be empty.
  const enabled = (row: (typeof ROWS)[number]) =>
    !row.inFolder || Boolean(folderId) || folders.length > 0;

  const dialogs =
    dialog === "folder" ? (
      <CreateFolderDialog onClose={() => setDialog(null)} />
    ) : dialog ? (
      <CreateItemDialog
        type={dialog}
        title={TITLE[dialog]}
        folderId={folderId}
        folders={folders}
        onClose={() => setDialog(null)}
      />
    ) : null;

  // Card-style trigger: one button, one dialog, no panel in between.
  if (initial) {
    return (
      <>
        <button
          type="button"
          onClick={() => setDialog(initial)}
          className={triggerClassName}
        >
          {children}
        </button>
        {dialogs}
      </>
    );
  }

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen}>
        <DropdownMenuTrigger
          aria-label="Create"
          className={cn(
            "flex h-6 items-center gap-0.5 rounded-md px-1 text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84",
            triggerClassName,
          )}
        >
          {children ?? (
            <>
              <PlusIcon className="size-4" strokeWidth={1.7} />
              <ChevronDownIcon className="size-3" strokeWidth={1.7} />
            </>
          )}
        </DropdownMenuTrigger>

        <DropdownMenuContent
          align="start"
          sideOffset={6}
          className="!w-[324px] rounded-xl p-0 shadow-lg ring-k-black-08"
        >
          <div className="flex items-center justify-between border-k-black-06 border-b px-4 py-3">
            <span className="font-semibold text-k-black-84 text-section">
              Create
            </span>
            <button
              type="button"
              aria-label="Close"
              onClick={() => setOpen(false)}
              className="flex size-6 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
            >
              <XIcon className="size-4" strokeWidth={1.7} />
            </button>
          </div>

          <ul className="p-2">
            {ROWS.map((row) => {
              const live = enabled(row);
              return (
                <li key={row.key}>
                  <button
                    type="button"
                    disabled={!live}
                    aria-disabled={!live}
                    title={live ? undefined : "Create a folder first"}
                    onClick={() => choose(row.key)}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                      live ? "hover:bg-k-black-04" : "cursor-default opacity-45",
                    )}
                  >
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-k-black-04 text-k-black-84">
                      <row.icon className="size-[18px]" strokeWidth={1.6} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-k-black-84 text-md">
                        {row.label}
                      </span>
                      <span className="block truncate text-k-black-40 text-md">
                        {row.hint}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="border-k-black-06 border-t px-4 py-2.5">
            <span className="flex items-center justify-between text-k-black-40 text-md">
              More
              <ChevronRightIcon className="size-4" strokeWidth={1.7} />
            </span>
          </div>
        </DropdownMenuContent>
      </DropdownMenu>

      {dialogs}
    </>
  );
}
