/**
 * The red unread-count pill shared by the dashboard's project cards, the
 * sidebar's board/conversation rows, and a folder's item list — one visual
 * language for "you haven't seen this yet" everywhere it shows up.
 *
 * When some of that unread activity mentions the viewer, the pill leads with
 * "@" instead of a plain number — a mention is worth calling out by itself,
 * not folded anonymously into a count — and a trailing "+N" covers whatever
 * unread activity is left over. `@` alone means every unread message here is
 * a mention of you.
 */
import { cn } from "@/lib/utils";

export function UnreadBadge({
  count,
  mentionCount,
  className,
}: {
  count?: number;
  /** How many of `count` are messages that mention the viewer. */
  mentionCount?: number;
  className?: string;
}) {
  if (!count) return null;

  const mentions = mentionCount ?? 0;
  const rest = count - mentions;
  const isMention = mentions > 0;

  return (
    <span
      className={cn(
        "flex h-4 min-w-4 shrink-0 items-center justify-center gap-px rounded-full bg-k-red px-1 font-medium text-[10px] text-k-white leading-none",
        className,
      )}
      aria-label={
        isMention
          ? rest > 0
            ? `mentioned, plus ${rest} more unread`
            : "mentioned"
          : `${count} unread`
      }
    >
      {isMention ? (
        <>
          <span aria-hidden="true">@</span>
          {rest > 0 ? <span aria-hidden="true">+{rest > 99 ? "99+" : rest}</span> : null}
        </>
      ) : count > 99 ? (
        "99+"
      ) : (
        count
      )}
    </span>
  );
}
