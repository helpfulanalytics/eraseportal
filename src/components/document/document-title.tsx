"use client";

/**
 * The document's name and its overflow menu.
 *
 * Same click-to-edit-and-commit-on-blur contract as `BoardHeader` and
 * `ConversationHeaderControls`, but always-editable rather than
 * click-to-reveal: a document's title is the first line of the document, and
 * making people click a button to change it is the kind of friction Notion
 * doesn't have. A borderless `<input>` rather than a second
 * `contenteditable` — the title is plain text, and an input gets Escape,
 * undo and form semantics for free.
 */
import { useRef, useState, useTransition } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import {
  deleteDocumentAction,
  renameDocumentAction,
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

export function DocumentTitle({
  documentId,
  folderId,
  name,
  editable,
  starred,
  size = "page",
}: {
  documentId: string;
  folderId: string;
  name: string;
  editable: boolean;
  starred?: boolean;
  /** A page puts its title in the body; a canvas puts it in the toolbar. */
  size?: "page" | "compact";
}) {
  const orgSlug = useOrgSlug();
  const [title, setTitle] = useState(name);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [deleting, startDelete] = useTransition();
  const committed = useRef(name);

  const commit = () => {
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(committed.current);
      return;
    }
    if (trimmed === committed.current) return;

    setError(null);
    const previous = committed.current;
    committed.current = trimmed;

    startTransition(async () => {
      try {
        await renameDocumentAction(documentId, trimmed);
      } catch (cause) {
        committed.current = previous;
        setTitle(previous);
        setError(
          cause instanceof Error ? cause.message : "Couldn't rename the document.",
        );
      }
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        `Delete "${committed.current}"? Everything in it goes too. This can't be undone.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
      await deleteDocumentAction(documentId);
      window.location.assign(`/w/${orgSlug}/folders/${folderId}`);
    });
  };

  const typeClass =
    size === "page"
      ? "font-semibold text-k-black-84 text-title"
      : "font-medium text-k-black-84 text-section";

  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {editable ? (
        <input
          value={title}
          disabled={deleting}
          aria-label="Document name"
          placeholder="Untitled"
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.currentTarget.blur();
            }
            if (e.key === "Escape") {
              setTitle(committed.current);
              e.currentTarget.blur();
            }
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-k-black-16 disabled:opacity-60",
            typeClass,
            pending && "opacity-70",
          )}
        />
      ) : (
        <h1 className={cn("min-w-0 flex-1 truncate", typeClass)}>{title}</h1>
      )}

      <StarButton kind="document" id={documentId} starred={starred} />

      {editable ? (
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-label="Document options"
            disabled={deleting}
            className="flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-36 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            <DropdownMenuItem variant="destructive" disabled={deleting} onClick={remove}>
              {deleting ? "Deleting…" : "Delete document"}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}

      {error ? (
        <p role="alert" className="text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}
