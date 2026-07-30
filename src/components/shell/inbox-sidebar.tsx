"use client";

/**
 * The Inbox panel — a sidebar, not a page.
 *
 * It replaces the folder tree rather than sitting beside it (the rail's Inbox
 * button swaps one for the other), and it is its **own card**: a separate
 * rounded surface with its own hairline, with the page's card floating beside
 * it. That's the difference from `Sidebar`, which lives inside the page card
 * and is divided from it by a border.
 *
 * Because it's shell state, it stays open across navigation — clicking a chat
 * opens that conversation in the card next door and the list keeps its
 * scroll, its tab and its search. Which is the whole point of an inbox: you
 * work down it.
 *
 * Rows load through `loadInboxAction` the first time a tab is opened and are
 * then cached per tab, so switching back and forth is instant and the panel
 * costs nothing on pages where it's closed.
 */
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CheckIcon,
  FileTextIcon,
  LayoutTemplateIcon,
  LinkIcon,
  MessageSquareIcon,
  PaperclipIcon,
  RefreshCwIcon,
  SearchIcon,
  ShapesIcon,
  XIcon,
} from "lucide-react";
import {
  loadInboxAction,
  type InboxPayload,
  type InboxTab,
} from "@/app/(workspace)/inbox-actions";
import { PersonAvatar } from "@/components/kitchen/person-avatar";
import { usePeople } from "@/components/workspace-provider";
import { formatBytes, formatShortDate } from "@/lib/kitchen-format";
import type { ItemKind, ItemMeta } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

const TABS: Array<{ key: InboxTab; label: string }> = [
  { key: "chats", label: "Chats" },
  { key: "tasks", label: "Tasks" },
  { key: "files", label: "Files" },
  { key: "updates", label: "Updates" },
];

type Cache = Partial<Record<InboxTab, InboxPayload>>;

export function InboxSidebar({
  orgSlug,
  onClose,
}: {
  orgSlug: string;
  onClose: () => void;
}) {
  const pathname = usePathname();
  const people = usePeople();

  const [tab, setTab] = useState<InboxTab>("chats");
  const [cache, setCache] = useState<Cache>({});
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Which tabs have a load in flight or already done — so switching tabs
  // twice quickly doesn't fire the same read twice.
  const requested = useRef<Set<InboxTab>>(new Set());

  const load = useCallback(
    (which: InboxTab, { force }: { force?: boolean } = {}) => {
      if (!force && requested.current.has(which)) return;
      requested.current.add(which);
      setError(null);

      startTransition(async () => {
        try {
          const payload = await loadInboxAction(orgSlug, which);
          setCache((current) => ({ ...current, [which]: payload }));
        } catch (cause) {
          requested.current.delete(which);
          setError(
            cause instanceof Error ? cause.message : "Couldn't load the inbox.",
          );
        }
      });
    },
    [orgSlug],
  );

  // The panel mounts when it's opened and unmounts when it's closed, so this
  // is "load on open" — not a fetch that re-runs on every render.
  useEffect(() => {
    load(tab);
  }, [load, tab]);

  const payload = cache[tab];
  const rows = filterRows(toRows(payload, orgSlug), query, people);

  return (
    <aside
      aria-label="Inbox"
      className="mr-[var(--k-card-inset)] flex w-[380px] shrink-0 flex-col overflow-hidden rounded-2xl bg-background shadow-[0_0_0_0.5px_var(--k-black-08)]"
    >
      <div className="shrink-0 px-4 pt-4">
        <div className="flex items-center gap-1">
          <h2 className="min-w-0 flex-1 truncate font-medium text-k-black-84 text-section">
            Inbox
          </h2>
          <PanelAction
            label="Refresh"
            onClick={() => load(tab, { force: true })}
            disabled={pending}
          >
            <RefreshCwIcon
              className={cn("size-4", pending && "animate-spin")}
              strokeWidth={1.6}
            />
          </PanelAction>
          <PanelAction label="Close inbox" onClick={onClose}>
            <XIcon className="size-4" strokeWidth={1.6} />
          </PanelAction>
        </div>

        <div className="mt-3 flex h-8 items-center gap-2 rounded-lg border border-k-black-08 px-2.5 focus-within:border-k-blue">
          <SearchIcon className="size-3.5 shrink-0 text-k-gray-ad" strokeWidth={1.7} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search the inbox"
            placeholder="Search this inbox..."
            className="min-w-0 flex-1 bg-transparent text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
          />
          {query ? (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="shrink-0 text-k-black-36 transition-colors hover:text-k-black-84"
            >
              <XIcon className="size-3.5" strokeWidth={1.8} />
            </button>
          ) : null}
        </div>

        {/*
          Buttons, not links: the tab is panel state. Routing it would put the
          Inbox back in the URL, and the URL belongs to the page next door.
        */}
        <div
          role="tablist"
          aria-label="Inbox sections"
          className="mt-3 flex items-center gap-5 border-k-black-06 border-b"
        >
          {TABS.map((entry) => (
            <button
              key={entry.key}
              type="button"
              role="tab"
              id={`inbox-tab-${entry.key}`}
              aria-selected={tab === entry.key}
              aria-controls="inbox-tabpanel"
              onClick={() => setTab(entry.key)}
              className={cn(
                "-mb-px border-b-2 pb-2 text-md transition-colors",
                tab === entry.key
                  ? "border-k-black-84 text-k-black-84"
                  : "border-transparent text-k-black-40 hover:text-k-black-72",
              )}
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      <div
        id="inbox-tabpanel"
        role="tabpanel"
        aria-labelledby={`inbox-tab-${tab}`}
        className="min-h-0 flex-1 overflow-y-auto"
      >
        {error ? (
          <div className="px-4 py-10 text-center">
            <p role="alert" className="text-k-red text-md">
              {error}
            </p>
            <button
              type="button"
              onClick={() => load(tab, { force: true })}
              className="mt-2 text-k-blue text-md hover:underline"
            >
              Try again
            </button>
          </div>
        ) : !payload ? (
          <LoadingRows />
        ) : rows.length === 0 ? (
          <p className="px-4 py-10 text-center text-k-black-40 text-md">
            {query ? `Nothing matches "${query}".` : emptyCopy(tab)}
          </p>
        ) : (
          <ul>
            {rows.map((row) => (
              <li key={row.key} className="border-k-black-06 border-b last:border-b-0">
                <Row row={row} pathname={pathname} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </aside>
  );
}

/* ---- rows -------------------------------------------------------------- */

/**
 * One shape for every tab's row, so the list renders once instead of four
 * times. Building it here rather than in each branch is what keeps the
 * search filter and the empty state from having to know which tab they're on.
 */
interface RowModel {
  key: string;
  href?: string;
  authorId?: string;
  /** Icon shown instead of an avatar — files and updates have no author face. */
  glyph?: React.ReactNode;
  title: string;
  date: string;
  body: string;
  breadcrumb: string;
  muted?: boolean;
  /** Right-hand marker: attachment count, "Note", a due date. */
  badge?: string;
  strikethrough?: boolean;
}

function Row({ row, pathname }: { row: RowModel; pathname: string }) {
  const people = usePeople();
  const author = row.authorId ? people[row.authorId] : undefined;
  // A chat row's href carries a `#messageId`, which `usePathname` never
  // returns — compare the path part or every chat row reads as inactive.
  const active = Boolean(row.href && pathname === row.href.split("#")[0]);

  const inner = (
    <>
      <div className="flex items-center gap-2">
        {row.authorId ? (
          <PersonAvatar personId={row.authorId} className="size-4" />
        ) : (
          <span className="flex size-4 shrink-0 items-center justify-center text-k-black-40">
            {row.glyph}
          </span>
        )}
        <span className="min-w-0 flex-1 truncate font-semibold text-k-black-84 text-md">
          {author?.name || row.title || "Someone"}
        </span>
        {row.badge ? (
          <span className="shrink-0 rounded bg-k-black-04 px-1.5 py-px text-k-black-56 text-sm">
            {row.badge}
          </span>
        ) : null}
        <span className="shrink-0 text-k-black-40 text-md">{row.date}</span>
      </div>

      <p
        className={cn(
          "mt-1 line-clamp-2 text-k-black-84 text-md",
          row.muted && "text-k-black-56 italic",
          row.strikethrough && "text-k-black-36 line-through",
        )}
      >
        {row.body}
      </p>
      <p className="mt-1 truncate text-k-black-36 text-md">{row.breadcrumb}</p>
    </>
  );

  const className = cn(
    "block w-full px-4 py-3 text-left transition-colors",
    active ? "bg-k-blue-06" : "hover:bg-k-black-02",
  );

  if (!row.href) {
    return <div className={cn(className, "cursor-default")}>{inner}</div>;
  }

  return (
    <Link href={row.href} aria-current={active ? "page" : undefined} className={className}>
      {inner}
    </Link>
  );
}

function toRows(
  payload: InboxPayload | undefined,
  orgSlug: string,
): RowModel[] {
  if (!payload) return [];

  switch (payload.tab) {
    case "chats":
      return payload.rows.map((message) => ({
        key: message.id,
        // Deep-links to the message, the way the conversation view's own
        // permalinks do.
        href: `/w/${orgSlug}/conversations/${message.conversationId}#${message.id}`,
        authorId: message.authorId,
        title: "",
        date: formatShortDate(message.createdAt),
        body: message.preview || "(no text)",
        breadcrumb: `${message.folderName} / ${message.conversationName}`,
        badge: message.isNote
          ? "Note"
          : message.attachmentCount > 0
            ? `${message.attachmentCount} file${message.attachmentCount === 1 ? "" : "s"}`
            : undefined,
      }));

    case "tasks":
      return payload.rows.map((task) => ({
        key: task.id,
        href: `/w/${orgSlug}/tasks`,
        authorId: task.assigneeId ?? task.authorId,
        glyph: <CheckIcon className="size-3.5" strokeWidth={2} />,
        title: "Unassigned",
        date: task.dueDate ? formatShortDate(task.dueDate) : "—",
        body: task.title,
        breadcrumb: task.folderName,
        badge: task.completed ? "Done" : undefined,
        strikethrough: task.completed,
      }));

    case "files":
      return payload.rows.map((file) => ({
        key: `${file.source}-${file.id}`,
        href: `/w/${orgSlug}/library`,
        authorId: file.authorId,
        title: file.name,
        date: formatShortDate(file.createdAt),
        body: file.name,
        breadcrumb: `${file.source} • ${file.label} • ${formatBytes(file.bytes)}`,
      }));

    case "updates":
      return payload.rows.map((item) => ({
        key: item.id,
        href: activityHref(item.kind, item.id, orgSlug),
        authorId: item.authorId,
        glyph: <KindGlyph kind={item.kind} meta={item.meta} />,
        title: item.name,
        date: formatShortDate(item.createdAt),
        body: `added ${describeKind(item.kind, item.meta)} — ${item.name}`,
        breadcrumb: item.folderName,
        muted: true,
      }));
  }
}

/**
 * A near-duplicate of `itemHref`, which takes a whole `FolderItem`. An
 * activity row carries only the three fields a URL needs, so widening it to
 * satisfy that signature would mean shipping fields nothing renders.
 */
function activityHref(kind: ItemKind, id: string, orgSlug: string): string | undefined {
  switch (kind) {
    case "conversation":
      return `/w/${orgSlug}/conversations/${id}`;
    case "board":
      return `/w/${orgSlug}/boards/${id}`;
    case "document":
      return `/w/${orgSlug}/documents/${id}`;
    case "embed":
      return `/w/${orgSlug}/embeds/${id}`;
    default:
      // An uploaded file has no page of its own — same as everywhere else.
      return undefined;
  }
}

function describeKind(kind: ItemKind, meta: ItemMeta): string {
  if (kind === "document") {
    return meta.type === "document" && meta.docKind === "canvas"
      ? "a board"
      : "a document";
  }
  if (kind === "embed") {
    return meta.type === "embed" && meta.provider === "Link" ? "a link" : "an embed";
  }
  if (kind === "conversation") return "a conversation";
  if (kind === "board") return "a board";
  return "a file";
}

function KindGlyph({ kind, meta }: { kind: ItemKind; meta: ItemMeta }) {
  const className = "size-3.5";
  if (kind === "conversation") return <MessageSquareIcon className={className} strokeWidth={1.7} />;
  if (kind === "board") return <LayoutTemplateIcon className={className} strokeWidth={1.7} />;
  if (kind === "embed") return <LinkIcon className={className} strokeWidth={1.7} />;
  if (kind === "document") {
    return meta.type === "document" && meta.docKind === "canvas" ? (
      <ShapesIcon className={className} strokeWidth={1.7} />
    ) : (
      <FileTextIcon className={className} strokeWidth={1.7} />
    );
  }
  return <PaperclipIcon className={className} strokeWidth={1.7} />;
}

/* ---- filtering and states ---------------------------------------------- */

function filterRows(
  rows: RowModel[],
  query: string,
  people: Record<string, { name: string }>,
): RowModel[] {
  const q = query.trim().toLowerCase();
  if (!q) return rows;

  return rows.filter((row) => {
    const author = row.authorId ? people[row.authorId]?.name ?? "" : "";
    return `${author} ${row.title} ${row.body} ${row.breadcrumb}`
      .toLowerCase()
      .includes(q);
  });
}

function emptyCopy(tab: InboxTab): string {
  switch (tab) {
    case "chats":
      return "No messages yet. Start a conversation in any folder.";
    case "tasks":
      return "No tasks in this workspace's folders.";
    case "files":
      return "No files yet — upload one to a folder or attach it to a message.";
    case "updates":
      return "Nothing has been created here yet.";
  }
}

function LoadingRows() {
  return (
    <ul aria-busy="true" aria-label="Loading">
      {[0, 1, 2, 3, 4].map((i) => (
        <li key={i} className="border-k-black-06 border-b px-4 py-3.5 last:border-b-0">
          <div className="flex items-center gap-2">
            <span className="size-4 shrink-0 animate-pulse rounded-full bg-k-black-06" />
            <span className="h-3 w-28 animate-pulse rounded bg-k-black-06" />
          </div>
          <span className="mt-2 block h-3 w-full animate-pulse rounded bg-k-black-04" />
          <span className="mt-1.5 block h-3 w-2/3 animate-pulse rounded bg-k-black-04" />
        </li>
      ))}
    </ul>
  );
}

function PanelAction({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84 disabled:opacity-50"
    >
      {children}
    </button>
  );
}
