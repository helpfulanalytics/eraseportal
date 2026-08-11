/**
 * Next's built-in per-segment loading UI for the dashboard — shown while
 * `page.tsx`'s `Promise.all` (folders, organizations, clients) is still in
 * flight. Mirrors the shape of the real grid so the swap-in doesn't jump.
 */
export default function WorkspaceHomeLoading() {
  return (
    <div className="px-14 py-12">
      <div className="h-7 w-64 animate-pulse rounded-md bg-k-black-06" />
      <div className="mt-2 h-4 w-80 animate-pulse rounded-md bg-k-black-04-solid" />

      <div className="mt-8">
        <div className="mb-6 h-8 w-full max-w-[280px] animate-pulse rounded-lg bg-k-black-04-solid" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex flex-col gap-3 rounded-xl border border-k-black-08 p-5"
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5 size-2.5 shrink-0 animate-pulse rounded-full bg-k-black-08" />
                <div className="min-w-0 flex-1">
                  <div className="h-4 w-3/4 animate-pulse rounded bg-k-black-08" />
                  <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-k-black-04-solid" />
                </div>
              </div>
              <div className="border-k-black-06 border-t pt-3">
                <div className="h-3 w-2/3 animate-pulse rounded bg-k-black-04-solid" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
