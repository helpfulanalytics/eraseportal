"use client";

/**
 * Folder title + overflow menu, mirroring `BoardHeader`'s pattern:
 * click-to-edit for the name, `window.confirm`/`window.alert` for delete
 * since no confirm-dialog primitive exists in this codebase yet.
 *
 * Delete is conditional — `deleteFolderAction` throws if the folder still
 * has items in it (see the comment on `deleteFolder` in kitchen-data.ts;
 * cascading five collections of nested content safely is a bigger, riskier
 * piece of work than the rest of this file). `itemCount` lets this head that
 * off with a clear message before even asking for confirmation, rather than
 * showing "Delete?" and then failing.
 */
import { useRef, useState, useTransition } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import {
  deleteFolderAction,
  renameFolderAction,
} from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function FolderHeaderControls({
  folderId,
  name,
  itemCount,
  triggerClassName,
}: {
  folderId: string;
  name: string;
  itemCount: number;
  triggerClassName?: string;
}) {
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
        await renameFolderAction(folderId, trimmed);
      } catch (cause) {
        setTitle(name);
        setError(
          cause instanceof Error ? cause.message : "Couldn't rename the folder.",
        );
      }
    });
  };

  const remove = () => {
    if (itemCount > 0) {
      window.alert(
        `This folder still has ${itemCount} item${itemCount === 1 ? "" : "s"} in it. Move or delete them before deleting the folder.`,
      );
      return;
    }
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;

    startDelete(async () => {
      try {
        await deleteFolderAction(folderId);
        window.location.assign("/");
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : "Couldn't delete the folder.",
        );
      }
    });
  };

  const busy = pending || deleting;

  return (
    <>
      {editing ? (
        <input
          ref={inputRef}
          autoFocus
          value={title}
          disabled={busy}
          aria-label="Folder name"
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
          className="min-w-0 flex-1 rounded-md border border-k-blue bg-background px-1.5 py-0.5 font-semibold text-k-black-84 text-title outline-none ring-2 ring-k-blue-08 disabled:opacity-60"
        />
      ) : (
        <button
          type="button"
          disabled={busy}
          onClick={() => setEditing(true)}
          className="-mx-1.5 min-w-0 truncate rounded-md px-1.5 py-0.5 text-left font-semibold text-k-black-84 text-title transition-colors hover:bg-k-black-04 disabled:opacity-60"
        >
          {title}
        </button>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="Folder options"
          disabled={busy}
          className={cn(
            "flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84",
            triggerClassName,
          )}
        >
          <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={deleting} onClick={remove}>
            {deleting ? "Deleting…" : "Delete folder"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {error ? (
        <p role="alert" className="basis-full text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </>
  );
}
