"use client";

/**
 * The dashboard's project-card grid — an admin sees Organizations, a client
 * sees their org's Folders ("workstations"). Restyled from a ported layout
 * (milestack's dashboard/page.tsx): search-filtered card grid, ⌘K focuses
 * search, empty state differs by role since only admins can create one.
 */
import { FolderKanban, PlusIcon, SearchIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import { ProjectCard } from "@/components/kitchen/project-card";

export interface DashboardCardItem {
  id: string;
  href: string;
  title: string;
  subtitle?: string;
  meta: string;
  /** e.g. "Updated 3h ago" — absent for a project with no activity yet. */
  activityLabel?: string;
  color?: string;
  /** Set only for a project (organization) card — gives it the manage menu. */
  orgId?: string;
  /** Unseen board/conversation activity across everything inside this project. */
  unreadCount?: number;
}

export function DashboardProjectGrid({
  isAdmin,
  items: initialItems,
}: {
  isAdmin: boolean;
  items: DashboardCardItem[];
}) {
  const [search, setSearch] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

  // Local, optimistic copy so a delete can remove a card without waiting on
  // the server round trip + revalidatePath — same reset-on-prop-change shape
  // `BoardColumns` uses, a conditional setState in the render body rather
  // than an effect.
  const [items, setItems] = useState(initialItems);
  const [reconciledItems, setReconciledItems] = useState(initialItems);
  if (initialItems !== reconciledItems) {
    setReconciledItems(initialItems);
    setItems(initialItems);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;
    return items.filter((item) => item.title.toLowerCase().includes(query));
  }, [items, search]);

  const noun = isAdmin ? "project" : "workstation";

  return (
    <section>
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
            placeholder={`Search ${noun}s`}
            aria-label={`Search ${noun}s`}
            className="h-8 w-full rounded-lg border border-k-black-08 bg-background pr-2.5 pl-8 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-black-16"
          />
        </div>
        {isAdmin ? (
          <Link
            href="/admin/new"
            className="flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
          >
            <PlusIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
            New project
          </Link>
        ) : null}
      </div>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 340, damping: 32 }}
          className="flex flex-col items-center gap-3 rounded-xl border border-k-black-08 border-dashed px-6 py-16 text-center"
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-k-black-04-solid text-k-black-40">
            <FolderKanban className="size-6" aria-hidden="true" />
          </div>
          <h2 className="font-semibold text-k-black-84 text-section">
            {isAdmin ? "Create your first project" : "Nothing here yet"}
          </h2>
          <p className="max-w-sm text-k-black-40 text-md">
            {isAdmin
              ? "Set up a project and its first folder to get a client started."
              : "Check back once your agency sets up your workspace."}
          </p>
          {isAdmin ? (
            <Link
              href="/admin/new"
              className="mt-2 flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
            >
              <PlusIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
              New project
            </Link>
          ) : null}
        </motion.div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-k-black-08 border-dashed px-6 py-16 text-center">
          <p className="font-medium text-k-black-72 text-md">
            No {noun}s match &ldquo;{search}&rdquo;
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
            <ProjectCard
              key={item.id}
              href={item.href}
              title={item.title}
              subtitle={item.subtitle}
              meta={item.meta}
              activityLabel={item.activityLabel}
              color={item.color}
              orgId={item.orgId}
              unreadCount={item.unreadCount}
              onDeleted={() =>
                setItems((current) => current.filter((i) => i.id !== item.id))
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
