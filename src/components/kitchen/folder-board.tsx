"use client";

/**
 * The client workspace home, restyled after the bagui dashboard-folder
 * reference: folders animate open on hover/select instead of sitting as flat
 * cards. Clicking a tile navigates straight into that folder — the primary
 * action stays one click, not a click-to-preview-then-click-to-enter detour.
 * A small eye icon on each tile is the secondary path: it opens a right-hand
 * details panel (item list, color, last-activity) for a quick peek without
 * leaving the dashboard. The panel fetches `getFolderPanelItems` for the
 * previewed folder rather than carrying a mock dataset.
 */
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import {
  ArrowRightIcon,
  EyeIcon,
  FolderIcon,
  FolderOpenIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  getFolderPanelItems,
  type FolderPanelRow,
} from "@/app/w/[orgSlug]/folder-panel-actions";
import { ItemThumb } from "@/components/kitchen/item-thumb";
import type { ItemKind } from "@/lib/kitchen-types";
import { cn } from "@/lib/utils";

export interface FolderBoardItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  meta: string;
  activityLabel?: string;
  color?: string;
}

export function FolderBoard({
  orgSlug,
  items,
  isAdmin = false,
  createSlot,
}: {
  orgSlug: string;
  items: FolderBoardItem[];
  /** Admins get a "Create your first folder" empty state instead of the client one. */
  isAdmin?: boolean;
  /** Rendered next to search, and again inside the empty state — e.g. a "New folder" CreateMenu trigger. */
  createSlot?: React.ReactNode;
}) {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === "Escape") setSelectedId(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, search]);

  const selected = items.find((item) => item.id === selectedId) ?? null;

  return (
    <div className="flex items-start gap-6">
      <section className="min-w-0 flex-1">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full max-w-[280px]">
            <SearchIcon
              className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-k-gray-ad"
              strokeWidth={1.7}
              aria-hidden="true"
            />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search folders"
              aria-label="Search folders"
              className="h-8 w-full rounded-lg border border-k-black-08 bg-background pr-2.5 pl-8 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-black-16"
            />
          </div>
          {createSlot}
        </div>

        {items.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: "spring", stiffness: 340, damping: 32 }}
            className="flex flex-col items-center gap-3 rounded-xl border border-k-black-08 border-dashed px-6 py-16 text-center"
          >
            <div className="flex size-12 items-center justify-center rounded-full bg-k-black-04-solid text-k-black-40">
              <FolderIcon className="size-6" aria-hidden="true" />
            </div>
            <h2 className="font-semibold text-k-black-84 text-section">
              {isAdmin ? "Create your first folder" : "Nothing here yet"}
            </h2>
            <p className="max-w-sm text-k-black-40 text-md">
              {isAdmin
                ? "Set up a folder to get this client's workspace started."
                : "Check back once your agency sets up your workspace."}
            </p>
            {isAdmin ? createSlot : null}
          </motion.div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center gap-2 rounded-xl border border-k-black-08 border-dashed px-6 py-16 text-center">
            <p className="font-medium text-k-black-72 text-md">
              No folders match &ldquo;{search}&rdquo;
            </p>
            <button
              type="button"
              onClick={() => setSearch("")}
              className="text-k-blue text-md underline underline-offset-2 hover:opacity-80"
            >
              Clear search
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((item) => (
              <FolderTile
                key={item.id}
                item={item}
                href={item.href}
                selected={item.id === selectedId}
                onPreview={() => setSelectedId((cur) => (cur === item.id ? null : item.id))}
              />
            ))}
          </div>
        )}
      </section>

      <AnimatePresence>
        {selected ? (
          <FolderDetailsPanel
            key={selected.id}
            orgSlug={orgSlug}
            item={selected}
            onClose={() => setSelectedId(null)}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

/**
 * A folder tile with the hover/select "open" animation. Clicking the tile
 * always navigates (`href`) — that's the one-click primary action. When
 * `onPreview` is also passed (the main `FolderBoard` grid), a small eye
 * icon layered on top of the tile opens the dashboard's side panel for a
 * quick peek instead, without leaving the page. It's a DOM sibling of the
 * link rather than nested inside it, so both stay independently clickable
 * and keyboard-focusable. `SubfolderGrid` passes only `href` — a folder
 * inside a folder page has nowhere useful to preview into, it just goes
 * there.
 */
export function FolderTile({
  item,
  selected = false,
  onPreview,
  href,
}: {
  item: FolderBoardItem;
  selected?: boolean;
  onPreview?: () => void;
  href?: string;
}) {
  const [hovered, setHovered] = useState(false);
  const open = hovered || selected;
  const tint = item.color ?? "var(--k-black-24)";
  const hasPreview = Boolean(onPreview);

  const className = cn(
    "flex w-full flex-col gap-3 rounded-xl border bg-background p-5 text-left transition-colors",
    selected
      ? "border-k-blue bg-k-blue-08"
      : "border-k-black-08 hover:border-k-black-16 hover:bg-k-black-02",
  );
  const handlers = {
    onMouseEnter: () => setHovered(true),
    onMouseLeave: () => setHovered(false),
  };

  const body = (
    <>
      <div className="flex items-start gap-3">
          <motion.span
            animate={{ y: open ? -2 : 0, rotate: open ? -4 : 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)` }}
            aria-hidden="true"
          >
            <AnimatePresence mode="wait" initial={false}>
              {open ? (
                <motion.span
                  key="open"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.12 }}
                >
                  <FolderOpenIcon className="size-4.5" style={{ color: tint }} strokeWidth={1.8} />
                </motion.span>
              ) : (
                <motion.span
                  key="closed"
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.85 }}
                  transition={{ duration: 0.12 }}
                >
                  <FolderIcon className="size-4.5" style={{ color: tint }} strokeWidth={1.8} />
                </motion.span>
              )}
            </AnimatePresence>
          </motion.span>
          <div className={cn("min-w-0 flex-1", hasPreview && "pr-7")}>
            <h3 className="truncate font-medium text-k-black-84 text-md">{item.title}</h3>
            {item.subtitle ? (
              <p className="mt-0.5 truncate text-k-black-40 text-sm">{item.subtitle}</p>
            ) : null}
          </div>
        </div>

      <div className="flex items-center justify-between gap-2 border-k-black-06 border-t pt-3 text-k-black-40 text-sm">
        <span className="truncate">{item.meta}</span>
        {item.activityLabel ? (
          <span className="shrink-0 text-k-black-40">{item.activityLabel}</span>
        ) : null}
      </div>
    </>
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="relative"
    >
      {href ? (
        <Link href={href} className={className} {...handlers}>
          {body}
        </Link>
      ) : (
        <button type="button" onClick={onPreview} className={className} {...handlers}>
          {body}
        </button>
      )}
      {hasPreview ? (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onPreview?.();
          }}
          aria-label={selected ? `Close ${item.title} preview` : `Preview ${item.title}`}
          aria-pressed={selected}
          className={cn(
            "absolute top-3 right-3 flex size-7 shrink-0 items-center justify-center rounded-md transition-colors",
            selected
              ? "bg-k-blue text-k-white"
              : "text-k-black-36 hover:bg-k-black-08 hover:text-k-black-84",
          )}
        >
          <EyeIcon className="size-3.5" strokeWidth={1.8} />
        </button>
      ) : null}
    </motion.div>
  );
}

function FolderDetailsPanel({
  orgSlug,
  item,
  onClose,
}: {
  orgSlug: string;
  item: FolderBoardItem;
  onClose: () => void;
}) {
  const [rows, setRows] = useState<FolderPanelRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // The panel remounts per folder (parent keys it by `item.id`), so this only
  // ever runs once per selection — no need to reset state before fetching.
  useEffect(() => {
    startTransition(() => {
      getFolderPanelItems(item.id, orgSlug)
        .then(setRows)
        .catch(() => setError("Couldn't load this folder's contents."));
    });
  }, [item.id, orgSlug]);

  const tint = item.color ?? "var(--k-black-24)";

  return (
    <motion.aside
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="sticky top-6 flex w-[320px] shrink-0 flex-col gap-4 rounded-xl border border-k-black-08 bg-background p-5"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <span
            className="flex size-8 shrink-0 items-center justify-center rounded-lg"
            style={{ background: `color-mix(in srgb, ${tint} 16%, transparent)` }}
            aria-hidden="true"
          >
            <FolderOpenIcon className="size-4" style={{ color: tint }} strokeWidth={1.8} />
          </span>
          <h2 className="truncate font-semibold text-k-black-84 text-md">{item.title}</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close folder details"
          className="flex size-6 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <XIcon className="size-3.5" strokeWidth={1.8} />
        </button>
      </div>

      {item.subtitle ? <p className="text-k-black-40 text-sm">{item.subtitle}</p> : null}

      <div className="flex items-center gap-3 text-k-black-40 text-sm">
        <span>{item.meta}</span>
        {item.activityLabel ? <span>{item.activityLabel}</span> : null}
      </div>

      <div className="border-k-black-06 border-t pt-4">
        <h3 className="mb-2 font-medium text-k-black-56 text-sm">Recent items</h3>

        {error ? (
          <p className="text-k-black-40 text-sm">{error}</p>
        ) : isPending || rows === null ? (
          <ul className="flex flex-col gap-2">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-9 animate-pulse rounded-md bg-k-black-04" />
            ))}
          </ul>
        ) : rows.length === 0 ? (
          <p className="text-k-black-40 text-sm">This folder is empty.</p>
        ) : (
          <ul className="flex flex-col gap-1">
            {rows.map((row) => (
              <li key={row.id}>
                {row.href ? (
                  <Link
                    href={row.href}
                    className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-k-black-04"
                  >
                    <PanelRowThumb row={row} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-k-black-84 text-sm">{row.name}</span>
                      <span className="block truncate text-k-black-40 text-xs">
                        {row.subtitle}
                      </span>
                    </span>
                  </Link>
                ) : (
                  <div className="flex items-center gap-2.5 rounded-md px-1.5 py-1.5">
                    <PanelRowThumb row={row} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-k-black-84 text-sm">{row.name}</span>
                      <span className="block truncate text-k-black-40 text-xs">
                        {row.subtitle}
                      </span>
                    </span>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        href={item.href}
        className="mt-auto flex h-8 items-center justify-center gap-1.5 rounded-lg bg-k-blue text-k-white text-md transition-opacity hover:opacity-90"
      >
        Open folder
        <ArrowRightIcon className="size-3.5" strokeWidth={1.8} />
      </Link>
    </motion.aside>
  );
}

/** `ItemThumb` only knows `ItemKind` — a subfolder row gets a plain folder glyph instead. */
function PanelRowThumb({ row }: { row: FolderPanelRow }) {
  if (row.kind === "folder") {
    return (
      <span className="flex h-9 w-8 shrink-0 items-center justify-center rounded-[3px] border border-k-black-12 bg-background">
        <FolderIcon className="size-3.5 text-k-black-56" strokeWidth={1.7} />
      </span>
    );
  }
  return <ItemThumb subject={row as FolderPanelRow & { kind: ItemKind }} />;
}
