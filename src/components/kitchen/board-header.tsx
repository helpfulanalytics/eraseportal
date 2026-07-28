"use client";

/**
 * Board title + overflow menu — the two things a board needs beyond its
 * columns: renaming and deleting. Click-to-edit for the name, matching the
 * pattern the card detail view already established (display text by
 * default, an input only while actively editing).
 *
 * Deleting a board has no undo and no confirmation dialog primitive exists
 * anywhere in this codebase yet, so this uses the browser's native
 * `window.confirm` rather than building a whole modal component for one
 * button — a real confirm-dialog component is worth having the moment a
 * second destructive action needs one.
 */
import { useRef, useState, useTransition } from "react";
import {
  LayoutTemplateIcon,
  MoreHorizontalIcon,
  PencilIcon,
  StarIcon,
  TrashIcon,
} from "lucide-react";
import { deleteBoardAction, renameBoardAction } from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export function BoardHeader({
  boardId,
  folderId,
  name,
}: {
  boardId: string;
  folderId: string;
  name: string;
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
      setTitle(name); // an empty board name isn't a valid state to leave
      return;
    }
    if (trimmed === name) return;

    setError(null);
    startTransition(async () => {
      try {
        await renameBoardAction(boardId, folderId, trimmed);
      } catch (cause) {
        setTitle(name);
        setError(
          cause instanceof Error ? cause.message : "Couldn't rename the board.",
        );
      }
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        `Delete "${name}"? This removes every card on it. This can't be undone.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
      await deleteBoardAction(boardId, folderId);
      // Hard navigation, matching the rest of the app's post-mutation
      // redirects: the board this page is rendering no longer exists, so a
      // client-side push would try to re-render a route with stale server
      // data rather than actually leaving it.
      window.location.assign(`/folders/${folderId}`);
    });
  };

  const busy = pending || deleting;

  return (
    <div className="shrink-0 px-5 pb-4">
      <div className="flex items-center gap-2">
        <LayoutTemplateIcon
          className="size-[18px] shrink-0 text-k-black-56"
          strokeWidth={1.6}
        />

        {editing ? (
          <input
            ref={inputRef}
            autoFocus
            value={title}
            disabled={busy}
            aria-label="Board name"
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
          <button
            type="button"
            disabled={busy}
            onClick={() => setEditing(true)}
            className="-mx-1.5 min-w-0 truncate rounded-md px-1.5 py-0.5 text-left font-medium text-k-black-84 text-section transition-colors hover:bg-k-black-04 disabled:opacity-60"
          >
            {title}
          </button>
        )}

        <button
          type="button"
          aria-label="Favourite"
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <StarIcon className="size-4" strokeWidth={1.6} />
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Board options"
            disabled={busy}
            className={cn(
              "flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84",
              busy && "opacity-60",
            )}
          >
            <MoreHorizontalIcon className="size-4" strokeWidth={1.7} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem
              onClick={() => {
                setEditing(true);
                // The rename input isn't mounted until this click's state
                // update lands, so autoFocus on it (already set) does the
                // actual focusing — this just gets the menu out of the way.
              }}
            >
              <PencilIcon className="size-3.5" strokeWidth={1.8} />
              Rename
            </DropdownMenuItem>
            <DropdownMenuItem
              variant="destructive"
              disabled={deleting}
              onClick={remove}
            >
              <TrashIcon className="size-3.5" strokeWidth={1.8} />
              {deleting ? "Deleting…" : "Delete board"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {error ? <p role="alert" className="mt-1 text-k-red text-sm">{error}</p> : null}
    </div>
  );
}
