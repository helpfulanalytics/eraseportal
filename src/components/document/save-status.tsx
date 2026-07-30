"use client";

/**
 * The only save feedback either editor has, so it has to be honest: it says
 * "Saved" strictly after a write has come back, and "Unsaved" for the whole
 * debounce window rather than optimistically pretending. A silent editor that
 * turns out not to have saved is the failure mode worth spending this row of
 * pixels on.
 */
import { CheckIcon, CloudOffIcon, EyeIcon, LoaderIcon } from "lucide-react";
import type { SaveState } from "@/components/document/use-autosave";
import { cn } from "@/lib/utils";

export function SaveStatus({
  state,
  readOnly,
}: {
  state: SaveState;
  /** Someone who can't edit gets told why there's nothing to save. */
  readOnly?: boolean;
}) {
  if (readOnly) {
    return (
      <span className="flex items-center gap-1.5 text-k-black-36 text-sm">
        <EyeIcon className="size-3.5" strokeWidth={1.7} />
        View only
      </span>
    );
  }

  if (state === "idle") return <span className="h-4" />;

  const label = {
    unsaved: "Unsaved changes",
    saving: "Saving…",
    saved: "Saved",
    error: "Couldn't save — keep editing, we'll retry",
    idle: "",
  }[state];

  const Icon = state === "error" ? CloudOffIcon : state === "saved" ? CheckIcon : LoaderIcon;

  return (
    <span
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center gap-1.5 text-sm",
        state === "error" ? "text-k-red" : "text-k-black-36",
      )}
    >
      <Icon
        className={cn("size-3.5", state === "saving" && "animate-spin")}
        strokeWidth={1.7}
      />
      {label}
    </span>
  );
}
