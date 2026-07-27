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
 * It's context-aware. Folder is always available; Conversation only when the
 * panel is opened from inside a folder, since a conversation has to belong to
 * one. Types the app can't create yet stay visible and legible but are marked
 * — a row that silently does nothing is worse than one that says why.
 *
 * Folder opens the Create Folder dialog, which has its own name, description
 * and access fields. Conversation only needs a name, so the panel collects it
 * in place rather than opening a second surface for one field.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
import { createConversationAction } from "@/app/(workspace)/actions";
import { CreateFolderDialog } from "@/components/kitchen/create-folder-dialog";
import { cn } from "@/lib/utils";

/**
 * What a row can make. Folder hands off to the full Create Folder dialog;
 * conversation only needs a name, so it collects that in the panel.
 */
type Creatable = "folder" | "conversation";

const ROWS: Array<{
  key: string;
  icon: React.ElementType;
  label: string;
  hint: string;
  creates?: Creatable;
}> = [
  { key: "folder", icon: FolderIcon, label: "Folder", hint: "Organize everything", creates: "folder" },
  { key: "board", icon: LayoutTemplateIcon, label: "Board", hint: "Track and manage projects" },
  { key: "conversation", icon: MessageSquareIcon, label: "Conversation", hint: "Discuss anything with clients", creates: "conversation" },
  { key: "embed", icon: LinkIcon, label: "Embed", hint: "Add third-party apps" },
  { key: "link", icon: ExternalLinkIcon, label: "Link", hint: "Share external resources" },
  { key: "document", icon: FileTextIcon, label: "Document", hint: "Curate content" },
  { key: "proposal", icon: ReceiptTextIcon, label: "Proposal or Contract", hint: "Prepare offers for clients" },
  { key: "client", icon: UserIcon, label: "Client", hint: "Invite clients to your workspace" },
];

export function CreateMenu({
  folderId,
  triggerClassName,
}: {
  /** Present when opened from a folder, which is what enables Conversation. */
  folderId?: string;
  triggerClassName?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [naming, setNaming] = useState<"conversation" | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (naming) inputRef.current?.focus();
  }, [naming]);

  const close = () => {
    setOpen(false);
    setNaming(null);
    setName("");
    setError(null);
  };

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed || !naming || pending) return;
    setError(null);

    startTransition(async () => {
      try {
        if (!folderId) return;
        const id = await createConversationAction(folderId, trimmed);
        close();
        router.push(`/conversations/${id}`);
      } catch {
        setError("Couldn't create that.");
      }
    });
  };

  const available = (row: (typeof ROWS)[number]) =>
    row.creates === "folder" || (row.creates === "conversation" && !!folderId);

  return (
    <>
    <DropdownMenu open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
      <DropdownMenuTrigger
        aria-label="Create"
        className={cn(
          "flex h-6 items-center gap-0.5 rounded-md px-1 text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84",
          triggerClassName,
        )}
      >
        <PlusIcon className="size-4" strokeWidth={1.7} />
        <ChevronDownIcon className="size-3" strokeWidth={1.7} />
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        sideOffset={6}
        className="!w-[324px] rounded-xl p-0 shadow-lg ring-k-black-08"
      >
        <div className="flex items-center justify-between border-k-black-06 border-b px-4 py-3">
          <span className="font-semibold text-k-black-84 text-section">
            {naming === "conversation" ? "New conversation" : "Create"}
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={close}
            className="flex size-6 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-4" strokeWidth={1.7} />
          </button>
        </div>

        {naming ? (
          <div className="p-3">
            <input
              ref={inputRef}
              value={name}
              disabled={pending}
              placeholder="Conversation name"
              aria-label="Conversation name"
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") { e.preventDefault(); submit(); }
                if (e.key === "Escape") { e.preventDefault(); setNaming(null); setName(""); }
              }}
              className="h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
            />
            {error ? (
              <p role="alert" className="mt-1.5 text-k-red text-sm">{error}</p>
            ) : null}
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setNaming(null); setName(""); setError(null); }}
                className="flex h-8 items-center rounded-lg px-3 text-k-black-56 text-md transition-colors hover:bg-k-black-04"
              >
                Back
              </button>
              <button
                type="button"
                disabled={!name.trim() || pending}
                onClick={submit}
                className="flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <ul className="p-2">
              {ROWS.map((row) => {
                const live = available(row);
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      disabled={!live}
                      aria-disabled={!live}
                      title={live ? undefined : "Not built yet"}
                      onClick={() => {
                        if (row.creates === "folder") {
                          close();
                          setFolderDialog(true);
                        } else if (row.creates === "conversation") {
                          setNaming("conversation");
                        }
                      }}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors",
                        live
                          ? "hover:bg-k-black-04"
                          : "cursor-default opacity-45",
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
                      {!live ? (
                        <span className="shrink-0 rounded bg-k-black-04 px-1.5 py-0.5 text-k-black-40 text-2xs">
                          Soon
                        </span>
                      ) : null}
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
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>

    {folderDialog ? (
      <CreateFolderDialog onClose={() => setFolderDialog(false)} />
    ) : null}
    </>
  );
}
