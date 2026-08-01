"use client";

/**
 * A folder's contents: the toolbar above the list, and the list itself.
 *
 * This exists because every control in that toolbar used to be a picture of a
 * control. Search was a `<div>` with placeholder text in it, the Author and
 * Created chips opened nothing, and the layout toggle at the right of the
 * header didn't toggle a layout. They filter and switch now, all client-side
 * — a folder holds tens of items, not thousands, so shipping the rows once
 * and narrowing them in the browser is both simpler and faster than a
 * round trip per keystroke.
 *
 * Rows do the right thing per kind: a board, document, conversation or embed
 * navigates to its page; a **file has no page**, so it opens a preview
 * instead. That's the other half of uploads finally being viewable.
 */
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckIcon,
  ChevronDownIcon,
  DownloadIcon,
  LayoutGridIcon,
  LayoutListIcon,
  LinkIcon,
  MoreHorizontalIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { deleteFolderItemAction } from "@/app/(workspace)/actions";
import {
  FilePreviewDialog,
  type PreviewFile,
} from "@/components/kitchen/file-preview-dialog";
import { ItemThumb } from "@/components/kitchen/item-thumb";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { usePeople } from "@/components/workspace-provider";
import { formatShortDate } from "@/lib/kitchen-format";
import type { ItemKind } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

/** What one row needs, flattened on the server so this stays presentational. */
export interface FolderRow {
  id: string;
  kind: ItemKind;
  name: string;
  /** Grey second line: "2 messages", "PDF • 1.6 MB", a document's first line. */
  subtitle: string;
  createdAt: string;
  authorId: string;
  /** Absent for files, which have no page of their own. */
  href?: string;
  file?: PreviewFile;
  /** Canvas documents and Link embeds get their own glyph. */
  variant?: "canvas" | "link";
  /** The external URL for embeds. */
  embedUrl?: string;
}

type Age = "any" | "today" | "week" | "month";

const AGE_LABEL: Record<Age, string> = {
  any: "Created",
  today: "Created today",
  week: "Created this week",
  month: "Created this month",
};

export function FolderContents({
  rows,
  canManage,
  toolbarRight,
}: {
  rows: FolderRow[];
  /** Members can delete from the row menu; clients only read. */
  canManage: boolean;
  /** Create and Upload live here — they're server-rendered, so they're a slot. */
  toolbarRight: React.ReactNode;
}) {
  const router = useRouter();
  const people = usePeople();

  const [query, setQuery] = useState("");
  const [author, setAuthor] = useState<string | null>(null);
  const [age, setAge] = useState<Age>("any");
  const [grid, setGridState] = useState(false);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem("kitchen-folder-grid");
      if (stored !== null) setGridState(stored === "true");
    } catch {
      // ignore
    }
  }, []);

  const setGrid = (val: boolean | ((v: boolean) => boolean)) => {
    setGridState((prev) => {
      const next = typeof val === "function" ? val(prev) : val;
      try {
        window.localStorage.setItem("kitchen-folder-grid", String(next));
      } catch {
        // ignore
      }
      return next;
    });
  };

  const [preview, setPreview] = useState<PreviewFile | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const authors = useMemo(() => {
    const ids = [...new Set(rows.map((row) => row.authorId))];
    return ids
      .map((id) => ({ id, name: people[id]?.name ?? "Unknown" }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [rows, people]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const cutoff = ageCutoff(age);

    return rows.filter((row) => {
      if (author && row.authorId !== author) return false;
      if (cutoff && new Date(row.createdAt).getTime() < cutoff) return false;
      if (!q) return true;

      const name = people[row.authorId]?.name ?? "";
      return `${row.name} ${row.subtitle} ${name}`.toLowerCase().includes(q);
    });
  }, [rows, query, author, age, people]);

  const open = (row: FolderRow) => {
    if (row.file) setPreview(row.file);
    else if (row.href) router.push(row.href);
  };

  const remove = (row: FolderRow) => {
    if (
      !window.confirm(`Delete "${row.name}"? This can't be undone.`)
    ) {
      return;
    }
    setBusyId(row.id);
    startTransition(async () => {
      try {
        await deleteFolderItemAction(row.kind, row.id);
      } finally {
        setBusyId(null);
      }
    });
  };

  const filtered = query.trim() !== "" || author !== null || age !== "any";

  return (
    <>
      <div className="mt-7 flex flex-wrap items-center gap-2">
        <div className="flex h-8 w-60 items-center gap-2 rounded-lg border border-k-black-08 px-3 focus-within:border-k-blue">
          <SearchIcon className="size-3.5 shrink-0 text-k-gray-ad" strokeWidth={1.7} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search this folder"
            placeholder="Search this folder..."
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

        <FilterChip
          label={author ? people[author]?.name ?? "Author" : "Author"}
          active={author !== null}
          options={[
            { key: "", label: "Anyone" },
            ...authors.map((a) => ({ key: a.id, label: a.name })),
          ]}
          selected={author ?? ""}
          onSelect={(key) => setAuthor(key || null)}
        />

        <FilterChip
          label={AGE_LABEL[age]}
          active={age !== "any"}
          options={[
            { key: "any", label: "Any time" },
            { key: "today", label: "Today" },
            { key: "week", label: "This week" },
            { key: "month", label: "This month" },
          ]}
          selected={age}
          onSelect={(key) => setAge(key as Age)}
        />

        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setAuthor(null);
              setAge("any");
            }}
            className="text-k-blue text-md hover:underline"
          >
            Clear
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-2">{toolbarRight}</div>
      </div>

      <div className="mt-7 w-full">
        <div className="flex items-center gap-4 border-k-black-06 border-b px-3 pb-2">
          <div className="min-w-0 flex-1 text-k-black-40 text-md">Name</div>
          <div className="w-[160px] shrink-0 text-k-black-40 text-md">Created</div>
          <div className="flex w-8 shrink-0 justify-end">
            <button
              type="button"
              onClick={() => setGrid((v) => !v)}
              aria-label={grid ? "Show as a list" : "Show as a grid"}
              aria-pressed={grid}
              title={grid ? "Show as a list" : "Show as a grid"}
              className="flex size-6 items-center justify-center rounded-md text-k-black-24 transition-colors hover:bg-k-black-04 hover:text-k-black-72"
            >
              {grid ? (
                <LayoutListIcon className="size-4" strokeWidth={1.7} />
              ) : (
                <LayoutGridIcon className="size-4" strokeWidth={1.7} />
              )}
            </button>
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="border-k-black-06 border-b py-8 text-center text-k-black-40 text-md">
            {rows.length === 0
              ? "This folder is empty."
              : "Nothing matches those filters."}
          </p>
        ) : grid ? (
          <ul className="grid grid-cols-2 gap-3 pt-4 lg:grid-cols-3 xl:grid-cols-4">
            {visible.map((row) => (
              <li key={row.id}>
                <GridCard
                  row={row}
                  busy={busyId === row.id}
                  canManage={canManage}
                  onOpen={() => open(row)}
                  onDelete={() => remove(row)}
                />
              </li>
            ))}
          </ul>
        ) : (
          <ul>
            {visible.map((row) => (
              <li
                key={row.id}
                className={cn(
                  "group/row flex items-center gap-4 border-k-black-06 border-b px-3 py-2.5 transition-colors hover:bg-k-black-02",
                  busyId === row.id && "opacity-50",
                )}
              >
                <RowTarget row={row} onOpen={() => open(row)}>
                  <ItemThumb subject={{ ...row, url: row.embedUrl }} name={row.name} />
                  <span className="min-w-0">
                    <span className="block truncate text-k-black-84 text-md">
                      {row.name}
                    </span>
                    <span className="block truncate text-k-black-40 text-md">
                      {row.subtitle}
                    </span>
                  </span>
                </RowTarget>

                <span className="w-[160px] shrink-0 text-k-black-56 text-md">
                  {formatShortDate(row.createdAt)}
                </span>

                <span className="flex w-8 shrink-0 justify-end">
                  <RowMenu
                    row={row}
                    canManage={canManage}
                    busy={busyId === row.id}
                    onOpen={() => open(row)}
                    onDelete={() => remove(row)}
                  />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {preview ? (
        <FilePreviewDialog file={preview} onClose={() => setPreview(null)} />
      ) : null}
    </>
  );
}

/**
 * A row that navigates is a real `<Link>` — middle-click, ⌘-click and "copy
 * link address" all have to keep working. A file has nowhere to navigate to,
 * so that one is a button that opens the preview.
 */
function RowTarget({
  row,
  onOpen,
  children,
}: {
  row: FolderRow;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 flex-1 items-center gap-3 text-left";

  if (row.href) {
    return (
      <Link href={row.href} className={className}>
        {children}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onOpen} className={className}>
      {children}
    </button>
  );
}

function GridCard({
  row,
  busy,
  canManage,
  onOpen,
  onDelete,
}: {
  row: FolderRow;
  busy: boolean;
  canManage: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const body = (
    <>
      <ItemThumb subject={{ ...row, url: row.embedUrl }} size="card" name={row.name} />
      <span className="mt-2 block w-full truncate text-k-black-84 text-md">
        {row.name}
      </span>
      <span className="block w-full truncate text-k-black-40 text-sm">
        {row.subtitle}
      </span>
    </>
  );

  return (
    <div
      className={cn(
        "group/card relative flex h-full flex-col rounded-xl border border-k-black-08 p-3 transition-colors hover:border-k-black-16",
        busy && "opacity-50",
      )}
    >
      <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/card:opacity-100">
        <RowMenu
          row={row}
          canManage={canManage}
          busy={busy}
          onOpen={onOpen}
          onDelete={onDelete}
        />
      </div>

      {row.href ? (
        <Link href={row.href} className="flex w-full min-w-0 flex-col">
          {body}
        </Link>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="flex w-full min-w-0 flex-col text-left"
        >
          {body}
        </button>
      )}
    </div>
  );
}

function RowMenu({
  row,
  canManage,
  busy,
  onOpen,
  onDelete,
}: {
  row: FolderRow;
  canManage: boolean;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = async () => {
    const target = row.href
      ? new URL(row.href, window.location.origin).toString()
      : row.file?.url;
    if (!target) return;

    try {
      await navigator.clipboard.writeText(target);
      setCopied(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 1500);
    } catch {
      // A denied clipboard permission isn't worth an error state on a menu
      // item — the link is still reachable by opening the row.
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Options for ${row.name}`}
        disabled={busy}
        className="flex size-6 items-center justify-center rounded-md text-k-black-24 opacity-0 transition-opacity hover:bg-k-black-04 hover:text-k-black-72 focus-visible:opacity-100 group-hover/card:opacity-100 group-hover/row:opacity-100 data-popup-open:opacity-100"
      >
        <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem onClick={onOpen}>
          {row.file ? "Preview" : "Open"}
        </DropdownMenuItem>

        {row.file?.url ? (
          <DropdownMenuItem
            onClick={() => {
              // A plain anchor click, so the browser handles the save dialog.
              const link = document.createElement("a");
              link.href = row.file?.url ?? "";
              link.download = row.name;
              link.click();
            }}
          >
            <DownloadIcon className="size-3.5" strokeWidth={1.7} />
            Download
          </DropdownMenuItem>
        ) : null}

        <DropdownMenuItem onClick={copy}>
          {copied ? (
            <>
              <CheckIcon className="size-3.5" strokeWidth={2} />
              Copied
            </>
          ) : (
            <>
              <LinkIcon className="size-3.5" strokeWidth={1.7} />
              Copy link
            </>
          )}
        </DropdownMenuItem>

        {canManage ? (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FilterChip({
  label,
  active,
  options,
  selected,
  onSelect,
}: {
  label: string;
  active: boolean;
  options: Array<{ key: string; label: string }>;
  selected: string;
  onSelect: (key: string) => void;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex h-8 items-center gap-1 rounded-lg px-3 text-md transition-colors",
          active
            ? "bg-k-blue-08 text-k-blue"
            : "bg-k-black-04 text-k-black-84 hover:bg-k-black-06",
        )}
      >
        {label}
        <ChevronDownIcon className="size-3.5 opacity-60" strokeWidth={1.8} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-52">
        {options.map((option) => (
          <DropdownMenuItem key={option.key} onClick={() => onSelect(option.key)}>
            <span className="flex w-3.5 shrink-0 justify-center">
              {option.key === selected ? (
                <CheckIcon className="size-3.5" strokeWidth={2} />
              ) : null}
            </span>
            {option.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Start of "today", "this week" or "this month" as a timestamp. */
function ageCutoff(age: Age): number | null {
  if (age === "any") return null;

  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (age === "today") return start.getTime();
  if (age === "week") return start.getTime() - 6 * 24 * 60 * 60 * 1000;
  return new Date(now.getFullYear(), now.getMonth(), 1).getTime();
}
