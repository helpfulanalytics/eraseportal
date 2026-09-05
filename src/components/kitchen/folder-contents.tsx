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
  PencilIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import {
  deleteFolderItemAction,
  renameFolderItemAction,
  reorderFolderItemsAction,
} from "@/app/(workspace)/actions";

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
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import {
  FilePreviewDialog,
  type PreviewFile,
} from "@/components/kitchen/file-preview-dialog";
import { ItemThumb } from "@/components/kitchen/item-thumb";
import { UnreadBadge } from "@/components/kitchen/unread-badge";
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
  /** Unseen cards/comments (board) or messages (conversation). Absent for every other kind. */
  unreadCount?: number;
}

type Age = "any" | "today" | "week" | "month";

const AGE_LABEL: Record<Age, string> = {
  any: "Created",
  today: "Created today",
  week: "Created this week",
  month: "Created this month",
};

export function FolderContents({
  folderId,
  rows: initialRows,
  canManage,
  toolbarRight,
}: {
  folderId: string;
  rows: FolderRow[];
  /** Members can delete from the row menu; clients only read. */
  canManage: boolean;
  /** Create and Upload live here — they're server-rendered, so they're a slot. */
  toolbarRight: React.ReactNode;
}) {
  const router = useRouter();
  const people = usePeople();


  const [rows, setRows] = useState(initialRows);
  useEffect(() => {
    setRows(initialRows);
  }, [initialRows]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setRows((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        const next = arrayMove(items, oldIndex, newIndex);
        if (canManage) {
          startTransition(() => {
            reorderFolderItemsAction(folderId, next.map((i) => i.id)).catch(() => {});
          });
        }
        return next;
      });
    }
  };
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
  /** The row currently showing an editable name field instead of static text. */
  const [renamingId, setRenamingId] = useState<string | null>(null);
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

  /**
   * Optimistic: the row's name updates immediately, and only rolls back if
   * the write fails — matching `handleDragEnd`'s reorder, and the same
   * reason `renameBoardAction` et al. don't round-trip before showing the
   * new title on their own pages.
   */
  const rename = (row: FolderRow, name: string) => {
    const trimmed = name.trim();
    setRenamingId(null);
    if (!trimmed || trimmed === row.name) return;

    const previous = row.name;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: trimmed } : r)));
    startTransition(async () => {
      try {
        await renameFolderItemAction(row.kind, row.id, trimmed);
      } catch {
        setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, name: previous } : r)));
      }
    });
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
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={visible.map((r) => r.id)} strategy={rectSortingStrategy}>
              <ul className="grid grid-cols-2 gap-3 pt-4 lg:grid-cols-3 xl:grid-cols-4">
                {visible.map((row) => (
                  <SortableGridCardWrapper
                    key={row.id}
                    row={row}
                    busy={busyId === row.id}
                    canManage={canManage}
                    filtered={filtered}
                    renaming={renamingId === row.id}
                    onOpen={() => open(row)}
                    onDelete={() => remove(row)}
                    onRename={(name: string) => rename(row, name)}
                    onStartRename={() => setRenamingId(row.id)}
                  />
                ))}
              </ul>
            </SortableContext>
          </DndContext>
        ) : (

          <ul>
            {visible.map((row) => (
              <ListRow
                key={row.id}
                row={row}
                busy={busyId === row.id}
                canManage={canManage}
                renaming={renamingId === row.id}
                onOpen={() => open(row)}
                onDelete={() => remove(row)}
                onRename={(name: string) => rename(row, name)}
                onStartRename={() => setRenamingId(row.id)}
              />
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
 * The row's name, swapped for an editable field while renaming.
 *
 * Not a `<Link>`/button child while editing — clicking into the input must
 * not navigate. Enter commits, Escape reverts to `row.name` without writing,
 * and a blur commits too, so clicking away doesn't strand the row mid-edit.
 */
function NameField({
  row,
  renaming,
  onRename,
  className,
}: {
  row: FolderRow;
  renaming: boolean;
  onRename: (name: string) => void;
  className: string;
}) {
  // Keyed to `renaming` so the field remounts fresh (and re-syncs to the
  // current name) each time editing starts, instead of a `useEffect` writing
  // state on every render where `renaming` flips true.
  const [value, setValue] = useState(row.name);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      // Runs after the input mounts, and selects rather than just focusing —
      // renaming almost always means replacing the whole name, not editing
      // a character in the middle of it.
      requestAnimationFrame(() => inputRef.current?.select());
    }
  }, [renaming]);

  if (!renaming) {
    return <span className={className}>{row.name}</span>;
  }

  return (
    <input
      key={row.name}
      ref={inputRef}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          onRename(value);
        } else if (e.key === "Escape") {
          e.preventDefault();
          onRename(row.name);
        }
      }}
      onBlur={() => onRename(value)}
      className={cn(
        className,
        "w-full rounded-sm bg-k-blue-04 outline-none ring-1 ring-k-blue",
      )}
    />
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
  renaming,
  children,
}: {
  row: FolderRow;
  onOpen: () => void;
  /** While true, renders a plain (non-navigating) container — clicking into the name field must not follow the row's link. */
  renaming?: boolean;
  children: React.ReactNode;
}) {
  const className = "flex min-w-0 flex-1 items-center gap-3 text-left";

  if (renaming) {
    return <div className={className}>{children}</div>;
  }

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
  renaming,
  onOpen,
  onDelete,
  onRename,
  onStartRename,
}: {
  row: FolderRow;
  busy: boolean;
  canManage: boolean;
  renaming: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onRename: (name: string) => void;
  onStartRename: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setMenuOpen(true); };
  const handleDoubleClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(true); };

  const body = (
    <>
      <ItemThumb subject={{ ...row, url: row.embedUrl }} size="card" name={row.name} />
      <span className="mt-2 block w-full">
        <NameField
          row={row}
          renaming={renaming}
          onRename={onRename}
          className="block w-full truncate text-k-black-84 text-md"
        />
      </span>
      <span className="block w-full truncate text-k-black-40 text-sm">
        {row.subtitle}
      </span>
    </>
  );

  return (
    <div
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group/card relative flex h-full flex-col rounded-xl border border-k-black-08 p-3 transition-colors hover:border-k-black-16",
        busy && "opacity-50",
      )}
    >
      {row.unreadCount ? (
        <UnreadBadge count={row.unreadCount} className="absolute top-1.5 left-1.5" />
      ) : null}

      <div className="absolute top-1.5 right-1.5 opacity-0 transition-opacity group-hover/card:opacity-100">
        <RowMenu
          row={row}
          canManage={canManage}
          busy={busy}
          onOpen={onOpen}
          onDelete={onDelete}
          onStartRename={onStartRename}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </div>

      {renaming ? (
        <div className="flex w-full min-w-0 flex-col">{body}</div>
      ) : row.href ? (
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
  onStartRename,
  open,
  onOpenChange,
}: {
  row: FolderRow;
  canManage: boolean;
  busy: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onStartRename: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
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
    <DropdownMenu open={open} onOpenChange={onOpenChange}>
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
          <DropdownMenuItem onClick={onStartRename}>
            <PencilIcon className="size-3.5" strokeWidth={1.7} />
            Rename
          </DropdownMenuItem>
        ) : null}

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


function SortableGridCardWrapper(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: props.row.id, 
    disabled: !props.canManage || props.filtered 
  });
  
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: "relative" as any,
  };

  return (
    <li ref={setNodeRef} style={style} {...attributes} {...listeners} className="touch-none">
      <GridCard {...props} />
    </li>
  );
}

function SortableRowWrapper(props: any) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ 
    id: props.row.id, 
    disabled: !props.canManage || props.filtered 
  });
  const [menuOpen, setMenuOpen] = useState(false);
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setMenuOpen(true); };
  const handleDoubleClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(true); };

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
    position: "relative" as any,
  };

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group/row flex items-center gap-4 border-k-black-06 border-b px-3 py-2.5 transition-colors hover:bg-k-black-02 touch-none",
        props.busy && "opacity-50",
      )}
    >
      <RowTarget row={props.row} onOpen={props.onOpen} renaming={props.renaming}>
        <ItemThumb subject={{ ...props.row, url: props.row.embedUrl }} name={props.row.name} />
        <span className="min-w-0">
          <NameField
            row={props.row}
            renaming={props.renaming}
            onRename={props.onRename}
            className="block truncate text-k-black-84 text-md"
          />
          <span className="block truncate text-k-black-40 text-md">
            {props.row.subtitle}
          </span>
        </span>
        <UnreadBadge count={props.row.unreadCount} className="ml-auto" />
      </RowTarget>

      <span className="w-[160px] shrink-0 text-k-black-56 text-md">
        {formatShortDate(props.row.createdAt)}
      </span>

      <span className="flex w-8 shrink-0 justify-end">
        <RowMenu
          row={props.row}
          canManage={props.canManage}
          busy={props.busy}
          onOpen={props.onOpen}
          onDelete={props.onDelete}
          onStartRename={props.onStartRename}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </span>
    </li>
  );
}

function ListRow(props: any) {
  const [menuOpen, setMenuOpen] = useState(false);
  const handleContextMenu = (e: React.MouseEvent) => { e.preventDefault(); setMenuOpen(true); };
  const handleDoubleClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); setMenuOpen(true); };

  return (
    <li
      onContextMenu={handleContextMenu}
      onDoubleClick={handleDoubleClick}
      className={cn(
        "group/row flex items-center gap-4 border-k-black-06 border-b px-3 py-2.5 transition-colors hover:bg-k-black-02",
        props.busy && "opacity-50",
      )}
    >
      <RowTarget row={props.row} onOpen={props.onOpen} renaming={props.renaming}>
        <ItemThumb subject={{ ...props.row, url: props.row.embedUrl }} name={props.row.name} />
        <span className="min-w-0">
          <NameField
            row={props.row}
            renaming={props.renaming}
            onRename={props.onRename}
            className="block truncate text-k-black-84 text-md"
          />
          <span className="block truncate text-k-black-40 text-md">
            {props.row.subtitle}
          </span>
        </span>
        <UnreadBadge count={props.row.unreadCount} className="ml-auto" />
      </RowTarget>

      <span className="w-[160px] shrink-0 text-k-black-56 text-md">
        {formatShortDate(props.row.createdAt)}
      </span>

      <span className="flex w-8 shrink-0 justify-end">
        <RowMenu
          row={props.row}
          canManage={props.canManage}
          busy={props.busy}
          onOpen={props.onOpen}
          onDelete={props.onDelete}
          onStartRename={props.onStartRename}
          open={menuOpen}
          onOpenChange={setMenuOpen}
        />
      </span>
    </li>
  );
}
