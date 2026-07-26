import { cn } from "@/lib/utils";

/**
 * Page-shaped placeholder for a file row. Real thumbnails would render the
 * first page; until then the rule marks read as "document" faster than a
 * generic file glyph does.
 */
export function FileThumb({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-9 w-7 shrink-0 flex-col justify-center gap-[3px] rounded-[3px] border border-k-black-12 bg-background px-1",
        className,
      )}
      aria-hidden="true"
    >
      {[6, 4, 5, 3].map((w, i) => (
        <span
          key={`${w}-${i}`}
          className="h-[1.5px] rounded-full bg-k-black-16"
          style={{ width: `${w * 3}px` }}
        />
      ))}
    </span>
  );
}
