/**
 * The red unread-count pill shared by the dashboard's project cards, the
 * sidebar's board/conversation rows, and a folder's item list — one visual
 * language for "you haven't seen this yet" everywhere it shows up.
 */
import { cn } from "@/lib/utils";

export function UnreadBadge({
  count,
  mention,
  className,
}: {
  count?: number;
  /** A soft ring around the badge — some of this activity mentions the viewer, not just general chatter. */
  mention?: boolean;
  className?: string;
}) {
  if (!count) return null;

  return (
    <span
      className={cn(
        "flex h-4 min-w-4 shrink-0 items-center justify-center rounded-full bg-k-red px-1 font-medium text-[10px] text-k-white leading-none",
        mention && "ring-2 ring-k-red-32",
        className,
      )}
      aria-label={mention ? `${count} unread, including a mention` : `${count} unread`}
    >
      {count > 99 ? "99+" : count}
    </span>
  );
}
