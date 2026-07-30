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
  CheckIcon,
  LayoutTemplateIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
} from "lucide-react";
import {
  deleteBoardAction,
  renameBoardAction,
  setBoardColorAction,
} from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { StarButton } from "@/components/kitchen/star-button";
import { useOrgSlug } from "@/components/workspace-provider";
import { SWATCH_COLORS } from "@/lib/kitchen-format";
import { cn } from "@/lib/utils";

export function BoardHeader({
  boardId,
  folderId,
  name,
  color,
  starred,
}: {
  boardId: string;
  folderId: string;
  name: string;
  color?: string;
  starred?: boolean;
}) {
  const orgSlug = useOrgSlug();
  const [title, setTitle] = useState(name);
  const [editing, setEditing] = useState(false);
  const [boardColor, setBoardColor] = useState(color ?? SWATCH_COLORS[0]);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [recoloring, startRecolor] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const pickColor = (next: string) => {
    if (next === boardColor) return;
    const previous = boardColor;
    setBoardColor(next);
    startRecolor(async () => {
      try {
        await setBoardColorAction(boardId, folderId, next);
      } catch {
        setBoardColor(previous);
      }
    });
  };

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
      window.location.assign(`/w/${orgSlug}/folders/${folderId}`);
    });
  };

  const busy = pending || deleting;

  return (
    <div className="shrink-0 px-5 pb-4">
      <div className="flex items-center gap-2">
        <LayoutTemplateIcon
          className="size-[18px] shrink-0"
          style={{ color: boardColor }}
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

        <StarButton kind="board" id={boardId} starred={starred} />

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
            <DropdownMenuSeparator />
            <DropdownMenuGroup>
              <DropdownMenuLabel>Colour</DropdownMenuLabel>
              {/* Plain buttons, not DropdownMenuItem — selecting one shouldn't
                  close the menu, since picking a colour is quick to redo if
                  the wrong swatch gets hit. */}
              <div className="flex items-center gap-1.5 px-1.5 py-1">
                {SWATCH_COLORS.map((swatch) => (
                  <button
                    key={swatch}
                    type="button"
                    disabled={recoloring}
                    aria-label={`Set board colour`}
                    aria-pressed={swatch === boardColor}
                    onClick={() => pickColor(swatch)}
                    style={{ backgroundColor: swatch }}
                    className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-k-black-16 disabled:opacity-60"
                  >
                    {swatch === boardColor ? (
                      <CheckIcon className="size-3.5 text-k-white" strokeWidth={2.5} />
                    ) : null}
                  </button>
                ))}
              </div>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
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
