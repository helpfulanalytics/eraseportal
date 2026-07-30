"use client";

/**
 * Folder icon + title + overflow menu, mirroring `BoardHeader`'s pattern:
 * click-to-edit for the name, a swatch row for colour, `window.confirm`/
 * `window.alert` for delete since no confirm-dialog primitive exists in this
 * codebase yet.
 *
 * The folder icon lives here rather than in the parent page specifically so
 * a colour pick can repaint it instantly from local state — the same reason
 * `BoardHeader` renders its own `LayoutTemplateIcon`. The *other* FolderIcon,
 * the big one in the hero banner, stays in the server page: it reads
 * `folder.color` from props and only updates once `revalidatePath` refreshes
 * the page, which is an imperceptible wait for a background decorative
 * element and not worth threading colour state up to a second component for.
 *
 * Delete is conditional — `deleteFolderAction` throws if the folder still
 * has items in it (see the comment on `deleteFolder` in kitchen-data.ts;
 * cascading five collections of nested content safely is a bigger, riskier
 * piece of work than the rest of this file). `itemCount` lets this head that
 * off with a clear message before even asking for confirmation, rather than
 * showing "Delete?" and then failing.
 */
import { useRef, useState, useTransition } from "react";
import { CheckIcon, FolderIcon, MoreHorizontalIcon } from "lucide-react";
import {
  deleteFolderAction,
  renameFolderAction,
  setFolderColorAction,
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
import { useOrgSlug } from "@/components/workspace-provider";
import { SWATCH_COLORS } from "@/lib/kitchen-format";
import { cn } from "@/lib/utils";

/** The look every folder had before per-folder colour existed. */
const DEFAULT_FOLDER_COLOR = "var(--k-yellow)";

export function FolderHeaderControls({
  folderId,
  name,
  color,
  itemCount,
  triggerClassName,
}: {
  folderId: string;
  name: string;
  color?: string;
  itemCount: number;
  triggerClassName?: string;
}) {
  const orgSlug = useOrgSlug();
  const [title, setTitle] = useState(name);
  const [editing, setEditing] = useState(false);
  const [folderColor, setFolderColor] = useState(color ?? DEFAULT_FOLDER_COLOR);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const [recoloring, startRecolor] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const pickColor = (next: string) => {
    if (next === folderColor) return;
    const previous = folderColor;
    setFolderColor(next);
    startRecolor(async () => {
      try {
        await setFolderColorAction(folderId, next);
      } catch {
        setFolderColor(previous);
      }
    });
  };

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
        window.location.assign(`/w/${orgSlug}`);
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
      <FolderIcon
        className="size-8 shrink-0"
        style={{ color: folderColor, fill: folderColor }}
        strokeWidth={1.3}
      />

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
          <DropdownMenuSeparator />
          <DropdownMenuGroup>
            <DropdownMenuLabel>Colour</DropdownMenuLabel>
            {/* Plain buttons, not DropdownMenuItem — same reasoning as
                BoardHeader's swatch row: picking a colour shouldn't close
                the menu on the first click. */}
            <div className="flex items-center gap-1.5 px-1.5 py-1">
              {SWATCH_COLORS.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  disabled={recoloring}
                  aria-label="Set folder colour"
                  aria-pressed={swatch === folderColor}
                  onClick={() => pickColor(swatch)}
                  style={{ backgroundColor: swatch }}
                  className="flex size-6 items-center justify-center rounded-full ring-offset-2 ring-offset-background transition-shadow hover:ring-2 hover:ring-k-black-16 disabled:opacity-60"
                >
                  {swatch === folderColor ? (
                    <CheckIcon className="size-3.5 text-k-white" strokeWidth={2.5} />
                  ) : null}
                </button>
              ))}
            </div>
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
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
