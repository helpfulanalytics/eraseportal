"use client";

/**
 * Next's built-in per-segment error boundary for the dashboard. Catches a
 * failed `getFolders`/`getOrganizations`/`getClients` fetch (a downed
 * Firestore connection, a thrown auth check) so the page shows a retry
 * affordance instead of the framework's default crash screen.
 */
import { AlertTriangleIcon, RotateCwIcon } from "lucide-react";
import { useEffect } from "react";

export default function WorkspaceHomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Workspace dashboard failed to load:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center gap-3 px-14 py-24 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-k-black-04-solid text-k-black-40">
        <AlertTriangleIcon className="size-6" aria-hidden="true" />
      </div>
      <h2 className="font-semibold text-k-black-84 text-section">
        Couldn&apos;t load your dashboard
      </h2>
      <p className="max-w-sm text-k-black-40 text-md">
        Something went wrong fetching your projects. Try again, or refresh the
        page.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-2 flex h-8 items-center gap-1.5 rounded-lg bg-k-blue px-3 text-k-white text-md transition-opacity hover:opacity-90"
      >
        <RotateCwIcon className="size-3.5" strokeWidth={1.8} aria-hidden="true" />
        Try again
      </button>
    </div>
  );
}
