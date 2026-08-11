"use client";

/**
 * The workspace-home dashboard's card — an Organization for an admin, a
 * Folder ("workstation") for a client. Adapted from a ported design
 * (milestack's project-card.tsx), stripped of anything that doesn't apply
 * here: no `ProjectStatus`/milestone progress bar, since neither Organization
 * nor Folder carries that concept. Uses kitchen's own `--k-*` tokens, not the
 * source's literal zinc/emerald classes.
 */
import { motion } from "motion/react";
import Link from "next/link";
import type { ReactNode } from "react";

export function ProjectCard({
  href,
  title,
  subtitle,
  meta,
  activityLabel,
  color,
}: {
  href: string;
  title: string;
  /** e.g. a domain or a description — rendered as a single truncated line. */
  subtitle?: string;
  /** e.g. "3 folders · 2 clients" or "5 items". */
  meta: ReactNode;
  /** e.g. "Updated 3h ago" — omitted for a project with no activity yet. */
  activityLabel?: string;
  /** One of `SWATCH_COLORS`, if the underlying folder/org has one. */
  color?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 340, damping: 32 }}
    >
      <Link
        href={href}
        className="flex flex-col gap-3 rounded-xl border border-k-black-08 bg-background p-5 transition-colors hover:border-k-black-16 hover:bg-k-black-02"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-0.5 size-2.5 shrink-0 rounded-full"
            style={{ background: color ?? "var(--k-black-24)" }}
            aria-hidden="true"
          />
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-medium text-k-black-84 text-md">{title}</h3>
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
    </motion.div>
  );
}
