"use client";

/**
 * The folder header's description toggle.
 *
 * `Folder.description` has been in the model — and in the Create Folder
 * dialog — since the beginning, and no folder page ever rendered it. The
 * button next to it toggled nothing. This shows it, and lets a member write
 * one without going back through a dialog.
 *
 * A popover anchored to the button rather than a block that pushes the page
 * around: the description is reference material, not part of the folder's
 * identity, and most folders don't have one.
 */
import { useEffect, useRef, useState, useTransition } from "react";
import { AlignLeftIcon } from "lucide-react";
import { setFolderDescriptionAction } from "@/app/(workspace)/actions";
import { cn } from "@/lib/utils";

export function FolderDescription({
  folderId,
  description,
  editable,
}: {
  folderId: string;
  description: string | undefined;
  editable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState(description ?? "");
  const [saved, setSaved] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointerDown, true);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown, true);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const commit = () => {
    const trimmed = value.trim();
    if (trimmed === saved.trim()) return;

    setError(null);
    const previous = saved;
    setSaved(trimmed);

    startTransition(async () => {
      try {
        await setFolderDescriptionAction(folderId, trimmed);
      } catch (cause) {
        setSaved(previous);
        setValue(previous);
        setError(
          cause instanceof Error ? cause.message : "Couldn't save that.",
        );
      }
    });
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-label={open ? "Hide description" : "Show description"}
        title={open ? "Hide description" : "Show description"}
        className={cn(
          "flex size-7 items-center justify-center rounded-md transition-colors",
          open || saved.trim()
            ? "text-k-black-84"
            : "text-k-black-36 hover:text-k-black-84",
          "hover:bg-k-black-04",
        )}
      >
        <AlignLeftIcon className="size-4" strokeWidth={1.6} />
      </button>

      {open ? (
        <div className="absolute top-[calc(100%+6px)] left-0 z-40 w-[420px] rounded-xl border border-k-black-08 bg-background p-3 shadow-popover">
          <div className="mb-1.5 text-k-black-40 text-xs uppercase tracking-wider">
            Description
          </div>

          {editable ? (
            <textarea
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onBlur={commit}
              rows={4}
              placeholder="What is this folder for?"
              className="w-full resize-none rounded-lg border border-k-black-08 px-2.5 py-2 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue"
            />
          ) : saved.trim() ? (
            <p className="whitespace-pre-wrap text-k-black-84 text-md">{saved}</p>
          ) : (
            <p className="text-k-black-40 text-md">No description yet.</p>
          )}

          {error ? (
            <p role="alert" className="mt-1 text-k-red text-sm">
              {error}
            </p>
          ) : editable ? (
            <p className="mt-1 text-k-black-36 text-sm">
              {pending ? "Saving…" : "Saves when you click away."}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
