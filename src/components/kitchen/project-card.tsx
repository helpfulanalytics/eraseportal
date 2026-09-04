"use client";

/**
 * The workspace-home dashboard's card — a Project (Organization) for an
 * admin, a Folder ("workstation") for a client. Adapted from a ported design
 * (milestack's project-card.tsx), stripped of anything that doesn't apply
 * here: no `ProjectStatus`/milestone progress bar, since neither Organization
 * nor Folder carries that concept. Uses kitchen's own `--k-*` tokens, not the
 * source's literal zinc/emerald classes.
 *
 * A project card additionally carries its own manage menu (Edit/Rename/
 * Delete) — the "..." button is the primary trigger, matching every other
 * per-item menu in the app (folder/board headers), and right-click opens the
 * same menu since nothing else here has ever needed a native context menu.
 * It's a DOM sibling of the `Link`, not nested inside it, the same
 * eye-icon-over-a-link shape `FolderTile` already uses — two independently
 * clickable/focusable elements, no nested-interactive markup.
 */
import { MoreHorizontalIcon } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type ReactNode } from "react";
import {
  deleteOrganizationAction,
  renameOrganizationAction,
} from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function ProjectCard({
  href,
  title,
  subtitle,
  meta,
  activityLabel,
  color,
  orgId,
  onDeleted,
}: {
  href: string;
  /** e.g. a domain or a description — rendered as a single truncated line. */
  subtitle?: string;
  /** e.g. "3 folders · 2 clients" or "5 items". */
  meta: ReactNode;
  /** e.g. "Updated 3h ago" — omitted for a project with no activity yet. */
  activityLabel?: string;
  /** One of `SWATCH_COLORS`, if the underlying folder/org has one. */
  color?: string;
  title: string;
  /**
   * Set only for a project (organization) card — a client's folder card
   * passes nothing, and gets no manage menu. `href` is that project's
   * `/w/{slug}`, which doubles as the base for the Edit link.
   */
  orgId?: string;
  /** Removes this card from the dashboard grid once deletion succeeds. */
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [displayTitle, setDisplayTitle] = useState(title);
  const [menuOpen, setMenuOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const rename = () => {
    if (!orgId) return;
    const next = window.prompt("Rename project", displayTitle)?.trim();
    if (!next || next === displayTitle) return;

    const previous = displayTitle;
    setDisplayTitle(next);
    startTransition(async () => {
      try {
        await renameOrganizationAction(orgId, next);
      } catch (cause) {
        setDisplayTitle(previous);
        window.alert(
          cause instanceof Error ? cause.message : "Couldn't rename the project.",
        );
      }
    });
  };

  const remove = () => {
    if (!orgId) return;
    if (
      !window.confirm(
        `Delete "${displayTitle}"? This can't be undone.`,
      )
    )
      return;

    startTransition(async () => {
      try {
        await deleteOrganizationAction(orgId);
        onDeleted?.();
      } catch (cause) {
        window.alert(
          cause instanceof Error ? cause.message : "Couldn't delete the project.",
        );
      }
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
      className="group relative"
      onContextMenu={
        orgId
          ? (e) => {
              e.preventDefault();
              setMenuOpen(true);
            }
          : undefined
      }
    >
      <Link
        href={href}
        className={cn(
          "flex flex-col gap-3 rounded-xl border border-k-black-08 bg-background p-5 transition-colors hover:border-k-black-16 hover:bg-k-black-02",
          pending && "pointer-events-none opacity-50",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 size-2.5 shrink-0 rounded-full"
            style={{ background: color ?? "var(--k-black-24)" }}
            aria-hidden="true"
          />
          <div className={cn("min-w-0 flex-1", orgId && "pr-7")}>
            <h3 className="truncate font-medium text-k-black-84 text-md">
              {displayTitle}
            </h3>
            {subtitle ? (
              <p className="mt-0.5 truncate text-k-black-40 text-sm">{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-k-black-06 border-t pt-3 text-k-black-40 text-sm">
          <span className="truncate">{meta}</span>
          {activityLabel ? (
            <span className="shrink-0 text-k-black-40">{activityLabel}</span>
          ) : null}
        </div>
      </Link>

      {orgId ? (
        <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
          <DropdownMenuTrigger
            aria-label={`Options for ${displayTitle}`}
            disabled={pending}
            className="absolute top-3 right-3 flex size-7 items-center justify-center rounded-md text-k-black-36 opacity-0 transition-colors hover:bg-k-black-08 hover:text-k-black-84 focus-visible:opacity-100 group-hover:opacity-100"
          >
            <MoreHorizontalIcon className="size-4" strokeWidth={1.8} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            <DropdownMenuItem onClick={() => router.push(`${href}/settings`)}>
              Edit
            </DropdownMenuItem>
            <DropdownMenuItem onClick={rename}>Rename</DropdownMenuItem>
            <DropdownMenuItem variant="destructive" onClick={remove}>
              Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </motion.div>
  );
}
