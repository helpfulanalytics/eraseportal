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
 * Choosing a row swaps the panel for the fields that type actually needs —
 * a folder to live in, a URL, an email — rather than opening a second surface
 * for one or two inputs. Folder is the exception: it has its own dialog,
 * because it carries a description and an access level too.
 *
 * Two rows map onto types the domain model doesn't have. Link is stored as an
 * embed whose provider says "Link", and Proposal or Contract as a document.
 * Both are noted on the accessors; the distinction is presentational until
 * either needs to render differently.
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
import {
  createBoardAction,
  createClientAction,
  createConversationAction,
  createDocumentAction,
  createEmbedAction,
} from "@/app/(workspace)/actions";
import { CreateFolderDialog } from "@/components/kitchen/create-folder-dialog";
import { cn } from "@/lib/utils";

export type Creatable =
  | "folder"
  | "board"
  | "conversation"
  | "embed"
  | "link"
  | "document"
  | "proposal"
  | "client";

interface Spec {
  key: Creatable;
  icon: React.ElementType;
  label: string;
  hint: string;
  /** Lives inside a folder, so it needs one chosen before it can be made. */
  inFolder: boolean;
  /** Shows a URL field. */
  url?: boolean;
  namePlaceholder: string;
}

const ROWS: Spec[] = [
  { key: "folder", icon: FolderIcon, label: "Folder", hint: "Organize everything", inFolder: false, namePlaceholder: "Folder name" },
  { key: "board", icon: LayoutTemplateIcon, label: "Board", hint: "Track and manage projects", inFolder: true, namePlaceholder: "Board name" },
  { key: "conversation", icon: MessageSquareIcon, label: "Conversation", hint: "Discuss anything with clients", inFolder: true, namePlaceholder: "Conversation name" },
  { key: "embed", icon: LinkIcon, label: "Embed", hint: "Add third-party apps", inFolder: true, url: true, namePlaceholder: "Embed name" },
  { key: "link", icon: ExternalLinkIcon, label: "Link", hint: "Share external resources", inFolder: true, url: true, namePlaceholder: "Link name" },
  { key: "document", icon: FileTextIcon, label: "Document", hint: "Curate content", inFolder: true, namePlaceholder: "Document name" },
  { key: "proposal", icon: ReceiptTextIcon, label: "Proposal or Contract", hint: "Prepare offers for clients", inFolder: true, namePlaceholder: "Proposal name" },
  { key: "client", icon: UserIcon, label: "Client", hint: "Invite clients to your workspace", inFolder: false, namePlaceholder: "Client name" },
];

export function CreateMenu({
  folderId,
  folders = [],
  triggerClassName,
  initial,
  children,
}: {
  /** Set when opened from a folder — skips the folder picker. */
  folderId?: string;
  /**
   * Choices for the picker when there's no folder in context. Only id and
   * name are used, so callers can pass whatever folder shape they already
   * have — `NavFolder[]` from the sidebar, `Folder[]` from a page.
   */
  folders?: Array<{ id: string; name: string }>;
  triggerClassName?: string;
  /**
   * Skip the row list and open straight into one type's fields. Used by the
   * home page's Create cards, where the card *is* the choice.
   */
  initial?: Creatable;
  /** Replaces the default `+ ⌄` trigger content. */
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState<Spec | null>(null);
  const [folderDialog, setFolderDialog] = useState(false);

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (active) nameRef.current?.focus();
  }, [active]);

  const reset = () => {
    setActive(null);
    setName("");
    setUrl("");
    setEmail("");
    setTarget("");
    setError(null);
  };

  const close = () => {
    setOpen(false);
    reset();
  };

  const choose = (row: Spec) => {
    if (row.key === "folder") {
      close();
      setFolderDialog(true);
      return;
    }
    setTarget(folderId ?? folders[0]?.id ?? "");
    setActive(row);
  };

  const submit = () => {
    if (!active || pending) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const dest = folderId ?? target;
    if (active.inFolder && !dest) {
      setError("Pick a folder first.");
      return;
    }
    setError(null);

    startTransition(async () => {
      try {
        switch (active.key) {
          case "board":
            close();
            router.push(`/boards/${await createBoardAction(dest, trimmed)}`);
            break;
          case "conversation":
            close();
            router.push(
              `/conversations/${await createConversationAction(dest, trimmed)}`,
            );
            break;
          // A proposal is a document; the model has no separate type.
          case "document":
          case "proposal":
            close();
            router.push(`/documents/${await createDocumentAction(dest, trimmed)}`);
            break;
          case "embed":
          case "link": {
            const id = await createEmbedAction(
              dest,
              trimmed,
              url,
              active.key === "link" ? "Link" : "Embed",
            );
            close();
            router.push(`/embeds/${id}`);
            break;
          }
          case "client":
            await createClientAction(trimmed, email);
            close();
            router.push("/clients");
            break;
        }
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't create that.",
        );
      }
    });
  };

  // Everything is creatable now, except folder-scoped types when the workspace
  // has no folder at all and none is in context — there'd be nowhere to put it.
  const enabled = (row: Spec) =>
    !row.inFolder || Boolean(folderId) || folders.length > 0;

  const needsPicker = active?.inFolder && !folderId;
  const canSubmit =
    Boolean(name.trim()) &&
    !pending &&
    (!active?.url || Boolean(url.trim())) &&
    (active?.key !== "client" || Boolean(email.trim()));

  return (
    <>
      <DropdownMenu
        open={open}
        onOpenChange={(next) => {
          if (!next) return close();
          setOpen(true);
          // Opening a card-style trigger goes straight to its form. Done here
          // rather than in an effect, which the React Compiler rule forbids.
          const preset = initial && ROWS.find((r) => r.key === initial);
          if (preset) choose(preset);
        }}
      >
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
              {active ? `New ${active.label.toLowerCase()}` : "Create"}
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

          {active ? (
            <div className="flex flex-col gap-2.5 p-3">
              {needsPicker ? (
                <select
                  value={target}
                  aria-label="Folder"
                  disabled={pending}
                  onChange={(e) => setTarget(e.target.value)}
                  className="h-9 w-full rounded-lg border border-k-black-12 bg-background px-2.5 text-k-black-84 text-md outline-none focus:border-k-blue disabled:opacity-60"
                >
                  {folders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              ) : null}

              <input
                ref={nameRef}
                value={name}
                disabled={pending}
                placeholder={active.namePlaceholder}
                aria-label={active.namePlaceholder}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") { e.preventDefault(); submit(); }
                  if (e.key === "Escape") { e.preventDefault(); reset(); }
                }}
                className="h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
              />

              {active.url ? (
                <input
                  value={url}
                  disabled={pending}
                  placeholder="https://example.com"
                  aria-label="URL"
                  onChange={(e) => setUrl(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submit(); }
                  }}
                  className="h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
                />
              ) : null}

              {active.key === "client" ? (
                <input
                  value={email}
                  type="email"
                  disabled={pending}
                  placeholder="client@example.com"
                  aria-label="Client email"
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") { e.preventDefault(); submit(); }
                  }}
                  className="h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60"
                />
              ) : null}

              {error ? (
                <p role="alert" className="text-k-red text-sm">{error}</p>
              ) : null}

              <div className="mt-0.5 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={initial ? close : reset}
                  className="flex h-8 items-center rounded-lg px-3 text-k-black-56 text-md transition-colors hover:bg-k-black-04"
                >
                  {initial ? "Cancel" : "Back"}
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
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
                  const live = enabled(row);
                  return (
                    <li key={row.key}>
                      <button
                        type="button"
                        disabled={!live}
                        aria-disabled={!live}
                        title={live ? undefined : "Create a folder first"}
                        onClick={() => choose(row)}
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
