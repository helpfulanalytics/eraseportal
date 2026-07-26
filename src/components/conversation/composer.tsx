"use client";

import {
  ImageIcon,
  MicIcon,
  MoreHorizontalIcon,
  NotebookPenIcon,
  PaperclipIcon,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Message composer. `isNote` distinguishes a client-visible message from an
 * internal note — the placeholder ("message or note") advertises both, so the
 * toggle is wired even though nothing is persisted yet.
 */
export function Composer() {
  const [value, setValue] = useState("");
  const [isNote, setIsNote] = useState(false);

  const canSend = value.trim().length > 0;

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
            className="mr-1 flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Send
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
