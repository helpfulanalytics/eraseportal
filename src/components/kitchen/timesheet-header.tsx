"use client";

/**
 * Timesheet title + overflow menu, the same shape as `BoardHeader` minus
 * the colour picker — an hours ledger doesn't need one.
 */
import { useRef, useState, useTransition } from "react";
import {
  ClockIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import {
  deleteTimesheetAction,
  renameTimesheetAction,
} from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarButton } from "@/components/kitchen/star-button";
import { useOrgSlug } from "@/components/workspace-provider";
import { cn } from "@/lib/utils";

export function TimesheetHeader({
  timesheetId,
  folderId,
  name,
  starred,
  totalHours,
  canManage,
}: {
  timesheetId: string;
  folderId: string;
  name: string;
  starred?: boolean;
  totalHours: number;
  /** False for a client — they get the title and total, no rename/delete. */
  canManage: boolean;
}) {
  const orgSlug = useOrgSlug();
  const [title, setTitle] = useState(name);
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const commit = () => {
    setEditing(false);
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(name);
      return;
    }
    if (trimmed === name) return;

    setError(null);
    startTransition(async () => {
      try {
        await renameTimesheetAction(timesheetId, folderId, trimmed);
      } catch (cause) {
        setTitle(name);
        setError(
          cause instanceof Error ? cause.message : "Couldn't rename that.",
        );
      }
    });
  };

  const remove = () => {
    if (
      !window.confirm(`Delete "${name}"? This removes every logged entry. This can't be undone.`)
    ) {
      return;
    }
    startDelete(async () => {
      await deleteTimesheetAction(timesheetId, folderId);
      window.location.assign(`/w/${orgSlug}/folders/${folderId}`);
    });
  };

  const busy = pending || deleting;

  return (
    <div className="shrink-0 px-5 pb-4">
      <div className="flex items-center gap-2">
        <ClockIcon className="size-[18px] shrink-0 text-k-blue" strokeWidth={1.6} />

        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={title}
            disabled={busy}
            aria-label="Timesheet name"
            onChange={(e) => setTitle(e.target.value)}
            onBlur={commit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commit();
              }
              if (e.key === "Escape") {
                setTitle(name);
                setEditing(false);
              }
            }}
            className="min-w-0 flex-1 rounded-md border border-k-blue bg-background px-1.5 py-0.5 font-medium text-k-black-84 text-section outline-none ring-2 ring-k-blue-08 disabled:opacity-60"
          />
        ) : (
          <span className="min-w-0 truncate px-1.5 py-0.5 font-medium text-k-black-84 text-section">
            {title}
          </span>
        )}

        <span className="shrink-0 rounded-full bg-k-blue-08 px-2.5 py-0.5 font-medium text-k-blue text-sm tabular-nums">
          {totalHours} hr{totalHours === 1 ? "" : "s"}
        </span>

        {canManage ? (
          <>
            <StarButton kind="timesheet" id={timesheetId} starred={starred} />

            <DropdownMenu>
              <DropdownMenuTrigger
                aria-label="Timesheet options"
                disabled={busy}
                className={cn(
                  "flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84",
                  busy && "opacity-60",
                )}
              >
                <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditing(true)}>
                  <PencilIcon className="size-3.5" strokeWidth={1.8} />
                  Rename
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" disabled={deleting} onClick={remove}>
                  <TrashIcon className="size-3.5" strokeWidth={1.8} />
                  {deleting ? "Deleting…" : "Delete timesheet"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        ) : null}
      </div>

      {error ? <p role="alert" className="mt-1 text-k-red text-sm">{error}</p> : null}
    </div>
  );
}
