"use client";

import {
  ImageIcon,
  MicIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PaperclipIcon,
} from "lucide-react";
import { useState, useTransition } from "react";
import { sendMessageAction } from "@/app/(workspace)/actions";
import { cn } from "@/lib/utils";

/**
 * Message composer. `isNote` distinguishes a client-visible message from an
 * internal note.
 *
 * NOTE: that distinction is currently cosmetic end to end — `getMessages`
 * returns notes to every reader, so marking one internal changes how it looks
 * and nothing else. Don't rely on it to hide anything from a client account
 * until the read path filters on it.
 */
export function Composer({ conversationId }: { conversationId: string }) {
  const [value, setValue] = useState("");
  const [isNote, setIsNote] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const canSend = value.trim().length > 0 && !pending;

  const send = () => {
    if (!canSend) return;
    const text = value;

    // Clear optimistically — the textarea should feel immediate, and the
    // failure path puts the text back rather than losing what was typed.
    setValue("");
    setError(null);

    startTransition(async () => {
      try {
        await sendMessageAction(conversationId, text, isNote);
      } catch {
        setValue(text);
        setError("Couldn't send that. Try again.");
      }
    });
  };

  return (
    <div className="shrink-0 px-5 pb-5">
      <div
        className={cn(
          "rounded-xl border transition-colors",
          isNote
            ? "border-k-yellow-23 bg-k-yellow-08"
            : "border-k-black-12 bg-background focus-within:border-k-black-24",
        )}
      >
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter sends; plain Enter stays a newline, because these
            // are long-form client messages rather than chat one-liners.
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              send();
            }
          }}
          rows={2}
          placeholder={
            isNote
              ? "Write an internal note — only your team can see this…"
              : "Write a message or note, or just drag files here..."
          }
          className="w-full resize-none bg-transparent px-4 pt-3 pb-1 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad"
        />

        <div className="flex items-center gap-1 px-3 pb-3">
          <button
            type="button"
            disabled={!canSend}
            onClick={send}
            className="mr-1 flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Sending…" : "Send"}
          </button>

          <ComposerAction label="Attach file">
            <PaperclipIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
          <ComposerAction label="Insert image">
            <ImageIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
          <ComposerAction label="Insert GIF">
            <span className="font-semibold text-2xs tracking-tight">GIF</span>
          </ComposerAction>
          <ComposerAction label="More options">
            <MoreHorizontalIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
          <ComposerAction label="Record audio">
            <MicIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>

          <ComposerAction
            label="Internal note"
            active={isNote}
            onClick={() => setIsNote((v) => !v)}
          >
            <NotebookPenIcon className="size-4" strokeWidth={1.6} />
          </ComposerAction>
        </div>
      </div>

      {error ? (
        <p role="alert" className="mt-1.5 px-1 text-k-red text-sm">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ComposerAction({
  label,
  active,
  onClick,
  children,
}: {
  label: string;
  active?: boolean;
  onClick?: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={onClick ? Boolean(active) : undefined}
      className={cn(
        "flex size-8 items-center justify-center rounded-lg transition-colors",
        active
          ? "bg-k-yellow-16 text-k-black-84"
          : "text-k-black-56 hover:bg-k-black-04 hover:text-k-black-84",
      )}
    >
      {children}
    </button>
  );
}
