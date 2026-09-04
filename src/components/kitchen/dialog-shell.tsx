"use client";

/**
 * The chrome every create dialog shares: overlay, panel, title row with a
 * close affordance, an error slot and a right-aligned save button.
 *
 * Extracted once there were two of these. Hand-rolling the second copy would
 * have meant two sets of padding, two Escape handlers and two definitions of
 * what the primary button looks like — which drift apart the moment either is
 * touched.
 *
 * Mount it only while open rather than passing an `open` prop. That gives the
 * contents fresh state per open for free; resetting in an effect would be
 * `setState` inside `useEffect`, which the React Compiler lint rule rejects.
 *
 * There is no dialog primitive in `ui/` — those are stock shadcn and off
 * limits to restyle — so this owns the modal behaviour directly, following
 * the pattern `share-dialog.tsx` established.
 */
import { useEffect } from "react";
import { XIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const SIZE_CLASS = {
  md: "max-w-[440px]",
  lg: "max-w-[600px]",
  /** The two-pane card detail view — fields on the left, comments on the right. */
  xl: "max-w-[880px]",
} as const;

export function DialogShell({
  title,
  subtitle,
  size = "md",
  onClose,
  onSubmit,
  submitLabel = "Save",
  pending,
  canSubmit,
  error,
  leftAction,
  hideSubmit,
  children,
}: {
  title: string;
  /** e.g. "in list Sprint" under the title, for the card detail view. */
  subtitle?: React.ReactNode;
  /**
   * "lg" is a new card (no comments yet); "xl" is an existing card's full
   * detail view. Every other dialog stays at "md".
   */
  size?: "md" | "lg" | "xl";
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  pending?: boolean;
  canSubmit: boolean;
  error?: string | null;
  /** Rendered at the left of the footer, opposite Save — a Delete button. */
  leftAction?: React.ReactNode;
  /**
   * Drop the Save button entirely — for a view where every field already
   * saves itself the instant it changes, a "Save" button has nothing left to
   * do. `leftAction` (Delete) still renders.
   */
  hideSubmit?: boolean;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      role="presentation"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-k-scrim-24 px-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "flex max-h-[85vh] w-full flex-col rounded-2xl bg-background shadow-xl",
          SIZE_CLASS[size],
        )}
      >
        <div className="flex shrink-0 items-start justify-between px-6 pt-5 pb-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-k-black-84 text-section">
              {title}
            </h2>
            {subtitle ? (
              <div className="mt-0.5 text-k-black-40 text-sm">{subtitle}</div>
            ) : null}
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 -mt-1 flex size-7 shrink-0 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-4.5" strokeWidth={1.7} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>

        {error ? (
          <p role="alert" className="shrink-0 px-6 pt-2 text-k-red text-sm">
            {error}
          </p>
        ) : null}

        {!hideSubmit || leftAction ? (
          <div className="flex shrink-0 items-center justify-between gap-3 px-6 pt-4 pb-5">
            <div>{leftAction}</div>
            {!hideSubmit ? (
              <button
                type="button"
                disabled={!canSubmit || pending}
                onClick={onSubmit}
                className="flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
              >
                {pending ? "Saving…" : submitLabel}
              </button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Small caps field label, matching the dialogs' uppercase tracking. */
export function FieldLabel({
  children,
  optional,
}: {
  children: React.ReactNode;
  optional?: boolean;
}) {
  return (
    <div className="mb-1.5 text-k-black-40 text-xs uppercase tracking-wider">
      {children}
      {optional ? (
        <span className="ml-1 normal-case tracking-normal">(optional)</span>
      ) : null}
    </div>
  );
}

/** The one input style these dialogs use. */
export const dialogFieldClass =
  "h-9 w-full rounded-lg border border-k-black-12 px-3 text-k-black-84 text-md outline-none placeholder:text-k-gray-ad focus:border-k-blue disabled:opacity-60";
