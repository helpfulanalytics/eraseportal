/**
 * Next's built-in per-segment loading UI — shown automatically while
 * `layout.tsx`'s data (org lookup, nav tree) is still loading, e.g. right
 * after clicking an org card on the dashboard. No custom transition code
 * needed; the framework swaps this in and out on its own.
 */
export default function OrgWorkspaceLoading() {
  return (
    <div className="flex h-dvh w-full items-center justify-center bg-k-page">
      <div className="flex flex-col items-center gap-3">
        <div className="size-6 animate-spin rounded-full border-2 border-k-black-16 border-t-k-black-84" />
        <span className="text-k-black-40 text-sm">Loading workspace…</span>
      </div>
    </div>
  );
}
