/**
 * The red unread-count pill shared by the dashboard's project cards, the
 * sidebar's board/conversation rows, and a folder's item list — one visual
 * language for "you haven't seen this yet" everywhere it shows up.
 */
import { cn } from "@/lib/utils";

export function UnreadBadge({
  count,
  className,
}: {
  count?: number;
  className?: string;
}) {
  if (!count) return null;

  return (
    <span
      className={cn(
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-k-red px-1 font-medium text-[10px] text-k-white leading-none",
        className,
      )}
      aria-label={`${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
