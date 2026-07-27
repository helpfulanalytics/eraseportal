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

export function DialogShell({
  title,
  onClose,
  onSubmit,
  submitLabel = "Save",
  pending,
  canSubmit,
  error,
  children,
}: {
  title: string;
  onClose: () => void;
  onSubmit: () => void;
  submitLabel?: string;
  pending?: boolean;
  canSubmit: boolean;
  error?: string | null;
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
      className="fixed inset-0 z-50 flex items-center justify-center bg-k-black-24 px-4"
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl bg-background shadow-xl"
      >
        <div className="flex items-start justify-between px-6 pt-5 pb-4">
          <h2 className="font-semibold text-k-black-84 text-section">{title}</h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="-mr-1 flex size-7 items-center justify-center rounded-md text-k-black-40 transition-colors hover:bg-k-black-04 hover:text-k-black-84"
          >
            <XIcon className="size-4.5" strokeWidth={1.7} />
          </button>
        </div>

        {children}

        {error ? (
          <p role="alert" className="px-6 pt-2 text-k-red text-sm">
            {error}
          </p>
        ) : null}

        <div className="flex justify-end px-6 pt-4 pb-5">
          <button
            type="button"
            disabled={!canSubmit || pending}
            onClick={onSubmit}
            className="flex h-8 items-center rounded-lg bg-k-blue px-4 font-medium text-k-white text-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            {pending ? "Saving…" : submitLabel}
          </button>
        </div>
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
