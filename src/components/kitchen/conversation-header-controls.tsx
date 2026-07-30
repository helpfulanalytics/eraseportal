"use client";

/**
 * Conversation title + overflow menu. Same pattern as `BoardHeader` and
 * `FolderHeaderControls`: click-to-edit name, `window.confirm` for delete.
 *
 * Unlike a folder, a conversation's delete isn't conditional — it removes
 * every message in it along with the conversation itself (see
 * `deleteConversation` in kitchen-data.ts). The confirm copy says so
 * explicitly rather than a generic "delete?".
 */
import { useRef, useState, useTransition } from "react";
import { MoreHorizontalIcon } from "lucide-react";
import {
  deleteConversationAction,
  renameConversationAction,
} from "@/app/(workspace)/actions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useOrgSlug } from "@/components/workspace-provider";

export function ConversationHeaderControls({
  conversationId,
  folderId,
  name,
}: {
  conversationId: string;
  folderId: string;
  name: string;
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
        await renameConversationAction(conversationId, folderId, trimmed);
      } catch (cause) {
        setTitle(name);
        setError(
          cause instanceof Error
            ? cause.message
            : "Couldn't rename the conversation.",
        );
      }
    });
  };

  const remove = () => {
    if (
      !window.confirm(
        `Delete "${name}"? Every message in it goes too. This can't be undone.`,
      )
    ) {
      return;
    }
    startDelete(async () => {
      await deleteConversationAction(conversationId, folderId);
      window.location.assign(`/w/${orgSlug}/folders/${folderId}`);
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
          aria-label="Conversation name"
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

      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More"
          disabled={busy}
          className="flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-56 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
        >
          <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-44">
          <DropdownMenuItem onClick={() => setEditing(true)}>Rename</DropdownMenuItem>
          <DropdownMenuItem variant="destructive" disabled={deleting} onClick={remove}>
            {deleting ? "Deleting…" : "Delete conversation"}
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
